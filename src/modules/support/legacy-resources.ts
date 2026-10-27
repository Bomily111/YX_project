import * as Cesium from 'cesium'
import type { SceneResource, EnhanceTarget } from '@/platform/resources/types'
import { chainageService } from '@/platform/coordinates/ChainageService'
import { demoReanchorTransform } from '@/platform/coordinates/DemoReanchor'
import catalog from './legacy-assets.json'
import { getLegacySupportModels, waitForLegacySupportModels, type LegacySupportKind } from './LegacySupportLifecycle'
import {
  loadRebarMeshes, removeFirstRebarMeshes, setRebarMeshesVisible, setRebarHighlight,
  loadSecondRebarMeshes, removeSecondRebarMeshes, setSecondRebarVisible, setSecondRebarHighlight,
  loadSteelFrameMeshes, removeSteelFrameMeshes, setSteelFrameVisible, setSteelFrameHighlight,
  loadPipeShedMeshes, removePipeShedMeshes, setPipeShedVisible, setPipeShedHighlight,
  loadAnchorMeshes, removeAnchorMeshes, setAnchorVisible, setAnchorHighlight,
  loadConduitMeshes, removeConduitMeshes, setConduitVisible, setConduitHighlight,
  loadLockAnchorMeshes, removeLockAnchorMeshes, setLockAnchorVisible, setLockAnchorHighlight,
} from '@/utils/Common/DrawLine'

export const legacySupportHandlers = {
  rebar: { load: loadRebarMeshes, remove: removeFirstRebarMeshes, show: setRebarMeshesVisible, highlight: setRebarHighlight },
  lining_rebar: { load: loadSecondRebarMeshes, remove: removeSecondRebarMeshes, show: setSecondRebarVisible, highlight: setSecondRebarHighlight },
  steel_frame: { load: loadSteelFrameMeshes, remove: removeSteelFrameMeshes, show: setSteelFrameVisible, highlight: setSteelFrameHighlight },
  pipe_shed: { load: loadPipeShedMeshes, remove: removePipeShedMeshes, show: setPipeShedVisible, highlight: setPipeShedHighlight },
  anchor: { load: loadAnchorMeshes, remove: removeAnchorMeshes, show: setAnchorVisible, highlight: setAnchorHighlight },
  conduit: { load: loadConduitMeshes, remove: removeConduitMeshes, show: setConduitVisible, highlight: setConduitHighlight },
  lock_anchor: { load: loadLockAnchorMeshes, remove: removeLockAnchorMeshes, show: setLockAnchorVisible, highlight: setLockAnchorHighlight },
} satisfies Record<LegacySupportKind, unknown>

export const legacySupportCatalog = catalog as Array<Omit<typeof catalog[number], 'kind'> & { kind: LegacySupportKind }>
const highlightSnapshots = new Map<LegacySupportKind, Array<{ model: Cesium.Model; color: Cesium.Color }>>()
const restoreIndividualPlacements = new Map<LegacySupportKind, () => void>()

/** 结构树高亮只持有临时视觉状态，取消时恢复任务透明度等既有设置。 */
export function setLegacySupportHighlight(kind: LegacySupportKind, enabled: boolean): void {
  if (enabled) {
    if (highlightSnapshots.has(kind)) return
    highlightSnapshots.set(kind, getLegacySupportModels(kind).map(model => ({ model, color: Cesium.Color.clone(model.color) })))
    legacySupportHandlers[kind].highlight(true)
  } else {
    for (const { model, color } of highlightSnapshots.get(kind) ?? []) {
      if (!model.isDestroyed()) model.color = color
    }
    highlightSnapshots.delete(kind)
  }
}

function viewTarget(id: string, viewer: Cesium.Viewer, chainage: number): EnhanceTarget {
  return {
    id: `${id}:view`, type: 'legacy-support-preview',
    metadata: { source: 'structure-tree', parameterized: false, chainage, registration: 'legacy-display-layout' },
    recommendedEnhancements: ['standard-view'],
    adapters: { 'standard-view': () => {
      const camera = viewer.camera
      const before = {
        destination: Cesium.Cartesian3.clone(camera.positionWC),
        orientation: { direction: Cesium.Cartesian3.clone(camera.directionWC), up: Cesium.Cartesian3.clone(camera.upWC) },
      }
      const target = chainageService.worldPositionAt(chainage)
      if (!target) throw new Error('既有支护示例里程超出中线范围')
      camera.lookAt(target, new Cesium.HeadingPitchRange(0.3, -0.3, 90))
      camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
      viewer.scene.requestRender()
      return () => { if (!viewer.isDestroyed()) { camera.setView(before); viewer.scene.requestRender() } }
    } },
  }
}

