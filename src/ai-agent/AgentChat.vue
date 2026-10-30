<template>
  <!-- 右下角悬浮对话气泡 -->
  <div class="agent-root" :class="{ expanded: isOpen, docked: placement === 'right' }">

    <!-- 收起状态：悬浮按钮 -->
    <button v-if="!isOpen" class="agent-fab" @click="isOpen = true" title="打开智能助手">
      <span class="fab-icon">🤖</span>
      <span class="fab-label">AI 助手</span>
      <span v-if="unread > 0" class="fab-badge">{{ unread }}</span>
    </button>

    <!-- 展开状态：对话窗口 -->
    <transition name="agent-pop">
      <div v-if="isOpen" class="agent-window">
        <!-- Header -->
        <div class="agent-header">
          <span class="ah-icon">🤖</span>
          <span class="ah-title">施工智能助手</span>
          <span v-if="currentScene" class="ah-scene">{{ currentScene }}</span>
          <span class="ah-model">{{ providerLabel }}</span>
          <button class="ah-task" @click="taskFormOpen = !taskFormOpen" title="在对话中通过表单建任务">表单</button>
          <button class="ah-task" @click="openTaskWorkflow" title="查看任务运行记录">记录</button>
          <button class="ah-min" @click="isOpen = false" title="最小化">─</button>
          <button class="ah-clear" @click="clearHistory" title="清空对话">✕</button>
        </div>

        <!-- 消息列表 -->
        <div class="agent-messages" ref="msgListEl">
          <!-- 欢迎语 -->
          <div v-if="messages.length === 0" class="welcome-msg">
            <div class="wm-icon">{{ welcomeIcon }}</div>
            <div class="wm-text">{{ welcomeText }}</div>
            <div class="quick-cmds">
              <button v-for="cmd in quickCommands" :key="cmd" class="quick-btn" @click="sendQuick(cmd)">{{ cmd }}</button>
            </div>
          </div>

          <form v-if="taskFormOpen" class="chat-task-form" @submit.prevent="createTaskFromForm">
            <strong>表单建任务</strong>
            <label>任务类型<select v-model="taskForm.kind">
              <option value="quality-check">初期支护质量检查</option>
              <option value="scene-exploration">场景构建与展示</option>
            </select></label>
            <label>任务目标<input v-model.trim="taskForm.description" required placeholder="例如检查 YK1+346 附近支护质量" /></label>
            <label>隧洞<select v-model="taskForm.tunnelId" required>
              <option value="" disabled>选择隧洞</option>
              <option v-for="tunnel in tunnelStore.tunnels" :key="tunnel.id" :value="tunnel.id">{{ tunnel.name }}</option>
            </select></label>
            <div v-if="taskForm.kind === 'quality-check'" class="chat-task-form-row">
              <label>起点 YK 绝对米数<input v-model.number="taskForm.start" type="number" required /></label>
              <label>终点 YK 绝对米数<input v-model.number="taskForm.end" type="number" required /></label>
            </div>
            <div v-else class="chat-scene-stages">
              <span>场景阶段（按添加顺序执行，最多 8 个）</span>
              <div v-for="(id, index) in taskForm.resourceIds" :key="`${index}-${id}`" class="chat-scene-stage">
                <span>{{ index + 1 }}. {{ sceneResourceLabels[id] ?? id }}</span>
                <button type="button" @click="taskForm.resourceIds.splice(index, 1)">移除</button>
              </div>
              <div class="chat-task-form-row">
                <label>追加场景资源<select v-model="taskForm.nextResourceId"><option v-for="id in sceneResourceIds" :key="id" :value="id">{{ sceneResourceLabels[id] ?? id }}</option></select></label>
                <button type="button" :disabled="taskForm.resourceIds.length >= 8" @click="taskForm.resourceIds.push(taskForm.nextResourceId)">添加阶段</button>
              </div>
            </div>
            <label>加载预算 MB<input v-model.number="taskForm.maxLoadMb" type="number" min="1" required /></label>
            <button type="submit" :disabled="chatTaskBusy">校验并创建计划</button>
          </form>

          <!-- 对话消息 -->
          <div
            v-for="(msg, i) in messages"
            :key="i"
            class="msg-row"
            :class="msg.role"
          >
            <div class="msg-avatar">{{ msg.role === 'user' ? '👷' : '🤖' }}</div>
            <div class="msg-block">
              <div class="msg-bubble" v-html="renderMarkdown(msg.content)"></div>
              <div v-if="msg.role === 'assistant'" class="feedback-row">
                <button
                  class="fb-btn"
                  :class="{ active: feedbackMap[i] === 'up' }"
                  title="有用"
                  @click="toggleFeedback(i, 'up')"
                >👍</button>
                <button
                  class="fb-btn"
                  :class="{ active: feedbackMap[i] === 'down' }"
                  title="没用"
                  @click="toggleFeedback(i, 'down')"
                >👎</button>
              </div>
            </div>
          </div>

          <!-- 流式输出中 -->
          <div v-if="streaming" class="msg-row assistant">
            <div class="msg-avatar">🤖</div>
            <div class="msg-bubble streaming">
              <span v-html="renderMarkdown(streamBuffer)"></span>
              <span class="cursor-blink">▌</span>
            </div>
          </div>

          <!-- 加载中 -->
          <div v-if="loading && !streaming" class="msg-row assistant">
            <div class="msg-avatar">🤖</div>
            <div class="msg-bubble loading">
              <span class="dot-pulse"></span><span class="dot-pulse"></span><span class="dot-pulse"></span>
            </div>
          </div>
          <div v-if="chatTaskStatus?.prepared && chatTaskStatus.status !== 'completed'" class="chat-task-action">
            <span>已校验任务 {{ chatTaskStatus.taskId }} · {{ chatTaskStatus.completed }}/{{ chatTaskStatus.total }}</span>
            <button :disabled="chatTaskBusy || loading" @click="executeFormTask">{{ chatTaskBusy ? '执行中…' : '自主执行剩余步骤' }}</button>
          </div>
        </div>

        <!-- 工具执行状态提示 -->
        <transition name="tool-fade">
          <div v-if="toolStatus" class="tool-status">
            <span class="ts-spinner">⟳</span> {{ toolStatus }}
          </div>
        </transition>
        <div v-if="auditWarning" class="tool-status" role="alert">审计记录未保存：{{ auditWarning }}</div>

        <!-- 输入框 -->
        <div class="agent-input-row">
          <textarea
            ref="inputEl"
            class="agent-input"
            v-model="inputText"
            placeholder="输入指令或问题（Enter发送，Shift+Enter换行）"
            rows="1"
            @keydown.enter.exact.prevent="send"
            @input="autoResize"
          ></textarea>
          <button class="send-btn" :disabled="!inputText.trim() || loading || streaming || chatTaskBusy" @click="send">
            <span>{{ loading ? '◌' : '↑' }}</span>
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { AgentEngine, createAgentEngine } from './AgentEngine'
import { buildSystemPrompt } from './knowledge/prompts/system'
import { registerTools, executeTool, unregisterModule } from './ToolRegistry'
import { commonTools } from './tools/common'
import { workflowTools } from './tools/workflow.tools'
import { getAgentConfig } from './config'
import { aiEvents } from './events'
import { recordTaskEvent, summarizeAuditValue } from '@/platform/telemetry/TaskAuditClient'
import { hasTaskWorkflowController, getTaskWorkflowController } from '@/platform/tasks/TaskWorkflowBridge'
import type { AgentTaskWorkflowStatus } from '@/platform/tasks/TaskWorkflowBridge'
import { dispatchValidatedWorkflow } from './TaskOrchestrator'
import { routeWorkflowToolCall } from './AgentDispatchIntent'
import { AGENT_SCENE_RESOURCES } from '@/platform/tasks/samples/SceneExplorationWorkflow'
import { modelerSupportCatalog } from '@/modules/support/modeler-resources'
import { useTunnelStore } from '@/stores/tunnelStore'
import { chainageService } from '@/platform/coordinates/ChainageService'
import type { Message, ToolUseBlock, AgentContext } from './types'

