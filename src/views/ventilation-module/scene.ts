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
  const move = (movement: any) => {
    if (!mode) return
    const dx = movement.endPosition.x - movement.startPosition.x
    const dy = movement.endPosition.y - movement.startPosition.y
    const focus = focusNow()
    if (mode === 'orbit') {
      const transform = Cesium.Transforms.eastNorthUpToFixedFrame(focus)
      camera.lookAtTransform(transform)
      camera.rotateLeft(dx * 0.005)
      camera.rotateUp(-dy * 0.005)
      camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
    } else {
      const distance = Cesium.Cartesian3.distance(camera.position, focus)
      const scale = distance * 0.0012
      const right = Cesium.Cartesian3.multiplyByScalar(camera.right, -dx * scale, new Cesium.Cartesian3())
      const up = Cesium.Cartesian3.multiplyByScalar(camera.up, dy * scale, new Cesium.Cartesian3())
      const delta = Cesium.Cartesian3.add(right, up, new Cesium.Cartesian3())
      camera.move(delta, 1)
      Cesium.Cartesian3.add(panOffset, delta, panOffset)
    }
    scene.requestRender()
  }
  const wheel = (delta: number) => {
    const focus = focusNow()
    const distance = Cesium.Cartesian3.distance(camera.position, focus)
    const step = Math.min(Math.max(distance * 0.1, 2), 800)
    if (delta > 0 && distance > 5) camera.zoomIn(Math.min(step, distance - 4))
    else if (delta < 0 && distance < 20000) camera.zoomOut(step)
    scene.requestRender()
  }

  const T = Cesium.ScreenSpaceEventType
  handler.setInputAction(() => { mode = 'orbit' }, T.LEFT_DOWN)
  handler.setInputAction(() => { mode = 'pan' }, T.RIGHT_DOWN)
  handler.setInputAction(() => { mode = null }, T.LEFT_UP)
  handler.setInputAction(() => { mode = null }, T.RIGHT_UP)
  handler.setInputAction(move, T.MOUSE_MOVE)
  handler.setInputAction(wheel, T.WHEEL)

  return {
    handler,
    reset() { Cesium.Cartesian3.clone(Cesium.Cartesian3.ZERO, panOffset) },
  }
}
