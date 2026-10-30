import * as Cesium from 'cesium'
import { waitForTunnelGlbSegment } from '@/utils/Common/DrawLine'

/** Shared scene resource still uses the platform's reference tunnel segment. */
export async function loadTunnelModel(viewer: Cesium.Viewer): Promise<Cesium.Model> {
  return waitForTunnelGlbSegment(0, viewer)
}

/** Place the task workflow's generated steel arch at the tunnel segment. */
export function getArchModelMatrix(tunnelModel: Cesium.Model): Cesium.Matrix4 {
  const center = tunnelModel.boundingSphere.center.clone()
  const hpr = new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(90), 0, 0)
  return Cesium.Transforms.headingPitchRollToFixedFrame(center, hpr)
}