// ── Props ─────────────────────────────────────────────────
const props = defineProps<{
  context?: AgentContext
  welcomeIcon?: string
  welcomeText?: string
  placement?: 'floating' | 'right'
}>()

// ── Emits ─────────────────────────────────────────────────
const emit = defineEmits<{
  sceneOpen: [scene: string]
  taskWorkflowOpen: []
  assemblyChange: [result: { targetMileage: string; taskId: string; resources: Array<{ id: string; label: string }> } | null]
}>()

// ── 引擎 ──────────────────────────────────────────────────
const engine = ref<AgentEngine | null>(null)

// ── UI 状态 ───────────────────────────────────────────────
const isOpen    = ref(false)
const loading   = ref(false)
const streaming = ref(false)
const streamBuffer = ref('')
const inputText = ref('')
const toolStatus = ref('')
const auditWarning = ref('')
const tunnelStore = useTunnelStore()
const taskFormOpen = ref(false)
const chatTaskBusy = ref(false)
const chatTaskStatus = ref<AgentTaskWorkflowStatus>()
const taskForm = reactive<{
  kind: 'quality-check' | 'scene-exploration'; description: string; tunnelId: string;
  start: number; end: number; maxLoadMb: number; resourceIds: string[]; nextResourceId: string
}>({ kind: 'quality-check', description: '', tunnelId: '', start: 1346, end: 1356,
  maxLoadMb: 1400, resourceIds: [], nextResourceId: 'rock.design-grade' })
