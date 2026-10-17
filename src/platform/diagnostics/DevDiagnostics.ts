import { viewerService } from '@/platform/viewer/ViewerService'
import { resourceManager } from '@/platform/resources/ResourceManager'
import { screenSpaceEventRegistry } from '@/platform/input/ScreenSpaceEventRegistry'
import { getEnhancementActivitySnapshot } from '@/platform/enhancement/EnhancementActivity'

export interface PlatformDiagnosticsSnapshot {
  timestamp: number
  url: string
  viewer: {
    exists: boolean
    owner?: string
    instanceId?: string | null
    canvases: number
    primitives: number
    entities: number
    dataSources: number
    postProcessStages: number
  }
  inputHandlers: { count: number; owners: string[] }
  enhancements: {
    activePlans: number
    activeDirectives: number
    domOverlays: number
    strategies: Record<string, number>
  }
  resourceSummary: { active: number; loaded: number; failed: number; references: number }
  resources: Array<{ id: string; status: string; references: number }>
  memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number }
}

export interface LifecycleGrowthTolerance {
  canvases?: number
  primitives?: number
  entities?: number
  dataSources?: number
  postProcessStages?: number
  inputHandlers?: number
  activeEnhancementPlans?: number
  activeEnhancements?: number
  enhancementOverlays?: number
  activeResources?: number
  resourceReferences?: number
  usedJSHeapSize?: number
}

export interface LifecycleMetricChange {
  metric: keyof Required<LifecycleGrowthTolerance>
  baseline: number
  current: number
  delta: number
  tolerance: number
}

export interface LifecycleGrowthReport {
  stable: boolean
  sameViewerInstance: boolean
  changes: LifecycleMetricChange[]
  violations: LifecycleMetricChange[]
}

export interface LifecycleDiagnosticsRecorder {
  record(snapshot: PlatformDiagnosticsSnapshot): void
  list(): readonly PlatformDiagnosticsSnapshot[]
  clear(): void
}

type PerformanceWithMemory = Performance & {
  memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number }
}

const DEFAULT_TOLERANCE: Required<Omit<LifecycleGrowthTolerance, 'usedJSHeapSize'>> = {
  canvases: 0,
  primitives: 0,
  entities: 0,
  dataSources: 0,
  postProcessStages: 0,
  inputHandlers: 0,
  activeEnhancementPlans: 0,
  activeEnhancements: 0,
  enhancementOverlays: 0,
  activeResources: 0,
  resourceReferences: 0,
}

declare global {
  interface Window {
    __DT_PLATFORM_DIAGNOSTICS__?: () => PlatformDiagnosticsSnapshot
    __DT_PLATFORM_DIAGNOSTICS_HISTORY__?: () => readonly PlatformDiagnosticsSnapshot[]
    __DT_PLATFORM_DIAGNOSTICS_TIMER__?: number
  }
}

export function capturePlatformDiagnostics(): PlatformDiagnosticsSnapshot {
  const viewer = viewerService.current
  const resources = resourceManager.listStates().map(({ id, status, references }) => ({
    id, status, references,
  }))
  const inputHandlers = screenSpaceEventRegistry.list()
  const enhancementActivity = getEnhancementActivitySnapshot()
  const performanceMemory = typeof performance === 'undefined'
    ? undefined
    : (performance as PerformanceWithMemory).memory
  return {
    timestamp: Date.now(),
    url: typeof window === 'undefined' ? '' : `${window.location.pathname}${window.location.search}`,
    viewer: {
      exists: Boolean(viewer),
      owner: viewerService.currentOwner,
      instanceId: viewer?.container.getAttribute('data-viewer-instance-id'),
      canvases: viewer?.container.querySelectorAll('canvas').length ?? 0,
      primitives: viewer?.scene.primitives.length ?? 0,
      entities: viewer?.entities.values.length ?? 0,
      dataSources: viewer?.dataSources.length ?? 0,
      postProcessStages: viewer?.scene.postProcessStages.length ?? 0,
    },
    inputHandlers: {
      count: inputHandlers.length,
      owners: inputHandlers.map(({ owner }) => owner).sort(),
    },
    enhancements: {
      activePlans: enhancementActivity.activePlans,
      activeDirectives: enhancementActivity.activeDirectives,
      domOverlays: typeof document === 'undefined'
        ? 0
        : document.querySelectorAll('[data-ventilation-enhancement]').length,
      strategies: { ...enhancementActivity.strategies },
    },
    resourceSummary: {
      active: resources.filter(({ status, references }) => status !== 'idle' || references > 0).length,
      loaded: resources.filter(({ status }) => status === 'loaded').length,
      failed: resources.filter(({ status }) => status === 'failed').length,
      references: resources.reduce((sum, { references }) => sum + references, 0),
    },
    resources,
    memory: performanceMemory ? {
      usedJSHeapSize: performanceMemory.usedJSHeapSize,
      totalJSHeapSize: performanceMemory.totalJSHeapSize,
      jsHeapSizeLimit: performanceMemory.jsHeapSizeLimit,
    } : undefined,
  }
}

