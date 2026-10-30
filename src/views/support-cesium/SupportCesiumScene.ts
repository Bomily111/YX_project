import * as Cesium from 'cesium'
import { chainageService } from '@/platform/coordinates/ChainageService'
import { viewerService } from '@/platform/viewer/ViewerService'
import { enableUndergroundTerrainBackground } from '@/utils/Common/UndergroundTerrain'
import centerLineData from '@/assets/data/centerLine.json'
import mileageData from '@/assets/data/centerline_mileage.json'
import { SEGMENT_CONFIGS as TUNNEL_SEGMENT_CONFIGS } from '@/views/tunnel-module/tunnel'
import { installModelControls, type ModelControlFrame } from '@/views/ventilation-module/scene'

export type SupportSceneKind = 'editor' | 'alignment'
export interface SupportVisibilityNode { name: string; component: string; supportType: string }
export type SupportHelper =
  | { kind: 'line'; points: number[][]; color: string; segments?: boolean }
  | { kind: 'point'; position: number[]; color: string }
  | { kind: 'label'; position: number[]; text: string }
export interface SupportRange { segment_index: number; support_type: string; centerline_start_distance_m: number; centerline_end_distance_m: number }

const PLATFORM_START = 1116 // The platform centerline's first point: YK1+116.
const SUPPORT_END = 2180
const EDITOR_STATION = 2170 // 48 m before worksite A (YK2+218), inside the support range.
const TUNNEL_SEGMENT_RANGES = [
  { index: 0, start: 1116, end: 1618 },
  { index: 1, start: 1618, end: 2120 },
  { index: 2, start: 2120, end: SUPPORT_END },
] as const
const MAIN_CENTERLINE = (centerLineData as { features: { geometry: { coordinates: number[][] } }[] }).features[0].geometry.coordinates
const MAIN_MILEAGES = mileageData as { mileage: string }[]

export class SupportCesiumScene {
  readonly viewer: Cesium.Viewer
  private model?: Cesium.Model
  private generation = 0
  private readonly createdViewer: boolean
  private visibilityNodes: SupportVisibilityNode[] = []
  private alignmentGridAngle = 0
  private helperEntities: Cesium.Entity[] = []
  private centerlineEntity?: Cesium.Entity
  private rangeEntities: { entity: Cesium.Entity; type: string }[] = []
  private editorCenterlineEntity?: Cesium.Entity
  private tunnelModels = new Map<number, Cesium.Model>()
  private tunnelLoads = new Map<number, Promise<void>>()
  private tunnelTargets = new Set<number>()
  private readonly previousClick?: Cesium.ScreenSpaceEventHandler.PositionedEventCallback
  private readonly cameraControls: ReturnType<typeof installModelControls>
  private readonly previousCameraInputs: {
    enableInputs: boolean; enableRotate: boolean; enableTranslate: boolean
    enableZoom: boolean; enableTilt: boolean; enableLook: boolean
    enableCollisionDetection: boolean
    pickTranslucentDepth: boolean
  }
  onModelPick?: (origin: number[], direction: number[], kind: SupportSceneKind) => void
  onSegmentPick?: (index: number) => void
  onTunnelProgress?: (ready: number, total: number) => void

  private notifyTunnelProgress(): void {
    const total = this.tunnelTargets.size
    const ready = [...this.tunnelTargets].filter(index => this.tunnelModels.get(index)?.ready).length
    this.onTunnelProgress?.(ready, total)
  }

