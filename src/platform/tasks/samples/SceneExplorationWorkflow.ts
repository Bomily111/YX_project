import * as Cesium from 'cesium'
import { validateTaskContext, type TaskContext } from '@/platform/context/TaskContext'
import type { SceneResource } from '@/platform/resources/types'
import { ResourceRegistry } from '@/platform/resources/ResourceRegistry'
import { ResourceSelector } from '@/platform/selection/ResourceSelector'
import type { ScenePlan } from '@/platform/selection/ScenePlan'
import { withScenePlan, type ScenePlanWorkflowOptions } from '@/platform/selection/ScenePlanWorkflow'
import type { EnhancementPlannerOptions } from '@/platform/enhancement/EnhancementPlanner'
import { WorkflowExecutor } from '../WorkflowExecutor'
import type { TaskStep, WorkflowPlan } from '../TaskStep'
import { blastViewOffset, getBlastModel } from '@/views/tunnel-module/blast'
import { setTunnelTranslucent, focusTunnelSegmentAt, waitForTunnelGlbSegment } from '@/utils/Common/DrawLine'
import { ventilationPositionToWorld, ventilationVectorToWorld } from '@/views/ventilation-module/spatialFrame'
import { modelerSupportCatalog } from '@/modules/support/modeler-resources'
import { continuousSupportCatalog, planContinuousSupport } from '@/modules/support/continuous-layout'
import { ALTERNATING_SUPPORT_ID } from '@/modules/support/alternating-resource'
import { transientScenarioCatalog } from '@/modules/ventilation/transient-catalog'
import { thermalSnapshotCatalog } from '@/modules/ventilation/thermal-catalog'
import { presentTaskScene, taskPresentationProfile } from '../TaskScenePresentation'
import { faceSourceDescription } from '@/modules/face-sketch/resources'
import { THREE_BENCH_ID, validateThreeBenchChainage, threeBenchDescription } from '@/modules/rock/three-bench-resource'
import { isTestSupportId, testSupportCatalog } from '@/modules/support/test-section-resource'

/** 只允许现有四类可展示资产进入智能体的场景编排，不能把任意路径当作资源加载。 */
export const SCENE_EXPLORATION_RESOURCES = [
  'rock.design-grade', 'rock.geophysical-grade', 'rock.tsp-hardness',
  'rock.tsp-integrity', 'rock.tsp-vp', 'rock.tsp-vs', 'rock.tsp-ratio',
  'rock.tsp-anomaly', 'rock.tem-resistivity', 'rock.tem-water',
  'support.scene', 'blast.effect', 'blast.design-data',
  'rock.face-photos',
  THREE_BENCH_ID,
  ...testSupportCatalog.map(asset => asset.id),
  'rock.gpr-line1', 'rock.gpr-line2',
  'rock.advance-drill',
  'ventilation.steady-cfd', 'ventilation.transient-network', 'ventilation.thermal-field',
  'ventilation.co-analysis',
  ...transientScenarioCatalog.map(scenario => scenario.id),
  ...thermalSnapshotCatalog.map(snapshot => snapshot.id),
  ...modelerSupportCatalog.map(asset => asset.id),
  ...continuousSupportCatalog.map(asset => asset.id),
  ALTERNATING_SUPPORT_ID,
] as const

export type SceneExplorationResourceId = typeof SCENE_EXPLORATION_RESOURCES[number]
/** Exclude the old internal steel-arch experiment from public agent routes. */
export const AGENT_SCENE_RESOURCES = SCENE_EXPLORATION_RESOURCES.filter(id => id !== 'support.scene')

export const SCENE_ENHANCEMENT_MODES = ['auto', 'emphasis', 'context'] as const
export type SceneEnhancementMode = typeof SCENE_ENHANCEMENT_MODES[number]
export const SCENE_ASSEMBLY_MODES = ['auto', 'retain', 'replace'] as const
export type SceneAssemblyMode = typeof SCENE_ASSEMBLY_MODES[number]

