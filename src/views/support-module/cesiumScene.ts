import * as Cesium from 'cesium'
import { enableUndergroundTerrainBackground } from '@/utils/Common/UndergroundTerrain'
import { viewerService } from '@/platform/viewer/ViewerService'
import { waitForTunnelGlbSegment } from '@/utils/Common/DrawLine'
import { createScreenSpaceEventHandler } from '@/platform/input/ScreenSpaceEventRegistry'

interface ViewerSnapshot {
  backgroundColor: Cesium.Color
  light: Cesium.Light
  requestRenderMode: boolean
  maximumRenderTimeChange: number
  enableCollisionDetection: boolean
  enableInputs: boolean
  enableRotate: boolean
  enableTranslate: boolean
  enableZoom: boolean
  enableTilt: boolean
  enableLook: boolean
}

const viewerSnapshots = new WeakMap<Cesium.Viewer, ViewerSnapshot>()

// 隧道分段锚点（与 tunnel-module/tunnel.ts 一致）
const SEGMENT_CONFIGS = [
  { lon: 94.8943747778, lat: 29.5328943333, height: 2943.001 },
  { lon: 94.8994591299, lat: 29.533666056799998, height: 2945.511 },
  { lon: 94.9046167002, lat: 29.5335168988, height: 2948.021 },
  { lon: 94.9096121866, lat: 29.5324591149, height: 2950.521 },
  { lon: 94.9142762668, lat: 29.530528552299998, height: 2953.031 },
  { lon: 94.9184237403, lat: 29.527863081299998, height: 2955.531 },
  { lon: 94.9224308627, lat: 29.5250512374, height: 2958.021 },
  { lon: 94.926453861, lat: 29.5222279812, height: 2960.521 },
  { lon: 94.93047663509999, lat: 29.5194046043, height: 2963.021 },
  { lon: 94.9344991851, lat: 29.516581097699998, height: 2965.521 },
  { lon: 94.93850541569999, lat: 29.5137687733, height: 2968.011 },
  { lon: 94.9425275186, lat: 29.510945035, height: 2970.511 },
  { lon: 94.94654939739999, lat: 29.508121176099998, height: 2973.011 },
  { lon: 94.9505549596, lat: 29.5053084919, height: 2975.501 },
  { lon: 94.9545763914, lat: 29.5024843835, height: 2978.001 },
  { lon: 94.95859759929999, lat: 29.499660163599998, height: 2977.566 },
  { lon: 94.9626185833, lat: 29.496835823399998, height: 2965.48 },
]

export function getSegmentModelMatrix(i: number): Cesium.Matrix4 {
  const c = SEGMENT_CONFIGS[i]
  const pos = Cesium.Cartesian3.fromDegrees(c.lon, c.lat, c.height)
  const hpr = new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(90), 0, 0)
  return Cesium.Transforms.headingPitchRollToFixedFrame(pos, hpr)
}

export function createSupportViewer(container: HTMLElement): Cesium.Viewer {
  const existing = viewerService.current
  const viewer = existing
    ? viewerService.attachTo(container, 'support-module')
    : viewerService.create(container, {
        owner: 'support-module',
        cesium: {
          baseLayer: false as any,
          baseLayerPicker: false,
          geocoder: false,
          timeline: false,
          animation: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          homeButton: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
          scene3DOnly: true,
          requestRenderMode: false,
        },
      })

  const s = viewer.scene
  const controls = s.screenSpaceCameraController
  if (existing && !viewerSnapshots.has(viewer)) {
    viewerSnapshots.set(viewer, {
      backgroundColor: Cesium.Color.clone(s.backgroundColor),
      light: s.light,
      requestRenderMode: s.requestRenderMode,
      maximumRenderTimeChange: s.maximumRenderTimeChange,
      enableCollisionDetection: controls.enableCollisionDetection,
      enableInputs: controls.enableInputs,
      enableRotate: controls.enableRotate,
      enableTranslate: controls.enableTranslate,
      enableZoom: controls.enableZoom,
      enableTilt: controls.enableTilt,
      enableLook: controls.enableLook,
    })
  }
  s.backgroundColor = Cesium.Color.fromCssColorString('#0a0e15')
  s.requestRenderMode = false
  s.debugShowFramesPerSecond = false
  controls.enableCollisionDetection = false

  s.light = new Cesium.DirectionalLight({
    direction: new Cesium.Cartesian3(0.35, -0.89, -0.28),
    intensity: 2.5,
  })

  const credit = viewer.cesiumWidget.creditContainer as HTMLElement
  if (credit) credit.style.display = 'none'

  if (!existing) enableUndergroundTerrainBackground(viewer)

  return viewer
}

export function releaseSupportViewer(viewer: Cesium.Viewer): void {
  const snapshot = viewerSnapshots.get(viewer)
  if (snapshot) {
    const scene = viewer.scene
    const controls = scene.screenSpaceCameraController
    scene.backgroundColor = snapshot.backgroundColor
    scene.light = snapshot.light
    scene.requestRenderMode = snapshot.requestRenderMode
    scene.maximumRenderTimeChange = snapshot.maximumRenderTimeChange
    controls.enableCollisionDetection = snapshot.enableCollisionDetection
    controls.enableInputs = snapshot.enableInputs
    controls.enableRotate = snapshot.enableRotate
    controls.enableTranslate = snapshot.enableTranslate
    controls.enableZoom = snapshot.enableZoom
    controls.enableTilt = snapshot.enableTilt
    controls.enableLook = snapshot.enableLook
    viewerSnapshots.delete(viewer)
    scene.requestRender()
    return
  }
  if (viewerService.currentOwner === 'support-module') viewerService.destroy(viewer)
}

