// ── Agent 循环引擎 ───────────────────────────────────────
// 负责消息管理、LLM 调用、工具执行调度

import type { Message, ToolUseBlock, AgentContext, AgentTool } from './types'
import { getAgentConfig, getApiBase } from './config'
import { getAllTools, getToolsForModule, executeTool } from './ToolRegistry'
import { buildSystemPrompt } from './knowledge/prompts/system'
import { blocksUnrevisedSceneAdvance, mustReviseAssemblyBeforeAdvance, wantsDirectSceneAssembly } from './AgentDispatchIntent'

interface StreamCallbacks {
  onText: (delta: string) => void
  onToolUse?: (tool: ToolUseBlock) => Promise<string>
  onComplete: (fullText: string) => void
  onError: (error: Error) => void
}

/**
 * 发送对话请求到后端 AI Agent
 * 支持流式 SSE 响应和工具调用
 */
async function sendChatRequest(
  messages: Message[],
  tools: AgentTool[],
  system: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const config = getAgentConfig()
  const apiBase = getApiBase()

  const body: Record<string, any> = {
    messages,
    tools,
    system,
    stream: true,
  }
  // 只在显式配置时才发送 provider/model，否则由后端 .env 决定
  if (config.provider) body.provider = config.provider
  if (config.model) body.model = config.model

  const response = await fetch(`${apiBase}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    const err = await response.text().catch(() => 'Unknown error')
    throw new Error(`AI 服务请求失败 (${response.status}): ${err}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''
  let toolUseBlock: Partial<ToolUseBlock> | null = null
  let inputJson = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') break

      try {
        const evt = JSON.parse(data)
        if (evt.type === 'error') throw new Error(evt.error || 'AI 服务流式响应失败')

        if (evt.type === 'content_block_start' && evt.content_block?.type === 'tool_use') {
          toolUseBlock = { type: 'tool_use', id: evt.content_block.id, name: evt.content_block.name, input: {} }
          inputJson = ''
        } else if (evt.type === 'content_block_delta') {
          if (evt.delta?.type === 'text_delta') {
            callbacks.onText(evt.delta.text)
            fullText += evt.delta.text
          } else if (evt.delta?.type === 'input_json_delta') {
            inputJson += evt.delta.partial_json
          }
        } else if (evt.type === 'content_block_stop' && toolUseBlock) {
          try { toolUseBlock.input = JSON.parse(inputJson) } catch { /* ignore */ }
          if (callbacks.onToolUse) {
            // 工具结果只写入下一轮模型上下文。界面由工具状态卡片展示执行过程，
            // 避免把内部 JSON 结果直接混入助手的自然语言回答。
            await callbacks.onToolUse(toolUseBlock as ToolUseBlock)
          }
          toolUseBlock = null
        }
      } catch (error) {
        if (error instanceof SyntaxError) continue
        throw error
      }
    }
  }

  callbacks.onComplete(fullText)
}

/**
 * AgentEngine — 管理对话和工具调用循环
 */
export class AgentEngine {
  private messages: Message[] = []
  private systemPrompt: string = ''
  private abortController: AbortController | null = null

