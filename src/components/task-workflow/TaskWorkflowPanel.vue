<template>
  <Transition name="task-panel-slide">
    <aside v-if="show" class="task-workflow-panel" aria-label="任务流程确认与调试">
      <header class="panel-header">
        <div>
          <span class="eyebrow">TASK ORCHESTRATION</span>
          <h2>任务流程确认</h2>
        </div>
        <button type="button" class="icon-button" aria-label="关闭任务流程面板" @click="$emit('close')">×</button>
      </header>

      <div class="panel-body">
        <section class="form-section">
          <label>
            <span>任务描述</span>
            <textarea v-model.trim="form.description" rows="2" :disabled="busy" />
          </label>
          <div class="field-grid">
            <label>
              <span>当前隧洞</span>
              <select v-if="tunnelStore.tunnels.length" v-model="form.tunnelId" :disabled="busy">
                <option v-for="tunnel in tunnelStore.tunnels" :key="tunnel.id" :value="tunnel.id">
                  {{ tunnel.name }}
                </option>
              </select>
              <input v-else v-model.trim="form.tunnelId" :disabled="busy" placeholder="隧洞 ID" />
            </label>
            <label>
              <span>加载预算</span>
              <input v-model.number="form.maxLoadMb" type="number" min="1" :disabled="busy" />
            </label>
            <label>
              <span>起点里程</span>
              <input v-model.number="form.start" type="number" min="0" :disabled="busy" />
            </label>
            <label>
              <span>终点里程</span>
              <input v-model.number="form.end" type="number" min="0" :disabled="busy" />
            </label>
          </div>
          <div class="form-actions">
            <button type="button" class="primary" :disabled="busy" @click="prepareWorkflow()">
              {{ executor?.task.taskType === 'scene-exploration' ? '切换为质量检查计划' : executor ? '重新生成计划' : '生成执行计划' }}
            </button>
            <button v-if="executor" type="button" :disabled="busy" @click="resetWorkflow()">复位</button>
          </div>
          <button type="button" :disabled="busy" @click="prepareWorkflow('panel', {
            description: '围岩与结构树既有支护构件预览（保留原示例布置）',
            resourceIds: ['rock.design-grade', 'support.legacy-assembly'],
          })">生成围岩与既有支护预览</button>
          <p class="history-hint">既有支护构件保留 DK278+100～DK278+167 附近示例布置，暂不支持参数修改；参数化钢架试验仍可单独使用。</p>
          <button type="button" :disabled="busy" @click="prepareWorkflow('panel', {
            description: '通风瞬态工况预览（原始 K3+805～K4+005 数据）',
            resourceIds: ['ventilation.transient-network'],
          })">生成通风工况预览</button>
          <button type="button" :disabled="busy" @click="prepareWorkflow('panel', {
            description: '通风热场时间片预览（原始 K3+805～K4+005 数据）',
            resourceIds: ['ventilation.thermal-field'],
          })">生成通风热场预览</button>
          <div v-if="activeVentilationPreview === 'ventilation.transient-network'" class="ventilation-selection">
            <label>已选工况
              <select :value="selectedTransientScenario" :disabled="busy" @change="selectTransientScenario($event)">
                <option value="fan_ramp_up">风机爬升</option><option value="fan_oscillation">右线风机波动</option>
                <option value="damper_close">关闭横通道</option><option value="fan_shutdown">右线风机故障停机</option>
                <option value="combined">组合场景</option>
              </select>
            </label>
            <p class="history-hint">选择成功后追加任务结果节点，记录本次工况文件指纹。</p>
          </div>
          <div v-if="activeVentilationPreview === 'ventilation.thermal-field'" class="ventilation-selection">
            <label>热场时间片
              <select :value="selectedThermalFile" :disabled="busy" @change="selectThermalSnapshot($event)">
                <option value="">选择时间片</option>
                <option v-for="item in thermalSnapshots" :key="item.file" :value="item.file">t={{ item.t }}s</option>
              </select>
            </label>
            <p class="history-hint">选择成功后更新三维热场并追加任务结果节点。</p>
          </div>
        </section>

        <div v-if="notice" class="notice" :class="notice.type" role="status">
          <strong>{{ notice.title }}</strong>
          <span>{{ notice.message }}</span>
        </div>
        <div v-if="auditError" class="notice error" role="alert">
          <strong>审计记录未保存</strong>
          <span>{{ auditError }}</span>
        </div>
        <div v-if="assetVersionWarning" class="notice info" role="status">
          <strong>模型资产版本未采集完整</strong>
          <span>{{ assetVersionWarning }}</span>
        </div>

        <template v-if="executor && snapshot">
          <section class="summary-strip">
            <div>
              <span class="summary-label">执行状态</span>
              <strong :class="`status-${snapshot.status}`">{{ statusLabel(snapshot.status) }}</strong>
            </div>
            <div>
              <span class="summary-label">进度</span>
              <strong>{{ snapshot.completed }}/{{ snapshot.total }}</strong>
            </div>
            <div>
              <span class="summary-label">任务 ID</span>
              <strong class="mono">{{ shortTaskId }}</strong>
            </div>
          </section>

          <section>
            <div class="section-heading">
              <h3>工作流步骤</h3>
              <span>{{ executor.plan.steps.length }} STEPS</span>
            </div>
            <ol class="step-list">
              <li
                v-for="(step, index) in executor.plan.steps"
                :key="step.stepId"
                :class="['step-card', `step-${step.status}`, { current: step.stepId === snapshot.currentStepId }]"
              >
                <div class="step-index">{{ String(index + 1).padStart(2, '0') }}</div>
                <div class="step-content">
                  <div class="step-title-row">
                    <strong>{{ step.name }}</strong>
                    <span class="status-pill">{{ stepStatusLabel(step.status) }}</span>
                  </div>
                  <div class="step-meta">{{ step.module }} · {{ step.action }}</div>
                  <div class="io-row">
                    <span>输入 {{ step.inputKeys.length }}</span>
                    <span>输出 {{ step.outputKeys.length }}</span>
                    <span v-if="step.dependsOn.length">依赖 1</span>
                  </div>
                </div>
              </li>
            </ol>
          </section>

          <section v-if="scenePlans.length">
            <div class="section-heading">
              <h3>场景资源决策</h3>
              <span>{{ scenePlans.length }} PLANS</span>
            </div>
            <div v-for="plan in scenePlans" :key="plan.stepId" class="scene-plan-group">
              <div class="scene-plan-title">
                <strong>{{ stepName(plan.stepId) }}</strong>
                <span>{{ plan.estimatedIncrementalMemoryMb }} MB</span>
              </div>
              <div v-for="decision in plan.decisions" :key="decision.resourceId" class="decision-card">
                <div class="decision-title">
                  <strong>{{ decision.resourceId }}</strong>
                  <span :class="`role-${decision.role}`">{{ roleLabel(decision.role) }}</span>
                </div>
                <div class="score-track"><i :style="{ width: `${decision.relevance * 100}%` }"></i></div>
                <p>{{ decision.reasons.join(' · ') }}</p>
              </div>
              <p v-for="warning in plan.warnings" :key="warning" class="warning">{{ warning }}</p>
            </div>
          </section>

          <section v-if="contextEntries.length">
            <div class="section-heading">
              <h3>共享上下文</h3>
              <span>{{ contextEntries.length }} OUTPUTS</span>
            </div>
            <dl class="context-list">
              <div v-for="entry in contextEntries" :key="entry.key">
                <dt>{{ entry.key }}</dt>
                <dd>{{ formatValue(entry.value) }}</dd>
                <small>{{ entry.source }}<template v-if="entry.confidence !== undefined"> · 置信度 {{ Math.round(entry.confidence * 100) }}%</template></small>
              </div>
            </dl>
          </section>
        </template>

        <section class="history-section">
          <div class="section-heading">
            <h3>历史结果回看</h3>
            <button type="button" :disabled="historyBusy" @click="refreshHistory()">刷新</button>
          </div>
          <p class="history-hint">只读查看各步骤结束时的结果；不会重建或改变当前三维场景。</p>
          <div v-if="historyError" class="notice error" role="alert">{{ historyError }}</div>
          <label v-if="historyRuns.length">
            <span>任务运行</span>
            <select v-model="selectedRunId" :disabled="historyBusy" @change="loadHistoryRun(selectedRunId)">
              <option value="">选择历史任务</option>
              <option v-for="run in historyRuns" :key="run.task_id" :value="run.task_id">
                {{ new Date(run.created_at).toLocaleString() }} · {{ run.description }}
              </option>
            </select>
          </label>
          <p v-else-if="!historyBusy" class="history-hint">暂无已保存任务。</p>
          <template v-if="historySnapshots.length">
            <label>
              <span>结果节点</span>
              <select v-model="selectedSnapshotId">
                <option v-for="item in historySnapshots" :key="item.id" :value="String(item.id)">
                  {{ new Date(item.created_at).toLocaleString() }} · {{ snapshotEventLabel(item.event_type) }}{{ item.step_id ? ` · ${item.step_id}` : '' }}
                </option>
              </select>
            </label>
            <div v-if="selectedHistorySnapshot" class="history-result">
              <p>状态：{{ statusLabel(selectedHistorySnapshot.workflow_state.status) }} · 已完成 {{ selectedHistorySnapshot.workflow_state.completed }}/{{ selectedHistorySnapshot.workflow_state.total }}</p>
              <p>场景资源：{{ selectedHistorySnapshot.scene_plan?.rootResourceIds.join('、') || '无' }}</p>
              <p>增强指令：{{ selectedHistorySnapshot.enhancement_plan?.directives.length ?? 0 }} 条</p>
              <p>已加载资源：{{ selectedHistorySnapshot.resources.filter(item => item.status === 'loaded').map(item => item.id).join('、') || '无' }}</p>
              <p>步骤：{{ selectedHistorySnapshot.workflow_state.steps.map(item => `${item.name}（${stepStatusLabel(item.status)}）`).join(' → ') }}</p>
              <p>数据/模型指纹：{{ selectedHistorySnapshot.data_versions?.length ?? 0 }} 项</p>
              <p v-for="version in selectedHistorySnapshot.data_versions ?? []" :key="version.sourceId" class="version-entry">
                {{ version.sourceId }} · {{ version.algorithm }}: {{ version.digest.slice(0, 16) }}…
              </p>
              <p v-if="!selectedHistorySnapshot.data_versions?.length" class="history-hint">本节点尚无已读取数据的内容指纹。</p>
              <dl class="context-list">
                <div v-for="(entry, key) in selectedHistorySnapshot.workflow_state.sharedContext" :key="key">
                  <dt>{{ key }}</dt><dd>{{ formatValue(entry.value) }}</dd>
                </div>
              </dl>
            </div>
          </template>
        </section>
      </div>

      <footer v-if="executor && snapshot" class="panel-footer">
        <button
          v-if="snapshot.status === 'failed'"
          type="button"
          class="danger"
          :disabled="busy"
          @click="retryFailed()"
        >重试失败步骤</button>
        <button
          v-else-if="snapshot.status !== 'completed'"
          type="button"
          :disabled="busy"
          @click="executeNext()"
        >执行下一步</button>
        <button
          type="button"
          class="primary"
          :disabled="busy || snapshot.status === 'completed' || snapshot.status === 'failed'"
          @click="runAll()"
        >{{ busy ? '执行中…' : '执行全部' }}</button>
      </footer>
    </aside>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useTunnelStore } from '@/stores/tunnelStore'