/** 稳定资源 ID 与构件类型保持不变，后续参数化提供方可在空闲时替换模块实现。 */
export const legacySupportResources: SceneResource[] = legacySupportCatalog.map(asset => {
  let viewer: Cesium.Viewer | undefined
  let loaded = false
  const handlers = legacySupportHandlers[asset.kind]
  const sourceChainage = chainageService.legacyDkToCanonical((asset.start + asset.end) / 2)
  let viewChainage = sourceChainage
  const baseMatrices = new Map<Cesium.Model, Cesium.Matrix4>()
  const restorePlacement = (): void => {
    for (const [model, base] of baseMatrices) {
      if (!model.isDestroyed()) model.modelMatrix = Cesium.Matrix4.clone(base)
    }
    baseMatrices.clear()
    viewChainage = sourceChainage
    viewer?.scene.requestRender()
  }
  restoreIndividualPlacements.set(asset.kind, restorePlacement)
  const placeAt = (chainage: number): void => {
    restorePlacement()
    if (assemblyViewer || chainage >= chainageService.legacyDkToCanonical(asset.start)
      && chainage <= chainageService.legacyDkToCanonical(asset.end)) return
    const transform = demoReanchorTransform(sourceChainage, chainage)
    viewChainage = chainage
    for (const model of getLegacySupportModels(asset.kind)) {
      const base = Cesium.Matrix4.clone(model.modelMatrix)
      baseMatrices.set(model, base)
      model.modelMatrix = Cesium.Matrix4.multiply(transform, base, new Cesium.Matrix4())
    }
    viewer?.scene.requestRender()
  }
  return {
    id: asset.id, module: 'support', type: `legacy-${asset.kind}`,
    chainageRange: { start: chainageService.legacyDkToCanonical(asset.start), end: chainageService.legacyDkToCanonical(asset.end) },
    processes: ['support-design'], states: ['legacy-preview'],
    lifetime: 'task', estimatedMemoryMb: asset.memoryMb,
    async load(context) {
      viewer = context.viewer
      try {
        handlers.load(viewer)
        await waitForLegacySupportModels(asset.kind)
        if (context.signal?.aborted) throw new DOMException('支护构件加载已取消', 'AbortError')
        loaded = true
        handlers.show(true)
        viewer.scene.requestRender()
      } catch (error) {
        handlers.remove(viewer)
        viewer = undefined
        loaded = false
        throw error
      }
    },
    async unload() {
      restorePlacement()
      setLegacySupportHighlight(asset.kind, false)
      handlers.remove(viewer)
      if (viewer && !viewer.isDestroyed()) viewer.scene.requestRender()
      viewer = undefined
      loaded = false
    },
    async activate(task) { placeAt(task.chainageRange.start) },
    async update(task) { placeAt(task.chainageRange.start) },
    async deactivate() { restorePlacement() },
    resetTaskPlacement: restorePlacement,
    getEnhanceTargets() {
      return loaded && viewer ? [
        viewTarget(asset.id, viewer, viewChainage),
        ...getLegacySupportModels(asset.kind).map((object, index) => ({
          id: `${asset.id}:${index}`, type: asset.kind, object,
          metadata: { parameterized: false, source: 'structure-tree' },
        })),
      ] : []
    },
    getActiveAssetPaths: () => loaded ? [...asset.paths] : [],
  }
})

let assemblyViewer: Cesium.Viewer | undefined
let assemblyTargetChainage = chainageService.legacyDkToCanonical(278145)
const assemblyBaseMatrices = new Map<Cesium.Model, Cesium.Matrix4>()
const restoreAssemblyPlacement = (): void => {
  for (const [model, original] of assemblyBaseMatrices) {
    if (!model.isDestroyed()) model.modelMatrix = Cesium.Matrix4.clone(original)
  }
  assemblyBaseMatrices.clear()
  assemblyViewer?.scene.requestRender()
}
const placeAssemblyAt = (chainage: number): void => {
  restoreAssemblyPlacement()
  for (const restore of restoreIndividualPlacements.values()) restore()
  assemblyTargetChainage = chainage
  const original = chainageService.legacyDkToCanonical(278145)
  if (chainage >= legacySupportAssembly.chainageRange!.start && chainage <= legacySupportAssembly.chainageRange!.end) return
  const transform = demoReanchorTransform(original, chainage)
  for (const asset of legacySupportCatalog) {
    for (const model of getLegacySupportModels(asset.kind)) {
      const base = Cesium.Matrix4.clone(model.modelMatrix)
      assemblyBaseMatrices.set(model, base)
      model.modelMatrix = Cesium.Matrix4.multiply(transform, base, new Cesium.Matrix4())
    }
  }
  assemblyViewer?.scene.requestRender()
}
export const legacySupportAssembly: SceneResource = {
  id: 'support.legacy-assembly', module: 'support', type: 'legacy-support-assembly',
  chainageRange: { start: chainageService.legacyDkToCanonical(278100), end: chainageService.legacyDkToCanonical(278167) },
  processes: ['support-design'], states: ['legacy-preview'], lifetime: 'task', estimatedMemoryMb: 0,
  dependencies: legacySupportResources.map(resource => resource.id),
  async load(context) { assemblyViewer = context.viewer },
  async activate(task) { placeAssemblyAt(task.chainageRange.start) },
  async update(task) { placeAssemblyAt(task.chainageRange.start) },
  async deactivate() { restoreAssemblyPlacement() },
  resetTaskPlacement: restoreAssemblyPlacement,
  async unload() { restoreAssemblyPlacement(); assemblyViewer = undefined },
  getEnhanceTargets: () => assemblyViewer ? [viewTarget('support.legacy-assembly', assemblyViewer, assemblyTargetChainage)] : [],
}
