import type { ResourceLoadContext } from '@/platform/resources/types'
import type { StepActionContext, StepActionHandler } from '@/platform/tasks/WorkflowExecutor'
import { EnhancementEngine } from '@/platform/enhancement/EnhancementEngine'
import { EnhancementPlanner, type EnhancementPlannerOptions } from '@/platform/enhancement/EnhancementPlanner'
import type { EnhancementPlan } from '@/platform/enhancement/types'
import type { ScenePlan } from './ScenePlan'
import { ResourceSelector, type ResourceSelectorOptions } from './ResourceSelector'
import { ScenePlanExecutor, type ActiveScenePlanState } from './ScenePlanExecutor'

export interface ScenePlanWorkflowOptions {
  selector: ResourceSelector
  executor: ScenePlanExecutor
  sceneTask?: (context: StepActionContext) => StepActionContext['task']
  loadContext:
    | Omit<ResourceLoadContext, 'task'>
    | ((context: StepActionContext) => Omit<ResourceLoadContext, 'task'>)
  selectorOptions?: (
    context: StepActionContext,
    previous: ActiveScenePlanState,
  ) => Omit<ResourceSelectorOptions, 'previousPlan' | 'loadedResourceIds'>
  enhancement?: {
    planner: EnhancementPlanner
    engine: EnhancementEngine
    plannerOptions?:
      | EnhancementPlannerOptions
      | ((context: StepActionContext, scenePlan: ScenePlan) => EnhancementPlannerOptions)
  }
}

const requireApplied = (status: 'applied' | 'failed', error?: unknown): void => {
  if (status === 'failed') throw error instanceof Error ? error : new Error('场景计划应用失败')
}

const throwWithRollbackErrors = (error: unknown, rollbackErrors: readonly unknown[], message: string): never => {
  if (rollbackErrors.length === 0) throw error
  throw new AggregateError([error, ...rollbackErrors], message)
}

/**
 * 为业务步骤增加资源和增强计划事务。执行顺序为资源 → 增强 → 业务；回滚顺序相反。
 */
export function withScenePlan(
  businessHandler: StepActionHandler,
  options: ScenePlanWorkflowOptions,
): StepActionHandler {
  return async (context) => {
    const sceneTask = options.sceneTask?.(context) ?? context.task
    const previous = options.executor.getActiveState()
    const loadContext = typeof options.loadContext === 'function'
      ? options.loadContext(context)
      : options.loadContext
    const selectorOptions = options.selectorOptions?.(context, previous) ?? {}
    const previousEnhancement = options.enhancement?.engine.getActivePlan()
    const scenePlan = options.selector.createScenePlan(sceneTask, context.step, {
      ...selectorOptions,
      previousPlan: previous.plan,
      loadedResourceIds: options.executor.getLoadedResourceIds(),
    })
    let sceneApplied = false

    if (options.enhancement) {
      const resetErrors = await options.enhancement.engine.reset()
      if (resetErrors.length > 0) {
        const restoreErrors: unknown[] = []
        if (previousEnhancement) {
          const restored = await options.enhancement.engine.apply(previousEnhancement)
          if (restored.status === 'failed') restoreErrors.push(restored.error)
        }
        throw new AggregateError(
          [...resetErrors, ...restoreErrors],
          '原增强计划复位失败，未切换场景',
        )
      }
    }

    try {
      const applied = await options.executor.apply(scenePlan, sceneTask, loadContext)
      requireApplied(applied.status, applied.error)
      sceneApplied = true
      if (options.enhancement) {
        const plannerOptions = typeof options.enhancement.plannerOptions === 'function'
          ? options.enhancement.plannerOptions(context, scenePlan)
          : options.enhancement.plannerOptions
        const enhancementPlan: EnhancementPlan = options.enhancement.planner.create(scenePlan, plannerOptions)
        const enhanced = await options.enhancement.engine.apply(enhancementPlan)
        if (enhanced.status === 'failed') {
          throw enhanced.error instanceof Error ? enhanced.error : new Error('增强计划应用失败')
        }
      }
    } catch (error) {
      const rollbackErrors: unknown[] = []
      if (options.enhancement) {
        rollbackErrors.push(...await options.enhancement.engine.reset())
      }
      if (sceneApplied) {
        if (previous.plan && previous.task) {
          const restored = await options.executor.apply(previous.plan, previous.task, loadContext)
          if (restored.status === 'failed') rollbackErrors.push(restored.error)
        } else {
          const cleared = await options.executor.clear(loadContext)
          if (cleared.status === 'failed') rollbackErrors.push(cleared.error)
        }
      }
      if (options.enhancement && previousEnhancement) {
        const restored = await options.enhancement.engine.apply(previousEnhancement)
        if (restored.status === 'failed') rollbackErrors.push(restored.error)
      }
      throwWithRollbackErrors(error, rollbackErrors, '场景或增强计划应用失败且未能完整恢复')
    }

    let businessRollback: (() => void | Promise<void>) | undefined
    const rollback = async (): Promise<void> => {
      const rollbackErrors: unknown[] = []
      if (businessRollback) {
        try {
          await businessRollback()
        } catch (error) {
          rollbackErrors.push(error)
        }
      }

      if (options.enhancement) {
        rollbackErrors.push(...await options.enhancement.engine.reset())
      }
      if (previous.plan && previous.task) {
        const restored = await options.executor.apply(previous.plan, previous.task, loadContext)
        if (restored.status === 'failed') {
          rollbackErrors.push(restored.error ?? new Error('原场景计划恢复失败'))
        }
      } else {
        const cleared = await options.executor.clear(loadContext)
        if (cleared.status === 'failed') {
          rollbackErrors.push(cleared.error ?? new Error('场景计划清理失败'))
        }
      }
      if (options.enhancement && previousEnhancement) {
        const restored = await options.enhancement.engine.apply(previousEnhancement)
        if (restored.status === 'failed') {
          rollbackErrors.push(restored.error ?? new Error('原增强计划恢复失败'))
        }
      }
      if (rollbackErrors.length > 0) throw new AggregateError(rollbackErrors, '工作流步骤事务回滚失败')
    }
    context.onRollback(rollback)

    const result = await businessHandler({
      ...context,
      onRollback: (registered) => { businessRollback = registered },
    })
    businessRollback = result.rollback ?? businessRollback
    return { ...result, rollback }
  }
}
