import type { TaskContext } from '@/platform/context/TaskContext'
import {
  readStepInputs,
  removeStepOutputs,
  writeStepOutputs,
  type StepOutputMetadata,
} from './WorkflowContext'
import type { TaskStep, TaskStepStatus, WorkflowPlan } from './TaskStep'
import { WorkflowValidator } from './WorkflowValidator'

export type WorkflowExecutionStatus = 'ready' | 'running' | 'completed' | 'failed'

export interface StepActionContext {
  task: TaskContext
  plan: WorkflowPlan
  step: TaskStep
  inputs: Readonly<Record<string, unknown>>
  signal?: AbortSignal
  /** 动作开始产生副作用后应立即登记，确保中途抛错也能清理。 */
  onRollback: (rollback: () => void | Promise<void>) => void
}

export interface StepActionResult {
  outputs: Readonly<Record<string, unknown>>
  metadata?: StepOutputMetadata
  /** 撤销该动作产生的页面、资源或外部副作用。 */
  rollback?: () => void | Promise<void>
}

export type StepActionHandler = (context: StepActionContext) => StepActionResult | Promise<StepActionResult>
export type StepActionResolver = (action: string, step: TaskStep) => StepActionHandler | undefined

export interface StepExecutionResult {
  stepId: string
  status: Extract<TaskStepStatus, 'completed' | 'failed'>
  durationMs: number
  outputKeys: readonly string[]
  error?: unknown
  rollbackError?: unknown
}

export interface WorkflowExecutionSnapshot {
  status: WorkflowExecutionStatus
  currentStepId?: string
  completed: number
  failed: number
  skipped: number
  total: number
}

export interface WorkflowExecutorOptions {
  validator?: WorkflowValidator
  rollbackOnFailure?: boolean
}

type ExecutorListener = (snapshot: Readonly<WorkflowExecutionSnapshot>) => void

export class WorkflowExecutionError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = 'WorkflowExecutionError'
  }
}

/** 串行推进已校验的 WorkflowPlan，并为每个步骤提供事务式上下文写入与回滚。 */
export class WorkflowExecutor {
  private readonly validator: WorkflowValidator
  private readonly rollbackOnFailure: boolean
  private readonly rollbacks = new Map<string, () => void | Promise<void>>()
  private readonly listeners = new Set<ExecutorListener>()
  private active = false

  constructor(
    readonly task: TaskContext,
    readonly plan: WorkflowPlan,
    private readonly resolveAction: StepActionResolver,
    options: WorkflowExecutorOptions = {},
  ) {
    this.validator = options.validator ?? new WorkflowValidator()
    this.rollbackOnFailure = options.rollbackOnFailure ?? true
    const validation = this.validator.validate(plan, task)
    if (!validation.valid) {
      throw new WorkflowExecutionError('工作流计划校验失败', validation.issues)
    }
    this.moveCurrentToNextReady()
  }

  subscribe(listener: ExecutorListener): () => void {
    this.listeners.add(listener)
    listener(this.getSnapshot())
    return () => this.listeners.delete(listener)
  }

  getSnapshot(): WorkflowExecutionSnapshot {
    const counts = (status: TaskStepStatus) => this.plan.steps.filter((step) => step.status === status).length
    let status: WorkflowExecutionStatus = 'ready'
    if (this.active || this.plan.steps.some((step) => step.status === 'running')) status = 'running'
    else if (this.plan.steps.some((step) => step.status === 'failed')) status = 'failed'
    else if (this.plan.steps.every((step) => step.status === 'completed' || step.status === 'skipped')) status = 'completed'
    return {
      status,
      currentStepId: this.plan.currentStepId,
      completed: counts('completed'),
      failed: counts('failed'),
      skipped: counts('skipped'),
      total: this.plan.steps.length,
    }
  }

