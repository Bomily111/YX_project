/*
 * 隧道段加载 —— 只加载需要的段(默认只加载承载爆破断面的 000 段)
 * 平台原本一次性加载 17 段 ≈ 1.1GB, 这里默认只 1 段(68MB) -> 流畅。
 * 想看更多隧道时把 DEFAULT_SEGMENTS 改成 [0,1,2] 之类即可。
 */
import * as Cesium from 'cesium'

// 与平台一致的分段锚点(heading 全 90)
export const SEGMENT_CONFIGS = [
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

// 承载爆破断面的段(与爆破几何烘焙时一致)
export const BLAST_SEGMENT_INDEX = 0
// 默认只加载爆破所在段(性能最佳)
export const DEFAULT_SEGMENTS = [0]

export function segmentModelMatrix(i: number): Cesium.Matrix4 {
  const c = SEGMENT_CONFIGS[i]
  const pos = Cesium.Cartesian3.fromDegrees(c.lon, c.lat, c.height)
  const hpr = new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(90), 0, 0)
  return Cesium.Transforms.headingPitchRollToFixedFrame(pos, hpr)
}

let tunnelModels: any[] = []

export async function loadTunnel(viewer: Cesium.Viewer, segments: number[] = DEFAULT_SEGMENTS) {
  removeTunnel(viewer)
  for (const i of segments) {
    const idx = String(i).padStart(3, '0')
    try {
      const model = await Cesium.Model.fromGltfAsync({
        url: `data/tunnel/tunnel${idx}.glb`,
        modelMatrix: segmentModelMatrix(i),
      })
      viewer.scene.primitives.add(model)
      tunnelModels.push(model)
    } catch (e) {
      console.error(`[tunnel] tunnel${idx}.glb 加载失败`, e)
    }
  }
  viewer.scene.requestRender()
}

export function removeTunnel(viewer: Cesium.Viewer) {
  for (const m of tunnelModels) { try { viewer.scene.primitives.remove(m) } catch {} }
  tunnelModels = []
}

export function setTunnelVisible(viewer: Cesium.Viewer, show: boolean) {
  for (const m of tunnelModels) m.show = show
  viewer.scene.requestRender()
}

export function setTunnelTranslucent(viewer: Cesium.Viewer, on: boolean) {
  for (const m of tunnelModels) {
    m.color = on
      ? Cesium.Color.fromCssColorString('#cfd8e3').withAlpha(0.30)
      : Cesium.Color.WHITE
    m.colorBlendMode = on ? Cesium.ColorBlendMode.REPLACE : Cesium.ColorBlendMode.HIGHLIGHT
  }
  viewer.scene.requestRender()
}