export function validateAssemblyModes(modes: readonly string[] | undefined, stageCount: number): SceneAssemblyMode[] {
  if (modes === undefined) return Array.from({ length: stageCount }, () => 'auto')
  if (modes.length !== stageCount) throw new Error('装配方式须与场景阶段逐一对应')
  return modes.map((mode, index) => {
    if (!SCENE_ASSEMBLY_MODES.includes(mode as SceneAssemblyMode)) {
      throw new Error(`阶段 ${index + 1} 的装配方式不受支持：${mode}`)
    }
    if (index === 0 && mode === 'retain') throw new Error('首阶段没有可保留的场景资源')
    return mode as SceneAssemblyMode
  })
}

export function validateEnhancementModes(modes: readonly string[] | undefined, stageCount: number): SceneEnhancementMode[] {
  if (modes === undefined) return Array.from({ length: stageCount }, () => 'auto')
  if (modes.length !== stageCount) throw new Error('增强方式须与场景阶段逐一对应')
  return modes.map((mode, index) => {
    if (!SCENE_ENHANCEMENT_MODES.includes(mode as SceneEnhancementMode)) {
      throw new Error(`阶段 ${index + 1} 的增强方式不受支持：${mode}`)
    }
    return mode as SceneEnhancementMode
  })
}

export function enhancementOptionsForMode(mode: SceneEnhancementMode): EnhancementPlannerOptions {
  if (mode === 'emphasis') return {
    focusColor: { red: 1, green: 0.28, blue: 0.05, alpha: 1 },
    focusOutlineWidth: 5,
    referenceOpacity: 0.18,
  }
  if (mode === 'context') return { highlightFocus: false, referenceOpacity: 0.7 }
  return {}
}

export function validateSceneSequence(ids: readonly string[], registry: ResourceRegistry): SceneResource[] {
  if (ids.length < 1 || ids.length > 8) throw new Error('场景序列需要 1–8 个阶段')
  const allowed = new Set<string>(SCENE_EXPLORATION_RESOURCES)
  return ids.map((id) => {
    if (!allowed.has(id)) throw new Error(`不支持的动态场景资源：${id}`)
    const resource = registry.require(id)
    if (!resource.chainageRange) throw new Error(`资源缺少里程范围：${id}`)
    return resource
  })
}

export function sceneStageTask(task: TaskContext, resource: SceneResource, requestedChainage?: number): TaskContext {
  // Task and registered resource ranges are always in the surveyed YK frame.
  const focusChainage = requestedChainage ?? (resource.module === 'ventilation' ? 1346
      : resource.module === 'rock' && resource.id !== 'rock.design-grade' ? 2244
        : 1346)
  const chainageRange = resource.chainageRange!
  const demoRelocatable = resource.module === 'rock' && resource.id !== 'rock.design-grade'
  if (requestedChainage !== undefined && !demoRelocatable && (requestedChainage < chainageRange.start || requestedChainage > chainageRange.end)) {
    throw new Error(`目标里程不在 ${resource.id} 的资产覆盖范围 ${chainageRange.start}–${chainageRange.end} 内`)
  }
  const focus = demoRelocatable || focusChainage >= chainageRange.start && focusChainage <= chainageRange.end
    ? focusChainage : chainageRange.start
  return {
    ...task,
    chainageRange: { start: focus, end: focus },
    targetTypes: [resource.module],
    process: undefined,
    targetState: undefined,
  }
}

/** Demo assembly permits one interpreted rock layer with the reanchored structure-tree support layout. */
function compatibleAssembly(ids: readonly string[]): boolean {
  if (ids.includes(THREE_BENCH_ID) || ids.some(isTestSupportId)) return new Set(ids).size === ids.length && ids.filter(isTestSupportId).length <= 1 && ids.every(id => id === THREE_BENCH_ID || isTestSupportId(id))
  if (ids.includes('rock.face-photos')) {
    const others = ids.filter(id => id !== 'rock.face-photos')
    return new Set(ids).size === ids.length && (others.length <= 1 || compatibleAssembly(others))
  }
  if (ids.includes('blast.design-data')) {
    const remaining = ids.filter(id => id !== 'blast.design-data')
    return new Set(ids).size === ids.length && (remaining.length === 0 ||
      remaining.every(id => id === 'blast.effect' || id === 'ventilation.steady-cfd'))
  }
  const unique = new Set(ids)
  if (unique.size !== ids.length) return false
  const support = ids.filter(id => id.startsWith('support.modeler-') || id === ALTERNATING_SUPPORT_ID)
  if (ids.includes('blast.effect') && ids.includes('ventilation.steady-cfd')) {
    return ids.length === 2
  }
  if (support.length > 0) {
    const ventilation = ids.filter(id => id === 'ventilation.steady-cfd')
    if (ventilation.length > 0) {
      return support.length === 1 && support[0].startsWith('support.modeler-')
        && ventilation.length === 1 && ids.length === 2
    }
    return support.length === 1
      && ids.filter(id => id.startsWith('rock.')).length <= 1
      && ids.every(id => id.startsWith('rock.') || id === support[0])
  }
  const worksite = new Set(['rock.design-grade', 'support.scene', 'blast.effect'])
  return ids.every(id => worksite.has(id))
}

