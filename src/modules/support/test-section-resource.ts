import * as C from 'cesium'
import type { SceneResource } from '@/platform/resources/types'
import { waitForTunnelGlbSegment } from '@/utils/Common/DrawLine'
import { threeBenchMatrix, validateThreeBenchChainage } from '@/modules/rock/three-bench-resource'
import profile from '@/modules/face-sketch/tunnel-normal-sections.json'
import origin from '@/modules/rock/three-bench.metadata.json'
import { modelerSupportCatalog } from './modeler-resources'
import { supportOffsets } from './test-section-layout'
import * as T from 'three'
import { buildExampleSupport, examplePaths } from './example-layout'
import { fingerprintGeneratedAsset } from '@/platform/telemetry/GeneratedAssetVersions'
import type { DataVersion } from '@/platform/telemetry/TaskDataProvenance'
export const TEST_SUPPORT_ID = 'support.test-section'
export const TEST_SUPPORT_PATH = '/support-modeler/outputs/master_demo/ZZ-Va_support_1m_current.glb'
export const existingSupportOffsets = supportOffsets()
export const testSupportCatalog = modelerSupportCatalog.map(asset => ({ ...asset,
  id: asset.type === 'ZZ-Va' ? TEST_SUPPORT_ID : `support.test-section-${asset.type.toLowerCase()}` }))
