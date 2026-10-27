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
import { getBlastModel } from '@/views/tunnel-module/blast'
import { getTunnelModel as getVentilationModel } from '@/views/ventilation-module/cesiumVentilation'
import { ventilationPositionToWorld, ventilationVectorToWorld } from '@/views/ventilation-module/spatialFrame'
import supportAssets from '@/modules/support/legacy-assets.json'

/** 只允许现有四类可展示资产进入智能体的场景编排，不能把任意路径当作资源加载。 */
export const SCENE_EXPLORATION_RESOURCES = [
  'rock.design-grade', 'rock.geophysical-grade', 'rock.tsp-hardness',
  'rock.tsp-integrity', 'rock.tem-resistivity', 'support.scene', 'blast.effect',
  'ventilation.steady-cfd', 'ventilation.transient-network', 'ventilation.thermal-field',
  'support.legacy-assembly', ...supportAssets.map(asset => asset.id),
] as const

export type SceneExplorationResourceId = typeof SCENE_EXPLORATION_RESOURCES[number]
/** Public agent routes use fixed structure-tree support until the external support module arrives. */
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
  const focusChainage = requestedChainage ?? (resource.id.startsWith('support.legacy-')
    ? (resource.chainageRange!.start + resource.chainageRange!.end) / 2
    : resource.module === 'ventilation' ? 1346
      : resource.module === 'rock' && resource.id !== 'rock.design-grade' ? 2244
        : 1346)
  const chainageRange = resource.chainageRange!
  const demoRelocatable = resource.id.startsWith('support.legacy-')
    || resource.module === 'rock' && resource.id !== 'rock.design-grade'
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
  const unique = new Set(ids)
  if (unique.size !== ids.length) return false
  const legacy = ids.filter(id => id.startsWith('support.legacy-'))
  if (legacy.length > 0) {
    return legacy.length === 1
      && ids.filter(id => id.startsWith('rock.')).length <= 1
      && ids.every(id => id.startsWith('rock.') || id === legacy[0])
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
      current.id.startsWith('support.legacy-') && resources[index - 1]?.id.startsWith('rock.')
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
  timeoutMs = 15000,
): Promise<void> {
  if (model.ready) return
  await new Promise<void>((resolve, reject) => {
    let removeReady: (() => void) | undefined
    const timer = setTimeout(() => {
      removeReady?.()
      reject(new Error('爆破模型首帧就绪超时'))
    }, timeoutMs)
    removeReady = model.readyEvent.addEventListener(() => {
      clearTimeout(timer)
      removeReady?.()
      resolve()
    })
    requestRender()
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

async function focusScene(resource: SceneResource, viewer: Cesium.Viewer): Promise<(() => void) | undefined> {
  if (!viewer?.camera || viewer.isDestroyed?.()) return undefined
  const camera = viewer.camera
  const before = {
    destination: Cesium.Cartesian3.clone(camera.positionWC),
    direction: Cesium.Cartesian3.clone(camera.directionWC),
    up: Cesium.Cartesian3.clone(camera.upWC),
  }
  if (resource.module === 'ventilation' && getVentilationModel()) {
    const { destination, direction, up } = ventilationWorkpointView()
    camera.setView({ destination, orientation: { direction, up } })
  } else if (resource.id === 'blast.effect') {
    const model = await waitForBlastModel(viewer)
    camera.viewBoundingSphere(model.boundingSphere, new Cesium.HeadingPitchRange(0, -0.3, 110))
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
  const buildScenePlans = (stages: readonly SceneResource[][]): ScenePlan[] => {
    const planned: ScenePlan[] = []
    for (const [index, step] of steps.entries()) {
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
    return planned
  }
  const scenePlans = buildScenePlans(assemblyStages)
  const resolve = (_action: string, step: TaskStep) => {
    const index = steps.findIndex((item) => item.stepId === step.stepId)
    if (index < 0) return undefined
    const resource = resources[index]
    const outputKey = step.outputKeys[0]
    return withScenePlan(
      async (context) => {
        const loadContext = typeof options.loadContext === 'function'
          ? options.loadContext(context) : options.loadContext
        const rollback = await focusScene(resource, loadContext.viewer)
        return { outputs: { [outputKey]: {
        resourceId: resource.id,
        module: resource.module,
        chainageRange: stageTask(task, resources, assemblyStages, index, options.targetChainage).chainageRange,
        assembledResourceIds: options.executor.getActiveState().plan?.rootResourceIds ?? [],
        note: resource.module === 'ventilation'
          ? '局部 K3+805～K4+005 通风数据示意配准到 YK1+346；非该工点实测风场，不代表工程结论'
          : resource.id === 'rock.tsp-hardness' || resource.id === 'rock.tsp-integrity'
            ? '围岩物探解释体素源锚点为 YK2+244，当前按目标中线示意重定位；TSP 来源报告为 X1DK2+937，不能视作目标工点实测结论'
          : resource.module === 'rock' && resource.id !== 'rock.design-grade'
            ? '围岩物探解释体素源锚点为 YK2+244，当前按目标中线示意重定位；不能视作目标工点实测结论'
          : resource.id.startsWith('support.legacy-')
            ? '结构树既有 GLB 构件；以 YK1+116～YK1+183 原布置为模板沿中线示意装配，不可参数化，不代表目标里程实测支护或质量结论'
          : stageResources(assemblyStages, index).length > 1
            ? `同屏装配 ${stageResources(assemblyStages, index).map(item => item.id).join('、')}；示例设计不代表质量或风险结论`
          : '场景展示已完成；不代表工程质量或风险结论',
      } }, rollback }
      },
      {
        ...options,
        enhancement: options.enhancement ? {
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
    if (index < 1) throw new Error('只能调整后续场景阶段')
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
    for (let pending = index; pending < steps.length; pending++) steps[pending].name = stepName(nextStages, pending)
    return [...scenePlans]
  }
  return { executor, scenePlans, reviseNextAssembly }
}
