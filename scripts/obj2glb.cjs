/**
 * 自定义 OBJ → GLB 转换器
 * 支持带颜色的多材质 OBJ（无贴图），大文件高效处理
 */
'use strict';

const fs = require('fs');
const readline = require('readline');
const path = require('path');

const objSrc = path.join(__dirname, '..', 'model.obj');
const mtlSrc = path.join(__dirname, '..', 'model.mtl');
const outPath = path.join(__dirname, '..', 'public', 'data', 'ROCK', 'model.glb');

// ── 解析 MTL ─────────────────────────────────────────────────
function parseMtl(mtlPath) {
  const materials = {};
  let current = null;
  if (!fs.existsSync(mtlPath)) return materials;
  const lines = fs.readFileSync(mtlPath, 'utf8').split('\n');
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('newmtl ')) {
      current = t.slice(7).trim();
      materials[current] = [0.5, 0.5, 0.5, 1.0];
    } else if (t.startsWith('Kd ') && current) {
      const p = t.split(/\s+/);
      materials[current] = [parseFloat(p[1]), parseFloat(p[2]), parseFloat(p[3]), 1.0];
    }
  }
  return materials;
}

// ── 主解析 ───────────────────────────────────────────────────
async function parseObj() {
  const materials = parseMtl(mtlSrc);

  const gPositions = []; // flat [x,y,z,...]
  const gNormals   = []; // flat [x,y,z,...]

  // per-group output
  const groups = [];
  let curGroup = null;
  let curMat = null;

  let vCache = {};
  let posData = [];
  let nrmData = [];
  let idxData = [];

  function flushGroup() {
    if (curGroup !== null && idxData.length > 0) {
      groups.push({
        name: curGroup,
        mat: curMat,
        pos: Float32Array.from(posData),
        nrm: Float32Array.from(nrmData),
        idx: Uint32Array.from(idxData)
      });
    }
    vCache = {};
    posData = [];
    nrmData = [];
    idxData = [];
  }

  const rl = readline.createInterface({ input: fs.createReadStream(objSrc) });

  for await (const raw of rl) {
    const line = raw.trim();
    if (!line || line[0] === '#') continue;

    if (line[0] === 'v' && line[1] === ' ') {
      const p = line.split(/\s+/);
      const x = parseFloat(p[1]);
      const y = parseFloat(p[2]);
      const z = parseFloat(p[3]);
      // OBJ is Z-up; convert to glTF Y-up: new_x=x, new_y=z, new_z=-y
      gPositions.push(isFinite(x) ? x : 0, isFinite(z) ? z : 0, isFinite(y) ? -y : 0);
    } else if (line[0] === 'v' && line[1] === 'n') {
      const p = line.split(/\s+/);
      const nx = parseFloat(p[1]);
      const ny = parseFloat(p[2]);
      const nz = parseFloat(p[3]);
      const ax = isFinite(nx) ? nx : 0;
      const ay = isFinite(ny) ? ny : 0;
      const az = isFinite(nz) ? nz : 0;
      const len = Math.sqrt(ax * ax + ay * ay + az * az);
      // Same axis swap for normals
      if (len > 0) gNormals.push(ax / len, az / len, -ay / len);
      else gNormals.push(0, 1, 0);
    } else if (line[0] === 'g' && (line[1] === ' ' || line[1] === '\t')) {
      flushGroup();
      curGroup = line.slice(2).trim();
    } else if (line[0] === 'o' && (line[1] === ' ' || line[1] === '\t')) {
      flushGroup();
      curGroup = line.slice(2).trim();
    } else if (line.startsWith('usemtl ')) {
      curMat = line.slice(7).trim();
    } else if (line[0] === 'f' && (line[1] === ' ' || line[1] === '\t')) {
      if (curGroup === null) curGroup = 'default';
      const parts = line.slice(2).trim().split(/\s+/);
      const verts = [];
      for (const part of parts) {
        const segs = part.split('/');
        let pi = parseInt(segs[0], 10);
        let ni = segs.length >= 3 ? parseInt(segs[2], 10) : 0;
        if (pi < 0) pi = (gPositions.length / 3) + pi + 1;
        if (ni < 0) ni = (gNormals.length / 3) + ni + 1;
        pi--; // to 0-indexed
        ni--;
        const key = pi + '/' + ni;
        if (vCache[key] === undefined) {
          vCache[key] = posData.length / 3;
          posData.push(gPositions[pi * 3], gPositions[pi * 3 + 1], gPositions[pi * 3 + 2]);
          if (ni >= 0 && ni * 3 + 2 < gNormals.length) {
            nrmData.push(gNormals[ni * 3], gNormals[ni * 3 + 1], gNormals[ni * 3 + 2]);
          } else {
            nrmData.push(0, 0, 1);
          }
        }
        verts.push(vCache[key]);
      }
      // fan triangulation
      for (let i = 1; i < verts.length - 1; i++) {
        idxData.push(verts[0], verts[i], verts[i + 1]);
      }
    }
  }
  flushGroup();

  // Compute bounding box centroid from all raw positions
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < gPositions.length; i += 3) {
    const x = gPositions[i], y = gPositions[i + 1], z = gPositions[i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  console.log('包围盒中心:', cx.toFixed(2), cy.toFixed(2), cz.toFixed(2));

  // Apply centering
  for (const g of groups) {
    for (let i = 0; i < g.pos.length; i += 3) {
      g.pos[i]     -= cx;
      g.pos[i + 1] -= cy;
      g.pos[i + 2] -= cz;
    }
  }

  return { groups, materials };
}

// ── GLB 构建 ─────────────────────────────────────────────────
function buildGlb(groups, materials) {
  const bvList   = []; // bufferView descriptors
  const accList  = []; // accessor descriptors
  const matList  = []; // material descriptors
  const primList = []; // mesh primitive descriptors
  const matIdx   = {}; // mat name -> index

  const bufChunks = [];
  let bvByteOffset = 0;

  function addBufView(buf) {
    const idx = bvList.length;
    bvList.push({ buffer: 0, byteOffset: bvByteOffset, byteLength: buf.byteLength });
    const padded = buf.byteLength % 4 ? Buffer.concat([buf, Buffer.alloc(4 - buf.byteLength % 4)]) : buf;
    bufChunks.push(padded);
    bvByteOffset += padded.length;
    return idx;
  }

  for (const g of groups) {
    if (!g.idx || g.idx.length === 0) continue;

    const useU32 = g.pos.length / 3 > 65534;
    const idxTyped = useU32 ? g.idx : Uint16Array.from(g.idx);
    const idxBuf = Buffer.from(idxTyped.buffer, idxTyped.byteOffset, idxTyped.byteLength);
    const posBuf = Buffer.from(g.pos.buffer, g.pos.byteOffset, g.pos.byteLength);
    const nrmBuf = Buffer.from(g.nrm.buffer, g.nrm.byteOffset, g.nrm.byteLength);

    // Compute min/max for positions
    let minPos = [Infinity, Infinity, Infinity];
    let maxPos = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < g.pos.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        const v = g.pos[i + k];
        if (v < minPos[k]) minPos[k] = v;
        if (v > maxPos[k]) maxPos[k] = v;
      }
    }

    const idxBvIdx = addBufView(idxBuf);
    const posBvIdx = addBufView(posBuf);
    const nrmBvIdx = addBufView(nrmBuf);

    const idxAccIdx = accList.length;
    accList.push({ bufferView: idxBvIdx, byteOffset: 0, componentType: useU32 ? 5125 : 5123, count: g.idx.length, type: 'SCALAR' });
    const posAccIdx = accList.length;
    accList.push({ bufferView: posBvIdx, byteOffset: 0, componentType: 5126, count: g.pos.length / 3, type: 'VEC3', min: minPos, max: maxPos });
    const nrmAccIdx = accList.length;
    accList.push({ bufferView: nrmBvIdx, byteOffset: 0, componentType: 5126, count: g.nrm.length / 3, type: 'VEC3' });

    // Material
    let mIdx = matIdx[g.mat];
    if (mIdx === undefined) {
      mIdx = matList.length;
      matIdx[g.mat] = mIdx;
      // Try exact match, then strip 'DT' prefix (OBJ uses DTMtl_X, MTL defines TMtl_X)
      const altName = g.mat && g.mat.startsWith('D') ? g.mat.slice(1) : null;
      const col = (materials && (materials[g.mat] || materials[altName]))
                  ? (materials[g.mat] || materials[altName])
                  : [0.5, 0.5, 0.5, 1.0];
      matList.push({
        name: g.mat || 'default',
        pbrMetallicRoughness: { baseColorFactor: col, metallicFactor: 0, roughnessFactor: 1 },
        alphaMode: 'OPAQUE',
        doubleSided: false
      });
    }

    primList.push({ attributes: { POSITION: posAccIdx, NORMAL: nrmAccIdx }, indices: idxAccIdx, material: mIdx, mode: 4 });
  }

  const totalBinLen = bvByteOffset;
  const binBuf = Buffer.concat(bufChunks);

  const json = {
    asset: { version: '2.0', generator: 'custom-obj2glb' },
    scene: 0,
    scenes: [{ name: 'Scene', nodes: [0] }],
    nodes: [{ name: 'RockModel', mesh: 0 }],
    meshes: [{ name: 'RockMesh', primitives: primList }],
    materials: matList,
    accessors: accList,
    bufferViews: bvList,
    buffers: [{ byteLength: totalBinLen }]
  };

  const jsonStr = JSON.stringify(json);
  const jsonPadLen = (4 - (jsonStr.length % 4)) % 4;
  const jsonBuf = Buffer.from(jsonStr + ' '.repeat(jsonPadLen), 'utf8');

  const totalLen = 12 + 8 + jsonBuf.length + 8 + binBuf.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546C67, 0); // 'glTF'
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLen, 8);

  const jsonCH = Buffer.alloc(8);
  jsonCH.writeUInt32LE(jsonBuf.length, 0);
  jsonCH.writeUInt32LE(0x4E4F534A, 4); // 'JSON'

  const binCH = Buffer.alloc(8);
  binCH.writeUInt32LE(binBuf.length, 0);
  binCH.writeUInt32LE(0x004E4942, 4); // 'BIN\0'

  return Buffer.concat([header, jsonCH, jsonBuf, binCH, binBuf]);
}

// ── 主函数 ──────────────────────────────────────────────────
async function main() {
  console.log('解析 OBJ...');
  const { groups, materials } = await parseObj();
  console.log('解析完成:', groups.length, '个几何组');
  groups.forEach(g => {
    console.log('  ' + g.name + ': ' + (g.idx.length / 3) + ' 个三角面, 材质: ' + g.mat);
  });

  console.log('构建 GLB...');
  const glb = buildGlb(groups, materials);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, glb);
  console.log('✅ 输出:', outPath, '(' + (glb.length / 1024 / 1024).toFixed(2) + ' MB)');
}

main().catch(e => { console.error('❌', e.message); console.error(e.stack); process.exit(1); });
