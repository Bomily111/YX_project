import { describe, expect, it } from 'vitest'
import type * as Cesium from 'cesium'
import { ResourceRegistry } from '@/platform/resources/ResourceRegistry'
import { ResourceManager } from '@/platform/resources/ResourceManager'
import type { SceneResource } from '@/platform/resources/types'
import type { TaskContext } from '@/platform/context/TaskContext'
import { ResourceSelector } from '@/platform/selection/ResourceSelector'
import { ScenePlanExecutor } from '@/platform/selection/ScenePlanExecutor'
import {
  createSceneExplorationExecutor,
  sceneStageTask,
  validateSceneSequence,
  waitForModelReady,
} from '@/platform/tasks/samples/SceneExplorationWorkflow'

const task = (maxLoadMb = 1200): TaskContext => ({
  taskId: 'scene-test', taskType: 'scene-exploration', description: '依次查看围岩、爆破和通风',
  tunnelId: 'demo-tunnel', chainageRange: { start: 278330, end: 278330 },
  targetTypes: ['scene'], constraints: { maxLoadMb },
})

function setup() {
  const registry = new ResourceRegistry()
  const events: string[] = []
  const make = (id: string, module: SceneResource['module'], start: number, end: number, dependencies: string[] = [], memory = 1): SceneResource => ({
    id, module, type: id, chainageRange: { start, end }, processes: [], states: [],
    dependencies, estimatedMemoryMb: memory,
    async load() { events.push(`load:${id}`) },
    async unload() { events.push(`unload:${id}`) },
    async activate() { events.push(`activate:${id}`) },
  })
  registry.register(make('common.tunnel', 'common', 0, 300000, [], 1100))
  registry.register(make('rock.design-grade', 'rock', 278100, 286400, ['common.tunnel']))
  registry.register(make('blast.effect', 'blast', 278330, 278335, ['common.tunnel']))
  registry.register(make('support.scene', 'support', 278100, 278600, ['common.tunnel'], 2))
  registry.register(make('ventilation.scene', 'ventilation', 3805.151, 4005.151))
  registry.register(make('ventilation.steady-cfd', 'ventilation', 3805.151, 4005.151, ['ventilation.scene']))
  const manager = new ResourceManager(registry)
  const executor = new ScenePlanExecutor(registry, manager)
  return { registry, manager, executor, events }
}

