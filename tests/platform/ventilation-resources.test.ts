import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getVentilationCoData,
  getVentilationTransientData,
  useVentilationThermalSnapshot,
  useVentilationTransientScenario,
  ventilationCoResource,
  ventilationModuleManifest,
  ventilationResources,
  ventilationThermalResource,
  ventilationTransientResource,
} from '@/modules/ventilation/resources'

afterEach(() => vi.unstubAllGlobals())

describe('ventilation resource split', () => {
  it('registers independent analysis resources that depend on the base scene', () => {
    expect(ventilationResources.map(({ id }) => id)).toEqual([
      'ventilation.scene',
      'ventilation.steady-cfd',
      'ventilation.co-analysis',
      'ventilation.transient-network',
      'ventilation.thermal-field',
    ])
    for (const resource of ventilationResources.slice(1)) {
      expect(resource.dependencies).toContain('ventilation.scene')
      expect(resource.lifetime).toBe('task')
    }
    expect(ventilationModuleManifest.resources).toBe(ventilationResources)
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
