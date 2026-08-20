/**
 * 隧道程序化风场模拟（通风除尘场景「模拟风场」模式）
 *
 * 抛弃预计算 CFD，在 CPU 上实时解「势流 + 流线积分」，用分段着色 polyline 渲染 + 拖尾动画。
 * 几何模型（横截面域）：隧道为细长管道，风沿轴向（Z）吹。
 *  - 横截面为 2D 势场域：横向 X × 竖向 Y，风筒（duct）为内部固体。
 *  - 势场负梯度驱动横向/竖向绕流，轴向速度受固体势场 + 近壁减速调制。
 *  - 流线在入口横截面撒种，沿 Z 定步长积分，撞壁镜像回弹。
 *
 * 坐标：内部仿真用 (x=横向, y=竖向, z=轴向) 描述横截面势场；
 *       modelMatrix 的局部轴为 (X=隧道轴向, Y=横向, Z=竖向)，
 *       故世界坐标映射时交换为 local = (轴向, 横向, 竖向)。
 */
import * as Cesium from 'cesium';
import { DTScopeEngine } from './Viewer';
import { getWindTunnelTransform } from './DrawLine';
import { lerpColor, getFlylineMaterial } from './WindFieldSimulation';

// ── 隧道尺寸（m）───────────────────────────────────────────
const TUNNEL_WIDTH = 20;   // 横截面横向跨度
const TUNNEL_HEIGHT = 9;   // 横截面竖向跨度
const TUNNEL_LENGTH = 96;  // 轴向长度
const NX = 48;             // 横截面网格（横向）
const NY = 36;             // 横截面网格（竖向）

// 风筒（内部固体障碍）
const DUCT_CX = 2.3;       // 横向中心
const DUCT_CY = 5.7;       // 竖向中心（贴顶）
const DUCT_R = 1.5;        // 半径

// 势场扩散
const DIFFUSE_ROUNDS = 20;
const DIFFUSE_SELF = 0.93;
const DIFFUSE_NEIGHBOR = 0.985;

// 速度场系数
const AXIAL_SLOW = 0.25;      // 势场对轴向的减速
const LATERAL_GAIN = 6.2;     // 负梯度 → 横向偏转
const VERTICAL_GAIN = 10.5;   // 负梯度 → 竖向偏转
const WALL_SLOW_MIN = 0.35;   // 近壁轴向减速下限
const WALL_SLOW_DIST = 1.5;   // 近壁减速影响距离 (m)

// 流线播种 / 积分
const SEED_LANES = 14;         // 横向种子数
const SEED_LAYERS = 8;         // 竖向种子数
const INTEGRATE_STEP = 0.5;    // 轴向步长 (m)
const LATERAL_STEP_SCALE = 1.35;
const MAX_STEPS = 400;         // 单条流线步数上限
const WALL_MARGIN = 0.4;       // 壁回弹边界余量 (m)

// 渲染
const SMOOTH_ROUNDS = 3;
const DISTURBANCE_THRESHOLD = 0.0; // 0 = 不过滤（隧道内无自由流，保留全截面）
const SPEED_NORM = 1.45;           // 轴向速度归一化分母
const TRAIL_SEGMENTS = 24;         // 拖尾采样段数
const TRAIL_METERS = 12;           // 拖尾长度 (m)

const PWIDTH = [1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6];

// ── 模块状态 ──────────────────────────────────────────────
interface Field {
  axial: Float32Array;
  lateral: Float32Array;
  vertical: Float32Array;
  potential: Float32Array;
}

interface ComputedPath {
  worldPoints: Cesium.Cartesian3[];
  speeds: number[];
  cumLen: number[];
  totalLength: number;
}

interface TracerState {
  polyline: Cesium.Polyline;
  points: Cesium.Cartesian3[];
  speeds: number[];
  cumLen: number[];
  totalLength: number;
  distance: number;
}

let field: Field | null = null;
let computedPaths: ComputedPath[] = [];
let staticPrimitive: Cesium.Primitive | null = null;
let tracerCollection: Cesium.PolylineCollection | null = null;
let tracers: TracerState[] = [];
let preRenderListener: (() => void) | null = null;
let flowEnabled = false;
let currentPower = 5;
let lastFrameMs = 0;

// ── 颜色映射 ──────────────────────────────────────────────

/** 透明度反相关于速度：慢=实、快=淡，视觉权重集中到绕障/滞止区 */
function speedAlpha(speed: number): number {
  const normalized = Math.max(0, Math.min(1, (speed - 0.05) / 0.95));
  return 0.94 - normalized * 0.78;
}