const sceneResourceIds: readonly string[] = AGENT_SCENE_RESOURCES
const sceneResourceLabels: Record<string, string> = {
  'rock.design-grade': '围岩设计分级',
  'rock.geophysical-grade': '物探融合围岩等级 · 示意重定位',
  'rock.tsp-hardness': 'TSP 岩体坚硬度 · 示意锚定',
  'rock.tsp-integrity': 'TSP 岩体完整度 · 示意锚定',
  'rock.tem-resistivity': 'TEM 视电阻率 · 示意重定位',
  'blast.effect': '爆破效果',
  'support.modeler-zz-va': '新支护模块 ZZ-Va · 1 m 断面',
  ...Object.fromEntries(modelerSupportCatalog.map(asset => [asset.id, `新支护模块 ${asset.type} · 1 m 断面`])),
  'ventilation.steady-cfd': '稳态 CFD', 'ventilation.transient-network': '瞬态风网',
  'ventilation.thermal-field': '热场时间片',
}
const sceneSourceNotes = (plans: Array<{ resources: string[] }> = []): string => {
  const ids = plans.flatMap(plan => plan.resources)
  return [
    ids.some(id => id.startsWith('support.modeler-')) ? '新支护模块使用已导出的 1 m 断面模型，按平台 YK 中线装配；尚未按本任务参数重新生成，不代表目标里程实测支护。' : '',
    ids.some(id => id.startsWith('rock.') && id !== 'rock.design-grade')
      ? '物探围岩解释层以 YK2+244 为源锚点沿目标中线示意重定位，不代表目标工点实测。' : '',
    ids.some(id => id === 'rock.tsp-hardness' || id === 'rock.tsp-integrity')
      ? 'TSP 来源报告标记为 X1DK2+937，不能作为目标工点的实测结论。' : '',
  ].filter(Boolean).join('\n')
}
const publishAssembledScene = (status: AgentTaskWorkflowStatus): void => {
  const stage = status.lastCompletedStage
  if (!status.taskId || !stage) return
  emit('assemblyChange', {
    targetMileage: chainageService.format(stage.chainageRange.start),
    taskId: status.taskId,
    resources: stage.assembledResourceIds.map(id => ({ id, label: sceneResourceLabels[id] ?? id })),
  })
}
const workflowToolNames = new Set([
  'assemble_scene_at_mileage', 'orchestrate_platform_task', 'prepare_platform_task', 'advance_platform_task', 'revise_next_scene_assembly',
  'create_task', 'create_workflow', 'execute_task_step', 'continue_workflow',
  'get_task_status', 'retry_task_step', 'reset_task_scene',
])
const unread     = ref(0)
const messages   = ref<Message[]>([])
const msgListEl  = ref<HTMLDivElement | null>(null)
const inputEl    = ref<HTMLTextAreaElement | null>(null)

// ── 计算属性 ──────────────────────────────────────────────
const providerLabel = computed(() => {
  const cfg = getAgentConfig()
  const labels: Record<string, string> = {
    deepseek: 'DeepSeek', claude: 'Claude', qwen: '通义千问', ollama: 'Ollama',
  }
  return labels[cfg.provider] || cfg.provider || '后端配置'
})

const currentScene = computed(() => props.context?.scene || '')
const placement = computed(() => props.placement ?? 'floating')

const defaultQuickCmds = [
  '在 YK1+346 主场景展示设计围岩与新模块 ZZ-Va 支护组合',
  '自主检查 YK1+346 至 YK1+356 初期支护质量并完成任务',
  '查看当前掌子面状态',
  '飞往围岩模型区域',
  '打开爆破指挥台',
  '查询今日施工进度',
  '通风状态怎么样',
]

const blastQuickCmds = [
  '查看爆破设计参数',
  '切换到正视掌子面视角',
  '分析当前爆破风险',
  '显示炮孔设计图',
  '对比不同爆破方案',
]

const quickCommands = computed(() => {
  if (props.context?.scene === 'blast') return blastQuickCmds
  return defaultQuickCmds
})

const welcomeIcon = computed(() => props.welcomeIcon || '🏔')
const welcomeText = computed(() =>
  props.welcomeText || '你好！请告诉我目标里程和要展示的模型。<br>我会在主场景装配，左侧和底部显示实际任务信息。'
)

// ── 反馈机制 ──────────────────────────────────────────────
const FEEDBACK_KEY = 'ai-agent-feedback'
const feedbackMap = ref<Record<number, 'up' | 'down'>>({})

