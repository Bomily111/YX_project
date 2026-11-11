import * as T from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
export const examplePaths = [
  '/support-modeler/outputs/centerline/task-reference-1064.glb',
  '/support-modeler/outputs/centerline/task-reference-1064.capture.json',
  '/support-modeler/outputs/centerline/real_YK1+098_YK2+162_support.metadata.json',
  '/support-modeler/outputs/centerline/real_centerline_0_1064m.json',
]
let cached: Promise<{ scene:T.Group; segments:any[]; line:any }> | undefined
async function source() {
  if(!cached)cached=Promise.all([new GLTFLoader().loadAsync(examplePaths[0]),...examplePaths.slice(2).map(async path=>{const r=await fetch(path);if(!r.ok)throw new Error(`支护示例资料读取失败 ${path}`);return r.json()})]).then(([gltf,meta,line])=>({scene:gltf.scene,segments:meta.metadata.support_segments,line})).catch(error=>{cached=undefined;throw error})
  return cached
}
export function componentSpacing(component:string, spacing:any, parameters:any={}) {
  if(component==='lattice_arch')return Number(parameters.longitudinal_spacing_mm)/1000
  if(component==='advance_support')return Number(parameters.longitudinal_cycle_spacing_mm)/1000
  if(component==='steel_arch'||component==='lock_foot_anchor')return spacing.steel_arch_m
  if(component==='system_anchor')return spacing.system_anchor_m??spacing.steel_arch_m
  if(component==='secondary_rebar_N1'||component==='secondary_rebar_N2')return spacing.secondary_ring_m??1
  return 1
}
export function componentStations(length:number,spacing:number,connector=false) {
  if(!Number.isFinite(spacing)||spacing<=0)throw new Error('1064米示例缺少该构件的布置间距')
  const positions:number[]=[]
  for(let s=0;s<length-1e-8;s+=spacing)if(!connector||s+spacing<=length+1e-8)positions.push(s)
  return positions
}
export async function buildExampleSupport(type:string,length:number,pose:(distance:number)=>T.Matrix4) {
  const data=await source()
  const segment=data.segments.find(s=>s.support_type===type&&s.mesh_instance_count>0)
  if(!segment)return undefined
  const line=data.line
  const at=(distance:number)=>{let hi=line.chainage.findIndex((s:number)=>s>=distance);if(hi<0)return new T.Vector3(...line.points.at(-1));if(!hi)return new T.Vector3(...line.points[0]);return new T.Vector3(...line.points[hi-1]).lerp(new T.Vector3(...line.points[hi]),(distance-line.chainage[hi-1])/(line.chainage[hi]-line.chainage[hi-1]))}
  const start=segment.centerline_start_distance_m
  const forward=at(start+.5).sub(at(start-.5)).normalize(),up=new T.Vector3(0,1,0),right=new T.Vector3().crossVectors(up,forward).normalize()
  const inverse=new T.Matrix4().makeBasis(right,up,forward).setPosition(at(start)).invert()
  data.scene.updateMatrixWorld(true)
  const root=new T.Group(),groups:Array<{name:string;component:string;spacingM:number;stations:number;instances:number;visible:boolean}>=[]
  data.scene.traverse(object=>{
    if(!(object instanceof T.InstancedMesh)||object.userData.support_type!==type||object.userData.centerline_start_distance!==start)return
    const component=String(object.userData.component),spacing=componentSpacing(component,segment.spacing_m,object.userData.parameters)
    const stations=componentStations(length,spacing,object.userData.part==='connector')
    if(!stations.length)return
    const rows=component==='advance_support'?Number(object.userData.count_per_ring):1
    if(!rows||rows>object.count)throw new Error('1064米示例构件排数无效')
    const prototypes=Array.from({length:rows},(_,index)=>{const m=new T.Matrix4();object.getMatrixAt(index,m);return inverse.clone().multiply(object.matrixWorld).multiply(m)})
    const mesh=new T.InstancedMesh(object.geometry,object.material,stations.length*rows)
    mesh.name=`task_example_${groups.length}_${component}`
    let index=0
    for(const station of stations)for(const prototype of prototypes)mesh.setMatrixAt(index++,pose(-length-.5+station).multiply(prototype))
    mesh.instanceMatrix.needsUpdate=true
    mesh.userData={component,sourceNode:object.name,spacingM:spacing,sourceSegment:segment.segment_index}
    root.add(mesh)
    groups.push({name:mesh.name,component,spacingM:spacing,stations:stations.length,instances:mesh.count,visible:['primary_concrete','secondary_lining','steel_arch','lattice_arch'].includes(component)})
  })
  if(!groups.length)throw new Error(`1064米示例未找到${type}构件`)
  const buffer=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:false}) as ArrayBuffer
  return {buffer,groups,sourceSegment:segment.segment_index,sourceStatus:segment.model_status,sourceSpacing:segment.spacing_m}
}
