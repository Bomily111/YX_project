import type { ToolRegistration } from '../types'
import { advancePlatformTask, dispatchValidatedWorkflow, orchestratePlatformTask } from '../TaskOrchestrator'
import { AGENT_SCENE_RESOURCES, SCENE_ENHANCEMENT_MODES, SCENE_ASSEMBLY_MODES } from '@/platform/tasks/samples/SceneExplorationWorkflow'
import { chainageService } from '@/platform/coordinates/ChainageService'
import { viewerService } from '@/platform/viewer/ViewerService'
import { getActiveModelerSupportModel } from '@/modules/support/modeler-resources'
import * as Cesium from 'cesium'
import {
  getTaskWorkflowController,
  type AgentTaskWorkflowInput,
  type AgentTaskWorkflowStatus,
} from '@/platform/tasks/TaskWorkflowBridge'

const result = (action: string, status: AgentTaskWorkflowStatus): string => JSON.stringify({
  ok: status.notice?.type !== 'error',
  action,
  ...status,
})
const agentResourceIds = (value: unknown): string[] => {
  if (!Array.isArray(value) || value.some(id => typeof id !== 'string')) throw new Error('场景资源必须是字符串数组')
  const ids = value as string[]
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
  const mileagePattern = /(?:DK|YK)\s*\d+\s*\+\s*\d+(?:\.\d+)?/gi
  const explicit = [...new Set((userRequest ?? '').match(mileagePattern)?.map(value => value.replace(/\s+/g, '').toUpperCase()) ?? [])]
  if (userRequest !== undefined) {
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
      name: 'assemble_scene_at_mileage',
      description: '主界面自主装配的单一入口：给出明确目标里程和要同屏装配的现有模型。平台校验 YK 中线目标与同屏规则，必要时将示例资产沿目标中线示意重定位，再按依赖顺序装配到主 Cesium 场景；返回实际资源与失败原因。无需再调用准备、推进或修订工具。',
      input_schema: {
        type: 'object',
        properties: {
          description: { type: 'string', description: '用户要构建的场景目标' },
          targetMileage: { type: 'string', description: '明确的目标里程，优先使用工地真实中线 YK，例如 YK1+346 或 YK2+244；旧 DK 可作为兼容输入，平台统一转换为 YK' },
          resourceIds: { type: 'array', minItems: 1, maxItems: 4,
            items: { type: 'string', enum: [...AGENT_SCENE_RESOURCES] },
            description: '最终同屏资源。围岩解释四层源锚点为 YK2+244，四层互斥。支护组合默认 support.modeler-zz-va（已导出 1 m 断面），指定其他 ZZ 类型选对应 support.modeler-zz-*。' },
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
      if (resourceIds.length < 1 || resourceIds.length > 4) throw new Error('单次场景装配需要 1–4 个模型资源')
      const controller = getTaskWorkflowController()
      const prepared = await controller.prepareScene({
        description: String(input.description ?? '').trim(), targetMileage, resourceIds,
        assemblyModes: resourceIds.map((_, index) => index === 0 ? 'replace' : 'retain'),
        enhancementModes: resourceIds.map(() => 'auto'),
        tunnelId: input.tunnelId === undefined ? undefined : String(input.tunnelId),
      })
      if (!prepared.prepared || prepared.notice?.type === 'error') {
        return JSON.stringify({ action: 'assemble_scene_at_mileage', ok: false, targetMileage, requestedMileage,
          reason: prepared.notice?.message ?? '场景装配未通过校验', ...prepared })
      }
      const viewer = viewerService.require()
      const focusTarget = (assembled = false) => {
        const support = assembled && resourceIds
          .map(getActiveModelerSupportModel).find((model): model is Cesium.Model => !!model?.ready)
        if (support) {
          viewer.camera.viewBoundingSphere(support.boundingSphere, new Cesium.HeadingPitchRange(0, -0.25, 42))
          viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
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
      if (outcome.ok) focusTarget(true)
      return JSON.stringify({ action: 'assemble_scene_at_mileage', targetMileage, requestedMileage,
        assembledResourceIds: outcome.status.lastCompletedStage?.assembledResourceIds ?? [],
        ...outcome, ...outcome.status })
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
