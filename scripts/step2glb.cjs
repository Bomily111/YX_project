/**
 * STEP → GLB 转换器（基于 occt-import-js / OpenCASCADE WASM）
 *
 * 用法:
 *   node --max-old-space-size=8192 scripts/step2glb.cjs \
 *     --input <step路径> --output public/data/jumbo/jumbo_solid.glb \
 *     [--linear-deflection 0.0005] [--angular-deflection 0.02] [--scale 0.001]
 *
 * 说明:
 *   - 网格化用 bounding_box_ratio（按包围盒自动缩放弦高），避免 absolute_value 在 mm 单位下
 *     把 0.005 当成 5 微米导致网格爆炸/内存耗尽
 *   - 输出默认 mm，用 --scale 0.001 转米
 *   - AP214 的零件颜色写入材质；AP203 无色则回落默认钢灰
 */
'use strict';

const fs = require('fs');
const path = require('path');

// ── 命令行参数 ──────────────────────────────────────────────
function parseArgv() {
  const a = process.argv.slice(2);
  const o = { input: null, output: null, linearDeflection: 0.001, angularDeflection: 0.5, scale: 0.001 };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--input') o.input = a[++i];
    else if (a[i] === '--output') o.output = a[++i];
    else if (a[i] === '--linear-deflection') o.linearDeflection = parseFloat(a[++i]);
    else if (a[i] === '--angular-deflection') o.angularDeflection = parseFloat(a[++i]);
    else if (a[i] === '--scale') o.scale = parseFloat(a[++i]);
  }
  return o;
}

const opts = parseArgv();
if (!opts.input || !opts.output) {
  console.error('用法: node scripts/step2glb.cjs --input <step> --output <glb> [--linear-deflection 0.0005] [--angular-deflection 0.02] [--scale 0.001]');
  process.exit(1);
}
const projectRoot = path.join(__dirname, '..');
const inputPath = path.resolve(projectRoot, opts.input);
const outputPath = path.resolve(projectRoot, opts.output);
const SCALE = opts.scale;

// ── 辅助 ───────────────────────────────────────────────────
function toFloat32Array(arr) {
  if (arr instanceof Float32Array) return Float32Array.from(arr);
  return Float32Array.from(arr);
}
function toUint32Array(arr) {
  if (arr instanceof Uint32Array) return Uint32Array.from(arr);
  return Uint32Array.from(arr);
}
function normalizeColor(c) {
  // 兼容 0~1 与 0~255 两种色值，统一为 0~1
  let r = Number(c[0]) || 0, g = Number(c[1]) || 0, b = Number(c[2]) || 0;
  if (r > 1 || g > 1 || b > 1) { r /= 255; g /= 255; b /= 255; }
  return [Math.max(0, Math.min(1, r)), Math.max(0, Math.min(1, g)), Math.max(0, Math.min(1, b)), 1.0];
}