function loadFeedback() {
  try {
    const saved = localStorage.getItem(FEEDBACK_KEY)
    if (saved) feedbackMap.value = JSON.parse(saved)
  } catch { /* ignore */ }
}

function toggleFeedback(msgIndex: number, rating: 'up' | 'down') {
  if (feedbackMap.value[msgIndex] === rating) {
    delete feedbackMap.value[msgIndex]
  } else {
    feedbackMap.value[msgIndex] = rating
  }
  feedbackMap.value = { ...feedbackMap.value }
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedbackMap.value))
}

// ── 初始化 ────────────────────────────────────────────────
onMounted(() => {
  loadFeedback()
  taskForm.tunnelId = tunnelStore.currentTunnelId ?? ''

  // 注册通用工具
  registerTools('common', [...commonTools, ...workflowTools])

  // 创建引擎实例
  const sysPrompt = buildSystemPrompt(props.context)
  const instance = createAgentEngine(sysPrompt)
  engine.value = instance

  // 监听场景打开事件
  aiEvents.on('scene:open', handleSceneOpen)
  aiEvents.on('task:open', handleTaskOpen)
})

onBeforeUnmount(() => {
  aiEvents.off('scene:open', handleSceneOpen)
  aiEvents.off('task:open', handleTaskOpen)
  unregisterModule('common')
  if (engine.value) engine.value.abort()
})

// 当 context 变化时更新 system prompt
watch(() => props.context, (ctx) => {
  if (engine.value) {
    engine.value.setSystemPrompt(buildSystemPrompt(ctx))
  }
}, { deep: true })

