import fs from 'node:fs'
const source='public/data/tunnel/tunnel002.glb'
const bytes=fs.readFileSync(source), jsonLength=bytes.readUInt32LE(12)
const doc=JSON.parse(bytes.subarray(20,20+jsonLength).toString())
const binary=bytes.subarray(28+jsonLength)
function accessor(id) {
  const a=doc.accessors[id],v=doc.bufferViews[a.bufferView],width=a.type==='VEC3'?3:1
  const size={5123:2,5125:4,5126:4}[a.componentType],stride=v.byteStride||size*width
  return {count:a.count,get(i,k=0){const offset=(v.byteOffset||0)+(a.byteOffset||0)+i*stride+k*size;return a.componentType===5126?binary.readFloatLE(offset):size===2?binary.readUInt16LE(offset):binary.readUInt32LE(offset)}}
}
const primitive=doc.meshes[0].primitives[0],pos=accessor(primitive.attributes.POSITION),index=accessor(primitive.indices)
export function section(cut, referenceArea, frame) {
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0)
const key=p=>p.map(x=>Math.round(x*1e3)).join(','),edges=new Map(),coordinates=new Map()
for(let i=0;i<index.count;i+=3){
  const points=[0,1,2].map(k=>[0,1,2].map(c=>pos.get(index.get(i+k),c))),hits=[]
  for(let j=0;j<3;j++) {
    const a=points[j],b=points[(j+1)%3]
    const distance=p=>frame ? dot(p.map((x,i)=>x-frame.center[i]),frame.forward) : p[0]-cut
    const da=distance(a),db=distance(b)
    if((da<0)===(db<0))continue
    const t=da/(da-db),hit=a.map((x,i)=>x+t*(b[i]-x))
    if(frame){const delta=hit.map((x,i)=>x-frame.center[i]);hits.push([dot(delta,frame.lateral),dot(delta,frame.up)])}
    else hits.push([hit[2],hit[1]])
  }
  if(hits.length!==2)continue
  const [a,b]=hits.map(key);if(a===b)continue
  hits.forEach(p=>coordinates.set(key(p),p))
  for(const [u,v] of [[a,b],[b,a]]) {if(!edges.has(u))edges.set(u,new Set());edges.get(u).add(v)}
}
const repairs=[]
for(const [a,neighbors] of edges){
  if(neighbors.size!==1)continue
  const p=coordinates.get(a)
  const nearest=[...edges].filter(([b,n])=>b!==a&&n.size===1&&!neighbors.has(b)).map(([b])=>({b,d:Math.hypot(...p.map((x,i)=>x-coordinates.get(b)[i]))})).sort((a,b)=>a.d-b.d)[0]
  if(nearest?.d<.01){neighbors.add(nearest.b);edges.get(nearest.b).add(a);repairs.push(nearest.d)}
}
const loops=[],seen=new Set()
for(const [start,neighbors] of edges) for(const first of neighbors){
  if(seen.has(`${start}:${first}`))continue
  const ring=[];let previous=start,current=first,closed=false
  for(let count=0;count<edges.size*2;count++){
    const edge=`${previous}:${current}`;if(seen.has(edge)){closed=previous===start&&current===first;break}seen.add(edge)
    ring.push(coordinates.get(previous))
    const p=coordinates.get(current),q=coordinates.get(previous),incoming=Math.atan2(q[1]-p[1],q[0]-p[0])
    const candidates=[...edges.get(current)].filter(x=>x!==previous).sort((a,b)=>{
      const angle=k=>{const v=coordinates.get(k);return (incoming-Math.atan2(v[1]-p[1],v[0]-p[0])+Math.PI*2)%(Math.PI*2)}
      return angle(a)-angle(b)
    })
    if(!candidates.length)break
    previous=current;current=candidates[0]
  }
  const signed=ring.reduce((s,p,i)=>{const q=ring[(i+1)%ring.length];return s+p[0]*q[1]-p[1]*q[0]},0)
  if(closed&&ring.length>10&&signed>0)loops.push(ring)
}
const area=ring=>Math.abs(ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-p[1]*q[0]},0)/2)
loops.sort((a,b)=>area(b)-area(a))
if(loops.length<2)throw Error(`Need closed lining inner/outer loops; found ${loops.length}`)
// The largest bounded face is the opening; smaller faces are lining/kerb sections.
const candidate=referenceArea ? [...loops].sort((a,b)=>Math.abs(area(a)-referenceArea)-Math.abs(area(b)-referenceArea))[0] : loops[0]
if(referenceArea && Math.abs(area(candidate)-referenceArea)>referenceArea*.05)throw Error(`Discontinuous opening at ${cut}`)
const outline=candidate
const result={source,method:frame?'centerline-normal-plane-intersection':'triangle-plane-intersection-inner-loop',gltfPlaneX:cut,...(frame?{frame}:{}),seamRepairsM:repairs,loopAreas:loops.map(area),outline}
return result
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/extract-tunnel-excavation-profile.mjs')) {
const sections=[]
for(let x=128;x<=150;x++){const s=section(x,sections[0]?.loopAreas[0]);sections.push(s);console.log(`Section ${x}: ${s.outline.length} points`)}
const supportSections=[]
for(let x=108;x<=128;x++){const s=section(x,sections[0].loopAreas[0]);supportSections.push(s);console.log(`Support section ${x}: ${s.outline.length} points`)}
fs.writeFileSync('src/modules/face-sketch/tunnel-excavation-profile.json',JSON.stringify({...sections[0],sections,supportSections},null,2)+'\n')
}