import { viewerService } from '@/platform/viewer/ViewerService'
import { resourceRegistry } from '@/platform/resources/ResourceRegistry'
import { resourceManager } from '@/platform/resources/ResourceManager'
import { registerSupportModule } from '@/modules/support/resources'
import { registerRockModule } from '@/modules/rock/resources'
import { registerBlastModule } from '@/modules/blast/resources'
import { getVentilationThermalData, getVentilationTransientData, refreshVentilationTransientChart, registerVentilationModule, useVentilationThermalSnapshot, useVentilationTransientScenario, type VentilationTransientScenario } from '@/modules/ventilation/resources'
import { updateThermalPoints, type CfdData } from '@/views/ventilation-module/cesiumVentilation'
import type { TaskContext } from '@/platform/context/TaskContext'
import type { WorkflowExecutionSnapshot, WorkflowExecutor } from '@/platform/tasks/WorkflowExecutor'
import { readStepInputs } from '@/platform/tasks/WorkflowContext'
import { createQualityCheckExecutor } from '@/platform/tasks/samples/QualityCheckWorkflow'
import { createSceneExplorationExecutor, sceneStageTask, validateSceneSequence } from '@/platform/tasks/samples/SceneExplorationWorkflow'
import type { ScenePlan, SceneResourceRole } from '@/platform/selection/ScenePlan'
import { ResourceSelector } from '@/platform/selection/ResourceSelector'
import { ScenePlanExecutor } from '@/platform/selection/ScenePlanExecutor'
import { EnhancementPlanner } from '@/platform/enhancement/EnhancementPlanner'
import { EnhancementEngine } from '@/platform/enhancement/EnhancementEngine'
import { RockAssessmentService } from '@/platform/tasks/actions/RockAssessmentAction'
import { SupportAssessmentService } from '@/platform/tasks/actions/SupportAssessmentAction'
import { TaskDataProvenance } from '@/platform/telemetry/TaskDataProvenance'
import { collectActiveAssetPaths, collectActiveDataVersions, readAssetVersions } from '@/platform/telemetry/TaskAssetVersions'
import { recordTaskRun, recordTaskEvent, recordTaskSnapshot, listTaskRuns, listTaskSnapshots, summarizeAuditValue, type TaskAuditEvent, type TaskResultSnapshot, type TaskResultSnapshotInput, type TaskRunSummary } from '@/platform/telemetry/TaskAuditClient'
import {
  registerTaskWorkflowController,
  type AgentTaskWorkflowInput,
  type AgentSceneWorkflowInput,
  type AgentTaskWorkflowStatus,
} from '@/platform/tasks/TaskWorkflowBridge'

