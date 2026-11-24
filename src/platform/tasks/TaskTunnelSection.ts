import * as C from 'cesium'
import { chainageService } from '@/platform/coordinates/ChainageService'
import { getActiveThreeBenchModel, isThreeBenchResourceId } from '@/modules/rock/three-bench-resource'
import bench from '@/modules/rock/three-bench.metadata.json'
import { getTestSectionSupportModels, getTestSectionSupportSummaries } from '@/modules/support/test-section-resource'
import { getFocusedTunnelSegment, getTunnelGlbSegment } from '@/utils/Common/DrawLine'
import { captureTaskViewportTarget, fitTaskCameraToViewport } from './TaskViewport'
import { getActiveJetFan, getJetFanPlacement, JET_FAN_ID } from '@/modules/ventilation/axial-fan-resource'

const active = new WeakMap<C.Viewer, { restore: (camera: boolean) => void; range: { start: number; end: number } }>()

export function clearTaskTunnelSection(viewer: C.Viewer, restoreCamera = false) {
  const current = active.get(viewer)
  if (!current) return false
  active.delete(viewer)
  current.restore(restoreCamera)
  return true
}

/** Retain the far half of the original shell in a local longitudinal window. */
export function showTaskTunnelSection(viewer: C.Viewer, ids: readonly string[], chainage: number) {
  const current = active.get(viewer)
  if (current) return current.range
  const excavation = ids.some(isThreeBenchResourceId) ? getActiveThreeBenchModel() : undefined
  const support = getTestSectionSupportSummaries(ids)[0]
  const supportModels = getTestSectionSupportModels(ids).filter(model => model.ready)
  const index = getFocusedTunnelSegment()
  const shell = index === null ? undefined : getTunnelGlbSegment(index)
  const collection = shell?.clippingPlanes
  const station = chainageService.positionWithHeadingAt(chainage)
  const origin = chainageService.worldPositionAt(chainage)
  if (!excavation?.ready || !support || !supportModels.length || !shell?.ready || !collection?.enabled ||
      !collection.unionClippingRegions || index === null || !station || !origin) {
    throw Error('侧面剖切需要已装配的三台阶、后方支护和当前公共隧道段')
  }
  const jet = ids.includes(JET_FAN_ID) ? getActiveJetFan() : undefined
  const jetStation = jet?.ready ? getJetFanPlacement()?.chainage : undefined
  const first = Math.min(chainage-support.lengthM,jetStation===undefined ? chainage : jetStation-1.5)
  const last = Math.max(chainage+bench.end,jetStation===undefined ? chainage : jetStation+1.5)
  const start = Math.max(1116 + index * 500, first - 2)
  const end = Math.min(9400, 1116 + (index + 1) * 500, last + 2)
  if (start > first || end < last) {
    throw Error('当前隧道段边界穿过装配范围，请选用同一公共隧道段内的工点')
  }
  const enu = C.Transforms.eastNorthUpToFixedFrame(origin)
  const along = C.Matrix4.multiplyByPointAsVector(enu,
    new C.Cartesian3(Math.sin(station.heading), Math.cos(station.heading), 0), new C.Cartesian3())
  const lateral = C.Matrix4.multiplyByPointAsVector(enu,
    new C.Cartesian3(Math.cos(station.heading), -Math.sin(station.heading), 0), new C.Cartesian3())
  const opposite = (vector: C.Cartesian3) => C.Cartesian3.negate(vector, new C.Cartesian3())
  const atDistance = (vector: C.Cartesian3, distance: number) => C.Cartesian3.add(origin,
    C.Cartesian3.multiplyByScalar(vector, distance, new C.Cartesian3()), new C.Cartesian3())
  const clippingFrame = C.Matrix4.multiply(shell.modelMatrix, collection.modelMatrix, new C.Matrix4())
  const inverse = C.Matrix4.inverse(clippingFrame, new C.Matrix4())
  const localPlane = (point: C.Cartesian3, normal: C.Cartesian3) => {
    const plane = C.Plane.transform(C.Plane.fromPointNormal(point, normal), inverse)
    return new C.ClippingPlane(plane.normal, plane.distance)
  }
  const camera = viewer.camera
  const before = { destination: C.Cartesian3.clone(camera.positionWC), orientation: {
    direction: C.Cartesian3.clone(camera.directionWC), up: C.Cartesian3.clone(camera.upWC),
  } }
  const restoreViewport = captureTaskViewportTarget(viewer)
  const original = { color: C.Color.clone(shell.color), edgeColor: C.Color.clone(collection.edgeColor), edgeWidth: collection.edgeWidth }
  const added: C.ClippingPlane[] = []
  const restore = (restoreCamera: boolean) => {
    if (viewer.isDestroyed()) return
    if (!shell.isDestroyed() && !collection.isDestroyed()) {
      added.forEach(plane => collection.remove(plane))
      collection.edgeColor = original.edgeColor
      collection.edgeWidth = original.edgeWidth
      shell.color = original.color
    }
    if (restoreCamera) {
      camera.cancelFlight()
      camera.setView(before)
      restoreViewport()
    }
    viewer.scene.requestRender()
  }
  try {
    const sphere = C.BoundingSphere.fromBoundingSpheres([excavation.boundingSphere, ...supportModels.map(model => model.boundingSphere),...(jet?.ready?[jet.boundingSphere]:[])])
    camera.cancelFlight()
    camera.viewBoundingSphere(sphere, new C.HeadingPitchRange(station.heading + 1.38, -.28, Math.max(38, sphere.radius * 2.55)))
    camera.lookAtTransform(C.Matrix4.IDENTITY)
    fitTaskCameraToViewport(viewer, sphere)
    const towardCamera = C.Cartesian3.dot(C.Cartesian3.subtract(camera.positionWC, origin, new C.Cartesian3()), lateral) > 0 ? lateral : opposite(lateral)
    for (const plane of [localPlane(atDistance(towardCamera, -0.65), opposite(towardCamera)),
      localPlane(atDistance(along, start - chainage), along), localPlane(atDistance(along, end - chainage), opposite(along))]) {
      collection.add(plane)
      added.push(plane)
    }
    shell.color = C.Color.WHITE.withAlpha(.62)
    collection.edgeColor = C.Color.fromCssColorString('#83d8e0')
    collection.edgeWidth = 1
    const range = { start, end }
    active.set(viewer, { restore, range })
    viewer.scene.requestRender()
    return range
  } catch (error) {
    restore(true)
    throw error
  }
}
