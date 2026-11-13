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
import { viewerService } from '@/platform/viewer/ViewerService'
import { ref } from 'vue'
import {supportComponentLabel} from './component-labels'
import {supportLongitudinalRows} from './longitudinal-layout'
export const supportLayerRevision=ref(0)
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
export function getTaskSupportLayers(ids: readonly string[]) {
  return getTestSectionSupportSummaries(ids).flatMap(summary => {
    const models=activeModels.get(summary.id)
    if(!summary.groups?.length||!models?.length||models.some(model=>!model.ready))return []
    const components=[...new Set<string>((summary.groups as Array<{component:string}>).map(group=>group.component))]
    return components.map(component=>{
      const groups=summary.groups.filter((group:any)=>group.component===component)
      return {resourceId:summary.id,component,visible:models.every(model=>groups.every((group:any)=>model.getNode(group.name)?.show===true))}
    })
  })
}
export function getCurrentSupportReport(ids:readonly string[]){
 const summaries=getTestSectionSupportSummaries(ids)
 if(!summaries.length)throw Error('当前任务没有已装配的测试支护模型')
 const layers=getTaskSupportLayers(ids)
 return summaries.map(summary=>{
  const models=activeModels.get(summary.id)
  if(!models?.length||models.some(model=>!model.ready))throw Error('当前支护尚未就绪或已释放')
  return {resourceId:summary.id,type:summary.supportType,lengthM:summary.lengthM,layout:summary.layout,note:summary.note,
   longitudinalLayout:{scope:'assembly-base-stations-not-surveyed',rows:supportLongitudinalRows([summary]),note:'offsetsM为相对测试源断面的装配基准，不等同构件中心或实测里程；单元基准不能推断配筋间距。'},
   sources:[...(testSectionSupportResources.find(resource=>resource.id===summary.id)?.getActiveAssetPaths?.()??[])],
   components:layers.filter(layer=>layer.resourceId===summary.id).map(layer=>{
    const groups=summary.groups.filter((group:any)=>group.component===layer.component)
    return {component:layer.component,label:supportComponentLabel(layer.component),visible:layer.visible,
     spacingM:[...new Set<number>(groups.map((g:any)=>g.spacingM).filter((value:any)=>Number.isFinite(value)))],stations:groups.every((g:any)=>Number.isFinite(g.stations))?Math.max(...groups.map((g:any)=>g.stations)):null}
   })}
 })
}
export function setTaskSupportLayer(id:string,component:string,visible:boolean|'default') {
  const summary=activeSummaries.get(id),models=activeModels.get(id)
  if(!summary?.groups?.length||!models?.length||models.some(model=>!model.ready))throw new Error('当前支护构件未就绪或已释放')
  const groups=summary.groups.filter((group:any)=>group.component===component)
  const nodes=models.flatMap(model=>groups.map((group:any)=>model.getNode(group.name)))
  if(!groups.length||nodes.some((node:any)=>!node))throw new Error('当前模型没有该支护构件')
  nodes.forEach((node:any,index:number)=>{node.show=visible==='default'?groups[index%groups.length].visible:visible})
  supportLayerRevision.value++
  viewerService.current?.scene.requestRender()
}
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
        summary={supportType:asset.type,lengthM:offsets.length,layout:'1064m-component-example',sourceSegment:example.sourceSegment,groups:example.groups,sourceStatus:example.sourceStatus,geometryTreatment:example.geometryTreatment}
      }else{
      for (const offset of offsets) {
        if (context.signal?.aborted) throw new DOMException('支护加载取消', 'AbortError')
        const loaded = await C.Model.fromGltfAsync({ url: asset.path,
          modelMatrix: C.Matrix4.multiply(frame, existingSupportPlacement(offset, asset.designElevationY), new C.Matrix4()), upAxis: C.Axis.Z, forwardAxis: C.Axis.X })
        if (context.signal?.aborted) { loaded.destroy(); throw new DOMException('支护加载取消', 'AbortError') }
        context.viewer.scene.primitives.add(loaded); models.push(loaded); activeModels.set(asset.id, models); context.viewer.scene.requestRender()
      }
      paths=[asset.path]
      summary={supportType:asset.type,lengthM:offsets.length,layout:'original-unit-fallback',unitOffsetsM:[...offsets],note:'1064米示例该类型为空范围，使用已有独立模型，未冒称示例布置'}
      }
      const started = performance.now()
      while (!models.every(model => model.ready)) {
        if (context.signal?.aborted) throw new DOMException('支护加载取消', 'AbortError')
        if (performance.now()-started>30000) throw new Error('已有支护模型首帧就绪超时')
        context.viewer.scene.requestRender()
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      }
      if(example)for(const group of example.groups){const node=models[0].getNode(group.name);if(node)node.show=group.visible}
      if(!example&&asset.type==='Z-PM'){
        // Existing source groups only: no replacement geometry or inferred spacing.
        summary.groups=[{component:'secondary_lining',name:'ZPMSecondaryLiningConcrete',visible:true},
          ...Array.from({length:7},(_,i)=>({component:`secondary_rebar_N${i+1}`,name:`N${i+1}Group`,visible:true}))]
        if(models.some(model=>summary.groups.some((group:any)=>!model.getNode(group.name))))throw new Error('Z-PM原模型缺少预期构件节点')
        summary.note+='；仅二衬和N1～N7已有分组可控制，配筋为PARTIAL，适用性仍待确认；构件间距未核验'
      }
      activeSummaries.set(asset.id,summary)
    } catch (error) { await resource.unload(); throw error }
  },
  async unload() { if (viewer && !viewer.isDestroyed()) for (const model of models) viewer.scene.primitives.remove(model); activeModels.delete(asset.id);activeSummaries.delete(asset.id); models = []; viewer = undefined;paths=[];versions=[];summary=undefined },
  getActiveAssetPaths: () => models.length ? paths : [],
  getActiveDataVersions:()=>versions,
  getEnhanceTargets: () => models.map((model,index) => ({ id: `${asset.id}.${index}`, type: 'support-segment', object: model,
    metadata: { ...summary, source: paths, supportType: asset.type, originalGeometry: summary?.layout!=='1064m-component-example', generatedGeometry: summary?.layout==='1064m-component-example', sourceGeometryReused:true,
      componentScope: asset.type === 'Z-PM' ? 'secondary-lining-and-N1-N7-only' : 'source-model-components', designElevationY: asset.designElevationY,
      unitCount: summary?.layout==='original-unit-fallback'?offsets.length:undefined, unitLengthM: summary?.layout==='original-unit-fallback'?1:undefined, nominalLengthM: offsets.length, offsetM: offsets[index],
      placement: summary?.layout==='1064m-component-example'?'reference-components-centerline-normal':'rigid-template-centerline-normal', note: summary?.layout==='1064m-component-example'?'复用1064米示例已有构件轮廓、各自间距与默认显隐；混凝土端断面沿目标中线连接并去除内部端盖，其余构件刚性装配。源轮廓与测试隧道尺寸有差异，工程贴合与设计适用性仍需核查。':'1064米示例没有该类型实例，保留已有独立模型的1米单元布置；曲线接缝与现场布置仍需校核。' } })),
}
 return resource
})
export const testSectionSupportResource = testSectionSupportResources.find(resource => resource.id === TEST_SUPPORT_ID)!

/** Locator coordinates use the exact placement matrices of the active models.
 * They identify assembly base stations, not measured component centers. */
export function testSupportStationWorld(id:string,offsetM:number):C.Cartesian3 {
  const summary=activeSummaries.get(id),models=activeModels.get(id)
  if(!summary||!models?.length||models.some(m=>!m.ready))throw Error('当前支护站位模型尚未就绪或已释放')
  if(summary.layout==='1064m-component-example'){
    if(!summary.groups.some((g:any)=>g.stationOffsetsM?.some((s:number)=>Math.abs(s-offsetM)<1e-8)))throw Error('站位不在当前装配记录中')
    const matrix=C.Matrix4.multiply(models[0].modelMatrix,existingSupportPlacement(offsetM,0),new C.Matrix4())
    return C.Matrix4.multiplyByPoint(matrix,new C.Cartesian3(0,3,0),new C.Cartesian3())
  }
  const index=summary.unitOffsetsM?.findIndex((s:number)=>Math.abs(s-offsetM)<1e-8)??-1
  if(index<0||!models[index])throw Error('单元站位不在当前装配记录中')
  return C.Matrix4.multiplyByPoint(models[index].modelMatrix,new C.Cartesian3(0,3,0),new C.Cartesian3())
}