  async executeCurrent(signal?: AbortSignal): Promise<StepExecutionResult> {
    if (this.active) throw new WorkflowExecutionError('已有步骤正在执行')
    const step = this.currentPendingStep()
    if (!step) throw new WorkflowExecutionError('没有可执行的待处理步骤')
    this.assertDependenciesCompleted(step)

    const handler = this.resolveAction(step.action, step)
    if (!handler) return this.failBeforeAction(step, new Error(`未注册动作处理器：${step.action}`))

    this.active = true
    step.status = 'running'
    this.emit()
    const startedAt = performance.now()
    let actionResult: StepActionResult | undefined
    let activeRollback: (() => void | Promise<void>) | undefined
    try {
      if (signal?.aborted) throw new DOMException('工作流执行已取消', 'AbortError')
      const inputs = readStepInputs(this.plan, step, this.task)
      actionResult = await handler({
        task: this.task,
        plan: this.plan,
        step,
        inputs,
        signal,
        onRollback: (rollback) => { activeRollback = rollback },
      })
      activeRollback = actionResult.rollback ?? activeRollback
      if (signal?.aborted) throw new DOMException('工作流执行已取消', 'AbortError')
      this.assertCompletion(step, actionResult.outputs)
      writeStepOutputs(this.plan, step.stepId, actionResult.outputs, actionResult.metadata)
      if (activeRollback) this.rollbacks.set(step.stepId, activeRollback)
      step.status = 'completed'
      this.active = false
      this.moveCurrentToNextReady()
      this.emit()
      return {
        stepId: step.stepId,
        status: 'completed',
        durationMs: performance.now() - startedAt,
        outputKeys: Object.keys(actionResult.outputs),
      }
    } catch (error) {
      removeStepOutputs(this.plan, step.stepId)
      let rollbackError: unknown
      if (activeRollback) {
        try {
          await activeRollback()
        } catch (caught) {
          rollbackError = caught
        }
      }
      step.status = 'failed'
      this.plan.currentStepId = step.stepId
      this.active = false
      if (this.rollbackOnFailure) {
        const previousRollbackError = await this.rollbackCompletedSteps()
        rollbackError ??= previousRollbackError
      }
      this.emit()
      return {
        stepId: step.stepId,
        status: 'failed',
        durationMs: performance.now() - startedAt,
        outputKeys: [],
        error,
        ...(rollbackError === undefined ? {} : { rollbackError }),
      }
    }
  }

  async run(signal?: AbortSignal): Promise<readonly StepExecutionResult[]> {
    const results: StepExecutionResult[] = []
    while (this.getSnapshot().status !== 'completed') {
      if (this.getSnapshot().status === 'failed') break
      const result = await this.executeCurrent(signal)
      results.push(result)
      if (result.status === 'failed') break
    }
    return results
  }

  retry(stepId: string): void {
    if (this.active) throw new WorkflowExecutionError('步骤执行期间不能重试')
    const step = this.requireStep(stepId)
    if (step.status !== 'failed') throw new WorkflowExecutionError(`只有失败步骤可以重试：${stepId}`)
    removeStepOutputs(this.plan, stepId)
    step.status = 'pending'
    this.moveCurrentToNextReady()
    this.emit()
  }

  skip(stepId: string): void {
    if (this.active) throw new WorkflowExecutionError('步骤执行期间不能跳过')
    const step = this.requireStep(stepId)
    if (step.status !== 'pending' && step.status !== 'failed') {
      throw new WorkflowExecutionError(`只能跳过待处理或失败步骤：${stepId}`)
    }
    this.skipWithDependents(stepId)
    this.moveCurrentToNextReady()
    this.emit()
  }

  async reset(): Promise<void> {
    if (this.active) throw new WorkflowExecutionError('步骤执行期间不能复位')
    const rollbackError = await this.rollbackCompletedSteps()
    for (const step of this.plan.steps) {
      removeStepOutputs(this.plan, step.stepId)
      step.status = 'pending'
    }
    this.rollbacks.clear()
    this.plan.currentStepId = this.plan.steps[0]?.stepId
    this.emit()
    if (rollbackError !== undefined) {
      throw new WorkflowExecutionError('工作流已复位，但部分业务副作用回滚失败', rollbackError)
    }
  }

