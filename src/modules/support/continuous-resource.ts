import * as C from 'cesium'
import * as T from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import type { SceneResource } from '@/platform/resources/types'
import { preparedMeshes } from './alternating-resource'
import { modelerSectionFrame, trackModelerSupportModel } from './modeler-resources'
import { continuousSupportCatalog, planContinuousSupport } from './continuous-layout'
import { fitSupportUnit } from './continuous-geometry'
const path = '/support-modeler/outputs/master_demo/ZZ-Va_support_1m_current.glb'
export function partitionSectionCaps(geometry: T.BufferGeometry) {
  const indices = geometry.index!, positions = geometry.getAttribute('position')
  const buckets: number[][] = [[], [], []]
  for (let i = 0; i < indices.count; i += 3) {
    const triangle = [indices.getX(i), indices.getX(i + 1), indices.getX(i + 2)]
    const z = triangle.map(index => positions.getZ(index))
    const bucket = z.every(value => Math.abs(value) < 1e-5) ? 1 : z.every(value => Math.abs(value - 1) < 1e-5) ? 2 : 0
    buckets[bucket].push(...triangle)
  }
  return buckets
}
async function build(start: number, length: number) {
  const plan = planContinuousSupport(start, length)
  const source = await new GLTFLoader().loadAsync(path)
  const root = new T.Group()
  const inverse = C.Matrix4.inverseTransformation(modelerSectionFrame(start), new C.Matrix4())
  const transforms = [...plan.units, plan.end].map(at => new T.Matrix4().fromArray(C.Matrix4.toArray(C.Matrix4.multiply(inverse, modelerSectionFrame(at), new C.Matrix4()), [])))
  for (const mesh of preparedMeshes(source.scene, 'ZZ-Va')) {
    const geometry = mesh.geometry, buckets = partitionSectionCaps(geometry)
    buckets.forEach((faces, kind) => {
      if (!faces.length) return
      const part = geometry.clone(); part.setIndex(faces)
      const units = kind === 1 ? [0] : kind === 2 ? [length - 1] : plan.units.map((_, index) => index)
      for (const index of units) {
        const fitted = new T.Mesh(fitSupportUnit(part, transforms[index], transforms[index + 1]), mesh.material)
        fitted.name = `${mesh.name}-${['body','start-cap','end-cap'][kind]}-${index}`
        root.add(fitted)
      }
      part.dispose()
    })
  }
  return await new GLTFExporter().parseAsync(root, { binary: true }) as ArrayBuffer
}
export const continuousSupportResources: SceneResource[] = continuousSupportCatalog.map(item => {
  let model: C.Model | undefined, viewer: C.Viewer | undefined, start: number | undefined
  return {
    id: item.id, module: 'support', type: 'continuous-support-demonstration', processes: ['support-design'], states: ['demonstration-assembly'],
    dependencies: ['common.tunnel'],
    lifetime: 'task', chainageRange: { start: 1116, end: 9400 - item.length }, estimatedMemoryMb: item.length * 12,
    async load(context) {
      const at = context.task?.chainageRange.start
      if (at === undefined) throw new Error('连续支护必须明确起点')
      const buffer = await build(at, item.length)
      if (context.signal?.aborted) throw new DOMException('支护加载已取消', 'AbortError')
      const url = URL.createObjectURL(new Blob([buffer], { type: 'model/gltf-binary' }))
      try {
        const loaded = await C.Model.fromGltfAsync({ url, modelMatrix: modelerSectionFrame(at), upAxis: C.Axis.Z, forwardAxis: C.Axis.X })
        if (context.signal?.aborted) { loaded.destroy(); throw new DOMException('支护加载已取消', 'AbortError') }
        context.viewer.scene.primitives.add(loaded); model = loaded; viewer = context.viewer; start = at
        trackModelerSupportModel(item.id, model); viewer.scene.requestRender()
      } finally { URL.revokeObjectURL(url) }
    },
    async unload() { if (model && viewer && !viewer.isDestroyed()) viewer.scene.primitives.remove(model); trackModelerSupportModel(item.id); model = undefined; viewer = undefined; start = undefined },
    getActiveAssetPaths: () => model ? [path] : [],
    getEnhanceTargets: () => model ? [{ id: item.id, type: 'support-segment', object: model, metadata: { supportType: 'ZZ-Va', startChainage: start, endChainage: start! + item.length, lengthM: item.length, sectionCount: item.length, sourceUnitLengthM: 1, internalEndCapsRemoved: true, sharedBoundaryFitting: true, placement: 'demonstration', source: path } }] : [],
  }
})
