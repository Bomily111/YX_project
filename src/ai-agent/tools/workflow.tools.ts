import {planTaskVisualReview,applyTaskVisualReview,restoreTaskVisualReview} from '@/platform/tasks/TaskVisualReview'
import {visualObjectives} from '@/platform/tasks/TaskVisualGoal'
import { inspectTaskScene } from '@/platform/tasks/TaskSceneInspection'
import { resourceRegistry } from '@/platform/resources/ResourceRegistry'
import type { ToolRegistration } from '../types'
import {resolveSupportLayers} from '../SupportLayerIntent'
import {planSupportDisplayContinuity} from '../SupportDisplayContinuity'
import {getTaskSupportLayers,setTaskSupportLayer,getCurrentSupportReport} from '@/modules/support/test-section-resource'
import { continuousSupportCatalog } from '@/modules/support/continuous-layout'
import { readSceneCapabilities } from '../SceneCapabilities'
import { setTaskVolumeCut } from '@/platform/tasks/TaskVolumeCut'
import {getTaskVolumeDomain,getTaskVolumeKey} from '@/platform/tasks/TaskVolumeCut'
import {inspectVentilationCharts,setVentilationChartReview} from '@/modules/ventilation/resources'
import {setTaskFlowReview,inspectTaskFlowReview,evaluateTaskFlowReview,adjustTaskFlowReview} from '@/platform/tasks/TaskFlowReview'
import { focusTaskCamera, taskViews, type TaskView } from '@/platform/tasks/TaskCameraView'
import { constructionReview, constructionReviews, publishConstructionReview, resolveConstructionReviewRequest, type ConstructionReviewReference } from '@/platform/tasks/ConstructionReview'
import { captureReviewAssemblyView, focusConstructionReview } from '@/platform/tasks/ConstructionReviewScene'
import { nextTick } from 'vue'
import { taskManualControlsEnabled } from '@/platform/tasks/taskManualControls'
import { getJetFanPlacement } from '@/modules/ventilation/axial-fan-resource'
import { clearTaskTunnelSection, showTaskTunnelSection } from '@/platform/tasks/TaskTunnelSection'
import { advancePlatformTask, dispatchValidatedWorkflow, orchestratePlatformTask } from '../TaskOrchestrator'
import { AGENT_SCENE_RESOURCES, SCENE_ENHANCEMENT_MODES, SCENE_ASSEMBLY_MODES } from '@/platform/tasks/samples/SceneExplorationWorkflow'
import { getBlastDesignSummary } from '@/modules/blast/design-resource'
import { facePhotoCatalog, getActiveFaceSlices, isFacePhotoResource } from '@/modules/face-sketch/resources'
import { getActiveDrillModels } from '@/modules/rock/drill-resource'
import { canRetrySceneLoad } from '../SceneRecovery'
import { resourceManager } from '@/platform/resources/ResourceManager'
import { requestedThermalTimes, thermalRequestIssue, thermalSnapshotCatalog } from '@/modules/ventilation/thermal-catalog'
import { chainageService } from '@/platform/coordinates/ChainageService'
import { viewerService } from '@/platform/viewer/ViewerService'
import { getActiveModelerSupportModel } from '@/modules/support/modeler-resources'
import { validateTestSupportRequest, isTestSupportId } from '@/modules/support/test-section-resource'
import { resolveTestSupportLength } from '@/modules/support/test-section-layout'
import { resolveTestSupportUpdate } from '../TestSupportUpdate'
import { getTestSectionSupportModels, getTestSectionSupportSummaries } from '@/modules/support/test-section-resource'
import { ALTERNATING_SUPPORT_ID, getActiveAlternatingSupportModel, getActiveAlternatingSupportSpan } from '@/modules/support/alternating-resource'
import { clearFocusedTunnelSegment, focusTunnelSegmentAt, setTunnelTranslucent } from '@/utils/Common/DrawLine'
import { blastViewOffset, getBlastModel, setBlastLayerVisible } from '@/views/tunnel-module/blast'
import * as Cesium from 'cesium'
import {
  getTaskWorkflowController,
  hasTaskWorkflowController,
  type AgentTaskWorkflowInput,
  type AgentTaskWorkflowStatus,
} from '@/platform/tasks/TaskWorkflowBridge'

const supportLayerTool:ToolRegistration={module:'common',tool:{name:'set_support_layers',description:'按用户原话调整当前已完成任务的支护构件显隐，不重装、不新建任务；可恢复默认。',input_schema:{type:'object',properties:{}}},executor:async input=>{
 const status=getTaskWorkflowController().getStatus(),ids=status.lastCompletedStage?.assembledResourceIds??[]
 if(status.status!=='completed')throw Error('请先完成支护任务装配')
 const layers=getTaskSupportLayers(ids),changes=resolveSupportLayers(String(input.userRequest??''),layers.map(l=>l.component))
 for(const layer of layers)if(changes.has(layer.component))setTaskSupportLayer(layer.resourceId,layer.component,changes.get(layer.component)!)
 return JSON.stringify({ok:true,action:'set_support_layers',taskId:status.taskId,layers:getTaskSupportLayers(ids)})
}}
const result = (action: string, status: AgentTaskWorkflowStatus): string => JSON.stringify({
  ok: status.notice?.type !== 'error',
  action,
  ...status,
})
const agentResourceIds = (value: unknown): string[] => {
  if (!Array.isArray(value) || value.some(id => typeof id !== 'string')) throw new Error('场景资源必须是字符串数组')
  // The tunnel and ventilation base scene are dependencies, not user-selected
  // business layers. Tolerate a model naming either explicitly.
  const ids = (value as string[]).filter(id => id !== 'common.tunnel' && id !== 'ventilation.scene')
  const forbidden = ids.find(id => !AGENT_SCENE_RESOURCES.includes(id as typeof AGENT_SCENE_RESOURCES[number]))
  if (forbidden) throw new Error(`智能体当前不可调度资源：${forbidden}`)
  return ids
}

const enhancementModesSchema = {
  type: 'array', minItems: 1, maxItems: 8,
  items: { type: 'string', enum: [...SCENE_ENHANCEMENT_MODES] },
  description: '与 resourceIds 逐一对应。auto 使用资源推荐增强；emphasis 强调当前资源并弱化参照；context 保留场景背景并避免焦点描边。由平台校验后执行。',
}
const assemblyModesSchema = {
  type: 'array', minItems: 1, maxItems: 8,
  items: { type: 'string', enum: [...SCENE_ASSEMBLY_MODES] },
  description: '与 resourceIds 逐一对应。retain 保留上一阶段资源并加入当前资源；replace 切换到当前资源；auto 使用平台默认装配。仅同址且兼容的资源可保留，平台会校验。首阶段不可 retain。',
}
const readAssemblyModes = (input: Record<string, any>): string[] | undefined => {
  if (input.assemblyModes === undefined) return undefined
  if (!Array.isArray(input.assemblyModes) || input.assemblyModes.some((mode: unknown) => typeof mode !== 'string')) {
    throw new Error('装配方式必须是字符串数组')
  }
  return input.assemblyModes
}
const readEnhancementModes = (input: Record<string, any>): string[] | undefined => {
  if (input.enhancementModes === undefined) return undefined
  if (!Array.isArray(input.enhancementModes) || input.enhancementModes.some((mode: unknown) => typeof mode !== 'string')) {
    throw new Error('增强方式必须是字符串数组')
  }
  return input.enhancementModes
}

const parseDescriptionChainages = (description: string): number[] => {
  const values: number[] = []
  const pattern = /(?:DK|YK)\s*\d+\s*\+\s*\d+(?:\.\d+)?/gi
  for (const match of description.matchAll(pattern)) {
    values.push(chainageService.toCanonicalChainage(match[0]))
  }
  return values
}

