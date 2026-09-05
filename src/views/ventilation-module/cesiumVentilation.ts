import * as Cesium from 'cesium'

export type ColorMode = 'velocity' | 'temperature'

export interface CfdData {
  meta: { n: number; x_gap?: number }
  x: number[]; y: number[]; z: number[]
  vx: number[]; vy: number[]; vz: number[]
  temp: number[]; vel: number[]
}

export interface VentilationLayers {
  model?: any
  tunnelLabels?: Cesium.LabelCollection
  points?: Cesium.PointPrimitiveCollection
  arrows?: Cesium.PolylineCollection
  arrowHeads?: Cesium.PointPrimitiveCollection
  streamlines?: Cesium.PolylineCollection
  particles?: Cesium.PointPrimitiveCollection
  particleState: Array<{ point: any; tube: 'left' | 'right'; speed: number }>
  removeAnimation?: () => void
}

export const layers: VentilationLayers = { particleState: [] }

export function velocityColor(value: number, alpha = 1): Cesium.Color {
  const t = Math.min(1, Math.max(0, (value - 0.03) / 1.0))
  let r = 0; let g = 0; let b = 0
  if (t < 0.25) { const s = t / 0.25; r = 0.1; g = 0.2 + s * 0.8; b = 0.5 + s * 0.5 }
  else if (t < 0.5) { const s = (t - 0.25) / 0.25; r = 0; g = 1; b = 1 - s }
  else if (t < 0.75) { const s = (t - 0.5) / 0.25; r = s; g = 1; b = 0 }
  else { const s = (t - 0.75) / 0.25; r = 1; g = 1 - s; b = 0 }
  return new Cesium.Color(r, g, b, alpha)
}

export function temperatureColor(value: number, alpha = 1): Cesium.Color {
  const t = Math.min(1, Math.max(0, (value - 293.15) / 25))
  let r = 0; let g = 0; let b = 0
  if (t < 0.3) { const s = t / 0.3; r = 0.1; g = 0.2 + s * 0.8; b = 0.6 + s * 0.4 }
  else if (t < 0.6) { const s = (t - 0.3) / 0.3; r = s; g = 1; b = 1 - s }
  else if (t < 0.85) { const s = (t - 0.6) / 0.25; r = 1; g = 1 - s * 0.6; b = 0 }
  else { const s = (t - 0.85) / 0.15; r = 1; g = 0.4 - s * 0.4; b = 0 }
  return new Cesium.Color(r, g, b, alpha)
}

function valueColor(mode: ColorMode, velocity: number, temperature: number, alpha = 1) {
  return mode === 'temperature'
    ? temperatureColor(temperature, alpha)
    : velocityColor(velocity, alpha)
}

interface Mapper {
  point(i: number): Cesium.Cartesian3
}

function createMapper(data: CfdData): Mapper {
  const gap = data.meta.x_gap ?? 20
  const left = data.x.filter(x => x <= gap)
  const right = data.x.filter(x => x > gap)
  const yMin = Math.min(...data.y); const yMax = Math.max(...data.y)
  const range = (values: number[]) => [Math.min(...values), Math.max(...values)] as const
  const [lx0, lx1] = range(left); const [rx0, rx1] = range(right)
  const remap = (value: number, a: number, b: number, c: number, d: number) =>
    c + Math.min(1, Math.max(0, (value - a) / Math.max(0.0001, b - a))) * (d - c)
  return {
    point(i: number) {
      const x = data.x[i]
      const mappedX = x <= gap
        ? remap(x, lx0, lx1, 26.5, 37.5)
        : remap(x, rx0, rx1, -5.5, 5.5)
      return new Cesium.Cartesian3(mappedX, remap(data.y[i], yMin, yMax, 0.2, 6.8), data.z[i])
    },
  }
}

