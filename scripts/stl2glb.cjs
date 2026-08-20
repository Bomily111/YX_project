/**
 * STL → GLB 转换器（二进制/ASCII 双支持）
 *
 * 用法:
 *   node scripts/stl2glb.cjs --input <model.stl> --output public/data/jumbo/jumbo_solid.glb [--scale 0.001]
 *
 * 说明:
 *   - STL 已是三角网格，无需网格化，直接读三角形 → 构建 GLB（非索引，面法线）
 *   - Creo 导出 STL 单位为 mm，--scale 0.001 转米
 *   - STL 无颜色，统一钢灰材质
 */
'use strict';

const fs = require('fs');
const path = require('path');

function parseArgv() {
  const a = process.argv.slice(2);
  const o = { input: null, output: null, scale: 0.001 };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--input') o.input = a[++i];
    else if (a[i] === '--output') o.output = a[++i];
    else if (a[i] === '--scale') o.scale = parseFloat(a[++i]);
  }
  return o;
}

const opts = parseArgv();
if (!opts.input || !opts.output) {
  console.error('用法: node scripts/stl2glb.cjs --input <stl> --output <glb> [--scale 0.001]');
  process.exit(1);
}
const projectRoot = path.join(__dirname, '..');
const inputPath = path.resolve(projectRoot, opts.input);
const outputPath = path.resolve(projectRoot, opts.output);
const SCALE = opts.scale;

// ── STL 解析 ───────────────────────────────────────────────
function parseBinaryStl(buf, triCount) {
  const positions = new Float32Array(triCount * 9);
  const normals = new Float32Array(triCount * 9);
  let off = 84;
  for (let t = 0; t < triCount; t++) {
    const nx = buf.readFloatLE(off);
    const ny = buf.readFloatLE(off + 4);
    const nz = buf.readFloatLE(off + 8);
    off += 12;
    for (let v = 0; v < 3; v++) {
      const x = buf.readFloatLE(off) * SCALE;
      const y = buf.readFloatLE(off + 4) * SCALE;
      const z = buf.readFloatLE(off + 8) * SCALE;
      off += 12;
      const vi = t * 9 + v * 3;
      positions[vi] = x; positions[vi + 1] = y; positions[vi + 2] = z;
      normals[vi] = nx; normals[vi + 1] = ny; normals[vi + 2] = nz;
    }
    off += 2; // attribute byte count
  }
  return { positions, normals };
}

function parseAsciiStl(text) {
  const positions = [];
  const normals = [];
  const vertexRe = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
  const normalRe = /facet normal\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
  const facets = text.split(/facet\s+normal/).slice(1);
  for (const facet of facets) {
    const nm = facet.match(/\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/);
    const nx = parseFloat(nm[1]), ny = parseFloat(nm[2]), nz = parseFloat(nm[3]);
    const verts = [];
    let m;
    const vre = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
    while ((m = vre.exec(facet))) {
      verts.push(parseFloat(m[1]) * SCALE, parseFloat(m[2]) * SCALE, parseFloat(m[3]) * SCALE);
    }
    for (let v = 0; v < 3 && v * 3 < verts.length; v++) {
      positions.push(verts[v * 3], verts[v * 3 + 1], verts[v * 3 + 2]);
      normals.push(nx, ny, nz);
    }
  }
  return { positions: Float32Array.from(positions), normals: Float32Array.from(normals) };
}

function parseStl(buf) {
  if (buf.length >= 84) {
    const n = buf.readUInt32LE(80);
    if (84 + n * 50 === buf.length) {
      return parseBinaryStl(buf, n);
    }
  }
  return parseAsciiStl(buf.toString('utf8'));
}

// ── GLB 构建 ───────────────────────────────────────────────
function buildGlb(positions, normals) {
  const vertexCount = positions.length / 3;

  // position min/max
  let minPos = [Infinity, Infinity, Infinity];
  let maxPos = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = positions[i + k];
      if (v < minPos[k]) minPos[k] = v;
      if (v > maxPos[k]) maxPos[k] = v;
    }
  }

  const posBuf = Buffer.from(positions.buffer, positions.byteOffset, positions.byteLength);
  const nrmBuf = Buffer.from(normals.buffer, normals.byteOffset, normals.byteLength);

  function pad(b) { return b.byteLength % 4 ? Buffer.concat([b, Buffer.alloc(4 - (b.byteLength % 4))]) : b; }
  const posPadded = pad(posBuf);
  const nrmPadded = pad(nrmBuf);

  const binBuf = Buffer.concat([posPadded, nrmPadded]);
  const posBv = { buffer: 0, byteOffset: 0, byteLength: posBuf.byteLength };
  const nrmBv = { buffer: 0, byteOffset: posPadded.length, byteLength: nrmBuf.byteLength };

  const accessors = [
    { bufferView: 0, componentType: 5126, count: vertexCount, type: 'VEC3', min: minPos, max: maxPos },
    { bufferView: 1, componentType: 5126, count: vertexCount, type: 'VEC3' },
  ];

  const json = {
    asset: { version: '2.0', generator: 'stl2glb' },
    scene: 0,
    scenes: [{ name: 'Scene', nodes: [0] }],
    nodes: [{ name: 'StlModel', mesh: 0 }],
    meshes: [{
      name: 'StlMesh',
      primitives: [{
        attributes: { POSITION: 0, NORMAL: 1 },
        material: 0,
        mode: 4,
      }],
    }],
    materials: [{
      name: 'steel_gray',
      pbrMetallicRoughness: { baseColorFactor: [0.65, 0.65, 0.68, 1.0], metallicFactor: 0, roughnessFactor: 1 },
      doubleSided: true,
    }],
    accessors,
    bufferViews: [posBv, nrmBv],
    buffers: [{ byteLength: binBuf.length }],
  };

  const jsonStr = JSON.stringify(json);
  const jsonPadLen = (4 - (jsonStr.length % 4)) % 4;
  const jsonBuf = Buffer.from(jsonStr + ' '.repeat(jsonPadLen), 'utf8');

  const totalLen = 12 + 8 + jsonBuf.length + 8 + binBuf.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546C67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLen, 8);

  const jsonCH = Buffer.alloc(8);
  jsonCH.writeUInt32LE(jsonBuf.length, 0);
  jsonCH.writeUInt32LE(0x4E4F534A, 4);

  const binCH = Buffer.alloc(8);
  binCH.writeUInt32LE(binBuf.length, 0);
  binCH.writeUInt32LE(0x004E4942, 4);

  return Buffer.concat([header, jsonCH, jsonBuf, binCH, binBuf]);
}

// ── 主函数 ─────────────────────────────────────────────────
function main() {
  const t0 = Date.now();
  const buf = fs.readFileSync(inputPath);
  console.log('STL 读取完成:', (buf.length / 1024 / 1024).toFixed(1), 'MB');

  const { positions, normals } = parseStl(buf);
  const triCount = positions.length / 9;
  console.log('三角形数量:', triCount.toLocaleString());

  // 包围盒尺寸
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  console.log('包围盒尺寸 (x,y,z):', (maxX - minX).toFixed(3), (maxY - minY).toFixed(3), (maxZ - minZ).toFixed(3));

  const glb = buildGlb(positions, normals);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, glb);
  console.log('✅ 输出:', outputPath, '(' + (glb.length / 1024 / 1024).toFixed(2) + ' MB)');
  console.log('总耗时:', ((Date.now() - t0) / 1000).toFixed(1), 's');
}

main();
