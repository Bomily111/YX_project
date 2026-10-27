import { describe, expect, it, vi } from 'vitest'
import { ResourceRegistry } from '@/platform/resources/ResourceRegistry'
import type { EnhanceTarget, SceneResource } from '@/platform/resources/types'
import type { ScenePlan } from '@/platform/selection/ScenePlan'
import { EnhancementPlanner } from '@/platform/enhancement/EnhancementPlanner'
import { EnhancementEngine } from '@/platform/enhancement/EnhancementEngine'
import type { EnhancementDirective, EnhancementPlan } from '@/platform/enhancement/types'
import { getEnhancementActivitySnapshot } from '@/platform/enhancement/EnhancementActivity'

interface FakeVisual {
  show: boolean
  opacity: number
  silhouetteColor: Record<string, number>
  silhouetteSize: number
}

const visual = (): FakeVisual => ({
  show: false,
  opacity: 1,
  silhouetteColor: { red: 1, green: 1, blue: 1, alpha: 1 },
  silhouetteSize: 0,
})

const enhanceResource = (
  id: string,
  targetId: string,
  object: FakeVisual,
  targetOptions: Partial<EnhanceTarget> = {},
): SceneResource => ({
  id,
  module: 'support',
  type: 'support-model',
  processes: [],
  states: [],
  load: async () => undefined,
  unload: async () => undefined,
  getEnhanceTargets: () => [{ id: targetId, type: 'model', object: object as any, ...targetOptions }],
})

const scenePlan = (decisions: ScenePlan['decisions']): ScenePlan => ({
  taskId: 'task-enhance',
  stepId: 'step-enhance',
  rootResourceIds: decisions.map(({ resourceId }) => resourceId),
  loadOrder: decisions.map(({ resourceId }) => resourceId),
  releaseResourceIds: [],
  decisions,
  estimatedIncrementalMemoryMb: 0,
  relevanceConfig: {
    weights: { type: 0.35, mileage: 0.3, process: 0.2, state: 0.15 },
    thresholds: { focus: 0.7, reference: 0.35 },
  },
  warnings: [],
})

const directive = (overrides: Partial<EnhancementDirective> = {}): EnhancementDirective => ({
  id: 'directive-visibility',
  resourceId: 'support.focus',
  targetId: 'target-focus',
  strategy: 'visibility',
  conflictGroup: 'visibility',
  priority: 90,
  parameters: { visible: true },
  ...overrides,
})

const enhancementPlan = (directives: EnhancementDirective[]): EnhancementPlan => ({
  taskId: 'task-enhance',
  stepId: 'step-enhance',
  directives,
})