// ── 发送消息 ──────────────────────────────────────────────
const send = async () => {
  const text = inputText.value.trim()
  if (!text || loading.value || streaming.value || chatTaskBusy.value || !engine.value) return

  inputText.value = ''
  autoResize()

  // 添加用户消息到本地显示
  messages.value.push({ role: 'user', content: text })
  await scrollToBottom()

  loading.value = true
  streaming.value = false
  streamBuffer.value = ''

  let firstChunk = true
  let assistantMsg = ''
  let canonicalDispatchShown = false

  try {
    await engine.value.chat(
      text,
      props.context || {},
      {
        onText: (delta: string) => {
          if (canonicalDispatchShown) return
          if (firstChunk) {
            loading.value = false
            streaming.value = true
            firstChunk = false
          }
          streamBuffer.value += delta
          assistantMsg += delta
          scrollToBottom()
        },
        onToolUse: async (tool: ToolUseBlock) => {
          const routed = routeWorkflowToolCall(tool.name, tool.input, text)
          if (routed.name === 'assemble_scene_at_mileage') emit('assemblyChange', null)
          toolStatus.value = `执行操作：${routed.name}...`
          const startedAt = performance.now()
          const result = await executeTool(routed.name, routed.name === 'assemble_scene_at_mileage'
            ? { ...routed.input, userRequest: text } : routed.input)
          toolStatus.value = ''
          let parsed: Record<string, any> = {}
          try { parsed = JSON.parse(result) } catch { /* 文本型模块工具 */ }
          if (workflowToolNames.has(routed.name) && typeof parsed.prepared === 'boolean') {
            chatTaskStatus.value = parsed as AgentTaskWorkflowStatus
          }
          if (routed.name === 'prepare_platform_task') {
            canonicalDispatchShown = true
            streaming.value = false
            streamBuffer.value = ''
            messages.value.push({ role: 'assistant', content: parsed.ok
              ? `任务 ${parsed.taskId} 校验通过，${parsed.total} 个阶段。当前待执行：${parsed.currentStepId}。`
              : `任务校验未通过：${parsed.notice?.message || '请检查目标与资源参数。'}` })
            await scrollToBottom()
          }
          if (routed.name === 'assemble_scene_at_mileage') {
            canonicalDispatchShown = true
            streaming.value = false
            streamBuffer.value = ''
            const ids: string[] = Array.isArray(parsed.assembledResourceIds) ? parsed.assembledResourceIds : []
            const resources = ids.map(id => sceneResourceLabels[id] ?? id).join('、')
            if (parsed.ok) emit('assemblyChange', {
              targetMileage: String(parsed.targetMileage), taskId: String(parsed.taskId),
              resources: ids.map(id => ({ id, label: sceneResourceLabels[id] ?? id })),
            })
            messages.value.push({ role: 'assistant', content: parsed.ok
              ? `已定位 ${parsed.targetMileage}，主场景装配完成：${resources || '无'}。${sceneSourceNotes(parsed.scenePlans)}`
              : `场景装配未完成：${parsed.reason || parsed.notice?.message || (result.startsWith('❌') ? result : '请核对里程与资源。')}` })
            await scrollToBottom()
          }
          if ((routed.name === 'advance_platform_task' || routed.name === 'orchestrate_platform_task') && Array.isArray(parsed.dispatchTrace)) {
            if (parsed.ok && parsed.status === 'completed') publishAssembledScene(parsed as AgentTaskWorkflowStatus)
            canonicalDispatchShown = true
            streaming.value = false
            streamBuffer.value = ''
            const trace = parsed.dispatchTrace.map((step: { module: string; stepId: string; resources: string[]; after: string; completed: number }) =>
              `${step.module}/${step.stepId} · ${step.resources.join('、') || '无场景资源'} · ${step.after} · ${step.completed}/${parsed.total}`).join('\n')
            const sourceNotes = sceneSourceNotes(parsed.scenePlans)
            messages.value.push({ role: 'assistant', content: `${parsed.ok ? parsed.status === 'completed' ? '自主调度完成' : '步骤完成，等待智能体判断下一步' : '自主调度已停止'}：${parsed.reason}${trace ? `\n${trace}` : ''}${sourceNotes ? `\n${sourceNotes}` : ''}` })
            await scrollToBottom()
          }
          const taskId = parsed.taskId || (!['create_task', 'orchestrate_platform_task', 'prepare_platform_task'].includes(routed.name) && workflowToolNames.has(routed.name) && hasTaskWorkflowController()
            ? getTaskWorkflowController().getStatus().taskId : undefined)
          try {
            await recordTaskEvent({
              taskId, source: 'agent', action: routed.name, callId: tool.id,
              status: result.startsWith('❌') || parsed.ok === false ? 'failed' : 'completed',
              durationMs: performance.now() - startedAt,
              inputSummary: summarizeAuditValue({ ...routed.input, modelTool: tool.name, intentRouted: routed.routed }) as Record<string, unknown>,
              resultSummary: {
                taskStatus: parsed.status,
                completed: parsed.completed,
                total: parsed.total,
                dispatchTrace: ['assemble_scene_at_mileage', 'orchestrate_platform_task', 'advance_platform_task'].includes(routed.name) && Array.isArray(parsed.dispatchTrace)
                  ? summarizeAuditValue(parsed.dispatchTrace) : undefined,
                stopReason: ['assemble_scene_at_mileage', 'orchestrate_platform_task', 'advance_platform_task'].includes(routed.name) ? parsed.reason : undefined,
                error: result.startsWith('❌') ? result.slice(0, 300) : parsed.notice?.type === 'error' ? parsed.notice.message : undefined,
              },
            })
            auditWarning.value = ''
          } catch (error) {
            auditWarning.value = error instanceof Error ? error.message : String(error)
          }
          return result
        },
        onComplete: (fullText: string) => {
          streaming.value = false
          streamBuffer.value = ''
          if (!canonicalDispatchShown) messages.value.push({ role: 'assistant', content: fullText })
          else if (chatTaskStatus.value?.prepared && chatTaskStatus.value.status !== 'completed' && chatTaskStatus.value.status !== 'failed') {
            messages.value.push({ role: 'assistant', content: `智能体本轮已停止。任务 ${chatTaskStatus.value.taskId} 目前完成 ${chatTaskStatus.value.completed}/${chatTaskStatus.value.total} 步，可继续要求它观察并推进。` })
          }
          if (!isOpen.value) unread.value++
        },
        onError: (err: Error) => {
          streaming.value = false
          loading.value = false
          messages.value.push({ role: 'assistant', content: `❌ ${err.message}` })
        },
      },
    )
  } catch (e: any) {
    if (e.name !== 'AbortError') {
      streaming.value = false
      loading.value = false
      messages.value.push({ role: 'assistant', content: '❌ 请求失败，请检查网络连接。' })
    }
  } finally {
    loading.value = false
    streaming.value = false
    toolStatus.value = ''
    await scrollToBottom()
  }
}

// ── 快捷命令 ──────────────────────────────────────────────
const sendQuick = (cmd: string) => {
  inputText.value = cmd
  send()
}

const handleSceneOpen = (scene: string) => emit('sceneOpen', scene)
const handleTaskOpen = () => emit('taskWorkflowOpen')
const openTaskWorkflow = () => {
  isOpen.value = true
  emit('taskWorkflowOpen')
}

