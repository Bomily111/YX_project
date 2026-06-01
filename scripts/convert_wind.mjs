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
const raw = readFileSync(resolve(root, 'public/data/wind/tunnel_wind.txt'), 'utf-8');
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
// ANSYS Z (4.5 ~ 64.4m) → distance along centerLine from start
const Z_OFFSET = 4.5; // ANSYS model starts at Z=4.5

// Find the start heading
const startInfo = sampleAt(0);
const startHeading = startInfo.heading;
console.log(`Start point: (${startInfo.lon.toFixed(6)}, ${startInfo.lat.toFixed(6)}, ${startInfo.h.toFixed(2)})`);
console.log(`Heading at start: ${(startHeading * 180 / Math.PI).toFixed(2)}°`);

// ── Convert each streamline ─────────────────────────────────
// Downsample: every DOWNSAMPLE_CURVE-th curve, every DOWNSAMPLE_PT-th point
const DOWNSAMPLE_CURVE = 8;
const DOWNSAMPLE_PT = 3;

const streamlines = [];
let sampledCount = 0;

for (let ci = 0; ci < curves.length; ci += DOWNSAMPLE_CURVE) {
  const curve = curves[ci];
  const points = [];

  for (let pi = 0; pi < curve.length; pi += DOWNSAMPLE_PT) {
    const [x, y, z] = curve[pi];
    const dist = z - Z_OFFSET;
    const anchor = sampleAt(dist);

    // Use heading at this specific point along the centerLine
    const heading = anchor.heading;
    const cosH = Math.cos(heading);
    const sinH = Math.sin(heading);

    // X → lateral offset (perpendicular to tunnel direction, right = positive)
    // Y → vertical offset (up = positive)
    const metersPerDegLon = 111320 * Math.cos(anchor.lat * Math.PI / 180);
    const metersPerDegLat = 110940;

    // Perpendicular direction: heading + 90° (to the right)
    const perpHeading = heading + Math.PI / 2;
    const plon = anchor.lon + (x * Math.sin(perpHeading)) / metersPerDegLon;
    const plat = anchor.lat + (x * Math.cos(perpHeading)) / metersPerDegLat;
    const ph = anchor.h + y;

    points.push([plon, plat, ph]);
  }

  if (points.length >= 3) {
    streamlines.push(points);
    sampledCount++;
  }
}
console.log(`After downsampling: ${sampledCount} streamlines`);

// ── Output ──────────────────────────────────────────────────
const output = { streamlines, totalCurves: curves.length, sampledCurves: sampledCount };
const outPath = resolve(root, 'public/data/wind/tunnel_streamlines.json');
writeFileSync(outPath, JSON.stringify(output));
console.log(`Written to ${outPath}`);
console.log(`Size: ${(JSON.stringify(output).length / 1024 / 1024).toFixed(2)} MB`);
