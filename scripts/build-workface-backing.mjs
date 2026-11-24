import { readFileSync, writeFileSync } from 'node:fs'
import { BufferGeometry, BufferAttribute, ShapeUtils, Vector2 } from 'three'

const folder = new URL('../public/data/workface-surface/', import.meta.url)
const source = readFileSync(new URL('texturedMesh.glb', folder))
const jsonLength = source.readUInt32LE(12)
const gltf = JSON.parse(source.subarray(20, 20 + jsonLength))
const bin = 28 + jsonLength
const primitive = gltf.meshes[0].primitives[0]
const offset = accessor => bin + (gltf.bufferViews[accessor.bufferView].byteOffset ?? 0) + (accessor.byteOffset ?? 0)
const position = gltf.accessors[primitive.attributes.POSITION]
const index = gltf.accessors[primitive.indices]
if (position.componentType !== 5126 || index.componentType !== 5125 ||
    (gltf.bufferViews[position.bufferView].byteStride ?? 12) !== 12) throw Error('Unexpected source mesh layout')

// Weld identical seam positions only for finding the source's open boundary.
const points = [], welded = [], byPosition = new Map()
for (let i = 0, start = offset(position); i < position.count; i++) {
  const xyz = [0, 4, 8].map(byte => source.readFloatLE(start + i * 12 + byte))
  const key = xyz.join(',')
  if (!byPosition.has(key)) {
    byPosition.set(key, points.length)
    points.push(xyz)
  }
  welded.push(byPosition.get(key))
}
const edges = new Map()
const start = offset(index)
for (let i = 0; i < index.count; i += 3) {
  const face = [i, i + 1, i + 2].map(j => welded[source.readUInt32LE(start + j * 4)])
  for (let j = 0; j < 3; j++) {
    const a = face[j], b = face[(j + 1) % 3]
    const key = Math.min(a, b) + ':' + Math.max(a, b)
    const entry = edges.get(key)
    if (entry) entry.count++
    else edges.set(key, { a, b, count: 1 })
  }
}
const next = new Map()
for (const { a, b, count } of edges.values()) {
  if (count > 2 || (count === 1 && next.has(a))) throw Error('Non-manifold source boundary')
  if (count === 1) next.set(a, b)
}
const loops = []
while (next.size) {
  const first = next.keys().next().value
  const ring = []
  let vertex = first
  do {
    if (!next.has(vertex)) throw Error('Unclosed source boundary')
    ring.push(points[vertex])
    const following = next.get(vertex)
    next.delete(vertex)
    vertex = following
  } while (vertex !== first)
  loops.push(ring)
}
loops.sort((a, b) => b.length - a.length)
const [rim, ...smallOpenings] = loops
if (rim.length !== 1251 || smallOpenings.length !== 1) throw Error('Source perimeter changed')
const depthM = 3
const displayScale = 0.18
const rearZ = points.reduce((min, point) => Math.min(min, point[2]), Infinity) - depthM / displayScale
// Smooth the constructed contour without moving the exact source edge.
const smoothRadius = 14
const rear = rim.map((_,i) => {
  const value = new Vector2()
  let total = 0
  for (let j=-smoothRadius;j<=smoothRadius;j++) {
    const point = rim[(i+j+rim.length)%rim.length], weight = smoothRadius+1-Math.abs(j)
    value.x += point[0]*weight
    value.y += point[1]*weight
    total += weight
  }
  return value.multiplyScalar(1/total)
})
const cross = (a,b,c) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)
const centerX = rear.reduce((sum,point)=>sum+point.x,0)/rear.length
const centerY = rear.reduce((sum,point)=>sum+point.y,0)/rear.length
const sectorCount = 96
const sectorAt = (x,y) => ((Math.atan2(y-centerY,x-centerX)+Math.PI)/(2*Math.PI)*sectorCount)%sectorCount
const wrapped = sector => (sector+sectorCount)%sectorCount
const extent = Array(sectorCount).fill(0)
for (const [x,y] of points) {
  const sector=Math.floor(sectorAt(x,y))
  extent[sector]=Math.max(extent[sector],Math.hypot(x-centerX,y-centerY))
}
const outerProfile=extent.map((_,sector)=>{
  let weighted=0, total=0
  for(let delta=-5;delta<=5;delta++) {
    const weight=(6-Math.abs(delta))**2
    weighted+=extent[wrapped(sector+delta)]*weight
    total+=weight
  }
  return weighted/total
})
const smoothStep = value => {
  const t=Math.max(0,Math.min(value,1))
  return t*t*(3-2*t)
}
function noise(x,y,z, frequency) {
  const scaled=[x*frequency,y*frequency,z*frequency]
  const origin=scaled.map(Math.floor)
  const mix=scaled.map((value,i)=>{const f=value-origin[i];return f*f*(3-2*f)})
  let sum=0
  for (let i=0;i<2;i++) for (let j=0;j<2;j++) for (let k=0;k<2;k++) {
    const hash=Math.imul(origin[0]+i,374761393)^Math.imul(origin[1]+j,668265263)^Math.imul(origin[2]+k,1274126177)
    const sample=((Math.imul(hash^(hash>>>13),1274126177)>>>0)/4294967295)*2-1
    sum+=sample*(i?mix[0]:1-mix[0])*(j?mix[1]:1-mix[1])*(k?mix[2]:1-mix[2])
  }
  return sum
}
// The source perimeter overlaps locally in projection; uncross the rear cap
// only. The original three-dimensional connection ring stays exact.
let crossings = 0
for (let i = 0; i < rear.length - 2; i++) {
  for (let j = i + 2; j < rear.length; j++) {
    const a = rear[i], b = rear[i+1], c = rear[j], d = rear[(j+1)%rear.length]
    if (cross(a,b,c)*cross(a,b,d) < 0 && cross(c,d,a)*cross(c,d,b) < 0) {
      rear.splice(i+1, j-i, ...rear.slice(i+1,j+1).reverse())
      crossings++
    }
  }
}
if (crossings > 1) throw Error('Unexpected rear contour crossings')