const createTaskFromForm = async () => {
  if (chatTaskBusy.value || loading.value) return
  chatTaskBusy.value = true
  chatTaskStatus.value = undefined
  messages.value.push({ role: 'user', content: `表单创建${taskForm.kind === 'scene-exploration' ? '场景' : '质量检查'}任务：${taskForm.description}` })
  try {
    const controller = getTaskWorkflowController()
    const status = taskForm.kind === 'scene-exploration'
      ? await controller.prepareScene({ description: taskForm.description, tunnelId: taskForm.tunnelId,
        resourceIds: [...taskForm.resourceIds], maxLoadMb: taskForm.maxLoadMb })
      : await controller.prepare({ description: taskForm.description, tunnelId: taskForm.tunnelId,
        start: taskForm.start, end: taskForm.end, maxLoadMb: taskForm.maxLoadMb })
    if (!status.prepared || status.notice?.type === 'error') {
      messages.value.push({ role: 'assistant', content: `任务校验未通过：${status.notice?.message || '请检查任务字段与平台规则。'}` })
      return
    }
    chatTaskStatus.value = status
    if (taskForm.kind === 'scene-exploration') emit('assemblyChange', null)
    taskFormOpen.value = false
    messages.value.push({ role: 'assistant', content: `结构与业务规则校验通过。任务 ${status.taskId} 已生成 ${status.total} 步：${status.steps.map(step => `${step.name}（${step.module}）`).join(' → ')}。可在对话中自主执行。` })
  } catch (error) {
    messages.value.push({ role: 'assistant', content: `任务创建失败：${error instanceof Error ? error.message : String(error)}` })
  } finally {
    chatTaskBusy.value = false
    await scrollToBottom()
  }
}

const executeFormTask = async () => {
  if (chatTaskBusy.value || loading.value || !chatTaskStatus.value) return
  chatTaskBusy.value = true
  try {
    const controller = getTaskWorkflowController()
    const current = controller.getStatus()
    if (current.taskId !== chatTaskStatus.value.taskId) throw new Error('当前任务已被替换，请重新创建或选择任务')
    const outcome = await dispatchValidatedWorkflow(controller, current)
    chatTaskStatus.value = outcome.status
    if (outcome.ok) publishAssembledScene(outcome.status)
    const trace = outcome.dispatchTrace.map(step => `${step.module}/${step.stepId} · ${step.resources.join('、') || '无场景资源'} · ${step.before} → ${step.after} · ${step.completed}/${outcome.status.total}`).join('\n')
    const sourceNotes = sceneSourceNotes(outcome.status.scenePlans)
    messages.value.push({ role: 'assistant', content: `${outcome.ok ? '自主调度完成' : '自主调度已停止'}：${outcome.reason}${trace ? `\n${trace}` : ''}${sourceNotes ? `\n${sourceNotes}` : ''}` })
  } catch (error) {
    messages.value.push({ role: 'assistant', content: `自主调度未启动：${error instanceof Error ? error.message : String(error)}` })
  } finally {
    chatTaskBusy.value = false
    await scrollToBottom()
  }
}

const clearHistory = () => {
  messages.value = []
  unread.value = 0
  auditWarning.value = ''
  if (engine.value) engine.value.clearHistory()
}

// ── 工具函数 ──────────────────────────────────────────────
const scrollToBottom = async () => {
  await nextTick()
  if (msgListEl.value) {
    msgListEl.value.scrollTop = msgListEl.value.scrollHeight
  }
}

const autoResize = () => {
  if (!inputEl.value) return
  inputEl.value.style.height = 'auto'
  inputEl.value.style.height = Math.min(inputEl.value.scrollHeight, 96) + 'px'
}

const renderMarkdown = (text: string): string => {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>')
    .replace(/^- (.+)/gm, '• $1')
}
</script>

<style scoped lang="scss">
.agent-root {
  position: fixed;
  left: 20px;
  bottom: 20px;
  z-index: 60;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  pointer-events: none;
}
.agent-root.docked { left: auto; right: 18px; }
.agent-root.docked.expanded {
  top: 60px; right: 0; bottom: 0; width: min(380px, 100vw);
  align-items: stretch;
}
.agent-root.docked .agent-window {
  width: 100%; height: 100%; max-height: none;
  border-radius: 0; border-top: 0; border-bottom: 0;
}

// ── FAB 按钮 ──────────────────────────────────────────────
.agent-fab {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: linear-gradient(135deg, rgba(0, 60, 130, 0.9), rgba(0, 30, 80, 0.85));
  border: 1px solid rgba(0, 200, 255, 0.45);
  border-radius: 24px;
  color: #fff;
  font-size: 14px;
  font-family: "Microsoft YaHei", sans-serif;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(0, 100, 200, 0.4), 0 0 12px rgba(0, 200, 255, 0.2);
  transition: all 0.25s;
  position: relative;

  &:hover {
    background: linear-gradient(135deg, rgba(0, 80, 170, 0.95), rgba(0, 50, 120, 0.9));
    box-shadow: 0 4px 28px rgba(0, 150, 255, 0.5), 0 0 18px rgba(0, 200, 255, 0.35);
    transform: translateY(-2px);
  }
}