function speedColor(speed: number): Cesium.Color {
  const [r, g, b] = lerpColor(speed);
  return new Cesium.Color(r, g, b, speedAlpha(speed));
}

// ── 势场 + 速度场 ─────────────────────────────────────────

function buildField(): Field {
  const n = NX * NY;
  const cellW = TUNNEL_WIDTH / NX;
  const cellH = TUNNEL_HEIGHT / NY;

  // 固体掩膜：风筒
  const solid = new Float32Array(n);
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const x = -TUNNEL_WIDTH / 2 + (i + 0.5) * cellW;
      const y = (j + 0.5) * cellH;
      solid[j * NX + i] = Math.hypot(x - DUCT_CX, y - DUCT_CY) < DUCT_R ? 1 : 0;
    }
  }

  // 势场扩散
  let src = new Float32Array(solid);
  let dst = new Float32Array(n);
  for (let r = 0; r < DIFFUSE_ROUNDS; r++) {
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        const idx = j * NX + i;
        let sum = 0;
        let cnt = 0;
        if (i > 0) { sum += src[idx - 1]; cnt++; }
        if (i < NX - 1) { sum += src[idx + 1]; cnt++; }
        if (j > 0) { sum += src[idx - NX]; cnt++; }
        if (j < NY - 1) { sum += src[idx + NX]; cnt++; }
        const avg = cnt ? sum / cnt : 0;
        dst[idx] = Math.max(src[idx] * DIFFUSE_SELF, avg * DIFFUSE_NEIGHBOR);
      }
    }
    const tmp = src;
    src = dst;
    dst = tmp;
  }

  const potential = src;
  const axial = new Float32Array(n);
  const lateral = new Float32Array(n);
  const vertical = new Float32Array(n);

  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const idx = j * NX + i;
      const p = potential[idx];

      const il = Math.max(0, i - 1);
      const ir = Math.min(NX - 1, i + 1);
      const jl = Math.max(0, j - 1);
      const jr = Math.min(NY - 1, j + 1);
      const gx = (potential[j * NX + ir] - potential[j * NX + il]) * 0.5;
      const gy = (potential[jr * NX + i] - potential[jl * NX + i]) * 0.5;

      let a = 1 - p * AXIAL_SLOW;

      // 近壁减速
      const edgeX = Math.min((i + 0.5) * cellW, TUNNEL_WIDTH - (i + 0.5) * cellW);
      const edgeY = Math.min((j + 0.5) * cellH, TUNNEL_HEIGHT - (j + 0.5) * cellH);
      const edge = Math.min(edgeX, edgeY);
      a *= WALL_SLOW_MIN + (1 - WALL_SLOW_MIN) * Math.min(1, edge / WALL_SLOW_DIST);

      axial[idx] = Math.max(0.16, Math.min(1.55, a));
      lateral[idx] = Math.max(-1.2, Math.min(1.2, -gx * LATERAL_GAIN));
      vertical[idx] = Math.max(-1.2, Math.min(1.2, -gy * VERTICAL_GAIN));
    }
  }

  return { axial, lateral, vertical, potential };
}

function sample(x: number, y: number): { axial: number; lateral: number; vertical: number; potential: number } {
  if (!field) return { axial: 1, lateral: 0, vertical: 0, potential: 0 };
  const cellW = TUNNEL_WIDTH / NX;
  const cellH = TUNNEL_HEIGHT / NY;

  let gx = (x + TUNNEL_WIDTH / 2) / cellW - 0.5;
  let gy = y / cellH - 0.5;
  gx = Math.max(0, Math.min(NX - 1.001, gx));
  gy = Math.max(0, Math.min(NY - 1.001, gy));

  const i0 = Math.floor(gx);
  const j0 = Math.floor(gy);
  const i1 = Math.min(i0 + 1, NX - 1);
  const j1 = Math.min(j0 + 1, NY - 1);
  const tx = gx - i0;
  const ty = gy - j0;

  const a = field.axial[j0 * NX + i0];
  const b = field.axial[j0 * NX + i1];
  const c = field.axial[j1 * NX + i0];
  const d = field.axial[j1 * NX + i1];
  const axial = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;

  const la = field.lateral[j0 * NX + i0];
  const lb = field.lateral[j0 * NX + i1];
  const lc = field.lateral[j1 * NX + i0];
  const ld = field.lateral[j1 * NX + i1];
  const lateral = (la * (1 - tx) + lb * tx) * (1 - ty) + (lc * (1 - tx) + ld * tx) * ty;

  const va = field.vertical[j0 * NX + i0];
  const vb = field.vertical[j0 * NX + i1];
  const vc = field.vertical[j1 * NX + i0];
  const vd = field.vertical[j1 * NX + i1];
  const vertical = (va * (1 - tx) + vb * tx) * (1 - ty) + (vc * (1 - tx) + vd * tx) * ty;

  const pa = field.potential[j0 * NX + i0];
  const pb = field.potential[j0 * NX + i1];
  const pc = field.potential[j1 * NX + i0];
  const pd = field.potential[j1 * NX + i1];
  const potential = (pa * (1 - tx) + pb * tx) * (1 - ty) + (pc * (1 - tx) + pd * tx) * ty;

  return { axial, lateral, vertical, potential };
}