export async function loadTunnelModel(viewer: Cesium.Viewer) {
  layers.model = await Cesium.Model.fromGltfAsync({
    url: '/data/ventilation/tunnel-assembled.glb',
    modelMatrix: Cesium.Matrix4.IDENTITY,
    // The migrated model uses project-local coordinates (Y is elevation and Z
    // is tunnel chainage). Prevent Cesium's normal geospatial Y-up conversion
    // so the GLB, CFD samples and local camera stay in the same frame.
    upAxis: Cesium.Axis.Z,
    forwardAxis: Cesium.Axis.X,
  })
  viewer.scene.primitives.add(layers.model)
  layers.model.color = Cesium.Color.WHITE.withAlpha(0.82)
  // Preserve the Blender materials; only add a slight cool tint so TBM,
  // drill-and-blast and auxiliary linings remain visually distinguishable.
  layers.model.colorBlendMode = Cesium.ColorBlendMode.MIX
  layers.model.colorBlendAmount = 0.08
  if (!layers.model.ready) {
    await new Promise<void>((resolve, reject) => {
      const removeReady = layers.model.readyEvent.addEventListener(() => {
        removeReady()
        removeError()
        resolve()
      })
      const removeError = layers.model.errorEvent.addEventListener((error: unknown) => {
        removeReady()
        removeError()
        reject(error)
      })
    })
  }
  const labels = viewer.scene.primitives.add(new Cesium.LabelCollection())
  const labelStyle = {
    font: '600 15px Microsoft YaHei',
    showBackground: true,
    backgroundColor: Cesium.Color.fromCssColorString('#07131f').withAlpha(0.78),
    pixelOffset: new Cesium.Cartesian2(0, -12),
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
    scaleByDistance: new Cesium.NearFarScalar(100, 1, 9000, 0.55),
  }
  labels.add({ ...labelStyle, position: new Cesium.Cartesian3(32, 10, 3905), text: '左主洞 · TBM' })
  labels.add({ ...labelStyle, position: new Cesium.Cartesian3(0, 10, 3905), text: '右主洞 · 钻爆' })
  layers.tunnelLabels = labels
  viewer.scene.requestRender()
  return layers.model
}

export function setModelOpacity(viewer: Cesium.Viewer, opacity: number) {
  if (!layers.model) return
  layers.model.color = Cesium.Color.WHITE.withAlpha(opacity)
  viewer.scene.requestRender()
}