export function compareLifecycleSnapshots(
  baseline: PlatformDiagnosticsSnapshot,
  current: PlatformDiagnosticsSnapshot,
  tolerance: LifecycleGrowthTolerance = {},
): LifecycleGrowthReport {
  const values: Record<keyof Required<LifecycleGrowthTolerance>, [number, number, number]> = {
    canvases: [baseline.viewer.canvases, current.viewer.canvases, tolerance.canvases ?? DEFAULT_TOLERANCE.canvases],
    primitives: [baseline.viewer.primitives, current.viewer.primitives, tolerance.primitives ?? DEFAULT_TOLERANCE.primitives],
    entities: [baseline.viewer.entities, current.viewer.entities, tolerance.entities ?? DEFAULT_TOLERANCE.entities],
    dataSources: [baseline.viewer.dataSources, current.viewer.dataSources, tolerance.dataSources ?? DEFAULT_TOLERANCE.dataSources],
    postProcessStages: [baseline.viewer.postProcessStages, current.viewer.postProcessStages, tolerance.postProcessStages ?? DEFAULT_TOLERANCE.postProcessStages],
    inputHandlers: [baseline.inputHandlers.count, current.inputHandlers.count, tolerance.inputHandlers ?? DEFAULT_TOLERANCE.inputHandlers],
    activeEnhancementPlans: [baseline.enhancements.activePlans, current.enhancements.activePlans, tolerance.activeEnhancementPlans ?? DEFAULT_TOLERANCE.activeEnhancementPlans],
    activeEnhancements: [baseline.enhancements.activeDirectives, current.enhancements.activeDirectives, tolerance.activeEnhancements ?? DEFAULT_TOLERANCE.activeEnhancements],
    enhancementOverlays: [baseline.enhancements.domOverlays, current.enhancements.domOverlays, tolerance.enhancementOverlays ?? DEFAULT_TOLERANCE.enhancementOverlays],
    activeResources: [baseline.resourceSummary.active, current.resourceSummary.active, tolerance.activeResources ?? DEFAULT_TOLERANCE.activeResources],
    resourceReferences: [baseline.resourceSummary.references, current.resourceSummary.references, tolerance.resourceReferences ?? DEFAULT_TOLERANCE.resourceReferences],
    usedJSHeapSize: [baseline.memory?.usedJSHeapSize ?? 0, current.memory?.usedJSHeapSize ?? 0, tolerance.usedJSHeapSize ?? Number.POSITIVE_INFINITY],
  }
  const changes = (Object.entries(values) as Array<[
    keyof Required<LifecycleGrowthTolerance>, [number, number, number],
  ]>).map(([metric, [before, after, allowed]]) => ({
    metric,
    baseline: before,
    current: after,
    delta: after - before,
    tolerance: allowed,
  }))
  const sameViewerInstance = baseline.viewer.instanceId === current.viewer.instanceId
  const violations = changes.filter(({ delta, tolerance: allowed }) => delta > allowed)
  return {
    stable: sameViewerInstance && violations.length === 0,
    sameViewerInstance,
    changes,
    violations,
  }
}

export function createLifecycleDiagnosticsRecorder(maxSamples = 120): LifecycleDiagnosticsRecorder {
  if (!Number.isInteger(maxSamples) || maxSamples < 1) {
    throw new Error('[DevDiagnostics] maxSamples 必须是正整数')
  }
  const samples: PlatformDiagnosticsSnapshot[] = []
  return {
    record(snapshot) {
      samples.push(snapshot)
      if (samples.length > maxSamples) samples.splice(0, samples.length - maxSamples)
    },
    list: () => samples.map((snapshot) => ({
      ...snapshot,
      viewer: { ...snapshot.viewer },
      inputHandlers: { ...snapshot.inputHandlers, owners: [...snapshot.inputHandlers.owners] },
      enhancements: { ...snapshot.enhancements, strategies: { ...snapshot.enhancements.strategies } },
      resourceSummary: { ...snapshot.resourceSummary },
      resources: snapshot.resources.map((resource) => ({ ...resource })),
      memory: snapshot.memory ? { ...snapshot.memory } : undefined,
    })),
    clear: () => { samples.length = 0 },
  }
}

/** 仅开发环境暴露只读诊断快照和有界历史，供切换回归和泄漏测试使用。 */
export function installDevDiagnostics(): void {
  if (!import.meta.env.DEV || typeof window === 'undefined') return
  const recorder = createLifecycleDiagnosticsRecorder()
  Object.defineProperty(window, '__DT_PLATFORM_DIAGNOSTICS__', {
    configurable: true,
    value: capturePlatformDiagnostics,
  })
  Object.defineProperty(window, '__DT_PLATFORM_DIAGNOSTICS_HISTORY__', {
    configurable: true,
    value: () => recorder.list(),
  })

  const marker = document.querySelector<HTMLMetaElement>('meta[name="dt-platform-diagnostics"]')
    ?? document.head.appendChild(document.createElement('meta'))
  marker.name = 'dt-platform-diagnostics'
  const publish = () => {
    const snapshot = capturePlatformDiagnostics()
    recorder.record(snapshot)
    marker.content = JSON.stringify(snapshot)
  }
  if (window.__DT_PLATFORM_DIAGNOSTICS_TIMER__ !== undefined) {
    window.clearInterval(window.__DT_PLATFORM_DIAGNOSTICS_TIMER__)
  }
  publish()
  window.__DT_PLATFORM_DIAGNOSTICS_TIMER__ = window.setInterval(publish, 500)
}