  private currentPendingStep(): TaskStep | undefined {
    const current = this.plan.steps.find((step) => step.stepId === this.plan.currentStepId)
    if (current?.status === 'pending') return current
    this.moveCurrentToNextReady()
    return this.plan.steps.find((step) => step.stepId === this.plan.currentStepId && step.status === 'pending')
  }

  private moveCurrentToNextReady(): void {
    const next = this.plan.steps.find((candidate) => (
      candidate.status === 'pending'
      && candidate.dependsOn.every((dependencyId) => this.requireStep(dependencyId).status === 'completed')
    ))
    this.plan.currentStepId = next?.stepId
  }

  private assertDependenciesCompleted(step: TaskStep): void {
    const incomplete = step.dependsOn.filter((id) => this.requireStep(id).status !== 'completed')
    if (incomplete.length > 0) {
      throw new WorkflowExecutionError(`步骤 ${step.stepId} 的依赖尚未完成：${incomplete.join(', ')}`)
    }
  }

  private assertCompletion(step: TaskStep, outputs: Readonly<Record<string, unknown>>): void {
    const undeclared = Object.keys(outputs).filter((key) => !step.outputKeys.includes(key))
    if (undeclared.length > 0) {
      throw new WorkflowExecutionError(`步骤 ${step.stepId} 返回未声明输出：${undeclared.join(', ')}`)
    }
    const configured = step.completionRule.requiredOutputs
    const requiredOutputs = Array.isArray(configured)
      ? configured.filter((value): value is string => typeof value === 'string')
      : step.outputKeys
    const missing = requiredOutputs.filter((key) => !(key in outputs) || outputs[key] === undefined)
    if (missing.length > 0) {
      throw new WorkflowExecutionError(`步骤 ${step.stepId} 未满足完成条件，缺少输出：${missing.join(', ')}`)
    }
  }

  private async failBeforeAction(step: TaskStep, error: unknown): Promise<StepExecutionResult> {
    step.status = 'failed'
    this.plan.currentStepId = step.stepId
    let rollbackError: unknown
    if (this.rollbackOnFailure) rollbackError = await this.rollbackCompletedSteps()
    this.emit()
    return {
      stepId: step.stepId,
      status: 'failed',
      durationMs: 0,
      outputKeys: [],
      error,
      ...(rollbackError === undefined ? {} : { rollbackError }),
    }
  }

  private async rollbackCompletedSteps(): Promise<unknown> {
    let firstError: unknown
    for (const step of [...this.plan.steps].reverse()) {
      if (step.status !== 'completed') continue
      const rollback = this.rollbacks.get(step.stepId)
      if (rollback) {
        try {
          await rollback()
        } catch (error) {
          firstError ??= error
        }
      }
      this.rollbacks.delete(step.stepId)
      removeStepOutputs(this.plan, step.stepId)
      step.status = 'pending'
    }
    return firstError
  }

  private skipWithDependents(stepId: string): void {
    const step = this.requireStep(stepId)
    removeStepOutputs(this.plan, stepId)
    step.status = 'skipped'
    this.rollbacks.delete(stepId)
    for (const dependent of this.plan.steps.filter((candidate) => candidate.dependsOn.includes(stepId))) {
      if (dependent.status === 'pending' || dependent.status === 'failed') this.skipWithDependents(dependent.stepId)
    }
  }

  private requireStep(stepId: string): TaskStep {
    const step = this.plan.steps.find((candidate) => candidate.stepId === stepId)
    if (!step) throw new WorkflowExecutionError(`步骤不存在：${stepId}`)
    return step
  }

  private emit(): void {
    const snapshot = this.getSnapshot()
    for (const listener of this.listeners) listener(snapshot)
  }
}
