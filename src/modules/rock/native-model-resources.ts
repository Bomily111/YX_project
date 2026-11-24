import * as C from 'cesium'
import type { SceneResource } from '@/platform/resources/types'
import { demoReanchorTransform } from '@/platform/coordinates/DemoReanchor'
import { chainageService } from '@/platform/coordinates/ChainageService'

const reference = 2244
const origin = C.Cartesian3.fromDegrees(94.9056136, 29.5333802, 2945.51)
const frame = C.Transforms.headingPitchRollToFixedFrame(origin, new C.HeadingPitchRoll(1.7467, 0, 0))
export const WORKFACE_SURFACE_ID = 'rock.workface-surface'
export const WORKFACE_BACKING_ID = 'rock.workface-backing-preview'
export const isWorkfaceResource = (id: string) => id === WORKFACE_SURFACE_ID || id === WORKFACE_BACKING_ID
const surfaceTexture = '/data/workface-surface/texturedMesh.jpg'
// The legacy mesh has no survey tie or verified unit conversion. Uniform
// display scale approximates the reference section width for demonstration.
const surfaceDisplayScale = 0.18
function workfacePlacement(target: number): C.Matrix4 {
  const station = chainageService.positionWithHeadingAt(target)
  if (!station) throw new Error('三维岩面展示里程超出 YK 中线')
  const right = new C.Cartesian3(Math.cos(station.heading), -Math.sin(station.heading), 0)
  const back = new C.Cartesian3(-Math.sin(station.heading), -Math.cos(station.heading), 0)
  const rotation = C.Matrix3.fromColumnMajorArray([right.x, right.y, 0, 0, 0, 1, back.x, back.y, 0])
  const local = C.Matrix4.fromRotationTranslation(rotation)
  C.Matrix4.multiplyByUniformScale(local, surfaceDisplayScale, local)
  C.Matrix4.multiplyByTranslation(local, new C.Cartesian3(-4.64, 19.43, 42), local)
  const enu = C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(station.longitude, station.latitude, station.height))
  return C.Matrix4.multiply(enu, local, new C.Matrix4())
}
export const nativeRockCatalog = [
  { id: WORKFACE_SURFACE_ID, name: '三维掌子面与邻近岩壁 · 示意', path: '/data/workface-surface/texturedMesh.glb', yaw: 0 },
  { id: WORKFACE_BACKING_ID, name: '掌子面背后加厚 3 m · 示意', path: '/data/workface-surface/workface-backing-3m.glb', yaw: 0 },
  { id: 'rock.gpr-model', name: '三维地质雷达', path: '/data/gpr/gpr1/1665832_1.glb', yaw: -1.5708 },
  { id: 'rock.tem-anomaly-model', name: 'TEM 异常体 · 当前版本', path: '/data/tem_output/latest/anomaly_k570_4x.glb', yaw: 1.5708 },
  { id: 'rock.tem-anomaly-model-archive', name: 'TEM 异常体 · 历史版本', path: '/data/tem_output/1cf406b2-7f32-4b4d-a876-de7677149f3e/anomaly_k570_4x.glb', yaw: 1.5708 },
] as const
export const isNativeRockModel = (id: string) => nativeRockCatalog.some(item => item.id === id)

export const nativeRockResources: SceneResource[] = nativeRockCatalog.map(item => {
  let model: C.Model | undefined
  let viewer: C.Viewer | undefined
  let chainage = reference
  const source = C.Matrix4.multiply(frame, C.Matrix4.fromRotationTranslation(C.Matrix3.fromRotationY(item.yaw)), new C.Matrix4())
  const workface = isWorkfaceResource(item.id)
  const backing = item.id === WORKFACE_BACKING_ID
  const place = (target: number) => {
    chainage = target
    if (workface) return workfacePlacement(target)
    return target === reference ? C.Matrix4.clone(source) : C.Matrix4.multiply(demoReanchorTransform(reference, target), source, new C.Matrix4())
  }
  return {
    id: item.id, module: 'rock', type: 'native-geology-model', chainageRange: { start: 1116, end: 9400 },
    dependencies: backing ? ['common.tunnel', WORKFACE_SURFACE_ID] : ['common.tunnel'], lifetime: 'task', processes: ['prediction', 'inspection'], states: ['reference'],
    async load(context) {
      const modelMatrix = place(context.task?.chainageRange.start ?? reference)
      const incoming = await C.Model.fromGltfAsync({ url: item.path, modelMatrix,
        ...(workface ? { upAxis: C.Axis.Z, forwardAxis: C.Axis.X } : {}) })
      if (context.signal?.aborted || context.viewer.isDestroyed()) {
        incoming.destroy()
        throw new DOMException('原始围岩模型加载取消', 'AbortError')
      }
      viewer = context.viewer
      model = viewer.scene.primitives.add(incoming)
      viewer.scene.requestRender()
    },
    async update(task) {
      if (model) model.modelMatrix = place(task.chainageRange.start)
      viewer?.scene.requestRender()
    },
    async unload() {
      if (model && viewer && !viewer.isDestroyed()) viewer.scene.primitives.remove(model)
      model = undefined
      viewer = undefined
    },
    getActiveAssetPaths: () => model ? (item.id === WORKFACE_SURFACE_ID ? [item.path, surfaceTexture] : [item.path]) : [],
    getEnhanceTargets: () => model ? [{ id: item.id, type: 'native-geology-model', object: model,
      metadata: { displayName: item.name, originalGeometry: !backing, placement: 'demonstration', taskReferenceChainage: chainage,
        ...(workface ? { note: backing ? '沿原网格外缘生成背部和后盖，展示新增深度 3 米。' : '历史纹理网格，来源工点与比例标定未核验；按固定统一展示比例布置。', displayScale: surfaceDisplayScale, preserveSourceAppearance: !backing } : {}) } }] : [],
  }
})

export function nativeRockModels(ids: readonly string[]) {
  return nativeRockResources.filter(resource => ids.includes(resource.id) || resource.id === WORKFACE_SURFACE_ID && ids.includes(WORKFACE_BACKING_ID))
    .flatMap(resource => resource.getEnhanceTargets?.() ?? []).map(target => target.object as C.Model)
}