defineProps<{ show: boolean }>()
defineEmits<{ close: [] }>()

type Notice = { type: 'info' | 'success' | 'error'; title: string; message: string }

const tunnelStore = useTunnelStore()
const form = reactive({
  description: '检查 DK278+330 至 DK278+340 围岩变化后初期支护是否合理',
  tunnelId: tunnelStore.currentTunnelId ?? '',
  start: 278330,
  end: 278340,
  maxLoadMb: 1200,
})
const executor = ref<WorkflowExecutor>()
const snapshot = ref<WorkflowExecutionSnapshot>()
const scenePlans = ref<readonly ScenePlan[]>([])
const notice = ref<Notice>()
const auditError = ref('')
const assetVersionWarning = ref('')
const busy = ref(false)
const historyBusy = ref(false)
const historyError = ref('')
const historyRuns = ref<TaskRunSummary[]>([])
const historySnapshots = ref<TaskResultSnapshot[]>([])
const selectedRunId = ref('')
const selectedSnapshotId = ref<string>()
const selectedTransientScenario = ref<VentilationTransientScenario>('fan_ramp_up')
const selectedThermalFile = ref('')
const selectedHistorySnapshot = computed(() => historySnapshots.value.find(item => String(item.id) === selectedSnapshotId.value))
let activeSceneExecutor: ScenePlanExecutor | undefined
let activeEnhancementEngine: EnhancementEngine | undefined
let activeProvenance: TaskDataProvenance | undefined
let historyRequest = 0
let stopExecutor: (() => void) | undefined
let unregisterTaskController: (() => void) | undefined

const activeVentilationPreview = computed(() => {
  snapshot.value // 步骤状态变化时重新读取活动场景计划。
  const ids = activeSceneExecutor?.getActiveState().plan?.rootResourceIds ?? []
  if (ids.includes('ventilation.transient-network') && resourceManager.getState('ventilation.transient-network').status === 'loaded') return 'ventilation.transient-network'
  if (ids.includes('ventilation.thermal-field') && resourceManager.getState('ventilation.thermal-field').status === 'loaded') return 'ventilation.thermal-field'
  return undefined
})
const thermalSnapshots = computed(() => {
  snapshot.value
  return activeVentilationPreview.value === 'ventilation.thermal-field'
    ? (getVentilationThermalData()?.index?.snapshots ?? []) as Array<{ t: number; file: string }>
    : []
})

watch(() => tunnelStore.currentTunnelId, (id) => {
  if (id && !form.tunnelId) form.tunnelId = id
}, { immediate: true })

const shortTaskId = computed(() => executor.value?.task.taskId.split('-').slice(-2).join('-') ?? '')
const contextEntries = computed(() => Object.entries(executor.value?.plan.sharedContext ?? {}).map(([key, entry]) => ({
  key,
  value: entry.value,
  source: entry.source.kind === 'step' ? entry.source.id.split(':').at(-1) : 'task',
  confidence: entry.confidence,
})))

const errorMessage = (error: unknown): string => {
  if (error instanceof AggregateError) return [error.message, ...error.errors.map(errorMessage)].join('；')
  if (error instanceof Error && error.cause) return `${error.message}；${errorMessage(error.cause)}`
  return error instanceof Error ? error.message : String(error)
}

