import fs from 'node:fs'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Vector3 } from 'three'
const root='public/data/tunnel/',meta=JSON.parse(fs.readFileSync(root+'三台阶.metadata.json'))
const profile=JSON.parse(fs.readFileSync('src/modules/face-sketch/tunnel-normal-sections.json'))
const b=fs.readFileSync(root+'三台阶.glb'),gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')
const report={meshes:[],maxBoundaryErrorM:0,maxStationPlaneErrorM:0,oldFixedPlaneObliquityDeg:profile.oldFixedPlaneObliquityDeg,passed:false}
gltf.scene.updateMatrixWorld(true)
gltf.scene.traverse(mesh=>{
  if(!mesh.isMesh)return
  const p=mesh.geometry.getAttribute('position'),indices=mesh.geometry.index,edges=new Map(),keys=[]
  for(let i=0;i<p.count;i++){
    const v=new Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld)
    const source=[meta.sourceGltfOrigin[0]-v.z,meta.sourceGltfOrigin[1]+v.y,meta.sourceGltfOrigin[2]+v.x]
    const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0)
    const planeError=s=>Math.abs(dot(source.map((x,i)=>x-s.frame.center[i]),s.frame.forward))
    const station=[...profile.sections].sort((a,b)=>planeError(a)-planeError(b))[0]
    report.maxStationPlaneErrorM=Math.max(report.maxStationPlaneErrorM,planeError(station))
    const delta=source.map((x,i)=>x-station.frame.center[i])
    const h=dot(delta,station.frame.up),x=dot(delta,station.frame.lateral),ring=station.outline,hits=[]
    for(let j=0;j<ring.length;j++){const a=ring[j],b=ring[(j+1)%ring.length];if((a[1]<h)!==(b[1]<h))hits.push(a[0]+(h-a[1])/(b[1]-a[1])*(b[0]-a[0]))}
    if(hits.length<2)throw Error('Vertex outside tunnel section height')
    const error=Math.min(Math.abs(x-Math.min(...hits)),Math.abs(x-Math.max(...hits)))
    report.maxBoundaryErrorM=Math.max(report.maxBoundaryErrorM,error)
    keys.push([v.x,v.y,v.z].map(n=>Math.round(n*1e5)).join(','))
  }
  for(let i=0;i<indices.count;i+=3){const triangle=[0,1,2].map(k=>keys[indices.getX(i+k)]);for(let j=0;j<3;j++){const key=[triangle[j],triangle[(j+1)%3]].sort().join(':');edges.set(key,(edges.get(key)||0)+1)}}
  const nonManifold=[...edges.values()].filter(n=>n!==2).length
  report.meshes.push({name:mesh.name,vertices:p.count,triangles:indices.count/3,nonManifoldEdges:nonManifold})
  if(nonManifold)throw Error(`Non-manifold mesh ${mesh.name}`)
})
if(report.meshes.length!==3||report.maxBoundaryErrorM>.003||report.maxStationPlaneErrorM>.00001)throw Error(JSON.stringify(report))
report.passed=true
fs.writeFileSync('docs/verification/2026-11-11-normal-section-geometry.json',JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify(report))