export function buildSteadyLayers(
  viewer: Cesium.Viewer,
  cells: CfdData,
  arrows: CfdData,
  mode: ColorMode,
) {
  removeFlowLayers(viewer)
  const cellMapper = createMapper(cells)
  const arrowMapper = createMapper(arrows)

  const points = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection())
  for (let i = 0; i < cells.x.length; i++) {
    points.add({
      position: cellMapper.point(i),
      color: valueColor(mode, cells.vel[i], cells.temp[i], 0.72),
      pixelSize: 4,
      id: { kind: 'cfd', index: i, velocity: cells.vel[i], temperature: cells.temp[i], chainage: cells.z[i] },
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    })
  }
  layers.points = points

  const lines = viewer.scene.primitives.add(new Cesium.PolylineCollection())
  const heads = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection())
  for (let i = 0; i < arrows.x.length; i++) {
    const start = arrowMapper.point(i)
    const velocity = Math.max(arrows.vel[i], 0.001)
    const direction = Cesium.Cartesian3.normalize(
      new Cesium.Cartesian3(-arrows.vx[i], -arrows.vy[i], -arrows.vz[i]),
      new Cesium.Cartesian3(),
    )
    const end = Cesium.Cartesian3.add(
      start,
      Cesium.Cartesian3.multiplyByScalar(direction, Math.min(14, Math.max(3, velocity * 11)), new Cesium.Cartesian3()),
      new Cesium.Cartesian3(),
    )
    const color = valueColor(mode, velocity, arrows.temp[i], 0.9)
    lines.add({ positions: [start, end], width: 2, material: Cesium.Material.fromType('Color', { color }) })
    heads.add({ position: end, color, pixelSize: 6, disableDepthTestDistance: Number.POSITIVE_INFINITY })
  }
  layers.arrows = lines
  layers.arrowHeads = heads

  const streamlines = viewer.scene.primitives.add(new Cesium.PolylineCollection())
  const sampled = Array.from({ length: arrows.x.length }, (_, i) => i)
    .filter(i => arrows.vel[i] > 0.01)
    .sort((a, b) => arrows.z[a] - arrows.z[b])
  for (const side of ['left', 'right'] as const) {
    const gap = arrows.meta.x_gap ?? 20
    const ids = sampled.filter(i => side === 'left' ? arrows.x[i] <= gap : arrows.x[i] > gap)
    for (let lane = 0; lane < 6; lane++) {
      const laneIds = ids.filter((_, index) => index % 6 === lane)
      if (laneIds.length < 2) continue
      const positions = laneIds.map(i => arrowMapper.point(i))
      const avgV = laneIds.reduce((sum, i) => sum + arrows.vel[i], 0) / laneIds.length
      const avgT = laneIds.reduce((sum, i) => sum + arrows.temp[i], 0) / laneIds.length
      streamlines.add({
        positions,
        width: 1.5,
        material: Cesium.Material.fromType('Color', { color: valueColor(mode, avgV, avgT, 0.75) }),
      })
    }
  }
  layers.streamlines = streamlines

  const particles = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection())
  layers.particleState = []
  for (let i = 0; i < 180; i++) {
    const tube = Math.random() < 0.5 ? 'left' : 'right'
    const x = tube === 'left' ? 32 + (Math.random() - 0.5) * 10 : (Math.random() - 0.5) * 10
    const point = particles.add({
      position: new Cesium.Cartesian3(x, 0.5 + Math.random() * 5.8, 3805 + Math.random() * 200),
      color: velocityColor(0.5, 0.82), pixelSize: 5,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    })
    layers.particleState.push({ point, tube, speed: 10 + Math.random() * 22 })
  }
  layers.particles = particles
  const animate = (_scene: any, time: Cesium.JulianDate) => {
    const seconds = Cesium.JulianDate.toDate(time).getTime() / 1000
    for (let i = 0; i < layers.particleState.length; i++) {
      const state = layers.particleState[i]
      const current = state.point.position as Cesium.Cartesian3
      const span = 200
      const z = 4005 - ((seconds * state.speed + i * 7.3) % span)
      state.point.position = new Cesium.Cartesian3(current.x, current.y, z)
    }
  }
  viewer.scene.preRender.addEventListener(animate)
  layers.removeAnimation = () => viewer.scene.preRender.removeEventListener(animate)
  viewer.scene.requestRender()
}

export function recolorSteady(cells: CfdData, mode: ColorMode) {
  if (!layers.points) return
  for (let i = 0; i < layers.points.length; i++) {
    layers.points.get(i).color = valueColor(mode, cells.vel[i], cells.temp[i], 0.72)
  }
}

export function updateThermalPoints(viewer: Cesium.Viewer, data: CfdData) {
  if (layers.points) viewer.scene.primitives.remove(layers.points)
  const mapper = createMapper(data)
  const points = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection())
  for (let i = 0; i < data.x.length; i++) {
    points.add({
      position: mapper.point(i),
      color: temperatureColor(data.temp[i], 0.78),
      pixelSize: 4,
      id: { kind: 'thermal', index: i, velocity: data.vel[i], temperature: data.temp[i], chainage: data.z[i] },
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    })
  }
  layers.points = points
  viewer.scene.requestRender()
}

export function setLayerVisible(name: 'points' | 'arrows' | 'streamlines' | 'particles', show: boolean) {
  if (name === 'arrows') {
    if (layers.arrows) layers.arrows.show = show
    if (layers.arrowHeads) layers.arrowHeads.show = show
  } else if (layers[name]) {
    ;(layers[name] as any).show = show
  }
}

export function removeFlowLayers(viewer: Cesium.Viewer) {
  layers.removeAnimation?.()
  for (const key of ['points', 'arrows', 'arrowHeads', 'streamlines', 'particles'] as const) {
    const primitive = layers[key]
    if (primitive) viewer.scene.primitives.remove(primitive as any)
    ;(layers as any)[key] = undefined
  }
  layers.particleState = []
  layers.removeAnimation = undefined
}

export function destroyVentilation(viewer: Cesium.Viewer) {
  removeFlowLayers(viewer)
  if (layers.model) viewer.scene.primitives.remove(layers.model)
  layers.model = undefined
}