export const isTestSupportId = (id: string) => testSupportCatalog.some(asset => asset.id === id)
const activeModels = new Map<string, C.Model[]>()
const activeSummaries = new Map<string, any>()
export const getTestSectionSupportSummaries = (ids?:readonly string[]) => [...activeSummaries].filter(([id])=>!ids||ids.includes(id)).map(([id,value])=>({id,...value}))
export const getTestSectionSupportModels = (ids?: readonly string[]) => [...activeModels].filter(([id]) => !ids || ids.includes(id)).flatMap(([, models]) => models)
export const getTestSectionSupport = () => getTestSectionSupportModels()[0]
export function validateTestSupportRequest(ids: readonly string[], request: string) {
  const selected = testSupportCatalog.filter(asset => ids.includes(asset.id))
  if (!selected.length) return
  if (selected.length > 1) throw new Error('当前测试工段一次只装配一种后方支护类型')
  const types = [...request.matchAll(/\b(?:Z-PM|ZZ-(?:QJsx|IIIx|IVsx|Vsx|IVa|IVb|IVc|IVx|III|II|Y1|Va|S))(?![A-Za-z0-9])/gi)].map(match => match[0].toLowerCase())
  if (!types.length) throw new Error(`请明确支护类型，不能默认选择ZZ-Va；可从已有${testSupportCatalog.length}种模型中选择`)
  if (new Set(types).size !== 1 || types[0] !== selected[0].type.toLowerCase()) throw new Error('所选支护类型与用户要求不一致，请明确本次展示的支护类型')
}
export function existingSupportPlacement(offset: number, designElevationY = -2.1): C.Matrix4 {
  const sorted=profile.supportSections
  let hi=sorted.findIndex(station=>station.distanceM>=offset)
  if(hi<0)hi=sorted.length-1
  else if(hi===0)hi=1
  if(offset>-.5||offset< -20.5)throw new Error('支护位置超出已提取的中线法向断面')
  if(hi>=sorted.length)hi=sorted.length-1
  const a=sorted[hi-1],b=sorted[hi],ratio=(offset-a.distanceM)/(b.distanceM-a.distanceM)
  const mix=(x:number[],y:number[])=>x.map((value,i)=>value+(y[i]-value)*ratio)
  const f=C.Cartesian3.normalize(C.Cartesian3.fromArray(mix(a.frame.forward,b.frame.forward)),new C.Cartesian3())
  const r=C.Cartesian3.normalize(C.Cartesian3.cross(f,C.Cartesian3.UNIT_Y,new C.Cartesian3()),new C.Cartesian3())
  const u=C.Cartesian3.normalize(C.Cartesian3.cross(r,f,new C.Cartesian3()),new C.Cartesian3())
  const station={frame:{center:mix(a.frame.center,b.frame.center),forward:[f.x,f.y,f.z],lateral:[r.x,r.y,r.z],up:[u.x,u.y,u.z]},outline:[[0,Math.min(...a.outline.map(p=>p[1]))*(1-ratio)+Math.min(...b.outline.map(p=>p[1]))*ratio]]}
  const { center, lateral, up, forward } = station.frame
  const floor = Math.min(...station.outline.map(p=>p[1]))
  const point = center.map((value,i)=>value+up[i]*(floor-designElevationY))
  // Source -> asset basis: (x,y,z) -> (z,y,-x). Template +Z is advance.
  const rotation = C.Matrix3.fromColumnMajorArray([
    -lateral[2],-lateral[1],lateral[0], up[2],up[1],-up[0], forward[2],forward[1],-forward[0],
  ])
  return C.Matrix4.fromRotationTranslation(rotation,new C.Cartesian3(point[2]-origin.sourceGltfOrigin[2],point[1]-origin.sourceGltfOrigin[1],-(point[0]-origin.sourceGltfOrigin[0])))
}
export const testSectionSupportResources: SceneResource[] = testSupportCatalog.map(asset => {
 let models: C.Model[] = [], viewer: C.Viewer | undefined, offsets = supportOffsets(), paths:string[]=[], versions:DataVersion[]=[],summary:any
 const resource: SceneResource = {
  id: asset.id, module: 'support', type: 'existing-support-template-array',
  chainageRange: { start: 2244, end: 2244 }, dependencies: ['common.tunnel'],
  processes: ['support-design'], states: ['demonstration'], lifetime: 'task', estimatedMemoryMb: 200,
  async load(context) {
    validateThreeBenchChainage(context.task?.chainageRange.start ?? NaN)
    offsets = supportOffsets(context.task?.supportLengthM ?? 10)
    const tunnel = await waitForTunnelGlbSegment(2, context.viewer)
    const frame = threeBenchMatrix(tunnel.modelMatrix)
    viewer = context.viewer
    try {
      const example=await buildExampleSupport(asset.type,offsets.length,distance=>new T.Matrix4().fromArray(C.Matrix4.toArray(existingSupportPlacement(distance,0),[])))
      if(context.signal?.aborted)throw new DOMException('支护加载取消','AbortError')
      if(example){
        versions=await fingerprintGeneratedAsset(asset.id,example.buffer,{type:asset.type,lengthM:offsets.length,source:examplePaths[0],groups:example.groups})
        const url=URL.createObjectURL(new Blob([example.buffer],{type:'model/gltf-binary'}))
        try{
          const loaded=await C.Model.fromGltfAsync({url,modelMatrix:frame,upAxis:C.Axis.Z,forwardAxis:C.Axis.X})
          if(context.signal?.aborted){loaded.destroy();throw new DOMException('支护加载取消','AbortError')}
          context.viewer.scene.primitives.add(loaded);models.push(loaded);activeModels.set(asset.id,models)
        }finally{URL.revokeObjectURL(url)}
        paths=[...examplePaths]
        summary={supportType:asset.type,lengthM:offsets.length,layout:'1064m-component-example',sourceSegment:example.sourceSegment,groups:example.groups,sourceStatus:example.sourceStatus}
      }else{
      for (const offset of offsets) {
        if (context.signal?.aborted) throw new DOMException('支护加载取消', 'AbortError')
        const loaded = await C.Model.fromGltfAsync({ url: asset.path,
          modelMatrix: C.Matrix4.multiply(frame, existingSupportPlacement(offset, asset.designElevationY), new C.Matrix4()), upAxis: C.Axis.Z, forwardAxis: C.Axis.X })
        if (context.signal?.aborted) { loaded.destroy(); throw new DOMException('支护加载取消', 'AbortError') }
        context.viewer.scene.primitives.add(loaded); models.push(loaded); activeModels.set(asset.id, models); context.viewer.scene.requestRender()
      }
      paths=[asset.path]
      summary={supportType:asset.type,lengthM:offsets.length,layout:'original-unit-fallback',note:'1064米示例该类型为空范围，使用已有独立模型，未冒称示例布置'}
      }
      const started = performance.now()
      while (!models.every(model => model.ready)) {
        if (context.signal?.aborted) throw new DOMException('支护加载取消', 'AbortError')
        if (performance.now()-started>30000) throw new Error('已有支护模型首帧就绪超时')
        context.viewer.scene.requestRender()
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      }
      if(example)for(const group of example.groups){const node=models[0].getNode(group.name);if(node)node.show=group.visible}
      activeSummaries.set(asset.id,summary)
    } catch (error) { await resource.unload(); throw error }
  },
  async unload() { if (viewer && !viewer.isDestroyed()) for (const model of models) viewer.scene.primitives.remove(model); activeModels.delete(asset.id);activeSummaries.delete(asset.id); models = []; viewer = undefined;paths=[];versions=[];summary=undefined },
  getActiveAssetPaths: () => models.length ? paths : [],
  getActiveDataVersions:()=>versions,
  getEnhanceTargets: () => models.map((model,index) => ({ id: `${asset.id}.${index}`, type: 'support-segment', object: model,
    metadata: { ...summary, source: paths, supportType: asset.type, originalGeometry: true, generatedGeometry: false,
      componentScope: asset.type === 'Z-PM' ? 'secondary-lining-and-N1-N7-only' : 'source-model-components', designElevationY: asset.designElevationY,
      unitCount: summary?.layout==='original-unit-fallback'?offsets.length:undefined, unitLengthM: summary?.layout==='original-unit-fallback'?1:undefined, nominalLengthM: offsets.length, offsetM: offsets[index],
      placement: summary?.layout==='1064m-component-example'?'reference-components-centerline-normal':'rigid-template-centerline-normal', note: summary?.layout==='1064m-component-example'?'复用1064米示例的已有构件、各自间距与默认显隐，沿测试工段中线法向装配；保持原构件几何，现场设计适用性仍需校核。':'1064米示例没有该类型实例，保留已有独立模型的1米单元布置；曲线接缝与现场布置仍需校核。' } })),
}
 return resource
})
export const testSectionSupportResource = testSectionSupportResources.find(resource => resource.id === TEST_SUPPORT_ID)!
