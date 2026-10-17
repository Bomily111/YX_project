import * as Cesium from 'cesium'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { legacySupportResources, legacySupportAssembly, legacySupportCatalog, setLegacySupportHighlight } from '@/modules/support/legacy-resources'
import { queueLegacySupportModel, invalidateLegacySupportModels, getLegacySupportModels, waitForLegacySupportModels } from '@/modules/support/LegacySupportLifecycle'
import { ResourceRegistry } from '@/platform/resources/ResourceRegistry'
import { ResourceManager } from '@/platform/resources/ResourceManager'
import { collectActiveAssetPaths } from '@/platform/telemetry/TaskAssetVersions'
import { createSceneExplorationExecutor } from '@/platform/tasks/samples/SceneExplorationWorkflow'
import { ResourceSelector } from '@/platform/selection/ResourceSelector'
import { ScenePlanExecutor } from '@/platform/selection/ScenePlanExecutor'
import { EnhancementEngine } from '@/platform/enhancement/EnhancementEngine'

const context = () => ({ viewer: {
  isDestroyed: () => false,
  scene: { requestRender: vi.fn(), primitives: { add: vi.fn(model => model), remove: vi.fn(() => true) } },
} as unknown as Cesium.Viewer })
const model = () => ({ show: true, destroy: vi.fn(), isDestroyed: () => false }) as unknown as Cesium.Model
const registry = () => {
  const result = new ResourceRegistry()
  result.registerAll([...legacySupportResources, legacySupportAssembly])
  return result
}

afterEach(async () => {
  for (const resource of legacySupportResources) await resource.unload()
  await legacySupportAssembly.unload()
  vi.restoreAllMocks()
})

