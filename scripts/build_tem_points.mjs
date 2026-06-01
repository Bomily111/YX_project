/**
 * TEM 致密点云构建脚本
 * 数据解析 → 坐标转换 → IDW 1m网格 → 过滤低阻异常点 → JSON
 *
 * 用法: node scripts/build_tem_points.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'public', 'data', 'TEM', '1');
const OUT_DIR  = path.join(DATA_DIR, 'points');

const DEG = Math.PI / 180;
const MAX_THRESHOLD = 600; // 低阻异常阈值上限

// ═══════════════════════════════════════════════════════════════
// 1. 坐标转换
// ═══════════════════════════════════════════════════════════════

function toCartesian(profileIndex, lineId, depth) {
  let alphaDeg, betaDeg;
  if (profileIndex === 3) {
    alphaDeg = 90;
    betaDeg  = 60 - (lineId - 1) * 15;
  } else {
    betaDeg  = [30, 0, -30][profileIndex];
    alphaDeg = 150 - (lineId - 1) * 15;
  }
  const a = alphaDeg * DEG, b = betaDeg * DEG;
  const cb = Math.cos(b);
  return {
    x: depth * cb * Math.cos(a),
    y: depth * cb * Math.sin(a),
    z: depth * Math.sin(b),
  };
}

function parseAll(texts) {
  const pts = [];
  for (let f = 0; f < 4; f++) {
    for (const line of texts[f].trim().split(/\r?\n/)) {
      const p = line.split('\t').map(Number);
      if (!Number.isFinite(p[0]) || !Number.isFinite(p[1]) || !Number.isFinite(p[2])) continue;
      const { x, y, z } = toCartesian(f, p[0], p[1]);
      pts.push({ x, y, z, v: p[2] });
    }
  }
  return pts;
}

// ═══════════════════════════════════════════════════════════════
// 2. IDW 插值
// ═══════════════════════════════════════════════════════════════

function idwGrid(points, resolution) {
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity, zMin = Infinity, zMax = -Infinity;
  for (const p of points) {
    xMin = Math.min(xMin, p.x); xMax = Math.max(xMax, p.x);
    yMin = Math.min(yMin, p.y); yMax = Math.max(yMax, p.y);
    zMin = Math.min(zMin, p.z); zMax = Math.max(zMax, p.z);
  }
  const pad = resolution * 2;
  xMin = Math.floor((xMin - pad) / resolution) * resolution;
  xMax = Math.ceil((xMax + pad) / resolution) * resolution;
  yMin = Math.floor((yMin - pad) / resolution) * resolution;
  yMax = Math.ceil((yMax + pad) / resolution) * resolution;
  zMin = Math.floor((zMin - pad) / resolution) * resolution;
  zMax = Math.ceil((zMax + pad) / resolution) * resolution;

  const nx = Math.round((xMax - xMin) / resolution);
  const ny = Math.round((yMax - yMin) / resolution);
  const nz = Math.round((zMax - zMin) / resolution);

  console.log(`[IDW] 网格 ${nx}×${ny}×${nz} = ${(nx*ny*nz/1e6).toFixed(1)}M 体素, Δ=${resolution}m`);

  const R = 25, R2 = R * R, cellSize = R;
  const map = new Map();
  for (let i = 0; i < points.length; i++) {
    const key = `${Math.floor(points[i].x/cellSize)},${Math.floor(points[i].y/cellSize)},${Math.floor(points[i].z/cellSize)}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(i);
  }

  const offs = [];
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      for (let dz = -1; dz <= 1; dz++)
        offs.push([dx, dy, dz]);

  const grid = new Float32Array(nx * ny * nz);
  const size = { nx, ny, nz, xMin, yMin, zMin, dx: resolution };

  for (let xi = 0; xi < nx; xi++) {
    if (xi % 20 === 0) console.log(`[IDW]   xi=${xi}/${nx}`);
    const gx = xMin + (xi + 0.5) * resolution;
    for (let yi = 0; yi < ny; yi++) {
      const gy = yMin + (yi + 0.5) * resolution;
      for (let zi = 0; zi < nz; zi++) {
        const gz = zMin + (zi + 0.5) * resolution;
        const cx = Math.floor(gx / cellSize), cy = Math.floor(gy / cellSize), cz = Math.floor(gz / cellSize);
        const nearby = [];
        for (const [dx, dy, dz] of offs) {
          const pts = map.get(`${cx+dx},${cy+dy},${cz+dz}`);
          if (!pts) continue;
          for (const pi of pts) {
            const p = points[pi];
            const d2 = (p.x-gx)**2 + (p.y-gy)**2 + (p.z-gz)**2;
            if (d2 < R2) {
              const d = Math.sqrt(d2);
              if (d < 0.001) { nearby.length = 0; nearby.push({ d: 0, v: p.v }); break; }
              nearby.push({ d, v: p.v });
            }
          }
        }
        if (nearby.length < 3) continue;
        let ws = 0, vws = 0;
        for (const { d, v } of nearby) { const w = 1/(d*d*d); ws += w; vws += w * v; }
        grid[xi * ny * nz + yi * nz + zi] = vws / ws;
      }
    }
  }
  console.log(`[IDW] 完成`);
  return { grid, ...size };
}

// ═══════════════════════════════════════════════════════════════
// 3. 主流程
// ═══════════════════════════════════════════════════════════════

console.log('=== TEM 致密点云构建 ===\n');

console.log('Step 1: 读取 .dat 文件...');
const texts = [];
for (let i = 1; i <= 4; i++) {
  texts.push(fs.readFileSync(path.join(DATA_DIR, `线${i}.dat`), 'utf8'));
}
const sourcePoints = parseAll(texts);
console.log(`  散点: ${sourcePoints.length}`);

console.log('\nStep 2: IDW 1m 网格插值...');
const { grid, nx, ny, nz, xMin, yMin, zMin, dx } = idwGrid(sourcePoints, 1.0);

console.log('\nStep 3: 过滤低阻异常点 (value > 0 且 ≤ 600)...');
const filtered = [];
let belowMin = 0, aboveMax = 0;

for (let xi = 0; xi < nx; xi++) {
  for (let yi = 0; yi < ny; yi++) {
    for (let zi = 0; zi < nz; zi++) {
      const v = grid[xi * ny * nz + yi * nz + zi];
      if (v <= 0) { belowMin++; continue; }
      if (v > MAX_THRESHOLD) { aboveMax++; continue; }
      filtered.push({
        x: xMin + (xi + 0.5) * dx,
        y: yMin + (yi + 0.5) * dx,
        z: zMin + (zi + 0.5) * dx,
        v: Math.round(v * 10) / 10,
      });
    }
  }
}

const total = nx * ny * nz;
console.log(`  总网格点: ${total}`);
console.log(`  空值(跳过): ${belowMin} (${(100*belowMin/total).toFixed(1)}%)`);
console.log(`  >600(跳过): ${aboveMax} (${(100*aboveMax/total).toFixed(1)}%)`);
console.log(`  保留异常点: ${filtered.length} (${(100*filtered.length/total).toFixed(1)}%)`);

fs.mkdirSync(OUT_DIR, { recursive: true });

// 分离坐标和值以减小文件体积
const coords = filtered.map(p => [p.x, p.y, p.z]);
const values = filtered.map(p => p.v);

const outPath = path.join(OUT_DIR, 'anomaly_points.json');
fs.writeFileSync(outPath, JSON.stringify({
  count: filtered.length,
  maxThreshold: MAX_THRESHOLD,
  coords,
  values,
  bounds: {
    xMin: xMin, xMax: xMin + nx * dx,
    yMin: yMin, yMax: yMin + ny * dx,
    zMin: zMin, zMax: zMin + nz * dx,
  },
}));

const kb = (fs.statSync(outPath).size / 1024).toFixed(0);
console.log(`\n输出: ${outPath} (${kb} KB)`);
console.log('=== 完成 ===');
