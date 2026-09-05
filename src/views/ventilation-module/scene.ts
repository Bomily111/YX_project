import * as Cesium from 'cesium'

export function createVentilationViewer(container: HTMLElement): Cesium.Viewer {
  const viewer = new Cesium.Viewer(container, {
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
  })

  const scene = viewer.scene
  scene.globe.show = false
  ;(scene.skyBox as any).show = false
  scene.sun.show = false
  scene.moon.show = false
  scene.skyAtmosphere.show = false
  scene.fog.enabled = false
  scene.backgroundColor = Cesium.Color.fromCssColorString('#07131f')
  scene.screenSpaceCameraController.enableCollisionDetection = false
  scene.light = new Cesium.DirectionalLight({
    direction: new Cesium.Cartesian3(0.35, -0.8, -0.4),
    intensity: 2.2,
  })

  const credit = viewer.cesiumWidget.creditContainer as HTMLElement
  if (credit) credit.style.display = 'none'
  return viewer
}

export function lookAtLocal(
  viewer: Cesium.Viewer,
  target: Cesium.Cartesian3,
  offset: Cesium.Cartesian3,
) {
  const destination = Cesium.Cartesian3.add(target, offset, new Cesium.Cartesian3())
  const direction = Cesium.Cartesian3.normalize(
    Cesium.Cartesian3.subtract(target, destination, new Cesium.Cartesian3()),
    new Cesium.Cartesian3(),
  )
  viewer.camera.setView({
    destination,
    orientation: { direction, up: Cesium.Cartesian3.UNIT_Y },
  })
  viewer.scene.requestRender()
}

export function installLocalOrbit(
  viewer: Cesium.Viewer,
  getFocus: () => Cesium.Cartesian3,
) {
  const scene = viewer.scene
  const camera = viewer.camera
  const controller = scene.screenSpaceCameraController
  controller.enableInputs = false
  const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas)
  const panOffset = new Cesium.Cartesian3()
  let mode: 'orbit' | 'pan' | null = null

  const focusNow = () => Cesium.Cartesian3.add(getFocus(), panOffset, new Cesium.Cartesian3())
  const setLocalView = (position: Cesium.Cartesian3, focus: Cesium.Cartesian3) => {
    const direction = Cesium.Cartesian3.normalize(
      Cesium.Cartesian3.subtract(focus, position, new Cesium.Cartesian3()),
      new Cesium.Cartesian3(),
    )
    camera.setView({ destination: position, orientation: { direction, up: Cesium.Cartesian3.UNIT_Y } })
  }
  const move = (movement: any) => {
    if (!mode) return
    const dx = movement.endPosition.x - movement.startPosition.x
    const dy = movement.endPosition.y - movement.startPosition.y
    const focus = focusNow()
    if (mode === 'orbit') {
      // Work entirely in the tunnel's local Y-up frame. Cesium's normal
      // east/north/up orbit is unstable for engineering models near (0,0,0).
      const offset = Cesium.Cartesian3.subtract(camera.position, focus, new Cesium.Cartesian3())
      const distance = Math.max(Cesium.Cartesian3.magnitude(offset), 0.001)
      const horizontal = Math.hypot(offset.x, offset.z)
      const yaw = Math.atan2(offset.x, offset.z) - dx * 0.0045
      const currentPitch = Math.atan2(offset.y, horizontal)
      const pitch = Cesium.Math.clamp(currentPitch + dy * 0.004, -1.47, 1.47)
      const projected = Math.cos(pitch) * distance
      const position = new Cesium.Cartesian3(
        focus.x + Math.sin(yaw) * projected,
        focus.y + Math.sin(pitch) * distance,
        focus.z + Math.cos(yaw) * projected,
      )
      setLocalView(position, focus)
    } else {
      const distance = Cesium.Cartesian3.distance(camera.position, focus)
      const scale = Math.max(distance * 0.001, 0.02)
      const right = Cesium.Cartesian3.multiplyByScalar(camera.right, -dx * scale, new Cesium.Cartesian3())
      const up = Cesium.Cartesian3.multiplyByScalar(camera.up, dy * scale, new Cesium.Cartesian3())
      const delta = Cesium.Cartesian3.add(right, up, new Cesium.Cartesian3())
      Cesium.Cartesian3.add(panOffset, delta, panOffset)
      const position = Cesium.Cartesian3.add(camera.position, delta, new Cesium.Cartesian3())
      setLocalView(position, Cesium.Cartesian3.add(focus, delta, new Cesium.Cartesian3()))
    }
    scene.requestRender()
  }
  const wheel = (delta: number) => {
    const focus = focusNow()
    const offset = Cesium.Cartesian3.subtract(camera.position, focus, new Cesium.Cartesian3())
    const distance = Cesium.Cartesian3.magnitude(offset)
    const nextDistance = Cesium.Math.clamp(distance * (delta > 0 ? 0.86 : 1.16), 4, 26000)
    Cesium.Cartesian3.multiplyByScalar(offset, nextDistance / Math.max(distance, 0.001), offset)
    setLocalView(Cesium.Cartesian3.add(focus, offset, new Cesium.Cartesian3()), focus)
    scene.requestRender()
  }

  const T = Cesium.ScreenSpaceEventType
  const begin = (nextMode: 'orbit' | 'pan') => { mode = nextMode; scene.canvas.style.cursor = 'grabbing' }
  const end = () => { mode = null; scene.canvas.style.cursor = 'grab' }
  scene.canvas.style.cursor = 'grab'
  handler.setInputAction(() => begin('orbit'), T.LEFT_DOWN)
  handler.setInputAction(() => begin('pan'), T.RIGHT_DOWN)
  handler.setInputAction(() => begin('pan'), T.MIDDLE_DOWN)
  handler.setInputAction(end, T.LEFT_UP)
  handler.setInputAction(end, T.RIGHT_UP)
  handler.setInputAction(end, T.MIDDLE_UP)
  handler.setInputAction(move, T.MOUSE_MOVE)
  handler.setInputAction(wheel, T.WHEEL)

  return {
    handler,
    reset() { Cesium.Cartesian3.clone(Cesium.Cartesian3.ZERO, panOffset) },
  }
}
