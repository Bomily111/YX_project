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
  // 保留半透明模型的深度信息，供 Cesium 原生导航与点击拾取使用。
  scene.pickTranslucentDepth = true
  const cameraController = scene.screenSpaceCameraController
  cameraController.enableCollisionDetection = false
  // 与主页面保持一致的缩放手感和距离范围。
  cameraController.zoomFactor = 1.5
  cameraController.minimumZoomDistance = 5
  cameraController.maximumZoomDistance = 50000
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

/**
 * 工程模型查看器控制：
 * - 左键：围绕鼠标落点旋转（空白处使用当前观察平面）
 * - 中键 / 右键 / Shift+左键：平移
 * - 滚轮：朝鼠标指向的位置缩放
 * - 双指：缩放并平移
 *
 * 隧道使用局部 Y-up 坐标并隐藏了地球，因此不使用依赖椭球面的 Cesium
 * 默认导航。动态拾取旋转点也避免长模型始终围绕一个固定中心旋转。
 */
export function installModelControls(
  viewer: Cesium.Viewer,
  getDefaultFocus: () => Cesium.Cartesian3,
) {
  const scene = viewer.scene
  const camera = viewer.camera
  const canvas = scene.canvas
  const controller = scene.screenSpaceCameraController
  controller.enableInputs = false
  controller.enableRotate = false
  controller.enableTranslate = false
  controller.enableZoom = false
  controller.enableTilt = false
  controller.enableLook = false

  const WORLD_UP = Cesium.Cartesian3.UNIT_Y
  const MIN_DISTANCE = 1.5
  const MAX_DISTANCE = 50000
  const ORBIT_SPEED = 0.0042
  const PAN_SPEED = 0.00125
  const ZOOM_IN_FACTOR = 0.86
  const ZOOM_OUT_FACTOR = 1.16
  const pivot = Cesium.Cartesian3.clone(getDefaultFocus())
  const lastPointer = new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2)
  const handler = new Cesium.ScreenSpaceEventHandler(canvas)
  let mode: 'orbit' | 'pan' | null = null
  let pinching = false

  const copyPointer = (position?: Cesium.Cartesian2) => {
    if (position) Cesium.Cartesian2.clone(position, lastPointer)
  }

  const midpoint = (a: Cesium.Cartesian2, b: Cesium.Cartesian2) => new Cesium.Cartesian2(
    (a.x + b.x) * 0.5,
    (a.y + b.y) * 0.5,
  )

  const setLookAt = (position: Cesium.Cartesian3, target: Cesium.Cartesian3) => {
    const direction = Cesium.Cartesian3.normalize(
      Cesium.Cartesian3.subtract(target, position, new Cesium.Cartesian3()),
      new Cesium.Cartesian3(),
    )
    let right = Cesium.Cartesian3.cross(direction, WORLD_UP, new Cesium.Cartesian3())
    if (Cesium.Cartesian3.magnitudeSquared(right) < Cesium.Math.EPSILON8) {
      right = Cesium.Cartesian3.clone(camera.rightWC)
    } else {
      Cesium.Cartesian3.normalize(right, right)
    }
    const up = Cesium.Cartesian3.normalize(
      Cesium.Cartesian3.cross(right, direction, new Cesium.Cartesian3()),
      new Cesium.Cartesian3(),
    )
    camera.setView({ destination: position, orientation: { direction, up } })
  }

  const pointOnViewPlane = (screenPosition: Cesium.Cartesian2, reference: Cesium.Cartesian3) => {
    const ray = camera.getPickRay(screenPosition)
    if (!ray) return undefined
    const plane = Cesium.Plane.fromPointNormal(reference, camera.directionWC)
    return Cesium.IntersectionTests.rayPlane(ray, plane, new Cesium.Cartesian3())
  }

  const pickWorld = (screenPosition: Cesium.Cartesian2, fallback = true) => {
    let picked: Cesium.Cartesian3 | undefined
    if (scene.pickPositionSupported && Cesium.defined(scene.pick(screenPosition))) {
      try {
        const depthPoint = scene.pickPosition(screenPosition)
        if (Cesium.defined(depthPoint)) picked = Cesium.Cartesian3.clone(depthPoint)
      } catch {
        // 模型尚未完成深度写入时退回当前观察平面。
      }
    }
    return picked ?? (fallback ? pointOnViewPlane(screenPosition, pivot) : undefined)
  }

  const begin = (nextMode: 'orbit' | 'pan', event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
    mode = nextMode
    copyPointer(event.position)
    if (nextMode === 'orbit') {
      const nextPivot = pickWorld(event.position)
      if (nextPivot) Cesium.Cartesian3.clone(nextPivot, pivot)
    }
    canvas.style.cursor = nextMode === 'orbit' ? 'grabbing' : 'move'
  }

  const end = () => {
    mode = null
    canvas.style.cursor = 'grab'
  }

  const panByPixels = (dx: number, dy: number, target = pivot) => {
    const distance = Math.max(Cesium.Cartesian3.distance(camera.positionWC, target), MIN_DISTANCE)
    const scale = distance * PAN_SPEED
    const horizontal = Cesium.Cartesian3.multiplyByScalar(camera.rightWC, -dx * scale, new Cesium.Cartesian3())
    const vertical = Cesium.Cartesian3.multiplyByScalar(camera.upWC, dy * scale, new Cesium.Cartesian3())
    const delta = Cesium.Cartesian3.add(horizontal, vertical, new Cesium.Cartesian3())
    const position = Cesium.Cartesian3.add(camera.positionWC, delta, new Cesium.Cartesian3())
    Cesium.Cartesian3.add(target, delta, target)
    setLookAt(position, target)
  }

  const orbitByPixels = (dx: number, dy: number) => {
    const offset = Cesium.Cartesian3.subtract(camera.positionWC, pivot, new Cesium.Cartesian3())
    const distance = Math.max(Cesium.Cartesian3.magnitude(offset), MIN_DISTANCE)
    const horizontal = Math.hypot(offset.x, offset.z)
    const yaw = Math.atan2(offset.x, offset.z) - dx * ORBIT_SPEED
    const currentPitch = Math.atan2(offset.y, horizontal)
    const pitch = Cesium.Math.clamp(currentPitch + dy * ORBIT_SPEED, -1.47, 1.47)
    const projected = Math.cos(pitch) * distance
    const position = new Cesium.Cartesian3(
      pivot.x + Math.sin(yaw) * projected,
      pivot.y + Math.sin(pitch) * distance,
      pivot.z + Math.cos(yaw) * projected,
    )
    setLookAt(position, pivot)
  }

  const zoomAt = (screenPosition: Cesium.Cartesian2, zoomIn: boolean, factor?: number) => {
    const anchor = pickWorld(screenPosition) ?? Cesium.Cartesian3.clone(pivot)
    const offset = Cesium.Cartesian3.subtract(camera.positionWC, anchor, new Cesium.Cartesian3())
    const distance = Math.max(Cesium.Cartesian3.magnitude(offset), Cesium.Math.EPSILON6)
    const nextDistance = Cesium.Math.clamp(
      distance * (factor ?? (zoomIn ? ZOOM_IN_FACTOR : ZOOM_OUT_FACTOR)),
      MIN_DISTANCE,
      MAX_DISTANCE,
    )
    if (Math.abs(nextDistance - distance) < Cesium.Math.EPSILON6) return
    Cesium.Cartesian3.multiplyByScalar(offset, nextDistance / distance, offset)
    Cesium.Cartesian3.clone(anchor, pivot)
    // 指向缩放只改变相机位置，不重新朝向拾取点；否则光标偏离屏幕中心时
    // 会产生额外的航向/俯仰变化，视觉上就像隧道随滚轮发生旋转。
    const direction = Cesium.Cartesian3.clone(camera.directionWC)
    const up = Cesium.Cartesian3.clone(camera.upWC)
    camera.setView({
      destination: Cesium.Cartesian3.add(anchor, offset, new Cesium.Cartesian3()),
      orientation: { direction, up },
    })
  }

  const move = (event: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
    copyPointer(event.endPosition)
    if (!mode || pinching) return
    const dx = event.endPosition.x - event.startPosition.x
    const dy = event.endPosition.y - event.startPosition.y
    if (mode === 'orbit') orbitByPixels(dx, dy)
    else panByPixels(dx, dy)
    scene.requestRender()
  }

  const wheel = (delta: number) => {
    zoomAt(lastPointer, delta > 0)
    scene.requestRender()
  }

  const pinchStart = (event: Cesium.ScreenSpaceEventHandler.TwoPointEvent) => {
    pinching = true
    mode = null
    const center = midpoint(event.position1, event.position2)
    copyPointer(center)
    const nextPivot = pickWorld(center)
    if (nextPivot) Cesium.Cartesian3.clone(nextPivot, pivot)
  }

  const pinchMove = (event: Cesium.ScreenSpaceEventHandler.TwoPointMotionEvent) => {
    const previousCenter = midpoint(event.previousPosition1, event.previousPosition2)
    const center = midpoint(event.position1, event.position2)
    const previousDistance = Cesium.Cartesian2.distance(event.previousPosition1, event.previousPosition2)
    const distance = Cesium.Cartesian2.distance(event.position1, event.position2)
    panByPixels(center.x - previousCenter.x, center.y - previousCenter.y)
    if (previousDistance > Cesium.Math.EPSILON6 && distance > Cesium.Math.EPSILON6) {
      zoomAt(center, distance > previousDistance, previousDistance / distance)
    }
    copyPointer(center)
    scene.requestRender()
  }

  const T = Cesium.ScreenSpaceEventType
  const K = Cesium.KeyboardEventModifier
  const orbitModifiers: (Cesium.KeyboardEventModifier | undefined)[] = [undefined, K.CTRL, K.ALT]
  const allModifiers: (Cesium.KeyboardEventModifier | undefined)[] = [undefined, K.CTRL, K.SHIFT, K.ALT]
  for (const modifier of orbitModifiers) handler.setInputAction((event: any) => begin('orbit', event), T.LEFT_DOWN, modifier)
  handler.setInputAction((event: any) => begin('pan', event), T.LEFT_DOWN, K.SHIFT)
  for (const modifier of allModifiers) {
    handler.setInputAction((event: any) => begin('pan', event), T.MIDDLE_DOWN, modifier)
    handler.setInputAction((event: any) => begin('pan', event), T.RIGHT_DOWN, modifier)
    handler.setInputAction(end, T.LEFT_UP, modifier)
    handler.setInputAction(end, T.MIDDLE_UP, modifier)
    handler.setInputAction(end, T.RIGHT_UP, modifier)
    handler.setInputAction(move, T.MOUSE_MOVE, modifier)
    handler.setInputAction(wheel, T.WHEEL, modifier)
  }
  handler.setInputAction(pinchStart, T.PINCH_START)
  handler.setInputAction(pinchMove, T.PINCH_MOVE)
  handler.setInputAction(() => { pinching = false; end() }, T.PINCH_END)

  const preventContextMenu = (event: Event) => event.preventDefault()
  canvas.addEventListener('contextmenu', preventContextMenu)
  canvas.style.cursor = 'grab'
  canvas.style.touchAction = 'none'

  return {
    isInteracting: () => mode !== null || pinching,
    reset() {
      Cesium.Cartesian3.clone(getDefaultFocus(), pivot)
      camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
      canvas.style.cursor = 'grab'
    },
    destroy() {
      handler.destroy()
      canvas.removeEventListener('contextmenu', preventContextMenu)
      canvas.style.cursor = ''
      canvas.style.touchAction = ''
    },
  }
}
