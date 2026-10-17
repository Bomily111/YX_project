import * as Cesium from 'cesium'
import { validateTaskContext, type TaskContext } from '@/platform/context/TaskContext'
import type { SceneResource } from '@/platform/resources/types'
import { ResourceRegistry } from '@/platform/resources/ResourceRegistry'
import { ResourceSelector } from '@/platform/selection/ResourceSelector'
import type { ScenePlan } from '@/platform/selection/ScenePlan'
import { withScenePlan, type ScenePlanWorkflowOptions } from '@/platform/selection/ScenePlanWorkflow'
import { WorkflowExecutor } from '../WorkflowExecutor'
import type { TaskStep, WorkflowPlan } from '../TaskStep'
import { getBlastModel } from '@/views/tunnel-module/blast'
import { getTunnelModel as getVentilationModel } from '@/views/ventilation-module/cesiumVentilation'
import { ventilationPositionToWorld, ventilationVectorToWorld } from '@/views/ventilation-module/spatialFrame'
import supportAssets from '@/modules/support/legacy-assets.json'

/** 只允许现有四类可展示资产进入智能体的场景编排，不能把任意路径当作资源加载。 */
export const SCENE_EXPLORATION_RESOURCES = [
  'rock.design-grade', 'support.scene', 'blast.effect',
  'ventilation.steady-cfd', 'ventilation.transient-network', 'ventilation.thermal-field',
  'support.legacy-assembly', ...supportAssets.map(asset => asset.id),
] as const

export type SceneExplorationResourceId = typeof SCENE_EXPLORATION_RESOURCES[number]

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

export function sceneStageTask(task: TaskContext, resource: SceneResource): TaskContext {
  const focusChainage = resource.id.startsWith('support.legacy-')
    ? (resource.chainageRange!.start + resource.chainageRange!.end) / 2
    : resource.module === 'ventilation' ? 3905.151 : 278330
  const chainageRange = resource.chainageRange!
  const focus = focusChainage >= chainageRange.start && focusChainage <= chainageRange.end
    ? focusChainage : chainageRange.start
  return {
    ...task,
    chainageRange: { start: focus, end: focus },
    targetTypes: [resource.module],
    process: undefined,
    targetState: undefined,
  }
}

/** 第一阶段同场景装配只开放围岩→支护，避免异工点 CFD 被误当作实测叠加。 */
function stageResources(resources: readonly SceneResource[], index: number): SceneResource[] {
  const current = resources[index]
  return current.module === 'support' && resources[index - 1]?.id === 'rock.design-grade'
    ? [resources[index - 1], current]
    : [current]
}

function stageTask(task: TaskContext, resources: readonly SceneResource[], index: number): TaskContext {
  const base = sceneStageTask(task, resources[index])
  const selected = stageResources(resources, index)
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
  options: Omit<ScenePlanWorkflowOptions, 'selectorOptions' | 'sceneTask'>,
): { executor: WorkflowExecutor; scenePlans: ScenePlan[] } {
  if (task.taskType !== 'scene-exploration') throw new Error('场景编排只接受 scene-exploration 任务')
  const validation = validateTaskContext(task)
  if (!validation.valid) throw new Error(`场景任务参数无效：${validation.issues.map((item) => item.message).join('；')}`)
  const resources = validateSceneSequence(resourceIds, registry)
  const selector = new ResourceSelector(registry)
  const steps: TaskStep[] = resources.map((resource, index) => ({
    stepId: `scene-${index + 1}`,
    name: stageResources(resources, index).length > 1
      ? `叠加围岩分级与${resource.id.startsWith('support.legacy-') ? '既有支护构件 · 示例布置段' : '支护钢架 · DK278+330'}`
      : `展示 ${resource.module} · ${resource.id}`,
    module: resource.module as TaskStep['module'],
    dependsOn: index === 0 ? [] : [`scene-${index}`],
    inputKeys: index === 0 ? ['task.description'] : [`scene.stage.${index}`],
    outputKeys: [`scene.stage.${index + 1}`],
    action: 'scene.show-resource',
    completionRule: { requiredOutputs: [`scene.stage.${index + 1}`] },
    status: 'pending',
  }))
  const plan: WorkflowPlan = { taskId: task.taskId, steps, sharedContext: {} }
  const scenePlans: ScenePlan[] = []
  for (const [index, step] of steps.entries()) {
    const selected = stageResources(resources, index)
    const scenePlan = selector.createScenePlan(stageTask(task, resources, index), step, {
      candidateResourceIds: selected.map((item) => item.id),
      previousPlan: index > 0 ? scenePlans[index - 1] : undefined,
      loadedResourceIds: index > 0 ? new Set(scenePlans[index - 1].loadOrder) : undefined,
    })
    if (!scenePlan.rootResourceIds.includes(resources[index].id)) {
      throw new Error(`阶段 ${index + 1} 无法加载 ${resources[index].id}：${scenePlan.warnings.join('；')}`)
    }
    if (selected.length > 1 && !scenePlan.rootResourceIds.includes(selected[0].id)) {
      throw new Error(`阶段 ${index + 1} 无法保留 ${selected[0].id}：${scenePlan.warnings.join('；')}`)
    }
    scenePlans.push(scenePlan)
  }
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
        chainageRange: stageTask(task, resources, index).chainageRange,
        note: resource.module === 'ventilation'
          ? 'K3+805～K4+005 通风数据已示意配准到 DK278+330；非该工点实测风场，不代表工程结论'
          : resource.id.startsWith('support.legacy-')
            ? '结构树既有 GLB 构件；保留 DK278+100～DK278+167 附近原示例布置，不可参数化，不代表实测支护或质量结论'
          : stageResources(resources, index).length > 1
            ? '围岩分级与支护钢架同场景展示；参数化钢架为示例设计，不代表质量结论'
          : '场景展示已完成；不代表工程质量或风险结论',
      } }, rollback }
      },
      {
        ...options,
        sceneTask: (context) => stageTask(context.task, resources, index),
        selectorOptions: () => ({ candidateResourceIds: stageResources(resources, index).map((item) => item.id) }),
      },
    )
  }
  return { executor: new WorkflowExecutor(task, plan, resolve), scenePlans }
}