const persistAudit = async (event: TaskAuditEvent): Promise<void> => {
  try {
    await recordTaskEvent(event)
    auditError.value = ''
  } catch (error) {
    auditError.value = errorMessage(error)
  }
}

const saveResultSnapshot = async (eventType: TaskResultSnapshotInput['eventType'], stepId?: string): Promise<void> => {
  if (!executor.value) return
  const active = executor.value
  const scenePlan = activeSceneExecutor?.getActiveState().plan ?? null
  const resourceIds = new Set(scenePlan?.loadOrder ?? [])
  const assetPaths = collectActiveAssetPaths(scenePlan?.loadOrder ?? [], resourceRegistry, resourceManager)
  let assetVersions: TaskResultSnapshotInput['dataVersions'] = []
  try {
    assetVersions = await readAssetVersions(assetPaths)
    assetVersionWarning.value = ''
  } catch (error) {
    assetVersionWarning.value = errorMessage(error)
  }
  const state: TaskResultSnapshotInput = {
    taskId: active.task.taskId,
    eventType,
    ...(stepId ? { stepId } : {}),
    workflowState: {
      ...active.getSnapshot(),
      steps: active.plan.steps,
      sharedContext: active.plan.sharedContext,
    },
    scenePlan,
    enhancementPlan: activeEnhancementEngine?.getActivePlan() ?? null,
    resources: resourceManager.listStates()
      .filter(item => resourceIds.has(item.id))
      .map(({ id, status, references }) => ({ id, status, references })),
    dataVersions: [
      ...(activeProvenance?.list() ?? []), ...assetVersions,
      ...collectActiveDataVersions(scenePlan?.loadOrder ?? [], resourceRegistry, resourceManager),
    ],
  }
  try {
    await recordTaskSnapshot(JSON.parse(JSON.stringify(state)) as TaskResultSnapshotInput)
    if (selectedRunId.value === active.task.taskId) await loadHistoryRun(active.task.taskId)
  } catch (error) {
    auditError.value = errorMessage(error)
  }
}

const ventilationScenarios = ['fan_ramp_up', 'fan_oscillation', 'damper_close', 'fan_shutdown', 'combined'] as const
const selectTransientScenario = async (event: Event): Promise<void> => {
  const control = event.target as HTMLSelectElement
  const scenario = control.value as VentilationTransientScenario
  if (busy.value || activeVentilationPreview.value !== 'ventilation.transient-network'
    || !ventilationScenarios.includes(scenario)) return
  busy.value = true
  const taskId = executor.value?.task.taskId
  const previousScenario = selectedTransientScenario.value
  const previousData = getVentilationTransientData()
  try {
    const response = await fetch(`/data/ventilation/transient_${scenario}.json`)
    if (!response.ok) throw new Error(`瞬态工况加载失败：HTTP ${response.status}`)
    const data = await response.json()
    if (activeVentilationPreview.value !== 'ventilation.transient-network' || executor.value?.task.taskId !== taskId) return
    try {
      useVentilationTransientScenario(scenario, data)
      refreshVentilationTransientChart()
    } catch (error) {
      if (previousData !== undefined) {
        useVentilationTransientScenario(previousScenario, previousData)
        refreshVentilationTransientChart()
      }
      throw error
    }
    selectedTransientScenario.value = scenario
    await persistAudit({ taskId, source: 'panel', action: 'select_ventilation_asset', status: 'completed',
      resultSummary: { resourceId: 'ventilation.transient-network', file: `transient_${scenario}.json` } })
    await saveResultSnapshot('asset-selection')
    notice.value = { type: 'success', title: '通风工况已记录', message: '本次工况文件指纹已进入任务结果节点。' }
  } catch (error) {
    notice.value = { type: 'error', title: '通风工况切换失败', message: errorMessage(error) }
  } finally {
    control.value = selectedTransientScenario.value
    busy.value = false
  }
}

const selectThermalSnapshot = async (event: Event): Promise<void> => {
  const control = event.target as HTMLSelectElement
  const file = control.value
  if (busy.value || activeVentilationPreview.value !== 'ventilation.thermal-field' || !file) return
  const snapshot = thermalSnapshots.value.find(item => item.file === file)
  if (!snapshot) return
  busy.value = true
  const taskId = executor.value?.task.taskId
  try {
    const response = await fetch(`/data/ventilation/${file}`)
    if (!response.ok) throw new Error(`热场时间片加载失败：HTTP ${response.status}`)
    const data = await response.json() as CfdData
    if (activeVentilationPreview.value !== 'ventilation.thermal-field' || executor.value?.task.taskId !== taskId) return
    const viewer = viewerService.require()
    updateThermalPoints(viewer, data)
    viewer.scene.requestRender()
    useVentilationThermalSnapshot(file)
    selectedThermalFile.value = file
    await persistAudit({ taskId, source: 'panel', action: 'select_ventilation_asset', status: 'completed',
      resultSummary: { resourceId: 'ventilation.thermal-field', file, timeSeconds: snapshot.t } })
    await saveResultSnapshot('asset-selection')
    notice.value = { type: 'success', title: '热场时间片已记录', message: `t=${snapshot.t}s 文件指纹已进入任务结果节点。` }
  } catch (error) {
    notice.value = { type: 'error', title: '热场时间片切换失败', message: errorMessage(error) }
  } finally {
    control.value = selectedThermalFile.value
    busy.value = false
  }
}

const refreshHistory = async (): Promise<void> => {
  historyBusy.value = true
  historyError.value = ''
  try {
    historyRuns.value = await listTaskRuns()
  } catch (error) {
    historyError.value = errorMessage(error)
  } finally {
    historyBusy.value = false
  }
}

