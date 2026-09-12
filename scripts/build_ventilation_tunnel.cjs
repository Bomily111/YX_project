const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const sourceDir = path.join(projectRoot, 'public', 'data', 'ventilation', 'source-models')
const leftPath = process.argv[2] || path.join(sourceDir, 'left-tbm-100m.glb')
const rightPath = process.argv[3] || path.join(sourceDir, 'right-drill-source.glb')
const outputPath = process.argv[4] || path.join(projectRoot, 'public', 'data', 'ventilation', 'tunnel-assembled.glb')

function readGlb(file) {
  const data = fs.readFileSync(file)
  if (data.readUInt32LE(0) !== 0x46546c67 || data.readUInt32LE(4) !== 2) throw new Error(`Not a glTF 2.0 GLB: ${file}`)
  let offset = 12; let json; let binary
  while (offset < data.length) {
    const length = data.readUInt32LE(offset); const type = data.readUInt32LE(offset + 4)
    const chunk = data.subarray(offset + 8, offset + 8 + length)
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8').trim())
    if (type === 0x004e4942) binary = Buffer.from(chunk)
    offset += 8 + length
  }
  if (!json || !binary) throw new Error(`GLB is missing JSON or BIN chunk: ${file}`)
  if (json.images?.length || json.textures?.length) throw new Error('Textured source models require texture merging support')
  return { json, binary }
}

const out = {
  asset: { version: '2.0', generator: 'Ventilation tunnel assembler (Cesium instanced model)' },
  scene: 0,
  scenes: [{ name: 'Ventilation tunnel system', nodes: [] }],
  nodes: [], meshes: [], materials: [], accessors: [], bufferViews: [], buffers: [{ byteLength: 0 }],
}
const binaryParts = []; let binaryLength = 0
const clone = value => JSON.parse(JSON.stringify(value))
const align4 = value => (value + 3) & ~3

function appendSource(source, label) {
  const aligned = align4(binaryLength)
  if (aligned > binaryLength) binaryParts.push(Buffer.alloc(aligned - binaryLength))
  binaryLength = aligned
  const binaryBase = binaryLength
  binaryParts.push(source.binary); binaryLength += source.binary.length

  const viewBase = out.bufferViews.length
  for (const view of source.json.bufferViews || []) {
    const next = clone(view); next.buffer = 0; next.byteOffset = (next.byteOffset || 0) + binaryBase
    out.bufferViews.push(next)
  }
  const accessorBase = out.accessors.length
  for (const accessor of source.json.accessors || []) {
    const next = clone(accessor)
    if (next.bufferView != null) next.bufferView += viewBase
    if (next.sparse) {
      next.sparse.indices.bufferView += viewBase
      next.sparse.values.bufferView += viewBase
    }
    out.accessors.push(next)
  }
  const materialBase = out.materials.length
  for (const material of source.json.materials || []) out.materials.push(clone(material))
  const meshBase = out.meshes.length
  for (const mesh of source.json.meshes || []) {
    const next = clone(mesh); next.name = `${label} · ${next.name || 'mesh'}`
    for (const primitive of next.primitives) {
      for (const key of Object.keys(primitive.attributes || {})) primitive.attributes[key] += accessorBase
      if (primitive.indices != null) primitive.indices += accessorBase
      if (primitive.material != null) primitive.material += materialBase
      for (const target of primitive.targets || []) for (const key of Object.keys(target)) target[key] += accessorBase
    }
    out.meshes.push(next)
  }
  return { mesh: meshBase, material: materialBase }
}

const left = appendSource(readGlb(leftPath), '左主洞 TBM')
const right = appendSource(readGlb(rightPath), '右主洞 钻爆')

function addMaterial(name, color) {
  out.materials.push({
    name, doubleSided: true,
    pbrMetallicRoughness: { baseColorFactor: color, metallicFactor: 0, roughnessFactor: 0.86 },
  })
  return out.materials.length - 1
}

function appendBinary(data, target) {
  const aligned = align4(binaryLength)
  if (aligned > binaryLength) binaryParts.push(Buffer.alloc(aligned - binaryLength))
  binaryLength = aligned
  const buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  const bufferView = out.bufferViews.length
  out.bufferViews.push({ buffer: 0, byteOffset: binaryLength, byteLength: buffer.length, target })
  binaryParts.push(buffer); binaryLength += buffer.length
  return bufferView
}

