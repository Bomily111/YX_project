import type { TaskContext } from '@/platform/context/TaskContext'
import type { ResourceOperationResult } from '@/platform/resources/ResourceManager'
import { ResourceManager } from '@/platform/resources/ResourceManager'
import { ResourceRegistry } from '@/platform/resources/ResourceRegistry'
import type { ResourceLoadContext } from '@/platform/resources/types'
import type { ScenePlan } from './ScenePlan'

export interface ActiveScenePlanState {
  plan?: ScenePlan
  task?: TaskContext
}

export interface ScenePlanExecutionResult {
  status: 'applied' | 'failed'
  plan: ScenePlan
  previousPlan?: ScenePlan
  loaded: readonly ResourceOperationResult[]
  released: readonly ResourceOperationResult[]
  durationMs: number
  error?: unknown
  rollbackErrors: readonly unknown[]
}

export interface ScenePlanClearResult {
  status: 'cleared' | 'failed'
  released: readonly ResourceOperationResult[]
  durationMs: number
  error?: unknown
  rollbackErrors: readonly unknown[]
}

const failedOperation = (results: readonly ResourceOperationResult[]): ResourceOperationResult | undefined => (
  results.find(({ status }) => status === 'failed')
)

const difference = (left: readonly string[], right: ReadonlySet<string>): string[] => (
  left.filter((id) => !right.has(id))
)

/** 将 ScenePlan 事务式应用到 ResourceManager，并维护唯一的活动场景计划。 */
export class ScenePlanExecutor {
  private activePlan?: ScenePlan
  private activeTask?: TaskContext
  private operationQueue: Promise<void> = Promise.resolve()

  constructor(
    private readonly registry: ResourceRegistry,
    private readonly manager: ResourceManager,
    initialState: ActiveScenePlanState = {},
  ) {
    if ((initialState.plan && !initialState.task) || (!initialState.plan && initialState.task)) {
      throw new Error('[ScenePlanExecutor] 初始计划与任务必须同时提供')
    }
    if (initialState.plan && initialState.task) this.validate(initialState.plan, initialState.task)
    this.activePlan = initialState.plan
    this.activeTask = initialState.task
  }

  getActiveState(): ActiveScenePlanState {
    return { plan: this.activePlan, task: this.activeTask }
  }

  getLoadedResourceIds(): ReadonlySet<string> {
    return new Set(
      this.manager.listStates()
        .filter(({ status }) => status === 'loaded')
        .map(({ id }) => id),
    )
  }

  apply(
    plan: ScenePlan,
    task: TaskContext,
    loadContext: Omit<ResourceLoadContext, 'task'>,
  ): Promise<ScenePlanExecutionResult> {
    return this.enqueue(() => this.applyInternal(plan, task, loadContext))
  }

  clear(loadContext: Omit<ResourceLoadContext, 'task'>): Promise<ScenePlanClearResult> {
    return this.enqueue(() => this.clearInternal(loadContext))
  }