describe('EnhancementPlanner', () => {
  it('creates highlight directives for focus and opacity directives for references', () => {
    const focus = visual()
    const reference = visual()
    const registry = new ResourceRegistry()
    registry.registerAll([
      enhanceResource('support.focus', 'target-focus', focus),
      enhanceResource('support.reference', 'target-reference', reference),
    ])
    const plan = new EnhancementPlanner(registry).create(scenePlan([
      {
        resourceId: 'support.focus', role: 'focus', relevance: 1,
        reasons: [], estimatedMemoryMb: 1,
      },
      {
        resourceId: 'support.reference', role: 'reference', relevance: 0.5,
        reasons: [], estimatedMemoryMb: 1,
      },
    ]))

    expect(plan.directives.map(({ targetId, strategy }) => [targetId, strategy])).toEqual([
      ['target-focus', 'visibility'],
      ['target-focus', 'highlight'],
      ['target-reference', 'visibility'],
      ['target-reference', 'opacity'],
    ])
  })

  it('validates visual parameters', () => {
    const registry = new ResourceRegistry()
    registry.register(enhanceResource('support.focus', 'target-focus', visual()))
    const planner = new EnhancementPlanner(registry)
    const plan = scenePlan([{
      resourceId: 'support.focus', role: 'reference', relevance: 0.5,
      reasons: [], estimatedMemoryMb: 1,
    }])
    expect(() => planner.create(plan, { referenceOpacity: 2 })).toThrow('0–1')
    expect(() => planner.create(plan, { focusOutlineWidth: Number.NaN })).toThrow('非负有限数')
  })

  it('allows a context view to keep recommended labels while removing focus outlines', () => {
    const registry = new ResourceRegistry()
    registry.register(enhanceResource('support.focus', 'target-focus', visual(), {
      adapters: { label: () => () => undefined },
      recommendedEnhancements: ['label'],
    }))
    const plan = new EnhancementPlanner(registry).create(scenePlan([{
      resourceId: 'support.focus', role: 'focus', relevance: 1,
      reasons: [], estimatedMemoryMb: 1,
    }]), { highlightFocus: false })
    expect(plan.directives.map(({ strategy }) => strategy)).toEqual(['visibility', 'label'])
  })

  it('only plans advanced strategies explicitly recommended and implemented by a target', () => {
    const registry = new ResourceRegistry()
    registry.register(enhanceResource('support.focus', 'target-focus', visual(), {
      adapters: {
        section: () => () => undefined,
        label: () => () => undefined,
        'standard-view': () => () => undefined,
        chart: () => () => undefined,
      },
      recommendedEnhancements: ['section', 'label', 'standard-view', 'chart'],
      enhancementParameters: { label: { visible: true } },
    }))

    const plan = new EnhancementPlanner(registry).create(scenePlan([{
      resourceId: 'support.focus', role: 'focus', relevance: 1,
      reasons: [], estimatedMemoryMb: 1,
    }]))

    expect(plan.directives.map(({ strategy }) => strategy)).toEqual([
      'visibility', 'highlight', 'section', 'label', 'standard-view', 'chart',
    ])
    expect(plan.directives.find(({ strategy }) => strategy === 'label')?.parameters).toEqual({ visible: true })
  })

  it('plans adapter-only targets without inventing Cesium visibility or highlight operations', () => {
    const registry = new ResourceRegistry()
    registry.register(enhanceResource('support.focus', 'chart-only', undefined, {
      adapters: { chart: () => () => undefined },
      recommendedEnhancements: ['chart'],
    }))

    const plan = new EnhancementPlanner(registry).create(scenePlan([{
      resourceId: 'support.focus', role: 'focus', relevance: 1,
      reasons: [], estimatedMemoryMb: 1,
    }]))

    expect(plan.directives.map(({ strategy }) => strategy)).toEqual(['chart'])
  })
})