const loadHistoryRun = async (taskId: string): Promise<void> => {
  const request = ++historyRequest
  historySnapshots.value = []
  selectedSnapshotId.value = undefined
  if (!taskId) return
  historyBusy.value = true
  historyError.value = ''
  try {
    const items = await listTaskSnapshots(taskId)
    if (request !== historyRequest) return
    historySnapshots.value = items
    selectedSnapshotId.value = items.at(-1)?.id === undefined ? undefined : String(items.at(-1)?.id)
  } catch (error) {
    if (request === historyRequest) historyError.value = errorMessage(error)
  } finally {
    if (request === historyRequest) historyBusy.value = false
  }
}

const createTask = (): TaskContext => ({
  taskId: `quality-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  taskType: 'quality-check',
  description: form.description,
  tunnelId: form.tunnelId,
  chainageRange: { start: Number(form.start), end: Number(form.end) },
  process: 'support-design',
  targetTypes: ['support'],
  targetState: 'preview',
  constraints: { maxLoadMb: Number(form.maxLoadMb), minFps: 30 },
})

const prepareWorkflow = async (source: 'agent' | 'panel' = 'panel', sceneInput?: AgentSceneWorkflowInput): Promise<void> => {
  if (busy.value) return
  busy.value = true
  notice.value = undefined
  auditError.value = ''
  assetVersionWarning.value = ''
  selectedTransientScenario.value = 'fan_ramp_up'
  selectedThermalFile.value = ''
  try {
    if (sceneInput) form.description = sceneInput.description
    if (executor.value) await executor.value.reset()
    stopExecutor?.()
    registerRockModule()
    registerSupportModule()
    if (sceneInput) {
      registerBlastModule()
      registerVentilationModule()
    }
    const sceneResources = sceneInput ? validateSceneSequence(sceneInput.resourceIds, resourceRegistry) : undefined
    const task: TaskContext = sceneInput ? {
      ...createTask(),
      taskId: `scene-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      taskType: 'scene-exploration',
      description: sceneInput.description,
      targetTypes: ['scene'],
      process: undefined,
      targetState: undefined,
    } : createTask()
    if (sceneResources) task.chainageRange = sceneStageTask(task, sceneResources[0]).chainageRange
    const selector = new ResourceSelector(resourceRegistry)
    const sceneExecutor = new ScenePlanExecutor(resourceRegistry, resourceManager)
    const enhancementPlanner = new EnhancementPlanner(resourceRegistry)
    const enhancementEngine = new EnhancementEngine(resourceRegistry)
    const provenance = new TaskDataProvenance()
    const qualityExecutor = () => createQualityCheckExecutor(task, {
      rockService: new RockAssessmentService(undefined, provenance),
      supportService: new SupportAssessmentService(undefined, provenance),
      rockScene: {
        selector,
        executor: sceneExecutor,
        loadContext: () => ({ viewer: viewerService.require() }),
        selectorOptions: () => ({ candidateResourceIds: ['rock.design-grade'] }),
        enhancement: { planner: enhancementPlanner, engine: enhancementEngine },
      },
      supportScene: {
        selector,
        executor: sceneExecutor,
        loadContext: () => ({ viewer: viewerService.require() }),
        selectorOptions: () => ({ candidateResourceIds: ['support.scene'] }),
        enhancement: { planner: enhancementPlanner, engine: enhancementEngine },
      },
    })
    const sceneWorkflow = sceneInput ? createSceneExplorationExecutor(
      task, sceneInput.resourceIds, resourceRegistry,
      { selector, executor: sceneExecutor, loadContext: () => ({ viewer: viewerService.require() }),
        enhancement: { planner: enhancementPlanner, engine: enhancementEngine } },
    ) : undefined
    const nextExecutor = sceneWorkflow?.executor ?? qualityExecutor()
    scenePlans.value = sceneWorkflow?.scenePlans ?? nextExecutor.plan.steps.flatMap((step) => {
      const resourceId = step.module === 'rock'
        ? 'rock.design-grade'
        : step.module === 'support' ? 'support.scene' : undefined
      return resourceId
        ? [selector.createScenePlan(task, step, { candidateResourceIds: [resourceId] })]
        : []
    })
    executor.value = nextExecutor
    activeSceneExecutor = sceneExecutor
    activeEnhancementEngine = enhancementEngine
    activeProvenance = provenance
    stopExecutor = nextExecutor.subscribe((next) => { snapshot.value = next })
    notice.value = sceneInput
      ? { type: 'success', title: '动态场景计划已生成', message: sceneInput.resourceIds.some(id => id.startsWith('support.legacy-'))
        ? '可逐步执行。既有支护构件保留 DK278+100～DK278+167 附近原示例布置，不可参数化；围岩→支护可同屏，不代表实测或质量结论。'
        : '可逐步执行。相邻围岩→支护阶段可同屏展示；通风 K3+805～K4+005 数据示意配准到 DK278+330，非该工点实测风场，不作联合工程结论。' }
      : { type: 'success', title: '计划已通过校验', message: '可逐步确认，也可一次执行全部步骤。' }
    try {
      await recordTaskRun(task, nextExecutor.plan, scenePlans.value)
      await persistAudit({
        taskId: task.taskId, source, action: 'create_task', status: 'ready',
        inputSummary: { taskType: task.taskType, chainageRange: task.chainageRange, tunnelId: task.tunnelId },
        resultSummary: { taskStatus: 'ready', steps: nextExecutor.plan.steps.length, scenePlans: scenePlans.value.length },
      })
      await saveResultSnapshot('prepared')
      await refreshHistory()
      selectedRunId.value = task.taskId
      await loadHistoryRun(task.taskId)
    } catch (error) {
      auditError.value = errorMessage(error)
    }
  } catch (error) {
    executor.value = undefined
    snapshot.value = undefined
    scenePlans.value = []
    activeSceneExecutor = undefined
    activeEnhancementEngine = undefined
    activeProvenance = undefined
    notice.value = { type: 'error', title: '计划生成失败', message: errorMessage(error) }
  } finally {
    busy.value = false
  }
}