  private async applyInternal(
    plan: ScenePlan,
    task: TaskContext,
    loadContext: Omit<ResourceLoadContext, 'task'>,
  ): Promise<ScenePlanExecutionResult> {
    const startedAt = performance.now()
    const previousPlan = this.activePlan
    const previousTask = this.activeTask
    const previousRoots = previousPlan?.rootResourceIds ?? []
    const previousSet = new Set(previousRoots)
    const nextSet = new Set(plan.rootResourceIds)
    const toLoad = difference(plan.rootResourceIds, previousSet)
    const toRelease = difference(previousRoots, nextSet)
    const retained = plan.rootResourceIds.filter((id) => previousSet.has(id))
    let loaded: readonly ResourceOperationResult[] = []
    let released: readonly ResourceOperationResult[] = []
    let newReferencesAcquired = false
    let oldReleaseAttempted = false

    try {
      this.validate(plan, task)
      if (toLoad.length > 0) {
        loaded = await this.manager.load(toLoad, { ...loadContext, task })
        newReferencesAcquired = true
        const loadFailure = failedOperation(loaded)
        if (loadFailure) throw loadFailure.error ?? new Error(`资源加载失败：${loadFailure.id}`)
        await this.manager.activate(toLoad, task)
      }
      if (retained.length > 0) await this.manager.update(retained, task)

      if (toRelease.length > 0) {
        oldReleaseAttempted = true
        for (const id of toRelease) {
          if (!plan.loadOrder.includes(id)) await this.registry.require(id).resetTaskPlacement?.()
        }
        released = await this.manager.release(toRelease)
        const releaseFailure = failedOperation(released)
        if (releaseFailure) throw releaseFailure.error ?? new Error(`资源释放失败：${releaseFailure.id}`)
        const taskPlacedRoots = plan.rootResourceIds.filter(id => this.registry.require(id).resetTaskPlacement)
        if (taskPlacedRoots.length > 0) await this.manager.update(taskPlacedRoots, task)
      }

      this.activePlan = plan
      this.activeTask = task
      return {
        status: 'applied',
        plan,
        previousPlan,
        loaded,
        released,
        durationMs: performance.now() - startedAt,
        rollbackErrors: [],
      }
    } catch (error) {
      const rollbackErrors: unknown[] = []
      if (oldReleaseAttempted && previousPlan && previousTask && toRelease.length > 0) {
        try {
          const restored = await this.manager.load(toRelease, { ...loadContext, task: previousTask })
          const restoreFailure = failedOperation(restored)
          if (restoreFailure) throw restoreFailure.error ?? new Error(`资源恢复失败：${restoreFailure.id}`)
          await this.manager.activate(toRelease, previousTask)
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError)
        }
      }
      if (previousPlan && previousTask && retained.length > 0) {
        try {
          await this.manager.update(retained, previousTask)
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError)
        }
      }
      if (newReferencesAcquired && toLoad.length > 0) {
        try {
          const reverted = await this.manager.release(toLoad)
          const revertFailure = failedOperation(reverted)
          if (revertFailure) throw revertFailure.error ?? new Error(`新资源回滚失败：${revertFailure.id}`)
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError)
        }
      }
      return {
        status: 'failed',
        plan,
        previousPlan,
        loaded,
        released,
        durationMs: performance.now() - startedAt,
        error,
        rollbackErrors,
      }
    }
  }

  private async clearInternal(
    loadContext: Omit<ResourceLoadContext, 'task'>,
  ): Promise<ScenePlanClearResult> {
    const startedAt = performance.now()
    const roots = this.activePlan?.rootResourceIds ?? []
    if (roots.length === 0) {
      this.activePlan = undefined
      this.activeTask = undefined
      return {
        status: 'cleared',
        released: [],
        durationMs: performance.now() - startedAt,
        rollbackErrors: [],
      }
    }
    for (const id of roots) await this.registry.require(id).resetTaskPlacement?.()
    const released = await this.manager.release(roots)
    const failure = failedOperation(released)
    if (failure) {
      const rollbackErrors: unknown[] = []
      try {
        const restored = await this.manager.load(roots, { ...loadContext, task: this.activeTask })
        const restoreFailure = failedOperation(restored)
        if (restoreFailure) throw restoreFailure.error ?? new Error(`资源恢复失败：${restoreFailure.id}`)
        if (this.activeTask) await this.manager.activate(roots, this.activeTask)
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError)
      }
      return {
        status: 'failed',
        released,
        durationMs: performance.now() - startedAt,
        error: failure.error ?? new Error(`资源释放失败：${failure.id}`),
        rollbackErrors,
      }
    }
    this.activePlan = undefined
    this.activeTask = undefined
    return {
      status: 'cleared',
      released,
      durationMs: performance.now() - startedAt,
      rollbackErrors: [],
    }
  }

  private validate(plan: ScenePlan, task: TaskContext): void {
    if (plan.taskId !== task.taskId) throw new Error('[ScenePlanExecutor] ScenePlan 与 TaskContext 的 taskId 不一致')
    if (!plan.stepId.trim()) throw new Error('[ScenePlanExecutor] stepId 不能为空')
    if (new Set(plan.rootResourceIds).size !== plan.rootResourceIds.length) {
      throw new Error('[ScenePlanExecutor] 根资源 ID 不能重复')
    }
    const expectedOrder = this.registry.resolveLoadOrder(plan.rootResourceIds).map(({ id }) => id)
    if (
      expectedOrder.length !== plan.loadOrder.length
      || expectedOrder.some((id, index) => plan.loadOrder[index] !== id)
    ) {
      throw new Error('[ScenePlanExecutor] loadOrder 与资源注册表依赖顺序不一致')
    }
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation, operation)
    this.operationQueue = result.then(() => undefined, () => undefined)
    return result
  }
}