.fab-icon { font-size: 20px; }
.fab-label { font-weight: bold; letter-spacing: 1px; color: rgba(200, 240, 255, 0.95); }
.fab-badge {
  position: absolute;
  top: -4px; right: -4px;
  width: 18px; height: 18px;
  background: #ff4444;
  border-radius: 50%;
  font-size: 10px; font-weight: bold;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid rgba(0, 10, 28, 0.9);
}

// ── 对话窗口 ──────────────────────────────────────────────
.agent-window {
  pointer-events: auto;
  width: 380px;
  max-height: 600px;
  display: flex;
  flex-direction: column;
  background: rgba(0, 8, 22, 0.94);
  border: 1px solid rgba(0, 150, 255, 0.3);
  border-radius: 8px;
  backdrop-filter: blur(20px);
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(0, 100, 200, 0.2);
  overflow: hidden;
}

// ── Header ────────────────────────────────────────────────
.agent-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  background: rgba(0, 30, 70, 0.8);
  border-bottom: 1px solid rgba(0, 150, 255, 0.2);
  flex-shrink: 0;
}
.ah-icon { font-size: 16px; }
.ah-title { font-size: 13px; font-weight: bold; color: rgba(200, 240, 255, 0.95); letter-spacing: 1px; }
.ah-scene {
  font-size: 10px;
  background: rgba(0, 150, 255, 0.2);
  color: rgba(0, 200, 255, 0.8);
  padding: 1px 6px; border-radius: 8px;
  flex: 1;
}
.ah-model { font-size: 10px; color: rgba(0, 200, 255, 0.5); font-family: 'Consolas', monospace; }
.ah-task, .ah-min, .ah-clear {
  width: 22px; height: 22px; background: transparent;
  border: 1px solid rgba(180, 220, 255, 0.2); color: rgba(180, 220, 255, 0.5);
  font-size: 12px; cursor: pointer; border-radius: 3px;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
  &:hover { background: rgba(255, 255, 255, 0.08); color: rgba(200, 240, 255, 0.9); }
}
.ah-task { width: auto; padding: 0 7px; color: rgba(94, 229, 177, .82); border-color: rgba(94, 229, 177, .28); }

// ── 消息列表 ──────────────────────────────────────────────
.agent-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 150, 255, 0.3) transparent;
}