const handleResult = (status: 'completed' | 'failed', durationMs: number, error?: unknown): void => {
  notice.value = status === 'completed'
    ? { type: 'success', title: '步骤执行完成', message: `耗时 ${Math.round(durationMs)} ms，上下文输出已登记。` }
    : { type: 'error', title: '步骤执行失败', message: errorMessage(error) }
}

const executeAuditedStep = async (source: 'agent' | 'panel') => {
  const active = executor.value!
  const step = active.plan.steps.find(({ stepId }) => stepId === active.plan.currentStepId)
  let inputs: Readonly<Record<string, unknown>> = {}
  try { if (step) inputs = readStepInputs(active.plan, step, active.task) } catch { /* 执行器负责报告缺失输入 */ }
  const result = await active.executeCurrent()
  const outputs = Object.fromEntries(result.outputKeys.map((key) => [key, active.plan.sharedContext[key]]))
  await persistAudit({
    taskId: active.task.taskId, source, action: 'execute_task_step',
    stepId: result.stepId, status: result.status, durationMs: result.durationMs,
    inputSummary: summarizeAuditValue(inputs) as Record<string, unknown>,
    resultSummary: {
      taskStatus: active.getSnapshot().status,
      outputs: summarizeAuditValue(outputs),
      error: result.error === undefined ? undefined : errorMessage(result.error),
    },
    rollbackStatus: result.status === 'completed' ? 'not-needed' : result.rollbackError ? 'failed' : 'completed',
  })
  await saveResultSnapshot(result.status === 'completed' ? 'step-completed' : 'step-failed', result.stepId)
  return result
}

const executeNext = async (source: 'agent' | 'panel' = 'panel'): Promise<void> => {
  if (!executor.value || busy.value) return
  busy.value = true
  try {
    const result = await executeAuditedStep(source)
    handleResult(result.status, result.durationMs, result.error)
  } catch (error) {
    notice.value = { type: 'error', title: '执行器异常', message: errorMessage(error) }
  } finally {
    busy.value = false
  }
}

const runAll = async (source: 'agent' | 'panel' = 'panel'): Promise<void> => {
  if (!executor.value || busy.value) return
  busy.value = true
  const startedAt = performance.now()
  notice.value = { type: 'info', title: '正在执行', message: executor.value.task.taskType === 'scene-exploration' ? '正在依序切换现有场景资产。' : '正在推进围岩评估、场景增强与支护检查。' }
  try {
    const results = []
    while (executor.value.getSnapshot().status !== 'completed') {
      if (executor.value.getSnapshot().status === 'failed') break
      const result = await executeAuditedStep(source)
      results.push(result)
      if (result.status === 'failed') break
    }
    const failed = results.find((result) => result.status === 'failed')
    if (failed) handleResult(failed.status, failed.durationMs, failed.error)
    else notice.value = { type: 'success', title: '任务执行完成', message: `已完成 ${results.length} 个步骤，结果已写入共享上下文。` }
    await persistAudit({
      taskId: executor.value.task.taskId, source, action: 'continue_workflow',
      status: failed ? 'failed' : 'completed', durationMs: performance.now() - startedAt,
      resultSummary: { taskStatus: executor.value.getSnapshot().status, executedSteps: results.length },
      rollbackStatus: failed ? failed.rollbackError ? 'failed' : 'completed' : 'not-needed',
    })
  } catch (error) {
    notice.value = { type: 'error', title: '执行器异常', message: errorMessage(error) }
  } finally {
    busy.value = false
  }
}

const retryFailed = async (source: 'agent' | 'panel' = 'panel'): Promise<void> => {
  const current = executor.value?.plan.steps.find((step) => step.status === 'failed')
  if (!executor.value || !current || busy.value) return
  executor.value.retry(current.stepId)
  await persistAudit({
    taskId: executor.value.task.taskId, source, action: 'retry_task_step',
    stepId: current.stepId, status: 'ready', resultSummary: { taskStatus: 'ready' },
  })
  await saveResultSnapshot('retry', current.stepId)
  notice.value = { type: 'info', title: '已恢复待执行', message: '失败步骤已清理，可再次执行。' }
  await executeNext(source)
}

const resetWorkflow = async (source: 'agent' | 'panel' = 'panel'): Promise<void> => {
  if (!executor.value || busy.value) return
  busy.value = true
  const startedAt = performance.now()
  try {
    await executor.value.reset()
    activeProvenance?.clear()
    notice.value = { type: 'info', title: '工作流已复位', message: '步骤输出和任务级场景资源已清理。' }
    await persistAudit({
      taskId: executor.value.task.taskId, source, action: 'reset_task_scene',
      status: 'completed', durationMs: performance.now() - startedAt,
      rollbackStatus: 'completed', resultSummary: { taskStatus: 'ready' },
    })
    await saveResultSnapshot('reset')
  } catch (error) {
    notice.value = { type: 'error', title: '复位不完整', message: errorMessage(error) }
    await persistAudit({
      taskId: executor.value.task.taskId, source, action: 'reset_task_scene',
      status: 'failed', durationMs: performance.now() - startedAt,
      rollbackStatus: 'failed', resultSummary: { error: errorMessage(error), taskStatus: executor.value.getSnapshot().status },
    })
    await saveResultSnapshot('reset')
  } finally {
    busy.value = false
  }
}

