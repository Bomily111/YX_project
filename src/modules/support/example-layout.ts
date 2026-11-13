import * as T from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { placeSourceShell } from './source-shell'
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
  const start=segment.centerline_start_distance_m
  data.scene.updateMatrixWorld(true)
  // The capture uses an orthogonal section frame. Recover that exact frame,
  // rather than recomputing a different basis from a fitted route tangent.
  let sourceFrame:T.Matrix4|undefined
  data.scene.traverse(object=>{
    if(object instanceof T.InstancedMesh&&object.userData.support_type===type&&object.userData.centerline_start_distance===start&&object.userData.component==='primary_concrete'){
      const matrix=new T.Matrix4();object.getMatrixAt(0,matrix)
      sourceFrame=object.matrixWorld.clone().multiply(matrix)
    }
  })
  if(!sourceFrame)throw new Error('源示例缺少可核实的初支断面坐标架')
  const inverse=sourceFrame.clone().invert()
  const root=new T.Group(),groups:Array<{name:string;component:string;spacingM:number;stations:number;instances:number;visible:boolean;sourceAxialExtentM:number;repeatGapM:number;sourceWidthM:number;sourceHeightM:number;stationOffsetsM:number[]}>=[]
  data.scene.traverse(object=>{
    if(!(object instanceof T.InstancedMesh)||object.userData.support_type!==type||object.userData.centerline_start_distance!==start)return
    const component=String(object.userData.component),spacing=componentSpacing(component,segment.spacing_m,object.userData.parameters)
    const stations=componentStations(length,spacing,object.userData.part==='connector')
    if(!stations.length)return
    const rows=component==='advance_support'?Number(object.userData.count_per_ring):1
    if(!rows||rows>object.count)throw new Error('1064米示例构件排数无效')
    const prototypes=Array.from({length:rows},(_,index)=>{const m=new T.Matrix4();object.getMatrixAt(index,m);return inverse.clone().multiply(object.matrixWorld).multiply(m)})
    object.geometry.computeBoundingBox()
    const bounds=new T.Box3()
    for(const prototype of prototypes) bounds.union(object.geometry.boundingBox!.clone().applyMatrix4(prototype))
    const sourceAxialExtentM=bounds.max.z-bounds.min.z
    // Presentation materials are derived copies; never mutate the cached source.
    // Concrete uses an opaque neutral surface, so overlapping transparent rings
    // cannot masquerade as holes or construction joints. Type remains a label.
    const material = (Array.isArray(object.material) ? object.material : [object.material]).map(source => {
      const copy = source.clone() as T.MeshStandardMaterial
      if(component==='primary_concrete'||component==='secondary_lining') {
        copy.color.set(component==='primary_concrete'?'#a9aaa5':'#c2ccd0')
        copy.opacity=1;copy.transparent=false;copy.depthWrite=true
        copy.metalness=0;copy.roughness=.88
      }
      return copy
    })
    const shell=component==='primary_concrete'||component==='secondary_lining'
    const mesh=shell?new T.Group():new T.InstancedMesh(object.geometry,Array.isArray(object.material)?material:material[0],stations.length*rows)
    mesh.name=`task_example_${groups.length}_${component}`
    let index=0
    for(const [s,station] of stations.entries())for(const prototype of prototypes){
      if(mesh instanceof T.InstancedMesh)mesh.setMatrixAt(index++,pose(-length-.5+station).multiply(prototype))
      else mesh.add(new T.Mesh(placeSourceShell(object.geometry,prototype,pose,-length-.5+station,s===0,s===stations.length-1),Array.isArray(object.material)?material:material[0]))
    }
    if(mesh instanceof T.InstancedMesh)mesh.instanceMatrix.needsUpdate=true
    mesh.userData={component,sourceNode:object.name,spacingM:spacing,sourceSegment:segment.segment_index}
    root.add(mesh)
    groups.push({name:mesh.name,component,spacingM:spacing,stations:stations.length,instances:stations.length*rows,sourceAxialExtentM,repeatGapM:spacing-sourceAxialExtentM,sourceWidthM:bounds.max.x-bounds.min.x,sourceHeightM:bounds.max.y-bounds.min.y,stationOffsetsM:stations.map(station=>-length-.5+station),visible:['primary_concrete','secondary_lining','steel_arch','lattice_arch'].includes(component)})
  })
  if(!groups.length)throw new Error(`1064米示例未找到${type}构件`)
  const buffer=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:false}) as ArrayBuffer
  return {buffer,groups,sourceSegment:segment.segment_index,sourceStatus:segment.model_status,sourceSpacing:segment.spacing_m,
    geometryTreatment:'source-instance-frame; concrete source vertices follow target end sections; internal axial caps omitted; other components rigid'}
}