export function resolveAssemblyStages(
  resources: readonly SceneResource[], modes: readonly SceneAssemblyMode[],
): SceneResource[][] {
  const stages: SceneResource[][] = []
  for (const [index, current] of resources.entries()) {
    const previous = stages[index - 1] ?? []
    const autoRetain = modes[index] === 'auto' && (
      (isTestSupportId(current.id) && resources[index - 1]?.id === THREE_BENCH_ID) || (current.id === THREE_BENCH_ID && isTestSupportId(resources[index - 1]?.id ?? '')) ||
      (current.id.startsWith('support.modeler-') || current.id === ALTERNATING_SUPPORT_ID) && resources[index - 1]?.id.startsWith('rock.')
      || current.id === 'support.scene' && resources[index - 1]?.id === 'rock.design-grade'
    )
    const retain = modes[index] === 'retain' || autoRetain
    if (retain && previous.some(item => item.id === current.id)) {
      throw new Error(`阶段 ${index + 1} 已包含资源 ${current.id}，不能重复装配`)
    }
    const selected = retain ? [...previous, current] : [current]
    if (retain && !compatibleAssembly(selected.map(item => item.id))) {
      throw new Error(`阶段 ${index + 1} 的资源不允许同屏装配：${selected.map(item => item.id).join('、')}`)
    }
    stages.push(selected)
  }
  return stages
}

function stageResources(stages: readonly SceneResource[][], index: number): SceneResource[] {
  return stages[index]
}

function stageTask(task: TaskContext, resources: readonly SceneResource[], stages: readonly SceneResource[][], index: number, targetChainage?: number): TaskContext {
  const current = resources[index]
  const base = sceneStageTask(task, current, targetChainage)
  const selected = stageResources(stages, index)
  return selected.length > 1 ? { ...base, targetTypes: selected.map((resource) => resource.module) } : base
}

export async function waitForModelReady(
  model: Pick<Cesium.Model, 'ready' | 'readyEvent'>,
  requestRender: () => void,
  timeoutMs = 30000,
): Promise<void> {
  if (model.ready) return
  await new Promise<void>((resolve, reject) => {
    let removeReady: (() => void) | undefined
    // Demand-rendered scenes need another frame after asynchronous GPU uploads.
    const frames = setInterval(requestRender, 100)
    const timer = setTimeout(() => {
      clearInterval(frames)
      removeReady?.()
      reject(new Error('模型首帧就绪超时'))
    }, timeoutMs)
    removeReady = model.readyEvent.addEventListener(() => {
      clearTimeout(timer)
      clearInterval(frames)
      removeReady?.()
      resolve()
    })
    requestRender()
  })
}

/** Entity geometry/material updates can finish after GLB readiness in demand-render mode. */
export async function waitForSceneEntitiesReady(viewer: Cesium.Viewer, timeoutMs = 30000): Promise<void> {
  if (!viewer.dataSourceDisplay || !viewer.scene?.postRender) return
  await new Promise<void>((resolve, reject) => {
    let readyFrames = 0
    const frames = setInterval(() => viewer.scene.requestRender(), 100)
    const cleanup = () => { clearInterval(frames); clearTimeout(timer); remove() }
    const timer = setTimeout(() => { cleanup(); reject(new Error('任务实体首帧就绪超时')) }, timeoutMs)
    const remove = viewer.scene.postRender.addEventListener(() => {
      // The first ready frame can still use Cesium's white placeholder texture.
      // Keep rendering through the material upload and its following draw.
      readyFrames = viewer.dataSourceDisplay.ready ? readyFrames + 1 : 0
      if (readyFrames >= 3) { cleanup(); resolve() }
    })
    viewer.scene.requestRender()
  })
}