// Build a dedicated one-metre horseshoe lining along local Z. Cross passages,
// exploration headings and auxiliary headings therefore no longer reuse the TBM shell.
function createHorseshoeMesh(name, clearWidth, clearHeight, liningThickness, material) {
  const positions = []; const normals = []; const indices = []
  function contour(width, height, floorY) {
    const radius = width / 2
    const crownCenterY = floorY + height - radius
    const points = [[-radius, floorY]]
    for (let i = 0; i <= 12; i++) {
      const angle = Math.PI - (Math.PI * i / 12)
      points.push([Math.cos(angle) * radius, crownCenterY + Math.sin(angle) * radius])
    }
    points.push([radius, floorY])
    return points
  }
  function pushQuad(a, b, c, d, normal) {
    const base = positions.length / 3
    for (const p of [a, b, c, d]) positions.push(...p)
    for (let i = 0; i < 4; i++) normals.push(...normal)
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  function addSurface(points, inward) {
    for (let i = 0; i < points.length; i++) {
      const a = points[i]; const b = points[(i + 1) % points.length]
      const dx = b[0] - a[0]; const dy = b[1] - a[1]
      const length = Math.hypot(dx, dy) || 1
      const sign = inward ? -1 : 1
      const normal = [sign * dy / length, sign * -dx / length, 0]
      const quad = [[a[0], a[1], -0.5], [b[0], b[1], -0.5], [b[0], b[1], 0.5], [a[0], a[1], 0.5]]
      if (inward) pushQuad(quad[3], quad[2], quad[1], quad[0], normal)
      else pushQuad(...quad, normal)
    }
  }
  const inner = contour(clearWidth, clearHeight, 0)
  const outer = contour(clearWidth + liningThickness * 2, clearHeight + liningThickness, -liningThickness)
  addSurface(outer, false); addSurface(inner, true)

  const positionArray = new Float32Array(positions)
  const normalArray = new Float32Array(normals)
  const indexArray = new Uint32Array(indices)
  const positionView = appendBinary(positionArray, 34962)
  const normalView = appendBinary(normalArray, 34962)
  const indexView = appendBinary(indexArray, 34963)
  const xs = positions.filter((_, i) => i % 3 === 0)
  const ys = positions.filter((_, i) => i % 3 === 1)
  const positionAccessor = out.accessors.length
  out.accessors.push({ bufferView: positionView, componentType: 5126, count: positions.length / 3, type: 'VEC3', min: [Math.min(...xs), Math.min(...ys), -0.5], max: [Math.max(...xs), Math.max(...ys), 0.5] })
  const normalAccessor = out.accessors.length
  out.accessors.push({ bufferView: normalView, componentType: 5126, count: normals.length / 3, type: 'VEC3' })
  const indexAccessor = out.accessors.length
  out.accessors.push({ bufferView: indexView, componentType: 5125, count: indices.length, type: 'SCALAR', min: [0], max: [positions.length / 3 - 1] })
  out.meshes.push({ name, primitives: [{ attributes: { POSITION: positionAccessor, NORMAL: normalAccessor }, indices: indexAccessor, material }] })
  return out.meshes.length - 1
}

const crossMesh = createHorseshoeMesh('4m × 4m 独立横通道', 4, 4, 0.3,
  addMaterial('横通道混凝土', [0.48, 0.53, 0.56, 1]))
const ddkMesh = createHorseshoeMesh('6m × 5.5m 独立 DDK 探洞', 6, 5.5, 0.35,
  addMaterial('探洞衬砌', [0.58, 0.53, 0.43, 1]))
const auxiliaryMesh = createHorseshoeMesh('5m × 4.5m 独立辅助通道', 5, 4.5, 0.35,
  addMaterial('辅助通道衬砌', [0.48, 0.43, 0.52, 1]))

function addNode(name, mesh, translation, scale = [1, 1, 1], yaw = 0, extras = {}) {
  const node = { name, mesh, translation, scale, extras }
  if (yaw) node.rotation = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)]
  out.nodes.push(node); out.scenes[0].nodes.push(out.nodes.length - 1)
}

const mainSpacing = 32
// Plan convention: the left/TBM alignment is the upper alignment and uses the
// positive local-X side; the right/drill alignment uses local X=0.
const leftCenterX = mainSpacing
const rightCenterX = 0