// ── 流线播种 + 积分 ───────────────────────────────────────

function seedPoints(): { x: number; y: number }[] {
  const seeds: { x: number; y: number }[] = [];
  const dw = TUNNEL_WIDTH / SEED_LANES;
  const dh = TUNNEL_HEIGHT / SEED_LAYERS;
  for (let li = 0; li < SEED_LANES; li++) {
    for (let la = 0; la < SEED_LAYERS; la++) {
      const x = -TUNNEL_WIDTH / 2 + (li + 0.5) * dw;
      const y = (la + 0.5) * dh;
      if (Math.hypot(x - DUCT_CX, y - DUCT_CY) < DUCT_R) continue;
      seeds.push({ x, y });
    }
  }
  return seeds;
}

interface LocalPath {
  xs: number[];
  ys: number[];
  zs: number[];
  speeds: number[];
  peakDisturbance: number;
}

function integrate(x0: number, y0: number): LocalPath {
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];
  const speeds: number[] = [];

  let x = x0;
  let y = y0;
  let z = 0;
  let peak = 0;
  let steps = 0;

  const xMin = -TUNNEL_WIDTH / 2 + WALL_MARGIN;
  const xMax = TUNNEL_WIDTH / 2 - WALL_MARGIN;
  const yMin = WALL_MARGIN;
  const yMax = TUNNEL_HEIGHT - WALL_MARGIN;

  while (z < TUNNEL_LENGTH && steps < MAX_STEPS) {
    const f = sample(x, y);
    const a = Math.max(0.22, f.axial);
    const dz = a * INTEGRATE_STEP;
    const dx = f.lateral * INTEGRATE_STEP * LATERAL_STEP_SCALE;
    const dy = f.vertical * INTEGRATE_STEP * LATERAL_STEP_SCALE;

    xs.push(x);
    ys.push(y);
    zs.push(z);
    speeds.push(Math.max(0, Math.min(1, a / SPEED_NORM)));
    peak = Math.max(peak, Math.abs(f.lateral) + Math.abs(f.vertical));

    x += dx;
    y += dy;
    z += dz;

    // 壁镜像回弹，避免流线提前终止
    if (x < xMin) x = 2 * xMin - x;
    if (x > xMax) x = 2 * xMax - x;
    if (y < yMin) y = 2 * yMin - y;
    if (y > yMax) y = 2 * yMax - y;
    x = Math.max(xMin, Math.min(xMax, x));
    y = Math.max(yMin, Math.min(yMax, y));

    steps++;
  }

  // 出口闭合点
  xs.push(x);
  ys.push(y);
  zs.push(TUNNEL_LENGTH);
  speeds.push(speeds.length ? speeds[speeds.length - 1] : 0.5);

  return { xs, ys, zs, speeds, peakDisturbance: peak };
}

function smooth(path: LocalPath): void {
  const n = path.xs.length;
  for (let r = 0; r < SMOOTH_ROUNDS; r++) {
    const nx = new Float32Array(n);
    const ny = new Float32Array(n);
    const nz = new Float32Array(n);
    const ns = new Float32Array(n);
    for (let i = 1; i < n - 1; i++) {
      nx[i] = path.xs[i - 1] * 0.2 + path.xs[i] * 0.6 + path.xs[i + 1] * 0.2;
      ny[i] = path.ys[i - 1] * 0.2 + path.ys[i] * 0.6 + path.ys[i + 1] * 0.2;
      nz[i] = path.zs[i - 1] * 0.2 + path.zs[i] * 0.6 + path.zs[i + 1] * 0.2;
      ns[i] = path.speeds[i - 1] * 0.2 + path.speeds[i] * 0.6 + path.speeds[i + 1] * 0.2;
    }
    for (let i = 0; i < n; i++) {
      if (i === 0 || i === n - 1) {
        nx[i] = path.xs[i];
        ny[i] = path.ys[i];
        nz[i] = path.zs[i];
        ns[i] = path.speeds[i];
      }
      path.xs[i] = nx[i];
      path.ys[i] = ny[i];
      path.zs[i] = nz[i];
      path.speeds[i] = ns[i];
    }
  }
}