describe('legacy structure tree support resources', () => {
  it('loads all seven component groups, fingerprints nine real GLBs, and clears on release', async () => {
    vi.spyOn(Cesium.Model, 'fromGltfAsync').mockImplementation(async () => model())
    const reg = registry()
    const manager = new ResourceManager(reg)
    const ctx = context()
    await manager.load([legacySupportAssembly.id], ctx)
    expect(legacySupportAssembly.dependencies).toHaveLength(7)
    const paths = collectActiveAssetPaths(reg.resolveLoadOrder([legacySupportAssembly.id]).map(item => item.id), reg, manager)
    expect(paths).toHaveLength(9)
    const manifest = JSON.parse(readFileSync('public/data/task-asset-manifest.json', 'utf8'))
    for (const path of paths) {
      const bytes = readFileSync(`public${path}`)
      expect(bytes.toString('ascii', 0, 4)).toBe('glTF')
      expect(manifest.assets.find((asset: { path: string }) => asset.path === path)?.digest)
        .toBe(createHash('sha256').update(bytes).digest('hex'))
    }
    expect(ctx.viewer.scene.primitives.add).toHaveBeenCalled()
    await manager.release([legacySupportAssembly.id])
    expect(ctx.viewer.scene.primitives.remove).toHaveBeenCalledTimes(vi.mocked(ctx.viewer.scene.primitives.add).mock.calls.length)
    expect(collectActiveAssetPaths(legacySupportResources.map(item => item.id), reg, manager)).toEqual([])
    expect(legacySupportCatalog.every(asset => getLegacySupportModels(asset.kind).length === 0)).toBe(true)
  })

  it('shares structural tree and task leases without duplicate loads or premature removal', async () => {
    const load = vi.spyOn(Cesium.Model, 'fromGltfAsync').mockImplementation(async () => model())
    const reg = registry()
    const manager = new ResourceManager(reg)
    const ctx = context()
    const id = 'support.legacy-steel-frame'
    await manager.load([id], ctx)
    const count = load.mock.calls.length
    expect(count).toBe(89)
    await manager.load([id], ctx)
    expect(load).toHaveBeenCalledTimes(count)
    await manager.release([id])
    expect(manager.getState(id).references).toBe(1)
    expect(ctx.viewer.scene.primitives.remove).not.toHaveBeenCalled()
    await manager.release([id])
    expect(ctx.viewer.scene.primitives.remove).toHaveBeenCalledTimes(count)
  })

  it('provides reversible opacity for legacy GLBs whose default color is undefined', async () => {
    vi.spyOn(Cesium.Model, 'fromGltfAsync').mockImplementation(async () => model())
    const reg = registry()
    const manager = new ResourceManager(reg)
    await manager.load(['support.legacy-anchor'], context())
    const target = reg.require('support.legacy-anchor').getEnhanceTargets!()[1]
    const object = target.object as Cesium.Model
    expect(object.color.alpha).toBe(1)
    const engine = new EnhancementEngine(reg)
    const result = await engine.apply({ taskId: 'opacity', stepId: 'preview', directives: [{
      id: 'opacity-anchor', resourceId: 'support.legacy-anchor', targetId: target.id,
      strategy: 'opacity', conflictGroup: 'occlusion', priority: 50, parameters: { value: 0.35 },
    }] })
    expect(result.status).toBe('applied')
    expect(object.color.alpha).toBe(0.35)
    setLegacySupportHighlight('anchor', true)
    expect(object.color.alpha).toBe(1)
    setLegacySupportHighlight('anchor', false)
    expect(object.color.alpha).toBe(0.35)
    expect(await engine.reset()).toEqual([])
    expect(object.color.alpha).toBe(1)
    await manager.release(['support.legacy-anchor'])
  })

  it('removes partial geometry on failure and permits a clean retry', async () => {
    const load = vi.spyOn(Cesium.Model, 'fromGltfAsync').mockImplementation(async () => model())
    load.mockRejectedValueOnce(new Error('GLB failed'))
    const reg = registry()
    const manager = new ResourceManager(reg)
    const ctx = context()
    await expect(manager.load(['support.legacy-steel-frame'], ctx)).rejects.toThrow('GLB failed')
    expect(getLegacySupportModels('steel_frame')).toEqual([])
    expect(ctx.viewer.scene.primitives.remove).toHaveBeenCalledTimes(88)
    await manager.load(['support.legacy-steel-frame'], ctx)
    expect(manager.getState('support.legacy-steel-frame')).toMatchObject({ status: 'loaded', references: 1 })
    await manager.release(['support.legacy-steel-frame'])
  })

  it('destroys late models after cancellation instead of attaching them to the viewer', async () => {
    let finish!: (value: Cesium.Model) => void
    vi.spyOn(Cesium.Model, 'fromGltfAsync').mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const attach = vi.fn()
    const late = model()
    queueLegacySupportModel('anchor', context().viewer, { url: '/unused.glb' }, attach)
    const waiting = waitForLegacySupportModels('anchor')
    invalidateLegacySupportModels('anchor')
    finish(late)
    await expect(waiting).rejects.toThrow('支护构件加载已取消')
    expect(late.destroy).toHaveBeenCalledOnce()
    expect(attach).not.toHaveBeenCalled()
  })

  it('keeps the original sample chainage and composes rock with the existing assembly', () => {
    const reg = registry()
    reg.register({ id: 'rock.design-grade', module: 'rock', type: 'rock', chainageRange: { start: 278100, end: 286400 }, processes: [], states: [], async load() {}, async unload() {} })
    const result = createSceneExplorationExecutor({
      taskId: 'legacy-preview', taskType: 'scene-exploration', description: '既有支护', tunnelId: 'demo',
      chainageRange: { start: 278330, end: 278340 }, targetTypes: ['scene'], constraints: { maxLoadMb: 1200 },
    }, ['rock.design-grade', 'support.legacy-assembly'], reg, {
      selector: new ResourceSelector(reg), executor: new ScenePlanExecutor(reg, new ResourceManager(reg)), loadContext: context(),
    })
    expect(result.scenePlans[1].rootResourceIds).toEqual(['rock.design-grade', 'support.legacy-assembly'])
    expect(result.scenePlans[1].loadOrder).toHaveLength(9)
    expect(legacySupportAssembly.chainageRange).toEqual({ start: 278100, end: 278167 })
  })
})
