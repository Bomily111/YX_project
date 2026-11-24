import * as C from 'cesium'
import { chainageService } from '@/platform/coordinates/ChainageService'
import type { SceneResource } from '@/platform/resources/types'
import type { TaskContext } from '@/platform/context/TaskContext'
import { getFocusedTunnelSegment, getTunnelGlbSegment } from '@/utils/Common/DrawLine'
import { excavationRelativeOffsets } from '@/platform/tasks/excavation-relative-offset'

export const AXIAL_FAN_ID = 'ventilation.axial-fan'
export const AXIAL_FAN_DUCT_ID = 'ventilation.axial-fan-duct'
export const JET_FAN_ID = 'ventilation.ceiling-jet-fan'
const jetPath = '/data/ventilation/ceiling-jet-fan.glb'
const ductPath = '/data/ventilation/axial-fan-duct.glb'
export const axialFanNote = '轴流风机为示意设备，出风端可作为风筒接口。已有风场独立来源，未使用此风机求解。'
const path = '/data/ventilation/axial-fan.glb'
const outlet = new C.Cartesian3(0, .91, 1.08)
let model: C.Model | undefined
let owner: C.Viewer | undefined
let directionMarker: C.Entity | undefined
let placement: ReturnType<typeof fanPlacement> | undefined

function fanPlacement(task: TaskContext, ceiling = false) {
  const offsets = ceiling ? excavationRelativeOffsets(task.description) : []
  if (offsets.length > 1) throw Error('请明确洞顶风机相对开挖基准的唯一位置')
  const relative = offsets[0]
  const chainage = task.chainageRange.start + (relative ? Number(relative[2]) * (relative[1] === '后方' ? -1 : 1) : 0)
  const station = chainageService.positionWithHeadingAt(chainage)
  if (!station) throw Error('轴流风机展示位置须在 YK 中线范围内')
  const descending = /(?:向|朝|沿|顺).{0,6}里程(?:减小|减少|降低|递减)|小里程方向/.test(task.description)
  const heading = station.heading + (descending ? Math.PI : 0)
  const geographicLeft = new C.Cartesian3(-Math.cos(station.heading), Math.sin(station.heading), 0)
  const offset = C.Cartesian3.multiplyByScalar(geographicLeft, ceiling ? 0 : 2.1, new C.Cartesian3())
  const rotation = C.Matrix3.fromColumnMajorArray([
    -Math.cos(heading), Math.sin(heading), 0, 0, 0, 1, Math.sin(heading), Math.cos(heading), 0,
  ])
  const base = C.Cartesian3.fromDegrees(station.longitude, station.latitude, station.height + (ceiling ? 7.1 : .15))
  const matrix = C.Matrix4.multiply(C.Transforms.eastNorthUpToFixedFrame(base),
    C.Matrix4.fromRotationTranslation(rotation, offset), new C.Matrix4())
  return { matrix, chainage, heading, descending }
}

function markerPoints(matrix: C.Matrix4) {
  return [outlet, new C.Cartesian3(0, .91, 2.48)].map(point => C.Matrix4.multiplyByPoint(matrix, point, new C.Cartesian3()))
}

const markerLabel = (descending: boolean) => ({
  horizontalOrigin: descending ? C.HorizontalOrigin.RIGHT : C.HorizontalOrigin.LEFT,
  pixelOffset: new C.Cartesian2(descending ? -10 : 10, -23),
})

export const getActiveAxialFan = () => model
export const getAxialFanPlacement = () => placement
let duct: C.Model | undefined
let ductOwner: C.Viewer | undefined
export const getActiveAxialFanDuct = () => duct

function refreshFanMarker() {
  if (!placement || !directionMarker?.polyline || !directionMarker.label) return
  const points = markerPoints(placement.matrix)
  const connected = !!duct
  const label = connected ? { horizontalOrigin: C.HorizontalOrigin.CENTER, pixelOffset: new C.Cartesian2(0,-15) } : markerLabel(placement.descending)
  const position = connected ? C.Matrix4.multiplyByPoint(placement.matrix, new C.Cartesian3(0,1.64,1.08), new C.Cartesian3()) : points[1]
  directionMarker.position = new C.ConstantPositionProperty(position)
  directionMarker.polyline.positions = new C.ConstantProperty(points)
  directionMarker.polyline.show = new C.ConstantProperty(!connected)
  directionMarker.label.horizontalOrigin = new C.ConstantProperty(label.horizontalOrigin)
  directionMarker.label.pixelOffset = new C.ConstantProperty(label.pixelOffset)
}

