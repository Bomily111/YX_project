import {expect,it} from 'vitest'
import fs from 'node:fs'
import * as T from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {placeSourceShell} from '@/modules/support/source-shell'

it('joins all 13 captured support types using source vertices and removes only internal caps',async()=>{
 const bytes=fs.readFileSync('public/support-modeler/outputs/centerline/task-reference-1064.glb')
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')
 gltf.scene.updateMatrixWorld(true)
 const types=new Set<string>()
 gltf.scene.traverse(o=>{if(o instanceof T.InstancedMesh&&o.userData.component==='primary_concrete')types.add(o.userData.support_type)})
 expect(types.size).toBe(13)
 for(const type of types){
  let frame:T.Matrix4|undefined
  const shells:T.InstancedMesh[]=[]
  let start=Infinity
  gltf.scene.traverse(o=>{if(o instanceof T.InstancedMesh&&o.userData.support_type===type)start=Math.min(start,o.userData.centerline_start_distance)})
  gltf.scene.traverse(o=>{
   if(!(o instanceof T.InstancedMesh)||o.userData.support_type!==type||o.userData.centerline_start_distance!==start)return
   if(o.userData.component==='primary_concrete'){const m=new T.Matrix4();o.getMatrixAt(0,m);frame=o.matrixWorld.clone().multiply(m)}
   if(['primary_concrete','secondary_lining'].includes(o.userData.component))shells.push(o)
  })
  expect(shells).toHaveLength(2)
  for(const shell of shells){
   const instance=new T.Matrix4();shell.getMatrixAt(0,instance)
   const prototype=frame!.clone().invert().multiply(shell.matrixWorld).multiply(instance)
   const pose=(s:number)=>new T.Matrix4().makeRotationY(s*.015).setPosition(s*.1,s*.01,s)
   const a=placeSourceShell(shell.geometry,prototype,pose,-2.5,true,false)
   const b=placeSourceShell(shell.geometry,prototype,pose,-1.5,false,true)
   const source=shell.geometry.attributes.position
   const front:number[]=[],back:number[]=[]
   for(let i=0;i<source.count;i++){
    if(Math.abs(source.getZ(i)-1)<1e-5)front.push(i)
    if(Math.abs(source.getZ(i))<1e-5)back.push(i)
   }
   let max=0
   for(const i of front){
    const v=new T.Vector3().fromBufferAttribute(a.attributes.position,i)
    max=Math.max(max,Math.min(...back.map(j=>v.distanceTo(new T.Vector3().fromBufferAttribute(b.attributes.position,j)))))
   }
   expect(max).toBeLessThan(1e-5)
   expect(a.index!.count).toBeLessThan(shell.geometry.index!.count)
   expect(b.index!.count).toBeLessThan(shell.geometry.index!.count)
   expect(a.attributes.position.count).toBe(source.count)
  }
 }
})
