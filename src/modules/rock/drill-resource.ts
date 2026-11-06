import * as Cesium from 'cesium'
import type { SceneResource } from '@/platform/resources/types'
import { chainageService } from '@/platform/coordinates/ChainageService'
import { setTunnelTranslucent } from '@/utils/Common/DrawLine'
export const drillAssets = ['/data/ahd/ahd1/2320835.glb', '/data/ahd/ahd2/2336197.glb']
// Display start fitted to the current assets' low-X end ring, not a surveyed collar.
export const DRILL_DISPLAY_START = new Cesium.Cartesian3(-14.887622761276534, 0, 1.8327220880760338)
export function drillPlacement(chainage: number, lateralOffset: number): Cesium.Matrix4 {
  const station = chainageService.positionWithHeadingAt(chainage)
  if (!station) throw new Error('水平钻目标不在YK中线范围内')
  const forward = new Cesium.Cartesian3(Math.sin(station.heading), Math.cos(station.heading), 0)
  const lateral = new Cesium.Cartesian3(-Math.cos(station.heading), Math.sin(station.heading), 0)
  const rotation = Cesium.Matrix3.fromColumnMajorArray([forward.x, forward.y, 0, lateral.x, lateral.y, 0, 0, 0, 1])
  const shift = Cesium.Cartesian3.negate(Cesium.Matrix3.multiplyByVector(rotation, DRILL_DISPLAY_START, new Cesium.Cartesian3()), new Cesium.Cartesian3())
  Cesium.Cartesian3.add(shift, Cesium.Cartesian3.multiplyByScalar(lateral, lateralOffset, new Cesium.Cartesian3()), shift)
  const enu = Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromDegrees(station.longitude, station.latitude, station.height + 3))
  return Cesium.Matrix4.multiply(enu, Cesium.Matrix4.fromRotationTranslation(rotation, shift), new Cesium.Matrix4())
}
let viewer: Cesium.Viewer | undefined
let models: Cesium.Model[] = []
export const getActiveDrillModels = () => [...models]
const place = (chainage: number) => {
  const matrices = [-1, 1].map(offset => drillPlacement(chainage, offset))
  models.forEach((model, i) => { model.modelMatrix = matrices[i]; model.show = true })
  viewer?.scene.requestRender()
}
export const advanceDrillResource: SceneResource = {
  id: 'rock.advance-drill', module: 'rock', type: 'advance-drill-example',
  chainageRange: { start: 1116, end: 9400 }, processes: ['prediction', 'inspection'], states: ['reference'], dependencies: ['common.tunnel'], lifetime: 'task',
  async load(context) {
    viewer = context.viewer
    try {
      for (const [i, url] of drillAssets.entries()) {
        const model = await Cesium.Model.fromGltfAsync({ url, modelMatrix: drillPlacement(context.task?.chainageRange.start ?? 2244, i ? 1 : -1), upAxis: Cesium.Axis.Z, forwardAxis: Cesium.Axis.X,
          customShader: new Cesium.CustomShader({ lightingModel: Cesium.LightingModel.UNLIT }) })
        model.color = i ? Cesium.Color.LIME : Cesium.Color.ORANGE
        model.colorBlendMode = Cesium.ColorBlendMode.REPLACE
        models.push(model); viewer.scene.primitives.add(model); viewer.scene.requestRender()
      }
    } catch (error) {
      for (const model of models) viewer.scene.primitives.remove(model)
      models = []; viewer = undefined; throw error
    }
  },
  async activate(task) {
    place(task.chainageRange.start)
    await Promise.all(models.map(model => model.ready ? Promise.resolve() : new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { remove(); reject(new Error('水平钻模型首帧就绪超时')) }, 15000)
      const remove = model.readyEvent.addEventListener(() => { clearTimeout(timer); remove(); resolve() })
      viewer?.scene.requestRender()
    })))
  },
  async update(task) { place(task.chainageRange.start) },
  async unload() {
    if (viewer && !viewer.isDestroyed()) {
      setTunnelTranslucent(false, viewer)
      for (const model of models) viewer.scene.primitives.remove(model)
    }
    models = []; viewer = undefined
  },
  getActiveAssetPaths: () => models.length === 2 ? drillAssets : [],
}
