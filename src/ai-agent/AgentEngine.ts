// ── Agent 循环引擎 ───────────────────────────────────────
// 负责消息管理、LLM 调用、工具执行调度

import type { Message, ToolUseBlock, AgentContext, AgentTool } from './types'
import { getAgentConfig, getApiBase } from './config'
import { getAllTools, getToolsForModule, executeTool } from './ToolRegistry'
import { buildSystemPrompt } from './knowledge/prompts/system'
import { blocksUnrevisedSceneAdvance, mustReviseAssemblyBeforeAdvance, wantsDirectSceneAssembly, wantsBlastLayerControl, wantsTaskViewControl, wantsTaskCutControl, resolveClarifiedSceneRequest } from './AgentDispatchIntent'
import { thermalRequestIssue } from '@/modules/ventilation/thermal-catalog'
import { readSceneCapabilities } from './SceneCapabilities'
import { wantsScenePreflight, wantsTestSupportUpdate } from './AgentDispatchIntent'
import {wantsSupportLayerControl,wantsSupportInspection} from './SupportLayerIntent'
import {wantsReadOnlyFlowEvaluation,wantsTaskReset,readOnlyTaskReviewTool,taskVisualReviewIntent} from './AgentDispatchIntent'
import {agentServiceError} from './ServiceError'
import {formatSupportInspection} from './SupportInspectionReply'

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
    throw new Error(agentServiceError(response.status,err))
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
        if (evt.type === 'error') throw new Error(agentServiceError(0,String(evt.error??'')))

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
  private pendingSceneRequest?: string
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
    this.pendingSceneRequest = undefined
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
      // Explicit recovery remains available even when the model provider is down.
      const localTool=(taskVisualReviewIntent(userMessage)||readOnlyTaskReviewTool(userMessage)==='inspect_task_scene')?undefined:wantsTaskReset(userMessage)?'reset_task_scene':wantsSupportInspection(userMessage)?'inspect_current_support':undefined
      if(localTool){
        const call:ToolUseBlock={type:'tool_use',id:`local-scene-${Date.now()}`,name:localTool,input:{}}
        this.messages.push({role:'assistant',content:'',tool_calls:[{id:call.id,name:call.name,input:call.input}]})
        const output=callbacks.onToolUse?await callbacks.onToolUse(call):await executeTool(call.name,call.input)
        this.messages.push({role:'tool',content:output,tool_call_id:call.id,name:call.name})
        let summary='平台操作未完成，请查看返回的错误。'
        try{
          const result=JSON.parse(output)
          summary=result.ok===true?(localTool==='inspect_current_support'?formatSupportInspection(result.supports,userMessage):'当前任务场景已复位，任务模型已释放并恢复主场景。'):`${localTool==='reset_task_scene'?'任务复位':'支护查询'}未完成：${result.reason??result.notice?.message??'请查看任务状态'}`
        }catch{/* no success claim for a non-JSON error */}
        this.addMessage('assistant',summary);callbacks.onText(summary);callbacks.onComplete(summary)
        return
      }

      // 2. 根据上下文选择工具
      const selectedTools = context.scene
        ? [...getToolsForModule('common'), ...getToolsForModule(context.scene)]
        : getAllTools()
      const availableTools = [...new Map(selectedTools.map(tool => [tool.name, tool])).values()]
      const effectiveRequest = resolveClarifiedSceneRequest(userMessage, this.pendingSceneRequest)
      this.pendingSceneRequest = undefined
      const visualIntent=taskVisualReviewIntent(userMessage)
      const supportInspection=!visualIntent&&wantsSupportInspection(userMessage)
      const visualTools=['inspect_task_scene',...(visualIntent==='plan'?['plan_task_visual_review']:visualIntent==='restore'?['restore_task_visual_review']:['plan_task_visual_review','apply_task_visual_review'])]
      const readReview=visualIntent?undefined:readOnlyTaskReviewTool(userMessage)
      const flowEvaluation=!readReview&&wantsReadOnlyFlowEvaluation(userMessage)
      const supportTool=supportInspection?'inspect_current_support':'set_support_layers'
      const supportLayers = !visualIntent&&!wantsTaskCutControl(userMessage)&&(supportInspection||wantsSupportLayerControl(userMessage))
      const supportUpdate = !visualIntent && !supportLayers && wantsTestSupportUpdate(userMessage)
      const directSceneAssembly = !supportUpdate && wantsDirectSceneAssembly(effectiveRequest)
      const blastLayerControl = !visualIntent && wantsBlastLayerControl(userMessage)
      const viewControl = !visualIntent && !supportUpdate && wantsTaskViewControl(userMessage)
      const cutControl = !visualIntent && wantsTaskCutControl(userMessage)
      const preflightControl = !visualIntent && wantsScenePreflight(userMessage)
      const timeIssue = directSceneAssembly ? thermalRequestIssue(effectiveRequest) : undefined
      if (timeIssue) {
        this.addMessage('assistant', timeIssue)
        callbacks.onText(timeIssue)
        callbacks.onComplete(timeIssue)
        return
      }
      const tools = visualIntent?availableTools.filter(tool=>visualTools.includes(tool.name)):readReview?availableTools.filter(tool=>tool.name===readReview):flowEvaluation?availableTools.filter(tool=>['evaluate_task_flow_review','inspect_task_flow_review'].includes(tool.name)):supportLayers ? availableTools.filter(tool=>tool.name===supportTool) : supportUpdate ? availableTools.filter(tool => tool.name === 'update_test_support') : preflightControl ? availableTools.filter(tool => tool.name === 'check_scene_assembly') : cutControl ? availableTools.filter(tool => tool.name === 'set_task_volume_cut') : viewControl ? availableTools.filter(tool => tool.name === 'set_task_view') : blastLayerControl ? availableTools.filter(tool => tool.name === 'set_blast_layers') : directSceneAssembly
        ? availableTools.filter(tool => tool.name === 'assemble_scene_at_mileage')
        : availableTools

      // 3. 构建增强的 system prompt（包含 RAG 上下文）
      let system = buildSystemPrompt(context, userMessage)
      if(visualIntent)system+=`\n本轮为当前任务视觉分析${visualIntent}。仅允许${visualTools.join('、')}。先调用inspect_task_scene读取当前任务ID和根资源，再规划。规划的userRequest由平台绑定原话；重点ID必须来自当前任务。只规划不能执行；执行先规划并使用返回taskId，最多一次应用。恢复只恢复当前计划。必须根据实际工具结果说明目标、动作和未解决项，不重装、改数据或声称验收通过。`
      if(readReview)system+=`\n本轮只读核查必须先调用${readReview}读取当前实际状态。不得装配、复位、选择曲线、缩放窗口或改变相机。没有查询结果时明确说明，不能引用历史状态充当本轮查询。`
      if(flowEvaluation)system+='\n本轮是当前风场画面的只读评价。必须先调用evaluate_task_flow_review获得实际状态、剩余预算及停止原因；可补充inspect_task_flow_review。不得修改、切换模式或装配。'
      if (directSceneAssembly) {
        const capabilities = readSceneCapabilities()
        if (capabilities) system += `\n\n平台本轮实际注册能力（只读元数据核查）：${JSON.stringify(capabilities)}\n仅从上述资源选择。declaredRange是模块声明范围，可能是源资料范围，不能据此声称目标工段有实测资料或允许任意迁移；最终由装配校验判定。state仅是运行加载状态，不表示文件可读性或工程有效性。targetDataVerified=false表示尚未核验目标资料对应关系。`
      }

      // 4. Agent 循环（最多 maxToolRounds 轮）
      let round = 0
      let completedText = ''
      let pendingTask: { taskId: string; currentStepId: string; completed: number; total: number } | null = null
      let completionNudges = 0
      let sceneReadEvidence = false
      const sceneFactIds = new Set<string>()
      let citationNudges = 0
      let missingSceneReadNudges = 0
      const requireSceneRead = readReview === 'inspect_task_scene'
      let missingActionNudges = 0
      let rejectedAdvances = 0
      let revisionCompleted = false
      let blockedUnrevisedAdvances = 0
      let stopAfterTool = false
      let recoveryTaskId: string | undefined
      let visualOutcome = false
      let visualFailure = ''
      let visualPlanCompleted = false
      let visualWriteCompleted = false
      let recoveryUsed = false
      if(requireSceneRead&&tools.some(tool=>tool.name==='inspect_task_scene')){
        const readCall:ToolUseBlock={type:'tool_use',id:`required-scene-read-${Date.now()}`,name:'inspect_task_scene',input:{}}
        const output=callbacks.onToolUse?await callbacks.onToolUse(readCall):await executeTool(readCall.name,readCall.input)
        this.messages.push({role:'assistant',content:'',tool_calls:[{id:readCall.id,name:readCall.name,input:{}}]},{role:'tool',content:output,tool_call_id:readCall.id,name:readCall.name})
        try{const observation=JSON.parse(output);if(observation.ok===true&&observation.scene){sceneReadEvidence=true;for(const fact of observation.scene.evidenceAssessment?.facts??[])if(typeof fact.id==='string')sceneFactIds.add(fact.id)}}catch{/* actual read failed; existing no-evidence guard remains */}
        system+='\n本轮平台已按用户明确的只读请求执行inspect_task_scene，刚附加的tool结果是本轮实际快照。先解释该结果；不需要仅为证明调用再重复查询。读取失败时明确说明，不能补造状态。'
      }
      while (round < maxToolRounds) {
        round++
        let hadToolUse = false
        let roundText = ''
        let assemblyReturnedThisRound = false
        const roundToolCalls: NonNullable<Message['tool_calls']> = []
        const roundToolResults: Message[] = []

        await sendChatRequest(
          this.messages,
          recoveryTaskId ? availableTools.filter(tool => tool.name === 'retry_scene_load') : pendingTask
            ? tools.filter(tool => ['advance_platform_task', 'revise_next_scene_assembly', 'get_task_status'].includes(tool.name))
            : tools,
          system,
          {
            // Scene-action prose is held until this round has a real tool result
            // or a clarification. Historical completion text cannot prove a new action.
            onText: delta => { if(!visualIntent && !directSceneAssembly && !requireSceneRead)callbacks.onText(delta) },
            onToolUse: async (tool: ToolUseBlock) => {
              if(tool.name==='plan_task_visual_review')tool.input={...tool.input,userRequest:userMessage}
              if(supportLayers)tool.input={userRequest:userMessage}
              if (tool.name === 'assemble_scene_at_mileage' || tool.name === 'update_test_support') tool.input = { ...tool.input, userRequest: tool.name === 'update_test_support' ? userMessage : effectiveRequest }
              hadToolUse = true
              let result: string
              if ((supportLayers || directSceneAssembly || blastLayerControl || viewControl || cutControl || preflightControl || recoveryTaskId) && (stopAfterTool || assemblyReturnedThisRound)) {
                result = JSON.stringify({ ok: false, action: tool.name,
                  reason: '本轮场景工具调用已结束，后续调用已拒绝' })
              } else if(visualIntent&&(!visualTools.includes(tool.name)||(visualWriteCompleted&&tool.name!=='inspect_task_scene'))){
                result=JSON.stringify({ok:false,action:tool.name,reason:'当前视觉分析仅允许本轮受控工具，且每轮最多一次应用或恢复'})
                stopAfterTool=true
              } else if(visualIntent&&tool.name==='apply_task_visual_review'&&!visualPlanCompleted){
                result=JSON.stringify({ok:false,action:tool.name,reason:'本轮必须先成功规划当前视觉分析目标，再应用返回的任务ID'})
              } else if(readReview&&tool.name!==readReview){
                result=JSON.stringify({ok:false,action:tool.name,reason:'本轮只读核查不允许修改图表、相机或场景'})
                stopAfterTool=true
              } else if(flowEvaluation&&!['evaluate_task_flow_review','inspect_task_flow_review'].includes(tool.name)){
                result=JSON.stringify({ok:false,action:tool.name,reason:'本轮只读评价不允许修改相机、表达或场景装配'})
                stopAfterTool=true
              } else if (preflightControl && tool.name !== 'check_scene_assembly') {
                result = JSON.stringify({ ok: false, action: tool.name, reason: '只读预检不得执行装配或修改场景' })
                stopAfterTool = true
              } else if (cutControl && tool.name !== 'set_task_volume_cut') {
                result = JSON.stringify({ ok: false, action: tool.name, reason: '剖切调整不得重新装配场景' })
                stopAfterTool = true
              } else if (!cutControl && viewControl && tool.name !== 'set_task_view') {
                result = JSON.stringify({ ok: false, action: tool.name, reason: '视角调整不得重新装配场景' })
                stopAfterTool = true
              } else if (supportLayers && tool.name !== supportTool) {
                result=JSON.stringify({ok:false,reason:'当前仅允许调整已有支护构件显隐'})
              } else if (blastLayerControl && tool.name !== 'set_blast_layers') {
                result = JSON.stringify({ ok: false, action: tool.name, reason: '当前图层显示指令只允许调整已有爆破模型，不得创建任务或更改里程' })
                stopAfterTool = true
              } else if (supportUpdate && tool.name !== 'update_test_support') {
                result = JSON.stringify({ ok: false, action: tool.name, reason: '当前支护变更必须通过update_test_support承接实际任务，不能另猜场景或参数' })
                stopAfterTool = true
              } else if (recoveryTaskId && (tool.name !== 'retry_scene_load' || tool.input.taskId !== recoveryTaskId)) {
                result = JSON.stringify({ ok: false, reason: '只能重试刚返回的失败任务，不能改换任务或资源' })
                stopAfterTool = true
              } else if (directSceneAssembly && tool.name !== (recoveryTaskId ? 'retry_scene_load' : 'assemble_scene_at_mileage')) {
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
              if (tool.name === 'inspect_current_support' || tool.name === 'set_support_layers' || tool.name === 'update_test_support' || tool.name === 'assemble_scene_at_mileage' || tool.name === 'retry_scene_load' || tool.name === 'set_blast_layers' || tool.name === 'set_task_view' || tool.name === 'set_task_volume_cut' || tool.name === 'check_scene_assembly') {
                stopAfterTool = true
                assemblyReturnedThisRound = true
              }
              try {
                const observation = JSON.parse(result)
                if (tool.name === 'assemble_scene_at_mileage' && !recoveryUsed && observation.ok === false &&
                    typeof observation.taskId === 'string' && observation.taskId.length > 0 &&
                    observation.recovery?.kind === 'retry-scene-load' && observation.recovery.taskId === observation.taskId) {
                  recoveryTaskId = observation.taskId
                  recoveryUsed = true
                  stopAfterTool = false
                  system += `\n平台反馈：任务${recoveryTaskId}首阶段因临时网络加载失败且资源已释放。可调用retry_scene_load，taskId=${recoveryTaskId}，仅重试原任务一次；不得重新装配、改里程、删资源或宣称成功。若不重试，请说明停止原因。`
                }
                if (visualIntent && observation.ok === false) visualFailure = String(observation.reason ?? observation.error ?? '工具校验未通过')
                if (visualIntent && observation.ok === true && tool.name === (visualIntent==='plan'?'plan_task_visual_review':visualIntent==='apply'?'apply_task_visual_review':'restore_task_visual_review')) visualOutcome=true
                if (visualIntent && tool.name==='plan_task_visual_review' && observation.ok===true) {visualPlanCompleted=true;if(visualIntent==='apply'&&observation.review?.remaining===0)visualFailure='当前场景视觉调整已达2次上限；重新规划或恢复不会重置预算'}
                if (visualIntent && ['apply_task_visual_review','restore_task_visual_review'].includes(tool.name) && observation.ok === true) visualWriteCompleted = true
                if (requireSceneRead && tool.name === readReview && observation.ok === true && observation.scene) {sceneReadEvidence = true;for(const fact of observation.scene.evidenceAssessment?.facts??[])if(typeof fact.id==='string')sceneFactIds.add(fact.id)}
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

        if (requireSceneRead && !hadToolUse && !sceneReadEvidence) {
          if (missingSceneReadNudges < 1 && round < maxToolRounds) {
            missingSceneReadNudges++
            system += '\n本轮尚无inspect_task_scene实际返回，不能根据聊天记录回答当前状态。请调用该只读工具；不可调用时明确说明未能核查。'
            continue
          }
          roundText = '本轮未取得当前场景自检结果，无法核实当前装配状态。未修改模型、视角或任务；不能把历史装配结果当作本次自检。'
        }
        if (requireSceneRead && !hadToolUse && sceneReadEvidence) {
          const cited = roundText.match(/scene-[\w-]+:(?:location|step):\d+/g) ?? []
          if(cited.some(id=>!sceneFactIds.has(id)) || (sceneFactIds.size>0 && (/引用.*事实.?ID/i.test(userMessage)||/[.…]\s*:(?:location|step):\d/.test(roundText)) && !cited.length)) {
            if(citationNudges<1 && round<maxToolRounds){citationNudges++;system+=`\n本轮事实引用不完整或不匹配。请逐字完整引用以下本轮ID，禁止省略号或缩写：${JSON.stringify([...sceneFactIds])}。不要新查或修改场景，基于刚才的实际工具结果重新回答。`;continue}
            roundText='本轮说明包含不属于当前摘要窗口的事实引用，已停止发布该说明。请重新读取当前任务核查摘要；不能沿用旧任务或编造事实ID。'
          }
        }
        if (requireSceneRead && !hadToolUse) callbacks.onText(roundText)
        if(directSceneAssembly&&!hadToolUse){
          const clarification=/[？?]|请.*(?:明确|提供|选择|补充|确认)|需要.*(?:哪|什么)/.test(roundText)
          if(!clarification&&missingActionNudges<1&&round<maxToolRounds){
            missingActionNudges++
            system+='\n本轮用户明确提出场景操作，但本轮没有任何工具调用。历史装配结果不能满足本轮新要求，也不能宣称本轮已完成。请调用一次assemble_scene_at_mileage落实本轮原话；若确有缺项，明确询问缺项；若不能执行，明确说明本轮尚未执行和原因。'
            continue
          }
          if(!clarification)roundText='本轮尚未取得场景工具执行结果，未执行新的场景操作。请重试；当前显示仍是上一任务，不能视为已满足这次要求。'
          callbacks.onText(roundText)
        }
        if ((requireSceneRead || visualIntent) && hadToolUse) roundText = ''
        if (roundToolCalls.length > 0) {
          // One model response can contain several tool calls. Keep their
          // shared assistant turn before every matching tool result.
          this.messages.push({ role: 'assistant', content: roundText, tool_calls: roundToolCalls })
          this.messages.push(...roundToolResults)
        }

        if (roundText) {
          completedText += `${completedText ? '\n' : ''}${roundText}`
          if (!hadToolUse && !visualIntent) this.addMessage('assistant', roundText)
        }
        if (stopAfterTool) break
        if (!hadToolUse) {
          if (directSceneAssembly && /[？?]|请.*(?:明确|提供|选择|补充|确认)|需要.*(?:哪|什么)/.test(roundText)) this.pendingSceneRequest = effectiveRequest
          if (pendingTask && completionNudges < 1 && round < maxToolRounds) {
            completionNudges++
            // The model still decides whether to advance; the platform never auto-executes here.
            system += `\n\n本轮平台状态：任务 ${pendingTask.taskId} 已完成 ${pendingTask.completed}/${pendingTask.total} 步，当前待执行步骤 ${pendingTask.currentStepId}。${mustReviseAssemblyBeforeAdvance(userMessage) && !revisionCompleted && pendingTask.completed > 0 ? '用户明确要求先修订当前装配，下一动作必须调用 revise_next_scene_assembly，平台校验通过后才能推进。' : '根据刚返回的装配结果，如需调整当前阶段同屏资源，先调用 revise_next_scene_assembly；否则调用 advance_platform_task。'}参数 taskId=${pendingTask.taskId}、currentStepId=${pendingTask.currentStepId}。如应停止，请说明确切原因。`
            continue
          }
          break
        }
      }
      if (visualIntent) {
        if (!visualOutcome) completedText = `本轮视觉分析请求未完成：${visualFailure || '未取得所需工具的成功结果'}。不能把历史计划或口头说明当作本次执行；当前实际显示以工具状态为准。`
        else if (!completedText) completedText = '本轮视觉分析工具已执行并记录实际结果；请查看任务视觉分析中的状态与反馈。取景不代表工程验收。'
        this.addMessage('assistant', completedText)
        callbacks.onText(completedText)
      }
      if (requireSceneRead && !completedText) {
        completedText = sceneReadEvidence ? '已读取本轮场景运行快照，但模型未生成解释。未修改任务或显示；运行快照不能代表工程验收。' : '本轮未取得场景自检结果，无法核实当前状态；只读核查不允许修改场景，也不能引用历史完成状态。'
        this.addMessage('assistant', completedText)
        callbacks.onText(completedText)
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