export const axialFanResource: SceneResource = {
  id: AXIAL_FAN_ID, module: 'ventilation', type: 'axial-fan-equipment',
  chainageRange: { start: 1116, end: 9400 }, processes: ['ventilation'], states: ['demonstration'],
  dependencies: ['common.tunnel'], lifetime: 'task', estimatedMemoryMb: 1,
  async load({ viewer, task, signal }) {
    if (!task || signal?.aborted) throw Error('轴流风机需要有效的场景任务')
    const next = fanPlacement(task)
    const incoming = await C.Model.fromGltfAsync({ url: path, modelMatrix: next.matrix, upAxis: C.Axis.Z, forwardAxis: C.Axis.X })
    if (signal?.aborted || viewer.isDestroyed()) {
      incoming.destroy()
      throw new DOMException('轴流风机加载取消', 'AbortError')
    }
    viewer.scene.primitives.add(incoming)
    model = incoming
    owner = viewer
    placement = next
    const positions = markerPoints(next.matrix)
    const color = C.Color.fromCssColorString('#ffd384')
    try {
      directionMarker = viewer.entities.add({ position: positions[1],
        polyline: { positions, width: 6, arcType: C.ArcType.NONE, material: new C.PolylineArrowMaterialProperty(color) },
        label: { text: '出风端 · 风筒接口', font: '600 14px "Microsoft YaHei", sans-serif', fillColor: color,
          showBackground: true, backgroundColor: C.Color.fromCssColorString('#18242e'),
          verticalOrigin: C.VerticalOrigin.BOTTOM, ...markerLabel(next.descending) },
      })
    } catch (error) {
      await this.unload()
      throw error
    }
    viewer.scene.requestRender()
  },
  async update(task) {
    if (!model || !directionMarker?.polyline) return
    const next = fanPlacement(task)
    model.modelMatrix = next.matrix
    placement = next
    refreshFanMarker()
    owner?.scene.requestRender()
  },
  async unload() {
    if (owner && !owner.isDestroyed()) {
      if (model) owner.scene.primitives.remove(model)
      if (directionMarker) owner.entities.remove(directionMarker)
      owner.scene.requestRender()
    }
    model = undefined
    owner = undefined
    directionMarker = undefined
    placement = undefined
  },
  getActiveAssetPaths: () => model ? [path] : [],
  getEnhanceTargets: () => model && placement ? [{ id: AXIAL_FAN_ID, type: 'axial-fan-equipment', object: model,
    metadata: { displayName: '施工轴流风机', placement: 'demonstration', taskReferenceChainage: placement.chainage,
      outletDirection: placement.descending ? 'decreasing-chainage' : 'increasing-chainage', boreDiameterM: 1.2, note: axialFanNote },
  }] : [],
}

export const axialFanDuctResource: SceneResource = {
  id: AXIAL_FAN_DUCT_ID, module: 'ventilation', type: 'flexible-supply-duct',
  chainageRange: axialFanResource.chainageRange, processes: ['ventilation'], states: ['demonstration'],
  dependencies: [AXIAL_FAN_ID], lifetime: 'task', estimatedMemoryMb: 1,
  async load({ viewer, task, signal }) {
    if (!task || signal?.aborted) throw Error('风筒需要有效的场景任务')
    const incoming = await C.Model.fromGltfAsync({ url: ductPath, modelMatrix: fanPlacement(task).matrix, upAxis: C.Axis.Z, forwardAxis: C.Axis.X })
    if (signal?.aborted || viewer.isDestroyed()) {
      incoming.destroy()
      throw new DOMException('风筒加载取消', 'AbortError')
    }
    viewer.scene.primitives.add(incoming)
    duct = incoming
    ductOwner = viewer
    refreshFanMarker()
    viewer.scene.requestRender()
  },
  async update(task) {
    if (duct) duct.modelMatrix = fanPlacement(task).matrix
    ductOwner?.scene.requestRender()
  },
  async unload() {
    if (duct && ductOwner && !ductOwner.isDestroyed()) ductOwner.scene.primitives.remove(duct)
    duct = undefined
    ductOwner = undefined
    refreshFanMarker()
  },
  getActiveAssetPaths: () => duct ? [ductPath] : [],
  getEnhanceTargets: () => duct ? [{ id: AXIAL_FAN_DUCT_ID, type: 'flexible-supply-duct', object: duct,
    metadata: { displayName: '风机出风端柔性风筒', placement: 'demonstration', lengthM: 4, boreDiameterM: 1.2 },
  }] : [],
}