// ── GLB 构建 ───────────────────────────────────────────────
function buildGlb(meshes) {
  const bvList = [];
  const accList = [];
  const matList = [];
  const primList = [];
  const matMap = {};
  const bufChunks = [];
  let bvByteOffset = 0;

  function addBufView(buf) {
    const idx = bvList.length;
    bvList.push({ buffer: 0, byteOffset: bvByteOffset, byteLength: buf.byteLength });
    const padded = buf.byteLength % 4 ? Buffer.concat([buf, Buffer.alloc(4 - (buf.byteLength % 4))]) : buf;
    bufChunks.push(padded);
    bvByteOffset += padded.length;
    return idx;
  }

  let triCount = 0;

  for (const mesh of meshes) {
    if (!mesh.attributes || !mesh.attributes.position || !mesh.index) continue;
    const posArr = mesh.attributes.position.array;
    const idxArr = mesh.index.array;
    if (!posArr || !idxArr || posArr.length === 0 || idxArr.length === 0) continue;

    const pos = toFloat32Array(posArr);
    const idx = toUint32Array(idxArr);
    const nrm = mesh.attributes.normal && mesh.attributes.normal.array && mesh.attributes.normal.array.length
      ? toFloat32Array(mesh.attributes.normal.array)
      : null;

    // 单位缩放（mm → m）
    if (SCALE !== 1) {
      for (let i = 0; i < pos.length; i++) pos[i] *= SCALE;
    }

    // 颜色
    let color = [0.6, 0.6, 0.65, 1.0];
    if (mesh.color && mesh.color.length >= 3) {
      color = normalizeColor(mesh.color);
    }
    const colorKey = color[0].toFixed(4) + ',' + color[1].toFixed(4) + ',' + color[2].toFixed(4);
    let mIdx = matMap[colorKey];
    if (mIdx === undefined) {
      mIdx = matList.length;
      matMap[colorKey] = mIdx;
      matList.push({
        name: 'mat_' + mIdx,
        pbrMetallicRoughness: { baseColorFactor: color, metallicFactor: 0, roughnessFactor: 1 },
        doubleSided: false,
      });
    }

    const posBuf = Buffer.from(pos.buffer, pos.byteOffset, pos.byteLength);
    const idxBuf = Buffer.from(idx.buffer, idx.byteOffset, idx.byteLength);
    const nrmBuf = nrm ? Buffer.from(nrm.buffer, nrm.byteOffset, nrm.byteLength) : null;

    // position min/max
    let minPos = [Infinity, Infinity, Infinity];
    let maxPos = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < pos.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        const v = pos[i + k];
        if (v < minPos[k]) minPos[k] = v;
        if (v > maxPos[k]) maxPos[k] = v;
      }
    }

    const idxBvIdx = addBufView(idxBuf);
    const posBvIdx = addBufView(posBuf);
    const nrmBvIdx = nrm ? addBufView(nrmBuf) : -1;

    const idxAccIdx = accList.length;
    accList.push({ bufferView: idxBvIdx, componentType: 5125, count: idx.length, type: 'SCALAR' });
    const posAccIdx = accList.length;
    accList.push({ bufferView: posBvIdx, componentType: 5126, count: pos.length / 3, type: 'VEC3', min: minPos, max: maxPos });

    const attributes = { POSITION: posAccIdx };
    if (nrm && nrmBvIdx >= 0) {
      const nrmAccIdx = accList.length;
      accList.push({ bufferView: nrmBvIdx, componentType: 5126, count: nrm.length / 3, type: 'VEC3' });
      attributes.NORMAL = nrmAccIdx;
    }

    primList.push({ attributes, indices: idxAccIdx, material: mIdx, mode: 4 });
    triCount += idx.length / 3;
  }

  const totalBinLen = bvByteOffset;
  const binBuf = Buffer.concat(bufChunks);

  const json = {
    asset: { version: '2.0', generator: 'step2glb' },
    scene: 0,
    scenes: [{ name: 'Scene', nodes: [0] }],
    nodes: [{ name: 'StepModel', mesh: 0 }],
    meshes: [{ name: 'StepMesh', primitives: primList }],
    materials: matList,
    accessors: accList,
    bufferViews: bvList,
    buffers: [{ byteLength: totalBinLen }],
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

  return { glb: Buffer.concat([header, jsonCH, jsonBuf, binCH, binBuf]), triCount, primCount: primList.length, matCount: matList.length };
}

// ── 主函数 ─────────────────────────────────────────────────
const occtimportjs = require('occt-import-js')();

async function main() {
  const t0 = Date.now();
  const occt = await occtimportjs;
  console.log('OpenCASCADE 库加载完成:', ((Date.now() - t0) / 1000).toFixed(1), 's');

  const buf = fs.readFileSync(inputPath);
  console.log('STEP 读取完成:', (buf.length / 1024 / 1024).toFixed(1), 'MB');

  const t1 = Date.now();
  const result = occt.ReadStepFile(buf, {
    linearDeflectionType: 'bounding_box_ratio',
    linearDeflection: opts.linearDeflection,
    angularDeflection: opts.angularDeflection,
  });
  console.log('STEP 解析+网格化完成:', ((Date.now() - t1) / 1000).toFixed(1), 's');

  if (!result.success) {
    console.error('❌ STEP 解析失败');
    process.exit(1);
  }

  console.log('mesh 数量:', result.meshes.length);
  const withColor = result.meshes.filter((m) => m.color && m.color.length >= 3).length;
  console.log('带颜色的 mesh:', withColor, '/', result.meshes.length);

  const t2 = Date.now();
  const { glb, triCount, primCount, matCount } = buildGlb(result.meshes);
  console.log('GLB 构建完成:', ((Date.now() - t2) / 1000).toFixed(1), 's');
  console.log('三角形数量:', triCount.toLocaleString());
  console.log('primitive 数:', primCount, '| 材质数:', matCount);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, glb);
  console.log('✅ 输出:', outputPath, '(' + (glb.length / 1024 / 1024).toFixed(2) + ' MB)');
  console.log('总耗时:', ((Date.now() - t0) / 1000).toFixed(1), 's');
}

main().catch((e) => {
  console.error('❌', e.message);
  console.error(e.stack);
  process.exit(1);
});
