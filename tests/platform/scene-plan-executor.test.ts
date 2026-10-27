import { describe, expect, it, vi } from 'vitest'
import type { TaskContext } from '@/platform/context/TaskContext'
import { ResourceManager } from '@/platform/resources/ResourceManager'
import { ResourceRegistry } from '@/platform/resources/ResourceRegistry'
import type { SceneResource, SceneModule } from '@/platform/resources/types'
import type { ScenePlan } from '@/platform/selection/ScenePlan'
import { ScenePlanExecutor } from '@/platform/selection/ScenePlanExecutor'
import { ResourceSelector } from '@/platform/selection/ResourceSelector'
import { withScenePlan } from '@/platform/selection/ScenePlanWorkflow'
import { WorkflowExecutor } from '@/platform/tasks/WorkflowExecutor'
import type { WorkflowPlan } from '@/platform/tasks/TaskStep'
import { EnhancementPlanner } from '@/platform/enhancement/EnhancementPlanner'
import { EnhancementEngine } from '@/platform/enhancement/EnhancementEngine'

const task = (description = '任务'): TaskContext => ({
  taskId: 'task-scene',
  taskType: 'quality-check',
  description,
  tunnelId: 'main',
  chainageRange: { start: 100, end: 120 },
  targetTypes: ['initial-support'],
})

const relevanceConfig = {
  weights: { type: 0.35, mileage: 0.3, process: 0.2, state: 0.15 },
  thresholds: { focus: 0.7, reference: 0.35 },
}

const scenePlan = (registry: ResourceRegistry, stepId: string, roots: string[]): ScenePlan => ({
  taskId: 'task-scene',
  stepId,
  rootResourceIds: roots,
  loadOrder: registry.resolveLoadOrder(roots).map(({ id }) => id),
  releaseResourceIds: [],
  decisions: [],
  estimatedIncrementalMemoryMb: 0,
  relevanceConfig,
  warnings: [],
})

const makeResource = (
  id: string,
  options: {
    module?: SceneModule
    dependencies?: string[]
    load?: () => Promise<void>
    activate?: () => Promise<void>
    update?: () => Promise<void>
    deactivate?: () => Promise<void>
    resetTaskPlacement?: () => void | Promise<void>
    unload?: () => Promise<void>
    getEnhanceTargets?: SceneResource['getEnhanceTargets']
  } = {},
): SceneResource => ({
  id,
  module: options.module ?? 'support',
  type: 'test',
  processes: [],
  states: [],
  dependencies: options.dependencies,
  load: options.load ?? (async () => undefined),
  activate: options.activate,
  update: options.update,
  deactivate: options.deactivate,
  resetTaskPlacement: options.resetTaskPlacement,
  unload: options.unload ?? (async () => undefined),
  getEnhanceTargets: options.getEnhanceTargets,
})

const loadContext = { viewer: {} as any }

const singleStepWorkflow = (): WorkflowPlan => ({
  taskId: 'task-scene',
  currentStepId: 'support-step',
  sharedContext: {},
  steps: [{
    stepId: 'support-step',
    name: '支护检查',
    module: 'support',
    dependsOn: [],
    inputKeys: ['task.chainageRange'],
    outputKeys: ['support.result'],
    action: 'support.check',
    completionRule: { requiredOutputs: ['support.result'] },
    status: 'pending',
  }],
})

