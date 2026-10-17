import type * as Cesium from 'cesium'
import {
  hasTunnelGlb,
  getTunnelGlbSegment,
  loadTunnelGlb,
  removeTunnelGlb,
  setTunnelGlbVisible,
} from '@/utils/Common/DrawLine'
import { resourceRegistry } from './ResourceRegistry'
import type { SceneResource } from './types'

let tunnelViewer: Cesium.Viewer | undefined

export const commonTunnelResource: SceneResource = {
  id: 'common.tunnel',
  module: 'common',
  type: 'segmented-tunnel',
  processes: [],
  states: ['reference'],
  estimatedMemoryMb: 1100,
  lifetime: 'application',
  async load(context) {
    tunnelViewer = context.viewer
    if (!hasTunnelGlb(context.viewer)) loadTunnelGlb(context.viewer)
    setTunnelGlbVisible(true)
    context.reportProgress?.(0.7, '公共隧道已就绪')
  },
  async activate() {
    setTunnelGlbVisible(true)
    tunnelViewer?.scene.requestRender()
  },
  async deactivate() {
    setTunnelGlbVisible(false)
    tunnelViewer?.scene.requestRender()
  },
  async unload() {
    if (tunnelViewer && !tunnelViewer.isDestroyed()) removeTunnelGlb(tunnelViewer)
    tunnelViewer = undefined
  },
  getActiveAssetPaths() {
    return Array.from({ length: 17 }, (_, index) => index)
      .filter(index => getTunnelGlbSegment(index)?.ready)
      .map(index => `/data/tunnel/tunnel${String(index).padStart(3, '0')}.glb`)
  },
}

export function registerCommonResources(): void {
  if (!resourceRegistry.get(commonTunnelResource.id)) resourceRegistry.register(commonTunnelResource)
}
