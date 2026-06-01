/**
 * TEM 体数据构建脚本 (极坐标几何修正版)
 *
 * 几何模型:
 *   原点 = 掌子面中心
 *   Y 轴 = 隧道掘进方向 (进入岩体)
 *   X 轴 = 水平左右方向
 *   Z 轴 = 竖直方向
 *
 *   4 个扫描剖面平面 (包含 Y 轴, 由掌子面 XZ 方向角 φ 定义):
 *     线1: φ = +30° (水平斜向上)
 *     线2: φ =   0° (水平)
 *     线3: φ = -30° (水平斜向下)
 *     线4: φ = +90° (中央垂向)
 *
 *   每个剖面内 9 条扫描轴线 (组号 1-9, 角度 θ = 30°~150°):
 *     x = r·cos(θ)·cos(φ)
 *     y = r·sin(θ)
 *     z = r·cos(θ)·sin(φ)
 *
 * 用法: node scripts/build_tem_volume.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jpeg from 'jpeg-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'public', 'data', 'TEM', '1');
const OUT_DIR = DATA_DIR;

// ── 几何常量 ───────────────────────────────────────────────────

const DEG = Math.PI / 180;

// 4 个剖面平面的方向角 φ (在掌子面 XZ 平面上的角度, 度)
const PHI_DEG = [30, 0, -30, 90];

// 9 条扫描轴线的角度 θ (剖面平面内, θ=90° = 正前方 Y 轴)
const THETA_DEG = [30, 45, 60, 75, 90, 105, 120, 135, 150];

// ── 网格参数 ───────────────────────────────────────────────────

const NX = 200, NY = 128, NZ = 200;
const X_MIN = -55, X_MAX = 55;
const Y_MIN = -5,  Y_MAX = 65;
const Z_MIN = -55, Z_MAX = 55;

const DX = (X_MAX - X_MIN) / (NX - 1);
const DY = (Y_MAX - Y_MIN) / (NY - 1);
const DZ = (Z_MAX - Z_MIN) / (NZ - 1);

// ── IDW 插值参数 ───────────────────────────────────────────────

const IDW_POWER = 3;
const SEARCH_RADIUS = 20;
const SEARCH_RADIUS2 = SEARCH_RADIUS * SEARCH_RADIUS;
const MIN_NEIGHBORS = 3;
const MAX_NEIGHBORS = 50;
const CELL_SIZE = SEARCH_RADIUS;

// ── 数据解析 ───────────────────────────────────────────────────

function parseDatFile(text) {
  const groups = new Map();
  for (const line of text.trim().split(/\r?\n/)) {
    const parts = line.split('\t').map(Number);
    const g = parts[0];
    const r = parts[1];
    const v = parts[2];
    if (!Number.isFinite(r) || !Number.isFinite(v)) continue;
    if (!groups.has(g)) groups.set(g, { radii: [], values: [] });
    groups.get(g).radii.push(r);
    groups.get(g).values.push(v);
  }
  // 每组内按径向距离排序
  for (const [, d] of groups) {
    const pairs = d.radii.map((r, i) => ({ r, v: d.values[i] }))
      .sort((a, b) => a.r - b.r);
    d.radii = pairs.map(p => p.r);
    d.values = pairs.map(p => p.v);
  }
  return groups;
}

// ── 极坐标 → 笛卡尔坐标 ──────────────────────────────────────

function polarToCartesian(phiDeg, thetaDeg, r) {
  const phi = phiDeg * DEG;
  const theta = thetaDeg * DEG;
  const ct = Math.cos(theta);
  return {
    x: r * ct * Math.cos(phi),
    y: r * Math.sin(theta),
    z: r * ct * Math.sin(phi),
  };
}

// ── 主流程 ─────────────────────────────────────────────────────

console.log('=== TEM 体数据构建 (极坐标几何修正版) ===\n');

// 1. 读取数据 & 极坐标转换
console.log('Step 1: 读取 .dat 文件并转换为笛卡尔坐标...');

const allPoints = { x: [], y: [], z: [], v: [] };
let totalRaw = 0;

for (let f = 0; f < 4; f++) {
  const filename = `线${f + 1}.dat`;
  const text = fs.readFileSync(path.join(DATA_DIR, filename), 'utf8');
  const groups = parseDatFile(text);
  const phi = PHI_DEG[f];

  let n = 0;
  for (let g = 1; g <= 9; g++) {
    const theta = THETA_DEG[g - 1];
    const data = groups.get(g);
    if (!data) continue;
    for (let i = 0; i < data.radii.length; i++) {
      const { x, y, z } = polarToCartesian(phi, theta, data.radii[i]);
      allPoints.x.push(x);
      allPoints.y.push(y);
      allPoints.z.push(z);
      allPoints.v.push(data.values[i]);
      n++;
    }
  }
  console.log(`  ${filename}: φ=${phi}° → ${n} 个数据点`);
  totalRaw += n;
}

const N = totalRaw;
console.log(`  总计: ${N} 个数据点`);

// 验证数据点都在网格范围内
let xMinP = Infinity, xMaxP = -Infinity;
let yMinP = Infinity, yMaxP = -Infinity;
let zMinP = Infinity, zMaxP = -Infinity;
let vMinP = Infinity, vMaxP = -Infinity;
for (let i = 0; i < N; i++) {
  xMinP = Math.min(xMinP, allPoints.x[i]);
  xMaxP = Math.max(xMaxP, allPoints.x[i]);
  yMinP = Math.min(yMinP, allPoints.y[i]);
  yMaxP = Math.max(yMaxP, allPoints.y[i]);
  zMinP = Math.min(zMinP, allPoints.z[i]);
  zMaxP = Math.max(zMaxP, allPoints.z[i]);
  vMinP = Math.min(vMinP, allPoints.v[i]);
  vMaxP = Math.max(vMaxP, allPoints.v[i]);
}
console.log(`  数据 X 范围: [${xMinP.toFixed(1)}, ${xMaxP.toFixed(1)}]`);
console.log(`  数据 Y 范围: [${yMinP.toFixed(1)}, ${yMaxP.toFixed(1)}]`);
console.log(`  数据 Z 范围: [${zMinP.toFixed(1)}, ${zMaxP.toFixed(1)}]`);
console.log(`  电阻率范围:  [${vMinP.toFixed(1)}, ${vMaxP.toFixed(1)}]\n`);

// 2. 空间哈希索引
console.log('Step 2: 构建空间哈希索引...');

const HASH_NX = Math.ceil((X_MAX - X_MIN) / CELL_SIZE) + 1;
const HASH_NY = Math.ceil((Y_MAX - Y_MIN) / CELL_SIZE) + 1;
const HASH_NZ = Math.ceil((Z_MAX - Z_MIN) / CELL_SIZE) + 1;

function cellCoords(px, py, pz) {
  return {
    cx: Math.floor((px - X_MIN) / CELL_SIZE),
    cy: Math.floor((py - Y_MIN) / CELL_SIZE),
    cz: Math.floor((pz - Z_MIN) / CELL_SIZE),
  };
}

// 为每个数据点分配单元, 并存储单元内的索引列表
const cellPointLists = new Map(); // "cx,cy,cz" → [pointIndex, ...]

for (let i = 0; i < N; i++) {
  const { cx, cy, cz } = cellCoords(allPoints.x[i], allPoints.y[i], allPoints.z[i]);
  const key = `${cx},${cy},${cz}`;
  if (!cellPointLists.has(key)) cellPointLists.set(key, []);
  cellPointLists.get(key).push(i);
}

console.log(`  哈希网格: ${HASH_NX}×${HASH_NY}×${HASH_NZ} = ${HASH_NX*HASH_NY*HASH_NZ} 个单元`);
console.log(`  占用单元: ${cellPointLists.size}\n`);

// 预计算 — 为快速查找准备邻居单元偏移列表
const neighborOffsets = [];
for (let dcx = -1; dcx <= 1; dcx++) {
  for (let dcy = -1; dcy <= 1; dcy++) {
    for (let dcz = -1; dcz <= 1; dcz++) {
      neighborOffsets.push([dcx, dcy, dcz]);
    }
  }
}

// 3. IDW 插值
console.log('Step 3: IDW 插值...');

const volume = new Float32Array(NX * NY * NZ);
let volMin = Infinity, volMax = -Infinity;
let emptyVoxels = 0;
const totalVoxels = NX * NY * NZ;

// 预分配邻居数组避免重复分配
const neighborDists = new Float64Array(MAX_NEIGHBORS);
const neighborVals = new Float64Array(MAX_NEIGHBORS);

let lastReport = 0;
for (let xi = 0; xi < NX; xi++) {
  const cx_v = X_MIN + xi * DX;

  const pct = Math.round((xi / NX) * 100);
  if (pct >= lastReport + 10 || xi === NX - 1) {
    console.log(`  ${pct}% (xi=${xi}/${NX})`);
    lastReport = pct;
  }

  for (let yi = 0; yi < NY; yi++) {
    const cy_v = Y_MIN + yi * DY;

    for (let zi = 0; zi < NZ; zi++) {
      const cz_v = Z_MIN + zi * DZ;
      const { cx, cy, cz } = cellCoords(cx_v, cy_v, cz_v);

      // 收集邻近数据点
      let nCount = 0;

      for (let o = 0; o < 27; o++) {
        const ncx = cx + neighborOffsets[o][0];
        const ncy = cy + neighborOffsets[o][1];
        const ncz = cz + neighborOffsets[o][2];

        const indices = cellPointLists.get(`${ncx},${ncy},${ncz}`);
        if (!indices) continue;

        for (let j = 0; j < indices.length; j++) {
          const pi = indices[j];
          const dx = allPoints.x[pi] - cx_v;
          const dy = allPoints.y[pi] - cy_v;
          const dz = allPoints.z[pi] - cz_v;
          const d2 = dx * dx + dy * dy + dz * dz;

          if (d2 < SEARCH_RADIUS2) {
            const d = Math.sqrt(d2);
            if (d < 0.001) {
              // 精确重合 — 直接使用该值
              neighborDists[0] = 0;
              neighborVals[0] = allPoints.v[pi];
              nCount = 1;
              o = 27; // 跳出外层循环
              break;
            }
            if (nCount < MAX_NEIGHBORS) {
              neighborDists[nCount] = d;
              neighborVals[nCount] = allPoints.v[pi];
              nCount++;
            }
          }
        }
      }

      // IDW 计算
      let value;
      if (nCount < MIN_NEIGHBORS) {
        value = 0;
        emptyVoxels++;
      } else {
        let wSum = 0, vwSum = 0;
        for (let k = 0; k < nCount; k++) {
          const w = 1 / Math.pow(neighborDists[k], IDW_POWER);
          wSum += w;
          vwSum += w * neighborVals[k];
        }
        value = vwSum / wSum;
      }

      const idx = xi * NY * NZ + yi * NZ + zi;
      volume[idx] = value;

      if (value > 0) {
        volMin = Math.min(volMin, value);
        volMax = Math.max(volMax, value);
      }
    }
  }
}

console.log(`\n  IDW 空体素: ${((emptyVoxels / totalVoxels) * 100).toFixed(1)}% (${emptyVoxels}/${totalVoxels})`);
console.log(`  IDW 值范围: [${volMin.toFixed(1)}, ${volMax.toFixed(1)}]`);

// 3.5 扇形区域掩码 — 裁剪矩形网格中的空白角落
console.log('\nStep 3.5: 应用扇形区域掩码...');

const FAN_ANGLE_MIN = Math.sin(30 * DEG); // sin(30°) = 0.5, 严格匹配扫描角度
const PLANE_DIST_MAX = 5; // m, 只保留紧贴剖面平面的薄层, 各面之间留清晰间隙
// 4个剖面平面的法向量距离系数: |z·cos(φ) - x·sin(φ)|
const PLANE_PARAMS = [
  { c: Math.cos(30 * DEG), s: Math.sin(30 * DEG) },  // φ=30°
  { c: 1, s: 0 },                                      // φ=0°
  { c: Math.cos(-30 * DEG), s: Math.sin(-30 * DEG) }, // φ=-30°
  { c: 0, s: 1 },                                      // φ=90°
];

let maskedCount = 0;
for (let xi = 0; xi < NX; xi++) {
  const cx_v = X_MIN + xi * DX;
  for (let yi = 0; yi < NY; yi++) {
    const cy_v = Y_MIN + yi * DY;
    for (let zi = 0; zi < NZ; zi++) {
      const idx = xi * NY * NZ + yi * NZ + zi;
      const val = volume[idx];
      if (val <= 0) continue;

      const cz_v = Z_MIN + zi * DZ;
      const r = Math.sqrt(cx_v * cx_v + cy_v * cy_v + cz_v * cz_v);
      let inside = false;

      if (r < 0.5) {
        inside = true;
      } else {
        const sinTheta = cy_v / r;
        if (sinTheta >= FAN_ANGLE_MIN) {
          let minDist = Infinity;
          for (let p = 0; p < 4; p++) {
            const dist = Math.abs(cz_v * PLANE_PARAMS[p].c - cx_v * PLANE_PARAMS[p].s);
            if (dist < minDist) minDist = dist;
          }
          if (minDist <= PLANE_DIST_MAX) inside = true;
        }
      }

      if (!inside) {
        volume[idx] = 0;
        maskedCount++;
      }
    }
  }
}

// 重新统计有效值范围
volMin = Infinity;
volMax = -Infinity;
let validVoxels = 0;
for (let i = 0; i < volume.length; i++) {
  if (volume[i] > 0) {
    volMin = Math.min(volMin, volume[i]);
    volMax = Math.max(volMax, volume[i]);
    validVoxels++;
  }
}
const finalEmpty = totalVoxels - validVoxels;
console.log(`  掩码移除: ${maskedCount} 个体素`);
console.log(`  最终空体素: ${((finalEmpty / totalVoxels) * 100).toFixed(1)}% (${finalEmpty}/${totalVoxels})`);
console.log(`  最终值范围: [${volMin.toFixed(1)}, ${volMax.toFixed(1)}]\n`);

// 4. 生成 JPG 精灵图
console.log('Step 4: 生成 JPG 精灵图...');

// JPG 归一化范围固定为 550-700, 匹配色标范围
const JPG_VMIN = 550;
const JPG_VMAX = 700;
const JPG_RANGE = JPG_VMAX - JPG_VMIN;

const TILES_X = Math.ceil(Math.sqrt(NZ));
const TILES_Y = Math.ceil(NZ / TILES_X);
const IMG_W = TILES_X * NX;
const IMG_H = TILES_Y * NY;

console.log(`  切片=${NZ}, 瓦片=${TILES_X}×${TILES_Y}, 图片=${IMG_W}×${IMG_H}`);

const rawPixels = Buffer.alloc(IMG_W * IMG_H * 4, 0); // RGBA 全黑

for (let zi = 0; zi < NZ; zi++) {
  const tx = zi % TILES_X;
  const ty = Math.floor(zi / TILES_X);
  const ox = tx * NX;
  const oy = ty * NY;

  for (let yi = 0; yi < NY; yi++) {
    for (let xi = 0; xi < NX; xi++) {
      const vi = xi * NY * NZ + yi * NZ + zi;
      const val = volume[vi];
      if (val <= 0) continue; // 空体素保持 RGBA(0,0,0,0)

      // 钳制到 [550, 700] 再归一化
      const clamped = val < JPG_VMIN ? JPG_VMIN : (val > JPG_VMAX ? JPG_VMAX : val);
      const norm = Math.round(((clamped - JPG_VMIN) / JPG_RANGE) * 255);
      const px = (oy + yi) * IMG_W + (ox + xi);
      const off = px * 4;
      rawPixels[off]     = norm;
      rawPixels[off + 1] = norm;
      rawPixels[off + 2] = norm;
      rawPixels[off + 3] = 255;
    }
  }
}

const jpgData = jpeg.encode({
  data: rawPixels,
  width: IMG_W,
  height: IMG_H,
}, 92);

const jpgPath = path.join(OUT_DIR, 'tem_3d.jpg');
fs.writeFileSync(jpgPath, jpgData.data);
console.log(`  JPG: ${jpgPath} (${(jpgData.data.length / 1024).toFixed(0)} KB)\n`);

// 5. 生成 JSON 配置
console.log('Step 5: 生成 JSON 配置...');

// 色标: 550-700, 步长10, 蓝→白→红
const CMAP_VMIN = 550, CMAP_VMAX = 700, CMAP_STEP = 10;
const cmapStops = [];
const cmapN = (CMAP_VMAX - CMAP_VMIN) / CMAP_STEP;
for (let i = 0; i <= cmapN; i++) {
  const t = i / cmapN;
  let r, g, b;
  if (t < 0.5) {
    const s = t * 2;
    r = Math.round(59 + (220 - 59) * s);
    g = Math.round(76 + (220 - 76) * s);
    b = Math.round(192 + (220 - 192) * s);
  } else {
    const s = (t - 0.5) * 2;
    r = Math.round(220 + (181 - 220) * s);
    g = Math.round(220 + (11 - 220) * s);
    b = Math.round(220 + (39 - 220) * s);
  }
  cmapStops.push({ position: Math.round(t * 10000) / 10000, colour: `rgba(${r},${g},${b},1.0)` });
}
console.log(`  色标: ${CMAP_VMIN}-${CMAP_VMAX} / 步长${CMAP_STEP} / ${cmapStops.length} 个色阶`);

const jsonConfig = {
  properties: {
    nogui: true,
    background: 'rgba(0,0,0,0)',
  },
  colourmaps: [{
    colours: cmapStops,
  }],
  views: [{
    axes: false,
    border: false,
    rotate: [0, 0, 0, 0],
    translate: [0, 0, 0],
  }],
  objects: [{
    name: 'volume',
    samples: 256,
    isovalue: 0.65,
    isowalls: true,
    isoalpha: 1,
    isosmooth: 0.5,
    colour: [125, 255, 125],
    density: 2.0,
    power: 1,
    colourmap: 0,
    tricubicfilter: false,
    saturation: 1,
    brightness: -0.1,
    contrast: 1,
    xmin: 0.01, xmax: 0.99,
    ymin: 0.01, ymax: 0.99,
    zmin: 0.01, zmax: 0.99,
    volume: {
      url: 'data/TEM/1/tem_3d.jpg',
      res: [NX, NY, NZ],
      scale: [1, 1, 1],
      autoscale: true,
    },
    cesium: {
      rotate: [0.0, 1.5, -11.5],
      translate: [0, 0, -50],
      scale: [0.0105, 0.0105, 0.0105],
    },
    slices: {
      properties: {
        show: false,
        X: Math.floor(NX / 2),
        Y: Math.floor(NY / 2),
        Z: Math.floor(NZ / 2),
        brightness: 0,
        contrast: 1,
        power: 1,
        usecolourmap: true,
        layout: 'x|y|z-',
        zoom: 0.85,
      },
    },
  }],
};

const jsonPath = path.join(OUT_DIR, 'tem_3d.json');
fs.writeFileSync(jsonPath, JSON.stringify(jsonConfig, null, 2));
console.log(`  JSON: ${jsonPath}`);

console.log('\n=== 完成 ===');
console.log(`精灵图: ${jpgPath}`);
console.log(`配置:   ${jsonPath}`);