function cumulativeLength(points: Cesium.Cartesian3[]): { cumLen: number[]; totalLength: number } {
  const cumLen = new Array<number>(points.length);
  cumLen[0] = 0;
  for (let i = 1; i < points.length; i++) {
    cumLen[i] = cumLen[i - 1] + Cesium.Cartesian3.distance(points[i], points[i - 1]);
  }
  return { cumLen, totalLength: cumLen[points.length - 1] };
}

function samplePathAtDistance(points: Cesium.Cartesian3[], cumLen: number[], d: number, result: Cesium.Cartesian3): Cesium.Cartesian3 {
  const total = cumLen[cumLen.length - 1];
  d = Math.max(0, Math.min(total, d));
  let lo = 0;
  let hi = cumLen.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (cumLen[mid] <= d) lo = mid;
    else hi = mid;
  }
  const seg = cumLen[hi] - cumLen[lo];
  const t = seg < 1e-9 ? 0 : (d - cumLen[lo]) / seg;
  return Cesium.Cartesian3.lerp(points[lo], points[hi], t, result);
}

function sampleSpeedAtDistance(speeds: number[], cumLen: number[], d: number): number {
  const total = cumLen[cumLen.length - 1];
  d = Math.max(0, Math.min(total, d));
  let lo = 0;
  let hi = cumLen.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (cumLen[mid] <= d) lo = mid;
    else hi = mid;
  }
  const seg = cumLen[hi] - cumLen[lo];
  const t = seg < 1e-9 ? 0 : (d - cumLen[lo]) / seg;
  return speeds[lo] + (speeds[hi] - speeds[lo]) * t;
}

// ── 渲染 ──────────────────────────────────────────────────

function renderStatic(viewer: Cesium.Viewer): void {
  const width = PWIDTH[currentPower];
  const instances: Cesium.GeometryInstance[] = [];

  for (const path of computedPaths) {
    if (path.worldPoints.length < 2) continue;

    const positions = path.worldPoints;
    const colors = path.speeds.map((s) => speedColor(s));

    instances.push(
      new Cesium.GeometryInstance({
        geometry: new Cesium.PolylineGeometry({
          positions,
          colors,
          width,
          arcType: Cesium.ArcType.NONE,
        }),
      }),
    );
  }

  if (instances.length === 0) return;

  staticPrimitive = new Cesium.Primitive({
    geometryInstances: instances,
    appearance: getFlylineMaterial(true),
    asynchronous: false,
    allowPicking: false,
  });
  viewer.scene.primitives.add(staticPrimitive);
  console.log(`[TunnelWind] ${instances.length} 条模拟流线 → 1 次 draw call`);
}

function ensureTracers(viewer: Cesium.Viewer): void {
  if (tracerCollection) return;

  tracerCollection = new Cesium.PolylineCollection();
  viewer.scene.primitives.add(tracerCollection);

  for (const path of computedPaths) {
    if (path.worldPoints.length < 2) continue;
    const meanSpeed = path.speeds.reduce((s, v) => s + v, 0) / path.speeds.length;
    const color = speedColor(meanSpeed);
    const polyline = tracerCollection.add({
      positions: [path.worldPoints[0], path.worldPoints[1]],
      width: 1.1 + meanSpeed * 1.8,
      material: Cesium.Material.fromType('Color', { color }),
      show: false,
    });
    tracers.push({
      polyline,
      points: path.worldPoints,
      speeds: path.speeds,
      cumLen: path.cumLen,
      totalLength: path.totalLength,
      distance: Math.random() * path.totalLength,
    });
  }

  if (!preRenderListener) {
    preRenderListener = () => onPreRender();
    viewer.scene.preRender.addEventListener(preRenderListener);
  }
}

function destroyTracers(viewer: Cesium.Viewer): void {
  if (preRenderListener) {
    viewer.scene.preRender.removeEventListener(preRenderListener);
    preRenderListener = null;
  }
  if (tracerCollection) {
    viewer.scene.primitives.remove(tracerCollection);
    tracerCollection = null;
  }
  tracers = [];
}