let jet: C.Model | undefined
let jetOwner: C.Viewer | undefined
let jetPlacement: ReturnType<typeof fanPlacement> | undefined
export const getActiveJetFan = () => jet
export const getJetFanPlacement = () => jetPlacement

export function alignJetFanToRenderedCrown(viewer: C.Viewer) {
  const index = getFocusedTunnelSegment()
  const shell = index === null ? undefined : getTunnelGlbSegment(index)
  if (!jet || !jetPlacement || !shell?.ready) return
  // Probe the interior surface of the rendered tunnel GLB. Cesium's optional
  // ray pick is isolated here. Keep the nominal display height if unavailable.
  const scene = viewer.scene as C.Scene & { pickFromRay?: (ray: C.Ray, exclude: unknown[], width: number) => { object?: { primitive?: unknown }; position?: C.Cartesian3 } | undefined }
  if (!scene.pickFromRay || scene.mode !== C.SceneMode.SCENE3D) return
  const frame = jetPlacement.matrix
  const foot = C.Matrix4.multiplyByPoint(frame, new C.Cartesian3(0,-2,0), new C.Cartesian3())
  const up = C.Matrix4.multiplyByPointAsVector(frame, C.Cartesian3.UNIT_Y, new C.Cartesian3())
  const excluded = Array.from({ length: scene.primitives.length }, (_, i) => scene.primitives.get(i)).filter(primitive => primitive !== shell)
  const hit = scene.pickFromRay(new C.Ray(foot,up), [...excluded, scene.globe], .06)
  if (hit?.object?.primitive !== shell || !hit.position) return
  const correction = C.Cartesian3.dot(C.Cartesian3.subtract(hit.position, foot, new C.Cartesian3()),up) - 2
  if (Math.abs(correction) > 1.5) return
  // The plates sit 2 cm below the centreline crown to account for curvature.
  jet.modelMatrix = C.Matrix4.multiplyByTranslation(frame,new C.Cartesian3(0,correction-.02,0),new C.Matrix4())
}

export const ceilingJetFanResource: SceneResource = {
  id: JET_FAN_ID, module: 'ventilation', type: 'ceiling-jet-fan', chainageRange: axialFanResource.chainageRange,
  processes: ['ventilation'], states: ['demonstration'], dependencies: ['common.tunnel'], lifetime: 'task',
  async load({ viewer, task, signal }) {
    if (!task || signal?.aborted) throw Error('洞顶射流风机需要有效的场景任务')
    const next = fanPlacement(task, true)
    const incoming = await C.Model.fromGltfAsync({ url: jetPath, modelMatrix: next.matrix, upAxis: C.Axis.Z, forwardAxis: C.Axis.X })
    if (signal?.aborted || viewer.isDestroyed()) {
      incoming.destroy()
      throw new DOMException('洞顶射流风机加载取消', 'AbortError')
    }
    viewer.scene.primitives.add(incoming)
    jet = incoming
    jetOwner = viewer
    jetPlacement = next
    viewer.scene.requestRender()
  },
  async update(task) {
    if (!jet) return
    jetPlacement = fanPlacement(task, true)
    jet.modelMatrix = jetPlacement.matrix
    jetOwner?.scene.requestRender()
  },
  async unload() {
    if (jet && jetOwner && !jetOwner.isDestroyed()) jetOwner.scene.primitives.remove(jet)
    jet = undefined
    jetOwner = undefined
    jetPlacement = undefined
  },
  getActiveAssetPaths: () => jet ? [jetPath] : [],
  getEnhanceTargets: () => jet && jetPlacement ? [{ id: JET_FAN_ID, type: 'ceiling-jet-fan', object: jet,
    metadata: { displayName: '洞顶吊装射流风机', placement: 'demonstration', mounting: 'ceiling', taskReferenceChainage: jetPlacement.chainage,
      outletDirection: jetPlacement.descending ? 'decreasing-chainage' : 'increasing-chainage' },
  }] : [],
}