async function waitForBlastModel(viewer: Cesium.Viewer): Promise<Cesium.Model> {
  const model = getBlastModel() as Cesium.Model | undefined
  if (!model) throw new Error('爆破模型未加载')
  await waitForModelReady(model, () => viewer.scene.requestRender())
  return model
}

/** 工作流通风阶段的镜头以示意配准后的右主洞中线为焦点。 */
export function ventilationWorkpointView(): {
  target: Cesium.Cartesian3
  destination: Cesium.Cartesian3
  direction: Cesium.Cartesian3
  up: Cesium.Cartesian3
} {
  const target = ventilationPositionToWorld(new Cesium.Cartesian3(0, 3.764577, 3905.151001))
  const offset = ventilationVectorToWorld(new Cesium.Cartesian3(-105, 62, 138))
  const destination = Cesium.Cartesian3.add(target, offset, new Cesium.Cartesian3())
  const direction = Cesium.Cartesian3.normalize(
    Cesium.Cartesian3.subtract(target, destination, new Cesium.Cartesian3()),
    new Cesium.Cartesian3(),
  )
  const up = ventilationVectorToWorld(new Cesium.Cartesian3(0, 1, 0))
  return { target, destination, direction, up }
}

async function focusScene(resource: SceneResource, viewer: Cesium.Viewer, retainedSupport?: SceneResource): Promise<(() => void) | undefined> {
  if (!viewer?.camera || viewer.isDestroyed?.()) return undefined
  const camera = viewer.camera
  const before = {
    destination: Cesium.Cartesian3.clone(camera.positionWC),
    direction: Cesium.Cartesian3.clone(camera.directionWC),
    up: Cesium.Cartesian3.clone(camera.upWC),
  }
  const supportModel = (isTestSupportId(resource.id) || resource.id === THREE_BENCH_ID || resource.id.startsWith('support.modeler-') || resource.id === ALTERNATING_SUPPORT_ID ? resource : retainedSupport)
    ?.getEnhanceTargets?.()[0]?.object as Cesium.Model | undefined
  if (supportModel) {
    await waitForModelReady(supportModel, () => viewer.scene.requestRender())
    camera.viewBoundingSphere(supportModel.boundingSphere, new Cesium.HeadingPitchRange(0, -0.25,
      resource.id === ALTERNATING_SUPPORT_ID ? 85 : 42))
    camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
  } else if (resource.module === 'ventilation') {
    const { destination, direction, up } = ventilationWorkpointView()
    camera.setView({ destination, orientation: { direction, up } })
  } else if (resource.id === 'blast.effect') {
    const model = await waitForBlastModel(viewer)
    const offset = blastViewOffset('persp')
    if (!offset) throw new Error('爆破点云视角不可用')
    setTunnelTranslucent(true, viewer)
    camera.viewBoundingSphere(model.boundingSphere, offset)
    camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
  } else if (resource.id === 'support.scene') {
    const model = resource.getEnhanceTargets?.().find((target) => target.id === 'support.reference-tunnel')?.object
    if (model && 'boundingSphere' in model && model.boundingSphere) {
      camera.viewBoundingSphere(model.boundingSphere as Cesium.BoundingSphere, new Cesium.HeadingPitchRange(0, -0.3, 130))
      camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
    }
  }
  viewer.scene.requestRender()
  return () => {
    if (viewer.isDestroyed()) return
    if (resource.id === 'blast.effect') setTunnelTranslucent(false, viewer)
    camera.setView({ destination: before.destination, orientation: { direction: before.direction, up: before.up } })
    viewer.scene.requestRender()
  }
}