// Left tunnel: the supplied mesh is a true 100m module centered on local Z=0.
for (let i = 0; i < 68; i++) {
  addNode(`左主洞 TBM K${i * 100}-${(i + 1) * 100}`, left.mesh, [leftCenterX, 0, i * 100 + 50], [1, 1, 1], 0,
    { kind: 'main-tunnel', tunnel: 'Left', method: 'TBM', start: i * 100, end: (i + 1) * 100 })
}

// Right source evaluates to 11.8m after its Blender node transform. Keep its
// cross-section scale, normalize only local Z to 100m, then instance 78 times.
const drillRawLength = 38.71390914916992
const drillScaleXY = 0.30480000376701355
const drillScaleZ = 100 / drillRawLength
const drillCenterX = ((-6.190725326538086 + 33.50743865966797) / 2) * drillScaleXY
const drillCenterY = ((-12.152948379516602 + 21.9676456451416) / 2) * drillScaleXY
const tunnelCenterY = (-3.9000000953674316 + 8.675000190734863) / 2
const leftHalfWidth = (6.3981242179870605 - (-6.25177001953125)) / 2
const rightHalfWidth = (33.50743865966797 - (-6.190725326538086)) * drillScaleXY / 2
for (let i = 0; i < 78; i++) {
  addNode(`右主洞 钻爆 K${i * 100}-${(i + 1) * 100}`, right.mesh,
    [rightCenterX - drillCenterX, tunnelCenterY - drillCenterY, (i + 1) * 100],
    [drillScaleXY, drillScaleXY, drillScaleZ], 0,
    { kind: 'main-tunnel', tunnel: 'Right', method: '钻爆', start: i * 100, end: (i + 1) * 100 })
}

// Align every secondary heading by its section centre instead of reusing the
// left-tunnel invert.  The old mainFloorY translation put the 4–5.5m-high
// headings roughly four metres too low relative to both main-tunnel axes.
const sectionCenterTranslationY = (clearHeight, liningThickness) =>
  tunnelCenterY - (clearHeight - liningThickness) / 2
const crossCenterY = sectionCenterTranslationY(4, 0.3)
const auxiliaryCenterY = sectionCenterTranslationY(4.5, 0.35)
const ddkCenterY = sectionCenterTranslationY(5.5, 0.35)

// Keep only a 5cm lining engagement at orthogonal junctions.  This closes
// floating-point seams without allowing the secondary shells to run visibly
// through the main tunnels.
const orthogonalJunctionEngagement = 0.05

// Four 4m×4m transverse passages, matching the 2D design chainages.
const connectorStartX = rightCenterX + rightHalfWidth - orthogonalJunctionEngagement
const connectorEndX = leftCenterX - leftHalfWidth + orthogonalJunctionEngagement
const connectorLength = connectorEndX - connectorStartX
for (const chainage of [2300, 4000, 5400, 6800]) {
  addNode(`横通道 K${chainage}`, crossMesh, [(connectorStartX + connectorEndX) / 2, crossCenterY, chainage], [1, 1, connectorLength], Math.PI / 2,
    { kind: 'cross-passage', chainage, size: '4m×4m', clearLength: connectorLength, connects: ['Left', 'Right'] })
}

// YS 2# auxiliary A/D headings extend 100m outward from both main tunnels.
const dStartX = leftCenterX + leftHalfWidth - orthogonalJunctionEngagement; const dEndX = dStartX + 100
const aEndX = rightCenterX - rightHalfWidth + orthogonalJunctionEngagement; const aStartX = aEndX - 100
addNode('D线辅助通道 K4000', auxiliaryMesh, [(dStartX + dEndX) / 2, auxiliaryCenterY, 4000], [1, 1, dEndX - dStartX], Math.PI / 2,
  { kind: 'auxiliary', id: 'D', chainage: 4000, length: 100, fromX: dStartX, toX: dEndX })
addNode('A线辅助通道 K4000', auxiliaryMesh, [(aStartX + aEndX) / 2, auxiliaryCenterY, 4000], [1, 1, aEndX - aStartX], Math.PI / 2,
  { kind: 'auxiliary', id: 'A', chainage: 4000, length: 100, fromX: aStartX, toX: aEndX })

