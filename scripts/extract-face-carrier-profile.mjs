import fs from 'node:fs'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
const source = 'public/support-modeler/outputs/master_demo/ZZ-Va_support_1m_current.glb'
const bytes = fs.readFileSync(source)
const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
const mesh = gltf.scene.getObjectByName('primarySupportConcrete')
mesh.updateWorldMatrix(true, false)
const p = mesh.geometry.getAttribute('position'), points = []
for (let i = 0; i < p.count; i++) if (Math.abs(p.getZ(i)) < 1e-5) points.push([p.getX(i), p.getY(i)])
const sorted = [...new Map(points.map(p => [p.join(','), p])).values()].sort((a,b) => a[0]-b[0] || a[1]-b[1])
const cross = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
const half = points => { const hull = []; for (const p of points) { while(hull.length > 1 && cross(hull.at(-2),hull.at(-1),p) <= 0) hull.pop(); hull.push(p) } return hull.slice(0,-1) }
const outline = [...half(sorted), ...half([...sorted].reverse())]
fs.writeFileSync('src/modules/face-sketch/carrier-profile.json', JSON.stringify({ source, method: 'convex-hull-of-primarySupportConcrete-z0', outline }, null, 2)+'\n')
console.log(`Extracted ${outline.length} outline vertices`)