const getAgentStatus = (): AgentTaskWorkflowStatus => ({
  available: true,
  prepared: Boolean(executor.value),
  taskId: executor.value?.task.taskId,
  status: snapshot.value?.status,
  currentStepId: snapshot.value?.currentStepId,
  completed: snapshot.value?.completed ?? 0,
  total: snapshot.value?.total ?? 0,
  steps: executor.value?.plan.steps.map(({ stepId, name, module, status }) => ({
    stepId, name, module, status,
  })) ?? [],
  contextKeys: Object.keys(executor.value?.plan.sharedContext ?? {}),
  scenePlans: scenePlans.value.map((plan) => ({
    stepId: plan.stepId,
    resources: [...plan.rootResourceIds],
    estimatedMemoryMb: plan.estimatedIncrementalMemoryMb,
  })),
  notice: notice.value ? { ...notice.value } : undefined,
})

const prepareFromAgent = async (input: AgentTaskWorkflowInput): Promise<AgentTaskWorkflowStatus> => {
  if (input.description !== undefined) form.description = input.description
  if (input.tunnelId !== undefined) form.tunnelId = input.tunnelId
  if (input.start !== undefined) form.start = input.start
  if (input.end !== undefined) form.end = input.end
  if (input.maxLoadMb !== undefined) form.maxLoadMb = input.maxLoadMb
  await prepareWorkflow('agent')
  return getAgentStatus()
}

const prepareSceneFromAgent = async (input: AgentSceneWorkflowInput): Promise<AgentTaskWorkflowStatus> => {
  form.description = input.description
  if (input.tunnelId !== undefined) form.tunnelId = input.tunnelId
  if (input.maxLoadMb !== undefined) form.maxLoadMb = input.maxLoadMb
  await prepareWorkflow('agent', input)
  return getAgentStatus()
}

onMounted(() => {
  void refreshHistory()
  unregisterTaskController = registerTaskWorkflowController({
    prepare: prepareFromAgent,
    prepareScene: prepareSceneFromAgent,
    executeNext: async () => { await executeNext('agent'); return getAgentStatus() },
    runAll: async () => { await runAll('agent'); return getAgentStatus() },
    retryFailed: async () => { await retryFailed('agent'); return getAgentStatus() },
    reset: async () => { await resetWorkflow('agent'); return getAgentStatus() },
    getStatus: getAgentStatus,
  })
})

const statusLabel = (status: WorkflowExecutionSnapshot['status']): string => ({
  ready: '待执行', running: '执行中', completed: '已完成', failed: '失败',
})[status]
const snapshotEventLabel = (eventType: TaskResultSnapshotInput['eventType']): string => ({
  prepared: '计划生成', 'step-completed': '步骤完成', 'step-failed': '步骤失败', retry: '步骤重试', reset: '任务复位', 'asset-selection': '通风资产选择',
})[eventType]
const stepStatusLabel = (status: string): string => ({
  pending: '待执行', running: '执行中', completed: '完成', failed: '失败', skipped: '跳过',
})[status] ?? status
const roleLabel = (role: SceneResourceRole): string => ({
  focus: '焦点', reference: '参照', dependency: '依赖', excluded: '排除',
})[role]
const stepName = (stepId: string): string => (
  executor.value?.plan.steps.find((step) => step.stepId === stepId)?.name ?? stepId
)
const formatValue = (value: unknown): string => {
  if (typeof value === 'string') return value
  const serialized = JSON.stringify(value)
  return serialized && serialized.length > 180 ? `${serialized.slice(0, 177)}…` : serialized ?? String(value)
}

onBeforeUnmount(() => {
  unregisterTaskController?.()
  stopExecutor?.()
  if (executor.value && snapshot.value?.status !== 'running') void executor.value.reset()
})
</script>