const vertices = [], triangles = [], uvs=[]
// Map a contiguous rock patch from the existing source atlas onto the new
// material. Mirrored repeats avoid hard breaks between tiles.
const mirror = value => 1-Math.abs(((value%2)+2)%2-1)
const atlas = (u,v) => [.46+.15*mirror(u), .71+.14*mirror(v)]
const perimeter=[0]
for(let i=0;i<rim.length;i++) {
  const a=rear[i], b=rear[(i+1)%rim.length]
  perimeter.push(perimeter[i]+a.distanceTo(b))
}
const sideUv = (i,t) => atlas(perimeter[i]/perimeter.at(-1)*8,t*2)
const push = (p, uv=atlas(p[0]/19,p[1]/19)) => {
  const i=vertices.length/3
  vertices.push(...p)
  uvs.push(...uv)
  return i
}
const ringCount = 28
let near = rim.map((p,i)=>push(p,sideUv(i,0)))
let rearPoints
for (let layer=1;layer<=ringCount;layer++) {
  const t=layer/ringCount
  const smoothing=smoothStep(t*5)
  const influence=smoothStep(t*8)*(1-Math.pow(t,5))
  const ring = rim.map(([x,y,z],i)=>{
    const rx=x+(rear[i].x-x)*smoothing, ry=y+(rear[i].y-y)*smoothing
    const vx=rx-centerX,vy=ry-centerY, radius=Math.hypot(vx,vy)
    const angle=sectorAt(rx,ry)-.5,sector=Math.floor(angle),blend=angle-sector
    const outer=outerProfile[wrapped(sector)]*(1-blend)+outerProfile[wrapped(sector+1)]*blend
    const az=z+(rearZ-z)*t
    const ridge=1-Math.abs(noise(rx,ry,az,.53))
    const relief=(noise(rx,ry,az,.24)*.55+ridge*.48+noise(rx,ry,az,1.05)*.21)*smoothStep(t*8)*(1-t)
    const offset=(Math.max(0,outer-radius)*influence*.92+relief)/radius
    // Keep the rounded loft. Only soften the lateral shoulders, with the
    // strongest correction on the sides and none at the original join.
    const shoulderInset=.045*smoothStep(t*5)*(vx/radius)**2
    return [rx+vx*(offset-shoulderInset),ry+vy*offset,az]
  })
  const far=ring.map((p,i)=>push(p,sideUv(i,t)))
  for (let i = 0; i < rim.length; i++) {
    const j = (i+1) % rim.length
    const a=near[i],b=near[j],c=far[j],d=far[i]
    triangles.push(b,a,d,b,d,c)
  }
  near=far
  rearPoints=ring
}
function cap(outline, backFacing) {
  const indices = outline.map(p=>push(p))
  const ring = outline.map(([x,y])=>new Vector2(x,y))
  for (const [a,b,c] of ShapeUtils.triangulateShape(ring,[])) {
    const clockwise = cross(ring[a],ring[b],ring[c]) < 0
    triangles.push(indices[a], indices[clockwise === backFacing ? b : c], indices[clockwise === backFacing ? c : b])
  }
}
cap(rearPoints,true)
for (const opening of smallOpenings) {
  // Close the tiny incidental opening without reusing a source interior edge.
  const center = [0, 1, 2].map(axis => opening.reduce((sum,point)=>sum+point[axis],0)/opening.length)
  const middle = push(center), border = opening.map(p=>push(p))
  for (let i=0; i<border.length; i++) triangles.push(border[(i+1)%border.length],border[i],middle)
}
const geometry = new BufferGeometry()
geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices),3))
geometry.setIndex(triangles)
// Check that the exported float32 backing actually closes the source boundary.
const exportVertices = geometry.attributes.position.array
const exportWelded = []
for (let i=0; i<exportVertices.length; i+=3) {
  const key = exportVertices.subarray(i,i+3).join(',')
  if (!byPosition.has(key)) byPosition.set(key,byPosition.size)
  exportWelded.push(byPosition.get(key))
}
for (let i=0; i<triangles.length; i+=3) {
  for (let j=0; j<3; j++) {
    const a=exportWelded[triangles[i+j]],b=exportWelded[triangles[i+(j+1)%3]]
    const key=Math.min(a,b)+':'+Math.max(a,b)
    const entry=edges.get(key)
    if (entry) entry.count++
    else edges.set(key,{a,b,count:1})
  }
}
if ([...edges.values()].some(edge=>edge.count!==2)) throw Error('Exported source and backing have open or overlapping edges')
geometry.computeVertexNormals()
geometry.computeBoundingBox()
const colors = new Float32Array(vertices.length)
for(let i=0;i<vertices.length;i+=3) {
  const [x,y,z]=vertices.slice(i,i+3)
  const variation=noise(x,y,z,.17)*.034+noise(x,y,z,.55)*.026+noise(x,y,z,1.34)*.017
  colors[i]=.76+variation*2
  colors[i+1]=.75+variation*2
  colors[i+2]=.73+variation*2
}
geometry.setAttribute('color',new BufferAttribute(colors,3))
geometry.setAttribute('uv',new BufferAttribute(new Float32Array(uvs),2))
const attributes = [geometry.attributes.position,geometry.attributes.normal,geometry.index,geometry.attributes.color,geometry.attributes.uv]
const payloads = attributes.map(({array})=>Buffer.from(array.buffer,array.byteOffset,array.byteLength))
const buffers = payloads.map((bytes)=>Buffer.concat([bytes,Buffer.alloc((-bytes.length)&3)]))
let byteOffset = 0
const bufferViews = buffers.map((bytes,i)=>{
  const view={buffer:0,byteOffset,byteLength:payloads[i].length}
  byteOffset+=bytes.length
  return view
})
const binary = Buffer.concat(buffers)
const data = {
  asset:{version:'2.0',generator:'Workface backing demonstration'},
  extras:{depthM,displayScale,rearZ,source:'texturedMesh.glb',sourcePerimeterVertices:rim.length},
  scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,name:'Demonstration rock backing'}],
  meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1,COLOR_0:3,TEXCOORD_0:4},indices:2,material:0}]}],
  images:[{uri:'texturedMesh.jpg'}],textures:[{source:0}],
  materials:[{name:'Demonstration rock backing',pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:.99}}],
  buffers:[{byteLength:binary.length}],bufferViews,
  accessors:attributes.map((item,i)=>({
    bufferView:i,componentType:i===2?5123:5126,count:item.count,type:i===2?'SCALAR':i===4?'VEC2':'VEC3',
    ...(i===0?{min:geometry.boundingBox.min.toArray(),max:geometry.boundingBox.max.toArray()}:{}),
  })),
}
const json=Buffer.from(JSON.stringify(data))
const padded=Buffer.concat([json,Buffer.alloc((-json.length)&3,0x20)])
const header=Buffer.alloc(20), binHeader=Buffer.alloc(8)
header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+padded.length+binary.length,8)
header.writeUInt32LE(padded.length,12);header.write('JSON',16)
binHeader.writeUInt32LE(binary.length);binHeader.writeUInt32LE(0x004e4942,4)
writeFileSync(new URL('workface-backing-3m.glb',folder),Buffer.concat([header,padded,binHeader,binary]))
