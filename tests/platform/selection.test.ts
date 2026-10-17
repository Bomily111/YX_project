import { describe, expect, it } from 'vitest'
import type { TaskContext } from '@/platform/context/TaskContext'
import { ResourceRegistry } from '@/platform/resources/ResourceRegistry'
import type { SceneResource, SceneModule } from '@/platform/resources/types'
import type { TaskStep } from '@/platform/tasks/TaskStep'
import { ResourceSelector } from '@/platform/selection/ResourceSelector'
import { calculateTaskRelevance } from '@/platform/selection/TaskRelevance'
import type { ScenePlan } from '@/platform/selection/ScenePlan'

const resource = (
  id: string,
  options: {
    module?: SceneModule
    type?: string
    range?: { start: number; end: number }
    processes?: string[]
    states?: string[]
    dependencies?: string[]
    memory?: number
  } = {},
): SceneResource => ({
  id,
  module: options.module ?? 'support',
  type: options.type ?? 'initial-support',
  chainageRange: options.range,
  processes: options.processes ?? [],
  states: options.states ?? [],
  dependencies: options.dependencies,
  estimatedMemoryMb: options.memory,
  load: async () => undefined,
  unload: async () => undefined,
})

const task = (overrides: Partial<TaskContext> = {}): TaskContext => ({
  taskId: 'task-selection',
  taskType: 'quality-check',
  description: '检查初期支护',
  tunnelId: 'main',
  chainageRange: { start: 100, end: 200 },
  process: 'support-design',
  targetTypes: ['initial-support'],
  targetState: 'installed',
  ...overrides,
})

const step = (overrides: Partial<TaskStep> = {}): TaskStep => ({
  stepId: 'support-check',
  name: '支护检查',
  module: 'support',
  dependsOn: [],
  inputKeys: ['task.chainageRange'],
  outputKeys: ['support.result'],
  action: 'support.check',
  completionRule: { requiredOutputs: ['support.result'] },
  status: 'pending',
  ...overrides,
})

describe('TaskRelevance', () => {
  it('scores an exact type, range, process and state match as focus', () => {
    const result = calculateTaskRelevance(task(), step(), resource('support.exact', {
      range: { start: 90, end: 210 },
      processes: ['support-design'],
      states: ['installed'],
    }))
    expect(result.score).toBe(1)
    expect(result.role).toBe('focus')
    expect(result.breakdown).toEqual({
      typeMatch: 1,
      mileageMatch: 1,
      processMatch: 1,
      stateMatch: 1,
    })
  })

  it('uses the requested-range overlap ratio for mileage relevance', () => {
    const result = calculateTaskRelevance(task(), step(), resource('support.partial', {
      range: { start: 150, end: 250 },
      processes: ['support-design'],
      states: ['installed'],
    }))
    expect(result.breakdown.mileageMatch).toBe(0.5)
    expect(result.score).toBeCloseTo(0.85)
  })

  it('treats absent task criteria and unbounded resources as non-conflicting', () => {
    const result = calculateTaskRelevance(
      task({ process: undefined, targetState: undefined, targetTypes: ['unknown'] }),
      step(),
      resource('support.general'),
    )
    expect(result.breakdown).toEqual(expect.objectContaining({
      typeMatch: 0.7,
      mileageMatch: 1,
      processMatch: 1,
      stateMatch: 1,
    }))
    expect(result.role).toBe('focus')
  })

  it('rejects non-normalized weights and inverted thresholds', () => {
    const target = resource('support.invalid-config')
    expect(() => calculateTaskRelevance(task(), step(), target, {
      weights: { type: 1, mileage: 1, process: 0, state: 0 },
      thresholds: { focus: 0.7, reference: 0.35 },
    })).toThrow('总和为 1')
    expect(() => calculateTaskRelevance(task(), step(), target, {
      weights: { type: 0.25, mileage: 0.25, process: 0.25, state: 0.25 },
      thresholds: { focus: 0.3, reference: 0.5 },
    })).toThrow('阈值')
  })
})