<style scoped lang="scss">
.task-workflow-panel {
  position: fixed; z-index: 92; top: 66px; right: 18px; bottom: 24px; width: min(430px, calc(100vw - 36px));
  display: flex; flex-direction: column; overflow: hidden; color: #dceefa;
  background: linear-gradient(160deg, rgba(4, 18, 33, .98), rgba(2, 11, 23, .96));
  border: 1px solid rgba(0, 224, 255, .35); border-radius: 6px;
  box-shadow: 0 18px 60px rgba(0, 0, 0, .62), inset 0 0 34px rgba(0, 174, 255, .04);
  backdrop-filter: blur(18px); font-family: "Microsoft YaHei", sans-serif;
}
.panel-header { display: flex; align-items: center; justify-content: space-between; padding: 17px 18px 14px; border-bottom: 1px solid rgba(0, 202, 255, .18); }
.eyebrow { display: block; margin-bottom: 3px; color: #3bdcf5; font: 9px/1.2 monospace; letter-spacing: 2px; }
h2, h3, p { margin: 0; }
h2 { font-size: 17px; font-weight: 500; letter-spacing: 1px; }
h3 { font-size: 13px; font-weight: 500; color: #e9f8ff; }
.icon-button { width: 30px; height: 30px; border: 0; background: transparent; color: #8db0c2; font-size: 25px; cursor: pointer; }
.icon-button:hover { color: #fff; }
.panel-body { min-height: 0; flex: 1; overflow: auto; padding: 16px 17px 22px; scrollbar-width: thin; scrollbar-color: rgba(0, 210, 255, .28) transparent; }
section + section, .notice + section, section + .notice { margin-top: 17px; }
.form-section { padding-bottom: 15px; border-bottom: 1px solid rgba(120, 205, 240, .12); }
label { display: flex; flex-direction: column; gap: 6px; min-width: 0; color: #8eb2c6; font-size: 11px; }
textarea, input, select { width: 100%; box-sizing: border-box; color: #e5f7ff; background: rgba(4, 36, 57, .62); border: 1px solid rgba(0, 190, 235, .22); border-radius: 3px; outline: none; font: 12px/1.45 inherit; }
textarea { resize: vertical; min-height: 54px; padding: 8px 9px; }
input, select { height: 33px; padding: 0 8px; }
textarea:focus, input:focus, select:focus { border-color: rgba(0, 225, 255, .72); box-shadow: 0 0 0 2px rgba(0, 205, 255, .08); }
.field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 11px 10px; margin-top: 11px; }
.form-actions { display: flex; gap: 8px; margin-top: 13px; }
button { height: 32px; padding: 0 13px; color: #a9cedd; background: rgba(10, 50, 70, .66); border: 1px solid rgba(92, 180, 210, .28); border-radius: 3px; cursor: pointer; }
button:hover:not(:disabled) { color: #ecfbff; border-color: rgba(0, 224, 255, .62); }
button:disabled { opacity: .42; cursor: not-allowed; }
button.primary { color: #00161d; background: linear-gradient(110deg, #21d7e7, #55f0c3); border-color: transparent; font-weight: 600; }
button.danger { color: #ffbdc0; border-color: rgba(255, 81, 91, .5); background: rgba(128, 25, 34, .24); }
.notice { display: flex; flex-direction: column; gap: 3px; padding: 10px 11px; border-left: 2px solid; background: rgba(255, 255, 255, .035); font-size: 11px; line-height: 1.55; }
.notice strong { font-size: 12px; }.notice span { color: #aac2ce; }
.notice.success { border-color: #49e5a5; }.notice.error { border-color: #ff5b66; }.notice.info { border-color: #36cce7; }
.summary-strip { display: grid; grid-template-columns: 1fr .65fr 1.2fr; gap: 8px; padding: 11px; background: rgba(0, 177, 214, .07); border: 1px solid rgba(0, 193, 227, .13); }
.summary-strip > div { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.summary-label { color: #769aac; font-size: 9px; text-transform: uppercase; }.summary-strip strong { overflow: hidden; text-overflow: ellipsis; font-size: 12px; }
.mono { font-family: monospace; white-space: nowrap; }.status-completed { color: #4ce2a8; }.status-failed { color: #ff7179; }.status-running { color: #ffe083; }
.section-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 9px; }
.section-heading > span { color: #5d879a; font: 9px monospace; letter-spacing: 1px; }
.step-list { display: flex; flex-direction: column; gap: 7px; margin: 0; padding: 0; list-style: none; }
.step-card { display: flex; gap: 11px; padding: 10px; background: rgba(255, 255, 255, .025); border: 1px solid rgba(130, 190, 215, .1); border-left: 2px solid #456473; }
.step-card.current { background: rgba(0, 205, 235, .07); border-color: rgba(0, 214, 245, .3); }.step-card.step-completed { border-left-color: #46dca3; }.step-card.step-failed { border-left-color: #ff5b66; }.step-card.step-running { border-left-color: #ffe083; }
.step-index { color: #4aaac2; font: 12px/1.45 monospace; }.step-content { min-width: 0; flex: 1; }
.step-title-row, .decision-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; }.step-title-row strong, .decision-title strong { font-size: 12px; font-weight: 500; }
.status-pill, [class^="role-"] { flex: 0 0 auto; padding: 2px 6px; color: #9fb9c5; background: rgba(130, 170, 185, .11); border-radius: 8px; font-size: 9px; }
.step-meta { margin-top: 4px; color: #668b9d; font: 10px monospace; }.io-row { display: flex; gap: 12px; margin-top: 7px; color: #8da7b3; font-size: 9px; }
.decision-card { padding: 9px 10px; background: rgba(255, 255, 255, .025); border: 1px solid rgba(130, 190, 215, .1); }.decision-card + .decision-card { margin-top: 6px; }
.scene-plan-group + .scene-plan-group { margin-top: 11px; padding-top: 11px; border-top: 1px solid rgba(130, 190, 215, .1); }.scene-plan-title { display: flex; justify-content: space-between; margin-bottom: 6px; color: #9fc6d8; font-size: 10px; }.scene-plan-title span { color: #5d879a; font-family: monospace; }
.role-focus { color: #5ee5b1; background: rgba(39, 207, 144, .12); }.role-reference { color: #67dced; }.role-excluded { color: #8a9aa1; }.role-dependency { color: #e1cb7f; }
.score-track { height: 2px; margin: 8px 0 6px; background: #152f3b; }.score-track i { display: block; height: 100%; background: linear-gradient(90deg, #1f88b6, #4fe4bc); }
.decision-card p, .warning { color: #7795a3; font-size: 9px; line-height: 1.55; }.warning { margin-top: 6px; color: #e6bc69; }
.context-list { display: flex; flex-direction: column; gap: 6px; margin: 0; }.context-list > div { padding: 8px 10px; background: rgba(255, 255, 255, .025); border-left: 1px solid rgba(0, 205, 235, .35); }
.context-list dt { color: #59d9ee; font: 10px monospace; }.context-list dd { margin: 4px 0; color: #d5e8f0; font-size: 11px; line-height: 1.45; word-break: break-word; }.context-list small { color: #5f7d8a; font-size: 9px; }
.history-section { padding-top: 14px; border-top: 1px solid rgba(120, 205, 240, .12); }
.history-section label + label, .history-result { margin-top: 10px; }
.history-hint { margin: 0 0 10px; color: #789cac; font-size: 10px; line-height: 1.5; }
.history-result { padding: 10px; background: rgba(0, 177, 214, .05); border: 1px solid rgba(0, 193, 227, .13); }
.history-result p { margin-bottom: 7px; color: #a8cbd8; font-size: 10px; line-height: 1.5; word-break: break-word; }
.panel-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 17px; border-top: 1px solid rgba(0, 202, 255, .18); background: rgba(0, 0, 0, .18); }
.task-panel-slide-enter-active, .task-panel-slide-leave-active { transition: transform .22s ease, opacity .22s ease; }.task-panel-slide-enter-from, .task-panel-slide-leave-to { transform: translateX(28px); opacity: 0; }
@media (max-width: 640px) { .task-workflow-panel { top: 58px; right: 8px; bottom: 8px; width: calc(100vw - 16px); }.field-grid { grid-template-columns: 1fr; } }
</style>