export function createSceneExplorationExecutor(
  task: TaskContext,
  resourceIds: readonly string[],
  registry: ResourceRegistry,
  options: Omit<ScenePlanWorkflowOptions, 'selectorOptions' | 'sceneTask'> & {
    enhancementModes?: readonly string[]
    assemblyModes?: readonly string[]
    targetChainage?: number
    enhanceAfterAssembly?: boolean
  },
): {
  executor: WorkflowExecutor
  scenePlans: ScenePlan[]
  reviseNextAssembly: (stepId: string, mode: SceneAssemblyMode) => ScenePlan[]
} {
  if (task.taskType !== 'scene-exploration') throw new Error('场景编排只接受 scene-exploration 任务')
  const validation = validateTaskContext(task)
  if (!validation.valid) throw new Error(`场景任务参数无效：${validation.issues.map((item) => item.message).join('；')}`)
  const resources = validateSceneSequence(resourceIds, registry)
  if (options.targetChainage !== undefined) resources.forEach(resource => sceneStageTask(task, resource, options.targetChainage))
  const enhancementModes = validateEnhancementModes(options.enhancementModes, resources.length)
  const assemblyModes = validateAssemblyModes(options.assemblyModes, resources.length)
  let assemblyStages = resolveAssemblyStages(resources, assemblyModes)
  const selector = new ResourceSelector(registry)
  const stepName = (stages: readonly SceneResource[][], index: number): string => (
    stages[index].length > 1
      ? `同屏装配 ${stages[index].map(item => item.id).join(' + ')}`
      : `展示 ${resources[index].module} · ${resources[index].id}`
  )
  const steps: TaskStep[] = resources.map((resource, index) => ({
    stepId: `scene-${index + 1}`,
    name: stepName(assemblyStages, index),
    module: resource.module as TaskStep['module'],
    dependsOn: index === 0 ? [] : [`scene-${index}`],
    inputKeys: index === 0 ? ['task.description'] : [`scene.stage.${index}`],
    outputKeys: [`scene.stage.${index + 1}`],
    action: 'scene.show-resource',
    completionRule: { requiredOutputs: [`scene.stage.${index + 1}`] },
    status: 'pending',
  }))
  const plan: WorkflowPlan = { taskId: task.taskId, steps, sharedContext: {} }
  const finalize = options.enhanceAfterAssembly && !!options.enhancement
  if (finalize) steps.push({ stepId: `scene-${resources.length + 1}`, name: '构建完成后统一增强',
    module: resources[resources.length - 1].module as TaskStep['module'],
    dependsOn: [`scene-${resources.length}`], inputKeys: [`scene.stage.${resources.length}`],
    outputKeys: [`scene.stage.${resources.length + 1}`], action: 'scene.finalize',
    completionRule: { requiredOutputs: [`scene.stage.${resources.length + 1}`] }, status: 'pending' })
  const buildScenePlans = (stages: readonly SceneResource[][]): ScenePlan[] => {
    const planned: ScenePlan[] = []
    for (const [index, step] of steps.slice(0, resources.length).entries()) {
      const selected = stageResources(stages, index)
      const scenePlan = selector.createScenePlan(stageTask(task, resources, stages, index, options.targetChainage), step, {
        candidateResourceIds: selected.map((item) => item.id),
        previousPlan: index > 0 ? planned[index - 1] : undefined,
        loadedResourceIds: index > 0 ? new Set(planned[index - 1].loadOrder) : undefined,
      })
      for (const selectedResource of selected) {
        if (!scenePlan.rootResourceIds.includes(selectedResource.id)) {
          const action = selectedResource.id === resources[index].id ? '加载' : '保留'
          throw new Error(`阶段 ${index + 1} 无法${action} ${selectedResource.id}：${scenePlan.warnings.join('；')}`)
        }
      }
      planned.push(scenePlan)
    }
    if (finalize) planned.push({ ...planned[planned.length - 1], stepId: steps[steps.length - 1].stepId })
    return planned
  }
  for (const resource of resources) {
    if (resource.id === THREE_BENCH_ID || isTestSupportId(resource.id)) validateThreeBenchChainage(options.targetChainage ?? task.chainageRange.start)
    const continuous = continuousSupportCatalog.find(item => item.id === resource.id)
    if (continuous) planContinuousSupport(options.targetChainage ?? task.chainageRange.start, continuous.length)
  }
  const scenePlans = buildScenePlans(assemblyStages)
  const resolve = (_action: string, step: TaskStep) => {
    const index = steps.findIndex((item) => item.stepId === step.stepId)
    if (index < 0) return undefined
    if (finalize && index === resources.length) return async (context) => {
      const active = options.executor.getActiveState().plan
      if (!active || active.rootResourceIds.some(id => !options.executor.getLoadedResourceIds().has(id))) throw new Error('整体增强前场景资源未全部装配')
      const enhancement = options.enhancement!
      const load = typeof options.loadContext === 'function' ? options.loadContext(context) : options.loadContext
      if (load.viewer.scene && load.viewer.container) {
        await waitForTunnelGlbSegment(focusTunnelSegmentAt(options.targetChainage ?? task.chainageRange.start, load.viewer), load.viewer)
        for (const id of active.loadOrder) for (const target of registry.require(id).getEnhanceTargets?.() ?? []) {
          const model = target.object as Cesium.Model | undefined
          if (model && typeof model.ready === 'boolean') await waitForModelReady(model, () => load.viewer.scene.requestRender())
        }
        if (active.rootResourceIds.includes('blast.effect')) await waitForBlastModel(load.viewer)
      }
      let undoPresentation: (() => void) | undefined
      context.onRollback(async () => { undoPresentation?.(); const errors = await enhancement.engine.reset(); if (errors.length) throw new AggregateError(errors, '整体增强撤销失败') })
      const enhanced = await enhancement.engine.apply(enhancement.planner.create({ ...active, stepId: step.stepId }, { highlightFocus: false }))
      if (enhanced.status === 'failed') throw enhanced.error ?? new Error('整体增强失败')
      undoPresentation = presentTaskScene(load.viewer, active.rootResourceIds, options.targetChainage ?? task.chainageRange.start,task.description)
      if (active.rootResourceIds.includes('rock.face-photos')) await waitForSceneEntitiesReady(load.viewer)
      const previous = context.plan.sharedContext[`scene.stage.${resources.length}`]?.value as Record<string, unknown>
      return { outputs: { [step.outputKeys[0]]: { ...previous, phase: 'constructed-then-enhanced', presentation: taskPresentationProfile(active.rootResourceIds,task.description),
        provenance: active.rootResourceIds.map(id => ({ resourceId: id, assets: registry.require(id).getActiveAssetPaths?.() ?? [],
          metadata: (registry.require(id).getEnhanceTargets?.() ?? []).flatMap(target => target.metadata ? [target.metadata] : []) })),
        assembledResourceIds: [...active.rootResourceIds] } } }
    }
    const resource = resources[index]
    const outputKey = step.outputKeys[0]
    return withScenePlan(
      async (context) => {
        const loadContext = typeof options.loadContext === 'function'
          ? options.loadContext(context) : options.loadContext
        const retainedSupport = stageResources(assemblyStages, index)
          .find(item => item.id.startsWith('support.modeler-') || item.id === ALTERNATING_SUPPORT_ID)
        const rollback = finalize ? undefined : await focusScene(resource, loadContext.viewer, retainedSupport)
        return { outputs: { [outputKey]: {
        resourceId: resource.id,
        module: resource.module,
        chainageRange: stageTask(task, resources, assemblyStages, index, options.targetChainage).chainageRange,
        assembledResourceIds: options.executor.getActiveState().plan?.rootResourceIds ?? [],
        supportLengthM: stageResources(assemblyStages, index).some(item => isTestSupportId(item.id)) ? task.supportLengthM ?? 10 : undefined,
        note: [...new Set(stageResources(assemblyStages, index).map(resource => resource.id === 'blast.design-data'
          ? '炮孔设计来自现有方案示例，逐孔姿态含经验值；非目标工点实测或审批设计，不据此给出药量或安全结论'
          : resource.id === 'rock.advance-drill'
          ? '既有水平钻GLB示例按目标中线示意装配，孔位和轨迹非目标工点实测，不含钻进日志或涌水记录'
          : resource.id.startsWith('rock.gpr-line')
          ? '现有GPR处理剖面参考，测线横距/深度为局部轴；未建立目标YK测量对应，不将反射异常直接判为富水或破碎带'
          : resource.id === THREE_BENCH_ID ? threeBenchDescription
          : resource.id === 'rock.face-photos'
          ? faceSourceDescription()
          : resource.id.startsWith('ventilation.thermal-t')
          ? '现有稳态解与指数松弛近似热场时间片，示意配准仅显示右洞；完整瞬态CFD待重跑，非目标工点实测温度'
          : resource.id.startsWith('ventilation.transient-')
          ? '现有一维瞬态风网工况分析，非该工况三维CFD，非目标工点实时监测'
          : resource.module === 'ventilation'
          ? '局部 K3+805～K4+005 通风数据示意配准到 YK3+900～YK4+100；非该工点实测风场，不代表工程结论'
          : resource.id === 'rock.tsp-hardness' || resource.id === 'rock.tsp-integrity'
            ? '围岩物探解释体素源锚点为 YK2+244，当前按目标中线示意重定位；TSP 来源报告为 X1DK2+937，不能视作目标工点实测结论'
          : resource.module === 'rock' && resource.id !== 'rock.design-grade'
            ? '围岩物探解释体素源锚点为 YK2+244，当前按目标中线示意重定位；不能视作目标工点实测结论'
          : resource.id === ALTERNATING_SUPPORT_ID
            ? '目标里程附近 50 m 内，每米交替装配 ZZ-Va 和 Z-PM；Z-PM 仅含支护版块现有二衬和 N1–N7 钢筋，属示意装配，非目标里程实测支护'
          : resource.id === 'blast.effect' && ((options.targetChainage ?? 1346) < 1346 || (options.targetChainage ?? 1346) > 1351)
            ? '爆破炮孔与爆后点云源于 YK1+346 示例工点，现按目标中线示意重定位；非目标里程实测爆破结果'
          : resource.id.startsWith('support.modeler-')
            ? '新支护模块导出的 1 m 断面模板按平台 YK 中线装配；当前使用已导出模型，非按本任务参数重新生成，不代表目标里程实测支护或质量结论'
          : stageResources(assemblyStages, index).length > 1
            ? `同屏装配 ${stageResources(assemblyStages, index).map(item => item.id).join('、')}；示例设计不代表质量或风险结论`
          : '场景展示已完成；不代表工程质量或风险结论'))].join('；'),
      } }, rollback }
      },
      {
        ...options,
        loadContext: context => ({ ...(typeof options.loadContext === 'function' ? options.loadContext(context) : options.loadContext), deferPresentation: finalize }),
        enhancement: options.enhancement && !finalize ? {
          ...options.enhancement,
          plannerOptions: (context, scenePlan) => ({
            ...(typeof options.enhancement!.plannerOptions === 'function'
              ? options.enhancement!.plannerOptions(context, scenePlan)
              : options.enhancement!.plannerOptions),
            ...enhancementOptionsForMode(enhancementModes[index]),
          }),
        } : undefined,
        sceneTask: (context) => stageTask(context.task, resources, assemblyStages, index, options.targetChainage),
        selectorOptions: () => ({ candidateResourceIds: stageResources(assemblyStages, index).map((item) => item.id) }),
      },
    )
  }
  const executor = new WorkflowExecutor(task, plan, resolve)
  const reviseNextAssembly = (stepId: string, mode: SceneAssemblyMode): ScenePlan[] => {
    const index = steps.findIndex(step => step.stepId === stepId)
    if (index < 1 || index >= resources.length) throw new Error('只能调整后续场景资源阶段')
    if (steps[index - 1].status !== 'completed') throw new Error('前一阶段尚未完成')
    if (executor.plan.currentStepId !== stepId || steps[index].status !== 'pending') {
      throw new Error('只能调整当前待执行场景阶段')
    }
    const candidateModes = [...assemblyModes]
    candidateModes[index] = mode
    validateAssemblyModes(candidateModes, resources.length)
    const nextStages = resolveAssemblyStages(resources, candidateModes)
    const nextPlans = buildScenePlans(nextStages)
    assemblyModes.splice(0, assemblyModes.length, ...candidateModes)
    assemblyStages = nextStages
    scenePlans.splice(0, scenePlans.length, ...nextPlans)
    for (let pending = index; pending < resources.length; pending++) steps[pending].name = stepName(nextStages, pending)
    return [...scenePlans]
  }
  return { executor, scenePlans, reviseNextAssembly }
}
