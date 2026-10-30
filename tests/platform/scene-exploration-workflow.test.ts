import { describe, expect, it } from 'vitest'
import type * as Cesium from 'cesium'
import { ResourceRegistry } from '@/platform/resources/ResourceRegistry'
import { ResourceManager } from '@/platform/resources/ResourceManager'
import type { SceneResource } from '@/platform/resources/types'
import type { TaskContext } from '@/platform/context/TaskContext'
import { ResourceSelector } from '@/platform/selection/ResourceSelector'
import { ScenePlanExecutor } from '@/platform/selection/ScenePlanExecutor'
import { EnhancementPlanner } from '@/platform/enhancement/EnhancementPlanner'
import { EnhancementEngine } from '@/platform/enhancement/EnhancementEngine'
import {
  createSceneExplorationExecutor,
  enhancementOptionsForMode,
  sceneStageTask,
  validateEnhancementModes,
  validateAssemblyModes,
  validateSceneSequence,
  waitForModelReady,
} from '@/platform/tasks/samples/SceneExplorationWorkflow'

const task = (maxLoadMb = 1200): TaskContext => ({
  taskId: 'scene-test', taskType: 'scene-exploration', description: '依次查看围岩、爆破和通风',
  tunnelId: 'demo-tunnel', chainageRange: { start: 1346, end: 1346 },
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
  registry.register(make('rock.design-grade', 'rock', 1116, 9400, ['common.tunnel']))
  registry.register(make('rock.geophysical-grade', 'rock', 2244, 2344))
  registry.register(make('rock.tsp-hardness', 'rock', 2244, 2344))
  registry.register(make('rock.tsp-integrity', 'rock', 2244, 2344))
  registry.register(make('rock.tem-resistivity', 'rock', 2244, 2303))
  registry.register(make('blast.effect', 'blast', 1346, 1351, ['common.tunnel']))
  registry.register(make('support.scene', 'support', 1116, 1616, ['common.tunnel'], 2))
  registry.register(make('ventilation.scene', 'ventilation', 1246, 1446))
  registry.register(make('ventilation.steady-cfd', 'ventilation', 1246, 1446, ['ventilation.scene']))
  registry.register(make('ventilation.transient-network', 'ventilation', 1246, 1446, ['ventilation.scene']))
  registry.register(make('ventilation.thermal-field', 'ventilation', 1246, 1446, ['ventilation.scene']))
  const manager = new ResourceManager(registry)
  const executor = new ScenePlanExecutor(registry, manager)
  return { registry, manager, executor, events }
}

describe('智能体动态场景编排', () => {
  it('拒绝任意资源 ID，并且不把跨里程资产当作同一位置', () => {
    const { registry } = setup()
    expect(() => validateSceneSequence(['unexpected.file'], registry)).toThrow('不支持')
    expect(() => validateSceneSequence(['support.legacy-assembly'], registry)).toThrow('不支持')
    expect(() => validateSceneSequence([], registry)).toThrow('1–8')
    const rock = sceneStageTask(task(), registry.require('rock.design-grade'))
    const vent = sceneStageTask(task(), registry.require('ventilation.steady-cfd'))
    expect(rock.chainageRange).toEqual({ start: 1346, end: 1346 })
    expect(vent.chainageRange).toEqual({ start: 1346, end: 1346 })
  })

  it('按明确目标里程选段，拒绝超出资产覆盖范围的装配', () => {
    const { registry, executor } = setup()
    const options = { selector: new ResourceSelector(registry), executor, loadContext: { viewer: {} as never } }
    expect(sceneStageTask(task(), registry.require('rock.design-grade'), 1416).chainageRange)
      .toEqual({ start: 1416, end: 1416 })
    expect(() => createSceneExplorationExecutor(task(), ['rock.design-grade', 'blast.effect'], registry,
      { ...options, targetChainage: 1416, assemblyModes: ['replace', 'retain'] }))
      .toThrow('不在 blast.effect 的资产覆盖范围')
  })

  it('四类围岩解释层可按目标 YK 里程示意重定位并按阶段切换', () => {
    const { registry, executor } = setup()
    const ids = ['rock.geophysical-grade', 'rock.tsp-hardness', 'rock.tsp-integrity', 'rock.tem-resistivity']
    for (const id of ids) {
      expect(sceneStageTask(task(), registry.require(id), 2244).chainageRange)
        .toEqual({ start: 2244, end: 2244 })
      expect(sceneStageTask(task(), registry.require(id), 1346).chainageRange)
        .toEqual({ start: 1346, end: 1346 })
    }
    const options = { selector: new ResourceSelector(registry), executor, loadContext: { viewer: {} as never } }
    const workflow = createSceneExplorationExecutor(task(), ids, registry, {
      ...options, targetChainage: 1346, assemblyModes: ids.map(() => 'replace'),
    })
    expect(workflow.scenePlans.map(plan => plan.rootResourceIds)).toEqual(ids.map(id => [id]))
    expect(() => createSceneExplorationExecutor(task(), ids.slice(0, 2), registry, {
      ...options, targetChainage: 2244, assemblyModes: ['replace', 'retain'],
    })).toThrow('不允许同屏装配')
  })

  it('仅在 TSP 解释层的执行记录中引用 TSP 报告里程', async () => {
    const { registry, executor } = setup()
    const workflow = createSceneExplorationExecutor(task(), ['rock.tem-resistivity', 'rock.tsp-hardness'], registry, {
      selector: new ResourceSelector(registry), executor, loadContext: { viewer: {} as never },
      targetChainage: 1346, assemblyModes: ['replace', 'replace'],
    })
    expect((await workflow.executor.executeCurrent()).status).toBe('completed')
    const temNote = (workflow.executor.plan.sharedContext['scene.stage.1']?.value as { note: string }).note
    expect(temNote).toContain('YK2+244')
    expect(temNote).not.toContain('X1DK2+937')

    expect((await workflow.executor.executeCurrent()).status).toBe('completed')
    const tspNote = (workflow.executor.plan.sharedContext['scene.stage.2']?.value as { note: string }).note
    expect(tspNote).toContain('X1DK2+937')
  })

  it('将物探围岩层与新模块支护断面装配到同一目标里程', () => {
    const { registry, executor } = setup()
    registry.register({
      id: 'support.modeler-zz-va', module: 'support', type: 'modeler-section',
      chainageRange: { start: 1116, end: 2180 }, processes: [], states: [],
      async load() {}, async unload() {},
    })
    const result = createSceneExplorationExecutor(task(), ['rock.geophysical-grade', 'support.modeler-zz-va'], registry, {
      selector: new ResourceSelector(registry), executor, loadContext: { viewer: {} as never },
      targetChainage: 1346,
    })
    expect(result.scenePlans[1].rootResourceIds).toHaveLength(2)
    expect(result.scenePlans[1].rootResourceIds).toEqual(expect.arrayContaining(['rock.geophysical-grade', 'support.modeler-zz-va']))
  })

  it('在准备阶段校验逐阶段增强选择，并形成不同的可执行增强参数', () => {
    const { registry, executor } = setup()
    const options = { selector: new ResourceSelector(registry), executor, loadContext: { viewer: {} as never } }
    expect(() => createSceneExplorationExecutor(
      task(), ['rock.design-grade', 'support.scene'], registry,
      { ...options, enhancementModes: ['emphasis'] },
    )).toThrow('逐一对应')
    expect(() => createSceneExplorationExecutor(
      task(), ['rock.design-grade'], registry,
      { ...options, enhancementModes: ['arbitrary-script'] },
    )).toThrow('不受支持')
    expect(validateEnhancementModes(undefined, 2)).toEqual(['auto', 'auto'])
    expect(enhancementOptionsForMode('emphasis')).toMatchObject({ focusOutlineWidth: 5, referenceOpacity: 0.18 })
    expect(enhancementOptionsForMode('context')).toMatchObject({ highlightFocus: false, referenceOpacity: 0.7 })
  })

  it('拒绝不合法或跨工点的同屏装配请求，允许显式切换', () => {
    const { registry, executor } = setup()
    const base = { selector: new ResourceSelector(registry), executor, loadContext: { viewer: {} as never } }
    expect(() => createSceneExplorationExecutor(
      task(), ['rock.design-grade', 'ventilation.steady-cfd'], registry,
      { ...base, assemblyModes: ['replace', 'retain'] },
    )).toThrow('不允许同屏装配')
    expect(() => createSceneExplorationExecutor(
      task(), ['rock.design-grade'], registry,
      { ...base, assemblyModes: ['retain'] },
    )).toThrow('首阶段')
    expect(() => createSceneExplorationExecutor(
      task(), ['rock.design-grade', 'support.scene'], registry,
      { ...base, assemblyModes: ['replace'] },
    )).toThrow('逐一对应')
    expect(validateAssemblyModes(undefined, 2)).toEqual(['auto', 'auto'])
    const replaced = createSceneExplorationExecutor(
      task(), ['rock.design-grade', 'support.scene'], registry,
      { ...base, assemblyModes: ['replace', 'replace'] },
    )
    expect(replaced.scenePlans[1].rootResourceIds).toEqual(['support.scene'])
  })

  it('由模型逐阶段选择保留资源，装配围岩、支护和爆破并记录实际根资源', async () => {
    const { registry, manager, executor } = setup()
    const workflow = createSceneExplorationExecutor(
      task(), ['rock.design-grade', 'support.scene', 'blast.effect'], registry,
      {
        selector: new ResourceSelector(registry), executor,
        loadContext: { viewer: {} as never },
        assemblyModes: ['replace', 'retain', 'retain'],
      },
    )
    expect(workflow.scenePlans[0].rootResourceIds).toEqual(['rock.design-grade'])
    expect(workflow.scenePlans[1].rootResourceIds).toEqual(['rock.design-grade', 'support.scene'])
    expect(workflow.scenePlans[2].rootResourceIds).toHaveLength(3)
    expect(workflow.scenePlans[2].rootResourceIds).toEqual(expect.arrayContaining([
      'rock.design-grade', 'support.scene', 'blast.effect',
    ]))
    for (let index = 0; index < 3; index++) {
      expect((await workflow.executor.executeCurrent()).status).toBe('completed')
    }
    expect((workflow.executor.plan.sharedContext['scene.stage.3']?.value as { assembledResourceIds: string[] }).assembledResourceIds)
      .toEqual(workflow.scenePlans[2].rootResourceIds)
    expect(manager.getState('rock.design-grade').status).toBe('loaded')
    await workflow.executor.reset()
    expect(manager.getState('rock.design-grade').status).toBe('idle')
    expect(manager.getState('support.scene').status).toBe('idle')
    expect(manager.getState('blast.effect').status).toBe('idle')
  })

  it('观察首阶段结果后可重算下一阶段装配，非法改动保留原计划', async () => {
    const { registry, executor } = setup()
    const workflow = createSceneExplorationExecutor(
      task(), ['rock.design-grade', 'support.scene', 'ventilation.steady-cfd'], registry,
      {
        selector: new ResourceSelector(registry), executor,
        loadContext: { viewer: {} as never },
        assemblyModes: ['replace', 'replace', 'replace'],
      },
    )
    expect(() => workflow.reviseNextAssembly('scene-2', 'retain')).toThrow('前一阶段尚未完成')
    expect((await workflow.executor.executeCurrent()).status).toBe('completed')
    expect(workflow.reviseNextAssembly('scene-2', 'retain')[1].rootResourceIds)
      .toEqual(['rock.design-grade', 'support.scene'])
    expect(workflow.executor.plan.steps[1].name).toContain('同屏装配')
    expect((await workflow.executor.executeCurrent()).status).toBe('completed')
    const before = [...workflow.scenePlans[2].rootResourceIds]
    expect(() => workflow.reviseNextAssembly('scene-3', 'retain')).toThrow('不允许同屏装配')
    expect(workflow.scenePlans[2].rootResourceIds).toEqual(before)
    expect((await workflow.executor.executeCurrent()).status).toBe('completed')
    expect(workflow.executor.getSnapshot().status).toBe('completed')
    await workflow.executor.reset()
  })

  it('逐步执行模型选定的增强方式，并在复位时撤销实际视觉状态', async () => {
    const registry = new ResourceRegistry()
    const model = {
      show: true, silhouetteColor: { red: 1, green: 1, blue: 1, alpha: 1 }, silhouetteSize: 0,
    }
    registry.register({
      id: 'rock.design-grade', module: 'rock', type: 'design-grade',
      chainageRange: { start: 1116, end: 9400 }, processes: [], states: [],
      load: async () => undefined, unload: async () => undefined,
      getEnhanceTargets: () => [{ id: 'rock.focus', type: 'model', object: model as never }],
    })
    const manager = new ResourceManager(registry)
    const engine = new EnhancementEngine(registry)
    const workflow = createSceneExplorationExecutor(
      task(), ['rock.design-grade', 'rock.design-grade'], registry,
      {
        selector: new ResourceSelector(registry),
        executor: new ScenePlanExecutor(registry, manager),
        loadContext: { viewer: {} as never },
        enhancement: { planner: new EnhancementPlanner(registry), engine },
        enhancementModes: ['emphasis', 'context'],
      },
    )
    expect((await workflow.executor.executeCurrent()).status).toBe('completed')
    expect(engine.getActivePlan()?.directives.find(item => item.strategy === 'highlight')?.parameters).toMatchObject({ width: 5 })
    expect(model.silhouetteSize).toBe(5)
    expect((await workflow.executor.executeCurrent()).status).toBe('completed')
    expect(engine.getActivePlan()?.directives.some(item => item.strategy === 'highlight')).toBe(false)
    expect(model.silhouetteSize).toBe(0)
    await workflow.executor.reset()
    expect(engine.getActivePlan()).toBeUndefined()
    expect(manager.getState('rock.design-grade').status).toBe('idle')
  })

  it('可为通风工况和热场时间片分别生成受控任务阶段', () => {
    const { registry, executor } = setup()
    const workflow = createSceneExplorationExecutor(
      task(), ['ventilation.transient-network', 'ventilation.thermal-field'], registry,
      { selector: new ResourceSelector(registry), executor, loadContext: { viewer: {} as never } },
    )
    expect(workflow.scenePlans.map(plan => plan.rootResourceIds)).toEqual([
      ['ventilation.transient-network'], ['ventilation.thermal-field'],
    ])
    expect(workflow.scenePlans[1].releaseResourceIds).toContain('ventilation.transient-network')
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
