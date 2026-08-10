// ── Agent 循环引擎 ───────────────────────────────────────
// 负责消息管理、LLM 调用、工具执行调度

import type { Message, ToolUseBlock, AgentContext, AgentTool } from './types'
import { getAgentConfig, getApiBase } from './config'
import { getAllTools, getToolsForModule, executeTool } from './ToolRegistry'
import { buildSystemPrompt } from './knowledge/prompts/system'

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
  let fullText = ''
  let toolUseBlock: Partial<ToolUseBlock> | null = null
  let inputJson = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') break

      try {
        const evt = JSON.parse(data)

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
            const result = await callbacks.onToolUse(toolUseBlock as ToolUseBlock)
            callbacks.onText('\n' + result)
            fullText += '\n' + result
          }
          toolUseBlock = null
        }
      } catch { /* skip parse errors */ }
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
    maxToolRounds = 5,
  ): Promise<void> {
    this.abortController = new AbortController()
    const signal = this.abortController.signal

    try {
      // 1. 添加用户消息
      this.addMessage('user', userMessage)

      // 2. 根据上下文选择工具
      const tools = context.scene
        ? [...getToolsForModule('common'), ...getToolsForModule(context.scene)]
        : getAllTools()

      // 3. 构建增强的 system prompt（包含 RAG 上下文）
      const system = buildSystemPrompt(context, userMessage)

      // 4. Agent 循环（最多 maxToolRounds 轮）
      let round = 0
      while (round < maxToolRounds) {
        round++
        let hadToolUse = false

        await sendChatRequest(
          this.messages,
          tools,
          system,
          {
            ...callbacks,
            onToolUse: async (tool: ToolUseBlock) => {
              hadToolUse = true
              if (callbacks.onToolUse) {
                return await callbacks.onToolUse(tool)
              }
              // 默认：通过 ToolRegistry 执行
              return await executeTool(tool.name, tool.input)
            },
          },
          signal,
        )

        if (!hadToolUse) break
      }
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