  constructor(systemPrompt: string) {
    this.systemPrompt = systemPrompt
  }

  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt
  }

  addMessage(role: Message['role'], content: string): void {
    this.messages.push({ role, content })
  }

  getMessages(): Message[] {
    return [...this.messages]
  }

  clearHistory(): void {
    this.messages = []
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  /**
   * 发送用户消息，处理流式响应 + 工具调用循环
   */
  async chat(
    userMessage: string,
    context: AgentContext,
    callbacks: StreamCallbacks,
    maxToolRounds = 20,
  ): Promise<void> {
    this.abortController = new AbortController()
    const signal = this.abortController.signal

    try {
      // 1. 添加用户消息
      this.addMessage('user', userMessage)

      // 2. 根据上下文选择工具
      const availableTools = context.scene
        ? [...getToolsForModule('common'), ...getToolsForModule(context.scene)]
        : getAllTools()
      const directSceneAssembly = wantsDirectSceneAssembly(userMessage)
      const tools = directSceneAssembly
        ? availableTools.filter(tool => tool.name === 'assemble_scene_at_mileage')
        : availableTools

      // 3. 构建增强的 system prompt（包含 RAG 上下文）
      let system = buildSystemPrompt(context, userMessage)

      // 4. Agent 循环（最多 maxToolRounds 轮）
      let round = 0
      let completedText = ''
      let pendingTask: { taskId: string; currentStepId: string; completed: number; total: number } | null = null
      let completionNudges = 0
      let rejectedAdvances = 0
      let revisionCompleted = false
      let blockedUnrevisedAdvances = 0
      let stopAfterTool = false
      while (round < maxToolRounds) {
        round++
        let hadToolUse = false
        let roundText = ''
        const roundToolCalls: NonNullable<Message['tool_calls']> = []
        const roundToolResults: Message[] = []

        await sendChatRequest(
          this.messages,
          pendingTask
            ? tools.filter(tool => ['advance_platform_task', 'revise_next_scene_assembly', 'get_task_status'].includes(tool.name))
            : tools,
          system,
          {
            onText: callbacks.onText,
            onToolUse: async (tool: ToolUseBlock) => {
              hadToolUse = true
              let result: string
              if (directSceneAssembly && stopAfterTool) {
                result = JSON.stringify({ ok: false, action: tool.name,
                  reason: '本轮场景工具调用已结束，后续调用已拒绝' })
              } else if (directSceneAssembly && tool.name !== 'assemble_scene_at_mileage') {
                result = JSON.stringify({ ok: false, action: tool.name,
                  reason: '普通场景请求只允许调用 assemble_scene_at_mileage' })
                stopAfterTool = true
              } else if (blocksUnrevisedSceneAdvance(userMessage, pendingTask?.completed ?? 0, revisionCompleted, tool.name)) {
                blockedUnrevisedAdvances++
                result = JSON.stringify({
                  action: 'revision_required', ok: false,
                  reason: '用户要求先观察结果并修订当前场景装配。请调用 revise_next_scene_assembly，确认校验成功后再推进。',
                  taskId: pendingTask?.taskId, currentStepId: pendingTask?.currentStepId,
                  completed: pendingTask?.completed, total: pendingTask?.total,
                })
                if (blockedUnrevisedAdvances >= 2) stopAfterTool = true
              } else if (callbacks.onToolUse) {
                result = await callbacks.onToolUse(tool)
              } else {
                // 默认：通过 ToolRegistry 执行
                result = await executeTool(tool.name, tool.input)
              }
              // Single-entry assembly already runs the validated workflow internally.
              if (tool.name === 'assemble_scene_at_mileage') stopAfterTool = true
              try {
                const observation = JSON.parse(result)
                if (observation.action === 'revise_next_scene_assembly' && observation.ok === true) {
                  revisionCompleted = true
                }
                if (['prepare_platform_task', 'advance_platform_task', 'revise_next_scene_assembly'].includes(observation.action)) {
                  if (observation.action === 'advance_platform_task' && observation.ok === false) {
                    rejectedAdvances++
                    if (rejectedAdvances >= 2 || observation.status === 'failed') stopAfterTool = true
                  }
                  if (observation.action === 'advance_platform_task' && observation.ok === true) rejectedAdvances = 0
                  pendingTask = observation.prepared && observation.status !== 'completed'
                    && observation.status !== 'failed' && observation.taskId && observation.currentStepId
                    ? { taskId: observation.taskId, currentStepId: observation.currentStepId,
                        completed: observation.completed, total: observation.total }
                    : null
                }
              } catch { /* non-workflow tool output */ }
              roundToolCalls.push({ id: tool.id, name: tool.name, input: tool.input })
              roundToolResults.push({
                role: 'tool',
                content: result,
                tool_call_id: tool.id,
                name: tool.name,
              })
              return result
            },
            onComplete: (text) => { roundText = text },
            onError: callbacks.onError,
          },
          signal,
        )

        if (roundToolCalls.length > 0) {
          // One model response can contain several tool calls. Keep their
          // shared assistant turn before every matching tool result.
          this.messages.push({ role: 'assistant', content: roundText, tool_calls: roundToolCalls })
          this.messages.push(...roundToolResults)
        }

        if (roundText) {
          completedText += `${completedText ? '\n' : ''}${roundText}`
          if (!hadToolUse) this.addMessage('assistant', roundText)
        }
        if (stopAfterTool) break
        if (!hadToolUse) {
          if (pendingTask && completionNudges < 1 && round < maxToolRounds) {
            completionNudges++
            // The model still decides whether to advance; the platform never auto-executes here.
            system += `\n\n本轮平台状态：任务 ${pendingTask.taskId} 已完成 ${pendingTask.completed}/${pendingTask.total} 步，当前待执行步骤 ${pendingTask.currentStepId}。${mustReviseAssemblyBeforeAdvance(userMessage) && !revisionCompleted && pendingTask.completed > 0 ? '用户明确要求先修订当前装配，下一动作必须调用 revise_next_scene_assembly，平台校验通过后才能推进。' : '根据刚返回的装配结果，如需调整当前阶段同屏资源，先调用 revise_next_scene_assembly；否则调用 advance_platform_task。'}参数 taskId=${pendingTask.taskId}、currentStepId=${pendingTask.currentStepId}。如应停止，请说明确切原因。`
            continue
          }
          break
        }
      }
      callbacks.onComplete(completedText)
    } catch (err: any) {
      if (err.name === 'AbortError') return
      callbacks.onError(err)
    } finally {
      this.abortController = null
    }
  }

}

/** 创建默认的 AgentEngine 实例 */
export function createAgentEngine(systemPrompt?: string): AgentEngine {
  return new AgentEngine(
    systemPrompt || '你是隧道施工数字孪生平台的智能助手，专注于辅助隧道钻爆法施工管理。使用中文回答，简洁专业。',
  )
}
