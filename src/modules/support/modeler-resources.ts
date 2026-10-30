import * as Cesium from 'cesium'
import type { SceneResource } from '@/platform/resources/types'
import { chainageService } from '@/platform/coordinates/ChainageService'

const outputRoot = '/support-modeler/outputs'
const sectionTypes = [
  'ZZ-II', 'ZZ-III', 'ZZ-IIIx', 'ZZ-IVa', 'ZZ-IVb', 'ZZ-IVc',
  'ZZ-IVsx', 'ZZ-IVx', 'ZZ-QJsx', 'ZZ-S', 'ZZ-Vsx', 'ZZ-Y1', 'ZZ-Va',
] as const

export const modelerSupportCatalog = sectionTypes.map(type => ({
  type,
  id: `support.modeler-${type.toLowerCase()}`,
  path: type === 'ZZ-Va'
    ? `${outputRoot}/master_demo/ZZ-Va_support_1m_current.glb`
    : `${outputRoot}/multi_support/${type}_support_1m.glb`,
}))
const activeModels = new Map<string, Cesium.Model>()
export const getActiveModelerSupportModel = (id: string): Cesium.Model | undefined => activeModels.get(id)

/** The delivered 1 m templates use x=right, y=up, z=forward and a crown-circle origin. */
export function modelerSectionFrame(chainage: number): Cesium.Matrix4 {
  const anchor = chainageService.worldPositionAt(chainage)
  const station = chainageService.positionWithHeadingAt(chainage)
  if (!anchor || !station) throw new Error(`支护目标里程不在平台 YK 中线范围内：${chainage}`)
  const enu = Cesium.Transforms.eastNorthUpToFixedFrame(anchor)
  const east = Cesium.Matrix4.multiplyByPointAsVector(enu, Cesium.Cartesian3.UNIT_X, new Cesium.Cartesian3())
  const north = Cesium.Matrix4.multiplyByPointAsVector(enu, Cesium.Cartesian3.UNIT_Y, new Cesium.Cartesian3())
  const up = Cesium.Matrix4.multiplyByPointAsVector(enu, Cesium.Cartesian3.UNIT_Z, new Cesium.Cartesian3())
  const forward = Cesium.Cartesian3.add(
    Cesium.Cartesian3.multiplyByScalar(east, Math.sin(station.heading), new Cesium.Cartesian3()),
    Cesium.Cartesian3.multiplyByScalar(north, Math.cos(station.heading), new Cesium.Cartesian3()),
    new Cesium.Cartesian3(),
  )
  const right = Cesium.Cartesian3.cross(up, forward, new Cesium.Cartesian3())
  const rotation = Cesium.Matrix3.fromColumnMajorArray([
    right.x, right.y, right.z, up.x, up.y, up.z, forward.x, forward.y, forward.z,
  ])
  // Source section design-elevation point is (0, -2.1, 0).
  const translation = Cesium.Cartesian3.add(anchor,
    Cesium.Cartesian3.multiplyByScalar(up, 2.1, new Cesium.Cartesian3()), new Cesium.Cartesian3())
  return Cesium.Matrix4.fromRotationTranslation(rotation, translation)
}

export const modelerSupportResources: SceneResource[] = modelerSupportCatalog.map(asset => {
  let viewer: Cesium.Viewer | undefined
  let model: Cesium.Model | undefined
  let placedChainage = 1116
  const place = (chainage: number) => {
    if (!model || !viewer) return
    model.modelMatrix = modelerSectionFrame(chainage)
    placedChainage = chainage
    viewer.scene.requestRender()
  }
  return {
    id: asset.id, module: 'support', type: 'modeler-section',
    chainageRange: { start: 1116, end: 2180 },
    processes: ['support-design'], states: ['exported-section'],
    lifetime: 'task', estimatedMemoryMb: 8,
    async load(context) {
      viewer = context.viewer
      try {
        model = await Cesium.Model.fromGltfAsync({ url: asset.path,
          modelMatrix: modelerSectionFrame(context.task?.chainageRange.start ?? 1116) })
        if (context.signal?.aborted) throw new DOMException('支护模型加载已取消', 'AbortError')
        viewer.scene.primitives.add(model)
        activeModels.set(asset.id, model)
        placedChainage = context.task?.chainageRange.start ?? 1116
      } catch (error) { model = undefined; viewer = undefined; throw error }
    },
    async activate(task) { place(task.chainageRange.start) },
    async update(task) { place(task.chainageRange.start) },
    async unload() {
      if (viewer && model && !viewer.isDestroyed()) viewer.scene.primitives.remove(model)
      activeModels.delete(asset.id)
      model = undefined; viewer = undefined
    },
    getEnhanceTargets: () => model ? [{ id: asset.id, type: 'support-section', object: model,
      metadata: { supportType: asset.type, source: 'support-modeler-export',
        chainage: placedChainage, lengthM: 1, parameterizedEditor: true, generatedForTask: false } }] : [],
    getActiveAssetPaths: () => model ? [asset.path] : [],
  }
})
