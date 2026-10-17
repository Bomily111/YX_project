import type { ToolRegistration } from '../types'
import { SCENE_EXPLORATION_RESOURCES } from '@/platform/tasks/samples/SceneExplorationWorkflow'
import { aiEvents } from '../events'
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

const openPanel = (): void => aiEvents.emit('task:open')

const parseDescriptionChainages = (description: string): number[] => {
  const values: number[] = []
  const pattern = /(?:D?K)\s*(\d+)\s*\+\s*(\d+(?:\.\d+)?)/gi
  for (const match of description.matchAll(pattern)) {
    const major = Number(match[1])
    const minor = Number(match[2])
    if (Number.isFinite(major) && Number.isFinite(minor)) values.push(major * 1000 + minor)
  }
  return values
}

export function normalizeAgentTaskInput(input: Record<string, any>): AgentTaskWorkflowInput {
  const description = String(input.description ?? '').trim()
  const parsed = parseDescriptionChainages(description)
  const start = parsed[0] ?? Number(input.start)
  const end = parsed[1] ?? Number(input.end)
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
      name: 'compose_scene_workflow',
      description: '利用平台现有资产动态编排场景。结构树既有支护用 support.legacy-assembly（7类构件，原示例布置 DK278+100～DK278+167，不可参数化）；support.scene 为参数化钢架试验。围岩紧接支护阶段可同屏，爆破和通风仍切换。通风 K3+805–K4+005 数据示意配准到 DK278+330，非该工点实测风场。仅生成计划，不执行，不作工程结论。',
      input_schema: {
        type: 'object',
        properties: {
          description: { type: 'string', description: '用户要探索或展示的目标' },
          resourceIds: {
            type: 'array', minItems: 1, maxItems: 8,
            items: { type: 'string', enum: [...SCENE_EXPLORATION_RESOURCES] },
            description: '按执行顺序列出阶段资源；允许重复资源以便返回场景。隧道模型由依赖自动加载',
          },
          tunnelId: { type: 'string', description: '当前隧洞 ID，可省略' },
          maxLoadMb: { type: 'number', description: '单阶段加载预算，默认 1200MB' },
        },
        required: ['description', 'resourceIds'],
      },
    },
    executor: async (input) => {
      openPanel()
      const status = await getTaskWorkflowController().prepareScene({
        description: String(input.description ?? '').trim(),
        resourceIds: Array.isArray(input.resourceIds) ? input.resourceIds.map(String) : [],
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
          start: { type: 'number', description: '起点绝对里程；必须将 DK278+330 转换为 278330，不能只填 330' },
          end: { type: 'number', description: '终点绝对里程；必须将 DK278+340 转换为 278340，不能只填 340' },
          maxLoadMb: { type: 'number', description: '场景资源加载预算，默认 1200MB' },
        },
        required: ['description', 'start', 'end'],
      },
    },
    executor: async (input) => {
      openPanel()
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
      openPanel()
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
      openPanel()
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
      openPanel()
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
      openPanel()
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
      openPanel()
      return result('reset_task_scene', await getTaskWorkflowController().reset())
    },
  },
]