describe('EnhancementEngine', () => {
  const setup = () => {
    const object = visual()
    const registry = new ResourceRegistry()
    registry.register(enhanceResource('support.focus', 'target-focus', object))
    return { object, registry, engine: new EnhancementEngine(registry) }
  }

  it('applies visibility and highlight, then restores the exact original state', async () => {
    const { object, engine } = setup()
    const originalColor = object.silhouetteColor
    const plan = enhancementPlan([
      directive(),
      directive({
        id: 'directive-highlight',
        strategy: 'highlight',
        conflictGroup: 'color',
        priority: 60,
        parameters: {
          color: { red: 1, green: 0.5, blue: 0, alpha: 1 },
          width: 3,
        },
      }),
    ])

    expect((await engine.apply(plan)).status).toBe('applied')
    expect(object.show).toBe(true)
    expect(object.silhouetteColor).toEqual({ red: 1, green: 0.5, blue: 0, alpha: 1 })
    expect(object.silhouetteSize).toBe(3)

    expect(await engine.reset()).toEqual([])
    expect(object.show).toBe(false)
    expect(object.silhouetteColor).toBe(originalColor)
    expect(object.silhouetteSize).toBe(0)
  })

  it('applies reference opacity and restores it', async () => {
    const { object, engine } = setup()
    const plan = enhancementPlan([directive({
      id: 'directive-opacity',
      strategy: 'opacity',
      conflictGroup: 'occlusion',
      priority: 40,
      parameters: { value: 0.35 },
    })])
    await engine.apply(plan)
    expect(object.opacity).toBe(0.35)
    await engine.reset()
    expect(object.opacity).toBe(1)
  })

  it('suppresses lower-priority strategies in the same target conflict group', async () => {
    const object = visual()
    const section = vi.fn(() => () => undefined)
    const registry = new ResourceRegistry()
    registry.register(enhanceResource('support.focus', 'target-focus', object, {
      adapters: { section },
    }))
    const engine = new EnhancementEngine(registry)
    const result = await engine.apply(enhancementPlan([
      directive({
        id: 'opacity', strategy: 'opacity', conflictGroup: 'occlusion',
        priority: 40, parameters: { value: 0.3 },
      }),
      directive({
        id: 'section', strategy: 'section', conflictGroup: 'occlusion',
        priority: 80, parameters: {},
      }),
    ]))

    expect(section).toHaveBeenCalledOnce()
    expect(object.opacity).toBe(1)
    expect(result.decisions).toContainEqual({
      directiveId: 'opacity', status: 'suppressed', suppressedBy: 'section',
    })
  })

  it('delegates section, label, standard-view and chart to target adapters and reverses them', async () => {
    const object = visual()
    const active: string[] = []
    const adapter = (name: string) => vi.fn(() => {
      active.push(name)
      return () => { active.splice(active.lastIndexOf(name), 1) }
    })
    const adapters = {
      section: adapter('section'),
      label: adapter('label'),
      'standard-view': adapter('standard-view'),
      chart: adapter('chart'),
    }
    const registry = new ResourceRegistry()
    registry.register(enhanceResource('support.focus', 'target-focus', object, { adapters }))
    const engine = new EnhancementEngine(registry)
    const plan = enhancementPlan((Object.keys(adapters) as Array<keyof typeof adapters>).map((strategy, index) => directive({
      id: `advanced-${strategy}`,
      strategy,
      conflictGroup: strategy === 'standard-view' ? 'camera' : strategy === 'section' ? 'occlusion' : strategy,
      priority: 50 + index,
      parameters: { marker: strategy },
    })))

    expect((await engine.apply(plan)).status).toBe('applied')
    expect(active).toEqual(expect.arrayContaining(['section', 'label', 'standard-view', 'chart']))
    for (const [strategy, handler] of Object.entries(adapters)) {
      expect(handler).toHaveBeenCalledWith({ marker: strategy })
    }
    expect(await engine.reset()).toEqual([])
    expect(active).toEqual([])
  })

  it('keeps repeated advanced apply/reset cycles free of active enhancement residue', async () => {
    const object = visual()
    const active: string[] = []
    const undo = vi.fn((name: string) => {
      const index = active.lastIndexOf(name)
      if (index >= 0) active.splice(index, 1)
    })
    const adapter = (name: string) => vi.fn(() => {
      active.push(name)
      return () => undo(name)
    })
    const adapters = {
      section: adapter('section'),
      label: adapter('label'),
      'standard-view': adapter('standard-view'),
      chart: adapter('chart'),
    }
    const registry = new ResourceRegistry()
    registry.register(enhanceResource('support.focus', 'target-focus', object, { adapters }))
    const engine = new EnhancementEngine(registry)
    const plan = enhancementPlan((Object.keys(adapters) as Array<keyof typeof adapters>).map((strategy, index) => directive({
      id: `stress-${strategy}`,
      strategy,
      conflictGroup: strategy === 'standard-view' ? 'camera' : strategy === 'section' ? 'occlusion' : strategy,
      priority: 50 + index,
    })))
    const baseline = getEnhancementActivitySnapshot()

    for (let cycle = 0; cycle < 25; cycle += 1) {
      expect((await engine.apply(plan)).status).toBe('applied')
      expect(active).toHaveLength(4)
      const during = getEnhancementActivitySnapshot()
      expect(during.activePlans).toBe(baseline.activePlans + 1)
      expect(during.activeDirectives).toBe(baseline.activeDirectives + 4)
      expect(await engine.reset()).toEqual([])
      expect(active).toEqual([])
      expect(getEnhancementActivitySnapshot()).toEqual(baseline)
    }

    expect(undo).toHaveBeenCalledTimes(100)
    for (const handler of Object.values(adapters)) expect(handler).toHaveBeenCalledTimes(25)
  })

  it('restores the previous enhancement plan when a new plan fails', async () => {
    const { object, engine } = setup()
    const previous = enhancementPlan([directive()])
    await engine.apply(previous)
    expect(object.show).toBe(true)

    const failed = await engine.apply(enhancementPlan([
      directive({ id: 'hide', parameters: { visible: false } }),
      directive({
        id: 'missing-handler',
        strategy: 'label',
        conflictGroup: 'label',
        priority: 10,
      }),
    ]))

    expect(failed.status).toBe('failed')
    expect(failed.rollbackErrors).toEqual([])
    expect(engine.getActivePlan()).toBe(previous)
    expect(object.show).toBe(true)
  })

  it('rejects duplicate directives without losing the previous visual state', async () => {
    const { object, engine } = setup()
    const previous = enhancementPlan([directive()])
    await engine.apply(previous)
    const duplicate = directive({ id: 'duplicate' })

    const result = await engine.apply(enhancementPlan([duplicate, { ...duplicate }]))

    expect(result.status).toBe('failed')
    expect(String(result.error)).toContain('指令 ID 重复')
    expect(engine.getActivePlan()).toBe(previous)
    expect(object.show).toBe(true)
  })
})
