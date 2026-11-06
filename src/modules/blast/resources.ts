import type * as Cesium from 'cesium'
import type { SceneResource } from '@/platform/resources/types'
import { moduleRegistry } from '@/platform/modules/ModuleRegistry'
import type { SceneModuleManifest } from '@/platform/modules/types'
import { getBlastModel, loadBlast, placeBlastAtChainage, resetBlastTaskPlacement, removeBlast, setBlastVisible } from '@/views/tunnel-module/blast'
import { registerCommonResources } from '@/platform/resources/common'
import { setTunnelTranslucent } from '@/utils/Common/DrawLine'
import { blastDesignResource } from './design-resource'

let blastViewer: Cesium.Viewer | undefined

export const blastEffectResource: SceneResource = {
  id: 'blast.effect',
  module: 'blast',
  type: 'blast-effect',
  chainageRange: { start: 1116, end: 9400 },
  processes: ['drilling', 'charging', 'blasting', 'inspection'],
  states: ['designed', 'charged', 'blasted'],
  dependencies: ['common.tunnel'],
  estimatedMemoryMb: 7.02,
  async load(context) {
    blastViewer = context.viewer
    context.reportProgress?.(0.75, '加载爆破效果')
    await loadBlast(context.viewer)
    const chainage = context.task?.chainageRange.start
    if (chainage !== undefined) {
      await placeBlastAtChainage(context.viewer, chainage)
    }
    context.reportProgress?.(1, '爆破场景加载完成')
  },
  async activate(task) {
    if (blastViewer) {
      await placeBlastAtChainage(blastViewer, task.chainageRange.start)
      setBlastVisible(blastViewer, true)
    }
  },
  async update(task) {
    if (blastViewer) await placeBlastAtChainage(blastViewer, task.chainageRange.start)
  },
  resetTaskPlacement() {
    if (blastViewer) resetBlastTaskPlacement(blastViewer)
  },
  async deactivate() {
    if (blastViewer) setBlastVisible(blastViewer, false)
  },
  async unload() {
    if (blastViewer) {
      setTunnelTranslucent(false, blastViewer)
      removeBlast(blastViewer)
    }
    blastViewer = undefined
  },
  getEnhanceTargets() {
    const model = getBlastModel()
    return model ? [{ id: 'blast.effect.model', type: 'blast-model',
      metadata: { includes: ['blast-holes', 'post-blast-point-cloud'], pointCount: 450000,
        source: 'blast_effect.glb / pointcloud node' } }] : []
  },
  getActiveAssetPaths() {
    return getBlastModel() ? ['/data/blast/blast_effect.glb'] : []
  },
}

export const blastResources = [blastEffectResource, blastDesignResource] as const

export const blastModuleManifest: SceneModuleManifest = {
  id: 'blast',
  displayName: '开挖爆破',
  version: 'legacy-adapter-1.0.0',
  capabilities: ['query', 'locate', 'visibility', 'opacity', 'standard-view', 'pick'],
  coordinateFrame: { kind: 'platform-chainage', prefix: 'YK', origin: 1116, unit: 'm' },
  resources: blastResources,
}

export function registerBlastModule(): void {
  registerCommonResources()
  if (!moduleRegistry.get('blast')) moduleRegistry.register(blastModuleManifest)
}