.chat-task-form, .chat-task-action {
  display: flex; flex-direction: column; gap: 8px; padding: 10px;
  border: 1px solid rgba(80, 210, 255, .28); border-radius: 6px;
  background: rgba(0, 35, 70, .72); color: #c7e6f5; font-size: 11px;
}
.chat-task-form strong { font-size: 12px; color: #e2f8ff; }
.chat-task-form label { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.chat-task-form-row { display: flex; gap: 8px; }
.chat-task-form-row label { flex: 1; }
.chat-task-form-row select { flex: 1; }
.chat-scene-stages { display: flex; flex-direction: column; gap: 5px; }
.chat-scene-stage { display: flex; justify-content: space-between; align-items: center; gap: 5px; }
.chat-scene-stage span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chat-task-form input, .chat-task-form select {
  width: 100%; box-sizing: border-box; border: 1px solid rgba(95, 180, 215, .4); border-radius: 4px;
  padding: 6px; background: #061d35; color: #e2f8ff; font: inherit;
}
.chat-task-form button, .chat-task-action button {
  align-self: flex-start; border: 1px solid rgba(94, 229, 177, .5); border-radius: 4px;
  padding: 5px 9px; background: rgba(18, 96, 83, .5); color: #d7ffec; cursor: pointer;
}
.chat-task-form button:disabled, .chat-task-action button:disabled { opacity: .5; cursor: default; }

.welcome-msg {
  display: flex; flex-direction: column; align-items: center;
  gap: 10px; padding: 16px 8px; text-align: center;
}
.wm-icon { font-size: 28px; }
.wm-text { font-size: 12px; color: rgba(180, 220, 255, 0.65); line-height: 1.6; }

.quick-cmds { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.quick-btn {
  padding: 4px 10px; background: rgba(0, 40, 90, 0.6);
  border: 1px solid rgba(0, 150, 255, 0.3); color: rgba(180, 220, 255, 0.75);
  font-size: 11px; cursor: pointer; border-radius: 12px; font-family: inherit;
  transition: all 0.15s;
  &:hover { background: rgba(0, 80, 180, 0.6); border-color: #00aaff; color: #00eaff; }
}

.msg-row { display: flex; gap: 8px; align-items: flex-start; }
.msg-row.user { flex-direction: row-reverse; }
.msg-avatar { font-size: 18px; flex-shrink: 0; padding-top: 2px; }

.msg-block { max-width: 82%; display: flex; flex-direction: column; }

.feedback-row {
  display: flex; gap: 4px; padding-top: 4px; padding-left: 2px;
}

.fb-btn {
  background: transparent; border: none; font-size: 13px; cursor: pointer;
  padding: 2px 4px; border-radius: 4px; opacity: 0.4; transition: all 0.15s;
  line-height: 1;
  &:hover { opacity: 0.8; background: rgba(255,255,255,0.06); }
  &.active { opacity: 1; }
}

.msg-bubble {
  max-width: 82%;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.65;
  word-break: break-word;

  :deep(b) { color: #00eaff; }
  :deep(code) { background: rgba(0, 40, 80, 0.6); color: #44ff88; padding: 1px 4px; border-radius: 3px; font-family: 'Consolas', monospace; font-size: 11px; }

  .user & {
    background: rgba(0, 60, 140, 0.7);
    border: 1px solid rgba(0, 150, 255, 0.3);
    color: rgba(200, 240, 255, 0.92);
    border-radius: 8px 2px 8px 8px;
  }
  .assistant & {
    background: rgba(0, 20, 50, 0.65);
    border: 1px solid rgba(0, 100, 200, 0.2);
    color: rgba(200, 240, 255, 0.85);
    border-radius: 2px 8px 8px 8px;
  }
  &.streaming { border-color: rgba(0, 200, 255, 0.35); }
  &.loading { display: flex; gap: 4px; align-items: center; padding: 10px 14px; }
}

.cursor-blink { animation: blink 0.8s step-end infinite; color: #00eaff; }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

.dot-pulse {
  width: 6px; height: 6px; border-radius: 50%; background: rgba(0, 200, 255, 0.6);
  animation: dot-bounce 1.2s ease-in-out infinite;
  &:nth-child(2) { animation-delay: 0.2s; }
  &:nth-child(3) { animation-delay: 0.4s; }
}
@keyframes dot-bounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1.1); opacity: 1; } }

// ── 工具状态 ──────────────────────────────────────────────
.tool-status {
  padding: 5px 12px;
  background: rgba(0, 40, 80, 0.6);
  border-top: 1px solid rgba(0, 150, 255, 0.15);
  font-size: 11px; color: rgba(0, 200, 255, 0.7);
  display: flex; align-items: center; gap: 6px;
  flex-shrink: 0;
}
.ts-spinner { animation: spin 1s linear infinite; display: inline-block; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

// ── 输入区 ────────────────────────────────────────────────
.agent-input-row {
  display: flex; gap: 6px; padding: 10px;
  border-top: 1px solid rgba(0, 150, 255, 0.15);
  background: rgba(0, 10, 28, 0.7); flex-shrink: 0; align-items: flex-end;
}

.agent-input {
  flex: 1;
  background: rgba(0, 20, 50, 0.6);
  border: 1px solid rgba(0, 150, 255, 0.25);
  border-radius: 6px;
  color: rgba(200, 240, 255, 0.9);
  font-size: 12px; font-family: "Microsoft YaHei", sans-serif;
  padding: 7px 10px; resize: none; outline: none;
  line-height: 1.5; min-height: 34px; max-height: 96px;
  transition: border-color 0.2s;
  &:focus { border-color: rgba(0, 200, 255, 0.5); box-shadow: 0 0 8px rgba(0, 150, 255, 0.15); }
  &::placeholder { color: rgba(180, 220, 255, 0.3); }
}

.send-btn {
  width: 36px; height: 36px;
  background: linear-gradient(135deg, rgba(0, 80, 180, 0.8), rgba(0, 50, 130, 0.7));
  border: 1px solid rgba(0, 200, 255, 0.4);
  border-radius: 6px; color: #00eaff; font-size: 16px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all 0.15s; flex-shrink: 0;
  &:hover:not(:disabled) { background: rgba(0, 100, 220, 0.8); box-shadow: 0 0 10px rgba(0, 150, 255, 0.3); }
  &:disabled { opacity: 0.4; cursor: default; }
}

// ── 过渡动画 ──────────────────────────────────────────────
.agent-pop-enter-active  { transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); }
.agent-pop-enter-from    { opacity: 0; transform: scale(0.85) translateY(20px); }
.agent-pop-leave-active  { transition: opacity 0.2s ease, transform 0.2s ease; }
.agent-pop-leave-to      { opacity: 0; transform: scale(0.9) translateY(10px); }
.tool-fade-enter-active, .tool-fade-leave-active { transition: opacity 0.2s; }
.tool-fade-enter-from, .tool-fade-leave-to { opacity: 0; }
</style>
