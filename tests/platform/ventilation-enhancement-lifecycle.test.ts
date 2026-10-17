import * as Cesium from 'cesium'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const external = vi.hoisted(() => {
  const model = { clippingPlanes: undefined as unknown }
  const chartInstances: Array<{
    setOption: ReturnType<typeof vi.fn>
    resize: ReturnType<typeof vi.fn>
    dispose: ReturnType<typeof vi.fn>
  }> = []
  return {
    model,
    chartInstances,
    echartsInit: vi.fn(() => {
      const chart = { setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() }
      chartInstances.push(chart)
      return chart
    }),
    loadTunnelModel: vi.fn(async () => model),
    destroyVentilation: vi.fn(),
    removeFlowLayers: vi.fn(),
    setTunnelGlbVisible: vi.fn(),
  }
})

vi.mock('echarts', () => ({ init: external.echartsInit }))
vi.mock('@/views/ventilation-module/cesiumVentilation', () => ({
  getTunnelModel: () => external.model,
  loadTunnelModel: external.loadTunnelModel,
  destroyVentilation: external.destroyVentilation,
  removeFlowLayers: external.removeFlowLayers,
}))
vi.mock('@/utils/Common/DrawLine', () => ({
  isTunnelGlbVisible: () => true,
  setTunnelGlbVisible: external.setTunnelGlbVisible,
}))

import {
  getVentilationEnhancementLeaseCount,
  ventilationCoResource,
  ventilationSceneResource,
  ventilationSteadyResource,
} from '@/modules/ventilation/resources'

class FakeElement {
  readonly dataset: Record<string, string> = {}
  readonly style: Record<string, string> = {}
  readonly children: FakeElement[] = []
  parent?: FakeElement
  textContent = ''

  append(...children: FakeElement[]) {
    for (const child of children) this.appendChild(child)
  }

  appendChild(child: FakeElement) {
    child.parent = this
    this.children.push(child)
    return child
  }

  remove() {
    if (!this.parent) return
    const index = this.parent.children.indexOf(this)
    if (index >= 0) this.parent.children.splice(index, 1)
    this.parent = undefined
  }
}

describe('ventilation enhancement resource lifecycle', () => {
  let container: FakeElement
  let listeners: Map<string, Set<EventListenerOrEventListenerObject>>
  let viewer: any

  beforeEach(async () => {
    vi.clearAllMocks()
    external.chartInstances.length = 0
    external.model.clippingPlanes = undefined
    container = new FakeElement()
    listeners = new Map()
    vi.stubGlobal('document', {
      createElement: vi.fn(() => new FakeElement()),
    })
    vi.stubGlobal('window', {
      addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
        const entries = listeners.get(type) ?? new Set()
        entries.add(listener)
        listeners.set(type, entries)
      }),
      removeEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
        listeners.get(type)?.delete(listener)
      }),
    })
    viewer = {
      container,
      isDestroyed: () => false,
      scene: { requestRender: vi.fn() },
    }
    await ventilationSceneResource.load({ viewer })
  })

  afterEach(async () => {
    await ventilationCoResource.unload()
    await ventilationSteadyResource.unload()
    await ventilationSceneResource.unload()
    vi.unstubAllGlobals()
  })

  it('releases resize listener, overlay DOM and ECharts instance when the CO resource unloads', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        Right: { times: [0, 60], history: { outlet: [0, 12] } },
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    await ventilationCoResource.load({ viewer })

    for (let cycle = 0; cycle < 3; cycle += 1) {
      const target = ventilationCoResource.getEnhanceTargets?.()[0]
      const undo = await target?.adapters?.chart?.({})
      const chart = external.chartInstances.at(-1)!

      expect(container.children).toHaveLength(1)
      expect(container.children[0].dataset.ventilationEnhancement).toBe('chart')
      expect(listeners.get('resize')?.size).toBe(1)
      expect(chart.setOption).toHaveBeenCalledOnce()
      expect(getVentilationEnhancementLeaseCount('ventilation.co-analysis')).toBe(1)

      await ventilationCoResource.unload()

      expect(container.children).toHaveLength(0)
      expect(listeners.get('resize')?.size ?? 0).toBe(0)
      expect(chart.dispose).toHaveBeenCalledOnce()
      expect(getVentilationEnhancementLeaseCount('ventilation.co-analysis')).toBe(0)
      await undo?.()
      expect(chart.dispose).toHaveBeenCalledOnce()

      if (cycle < 2) await ventilationCoResource.load({ viewer })
    }
  })

  it('restores the previous clipping collection and destroys every created section on resource unload', async () => {
    const previous = { owner: 'previous-clipping' }
    external.model.clippingPlanes = previous

    for (let cycle = 0; cycle < 3; cycle += 1) {
      const target = ventilationSteadyResource.getEnhanceTargets?.()[0]
      const undo = await target?.adapters?.section?.({ chainage: 3905.151 + cycle })
      const clipping = external.model.clippingPlanes as Cesium.ClippingPlaneCollection
      const destroy = vi.spyOn(clipping, 'destroy')

      expect(clipping).toBeInstanceOf(Cesium.ClippingPlaneCollection)
      expect(clipping).not.toBe(previous)
      expect(clipping.isDestroyed()).toBe(false)
      expect(getVentilationEnhancementLeaseCount('ventilation.steady-cfd')).toBe(1)

      await ventilationSteadyResource.unload()

      expect(external.model.clippingPlanes).toBe(previous)
      expect(clipping.isDestroyed()).toBe(true)
      expect(destroy).toHaveBeenCalledOnce()
      expect(getVentilationEnhancementLeaseCount('ventilation.steady-cfd')).toBe(0)
      await undo?.()
      expect(destroy).toHaveBeenCalledOnce()
    }
  })
})