// DDK follows the 2D design: portal K1+050, merges at K2+370, 22.5° to the main alignment.
const ddkAngle = 22.5 * Math.PI / 180
// At the oblique junction the heading's outer corner reaches the main-tunnel
// lining first.  Stop the DDK axis accordingly and engage only one lining
// thickness, instead of driving its complete 6m section through the main tube.
const ddkOuterHalfWidth = (6 + 0.35 * 2) / 2
const ddkLiningEngagement = 0.35
const ddkEnd = [rightCenterX - rightHalfWidth - ddkOuterHalfWidth * Math.cos(ddkAngle) + ddkLiningEngagement, 2370]
const ddkStart = [ddkEnd[0] - Math.tan(ddkAngle) * (ddkEnd[1] - 1050), 1050]
const dx = ddkEnd[0] - ddkStart[0]; const dz = ddkEnd[1] - ddkStart[1]
const ddkLength = Math.hypot(dx, dz); const ddkSegments = Math.ceil(ddkLength / 100)
const ddkYaw = Math.atan2(dx, dz)
for (let i = 0; i < ddkSegments; i++) {
  const t0 = i / ddkSegments; const t1 = (i + 1) / ddkSegments; const tm = (t0 + t1) / 2
  const segmentLength = ddkLength / ddkSegments
  addNode(`DDK 探洞 ${i + 1}/${ddkSegments}`, ddkMesh,
    [ddkStart[0] + dx * tm, ddkCenterY, ddkStart[1] + dz * tm],
    [1, 1, segmentLength], ddkYaw,
    { kind: 'exploration-tunnel', tunnel: 'DDK', startRatio: t0, endRatio: t1 })
}

const binary = Buffer.concat(binaryParts)
out.buffers[0].byteLength = binary.length
const jsonBuffer = Buffer.from(JSON.stringify(out), 'utf8')
const jsonPaddedLength = align4(jsonBuffer.length)
const binPaddedLength = align4(binary.length)
const totalLength = 12 + 8 + jsonPaddedLength + 8 + binPaddedLength
const glb = Buffer.alloc(totalLength)
glb.writeUInt32LE(0x46546c67, 0); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(totalLength, 8)
glb.writeUInt32LE(jsonPaddedLength, 12); glb.writeUInt32LE(0x4e4f534a, 16)
jsonBuffer.copy(glb, 20); glb.fill(0x20, 20 + jsonBuffer.length, 20 + jsonPaddedLength)
const binHeader = 20 + jsonPaddedLength
glb.writeUInt32LE(binPaddedLength, binHeader); glb.writeUInt32LE(0x004e4942, binHeader + 4)
binary.copy(glb, binHeader + 8)
fs.writeFileSync(outputPath, glb)

const metadata = {
  generatedAt: new Date().toISOString(), output: path.basename(outputPath),
  coordinateSystem: 'local Y-up, Z-chainage, Left/TBM X=32m, Right/Drill X=0m',
  mainTunnelSpacing: { centerToCenter: mainSpacing, clearRockPillar: mainSpacing - leftHalfWidth - rightHalfWidth },
  left: { method: 'TBM', length: 6800, moduleLength: 100, instances: 68 },
  right: { method: '钻爆', length: 7800, normalizedModuleLength: 100, instances: 78 },
  crossPassages: [2300, 4000, 5400, 6800],
  junctionAlignment: {
    mainAxisY: tunnelCenterY,
    crossTranslationY: crossCenterY,
    auxiliaryTranslationY: auxiliaryCenterY,
    ddkTranslationY: ddkCenterY,
    orthogonalEngagement: orthogonalJunctionEngagement,
    ddkLiningEngagement,
  },
  auxiliary: [{ id: 'D', chainage: 4000, length: 100, fromX: dStartX, toX: dEndX }, { id: 'A', chainage: 4000, length: 100, fromX: aStartX, toX: aEndX }],
  ddk: { from: { x: ddkStart[0], chainage: ddkStart[1] }, to: { x: ddkEnd[0], chainage: ddkEnd[1] }, angleDegrees: 22.5, length: ddkLength, instances: ddkSegments },
  nodeCount: out.nodes.length, meshCount: out.meshes.length, byteLength: glb.length,
}
fs.writeFileSync(outputPath.replace(/\.glb$/i, '.meta.json'), JSON.stringify(metadata, null, 2))
console.log(JSON.stringify(metadata, null, 2))