describe('智能体动态场景编排', () => {
  it('拒绝任意资源 ID，并且不把跨里程资产当作同一位置', () => {
    const { registry } = setup()
    expect(() => validateSceneSequence(['unexpected.file'], registry)).toThrow('不支持')
    expect(() => validateSceneSequence([], registry)).toThrow('1–8')
    const rock = sceneStageTask(task(), registry.require('rock.design-grade'))
    const vent = sceneStageTask(task(), registry.require('ventilation.steady-cfd'))
    expect(rock.chainageRange).toEqual({ start: 278330, end: 278330 })
    expect(vent.chainageRange).toEqual({ start: 3905.151, end: 3905.151 })
  })

  it('按模型选择的顺序切换资源，复位时释放任务资源', async () => {
    const { registry, manager, executor: sceneExecutor, events } = setup()
    const result = createSceneExplorationExecutor(
      task(), ['rock.design-grade', 'blast.effect', 'ventilation.steady-cfd'], registry,
      { selector: new ResourceSelector(registry), executor: sceneExecutor, loadContext: { viewer: {} as never } },
    )
    expect(result.scenePlans.map((item) => item.rootResourceIds)).toEqual([
      ['rock.design-grade'], ['blast.effect'], ['ventilation.steady-cfd'],
    ])
    expect(result.scenePlans[2].loadOrder).toEqual(['ventilation.scene', 'ventilation.steady-cfd'])
    for (let i = 0; i < 3; i++) {
      const step = await result.executor.executeCurrent()
      expect(step.status).toBe('completed')
    }
    expect(result.executor.getSnapshot().status).toBe('completed')
    expect(manager.getState('rock.design-grade').status).toBe('idle')
    expect(manager.getState('blast.effect').status).toBe('idle')
    expect(manager.getState('ventilation.steady-cfd').status).toBe('loaded')
    expect(events.indexOf('load:rock.design-grade')).toBeLessThan(events.indexOf('load:blast.effect'))
    expect(events.indexOf('load:blast.effect')).toBeLessThan(events.indexOf('load:ventilation.steady-cfd'))
    await result.executor.reset()
    expect(manager.getState('ventilation.steady-cfd').status).toBe('idle')
    expect(manager.getState('ventilation.scene').status).toBe('idle')
  })

  it('围岩后接支护时累积装配两层，下一阶段切换及复位均释放引用', async () => {
    const { registry, manager, executor: sceneExecutor, events } = setup()
    const result = createSceneExplorationExecutor(
      task(1101), ['rock.design-grade', 'support.scene', 'blast.effect'], registry,
      { selector: new ResourceSelector(registry), executor: sceneExecutor, loadContext: { viewer: {} as never } },
    )
    expect(result.scenePlans.map((plan) => plan.rootResourceIds)).toEqual([
      ['rock.design-grade'], ['rock.design-grade', 'support.scene'], ['blast.effect'],
    ])
    expect(result.scenePlans[1].releaseResourceIds).toEqual([])
    expect(result.scenePlans[1].estimatedIncrementalMemoryMb).toBe(2)

    expect((await result.executor.executeCurrent()).status).toBe('completed')
    expect((await result.executor.executeCurrent()).status).toBe('completed')
    expect(manager.getState('rock.design-grade')).toMatchObject({ status: 'loaded', references: 1 })
    expect(manager.getState('support.scene')).toMatchObject({ status: 'loaded', references: 1 })
    expect(manager.getState('common.tunnel')).toMatchObject({ status: 'loaded', references: 2 })
    expect(events).not.toContain('unload:rock.design-grade')

    await result.executor.reset()
    expect(manager.getState('rock.design-grade')).toMatchObject({ status: 'idle', references: 0 })
    expect(manager.getState('support.scene')).toMatchObject({ status: 'idle', references: 0 })
    expect(manager.getState('common.tunnel')).toMatchObject({ status: 'idle', references: 0 })
    expect((await result.executor.executeCurrent()).status).toBe('completed')
    expect((await result.executor.executeCurrent()).status).toBe('completed')

    expect((await result.executor.executeCurrent()).status).toBe('completed')
    expect(manager.getState('rock.design-grade').status).toBe('idle')
    expect(manager.getState('support.scene').status).toBe('idle')
    expect(manager.getState('blast.effect').status).toBe('loaded')
    await result.executor.reset()
    expect(manager.getState('rock.design-grade')).toMatchObject({ status: 'idle', references: 0 })
    expect(manager.getState('support.scene')).toMatchObject({ status: 'idle', references: 0 })
    expect(manager.getState('blast.effect')).toMatchObject({ status: 'idle', references: 0 })
    expect(manager.getState('common.tunnel')).toMatchObject({ status: 'idle', references: 0 })
  })

  it('预算不足时不生成空场景阶段', () => {
    const { registry, executor } = setup()
    expect(() => createSceneExplorationExecutor(
      task(10), ['rock.design-grade'], registry,
      { selector: new ResourceSelector(registry), executor, loadContext: { viewer: {} as never } },
    )).toThrow('无法加载')
  })

  it('爆破镜头等待模型首帧 ready 后才继续', async () => {
    let ready = false
    let onReady: (() => void) | undefined
    let removed = false
    let renderRequests = 0
    const model = {
      get ready() { return ready },
      readyEvent: { addEventListener(callback: () => void) {
        onReady = callback
        return () => { removed = true }
      } },
    } as unknown as Pick<Cesium.Model, 'ready' | 'readyEvent'>
    let settled = false
    const pending = waitForModelReady(model, () => { renderRequests++ }, 1000)
      .then(() => { settled = true })
    expect(renderRequests).toBe(1)
    expect(settled).toBe(false)
    ready = true
    onReady?.()
    await pending
    expect(settled).toBe(true)
    expect(removed).toBe(true)
  })
})
