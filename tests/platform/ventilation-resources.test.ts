import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { transientScenarioCatalog } from '@/modules/ventilation/transient-catalog'
import { thermalSnapshotCatalog } from '@/modules/ventilation/thermal-catalog'
import * as Cesium from 'cesium'
import { layers } from '@/views/ventilation-module/cesiumVentilation'
import {
  getVentilationCoData,
  getVentilationTransientData,
  useVentilationThermalSnapshot,
  useVentilationTransientScenario,
  ventilationCoResource,
  ventilationSceneResource,
  ventilationModuleManifest,
  ventilationResources,
  ventilationThermalResource,
  ventilationTransientResource,
  ventilationScenarioResources,
  ventilationSnapshotResources,
} from '@/modules/ventilation/resources'
import { AGENT_SCENE_RESOURCES } from '@/platform/tasks/samples/SceneExplorationWorkflow'

afterEach(() => vi.unstubAllGlobals())

describe('ventilation resource split', () => {
  it('renders the selected right-tunnel thermal slice and preserves it when the old slice unloads', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => JSON.parse(readFileSync(`public${url}`, 'utf8')) })))
    const viewer = { scene: { primitives: new Cesium.PrimitiveCollection(), requestRender: vi.fn() }, isDestroyed: () => false } as any
    await ventilationSceneResource.load({ viewer, task: { taskId: 'thermal', taskType: 'scene-exploration', description: '模拟热场', tunnelId: 'YK', chainageRange: { start: 4000, end: 4000 }, targetTypes: ['ventilation'] } })
    const first = ventilationSnapshotResources[0], second = ventilationSnapshotResources[2]
    await first.load({ viewer }); await first.activate!({} as any)
    await second.load({ viewer }); await second.activate!({} as any)
    const points = layers.points
    await first.unload()
    expect(layers.points).toBe(points)
    expect(points!.length).toBe(3340)
    expect(points!.get(0).id.kind).toBe('thermal')
    expect(second.getActiveAssetPaths!()).toContain('/data/ventilation/cfd_transient_t200s.json')
    await second.unload()
    expect(layers.points).toBeUndefined()
    await ventilationSceneResource.unload()
  })
  it.each(transientScenarioCatalog)('loads delivered scenario $file and reports its own file', async scenario => {
    const data = JSON.parse(readFileSync(`public/data/ventilation/${scenario.file}`, 'utf8'))
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => data })))
    const resource = ventilationScenarioResources.find(resource => resource.id === scenario.id)!
    await resource.load({ viewer: {} as any })
    expect(resource.getActiveAssetPaths!()).toEqual([`/data/ventilation/${scenario.file}`])
    await resource.unload()
  })
  it('keeps scenario data and provenance independent during load-before-release', async () => {
    const [oscillation, , shutdown] = ventilationScenarioResources
    const data = { times: [0, 5], history: { Duct_Right: { Q: [12, 0] } } }
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => data })))
    await oscillation.load({ viewer: {} as any })
    await shutdown.load({ viewer: {} as any })
    await oscillation.unload()
    expect(shutdown.getActiveAssetPaths!()).toEqual(['/data/ventilation/transient_fan_shutdown.json'])
    expect(shutdown.getEnhanceTargets!()).toHaveLength(1)
    expect(AGENT_SCENE_RESOURCES).toContain(shutdown.id)
    await shutdown.unload()
    expect(shutdown.getActiveAssetPaths!()).toEqual([])
  })
  it('rejects an out-of-range retained task and allows the previous task to resume', async () => {
    const task = (start: number, end = start) => ({
      taskId: 'retained-vent', taskType: 'scene-exploration' as const, description: '通风组合',
      tunnelId: 'YK', chainageRange: { start, end }, targetTypes: ['ventilation'],
    })
    await ventilationSceneResource.load({ viewer: {} as any, task: task(4000) })
    try {
      for (const invalid of [task(4200), task(4000, 3900), task(Number.NaN)]) {
        await expect(ventilationSceneResource.update!(invalid)).rejects.toThrow('仅支持 YK3+900～YK4+100')
      }
      await expect(ventilationSceneResource.update!(task(4000))).resolves.toBeUndefined()
      await expect(ventilationSceneResource.activate!(task(4100))).resolves.toBeUndefined()
    } finally {
      await ventilationSceneResource.unload()
    }
  })
  it('registers independent analysis resources that depend on the base scene', () => {
    expect(ventilationResources.map(({ id }) => id)).toEqual([
      'ventilation.scene',
      'ventilation.steady-cfd',
      'ventilation.co-analysis',
      'ventilation.transient-network',
      'ventilation.thermal-field',
      'ventilation.transient-fan-oscillation', 'ventilation.transient-damper-close',
      'ventilation.transient-fan-shutdown', 'ventilation.transient-combined',
      ...thermalSnapshotCatalog.map(snapshot => snapshot.id),
    ])
    for (const resource of ventilationResources.slice(1)) {
      expect(resource.dependencies).toContain('ventilation.scene')
      expect(resource.lifetime).toBe('task')
    }
    expect(ventilationModuleManifest.resources).toBe(ventilationResources)
    expect(AGENT_SCENE_RESOURCES).toContain('ventilation.co-analysis')
    expect(ventilationCoResource.chainageRange).toEqual({ start: 3900, end: 4100 })
  })

  it('rejects an agent composition outside the calibrated 200 m interval', async () => {
    await expect(ventilationSceneResource.load({ viewer: {} as any, task: {
      taskId: 'outside', taskType: 'scene-exploration', description: '通风组合', tunnelId: 'YK',
      chainageRange: { start: 7251, end: 7251 }, targetTypes: ['ventilation'],
    } })).rejects.toThrow('仅支持 YK3+900～YK4+100')
  })

  it('loads and releases the CO dataset through its resource boundary', async () => {
    expect(ventilationCoResource.getActiveAssetPaths?.()).toEqual([])
    const document = { Right: { times: [0, 60] } }
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => document,
    }))
    vi.stubGlobal('fetch', fetchMock)

    await ventilationCoResource.load({ viewer: {} as any })

    expect(fetchMock).toHaveBeenCalledWith('/data/ventilation/co_transport_results.json')
    expect(getVentilationCoData()).toBe(document)
    expect(ventilationCoResource.getActiveAssetPaths?.()).toEqual(['/data/ventilation/co_transport_results.json'])
    const target = ventilationCoResource.getEnhanceTargets?.()[0]
    expect(target?.id).toBe('ventilation.co-chart')
    expect(target?.object).toBeUndefined()
    expect(target?.recommendedEnhancements).toEqual(['chart'])
    expect(target?.adapters?.chart).toBeTypeOf('function')
    await ventilationCoResource.unload()
    expect(getVentilationCoData()).toBeUndefined()
    expect(ventilationCoResource.getActiveAssetPaths?.()).toEqual([])
  })

  it('reports the selected transient scenario instead of the default file', async () => {
    const initial = { times: [0], history: {} }
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => initial })))
    await ventilationTransientResource.load({ viewer: {} as any })
    expect(ventilationTransientResource.getActiveAssetPaths?.()).toEqual(['/data/ventilation/transient_fan_ramp_up.json'])

    const selected = { times: [0, 100], history: {} }
    useVentilationTransientScenario('fan_shutdown', selected)
    expect(getVentilationTransientData()).toBe(selected)
    expect(ventilationTransientResource.getActiveAssetPaths?.()).toEqual(['/data/ventilation/transient_fan_shutdown.json'])

    await ventilationTransientResource.unload()
    expect(ventilationTransientResource.getActiveAssetPaths?.()).toEqual([])
    expect(() => useVentilationTransientScenario('combined', selected)).toThrow('尚未加载')
  })

  it('records only a loaded thermal snapshot from the current index', async () => {
    const index = { snapshots: [{ t: 0, file: 'cfd_transient_t0s.json' }, { t: 200, file: 'cfd_transient_t200s.json' }] }
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: true,
      json: async () => url.endsWith('cfd_transient_index.json') ? index : { times_s: [0, 200] },
    })))
    await ventilationThermalResource.load({ viewer: {} as any })
    expect(ventilationThermalResource.getActiveAssetPaths?.()).toEqual([
      '/data/ventilation/cfd_transient_index.json', '/data/ventilation/transient_thermal_monitors.json',
    ])
    expect(() => useVentilationThermalSnapshot('../other.json')).toThrow('不属于当前索引')
    useVentilationThermalSnapshot('cfd_transient_t200s.json')
    expect(ventilationThermalResource.getActiveAssetPaths?.()).toContain('/data/ventilation/cfd_transient_t200s.json')
    await ventilationThermalResource.unload()
    expect(ventilationThermalResource.getActiveAssetPaths?.()).toEqual([])
    expect(() => useVentilationThermalSnapshot('cfd_transient_t0s.json')).toThrow('不属于当前索引')
  })
})