describe('ResourceSelector', () => {
  const registryWithResources = (): ResourceRegistry => {
    const registry = new ResourceRegistry()
    registry.registerAll([
      resource('common.tunnel', { module: 'common', type: 'tunnel', memory: 10 }),
      resource('support.focus', {
        range: { start: 90, end: 210 },
        processes: ['support-design'],
        states: ['installed'],
        dependencies: ['common.tunnel'],
        memory: 6,
      }),
      resource('support.reference', {
        type: 'steel-arch',
        range: { start: 300, end: 400 },
        dependencies: ['common.tunnel'],
        memory: 5,
      }),
      resource('blast.unrelated', { module: 'blast', type: 'blast-effect', memory: 7 }),
    ])
    return registry
  }

  it('selects only the step module and expands dependencies in load order', () => {
    const plan = new ResourceSelector(registryWithResources()).createScenePlan(
      task({ process: undefined, targetState: undefined }),
      step(),
    )
    expect(plan.rootResourceIds).toEqual(['support.focus', 'support.reference'])
    expect(plan.loadOrder).toEqual(['common.tunnel', 'support.focus', 'support.reference'])
    expect(plan.decisions.map(({ resourceId, role }) => [resourceId, role])).toEqual([
      ['support.focus', 'focus'],
      ['support.reference', 'reference'],
      ['common.tunnel', 'dependency'],
    ])
    expect(plan.decisions.some(({ resourceId }) => resourceId === 'blast.unrelated')).toBe(false)
  })

  it('applies the memory budget greedily in relevance order', () => {
    const plan = new ResourceSelector(registryWithResources()).createScenePlan(
      task({ process: undefined, targetState: undefined, constraints: { maxLoadMb: 16 } }),
      step(),
    )
    expect(plan.rootResourceIds).toEqual(['support.focus'])
    expect(plan.estimatedIncrementalMemoryMb).toBe(16)
    expect(plan.decisions.find(({ resourceId }) => resourceId === 'support.reference')).toEqual(
      expect.objectContaining({ role: 'excluded' }),
    )
    expect(plan.warnings).toContain('资源 support.reference 超出加载预算 16 MB')
  })

  it('does not charge already loaded dependencies against the incremental budget', () => {
    const plan = new ResourceSelector(registryWithResources()).createScenePlan(
      task({ constraints: { maxLoadMb: 6 } }),
      step(),
      { loadedResourceIds: new Set(['common.tunnel']) },
    )
    expect(plan.rootResourceIds).toEqual(['support.focus'])
    expect(plan.estimatedIncrementalMemoryMb).toBe(6)
  })

  it('generates releases by comparing with the previous scene plan', () => {
    const registry = registryWithResources()
    const selector = new ResourceSelector(registry)
    const previousPlan: ScenePlan = {
      taskId: 'old',
      stepId: 'old-step',
      rootResourceIds: ['blast.unrelated', 'support.focus'],
      loadOrder: ['blast.unrelated', 'common.tunnel', 'support.focus'],
      releaseResourceIds: [],
      decisions: [],
      estimatedIncrementalMemoryMb: 0,
      relevanceConfig: {
        weights: { type: 0.35, mileage: 0.3, process: 0.2, state: 0.15 },
        thresholds: { focus: 0.7, reference: 0.35 },
      },
      warnings: [],
    }
    const next = selector.createScenePlan(task(), step(), { previousPlan })
    expect(next.releaseResourceIds).toEqual(['blast.unrelated'])
  })

  it('supports an explicit cross-module candidate set and reports an empty selection', () => {
    const registry = registryWithResources()
    const selector = new ResourceSelector(registry)
    const crossModule = selector.createScenePlan(
      task({ targetTypes: ['blast-effect'], process: undefined, targetState: undefined }),
      step(),
      { candidateResourceIds: ['blast.unrelated'] },
    )
    expect(crossModule.rootResourceIds).toEqual(['blast.unrelated'])

    const empty = selector.createScenePlan(task(), step({ module: 'rock' }))
    expect(empty.rootResourceIds).toEqual([])
    expect(empty.warnings).toContain('步骤 support-check 没有可加载的业务资源')
  })
})
