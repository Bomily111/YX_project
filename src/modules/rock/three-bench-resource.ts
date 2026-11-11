import * as C from 'cesium'
import type { SceneResource } from '@/platform/resources/types'
import { waitForTunnelGlbSegment } from '@/utils/Common/DrawLine'
import metadata from './three-bench.metadata.json'

export const THREE_BENCH_ID = 'rock.three-bench'
export const THREE_BENCH_PATH = '/data/tunnel/三台阶.glb'
export const threeBenchDescription = '三台阶：按tunnel002局部中线法向断面建模；仅在YK2+244测试工段示意展示，不代表目标实测。支护原模型沿同一中线基准定位，台阶高度与错距为示意参数。'
export function validateThreeBenchChainage(chainage: number) {
  if (chainage !== 2244) throw new Error('三台阶目前仅支持YK2+244固定源工段示意展示，其他工段尚未建立断面对应')
}
export function threeBenchMatrix(tunnelMatrix: C.Matrix4): C.Matrix4 {
  // Match Cesium's default glTF Y-up/Z-forward correction using public matrices.
  const correction = C.Matrix4.fromRotationTranslation(C.Matrix3.multiply(C.Matrix3.fromRotationX(Math.PI / 2), C.Matrix3.fromRotationY(Math.PI / 2), new C.Matrix3()))
  const mapping = C.Matrix4.fromRotationTranslation(C.Matrix3.fromRotationY(-Math.PI / 2), new C.Cartesian3(...metadata.sourceGltfOrigin))
  return C.Matrix4.multiply(C.Matrix4.multiply(tunnelMatrix, correction, new C.Matrix4()), mapping, new C.Matrix4())
}
let model: C.Model | undefined, viewer: C.Viewer | undefined
export const getActiveThreeBenchModel = () => model
export const threeBenchResource: SceneResource = {
  id: THREE_BENCH_ID, module: 'rock', type: 'three-bench-excavation',
  chainageRange: { start: 2244, end: 2244 }, processes: ['excavation'], states: ['demonstration'],
  dependencies: ['common.tunnel'], lifetime: 'task', estimatedMemoryMb: 12,
  async load(context) {
    validateThreeBenchChainage(context.task?.chainageRange.start ?? NaN)
    const tunnel = await waitForTunnelGlbSegment(2, context.viewer)
    if (context.signal?.aborted) throw new DOMException('三台阶加载取消', 'AbortError')
    const loaded = await C.Model.fromGltfAsync({ url: THREE_BENCH_PATH, modelMatrix: threeBenchMatrix(tunnel.modelMatrix), upAxis: C.Axis.Z, forwardAxis: C.Axis.X })
    if (context.signal?.aborted) { loaded.destroy(); throw new DOMException('三台阶加载取消', 'AbortError') }
    context.viewer.scene.primitives.add(loaded); model = loaded; viewer = context.viewer
    viewer.scene.requestRender()
  },
  async unload() { if (model && viewer && !viewer.isDestroyed()) viewer.scene.primitives.remove(model); model = undefined; viewer = undefined },
  getActiveAssetPaths: () => model ? [THREE_BENCH_PATH] : [],
  getEnhanceTargets: () => model ? [{ id: THREE_BENCH_ID, type: 'excavation-solid', object: model, metadata: { ...metadata, displayName: '三台阶', taskReferenceChainage: 2244, placement: 'fixed-source-demonstration' } }] : [],
}