export async function loadTunnelModel(viewer: Cesium.Viewer): Promise<Cesium.Model> {
  return waitForTunnelGlbSegment(0, viewer)
}

export function setTunnelOpacity(model: Cesium.Model, opacity: number): void {
  model.color = Cesium.Color.fromCssColorString('#cfd8e3').withAlpha(opacity)
  model.colorBlendMode = opacity >= 0.95 ? Cesium.ColorBlendMode.HIGHLIGHT : Cesium.ColorBlendMode.REPLACE
}

export function getArchFocus(tunnelModel: Cesium.Model): Cesium.Cartesian3 {
  return tunnelModel.boundingSphere.center.clone()
}

export function getArchModelMatrix(tunnelModel: Cesium.Model): Cesium.Matrix4 {
  const center = tunnelModel.boundingSphere.center.clone()
  const hpr = new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(90), 0, 0)
  return Cesium.Transforms.headingPitchRollToFixedFrame(center, hpr)
}

export function setupClickHandler(
  viewer: Cesium.Viewer,
  archModel: () => Cesium.Model | null,
  workfaceModel: () => Cesium.Model | null,
  onToggle: () => void
) {
  const handler = createScreenSpaceEventHandler('support.model-pick', viewer.scene.canvas)
  handler.setInputAction((click: any) => {
    const picked = viewer.scene.pick(click.position)
    if (picked && (picked.primitive === archModel() || picked.primitive === workfaceModel())) {
      onToggle()
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
  return handler
}

export function enableOnDemandRender(viewer: Cesium.Viewer): void {
  viewer.scene.requestRenderMode = true
  viewer.scene.maximumRenderTimeChange = Infinity
  viewer.scene.requestRender()
}

export function installOrbitControls(
  viewer: Cesium.Viewer,
  getFocus: () => Cesium.Cartesian3 | undefined
) {
  const scene = viewer.scene
  const cam = viewer.camera
  const ctrl = scene.screenSpaceCameraController
  ctrl.enableInputs = false
  ctrl.enableRotate = false
  ctrl.enableTranslate = false
  ctrl.enableZoom = false
  ctrl.enableTilt = false
  ctrl.enableLook = false

  const MIN = 2.5; const MAX = 600
  const ORBIT_SPEED = 0.006
  const panOffset = new Cesium.Cartesian3()

  const focusNow = () => {
    const f = getFocus()
    return f ? Cesium.Cartesian3.add(f, panOffset, new Cesium.Cartesian3()) : undefined
  }

  const h = createScreenSpaceEventHandler('support.camera-controls', scene.canvas)
  let mode: 'orbit' | 'pan' | null = null

  const onLeftDown = () => { mode = 'orbit' }
  const onRightDown = () => { mode = 'pan' }
  const onEnd = () => { mode = null }

  const onMove = (m: any) => {
    if (!mode) return
    const focus = focusNow()
    if (!focus) return
    const dx = m.endPosition.x - m.startPosition.x
    const dy = m.endPosition.y - m.startPosition.y
    if (mode === 'orbit') {
      const t = Cesium.Transforms.eastNorthUpToFixedFrame(focus)
      cam.lookAtTransform(t)
      cam.rotateLeft(dx * ORBIT_SPEED)
      cam.rotateUp(-dy * ORBIT_SPEED)
      cam.lookAtTransform(Cesium.Matrix4.IDENTITY)
    } else {
      const dist = Cesium.Cartesian3.distance(cam.position, focus)
      const s = dist * 0.0015
      const rd = Cesium.Cartesian3.multiplyByScalar(cam.right, -dx * s, new Cesium.Cartesian3())
      const ud = Cesium.Cartesian3.multiplyByScalar(cam.up, dy * s, new Cesium.Cartesian3())
      const delta = Cesium.Cartesian3.add(rd, ud, new Cesium.Cartesian3())
      cam.move(delta, 1.0)
      Cesium.Cartesian3.add(panOffset, delta, panOffset)
    }
    scene.requestRender()
  }

  const onWheel = (delta: number) => {
    const focus = focusNow()
    if (!focus) return
    const dist = Cesium.Cartesian3.distance(cam.position, focus)
    let step = Math.min(dist * 0.10, 20)
    if (delta > 0) {
      if (dist - step < MIN) step = Math.max(0, dist - MIN)
      cam.zoomIn(step)
    } else {
      if (dist + step > MAX) step = Math.max(0, MAX - dist)
      cam.zoomOut(step)
    }
    scene.requestRender()
  }

  const T = Cesium.ScreenSpaceEventType
  const K = Cesium.KeyboardEventModifier
  const mods: (number | undefined)[] = [undefined, K.CTRL, K.SHIFT, K.ALT]
  for (const mod of mods) {
    h.setInputAction(onLeftDown, T.LEFT_DOWN, mod as any)
    h.setInputAction(onRightDown, T.RIGHT_DOWN, mod as any)
    h.setInputAction(onEnd, T.LEFT_UP, mod as any)
    h.setInputAction(onEnd, T.RIGHT_UP, mod as any)
    h.setInputAction(onMove, T.MOUSE_MOVE, mod as any)
    h.setInputAction(onWheel, T.WHEEL, mod as any)
  }

  const resetFocus = () => Cesium.Cartesian3.clone(Cesium.Cartesian3.ZERO, panOffset)
  return { handler: h, resetFocus }
}