  constructor(host: HTMLElement) {
    this.createdViewer = !viewerService.current
    this.viewer = this.createdViewer
      ? viewerService.create(host, {
          owner: 'support-modeler',
          cesium: {
            baseLayer: false as never, baseLayerPicker: false, geocoder: false,
            timeline: false, animation: false, sceneModePicker: false,
            navigationHelpButton: false, homeButton: false, fullscreenButton: false,
            infoBox: false, selectionIndicator: false, scene3DOnly: true,
            requestRenderMode: false,
          },
        })
      : viewerService.attachTo(host, 'support-modeler')
    enableUndergroundTerrainBackground(this.viewer)
    const controller = this.viewer.scene.screenSpaceCameraController
    this.previousCameraInputs = {
      enableInputs: controller.enableInputs, enableRotate: controller.enableRotate,
      enableTranslate: controller.enableTranslate, enableZoom: controller.enableZoom,
      enableTilt: controller.enableTilt, enableLook: controller.enableLook,
      enableCollisionDetection: controller.enableCollisionDetection,
      pickTranslucentDepth: this.viewer.scene.pickTranslucentDepth,
    }
    controller.enableCollisionDetection = false
    this.viewer.scene.pickTranslucentDepth = true
    const interactionAnchor = chainageService.worldPositionAt(EDITOR_STATION)!
    const enu = Cesium.Transforms.eastNorthUpToFixedFrame(interactionAnchor)
    const inverseEnu = Cesium.Matrix4.inverseTransformation(enu, new Cesium.Matrix4())
    const interactionFrame: ModelControlFrame = {
      up: Cesium.Matrix4.multiplyByPointAsVector(enu, Cesium.Cartesian3.UNIT_Z, new Cesium.Cartesian3()),
      right: Cesium.Matrix4.multiplyByPointAsVector(enu, Cesium.Cartesian3.UNIT_X, new Cesium.Cartesian3()),
      toLocal: position => {
        const point = Cesium.Matrix4.multiplyByPoint(inverseEnu, position, new Cesium.Cartesian3())
        return new Cesium.Cartesian3(point.x, point.z, point.y)
      },
      toWorld: position => Cesium.Matrix4.multiplyByPoint(
        enu, new Cesium.Cartesian3(position.x, position.z, position.y), new Cesium.Cartesian3()),
    }
    this.cameraControls = installModelControls(
      this.viewer, () => chainageService.worldPositionAt(EDITOR_STATION)!, undefined, interactionFrame)
    const handler = this.viewer.screenSpaceEventHandler
    this.previousClick = handler.getInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK) as Cesium.ScreenSpaceEventHandler.PositionedEventCallback | undefined
    handler.setInputAction((event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      const picked = this.viewer.scene.pick(event.position)
      const rangeIndex = typeof picked?.id?.id === 'string' ? /^support-range-(\d+)$/.exec(picked.id.id) : null
      if (rangeIndex) { this.onSegmentPick?.(Number(rangeIndex[1])); return }
      const kind = picked?.id?.kind === 'support-modeler' ? picked.id.page as SupportSceneKind : undefined
      if (!kind || !this.onModelPick) return
      const ray = this.viewer.camera.getPickRay(event.position)
      if (!ray) return
      const inverse = Cesium.Matrix4.inverse(this.frame(kind), new Cesium.Matrix4())
      const origin = Cesium.Matrix4.multiplyByPoint(inverse, ray.origin, new Cesium.Cartesian3())
      const direction = Cesium.Cartesian3.normalize(Cesium.Matrix4.multiplyByPointAsVector(inverse, ray.direction, new Cesium.Cartesian3()), new Cesium.Cartesian3())
      this.onModelPick([origin.x, origin.y, origin.z], [direction.x, direction.y, direction.z], kind)
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
  }

  private frame(kind: SupportSceneKind): Cesium.Matrix4 {
    const anchorStation = kind === 'editor' ? EDITOR_STATION : PLATFORM_START
    const anchor = chainageService.worldPositionAt(anchorStation)
    const station = chainageService.positionWithHeadingAt(anchorStation)
    if (!anchor || !station) throw new Error(`平台中线缺少 YK${Math.floor(anchorStation / 1000)}+${anchorStation % 1000} 锚点`)
    const enu = Cesium.Transforms.eastNorthUpToFixedFrame(anchor)
    const east = Cesium.Matrix4.multiplyByPointAsVector(enu, Cesium.Cartesian3.UNIT_X, new Cesium.Cartesian3())
    const north = Cesium.Matrix4.multiplyByPointAsVector(enu, Cesium.Cartesian3.UNIT_Y, new Cesium.Cartesian3())
    const up = Cesium.Matrix4.multiplyByPointAsVector(enu, Cesium.Cartesian3.UNIT_Z, new Cesium.Cartesian3())
    let x: Cesium.Cartesian3
    let z: Cesium.Cartesian3
    if (kind === 'alignment') {
      // Delivered local line: x=easting, y=elevation, z=-northing.
      // UTM grid north and the platform's local geodetic north differ here.
      // Rotate the delivered tangent onto the platform's start tangent.
      const c = Math.cos(this.alignmentGridAngle), s = Math.sin(this.alignmentGridAngle)
      x = Cesium.Cartesian3.subtract(
        Cesium.Cartesian3.multiplyByScalar(east, c, new Cesium.Cartesian3()),
        Cesium.Cartesian3.multiplyByScalar(north, s, new Cesium.Cartesian3()), new Cesium.Cartesian3())
      z = Cesium.Cartesian3.negate(Cesium.Cartesian3.add(
        Cesium.Cartesian3.multiplyByScalar(east, s, new Cesium.Cartesian3()),
        Cesium.Cartesian3.multiplyByScalar(north, c, new Cesium.Cartesian3()), new Cesium.Cartesian3()), new Cesium.Cartesian3())
    } else {
      // Section local frame: x=transverse, y=up, z=increasing chainage.
      z = Cesium.Cartesian3.add(
        Cesium.Cartesian3.multiplyByScalar(east, Math.sin(station.heading), new Cesium.Cartesian3()),
        Cesium.Cartesian3.multiplyByScalar(north, Math.cos(station.heading), new Cesium.Cartesian3()),
        new Cesium.Cartesian3(),
      )
      x = Cesium.Cartesian3.cross(up, z, new Cesium.Cartesian3())
    }
    const rotation = Cesium.Matrix3.fromColumnMajorArray([
      x.x, x.y, x.z, up.x, up.y, up.z, z.x, z.y, z.z,
    ])
    // The 1 m templates use the top-arch circle center as origin; the
    // delivered section reference places design elevation at local y=-2.1 m.
    const translation = kind === 'editor'
      ? Cesium.Cartesian3.add(anchor, Cesium.Cartesian3.multiplyByScalar(up, 2.1, new Cesium.Cartesian3()), new Cesium.Cartesian3())
      : anchor
    return Cesium.Matrix4.fromRotationTranslation(rotation, translation)
  }

  async loadUrl(url: string, kind: SupportSceneKind): Promise<void> {
    await this.loadModel(url, kind)
  }

  async loadBuffer(buffer: ArrayBuffer, kind: SupportSceneKind): Promise<void> {
    const url = URL.createObjectURL(new Blob([buffer], { type: 'model/gltf-binary' }))
    try { await this.loadModel(url, kind) }
    finally { URL.revokeObjectURL(url) }
  }

  setVisibilityNodes(nodes: SupportVisibilityNode[]): void { this.visibilityNodes = nodes }

  setAlignmentSourceTangent(nextPoint: number[]): void {
    const platformHeading = chainageService.positionWithHeadingAt(PLATFORM_START)?.heading
    if (platformHeading === undefined) return
    this.alignmentGridAngle = platformHeading - Math.atan2(nextPoint[0], -nextPoint[2])
  }

  setAlignmentRanges(ranges: SupportRange[]): void {
    if (this.centerlineEntity) this.viewer.entities.remove(this.centerlineEntity)
    if (this.editorCenterlineEntity) this.viewer.entities.remove(this.editorCenterlineEntity)
    for (const row of this.rangeEntities) this.viewer.entities.remove(row.entity)
    this.rangeEntities = []
    const mainLine = (start: number, end: number) => {
      const entries = MAIN_MILEAGES.map((row, index) => ({ chainage: chainageService.parse(row.mileage), index }))
        .filter(row => row.chainage > start && row.chainage < end)
      return [chainageService.worldPositionAt(start)!,
        ...entries.map(row => Cesium.Cartesian3.fromDegrees(...MAIN_CENTERLINE[row.index] as [number, number, number])),
        chainageService.worldPositionAt(end)!]
    }
    this.centerlineEntity = this.viewer.entities.add({ id: 'support-centerline', name: '项目中线 · 支护段', polyline: {
      positions: mainLine(PLATFORM_START, SUPPORT_END), width: 5,
      material: new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.2, color: Cesium.Color.YELLOW.withAlpha(0.8) }),
      depthFailMaterial: Cesium.Color.YELLOW.withAlpha(0.8),
    } })
    this.editorCenterlineEntity = this.viewer.entities.add({ id: 'support-editor-centerline', name: '项目中线 · 工点A附近', polyline: {
      positions: mainLine(EDITOR_STATION - 50, EDITOR_STATION + 50), width: 5,
      material: new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.2, color: Cesium.Color.YELLOW.withAlpha(0.8) }),
      depthFailMaterial: Cesium.Color.YELLOW.withAlpha(0.8),
    } })
    this.editorCenterlineEntity.show = true
    const palette = ['#6de2e7', '#8bcf8a', '#f5c06e', '#d499f0', '#ed888a', '#79abed']
    const uniqueTypes = [...new Set(ranges.map(row => row.support_type))]
    for (const range of ranges) {
      const path = mainLine(PLATFORM_START + range.centerline_start_distance_m, PLATFORM_START + range.centerline_end_distance_m)
      const color = Cesium.Color.fromCssColorString(palette[uniqueTypes.indexOf(range.support_type) % palette.length])
      const entity = this.viewer.entities.add({ id: `support-range-${range.segment_index}`, polyline: {
        positions: path, width: 5, material: color,
        depthFailMaterial: color,
      } })
      this.rangeEntities.push({ entity, type: range.support_type })
    }
    this.setAlignmentLines(false, false, [])
  }

  private tunnelClippingPlanes(start: number, end: number, modelMatrix: Cesium.Matrix4): Cesium.ClippingPlaneCollection {
    const inverse = Cesium.Matrix4.inverse(modelMatrix, new Cesium.Matrix4())
    const planeAt = (chainage: number, keepForward: boolean) => {
      const before = chainageService.worldPositionAt(Math.max(PLATFORM_START, chainage - 1))!
      const after = chainageService.worldPositionAt(chainage + 1)!
      const tangent = Cesium.Cartesian3.normalize(Cesium.Cartesian3.subtract(after, before, new Cesium.Cartesian3()), new Cesium.Cartesian3())
      const normal = Cesium.Cartesian3.normalize(Cesium.Matrix4.multiplyByPointAsVector(inverse, tangent, new Cesium.Cartesian3()), new Cesium.Cartesian3())
      if (!keepForward) Cesium.Cartesian3.negate(normal, normal)
      const center = chainageService.worldPositionAt(chainage)!
      const up = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(center, new Cesium.Cartesian3())
      const boundary = Cesium.Cartesian3.add(center, Cesium.Cartesian3.multiplyByScalar(up, 2.95, new Cesium.Cartesian3()), new Cesium.Cartesian3())
      const local = Cesium.Matrix4.multiplyByPoint(inverse, boundary, new Cesium.Cartesian3())
      return new Cesium.ClippingPlane(normal, -Cesium.Cartesian3.dot(normal, local))
    }
    return new Cesium.ClippingPlaneCollection({ planes: [planeAt(start, true), planeAt(end, false)], unionClippingRegions: true, edgeWidth: 0 })
  }

  async setTunnelForPage(kind: SupportSceneKind): Promise<void> {
    this.tunnelTargets = new Set(kind === 'editor' ? [2] : [0, 1, 2])
    for (const [index, model] of this.tunnelModels) {
      if (this.tunnelTargets.has(index)) continue
      this.viewer.scene.primitives.remove(model)
      this.tunnelModels.delete(index)
    }
    this.notifyTunnelProgress()
    await Promise.all([...this.tunnelTargets].map(index => this.loadTunnelSegment(index)))
    this.notifyTunnelProgress()
    this.viewer.scene.requestRender()
  }

  private loadTunnelSegment(index: number): Promise<void> {
    const pending = this.tunnelLoads.get(index)
    if (pending) return pending
    if (this.tunnelModels.has(index)) return Promise.resolve()
    const load = (async () => {
      const cfg = TUNNEL_SEGMENT_CONFIGS[index]
      const pos = Cesium.Cartesian3.fromDegrees(cfg.lon, cfg.lat, cfg.height - 0.05)
      const modelMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(pos, new Cesium.HeadingPitchRoll(Cesium.Math.PI_OVER_TWO, 0, 0))
      const range = TUNNEL_SEGMENT_RANGES[index]
      const clippingPlanes = this.tunnelClippingPlanes(range.start, range.end, modelMatrix)
      const name = String(index).padStart(3, '0')
      const model = await Cesium.Model.fromGltfAsync({
        url: `${import.meta.env.BASE_URL}data/tunnel/tunnel${name}.glb`, modelMatrix, clippingPlanes,
        allowPicking: false, id: { kind: 'support-tunnel', segment: index },
      })
      if (this.viewer.isDestroyed() || !this.tunnelTargets.has(index)) { model.destroy(); return }
      model.color = Cesium.Color.fromCssColorString('#00eaff').withAlpha(0.3)
      model.colorBlendMode = Cesium.ColorBlendMode.REPLACE
      this.viewer.scene.primitives.add(model)
      this.tunnelModels.set(index, model)
      model.readyEvent.addEventListener(() => this.notifyTunnelProgress())
      this.notifyTunnelProgress()
      if (index === 0) {
        const applyMainCalibration = () => {
          if (model.isDestroyed()) return
          const pivot = model.boundingSphere.center
          const axis = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(pivot, new Cesium.Cartesian3())
          const rotation = Cesium.Matrix4.fromRotationTranslation(Cesium.Matrix3.fromQuaternion(Cesium.Quaternion.fromAxisAngle(axis, Cesium.Math.toRadians(-0.07))))
          const toOrigin = Cesium.Matrix4.fromTranslation(Cesium.Cartesian3.negate(pivot, new Cesium.Cartesian3()))
          const fromOrigin = Cesium.Matrix4.fromTranslation(pivot)
          const aroundPivot = Cesium.Matrix4.multiply(fromOrigin, Cesium.Matrix4.multiply(rotation, toOrigin, new Cesium.Matrix4()), new Cesium.Matrix4())
          model.modelMatrix = Cesium.Matrix4.multiply(aroundPivot, modelMatrix, new Cesium.Matrix4())
          this.viewer.scene.requestRender()
        }
        if (model.ready) applyMainCalibration()
        else model.readyEvent.addEventListener(applyMainCalibration)
      }
      this.viewer.scene.requestRender()
      if (!model.ready) {
        await new Promise<void>(resolve => {
          const remove = model.readyEvent.addEventListener(() => { window.clearTimeout(timer); remove(); resolve() })
          const timer = window.setTimeout(() => { remove(); resolve() }, 20000)
        })
      }
    })().finally(() => this.tunnelLoads.delete(index))
    this.tunnelLoads.set(index, load)
    return load
  }

  setAlignmentLines(centerline: boolean, ranges: boolean, types: string[]): void {
    if (this.centerlineEntity) this.centerlineEntity.show = centerline
    const enabled = new Set(types)
    for (const row of this.rangeEntities) row.entity.show = ranges && enabled.has(row.type)
    this.viewer.scene.requestRender()
  }

  setEditorHelpers(items: SupportHelper[]): void {
    for (const entity of this.helperEntities) this.viewer.entities.remove(entity)
    this.helperEntities = []
    const frame = this.frame('editor')
    const point = (coordinates: number[]) => Cesium.Matrix4.multiplyByPoint(frame, new Cesium.Cartesian3(...coordinates), new Cesium.Cartesian3())
    for (const item of items) {
      if (item.kind === 'line') {
        const paths = item.segments
          ? Array.from({ length: Math.floor(item.points.length / 2) }, (_, i) => item.points.slice(i * 2, i * 2 + 2))
          : [item.points]
        for (const path of paths) {
          if (path.length < 2) continue
          this.helperEntities.push(this.viewer.entities.add({ polyline: {
            positions: path.map(point), width: 2.5,
            material: Cesium.Color.fromCssColorString(item.color),
            depthFailMaterial: Cesium.Color.fromCssColorString(item.color),
          } }))
        }
      } else if (item.kind === 'point') {
        this.helperEntities.push(this.viewer.entities.add({ position: point(item.position), point: {
          pixelSize: 7, color: Cesium.Color.fromCssColorString(item.color), disableDepthTestDistance: Number.POSITIVE_INFINITY,
        } }))
      } else if (item.text) {
        this.helperEntities.push(this.viewer.entities.add({ position: point(item.position), label: {
          text: item.text, font: '13px Microsoft YaHei', fillColor: Cesium.Color.WHITE,
          showBackground: true, backgroundColor: Cesium.Color.fromCssColorString('#112436').withAlpha(0.9),
          pixelOffset: new Cesium.Cartesian2(8, -8), disableDepthTestDistance: Number.POSITIVE_INFINITY,
        } }))
      }
    }
    this.viewer.scene.requestRender()
  }

  setAlignmentVisibility(components: Record<string, boolean>, types: string[]): void {
    if (!this.model) return
    const enabledTypes = new Set(types)
    for (const item of this.visibilityNodes) {
      const category = item.component === 'primary_concrete' || item.component === 'secondary_lining' ? 'support_body'
        : item.component === 'lattice_arch' ? 'steel_arch'
        : item.component.startsWith('secondary_rebar_') ? 'secondary_rebar' : item.component
      const node = this.model.getNode(item.name)
      if (node) node.show = enabledTypes.has(item.supportType) && components[category] !== false
    }
    this.viewer.scene.requestRender()
  }

  private async loadModel(url: string, kind: SupportSceneKind): Promise<void> {
    const generation = ++this.generation
    // The delivered glTF already uses y as its physical elevation axis. Our
    // model matrix maps that axis to ECEF up, so Cesium's default Y-to-Z
    // conversion must be disabled to avoid rotating the line a second time.
    const model = await Cesium.Model.fromGltfAsync({ url, modelMatrix: this.frame(kind), upAxis: Cesium.Axis.Z, forwardAxis: Cesium.Axis.X, id: { kind: 'support-modeler', page: kind } })
    if (generation !== this.generation || this.viewer.isDestroyed()) { model.destroy(); return }
    this.viewer.scene.primitives.add(model)
    if (this.model) this.viewer.scene.primitives.remove(this.model)
    this.model = model
    this.viewer.scene.requestRender()
  }

  focus(kind: SupportSceneKind, mode = 'overall', station = kind === 'editor' ? EDITOR_STATION : PLATFORM_START): void {
    if (kind === 'alignment' && mode === 'overall') station = PLATFORM_START + 532
    if (this.centerlineEntity) this.centerlineEntity.show = kind === 'alignment' && this.centerlineEntity.show
    if (this.editorCenterlineEntity) this.editorCenterlineEntity.show = kind === 'editor'
    for (const row of this.rangeEntities) row.entity.show = kind === 'alignment' && row.entity.show
    const anchor = chainageService.worldPositionAt(station) ?? chainageService.worldPositionAt(PLATFORM_START)
    if (!anchor) return
    this.cameraControls.setFocus(anchor, false)
    this.viewer.scene.globe.translucency.frontFaceAlphaByDistance = new Cesium.NearFarScalar(0, 0.9, 50000, 0.9)
    const range = kind === 'alignment' && mode === 'overall' ? 1250 : kind === 'alignment' ? 110 : 35
    const tangentHeading = chainageService.positionWithHeadingAt(station)?.heading ?? 0
    const heading = mode === 'front' ? tangentHeading + Math.PI
      : mode === 'side' || mode === 'longitudinal' ? tangentHeading + Cesium.Math.PI_OVER_TWO
      : tangentHeading + 0.4
    const pitch = mode === 'front' ? -0.08 : mode === 'side' || mode === 'longitudinal' ? -0.16 : kind === 'alignment' ? -0.78 : -0.28
    this.viewer.camera.lookAt(anchor, new Cesium.HeadingPitchRange(heading, pitch, range))
    this.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
    this.viewer.scene.requestRender()
  }

  destroy(): void {
    ++this.generation
    this.cameraControls.destroy()
    const controller = this.viewer.scene.screenSpaceCameraController
    Object.assign(controller, {
      enableInputs: this.previousCameraInputs.enableInputs,
      enableRotate: this.previousCameraInputs.enableRotate,
      enableTranslate: this.previousCameraInputs.enableTranslate,
      enableZoom: this.previousCameraInputs.enableZoom,
      enableTilt: this.previousCameraInputs.enableTilt,
      enableLook: this.previousCameraInputs.enableLook,
      enableCollisionDetection: this.previousCameraInputs.enableCollisionDetection,
    })
    this.viewer.scene.pickTranslucentDepth = this.previousCameraInputs.pickTranslucentDepth
    for (const entity of this.helperEntities) this.viewer.entities.remove(entity)
    this.helperEntities = []
    if (this.centerlineEntity) this.viewer.entities.remove(this.centerlineEntity)
    if (this.editorCenterlineEntity) this.viewer.entities.remove(this.editorCenterlineEntity)
    for (const row of this.rangeEntities) this.viewer.entities.remove(row.entity)
    this.rangeEntities = []
    this.tunnelTargets.clear()
    for (const model of this.tunnelModels.values()) this.viewer.scene.primitives.remove(model)
    this.tunnelModels.clear()
    if (!this.viewer.isDestroyed()) {
      const handler = this.viewer.screenSpaceEventHandler
      if (this.previousClick) handler.setInputAction(this.previousClick, Cesium.ScreenSpaceEventType.LEFT_CLICK)
      else handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK)
    }
    if (this.model && !this.viewer.isDestroyed()) this.viewer.scene.primitives.remove(this.model)
    this.model = undefined
    if (this.createdViewer && !this.viewer.isDestroyed()) viewerService.destroy(this.viewer)
  }
}
