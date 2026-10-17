import { describe, expect, it } from 'vitest'
import {
  compareLifecycleSnapshots,
  createLifecycleDiagnosticsRecorder,
  type PlatformDiagnosticsSnapshot,
} from '@/platform/diagnostics/DevDiagnostics'

const snapshot = (overrides: Partial<{
  instanceId: string
  primitives: number
  handlers: number
  activeEnhancements: number
  enhancementOverlays: number
  activeResources: number
  references: number
  heap: number
}> = {}): PlatformDiagnosticsSnapshot => ({
  timestamp: 1,
  url: '/',
  viewer: {
    exists: true,
    owner: 'main-platform',
    instanceId: overrides.instanceId ?? '1',
    canvases: 1,
    primitives: overrides.primitives ?? 8,
    entities: 3,
    dataSources: 0,
    postProcessStages: 1,
  },
  inputHandlers: { count: overrides.handlers ?? 2, owners: ['main.pointer', 'main.pick'] },
  enhancements: {
    activePlans: (overrides.activeEnhancements ?? 0) > 0 ? 1 : 0,
    activeDirectives: overrides.activeEnhancements ?? 0,
    domOverlays: overrides.enhancementOverlays ?? 0,
    strategies: {},
  },
  resourceSummary: {
    active: overrides.activeResources ?? 1,
    loaded: 1,
    failed: 0,
    references: overrides.references ?? 1,
  },
  resources: [{ id: 'common.tunnel', status: 'loaded', references: 1 }],
  memory: { usedJSHeapSize: overrides.heap ?? 100, totalJSHeapSize: 200, jsHeapSizeLimit: 1000 },
})

describe('platform lifecycle diagnostics', () => {
  it('reports a stable round trip when counts and viewer identity return to baseline', () => {
    const report = compareLifecycleSnapshots(snapshot(), snapshot({ heap: 130 }))
    expect(report.stable).toBe(true)
    expect(report.violations).toEqual([])
  })

  it('detects retained handlers, primitives, resources and viewer replacement', () => {
    const report = compareLifecycleSnapshots(snapshot(), snapshot({
      instanceId: '2', primitives: 10, handlers: 3, activeResources: 2, references: 2,
      activeEnhancements: 1, enhancementOverlays: 1,
    }))
    expect(report.stable).toBe(false)
    expect(report.sameViewerInstance).toBe(false)
    expect(report.violations.map(({ metric }) => metric)).toEqual(expect.arrayContaining([
      'primitives', 'inputHandlers', 'activeEnhancementPlans', 'activeEnhancements', 'enhancementOverlays',
      'activeResources', 'resourceReferences',
    ]))
  })

  it('applies tolerances and keeps recorder history bounded and immutable', () => {
    const report = compareLifecycleSnapshots(snapshot(), snapshot({ primitives: 9, heap: 125 }), {
      primitives: 1,
      usedJSHeapSize: 30,
    })
    expect(report.stable).toBe(true)

    const recorder = createLifecycleDiagnosticsRecorder(2)
    recorder.record(snapshot({ primitives: 1 }))
    recorder.record(snapshot({ primitives: 2 }))
    recorder.record(snapshot({ primitives: 3 }))
    const history = recorder.list()
    expect(history.map(({ viewer }) => viewer.primitives)).toEqual([2, 3])
    history[0].viewer.primitives = 99
    expect(recorder.list()[0].viewer.primitives).toBe(2)
  })
})
