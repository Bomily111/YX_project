import type * as Cesium from 'cesium'
import type { SceneResource } from '@/platform/resources/types'
import { moduleRegistry } from '@/platform/modules/ModuleRegistry'
import type { SceneModuleManifest } from '@/platform/modules/types'
import { getBlastModel, loadBlast, removeBlast, setBlastVisible } from '@/views/tunnel-module/blast'
import { registerCommonResources } from '@/platform/resources/common'

let blastViewer: Cesium.Viewer | undefined

export const blastEffectResource: SceneResource = {
  id: 'blast.effect',
  module: 'blast',
  type: 'blast-effect',
  chainageRange: { start: 278330, end: 278335 },
  processes: ['drilling', 'charging', 'blasting', 'inspection'],
  states: ['designed', 'charged', 'blasted'],
  dependencies: ['common.tunnel'],
  estimatedMemoryMb: 7.02,
  async load(context) {
    blastViewer = context.viewer
    context.reportProgress?.(0.75, '加载爆破效果')
    await loadBlast(context.viewer)
    context.reportProgress?.(1, '爆破场景加载完成')
  },
  async activate() {
    if (blastViewer) setBlastVisible(blastViewer, true)
  },
  async deactivate() {
    if (blastViewer) setBlastVisible(blastViewer, false)
  },
  async unload() {
    if (blastViewer) removeBlast(blastViewer)
    blastViewer = undefined
  },
  getEnhanceTargets() {
    return [{ id: 'blast.effect.model', type: 'blast-model' }]
  },
  getActiveAssetPaths() {
    return getBlastModel() ? ['/data/blast/blast_effect.glb'] : []
  },
}

export const blastResources = [blastEffectResource] as const

export const blastModuleManifest: SceneModuleManifest = {
  id: 'blast',
  displayName: '开挖爆破',
  version: 'legacy-adapter-1.0.0',
  capabilities: ['query', 'locate', 'visibility', 'opacity', 'standard-view', 'pick'],
  coordinateFrame: { kind: 'platform-chainage', prefix: 'DK', origin: 278100, unit: 'm' },
  resources: blastResources,
}

export function registerBlastModule(): void {
  registerCommonResources()
  if (!moduleRegistry.get('blast')) moduleRegistry.register(blastModuleManifest)
}