describe('ScenePlanExecutor', () => {
  it('restores a task placement while a structure-tree lease keeps the model loaded', async () => {
    const resetPlacement = vi.fn()
    const registry = new ResourceRegistry()
    registry.register(makeResource('support.legacy-steel-frame', { resetTaskPlacement: resetPlacement }))
    const manager = new ResourceManager(registry)
    await manager.load(['support.legacy-steel-frame'], loadContext)
    const executor = new ScenePlanExecutor(registry, manager)
    expect((await executor.apply(scenePlan(registry, 'scene', ['support.legacy-steel-frame']), task(), loadContext)).status).toBe('applied')
    expect((await executor.clear(loadContext)).status).toBe('cleared')
    expect(resetPlacement).toHaveBeenCalledOnce()
    expect(manager.getState('support.legacy-steel-frame')).toMatchObject({ status: 'loaded', references: 1 })
    await manager.release(['support.legacy-steel-frame'])
  })

  it('loads the next plan before releasing the previous plan', async () => {
    const events: string[] = []
    const registry = new ResourceRegistry()
    registry.registerAll([
      makeResource('common.base', { module: 'common' }),
      makeResource('support.a', {
        dependencies: ['common.base'],
        load: async () => { events.push('load:a') },
        unload: async () => { events.push('unload:a') },
      }),
      makeResource('support.b', {
        dependencies: ['common.base'],
        load: async () => { events.push('load:b') },
        activate: async () => { events.push('activate:b') },
      }),
    ])
    const manager = new ResourceManager(registry)
    const executor = new ScenePlanExecutor(registry, manager)
    await executor.apply(scenePlan(registry, 'a', ['support.a']), task(), loadContext)
    events.length = 0

    const result = await executor.apply(scenePlan(registry, 'b', ['support.b']), task(), loadContext)

    expect(result.status).toBe('applied')
    expect(events).toEqual(['load:b', 'activate:b', 'unload:a'])
    expect(manager.getState('common.base').references).toBe(1)
    expect(manager.getState('support.a').status).toBe('idle')
    expect(manager.getState('support.b').status).toBe('loaded')
  })

  it('updates retained roots without incrementing their references', async () => {
    const load = vi.fn(async () => undefined)
    const update = vi.fn(async () => undefined)
    const registry = new ResourceRegistry()
    registry.register(makeResource('support.a', { load, update }))
    const manager = new ResourceManager(registry)
    const plan = scenePlan(registry, 'a', ['support.a'])
    const executor = new ScenePlanExecutor(registry, manager)
    await executor.apply(plan, task('第一次'), loadContext)

    const result = await executor.apply({ ...plan, stepId: 'a-again' }, task('第二次'), loadContext)

    expect(result.status).toBe('applied')
    expect(load).toHaveBeenCalledOnce()
    expect(update).toHaveBeenCalledOnce()
    expect(manager.getState('support.a').references).toBe(1)
  })

  it('preserves the previous plan when loading a new resource fails', async () => {
    const registry = new ResourceRegistry()
    registry.registerAll([
      makeResource('support.a'),
      makeResource('support.b', { load: async () => { throw new Error('load b failed') } }),
    ])
    const manager = new ResourceManager(registry)
    const planA = scenePlan(registry, 'a', ['support.a'])
    const executor = new ScenePlanExecutor(registry, manager)
    await executor.apply(planA, task(), loadContext)

    const result = await executor.apply(scenePlan(registry, 'b', ['support.b']), task(), loadContext)

    expect(result.status).toBe('failed')
    expect(executor.getActiveState().plan).toBe(planA)
    expect(manager.getState('support.a')).toMatchObject({ status: 'loaded', references: 1 })
    expect(manager.getState('support.b')).toMatchObject({ status: 'failed', references: 0 })
  })

  it('restores old resources and releases new ones when old release fails', async () => {
    const loadA = vi.fn(async () => undefined)
    let firstUnload = true
    const registry = new ResourceRegistry()
    registry.registerAll([
      makeResource('common.base', { module: 'common' }),
      makeResource('support.a', {
        dependencies: ['common.base'],
        load: loadA,
        unload: async () => {
          if (firstUnload) {
            firstUnload = false
            throw new Error('unload a failed')
          }
        },
      }),
      makeResource('support.b', { dependencies: ['common.base'] }),
    ])
    const manager = new ResourceManager(registry)
    const planA = scenePlan(registry, 'a', ['support.a'])
    const executor = new ScenePlanExecutor(registry, manager)
    await executor.apply(planA, task(), loadContext)

    const result = await executor.apply(scenePlan(registry, 'b', ['support.b']), task(), loadContext)

    expect(result.status).toBe('failed')
    expect(result.rollbackErrors).toEqual([])
    expect(executor.getActiveState().plan).toBe(planA)
    expect(loadA).toHaveBeenCalledTimes(2)
    expect(manager.getState('support.a')).toMatchObject({ status: 'loaded', references: 1 })
    expect(manager.getState('support.b')).toMatchObject({ status: 'idle', references: 0 })
    expect(manager.getState('common.base').references).toBe(1)
  })

  it('validates task identity and registry-derived load order without changing active state', async () => {
    const registry = new ResourceRegistry()
    registry.register(makeResource('support.a'))
    const manager = new ResourceManager(registry)
    const executor = new ScenePlanExecutor(registry, manager)
    const plan = scenePlan(registry, 'a', ['support.a'])

    const wrongTask = await executor.apply(plan, { ...task(), taskId: 'other' }, loadContext)
    expect(wrongTask.status).toBe('failed')
    const wrongOrder = await executor.apply({ ...plan, loadOrder: [] }, task(), loadContext)
    expect(wrongOrder.status).toBe('failed')
    expect(executor.getActiveState()).toEqual({ plan: undefined, task: undefined })
    expect(manager.getState('support.a').references).toBe(0)
  })

  it('clears the active plan and can recover a failed clear', async () => {
    let failUnload = true
    const registry = new ResourceRegistry()
    registry.register(makeResource('support.a', {
      unload: async () => {
        if (failUnload) {
          failUnload = false
          throw new Error('clear failed')
        }
      },
    }))
    const manager = new ResourceManager(registry)
    const plan = scenePlan(registry, 'a', ['support.a'])
    const executor = new ScenePlanExecutor(registry, manager)
    await executor.apply(plan, task(), loadContext)

    const failed = await executor.clear(loadContext)
    expect(failed.status).toBe('failed')
    expect(failed.rollbackErrors).toEqual([])
    expect(executor.getActiveState().plan).toBe(plan)
    expect(manager.getState('support.a')).toMatchObject({ status: 'loaded', references: 1 })

    const cleared = await executor.clear(loadContext)
    expect(cleared.status).toBe('cleared')
    expect(executor.getActiveState()).toEqual({ plan: undefined, task: undefined })
    expect(manager.getState('support.a').status).toBe('idle')
  })

  it('clears the applied scene automatically when the wrapped business action fails', async () => {
    const registry = new ResourceRegistry()
    registry.register(makeResource('support.a'))
    const manager = new ResourceManager(registry)
    const sceneExecutor = new ScenePlanExecutor(registry, manager)
    const wrapped = withScenePlan(
      async () => { throw new Error('business failed') },
      {
        selector: new ResourceSelector(registry),
        executor: sceneExecutor,
        loadContext,
        selectorOptions: () => ({ candidateResourceIds: ['support.a'] }),
      },
    )
    const workflow = new WorkflowExecutor(
      task(),
      singleStepWorkflow(),
      () => wrapped,
    )

    const [result] = await workflow.run()

    expect(result.status).toBe('failed')
    expect(result.rollbackError).toBeUndefined()
    expect(sceneExecutor.getActiveState()).toEqual({ plan: undefined, task: undefined })
    expect(manager.getState('support.a')).toMatchObject({ status: 'idle', references: 0 })
  })

  it('restores the previous scene when WorkflowExecutor resets a completed wrapped step', async () => {
    const registry = new ResourceRegistry()
    registry.registerAll([makeResource('support.a'), makeResource('support.b')])
    const manager = new ResourceManager(registry)
    const sceneExecutor = new ScenePlanExecutor(registry, manager)
    const previous = scenePlan(registry, 'previous', ['support.a'])
    await sceneExecutor.apply(previous, task(), loadContext)
    const wrapped = withScenePlan(
      async () => ({ outputs: { 'support.result': 'ok' } }),
      {
        selector: new ResourceSelector(registry),
        executor: sceneExecutor,
        loadContext,
        selectorOptions: () => ({ candidateResourceIds: ['support.b'] }),
      },
    )
    const workflow = new WorkflowExecutor(
      task(),
      singleStepWorkflow(),
      () => wrapped,
    )
    await workflow.run()
    expect(sceneExecutor.getActiveState().plan?.rootResourceIds).toEqual(['support.b'])

    await workflow.reset()

    expect(sceneExecutor.getActiveState().plan).toBe(previous)
    expect(manager.getState('support.a')).toMatchObject({ status: 'loaded', references: 1 })
    expect(manager.getState('support.b')).toMatchObject({ status: 'idle', references: 0 })
  })

  it('applies resources and enhancement together, then resets both', async () => {
    const model = {
      show: false,
      silhouetteColor: { red: 1, green: 1, blue: 1, alpha: 1 },
      silhouetteSize: 0,
    }
    const registry = new ResourceRegistry()
    registry.register(makeResource('support.a', {
      getEnhanceTargets: () => [{ id: 'support.model', type: 'model', object: model as any }],
    }))
    const manager = new ResourceManager(registry)
    const sceneExecutor = new ScenePlanExecutor(registry, manager)
    const enhancementEngine = new EnhancementEngine(registry)
    const wrapped = withScenePlan(
      async () => ({ outputs: { 'support.result': 'ok' } }),
      {
        selector: new ResourceSelector(registry),
        executor: sceneExecutor,
        loadContext,
        selectorOptions: () => ({ candidateResourceIds: ['support.a'] }),
        enhancement: {
          planner: new EnhancementPlanner(registry),
          engine: enhancementEngine,
        },
      },
    )
    const workflow = new WorkflowExecutor(task(), singleStepWorkflow(), () => wrapped)

    await workflow.run()
    expect(model.show).toBe(true)
    expect(model.silhouetteSize).toBe(3)
    expect(manager.getState('support.a').status).toBe('loaded')
    expect(enhancementEngine.getActivePlan()).toBeDefined()

    await workflow.reset()
    expect(model.show).toBe(false)
    expect(model.silhouetteSize).toBe(0)
    expect(manager.getState('support.a').status).toBe('idle')
    expect(enhancementEngine.getActivePlan()).toBeUndefined()
  })

  it('removes the new scene when enhancement fails before the business action', async () => {
    const model = { show: false }
    const business = vi.fn(async () => ({ outputs: { 'support.result': 'unexpected' } }))
    const registry = new ResourceRegistry()
    registry.register(makeResource('support.a', {
      getEnhanceTargets: () => [{ id: 'support.model', type: 'model', object: model as any }],
    }))
    const manager = new ResourceManager(registry)
    const sceneExecutor = new ScenePlanExecutor(registry, manager)
    const wrapped = withScenePlan(business, {
      selector: new ResourceSelector(registry),
      executor: sceneExecutor,
      loadContext,
      selectorOptions: () => ({ candidateResourceIds: ['support.a'] }),
      enhancement: {
        planner: new EnhancementPlanner(registry),
        engine: new EnhancementEngine(registry),
      },
    })
    const workflow = new WorkflowExecutor(task(), singleStepWorkflow(), () => wrapped)

    const [result] = await workflow.run()

    expect(result.status).toBe('failed')
    expect(business).not.toHaveBeenCalled()
    expect(model.show).toBe(false)
    expect(sceneExecutor.getActiveState().plan).toBeUndefined()
    expect(manager.getState('support.a')).toMatchObject({ status: 'idle', references: 0 })
  })

  it('restores the previous scene and enhancement after a business failure', async () => {
    const modelA = {
      show: false,
      silhouetteColor: { red: 1, green: 1, blue: 1, alpha: 1 },
      silhouetteSize: 0,
    }
    const modelB = {
      show: false,
      silhouetteColor: { red: 1, green: 1, blue: 1, alpha: 1 },
      silhouetteSize: 0,
    }
    const registry = new ResourceRegistry()
    registry.registerAll([
      makeResource('support.a', {
        getEnhanceTargets: () => [{ id: 'model-a', type: 'model', object: modelA as any }],
      }),
      makeResource('support.b', {
        getEnhanceTargets: () => [{ id: 'model-b', type: 'model', object: modelB as any }],
      }),
    ])
    const manager = new ResourceManager(registry)
    const sceneExecutor = new ScenePlanExecutor(registry, manager)
    const enhancementPlanner = new EnhancementPlanner(registry)
    const enhancementEngine = new EnhancementEngine(registry)
    const previousScene: ScenePlan = {
      ...scenePlan(registry, 'previous', ['support.a']),
      decisions: [{
        resourceId: 'support.a', role: 'focus', relevance: 1,
        reasons: [], estimatedMemoryMb: 0,
      }],
    }
    await sceneExecutor.apply(previousScene, task(), loadContext)
    const previousEnhancement = enhancementPlanner.create(previousScene)
    await enhancementEngine.apply(previousEnhancement)
    expect(modelA.show).toBe(true)

    const wrapped = withScenePlan(
      async () => { throw new Error('business failed') },
      {
        selector: new ResourceSelector(registry),
        executor: sceneExecutor,
        loadContext,
        selectorOptions: () => ({ candidateResourceIds: ['support.b'] }),
        enhancement: { planner: enhancementPlanner, engine: enhancementEngine },
      },
    )
    const workflow = new WorkflowExecutor(task(), singleStepWorkflow(), () => wrapped)
    const [result] = await workflow.run()

    expect(result.status).toBe('failed')
    expect(result.rollbackError).toBeUndefined()
    expect(sceneExecutor.getActiveState().plan).toBe(previousScene)
    expect(enhancementEngine.getActivePlan()).toBe(previousEnhancement)
    expect(modelA.show).toBe(true)
    expect(modelA.silhouetteSize).toBe(3)
    expect(modelB.show).toBe(false)
    expect(modelB.silhouetteSize).toBe(0)
    expect(manager.getState('support.a').status).toBe('loaded')
    expect(manager.getState('support.b').status).toBe('idle')
  })
})
