import * as C from 'cesium'
import * as T from 'three'
import type { SceneResource } from '@/platform/resources/types'
import { loadOriginalSupportUnits, trackModelerSupportModel, trackSupportUnits } from './modeler-resources'
import { continuousSupportCatalog, planContinuousSupport } from './continuous-layout'
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
export const continuousSupportResources: SceneResource[] = continuousSupportCatalog.map(item => {
  let models: C.Model[] = [], viewer: C.Viewer | undefined, start: number | undefined
  return {
    id: item.id, module: 'support', type: 'continuous-support-demonstration', processes: ['support-design'], states: ['demonstration-assembly'],
    dependencies: ['common.tunnel'], lifetime: 'task',
    chainageRange: { start: 1116, end: 9400 - item.length }, estimatedMemoryMb: item.length * 12,
    async load(context) {
      const at = context.task?.chainageRange.start
      if (at === undefined) throw new Error('连续支护必须明确起点')
      const plan = planContinuousSupport(at, item.length)
      models = await loadOriginalSupportUnits(context.viewer, plan.units.map(chainage => ({chainage, supportType:'ZZ-Va'})), context.signal)
      viewer = context.viewer; start = at
      trackSupportUnits(item.id, models)
      trackModelerSupportModel(item.id, models[0])
    },
    async unload() {
      if (viewer && !viewer.isDestroyed()) for (const model of models) viewer.scene.primitives.remove(model)
      trackSupportUnits(item.id)
      trackModelerSupportModel(item.id)
      models = []; viewer = undefined; start = undefined
    },
    getActiveAssetPaths: () => models.length ? [path] : [],
    getEnhanceTargets: () => models.map((object,index) => ({id: item.id+'.'+index, type:'support-segment', object, metadata:{
      supportType:'ZZ-Va', startChainage:start, endChainage:start!+item.length, lengthM:item.length,
      sectionCount:models.length, sourceUnitLengthM:1, originalGeometry:true, placement:'rigid-original-units', source:path,
    }})),
  }
})