const normalizeNumericTaskChainage = (value: number): number => value >= chainageService.legacyDkReference.origin
  ? chainageService.legacyDkToCanonical(value) : value

export function resolveAssemblyMileage(modelValue: unknown, userRequest?: string): string {
  const mileagePattern = /(?<![A-Z0-9])(?:DK|YK)\s*\d+\s*\+\s*\d+(?:\.\d+)?/gi
  const explicit = [...new Set((userRequest ?? '').match(mileagePattern)?.map(value => value.replace(/\s+/g, '').toUpperCase()) ?? [])]
  if (userRequest !== undefined) {
    if (explicit.length === 0 && /测试工段|论文测试|(?:展示|查看|加载|装配|看看).{0,8}三台阶/.test(userRequest)) return 'YK2+244'
    if (explicit.length === 0) throw new Error('用户未明确给出目标里程，请先询问')
    if (explicit.length > 1) throw new Error('用户给出了多个里程，请先明确本次装配目标')
    return explicit[0]
  }
  const candidate = String(modelValue ?? '').trim().replace(/\s+/g, '').toUpperCase()
  if (!/^(?:DK|YK)\d+\+\d+(?:\.\d+)?$/.test(candidate)) {
    throw new Error('请明确提供 DK 或 YK 格式的目标里程，不能猜测位置')
  }
  return candidate
}

function validateSelectedPhoto(resourceIds: readonly string[], request: string) {
  const requestedPhotos = [...new Set(request.match(/X1DK\s*2\s*\+\s*\d+(?:\.\d+)?/gi)?.map(value => Number(value.split('+')[1])) ?? [])]
  const photoId = resourceIds.find(isFacePhotoResource)
  if (photoId && requestedPhotos.length && (requestedPhotos.length !== 1 || !facePhotoCatalog.some(item => item.id === photoId && Number(item.sourceMileage.split('+')[1]) === requestedPhotos[0]))) {
    throw new Error('当前只装配一张照片，所选照片与指定的来源里程不符')
  }
}

export function normalizeAgentTaskInput(input: Record<string, any>): AgentTaskWorkflowInput {
  const description = String(input.description ?? '').trim()
  const parsed = parseDescriptionChainages(description)
  const start = parsed[0] ?? normalizeNumericTaskChainage(Number(input.start))
  const end = parsed[1] ?? normalizeNumericTaskChainage(Number(input.end))
  return {
    description,
    tunnelId: input.tunnelId === undefined ? undefined : String(input.tunnelId),
    start,
    end,
    maxLoadMb: input.maxLoadMb === undefined ? undefined : Number(input.maxLoadMb),
  }
}

