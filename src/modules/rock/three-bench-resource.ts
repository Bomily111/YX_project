import * as C from 'cesium'
import type { SceneResource } from '@/platform/resources/types'
import { getTunnelSegmentBaseMatrix } from '@/utils/Common/DrawLine'
import { chainageService } from '@/platform/coordinates/ChainageService'
import { demoReanchorTransform } from '@/platform/coordinates/DemoReanchor'
import metadata from './three-bench.metadata.json'

export const THREE_BENCH_ID = 'rock.three-bench'
export const THREE_BENCH_PATH = '/data/tunnel/三台阶.glb'
export const THREE_BENCH_SOURCE_CHAINAGE = 2244
export const threeBenchDescription = '三台阶源断面来自tunnel002，源锚点YK2+244，可沿目标中线示意装配。台阶高度与错距为示意参数；后方支护仍以同一装配基准放置，不随台阶前缘移动。'
export function validateThreeBenchChainage(chainage: number, backM = 0, aheadM = metadata.end) {
  if (![chainage - backM, chainage, chainage + aheadM].every(value => chainageService.contains(value))) {
    throw new Error('工段示意范围超出 YK 中线，请调整目标里程或装配长度')
  }
}
export function threeBenchMatrix(tunnelMatrix: C.Matrix4, chainage = THREE_BENCH_SOURCE_CHAINAGE): C.Matrix4 {
  // Match Cesium's default glTF Y-up/Z-forward correction using public matrices.
  const correction = C.Matrix4.fromRotationTranslation(C.Matrix3.multiply(C.Matrix3.fromRotationX(Math.PI / 2), C.Matrix3.fromRotationY(Math.PI / 2), new C.Matrix3()))
  const mapping = C.Matrix4.fromRotationTranslation(C.Matrix3.fromRotationY(-Math.PI / 2), new C.Cartesian3(...metadata.sourceGltfOrigin))
  const source = C.Matrix4.multiply(C.Matrix4.multiply(tunnelMatrix, correction, new C.Matrix4()), mapping, new C.Matrix4())
  return chainage === THREE_BENCH_SOURCE_CHAINAGE ? source : C.Matrix4.multiply(demoReanchorTransform(THREE_BENCH_SOURCE_CHAINAGE, chainage), source, new C.Matrix4())
}
// tunnel002 has zero additional rotation. Its configured source frame does not require the source GLB to be in view.
export const threeBenchTaskFrame = (chainage: number) => threeBenchMatrix(getTunnelSegmentBaseMatrix(2), chainage)
export const isThreeBenchResourceId = (id: string) => id === THREE_BENCH_ID
const activeModels = new Map<string, C.Model>()
export const getActiveThreeBenchModel = () => activeModels.values().next().value
function createThreeBenchResource(id: string, path: string, displayName: string, sourceMetadata: typeof metadata): SceneResource {
let model: C.Model | undefined, viewer: C.Viewer | undefined, targetChainage: number
return {
  id, module: 'rock', type: 'three-bench-excavation',
  chainageRange: { start: THREE_BENCH_SOURCE_CHAINAGE, end: THREE_BENCH_SOURCE_CHAINAGE }, processes: ['excavation'], states: ['demonstration'],
  dependencies: ['common.tunnel'], lifetime: 'task', estimatedMemoryMb: 12,
  async load(context) {
    const chainage = context.task?.chainageRange.start ?? NaN
    validateThreeBenchChainage(chainage)
    if (context.signal?.aborted) throw new DOMException('三台阶加载取消', 'AbortError')
    const loaded = await C.Model.fromGltfAsync({ url: path, modelMatrix: threeBenchTaskFrame(chainage), upAxis: C.Axis.Z, forwardAxis: C.Axis.X })
    if (context.signal?.aborted) { loaded.destroy(); throw new DOMException('三台阶加载取消', 'AbortError') }
    context.viewer.scene.primitives.add(loaded); model = loaded; activeModels.set(id, loaded); viewer = context.viewer; targetChainage = chainage
    viewer.scene.requestRender()
  },
  async unload() { if (model && viewer && !viewer.isDestroyed()) viewer.scene.primitives.remove(model); activeModels.delete(id); model = undefined; viewer = undefined },
  getActiveAssetPaths: () => model ? [path] : [],
  getEnhanceTargets: () => model ? [{ id, type: 'excavation-solid', object: model, metadata: { ...sourceMetadata, displayName, sourceReferenceChainage: THREE_BENCH_SOURCE_CHAINAGE, taskReferenceChainage: targetChainage, placement: targetChainage === THREE_BENCH_SOURCE_CHAINAGE ? 'fixed-source-demonstration' : 'reanchored-demonstration' } }] : [],
}

}
export const threeBenchResource = createThreeBenchResource(THREE_BENCH_ID, THREE_BENCH_PATH, '三台阶', metadata)
