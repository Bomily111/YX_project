import { expect, it, vi } from 'vitest'
vi.mock('@/platform/tasks/TaskScenePresentation', () => ({ presentTaskScene: vi.fn(() => () => {}), taskPresentationProfile: () => ({}) }))
import { createSceneExplorationExecutor } from '@/platform/tasks/samples/SceneExplorationWorkflow'
import { ResourceRegistry } from '@/platform/resources/ResourceRegistry'
import { ResourceManager } from '@/platform/resources/ResourceManager'
import { ResourceSelector } from '@/platform/selection/ResourceSelector'
import { ScenePlanExecutor } from '@/platform/selection/ScenePlanExecutor'
import { EnhancementPlanner } from '@/platform/enhancement/EnhancementPlanner'
import { EnhancementEngine } from '@/platform/enhancement/EnhancementEngine'

it.each([false, true])('constructs everything before final enhancement; rollback failure=%s', async fail => {
  const registry = new ResourceRegistry(), events: string[] = []
  for (const [id, module] of [['rock.design-grade', 'rock'], ['support.scene', 'support']] as const) registry.register({
    id, module, type: id, processes: [], states: [], chainageRange: { start: 1116, end: 9400 },
    async load() { events.push(`load:${id}`) }, async unload() { events.push(`unload:${id}`) },
    getEnhanceTargets: () => [{ id: `${id}.chart`, type: 'chart', recommendedEnhancements: ['chart'],
      adapters: { chart: async () => { events.push(`enhance:${id}`); if (fail) throw new Error('injected enhancement failure'); return () => { events.push(`undo:${id}`) } } } }],
  })
  const manager = new ResourceManager(registry)
  const result = createSceneExplorationExecutor({ taskId: 'final-phase', taskType: 'scene-exploration', description: '构建后增强', tunnelId: 'YK', chainageRange: { start: 1346, end: 1346 }, targetTypes: ['scene'] },
    ['rock.design-grade', 'support.scene'], registry, { selector: new ResourceSelector(registry), executor: new ScenePlanExecutor(registry, manager), loadContext: { viewer: {} as any },
      targetChainage: 1346, assemblyModes: ['replace', 'retain'], enhanceAfterAssembly: true,
      enhancement: { planner: new EnhancementPlanner(registry), engine: new EnhancementEngine(registry) } })
  expect(result.executor.plan.steps).toHaveLength(3)
  await result.executor.executeCurrent(); await result.executor.executeCurrent()
  expect(events.some(event => event.startsWith('enhance:'))).toBe(false)
  const final = await result.executor.executeCurrent()
  expect(events.findIndex(event => event.startsWith('enhance:'))).toBeGreaterThan(events.indexOf('load:support.scene'))
  expect(final.status).toBe(fail ? 'failed' : 'completed')
  if (fail) expect(manager.getState('rock.design-grade').status).toBe('idle')
  else {
    expect((result.executor.plan.sharedContext['scene.stage.3'].value as any).phase).toBe('constructed-then-enhanced')
    await result.executor.reset()
    expect(manager.getState('support.scene').status).toBe('idle')
  }
})
