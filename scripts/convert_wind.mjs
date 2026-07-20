/**
 * Convert ANSYS tunnel_wind.txt streamlines → lon/lat/height JSON
 * Usage: node scripts/convert_wind.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// ── Read centerLine ────────────────────────────────────────
const centerLine = JSON.parse(
  readFileSync(resolve(root, 'src/assets/data/centerLine.json'), 'utf-8')
);
const coords = centerLine.features[0].geometry.coordinates;
const pts = coords.map((c) => [c[0], c[1], c[2]]);

// ── Build cumulative arc-length along centerLine ───────────
const cumLen = [0];
for (let i = 1; i < pts.length; i++) {
  const dLon = (pts[i][0] - pts[i - 1][0]) * (111320 * Math.cos(pts[i][1] * Math.PI / 180));
  const dLat = (pts[i][1] - pts[i - 1][1]) * 110940;
  const dH = pts[i][2] - pts[i - 1][2];
  cumLen.push(cumLen[i - 1] + Math.sqrt(dLon * dLon + dLat * dLat + dH * dH));
}
const totalLen = cumLen[cumLen.length - 1];
console.log(`CenterLine: ${pts.length} points, total length: ${totalLen.toFixed(1)}m`);

// ── Interpolate position and heading at a given arc distance ──
function sampleAt(t) {
  t = Math.max(0, Math.min(totalLen, t));
  let lo = 0, hi = cumLen.length - 1;
  while (lo + 1 < hi) { const mid = (lo + hi) >> 1; if (cumLen[mid] <= t) lo = mid; else hi = mid; }
  const segLen = cumLen[hi] - cumLen[lo];
  const alpha = segLen < 1e-9 ? 0 : (t - cumLen[lo]) / segLen;
  const lon = pts[lo][0] + (pts[hi][0] - pts[lo][0]) * alpha;
  const lat = pts[lo][1] + (pts[hi][1] - pts[lo][1]) * alpha;
  const h = pts[lo][2] + (pts[hi][2] - pts[lo][2]) * alpha;
  // heading: direction of centerLine at this point (radians from north, clockwise)
  const dLon = (pts[hi][0] - pts[lo][0]) * (111320 * Math.cos(lat * Math.PI / 180));
  const dLat = (pts[hi][1] - pts[lo][1]) * 110940;
  const heading = Math.atan2(dLon, dLat); // east/north → radians from north
  return { lon, lat, h, heading };
}

// ── Parse ANSYS tunnel_wind.txt ────────────────────────────
const raw = readFileSync(resolve(root, 'public/data/wind/tunnel-velocity.txt'), 'utf-8');
const lines = raw.split('\n');

const curves = [];
let current = [];
for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed === 'begin curve') { current = []; continue; }
  if (trimmed === 'end curve') { if (current.length > 0) curves.push(current); continue; }
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 3) {
    const x = parseFloat(parts[0]);
    const y = parseFloat(parts[1]);
    const z = parseFloat(parts[2]);
    if (!isNaN(x) && !isNaN(y) && !isNaN(z)) current.push([x, y, z]);
  }
}
if (current.length > 0) curves.push(current);
console.log(`Parsed ${curves.length} curves from ANSYS data`);

// ── Coordinate mapping ─────────────────────────────────────
// ANSYS Z → distance along centerLine from start

// Find min Z from parsed curves for Z_OFFSET
let zMin = Infinity;
for (const curve of curves) {
  for (const pt of curve) {
    if (pt[2] < zMin) zMin = pt[2];
  }
}
const Z_OFFSET = zMin;
console.log(`Z_OFFSET (auto): ${Z_OFFSET.toFixed(2)}`);

// ── 查找最长直段（与 DrawLine._getWindTunnelTransform 一致） ──
function findStraightSegment() {
  // 过滤过近点
  const filtered = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const prev = filtered[filtered.length - 1];
    const dLon = (pts[i][0] - prev[0]) * (111320 * Math.cos(pts[i][1] * Math.PI / 180));
    const dLat = (pts[i][1] - prev[1]) * 110940;
    const dH = pts[i][2] - prev[2];
    if (Math.sqrt(dLon*dLon + dLat*dLat + dH*dH) > 0.5) filtered.push(pts[i]);
  }
  if (filtered.length < 2) return { bestStart: 0, bestEnd: 0, centerlineDist: 0 };

  // 方向向量
  const dirs = [];
  for (let i = 1; i < filtered.length; i++) {
    const dLon = (filtered[i][0] - filtered[i-1][0]) * (111320 * Math.cos(filtered[i][1] * Math.PI / 180));
    const dLat = (filtered[i][1] - filtered[i-1][1]) * 110940;
    const dH = filtered[i][2] - filtered[i-1][2];
    const len = Math.sqrt(dLon*dLon + dLat*dLat + dH*dH);
    dirs.push([dLon/len, dLat/len, dH/len]);
  }

  const cos3deg = Math.cos(3 * Math.PI / 180);
  let bestStart = 0, bestEnd = 0;
  for (let i = 0; i < dirs.length; i++) {
    let j = i;
    while (j < dirs.length) {
      const dot = dirs[i][0]*dirs[j][0] + dirs[i][1]*dirs[j][1] + dirs[i][2]*dirs[j][2];
      if (dot < cos3deg) break;
      j++;
    }
    if (j - i > bestEnd - bestStart) { bestStart = i; bestEnd = j; }
  }

  let cd = 0;
  for (let i = 1; i <= bestStart; i++) {
    const dLon = (filtered[i][0] - filtered[i-1][0]) * (111320 * Math.cos(filtered[i][1] * Math.PI / 180));
    const dLat = (filtered[i][1] - filtered[i-1][1]) * 110940;
    const dH = filtered[i][2] - filtered[i-1][2];
    cd += Math.sqrt(dLon*dLon + dLat*dLat + dH*dH);
  }
  return { bestStart, bestEnd, centerlineDist: cd };
}

const { centerlineDist } = findStraightSegment();
console.log(`Wind tunnel centerlineDist: ${centerlineDist.toFixed(1)}m`);

// ── Convert each streamline ─────────────────────────────────
// 流线沿中线放置：Z→中线距离, X→横向偏移, Y→垂直偏移
const DOWNSAMPLE_CURVE = 1;
const DOWNSAMPLE_PT   = 2;

const streamlines = [];
let sampledCount = 0;
let globalXMin = Infinity, globalXMax = -Infinity;

for (let ci = 0; ci < curves.length; ci += DOWNSAMPLE_CURVE) {
  const curve = curves[ci];
  const points = [];
  let sumX = 0;

  for (let pi = 0; pi < curve.length; pi += DOWNSAMPLE_PT) {
    const [x, y, z] = curve[pi];
    sumX += x;
    const dist = z - Z_OFFSET + centerlineDist;
    const anchor = sampleAt(dist);

    const heading = anchor.heading;
    const perpHeading = heading + Math.PI / 2;
    const mLon = 111320 * Math.cos(anchor.lat * Math.PI / 180);
    const plon = anchor.lon + (x * Math.sin(perpHeading)) / mLon;
    const plat = anchor.lat + (x * Math.cos(perpHeading)) / 110940;
    const ph = anchor.h + y;

    points.push([plon, plat, ph]);
  }

  if (points.length >= 3) {
    const avgX = sumX / points.length;
    if (avgX < globalXMin) globalXMin = avgX;
    if (avgX > globalXMax) globalXMax = avgX;
    streamlines.push({ pts: points, avgX });
    sampledCount++;
  }
}
console.log(`After downsampling: ${sampledCount} streamlines`);
console.log(`ANSYS X range: ${globalXMin.toFixed(2)} ~ ${globalXMax.toFixed(2)}`);

// ── Output ──────────────────────────────────────────────────
const output = {
  streamlines,
  totalCurves: curves.length,
  sampledCurves: sampledCount,
  xMin: globalXMin,
  xMax: globalXMax,
};
const outPath = resolve(root, 'public/data/wind/tunnel_streamlines.json');
writeFileSync(outPath, JSON.stringify(output));
console.log(`Written to ${outPath}`);
console.log(`Size: ${(JSON.stringify(output).length / 1024 / 1024).toFixed(2)} MB`);