export const workflowTools: ToolRegistration[] = [
  {
    module: 'common',
    tool: {
      name: 'run_construction_review',
      description: '按用户原话启动两项论文施工复盘，或切换当前复盘节点。复核为示例资料演练，不能判定施工审批或准入。',
      input_schema: { type: 'object', properties: {} },
    },
    executor: async input => {
      const request = String(input.userRequest ?? '')
      const action = 'run_construction_review'
      const controller = getTaskWorkflowController()
      const current = controller.getStatus()
      const selection = constructionReview.value?.taskId === current.taskId && current.status === 'completed'
        ? constructionReview.value : null
      const intent = resolveConstructionReviewRequest(request, selection)
      if (!intent) return JSON.stringify({ action, ok: false, reason: '请明确指定一项施工复盘及其节点。' })
      const assemblyOnly = intent.experiment === 'assemble' ||
        (!intent.start && intent.experiment !== 'enhance' && selection?.assemblyOnly === true)
      if ((intent.experiment || assemblyOnly) && !taskManualControlsEnabled()) {
        return JSON.stringify({ action, ok: false, reason: '此入口仅用于开发环境的复盘对照。' })
      }
      if (assemblyOnly && (intent.supportDisplay || intent.workfaceView)) {
        return JSON.stringify({ action, ok: false, reason: '当前为仅装配条件，请先增强当前复盘再调整表达。' })
      }
      if (intent.experiment === 'enhance' && !selection?.assemblyOnly) {
        return JSON.stringify({ action, ok: false, reason: '请先完成仅装配条件。' })
      }
      if (intent.experiment === 'restore' && !selection?.restoreAssemblyView) {
        return JSON.stringify({ action, ok: false, reason: '当前节点没有可恢复的装配表达。' })
      }
      if (intent.experiment === 'annotations' && !selection?.restoreAssemblyView) {
        return JSON.stringify({ action, ok: false, reason: '请先增强当前复盘，再切换三维标注。' })
      }
      if (intent.experiment === 'reference-links' && !selection?.restoreAssemblyView) {
        return JSON.stringify({ action, ok: false, reason: '请先增强当前复盘，再切换里程联动。' })
      }
      const review = constructionReviews[intent.kind]
      const step = review.steps[intent.stepIndex]
      if (!step) return JSON.stringify({ action, ok: false, reason: '已到复盘流程边界，场景保持在当前节点。' })
      if (intent.supportDisplay && step.view !== 'support') {
        return JSON.stringify({ action, ok: false, reason: '请先复核原支护版本或拟变更版本，再切换初支展示。' })
      }
      const explicitlyRequested = [...request.matchAll(/\b(?:YK|DK)\s*\d+\s*\+\s*\d+(?:\.\d+)?/gi)]
      if (explicitlyRequested.some(match => chainageService.toCanonicalChainage(match[0].replace(/\s/g, '')) !== chainageService.toCanonicalChainage(review.mileage))) {
        return JSON.stringify({ action, ok: false, reason: `当前示例资料固定在 ${review.mileage}，请指定该展示位置或补充目标工段资料。` })
      }
      const loadedIds = current.lastCompletedStage?.assembledResourceIds ?? []
      const needsAssembly = intent.start || loadedIds.length !== step.ids.length ||
        step.ids.some(id => !loadedIds.includes(id) || resourceManager.getState(id).status !== 'loaded')
      if ((intent.supportDisplay || (intent.experiment && intent.experiment !== 'assemble')) && needsAssembly) {
        return JSON.stringify({ action, ok: false, reason: '当前复盘资源已变化，请重新进入该节点。' })
      }
      let assembly
      if (needsAssembly) {
        const assemble = workflowTools.find(item => item.tool.name === 'assemble_scene_at_mileage')!
        const assemblyRequest = intent.kind === 'geology-change'
          ? step.key === 'workface' ? `${review.title} ${review.mileage} 掌子面岩面近景`
            : `${review.title} ${review.mileage} 三台阶后方5米${step.key === 'candidate' ? 'ZZ-Va' : 'ZZ-IVb'}支护`
          : `${review.title} ${review.mileage}，洞顶射流风机布置在开挖基准后方12米，出风朝里程增大方向。`
        assembly = JSON.parse(await assemble.executor({
          targetMileage: review.mileage, resourceIds: [...step.ids], userRequest: assemblyRequest,
        }))
        if (!assembly.ok) return JSON.stringify({ ...assembly, action })
      }
      const status = controller.getStatus()
      const stage = status.lastCompletedStage
      if (status.status !== 'completed' || !status.taskId || !stage || (assembly && assembly.taskId !== status.taskId)) {
        return JSON.stringify({ action, ok: false, reason: '任务已切换，未应用旧节点。' })
      }
      if (intent.experiment === 'annotations') {
        publishConstructionReview({ ...selection!, sceneAnnotations: intent.sceneAnnotations })
        return JSON.stringify({ action, ok: true, taskId: status.taskId, sceneChanged: false,
          summary: `已${intent.sceneAnnotations ? '显示' : '隐藏'}复盘三维标注，保留当前机位与二维资料。` })
      }
      if (intent.experiment === 'reference-links') {
        publishConstructionReview({ ...selection!, referenceLinks: intent.referenceLinks })
        return JSON.stringify({ action, ok: true, taskId: status.taskId, sceneChanged: false,
          summary: `已${intent.referenceLinks ? '开启' : '关闭'}复盘里程联动，保留当前机位、静态标注和二维资料。` })
      }
      if (assemblyOnly || intent.experiment === 'restore') {
        publishConstructionReview({ kind: intent.kind, stepIndex: intent.stepIndex, taskId: status.taskId, references: [], assemblyOnly: true })
        if (intent.experiment === 'restore') {
          // Dispose the enhanced scene presentation before restoring the captured camera and layers.
          await nextTick()
          const restored = constructionReview.value
          if (controller.getStatus().taskId !== status.taskId || !restored?.assemblyOnly ||
              restored.taskId !== status.taskId || restored.stepIndex !== intent.stepIndex) {
            return JSON.stringify({ action, ok: false, reason: '任务已切换，未恢复旧节点表达。' })
          }
          selection!.restoreAssemblyView!()
        }
        return JSON.stringify({ ...assembly, action, ok: true, sceneChanged: needsAssembly, taskId: status.taskId,
          targetMileage: review.mileage, taskDescription: review.title, step: step.key, assembledResourceIds: stage.assembledResourceIds,
          summary: intent.experiment === 'restore' ? `${step.label}｜已恢复增强前的装配表达，可再次增强。`
            : `${step.label}｜${review.mileage} 使用平台默认场景表达。可继续查看下一节点，或输入“增强当前复盘”进行同场景对照。` })
      }
      const chainage = stage.chainageRange.start
      const geology = intent.kind === 'geology-change'
      const references: ConstructionReviewReference[] = [step.key === 'workface'
        ? { role: 'workface', label: '掌子面岩面', start: chainage }
        : geology ? { role: 'excavation', label: '开挖基准', start: chainage }
          : { role: 'blast-cloud', label: '爆后点云', start: chainage }]
      const support = geology ? getTestSectionSupportSummaries(stage.assembledResourceIds)[0] : undefined
      const offsets: number[] | undefined = support?.unitOffsetsM
      const supportRange = offsets?.length ? {
        start: chainage + offsets[0]! - .5, end: chainage + offsets.at(-1)! + .5,
      } : undefined
      if (supportRange) references.push({ role: 'support-span', label: `${support.supportType} 初支`, ...supportRange })
      const fan = geology ? undefined : getJetFanPlacement()
      if (fan) references.push({ role: 'jet-fan', label: '洞顶射流风机', start: fan.chainage })
      const supportEvidence = geology ? {
        ...(!intent.start && selection?.kind === intent.kind ? selection.supportEvidence : undefined),
        ...(support ? { [step.key === 'candidate' ? 'candidate' : 'baseline']: getTaskSupportLayers([support.id]).map(layer => layer.component) } : undefined),
      } : undefined
      const chart = intent.kind === 'blast-handoff'
        ? inspectVentilationCharts().find(item => item.owner === 'ventilation.co-analysis')
        : undefined
      const keepSupportComparison = !intent.start && !intent.supportDisplay && step.view === 'support' &&
        selection?.kind === intent.kind && review.steps[selection.stepIndex]?.view === 'support'
      const nextReview = {
        kind: intent.kind, stepIndex: intent.stepIndex, taskId: status.taskId, references,
        restoreAssemblyView: intent.experiment === 'enhance'
          ? captureReviewAssemblyView(viewerService.require(), stage.assembledResourceIds)
          : !intent.start && selection?.stepIndex === intent.stepIndex ? selection.restoreAssemblyView : undefined,
        sceneAnnotations: !intent.start && selection?.stepIndex === intent.stepIndex ? selection.sceneAnnotations : undefined,
        referenceLinks: !intent.start && selection?.stepIndex === intent.stepIndex ? selection.referenceLinks : undefined,
        simulation: chart ? { range: [chart.timeRange[0]!, chart.timeRange[1]!] as const, unit: chart.timeUnit } : undefined,
        supportDisplay: step.view === 'support' ? intent.supportDisplay ?? 'outline' as const : undefined,
        supportEvidence,
        supportComponent: keepSupportComparison ? selection?.supportComponent : undefined,
        supportDetailView: keepSupportComparison ? selection?.supportDetailView : undefined,
        workfaceView: step.key === 'workface' ? intent.workfaceView ?? 'oblique' as const : undefined,
      }
      let focusIssue
      try { if (!intent.supportDisplay) focusConstructionReview(viewerService.require(), nextReview) }
      catch (error) { focusIssue = error instanceof Error ? error.message : String(error) }
      publishConstructionReview(nextReview)
      const supportDisplayNote = nextReview.supportDisplay === 'outline' ? '轮廓对照暂收起已有锚杆组。'
        : nextReview.supportDisplay === 'assembled' ? '已恢复本次对照前的锚杆显示。' : ''
      const detail = intent.supportDisplay ? supportDisplayNote : intent.workfaceView
        ? intent.workfaceView === 'front' ? '已切到岩面正视，便于看纹理。' : '已切到岩面斜视，便于看侧缘和起伏。'
        : `${step.detail}${supportDisplayNote}`
      return JSON.stringify({
        ...assembly, action, ok: true, taskId: status.taskId, targetMileage: review.mileage,
        taskDescription: review.title, step: step.key, sceneChanged: needsAssembly,
        assembledResourceIds: stage.assembledResourceIds,
        summary: `${step.label}｜${detail}${focusIssue ? ` 取景未完成：${focusIssue}` : ''}${intent.kind === 'blast-handoff' && !chart ? ' CO 图表未就绪。' : ''}`,
        ...(chart ? { chartTimeRange: chart.timeRange, chartTimeUnit: chart.timeUnit } : {}),
      })
    },
  },
 {module:'common',tool:{name:'plan_task_visual_review',description:'为当前已完成场景规划视觉分析目标：依据本轮用户原话指定分析目的、实际重点资源和1至3个待回答问题。平台读取本轮场景快照并生成有限候选及完成条件。只更新分析计划显示，不改相机、模型、源数据，不新建任务。source-review没有相机动作。',input_schema:{type:'object',properties:{objective:{type:'string',enum:[...visualObjectives]},focusComponent:{type:'string',description:'可选构件显露，仅component-detail或spatial-relation且重点为一种当前support.test-section资源；先从inspect_task_scene的componentDisplay读取真实component，再原样传入。整体关系时暂避混凝土外壳并保留其他构件，细部时单独显露此组并暂避其他已识别组，恢复精确还原。不猜测未返回的构件。'},emphasis:{type:'string',enum:['source','material-focus'],description:'可选支护重点着色，默认source；暖色仅表示当前重点，不是风险分级。不改地质语义色标。'},referenceScope:{type:'string',enum:['full','near-support'],description:'未指定时保留当前裁剪范围。full在TSP任务恢复原显示范围再整体取景；仅TSP解释体与支护空间关系可选near-support，组合近端剖切和局部取景；不表示全体范围入镜。'},focusResourceIds:{type:'array',minItems:1,items:{type:'string'},description:'仅列本任务重点对象；near-support与material-focus组合只列已装配支护ID，围岩自动保留为参照，不加入重点。'},questions:{type:'array',minItems:1,maxItems:3,items:{type:'string'}}},required:['objective','focusResourceIds','questions']}},executor:async input=>JSON.stringify({ok:true,action:'plan_task_visual_review',taskId:getTaskWorkflowController().getStatus().taskId,review:planTaskVisualReview(input as any)})},
 {module:'common',tool:{name:'apply_task_visual_review',description:'执行当前已校验视觉计划的受控策略；先规划，校验任务未变和对象就绪。每场景最多2次，重新规划/恢复不重置预算。可包含取景、TSP显式full恢复原显示范围、near-support近端剖切及局部取景、material-focus支护暖色显示；不改源几何、体素或色标；仅focusComponent候选调整已声明构件节点显隐并可精确恢复。返回前后实际反馈，不宣称工程验收。',input_schema:{type:'object',properties:{taskId:{type:'string'}},required:['taskId']}},executor:async input=>JSON.stringify({ok:true,action:'apply_task_visual_review',taskId:input.taskId,review:applyTaskVisualReview(String(input.taskId))})},
 {module:'common',tool:{name:'restore_task_visual_review',description:'恢复当前任务第一次视觉分析前的相机、取景目标及已保存的裁剪/支护表达，保留装配对象和无关显示；构件显露候选还原分析前节点显隐。成功后restoredFeedback为恢复时快照，feedback.before/after仅历史；失败不能宣称已恢复，可在故障解除后重试，预算不重置。任务变化拒绝旧计划。',input_schema:{type:'object',properties:{taskId:{type:'string'}},required:['taskId']}},executor:async input=>JSON.stringify({ok:true,action:'restore_task_visual_review',taskId:input.taskId,review:restoreTaskVisualReview(String(input.taskId))})},

  { module:'common', tool:{name:'inspect_task_scene',description:'只读自检当前任务实际场景：任务根资源及依赖的运行状态、当前资产路径、已声明Cesium模型就绪/显隐及26点包围球屏幕取景、观察覆盖不足、任务外加载资源及待核查项。不加载、不复位、不改相机/显隐；非模型对象不猜测就绪。无已完成场景时不使用旧阶段。不能证明深度遮挡、几何贴合或工程验收，不读取设计正文。',input_schema:{type:'object',properties:{}}},executor:async()=>{const status=getTaskWorkflowController().getStatus();return JSON.stringify({ok:true,action:'inspect_task_scene',taskId:status.taskId,scene:inspectTaskScene(status,resourceRegistry,resourceManager.listStates(),viewerService.current)})}},

  {module:'common',tool:{name:'inspect_task_chart_review',description:'只读读取当前任务实际图表的源支路/测点、显示选择、时间单位、显示时间窗口，以及窗口内离散源采样的首末值、极值和差值。没有插值；无源采样时摘要为null，不造零值或阈值穿越时刻。不把一维风网或模拟曲线当作三维CFD、现场实测或安全验收。',input_schema:{type:'object',properties:{}}},executor:async()=>{
    const status=getTaskWorkflowController().getStatus(),ids=status.lastCompletedStage?.assembledResourceIds??[]
    if(status.status!=='completed')throw Error('当前任务尚未完成')
    return JSON.stringify({ok:true,action:'inspect_task_chart_review',taskId:status.taskId,charts:inspectVentilationCharts().filter(c=>ids.includes(c.owner))})
  }},
  {module:'common',tool:{name:'set_task_chart_review',description:'按当前已完成任务图表的实际支路名称和图表时间单位，选择显示序列、缩放时间区间；先读取图表状态，不能猜测支路或秒/分钟。不改源数组、三维模型或相机。',input_schema:{type:'object',properties:{owner:{type:'string'},visibleSeries:{type:'array',items:{type:'string'}},timeRange:{type:'array',items:{type:'number'},minItems:2,maxItems:2}},required:['owner']}},executor:async input=>{
    const status=getTaskWorkflowController().getStatus(),ids=status.lastCompletedStage?.assembledResourceIds??[]
    if(status.status!=='completed'||!ids.includes(input.owner))throw Error('图表不属于当前已完成任务')
    return JSON.stringify({ok:true,action:'set_task_chart_review',taskId:status.taskId,...setVentilationChartReview(input.owner,input)})
  }},
  {module:'common',tool:{name:'inspect_task_volume_review',description:'只读读取当前围岩解释任务的实际渲染采样盒、局部轴长和裁剪范围。采样盒可能含无数据区，不是地质界面、有效体素范围、实测边界或工程验收。不会改相机、体素或色标。',input_schema:{type:'object',properties:{}}},executor:async()=>{
    const status=getTaskWorkflowController().getStatus(),ids=status.lastCompletedStage?.assembledResourceIds??[]
    const id=ids.find(id=>/^rock\.(tsp-|tem-|geophysical-grade)/.test(id))
    const key=id?.replace('rock.','').replaceAll('-','_').replace('tem_resistivity','tem')
    if(status.status!=='completed'||!id||key!==getTaskVolumeKey())throw Error('当前没有对应已完成任务的围岩解释体')
    const domain=getTaskVolumeDomain();if(!domain)throw Error('当前解释体采样范围尚不可读取')
    return JSON.stringify({ok:true,action:'inspect_task_volume_review',taskId:status.taskId,resourceId:id,scope:domain.scope,dimensionsM:domain.dimensionsM,ranges:domain.ranges,corners:domain.corners.map(p=>[p.x,p.y,p.z]),engineeringAcceptance:domain.engineeringAcceptance,depthOcclusion:'not-measured'})
  }},
  {module:'common',tool:{name:'evaluate_task_flow_review',description:'只读评价当前爆破通风任务的屏幕采样、面板覆盖与近似尺度，返回固定阈值、有限候选及停止原因。不测深度遮挡，不作工程验收。',input_schema:{type:'object',properties:{}}},executor:async()=>{
    const status=getTaskWorkflowController().getStatus()
    if(status.status!=='completed')throw Error('当前任务尚未完成')
    return JSON.stringify({ok:true,action:'evaluate_task_flow_review',taskId:status.taskId,evaluation:evaluateTaskFlowReview()})
  }},
  {module:'common',tool:{name:'adjust_task_flow_review',description:'依据真实屏幕反馈执行一次受控取景调整，每个装配任务最多2次。保留当前局部或全段范围，不改变模型/数据/显隐；若条件已满足或无法解决则不修改。返回调整前后反馈与停止原因。',input_schema:{type:'object',properties:{}}},executor:async()=>{
    const status=getTaskWorkflowController().getStatus()
    if(status.status!=='completed')throw Error('当前任务尚未完成')
    return JSON.stringify({ok:true,action:'adjust_task_flow_review',taskId:status.taskId,...adjustTaskFlowReview()})
  }},
  {module:'common',tool:{name:'inspect_task_flow_review',description:'只读获取当前爆破与稳态风场复核的实际表达、局部关联样本数、最多256个CFD样本的屏幕投影入镜及面板覆盖、爆破目标近似像素直径。不会切换、装配或改数据；不测深度遮挡，不代表通风达标。',input_schema:{type:'object',properties:{}}},executor:async()=>{
    const status=getTaskWorkflowController().getStatus()
    if(status.status!=='completed')throw Error('当前任务尚未完成，不能读取最终复核反馈')
    return JSON.stringify({ok:true,action:'inspect_task_flow_review',taskId:status.taskId,feedback:inspectTaskFlowReview()})
  }},
  {module:'common',tool:{name:'set_task_flow_review',description:'切换当前已完成的爆破与稳态风场组合复核表达。focus突出爆后轮廓与附近风向、降低CFD点层干扰并暂停显示流线/粒子；context恢复原风场显示并查看全段。仅显示和相机变化，不重装、不改数据，不代表真实无遮挡或安全验收。',input_schema:{type:'object',properties:{mode:{type:'string',enum:['focus','context']}},required:['mode']}},executor:async input=>{
    const status=getTaskWorkflowController().getStatus(),ids=status.lastCompletedStage?.assembledResourceIds??[]
    if(status.status!=='completed'||!['blast.effect','ventilation.steady-cfd'].every(id=>ids.includes(id)&&resourceManager.getState(id).status==='loaded'))throw Error('当前没有已完成的爆破与稳态风场组合任务')
    return JSON.stringify({ok:true,action:'set_task_flow_review',taskId:status.taskId,...setTaskFlowReview(input.mode)})
  }},
  {module:'common',tool:{name:'inspect_current_support',description:'只读查询当前已完成任务的实际支护类型、长度、构件间距与站位、显隐和来源；不新建任务，不装配或改变模型。',input_schema:{type:'object',properties:{}}},executor:async()=>{
    const status=getTaskWorkflowController().getStatus()
    if(status.status!=='completed'||!status.lastCompletedStage)throw Error('当前没有已完成的支护任务，请先完成装配')
    return JSON.stringify({ok:true,action:'inspect_current_support',taskId:status.taskId,supports:getCurrentSupportReport(status.lastCompletedStage.assembledResourceIds)})
  }},
  supportLayerTool,
  {
    module: 'common',
    tool: { name: 'check_scene_assembly', description: '只读预检明确里程和资源组合的装配兼容性及依赖，不创建任务、不加载或释放资源。通过不代表文件可读或目标实测资料齐全。用于先检查能否同屏，不执行装配的请求。',
      input_schema: { type: 'object', properties: { targetMileage: { type: 'string' }, resourceIds: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'string', enum: [...AGENT_SCENE_RESOURCES] } } }, required: ['targetMileage', 'resourceIds'] } },
    executor: async input => {
      const mileage = resolveAssemblyMileage(input.targetMileage, input.userRequest)
      const resourceIds = agentResourceIds(input.resourceIds)
      validateSelectedPhoto(resourceIds, String(input.userRequest ?? ''))
      if (!resourceIds.length || resourceIds.length > 4) throw new Error('预检需要1–4个资源')
      const controller = getTaskWorkflowController()
      if (!controller.inspectScene) throw new Error('当前页面尚未接入装配预检')
      const preflight = controller.inspectScene({ description: '只读装配预检', targetMileage: mileage, resourceIds,
        supportLengthM: resourceIds.some(isTestSupportId) ? resolveTestSupportLength(String(input.userRequest ?? '')) : undefined,
        assemblyModes: resourceIds.map((_, index) => index ? 'retain' : 'replace'), enhancementModes: resourceIds.map(() => 'auto') })
      return JSON.stringify({ ok: true, action: 'check_scene_assembly', targetMileage: mileage, ...preflight })
    },
  },
  {
    module: 'common',
    tool: { name: 'inspect_scene_capabilities', description: '只读核查当前平台实际注册的资源能力、模块声明范围和加载状态。不装配、不查实测对应、不证明文件可读。用于回答目前支持哪些资料或模型。', input_schema: { type: 'object', properties: {} } },
    executor: async () => {
      const report = readSceneCapabilities()
      if (!report) throw new Error('当前页面尚未接入资源能力核查')
      return JSON.stringify({ ok: true, action: 'inspect_scene_capabilities', ...report })
    },
  },
  {
    module: 'common',
    tool: { name: 'set_task_volume_cut', description: '开启或关闭当前任务TSP坚硬度/完整度解释体的展示剖切。enabled=false恢复该体原始显示范围，true时preset选择structure-window显露近端支护，或geology-section保留原纵向范围并剖开横向一侧供地质参照；不改原始数据、位置或相机，不创建任务。',
      input_schema: { type: 'object', properties: { enabled: { type: 'boolean' },preset:{type:'string',enum:['structure-window','geology-section']} }, required: ['enabled'] } },
    executor: async input => {
      const status = getTaskWorkflowController().getStatus()
      const ids = status.lastCompletedStage?.assembledResourceIds ?? []
      if (status.status !== 'completed' || !ids.some(id => ['rock.tsp-hardness', 'rock.tsp-integrity'].includes(id) && resourceManager.getState(id).status === 'loaded')) throw new Error('当前任务没有可剖切的TSP坚硬度或完整度解释体')
      return JSON.stringify({ ok: true, action: 'set_task_volume_cut', taskId: status.taskId, cut: {...setTaskVolumeCut(input.enabled,input.preset),preset:input.enabled?(input.preset??'structure-window'):'full'} })
    },
  },
  {
    module: 'common',
    tool: { name: 'set_task_view', description: '调整已完成装配任务的取景。中线与地形geographic，整体overview，掌子面face，支护support，三台阶excavation，水平钻drill，爆破断面blast，轴流风机fan。tunnel-side-section在三台阶与后方支护交底场景中开启公共洞壁侧剖，restore-tunnel-section关闭侧剖并还原相机。不加载资源、不改变里程。',
      input_schema: { type: 'object', properties: { view: { type: 'string', enum: [...taskViews, 'tunnel-side-section', 'restore-tunnel-section'] } }, required: ['view'] } },
    executor: async input => {
      const status = getTaskWorkflowController().getStatus()
      const stage = status.lastCompletedStage
      if (status.status !== 'completed' || !stage || !stage.assembledResourceIds.length ||
          stage.assembledResourceIds.some(id => resourceManager.getState(id).status !== 'loaded')) throw new Error('请先完成当前任务场景装配')
      const viewer = viewerService.require()
      let sectionRange
      if (input.view === 'tunnel-side-section') sectionRange = showTaskTunnelSection(viewer, stage.assembledResourceIds, stage.chainageRange.start)
      else if (input.view === 'restore-tunnel-section') {
        if (!clearTaskTunnelSection(viewer, true)) throw Error('当前任务未开启隧道侧剖')
      } else {
        if (!taskViews.includes(input.view)) throw Error('不支持的任务视角')
        focusTaskCamera(viewer, stage.assembledResourceIds, stage.chainageRange.start, input.view as TaskView)
        clearTaskTunnelSection(viewer)
      }
      return JSON.stringify({ ok: true, action: 'set_task_view', taskId: status.taskId, view: input.view, resourceIds: stage.assembledResourceIds, sectionRange })
    },
  },
  {
    module: 'common',
    tool: { name: 'set_blast_layers', description: '调整当前已显示爆破模型的炮孔和爆后点云开关；不创建任务、不加载资源、不改变里程。只保留某层时同时明确另一层为false，未指定的层保持当前状态。没有活动爆破模型时失败。',
      input_schema: { type: 'object', properties: { holes: { type: 'boolean', description: '炮孔是否显示' }, pointcloud: { type: 'boolean', description: '爆后点云是否显示' } } } },
    executor: async input => {
      const action = 'set_blast_layers'
      if ((input.holes === undefined && input.pointcloud === undefined) ||
          ['holes', 'pointcloud'].some(key => input[key] !== undefined && typeof input[key] !== 'boolean')) {
        return JSON.stringify({ ok: false, action, reason: '请明确至少一个图层的显示或隐藏状态，参数必须为布尔值' })
      }
      const model = getBlastModel()
      if (!model?.ready || !model.show) return JSON.stringify({ ok: false, action, reason: '当前没有可操作的爆破模型，请先装配爆破场景或打开爆破专题页' })
      const nodes = { holes: model.getNode('holes'), pointcloud: model.getNode('pointcloud') }
      if (!nodes.holes || !nodes.pointcloud) return JSON.stringify({ ok: false, action, reason: '当前模型缺少独立炮孔或爆后点云节点，未修改图层' })
      for (const key of ['holes', 'pointcloud'] as const) if (input[key] !== undefined) setBlastLayerVisible(key, input[key])
      const status = hasTaskWorkflowController() ? getTaskWorkflowController().getStatus() : undefined
      return JSON.stringify({ ok: true, action,
        taskId: status?.lastCompletedStage?.assembledResourceIds.includes('blast.effect') ? status.taskId : undefined,
        layers: { holes: nodes.holes.show, pointcloud: nodes.pointcloud.show } })
    },
  },
  {
    module: 'common',
    tool: { name: 'retry_scene_load', description: '仅在装配返回recovery提示时，对同一失败任务重试一次临时网络加载；不修改里程、资源或组合。',
      input_schema: { type: 'object', properties: { taskId: { type: 'string' } }, required: ['taskId'] } },
    executor: async input => {
      const controller = getTaskWorkflowController()
      const before = controller.getStatus()
      const ids = before.scenePlans.flatMap(plan => plan.resources)
      if (before.taskId !== input.taskId || !canRetrySceneLoad(before) || ids.some(id => {
        const state = resourceManager.getState(id)
        return state.references > 0 || !['idle', 'failed'].includes(state.status)
      })) throw new Error('当前任务不满足受控加载重试条件')
      let status = await controller.retryFailed()
      if (status.status !== 'failed' && status.status !== 'completed') status = (await dispatchValidatedWorkflow(controller, status)).status
      const chainage = status.lastCompletedStage?.chainageRange.start
      return JSON.stringify({ action: 'retry_scene_load', ok: status.status === 'completed', ...status,
        targetMileage: chainage === undefined ? undefined : chainageService.format(chainage, 'YK'),
        assembledResourceIds: status.lastCompletedStage?.assembledResourceIds ?? [],
        ...(ids.includes('blast.design-data') ? { blastDesign: getBlastDesignSummary() } : {}),
        reason: status.notice?.message })
    },
  },
  {
    module: 'common',
    tool: { name: 'update_test_support', description: '承接当前已完成的测试支护任务，修改用户明确要求的已有支护类型或1～20米整数长度；其余长度、类型及三台阶组合从平台当前任务保留。只在用户明确要求改成/改为等变更时调用，不用于新建任意场景或修改构件几何。', input_schema: { type: 'object', properties: {}, required: [] } },
    executor: async input => {
      const status = getTaskWorkflowController().getStatus()
      const update = resolveTestSupportUpdate(String(input.userRequest ?? ''), status)
      const current = getTestSectionSupportModels(status.lastCompletedStage?.assembledResourceIds)
      const previousLayers=getTaskSupportLayers(status.lastCompletedStage?.assembledResourceIds??[])
      const layout=getTestSectionSupportSummaries(status.lastCompletedStage?.assembledResourceIds)[0]
      if (!layout || layout.lengthM !== update.previousLengthM || !current.length || current.some(model => !model.ready)) throw new Error('当前支护模型不完整或已释放，请重新装配后再调整')
      const assemble = workflowTools.find(item => item.tool.name === 'assemble_scene_at_mileage')!
      const result = JSON.parse(await assemble.executor({ description: `测试支护调整：${update.previousType}→${update.supportType}，${update.previousLengthM}→${update.supportLengthM}米；承接${update.parentTaskId}`, targetMileage: update.targetMileage, resourceIds: update.resourceIds, userRequest: update.request,
        resourceReasons: update.resourceIds.map(resourceId=>({resourceId,reason:'承接当前测试任务，保留未修改的类型/长度及资源组合'})) }))
      let displayContinuity
      if(result.ok){
        if(getTaskWorkflowController().getStatus().taskId!==result.taskId)throw Error('任务已变化，未应用旧显示状态')
        const nextLayers=getTaskSupportLayers(update.resourceIds),plan=planSupportDisplayContinuity(previousLayers,nextLayers)
        for(const change of plan.changes)for(const layer of nextLayers.filter(layer=>layer.component===change.component))setTaskSupportLayer(layer.resourceId,layer.component,change.visible)
        displayContinuity={mode:plan.mode,preservedComponents:plan.changes.map(change=>change.component),layers:getTaskSupportLayers(update.resourceIds)}
      }
      return JSON.stringify({ ...result, action: 'update_test_support', parentTaskId: update.parentTaskId,displayContinuity })
    },
  },
  {
    module: 'common',
    tool: {
      name: 'assemble_scene_at_mileage',
      description: '主界面自主装配的单一入口：给出明确目标里程和要同屏装配的现有模型。平台校验 YK 中线目标与同屏规则，必要时将示例资产沿目标中线示意重定位，再按依赖顺序装配到主 Cesium 场景；返回实际资源与失败原因。无需再调用准备、推进或修订工具。',
      input_schema: {
        type: 'object',
        properties: {
          description: { type: 'string', description: '用户要构建的场景目标' },
          resourceReasons: { type: 'array', description: '逐项说明资源服务于什么任务需求；不得编造目标工段资料', items: { type: 'object', properties: { resourceId: { type: 'string' }, reason: { type: 'string' } }, required: ['resourceId', 'reason'] } },
          targetMileage: { type: 'string', description: '明确的目标里程，优先使用工地真实中线 YK，例如 YK1+346 或 YK2+244；旧 DK 可作为兼容输入，平台统一转换为 YK' },
          resourceIds: { type: 'array', minItems: 1, maxItems: 4,
            items: { type: 'string', enum: [...AGENT_SCENE_RESOURCES] },
            description: '最终同屏资源。公共隧道由平台自动加载，无需列入。稳态通风与支护组合仅在 YK3+900～YK4+100 示意配准工段；支护单断面选 support.modeler-zz-va 等。围岩解释四层互斥。' },
          tunnelId: { type: 'string', description: '当前隧洞 ID，可省略' },
        },
        required: ['description', 'targetMileage', 'resourceIds'],
      },
    },
    executor: async (input) => {
      const requestedMileage = resolveAssemblyMileage(input.targetMileage, input.userRequest === undefined
        ? undefined : String(input.userRequest))
      const targetChainage = chainageService.toCanonicalChainage(requestedMileage)
      const targetMileage = chainageService.format(targetChainage, 'YK')
      const position = chainageService.positionWithHeadingAt(targetChainage)
      if (!position) throw new Error(`目标里程 ${targetMileage} 不在现有 YK 中线数据范围内`)
      const resourceIds = agentResourceIds(input.resourceIds)
      const resourceReasons = resourceIds.map(resourceId => ({ resourceId, reason: Array.isArray(input.resourceReasons)
        ? String(input.resourceReasons.find((item: any) => item?.resourceId === resourceId)?.reason ?? '').trim().slice(0, 300) : '' }))
      validateSelectedPhoto(resourceIds, String(input.userRequest ?? ''))
      validateTestSupportRequest(resourceIds, String(input.userRequest ?? ''))
      const supportLengthM = resourceIds.some(isTestSupportId) ? resolveTestSupportLength(String(input.userRequest ?? '')) : undefined
      for (const item of continuousSupportCatalog.filter(item => resourceIds.includes(item.id))) {
        if (input.userRequest === undefined || !new RegExp(`(?:^|[^0-9.])${item.length}\\s*(?:米|m\\b)`, 'i').test(String(input.userRequest))) throw new Error('连续支护必须由用户明确给出长度，不能默认选用或改成最近长度')
      }
      const timeIssue = thermalRequestIssue(String(input.userRequest ?? ''))
      if (timeIssue) throw new Error(timeIssue)
      const requestedTimes = requestedThermalTimes(String(input.userRequest ?? ''))
      const selectedSlices = thermalSnapshotCatalog.filter(snapshot => resourceIds.includes(snapshot.id))
      if (input.userRequest !== undefined && selectedSlices.length &&
          (!requestedTimes.length || selectedSlices.some(snapshot => !requestedTimes.includes(snapshot.time)))) {
        throw new Error('所选热场时间片与用户指定时间不一致，请明确时间，不能自动取最近值')
      }
      if (resourceIds.length < 1 || resourceIds.length > 4) throw new Error('单次场景装配需要 1–4 个模型资源')
      const controller = getTaskWorkflowController()
      const prepared = await controller.prepareScene({
        description: String(input.userRequest ?? input.description ?? '').trim(), targetMileage, resourceIds,
        supportLengthM,
        enhanceAfterAssembly: true,
        assemblyModes: resourceIds.map((_, index) => index === 0 ? 'replace' : 'retain'),
        enhancementModes: resourceIds.map(() => 'auto'),
        tunnelId: input.tunnelId === undefined ? undefined : String(input.tunnelId),
      })
      if (!prepared.prepared || prepared.notice?.type === 'error') {
        return JSON.stringify({ action: 'assemble_scene_at_mileage', ok: false, targetMileage, requestedMileage,
          reason: prepared.notice?.message ?? '场景装配未通过校验', ...prepared })
      }
      const viewer = viewerService.require()
      focusTunnelSegmentAt(targetChainage, viewer)
      const focusTarget = (assembled = false) => {
        const drills = assembled && resourceIds.includes('rock.advance-drill') ? getActiveDrillModels() : []
        if (drills.length && drills.every(model => model.ready)) {
          setTunnelTranslucent(true, viewer)
          viewer.camera.viewBoundingSphere(Cesium.BoundingSphere.fromBoundingSpheres(drills.map(model => model.boundingSphere)),
            new Cesium.HeadingPitchRange(position.heading + 1.8, -0.3, 65))
          viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
          viewer.scene.requestRender()
          return
        }
        const face = assembled && resourceIds.some(isFacePhotoResource) ? getActiveFaceSlices().find(slice => slice.show) : undefined
        const faceCenter = face?.position?.getValue(Cesium.JulianDate.now())
        if (faceCenter) {
          viewer.camera.viewBoundingSphere(new Cesium.BoundingSphere(faceCenter, 5), new Cesium.HeadingPitchRange(position.heading + Math.PI, -0.1, 24))
          viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
          viewer.scene.requestRender()
          return
        }
        const blast = assembled && resourceIds.includes('blast.effect') ? getBlastModel() as Cesium.Model | undefined : undefined
        const blastOffset = blast?.ready ? blastViewOffset('persp') : undefined
        if (blast && blastOffset) {
          setTunnelTranslucent(true, viewer)
          viewer.camera.viewBoundingSphere(blast.boundingSphere, blastOffset)
          viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
          viewer.scene.requestRender()
          return
        }
        const support = assembled && resourceIds
          .map(id => id === ALTERNATING_SUPPORT_ID ? getActiveAlternatingSupportModel() : getActiveModelerSupportModel(id))
          .find((model): model is Cesium.Model => !!model?.ready)
        if (support) {
          viewer.camera.viewBoundingSphere(support.boundingSphere,
            new Cesium.HeadingPitchRange(position.heading + 0.4, -0.28,
              resourceIds.includes(ALTERNATING_SUPPORT_ID) ? 85 : 42))
          viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
          viewer.camera.moveRight(10)
          viewer.scene.requestRender()
          return
        }
        const target = Cesium.Cartesian3.fromDegrees(position.longitude, position.latitude, position.height)
        viewer.camera.lookAt(target, new Cesium.HeadingPitchRange(position.heading, -0.7, 270))
        viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
        // The chat occupies the right rail, so center the target in the visible 3D area.
        viewer.camera.moveRight(75)
        viewer.scene.requestRender()
      }
      focusTarget()
      const outcome = await dispatchValidatedWorkflow(controller, prepared)
      if (outcome.ok) {
        focusTunnelSegmentAt(targetChainage, viewer)
      }
      else clearFocusedTunnelSegment(viewer)
      return JSON.stringify({ action: 'assemble_scene_at_mileage', targetMileage, requestedMileage,
        resourceReasons,
        ...(!outcome.ok && canRetrySceneLoad(outcome.status) && resourceIds.every(id => {
          const state = resourceManager.getState(id)
          return state.references === 0 && ['idle', 'failed'].includes(state.status)
        }) ? { recovery: { kind: 'retry-scene-load', taskId: outcome.status.taskId } } : {}),
        assembledResourceIds: outcome.status.lastCompletedStage?.assembledResourceIds ?? [],
        supportLengthM: outcome.status.lastCompletedStage?.supportLengthM,
        ...(outcome.ok && resourceIds.includes('blast.design-data') ? { blastDesign: getBlastDesignSummary() } : {}),
        ...outcome, ...outcome.status,
        ...(outcome.ok && resourceIds.includes(ALTERNATING_SUPPORT_ID)
          ? { supportSpan: getActiveAlternatingSupportSpan() } : {}) })
    },
  },
  {
    module: 'common',
    tool: {
      name: 'prepare_platform_task',
      description: '自主调度第一步：根据任务目标选择质量检查或场景资产序列，交给平台做结构与业务规则校验。返回 taskId/currentStepId；不执行。校验成功后由你根据每次执行反馈逐步调用 advance_platform_task。',
      input_schema: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['quality-check', 'scene-exploration'] },
          description: { type: 'string' },
          start: { type: 'number' }, end: { type: 'number' },
          resourceIds: { type: 'array', minItems: 1, maxItems: 8,
            items: { type: 'string', enum: [...AGENT_SCENE_RESOURCES] },
            description: '按目标顺序选择阶段资源。支护组合默认 support.modeler-zz-va；指定其他 ZZ 类型选对应 support.modeler-zz-*。' },
          enhancementModes: enhancementModesSchema,
          assemblyModes: assemblyModesSchema,
          tunnelId: { type: 'string' }, maxLoadMb: { type: 'number' },
        },
        required: ['kind', 'description'],
      },
    },
    executor: async (input) => {
      const controller = getTaskWorkflowController()
      const status = input.kind === 'quality-check'
        ? await controller.prepare(normalizeAgentTaskInput(input))
        : input.kind === 'scene-exploration'
          ? await controller.prepareScene({
            description: String(input.description ?? '').trim(),
            resourceIds: agentResourceIds(input.resourceIds),
            enhancementModes: readEnhancementModes(input),
            assemblyModes: readAssemblyModes(input),
            tunnelId: input.tunnelId === undefined ? undefined : String(input.tunnelId),
            maxLoadMb: input.maxLoadMb === undefined ? undefined : Number(input.maxLoadMb),
          })
          : (() => { throw new Error('不支持的任务类型') })()
      return JSON.stringify({ action: 'prepare_platform_task', ok: status.prepared && status.notice?.type !== 'error', ...status })
    },
  },
  {
    module: 'common',
    tool: {
      name: 'advance_platform_task',
      description: '自主调度下一步：在观察上次状态后，只执行当前已校验计划中的一个步骤。必须传回平台刚返回的 taskId 和 currentStepId；失败或任务被替换则停止，不得盲目重试。',
      input_schema: {
        type: 'object',
        properties: { taskId: { type: 'string' }, currentStepId: { type: 'string' } },
        required: ['taskId', 'currentStepId'],
      },
    },
    executor: async (input) => {
      const outcome = await advancePlatformTask(getTaskWorkflowController(), String(input.taskId ?? ''), String(input.currentStepId ?? input.stepId ?? ''))
      return JSON.stringify({ action: 'advance_platform_task', ...outcome, ...outcome.status })
    },
  },
  {
    module: 'common',
    tool: {
      name: 'revise_next_scene_assembly',
      description: '观察已完成阶段的实际装配结果后，可在执行当前待处理步骤前重新选择保留上一场景还是切换资源。平台重新校验当前及后续场景计划，不执行步骤；失败时原计划不变。只用于 scene-exploration 任务。',
      input_schema: {
        type: 'object',
        properties: {
          taskId: { type: 'string' }, currentStepId: { type: 'string' },
          mode: { type: 'string', enum: [...SCENE_ASSEMBLY_MODES] },
        },
        required: ['taskId', 'currentStepId', 'mode'],
      },
    },
    executor: async (input) => {
      const status = await getTaskWorkflowController().reviseSceneAssembly({
        taskId: String(input.taskId ?? ''),
        stepId: String(input.currentStepId ?? ''),
        mode: String(input.mode ?? ''),
      })
      return result('revise_next_scene_assembly', status)
    },
  },
  {
    module: 'common',
    tool: {
      name: 'orchestrate_platform_task',
      description: '目标驱动自主调度：选择质量检查或现有资产场景展示，生成受控计划，逐步执行并观察每步状态；失败立即停止，返回调度轨迹。仅用于用户要求完成任务的情况，查询或只要计划时不要调用。当前不包含装备调度。',
      input_schema: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['quality-check', 'scene-exploration'], description: '质量检查或按阶段展示现有场景资产' },
          description: { type: 'string', description: '用户完整任务目标' },
          start: { type: 'number', description: '质量检查起点 YK 绝对米数；YK1+346 应填 1346' },
          end: { type: 'number', description: '质量检查终点 YK 绝对米数；YK1+356 应填 1356' },
          resourceIds: { type: 'array', minItems: 1, maxItems: 8,
            items: { type: 'string', enum: [...AGENT_SCENE_RESOURCES] },
            description: '场景任务按目标选择资源顺序。支护组合默认 support.modeler-zz-va；指定其他 ZZ 类型选对应 support.modeler-zz-*。' },
          enhancementModes: enhancementModesSchema,
          assemblyModes: assemblyModesSchema,
          tunnelId: { type: 'string', description: '当前隧洞 ID，可省略' },
          maxLoadMb: { type: 'number', description: '每阶段加载预算，默认 1400MB' },
        },
        required: ['kind', 'description'],
      },
    },
    executor: async (input) => {
      const description = String(input.description ?? '').trim()
      const controller = getTaskWorkflowController()
      const outcome = input.kind === 'quality-check'
        ? await orchestratePlatformTask(controller, { kind: 'quality-check', input: normalizeAgentTaskInput(input) })
        : input.kind === 'scene-exploration'
          ? await orchestratePlatformTask(controller, { kind: 'scene-exploration', input: {
            description,
            resourceIds: agentResourceIds(input.resourceIds),
            enhancementModes: readEnhancementModes(input),
            assemblyModes: readAssemblyModes(input),
            tunnelId: input.tunnelId === undefined ? undefined : String(input.tunnelId),
            maxLoadMb: input.maxLoadMb === undefined ? undefined : Number(input.maxLoadMb),
          } })
          : (() => { throw new Error('不支持的任务类型') })()
      return JSON.stringify({ action: 'orchestrate_platform_task', ...outcome, ...outcome.status })
    },
  },
  {
    module: 'common',
    tool: {
      name: 'compose_scene_workflow',
      description: '利用现有资产按 YK 里程编排场景。围岩可选设计分级、物探融合等级、TSP 坚硬度/完整度、TEM 视电阻率；物探层源锚点 YK2+244，可沿目标中线示意重定位。支护组合默认用新模块已导出的 support.modeler-zz-va。仅生成计划，不执行，不作工程结论。',
      input_schema: {
        type: 'object',
        properties: {
          description: { type: 'string', description: '用户要探索或展示的目标' },
          resourceIds: {
            type: 'array', minItems: 1, maxItems: 8,
            items: { type: 'string', enum: [...AGENT_SCENE_RESOURCES] },
            description: '按执行顺序列出阶段资源；允许重复资源以便返回场景。隧道模型由依赖自动加载',
          },
          enhancementModes: enhancementModesSchema,
          assemblyModes: assemblyModesSchema,
          tunnelId: { type: 'string', description: '当前隧洞 ID，可省略' },
          maxLoadMb: { type: 'number', description: '单阶段加载预算，默认 1400MB' },
        },
        required: ['description', 'resourceIds'],
      },
    },
    executor: async (input) => {
      const status = await getTaskWorkflowController().prepareScene({
        description: String(input.description ?? '').trim(),
        resourceIds: agentResourceIds(input.resourceIds),
        enhancementModes: readEnhancementModes(input),
        assemblyModes: readAssemblyModes(input),
        tunnelId: input.tunnelId === undefined ? undefined : String(input.tunnelId),
        maxLoadMb: input.maxLoadMb === undefined ? undefined : Number(input.maxLoadMb),
      })
      return result('compose_scene_workflow', status)
    },
  },
  {
    module: 'common',
    tool: {
      name: 'create_task',
      description: '根据自然语言任务创建并校验平台 TaskContext；第一版会同时生成确定性的初始 WorkflowPlan 和 ScenePlan，并打开任务确认面板。当前支持初期支护质量检查任务。',
      input_schema: {
        type: 'object',
        properties: {
          description: { type: 'string', description: '完整施工任务描述' },
          tunnelId: { type: 'string', description: '隧洞 ID；不确定时可省略并使用当前隧洞' },
          start: { type: 'number', description: '起点 YK 绝对米数；YK1+346 填 1346' },
          end: { type: 'number', description: '终点 YK 绝对米数；YK1+356 填 1356' },
          maxLoadMb: { type: 'number', description: '场景资源加载预算，默认 1400MB' },
        },
        required: ['description', 'start', 'end'],
      },
    },
    executor: async (input) => {
      const status = await getTaskWorkflowController().prepare(normalizeAgentTaskInput(input))
      return result('create_task', status)
    },
  },
  {
    module: 'common',
    tool: {
      name: 'create_workflow',
      description: '读取 create_task 已生成并通过校验的 WorkflowPlan 与 ScenePlan，返回步骤、依赖和资源计划；不执行步骤。',
      input_schema: { type: 'object', properties: {}, required: [] },
    },
    executor: async () => {
      const status = getTaskWorkflowController().getStatus()
      if (!status.prepared) throw new Error('请先调用 create_task 创建任务')
      return result('create_workflow', status)
    },
  },
  {
    module: 'common',
    tool: {
      name: 'execute_task_step',
      description: '执行当前任务工作流的下一步；场景资源、增强策略和业务动作按事务执行，失败时自动回滚。',
      input_schema: { type: 'object', properties: {}, required: [] },
    },
    executor: async () => {
      return result('execute_task_step', await getTaskWorkflowController().executeNext())
    },
  },
  {
    module: 'common',
    tool: {
      name: 'continue_workflow',
      description: '从当前步骤继续执行任务工作流，直至完成或首个失败步骤。',
      input_schema: { type: 'object', properties: {}, required: [] },
    },
    executor: async () => {
      return result('continue_workflow', await getTaskWorkflowController().runAll())
    },
  },
  {
    module: 'common',
    tool: {
      name: 'get_task_status',
      description: '读取当前任务的步骤状态、进度、场景资源计划和共享上下文字段，不改变场景。',
      input_schema: { type: 'object', properties: {}, required: [] },
    },
    executor: async () => result('get_task_status', getTaskWorkflowController().getStatus()),
  },
  {
    module: 'common',
    tool: {
      name: 'retry_task_step',
      description: '清理并重试当前失败步骤；仅在任务状态为失败时调用。',
      input_schema: { type: 'object', properties: {}, required: [] },
    },
    executor: async () => {
      return result('retry_task_step', await getTaskWorkflowController().retryFailed())
    },
  },
  {
    module: 'common',
    tool: {
      name: 'reset_task_scene',
      description: '复位当前任务，逆序撤销增强和业务副作用，释放任务资源并保留应用级公共场景。',
      input_schema: { type: 'object', properties: {}, required: [] },
    },
    executor: async () => {
      return result('reset_task_scene', await getTaskWorkflowController().reset())
    },
  },
]
