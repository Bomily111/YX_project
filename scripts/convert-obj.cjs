/**
 * 将项目根目录的 model.obj + model.mtl 转换为 GLB
 * 1. 预处理：修复 NaN 法线，将模型坐标居中到原点
 * 2. 输出到 public/data/ROCK/model.glb
 */
'use strict';

const obj2gltf = require('obj2gltf');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const projectRoot = path.resolve(__dirname, '..');
const objSrc    = path.join(projectRoot, 'model.obj');
const mtlSrc    = path.join(projectRoot, 'model.mtl');
const mtlAlias  = path.join(projectRoot, 'DemoMeshDiff.mtl');
const tempObj   = path.join(projectRoot, 'model_centered.obj');
const outPath   = path.join(projectRoot, 'public', 'data', 'ROCK', 'model.glb');

fs.mkdirSync(path.dirname(outPath), { recursive: true });

// ── Step 1: 计算包围盒以求重心 ────────────────────────────
console.log('Step 1: 扫描模型包围盒...');
let minX = Infinity, maxX = -Infinity;
let minY = Infinity, maxY = -Infinity;
let minZ = Infinity, maxZ = -Infinity;

function firstPass() {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: fs.createReadStream(objSrc) });
    rl.on('line', (line) => {
      if (line.startsWith('v ')) {
        const parts = line.split(/\s+/);
        const x = parseFloat(parts[1]);
        const y = parseFloat(parts[2]);
        const z = parseFloat(parts[3]);
        if (isFinite(x) && isFinite(y) && isFinite(z)) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
          if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
        }
      }
    });
    rl.on('close', resolve);
    rl.on('error', reject);
  });
}

// ── Step 2: 生成居中后的 OBJ ──────────────────────────────
function secondPass(cx, cy, cz) {
  return new Promise((resolve, reject) => {
    console.log(`Step 2: 生成居中 OBJ，偏移量 (${cx.toFixed(2)}, ${cy.toFixed(2)}, ${cz.toFixed(2)})...`);
    const rl = readline.createInterface({ input: fs.createReadStream(objSrc) });
    const out = fs.createWriteStream(tempObj);

    rl.on('line', (line) => {
      if (line.startsWith('v ') && !line.startsWith('vn ') && !line.startsWith('vt ')) {
        // 顶点坐标居中
        const parts = line.split(/\s+/);
        const x = parseFloat(parts[1]) - cx;
        const y = parseFloat(parts[2]) - cy;
        const z = parseFloat(parts[3]) - cz;
        out.write(`v ${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}\n`);
      } else if (line.includes('-nan(ind)')) {
        // 修复 NaN 法线
        out.write(line.replace(/-nan\(ind\)/g, '0.000000') + '\n');
      } else {
        out.write(line + '\n');
      }
    });

    rl.on('close', () => { out.end(); resolve(); });
    rl.on('error', reject);
    out.on('error', reject);
  });
}

async function main() {
  await firstPass();

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  console.log(`  包围盒 X: [${minX.toFixed(2)}, ${maxX.toFixed(2)}], 中心: ${cx.toFixed(2)}`);
  console.log(`  包围盒 Y: [${minY.toFixed(2)}, ${maxY.toFixed(2)}], 中心: ${cy.toFixed(2)}`);
  console.log(`  包围盒 Z: [${minZ.toFixed(2)}, ${maxZ.toFixed(2)}], 中心: ${cz.toFixed(2)}`);

  await secondPass(cx, cy, cz);

  // 提供 MTL 文件（OBJ 引用 DemoMeshDiff.mtl）
  let copiedMtl = false;
  if (!fs.existsSync(mtlAlias) && fs.existsSync(mtlSrc)) {
    fs.copyFileSync(mtlSrc, mtlAlias);
    copiedMtl = true;
  }

  console.log('Step 3: 转换 OBJ → GLB ...');
  try {
    const glb = await obj2gltf(tempObj, { binary: true });
    fs.writeFileSync(outPath, glb);
    const sizeMB = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
    console.log(`✅ 转换完成: ${outPath} (${sizeMB} MB)`);
    console.log(`📌 模型中心偏移（供参考）: cx=${cx.toFixed(2)}, cy=${cy.toFixed(2)}, cz=${cz.toFixed(2)}`);
  } finally {
    if (fs.existsSync(tempObj)) fs.unlinkSync(tempObj);
    if (copiedMtl && fs.existsSync(mtlAlias)) fs.unlinkSync(mtlAlias);
  }
}

main().catch((err) => { console.error('❌ 失败:', err); process.exit(1); });