function onPreRender(): void {
  if (!flowEnabled || !tracerCollection) return;

  const now = performance.now();
  if (lastFrameMs === 0) lastFrameMs = now;
  const dt = Math.min(0.1, (now - lastFrameMs) / 1000);
  lastFrameMs = now;

  const speedFactor = 0.5 + (currentPower / 11) * 1.5;

  for (const t of tracers) {
    const headSpeed = sampleSpeedAtDistance(t.speeds, t.cumLen, t.distance);
    t.distance = (t.distance + headSpeed * 18 * speedFactor * dt) % Math.max(1, t.totalLength);

    const head = t.distance;
    const start = Math.max(0, head - TRAIL_METERS);
    const positions: Cesium.Cartesian3[] = [];
    for (let k = 0; k <= TRAIL_SEGMENTS; k++) {
      const d = start + (head - start) * (k / TRAIL_SEGMENTS);
      positions.push(samplePathAtDistance(t.points, t.cumLen, d, new Cesium.Cartesian3()));
    }

    t.polyline.positions = positions;
    t.polyline.width = 1.1 + headSpeed * 1.8;
    const c = t.polyline.material.uniforms.color as Cesium.Color;
    const [r, g, b] = lerpColor(headSpeed);
    c.red = r;
    c.green = g;
    c.blue = b;
    c.alpha = speedAlpha(headSpeed);
    t.polyline.show = true;
  }
}

// ── 公共 API ──────────────────────────────────────────────

/** 开启程序化模拟风场 */
export function startProceduralWind(viewer: Cesium.Viewer): void {
  removeProceduralWind(viewer);

  const transform = getWindTunnelTransform();
  if (!transform) {
    console.warn('[TunnelWind] 风场隧道模型未就绪，请先进入通风场景');
    return;
  }

  if (!field) field = buildField();

  const modelMatrix = transform.modelMatrix;
  const local = new Cesium.Cartesian3();
  const world = new Cesium.Cartesian3();

  computedPaths = [];
  const seeds = seedPoints();
  for (const s of seeds) {
    const path = integrate(s.x, s.y);
    if (path.peakDisturbance < DISTURBANCE_THRESHOLD) continue;
    smooth(path);

    const worldPoints: Cesium.Cartesian3[] = [];
    for (let i = 0; i < path.xs.length; i++) {
      // 内部仿真用 (x=横向, y=竖向, z=轴向)；modelMatrix 的局部轴为
      // (X=隧道轴向, Y=横向, Z=竖向)，故映射时交换：轴向→X、横向→Y、竖向→Z。
      local.x = path.zs[i];
      local.y = path.xs[i];
      local.z = path.ys[i];
      Cesium.Matrix4.multiplyByPoint(modelMatrix, local, world);
      worldPoints.push(Cesium.Cartesian3.clone(world));
    }

    const { cumLen, totalLength } = cumulativeLength(worldPoints);
    computedPaths.push({ worldPoints, speeds: path.speeds, cumLen, totalLength });
  }

  console.log(`[TunnelWind] 积分 ${seeds.length} 个种子 → ${computedPaths.length} 条流线`);
  renderStatic(viewer);
}

/** 清除模拟风场 */
export function removeProceduralWind(viewer?: Cesium.Viewer): void {
  const v = viewer ?? DTScopeEngine.viewer;
  if (!v) return;
  destroyTracers(v);
  if (staticPrimitive) {
    try { v.scene.primitives.remove(staticPrimitive); } catch (_) { /* ignore */ }
    staticPrimitive = null;
  }
}

/** 流动（拖尾）开关 */
export function setProceduralFlow(on: boolean): void {
  flowEnabled = on;
  if (tracerCollection) tracerCollection.show = on;
  if (on && computedPaths.length) {
    const viewer = DTScopeEngine.viewer;
    if (viewer) ensureTracers(viewer);
  }
}

/** 调节显示强度 (0-11)，实时重建静态流线宽度 */
export function changeProceduralPower(power: number): void {
  const newPower = Math.max(0, Math.min(11, Math.floor(power)));
  if (newPower === currentPower) return;
  currentPower = newPower;

  const viewer = DTScopeEngine.viewer;
  if (!viewer || !staticPrimitive || !computedPaths.length) return;

  removeProceduralWind(viewer);
  renderStatic(viewer);
  if (flowEnabled) ensureTracers(viewer);
}

/** 获取当前强度 */
export function getProceduralPower(): number {
  return currentPower;
}

/** 重置缓存（几何/参数变化后调用） */
export function resetProceduralWind(): void {
  field = null;
  computedPaths = [];
}
