import type { TaskContext } from '@/platform/context/TaskContext'
import type { SharedContextValue, TaskStep, WorkflowPlan } from './TaskStep'

export interface StepOutputMetadata {
  recordedAt?: string
  confidence?: number | Readonly<Record<string, number>>
}

const taskInputValue = (task: TaskContext, key: string): unknown => {
  const property = key.slice('task.'.length) as keyof TaskContext
  return task[property]
}

/** 只允许步骤写入其 outputKeys 中声明的字段，并附带来源、时间与可选置信度。 */
export function writeStepOutputs(
  plan: WorkflowPlan,
  stepId: string,
  outputs: Readonly<Record<string, unknown>>,
  metadata: StepOutputMetadata = {},
): void {
  const step = plan.steps.find((candidate) => candidate.stepId === stepId)
  if (!step) throw new Error(`[WorkflowContext] 步骤不存在：${stepId}`)

  const declaredOutputs = new Set(step.outputKeys)
  for (const key of Object.keys(outputs)) {
    if (!declaredOutputs.has(key)) throw new Error(`[WorkflowContext] 步骤 ${stepId} 未声明输出：${key}`)
    const existing = plan.sharedContext[key]
    if (existing && (existing.source.kind !== 'step' || existing.source.id !== stepId)) {
      throw new Error(`[WorkflowContext] 输出 ${key} 已由 ${existing.source.id} 写入`)
    }
  }

  const recordedAt = metadata.recordedAt ?? new Date().toISOString()
  if (Number.isNaN(Date.parse(recordedAt))) throw new Error('[WorkflowContext] recordedAt 不是有效时间')
  const entries = Object.entries(outputs).map(([key, value]) => {
    const confidence = typeof metadata.confidence === 'number'
      ? metadata.confidence
      : metadata.confidence?.[key]
    if (confidence !== undefined && (confidence < 0 || confidence > 1 || !Number.isFinite(confidence))) {
      throw new Error(`[WorkflowContext] ${key} 的置信度必须在 0–1 之间`)
    }
    const entry: SharedContextValue = {
      value,
      source: { kind: 'step', id: stepId },
      recordedAt,
      ...(confidence === undefined ? {} : { confidence }),
    }
    return [key, entry] as const
  })
  for (const [key, entry] of entries) {
    plan.sharedContext[key] = entry
  }
}

/** 删除指定步骤产生的上下文，用于重试和事务回滚。 */
export function removeStepOutputs(plan: WorkflowPlan, stepId: string): void {
  for (const [key, entry] of Object.entries(plan.sharedContext)) {
    if (entry.source.kind === 'step' && entry.source.id === stepId) delete plan.sharedContext[key]
  }
}

/** 解析步骤声明的输入；不允许模块绕过声明直接读取其他上下文字段。 */
export function readStepInputs(
  plan: WorkflowPlan,
  step: TaskStep,
  task: TaskContext,
): Readonly<Record<string, unknown>> {
  const inputs: Record<string, unknown> = {}
  for (const key of step.inputKeys) {
    if (key.startsWith('task.')) {
      inputs[key] = taskInputValue(task, key)
      continue
    }
    const entry = plan.sharedContext[key]
    if (!entry) throw new Error(`[WorkflowContext] 步骤 ${step.stepId} 缺少输入：${key}`)
    inputs[key] = entry.value
  }
  return inputs
}
