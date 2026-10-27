import type {
  AgentSceneWorkflowInput,
  AgentTaskWorkflowInput,
  AgentTaskWorkflowStatus,
  TaskWorkflowController,
} from '@/platform/tasks/TaskWorkflowBridge'

export type PlatformTaskRequest =
  | { kind: 'quality-check'; input: AgentTaskWorkflowInput }
  | { kind: 'scene-exploration'; input: AgentSceneWorkflowInput }

export interface DispatchStep {
  stepId: string
  module: string
  resources: string[]
  before: string
  after: string
  completed: number
}

export interface PlatformTaskOutcome {
  ok: boolean
  reason: string
  status: AgentTaskWorkflowStatus
  dispatchTrace: DispatchStep[]
}

/** The model receives this observation and must choose whether to request the next step. */
export async function advancePlatformTask(
  controller: TaskWorkflowController,
  expectedTaskId: string,
  expectedStepId: string,
): Promise<PlatformTaskOutcome> {
  const before = controller.getStatus()
  const trace: DispatchStep[] = []
  if (!before.prepared || before.taskId !== expectedTaskId || !before.taskId) {
    return { ok: false, reason: '任务已被替换或未经校验', status: before, dispatchTrace: trace }
  }
  if (before.status === 'failed' || before.status === 'completed' || before.notice?.type === 'error') {
    return { ok: false, reason: '任务当前状态不允许继续执行', status: before, dispatchTrace: trace }
  }
  if (before.total > 8 || before.currentStepId !== expectedStepId) {
    return { ok: false, reason: '步骤与已校验计划不一致', status: before, dispatchTrace: trace }
  }
  const step = before.steps.find(item => item.stepId === expectedStepId)
  if (!step) return { ok: false, reason: '当前步骤不在已校验计划中', status: before, dispatchTrace: trace }
  const after = await controller.executeNext()
  trace.push({
    stepId: step.stepId, module: step.module,
    resources: before.scenePlans.find(item => item.stepId === step.stepId)?.resources ?? [],
    before: before.status ?? 'unknown', after: after.status ?? 'unknown', completed: after.completed,
  })
  if (after.taskId !== expectedTaskId) return { ok: false, reason: '执行期间任务已被替换', status: after, dispatchTrace: trace }
  if (after.status === 'failed' || after.notice?.type === 'error') {
    return { ok: false, reason: after.notice?.message || '步骤执行失败', status: after, dispatchTrace: trace }
  }
  if (after.completed !== before.completed + 1) {
    return { ok: false, reason: '步骤未按预期推进', status: after, dispatchTrace: trace }
  }
  return { ok: true, reason: after.status === 'completed' ? '任务已完成' : '步骤完成，请观察结果后决定下一步', status: after, dispatchTrace: trace }
}

/** Model chooses the task route and scene assets; the platform validates and observes each dispatched step. */
export async function orchestratePlatformTask(
  controller: TaskWorkflowController,
  request: PlatformTaskRequest,
): Promise<PlatformTaskOutcome> {
  const status = request.kind === 'quality-check'
    ? await controller.prepare(request.input)
    : await controller.prepareScene(request.input)
  return dispatchValidatedWorkflow(controller, status)
}

/** Shared execution gate for natural-language and form-created tasks. */
export async function dispatchValidatedWorkflow(
  controller: TaskWorkflowController,
  initialStatus: AgentTaskWorkflowStatus,
): Promise<PlatformTaskOutcome> {
  const trace: DispatchStep[] = []
  let status = initialStatus
  if (!status.prepared || status.notice?.type === 'error' || !status.taskId || !status.total) {
    return { ok: false, reason: status.notice?.message || '任务计划未通过校验', status, dispatchTrace: trace }
  }
  if (status.total > 8) {
    return { ok: false, reason: '自动调度最多执行 8 个受控步骤', status, dispatchTrace: trace }
  }
  const taskId = status.taskId
  for (let index = 0; index < status.total; index++) {
    if (status.status === 'completed') break
    if (status.status === 'failed') {
      return { ok: false, reason: status.notice?.message || '步骤执行失败', status, dispatchTrace: trace }
    }
    const step = status.steps.find(item => item.stepId === status.currentStepId)
    if (!step) return { ok: false, reason: '当前步骤不在已校验计划中', status, dispatchTrace: trace }
    const previous = status
    status = await controller.executeNext()
    trace.push({
      stepId: step.stepId,
      module: step.module,
      resources: previous.scenePlans.find(item => item.stepId === step.stepId)?.resources ?? [],
      before: previous.status ?? 'unknown',
      after: status.status ?? 'unknown',
      completed: status.completed,
    })
    if (status.taskId !== taskId) return { ok: false, reason: '执行期间任务已被替换，调度已停止', status, dispatchTrace: trace }
    if (status.status === 'failed' || status.notice?.type === 'error') {
      return { ok: false, reason: status.notice?.message || '步骤执行失败', status, dispatchTrace: trace }
    }
    if (status.completed <= previous.completed) {
      return { ok: false, reason: '步骤没有推进，调度已停止以避免重复执行', status, dispatchTrace: trace }
    }
  }
  return {
    ok: status.status === 'completed' && status.completed === status.total,
    reason: status.status === 'completed' && status.completed === status.total ? '任务已完成' : '任务未在步骤上限内完成',
    status,
    dispatchTrace: trace,
  }
}
