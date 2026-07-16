/**
 * 隧道风场矢量场可视化
 * 加载 ANSYS CFD 导出的 tunnel_vector 数据，在 suidao.glb 模型空间中渲染锥形矢量箭头
 */
import * as Cesium from 'cesium';
import { DTScopeEngine } from './Viewer';
import { getWindTunnelTransform } from './DrawLine';
import { VELOCITY_COLORS, lerpColor } from './WindFieldSimulation';

// ── 类型 ──────────────────────────────────────────────────
interface VectorCell {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  magnitude: number;
}

// ── 数据采样 ──────────────────────────────────────────────
const SAMPLE_STRIDE = 4; // 每 N 个网格单元取 1 个箭头

// ── 渲染状态 ──────────────────────────────────────────────
let vectorPrimitive: Cesium.Primitive | null = null;
let allCells: VectorCell[] = [];
let currentPower = 5; // 0-11

// ── 色带归一化 ────────────────────────────────────────────
const MAG_MIN = 0.000014;
const MAG_MAX = 2.17;

function normalizeMagnitude(mag: number): number {
  const range = MAG_MAX - MAG_MIN;
  if (range <= 0) return 0.5;
  return Math.max(0, Math.min(1, (mag - MAG_MIN) / range));
}

// ── CSV 解析 ──────────────────────────────────────────────

function parseCSV(text: string): VectorCell[] {
  const lines = text.split('\n');
  const cells: VectorCell[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(',').map((s) => s.trim());
    if (cols.length < 8) continue;

    const x = parseFloat(cols[1]);
    const y = parseFloat(cols[2]);
    const z = parseFloat(cols[3]);
    const magnitude = parseFloat(cols[4]);
    const vx = parseFloat(cols[5]);
    const vy = parseFloat(cols[6]);
    const vz = parseFloat(cols[7]);

    if (isNaN(x) || isNaN(y) || isNaN(z) || isNaN(magnitude)) continue;

    cells.push({ x, y, z, vx, vy, vz, magnitude });
  }

  return cells;
}

// ── 箭头几何构建 ──────────────────────────────────────────

/**
 * 创建锥形箭头几何体（CylinderGeometry 上半径=0 即为圆锥）
 * 默认沿 Z 轴，长度 1，原点在几何中心
 */
function makeConeGeom(baseRadius: number): Cesium.CylinderGeometry {
  return new Cesium.CylinderGeometry({
    length: 1,
    topRadius: 0,
    bottomRadius: baseRadius,
    slices: 6,
  });
}

/**
 * 创建圆柱杆几何体
 */
function makeShaftGeom(radius: number): Cesium.CylinderGeometry {
  return new Cesium.CylinderGeometry({
    length: 1,
    topRadius: radius,
    bottomRadius: radius,
    slices: 6,
  });
}

function buildArrowInstances(
  cells: VectorCell[],
  modelMatrix: Cesium.Matrix4,
): Cesium.GeometryInstance[] {
  const instances: Cesium.GeometryInstance[] = [];
  const powerScale = 0.5 + (currentPower / 11) * 1.5; // 0.5~2.0

  for (let i = 0; i < cells.length; i += SAMPLE_STRIDE) {
    const cell = cells[i];

    // 局部方向向量 & 模长
    const lv = new Cesium.Cartesian3(cell.vx, cell.vy, cell.vz);
    const localMag = Cesium.Cartesian3.magnitude(lv);
    if (localMag < 0.0001) continue;

    // 局部坐标 → 世界坐标
    const localPos = new Cesium.Cartesian3(cell.x, cell.y, cell.z);
    const worldPos = Cesium.Matrix4.multiplyByPoint(
      modelMatrix, localPos, new Cesium.Cartesian3(),
    );

    // 局部方向 → 世界方向
    Cesium.Cartesian3.normalize(lv, lv);
    const worldDir = Cesium.Matrix4.multiplyByPointAsVector(
      modelMatrix, lv, new Cesium.Cartesian3(),
    );
    Cesium.Cartesian3.normalize(worldDir, worldDir);

    // 旋转矩阵：Z → worldDir（轴角法）
    const zAxis = Cesium.Cartesian3.UNIT_Z;
    const cross = Cesium.Cartesian3.cross(zAxis, worldDir, new Cesium.Cartesian3());
    const dot = Cesium.Cartesian3.dot(zAxis, worldDir);
    let rotation: Cesium.Matrix3;
    if (Cesium.Cartesian3.magnitude(cross) < 1e-10) {
      rotation = dot > 0 ? Cesium.Matrix3.clone(Cesium.Matrix3.IDENTITY) :
        Cesium.Matrix3.fromRotationX(Cesium.Math.PI);
    } else {
      Cesium.Cartesian3.normalize(cross, cross);
      rotation = Cesium.Matrix3.fromQuaternion(
        Cesium.Quaternion.fromAxisAngle(cross, Math.acos(Cesium.Math.clamp(dot, -1, 1))),
        new Cesium.Matrix3(),
      );
    }
    const rotTranslate = Cesium.Matrix4.fromRotationTranslation(
      rotation, worldPos,
    );

    // 尺寸
    const magNorm = normalizeMagnitude(cell.magnitude);
    const totalLen = (0.6 + magNorm * 3.5) * powerScale;
    const baseR = (0.04 + magNorm * 0.12) * powerScale;
    const shaftLen = totalLen * 0.6;
    const headLen = totalLen * 0.4;

    // 颜色
    const [r, g, b] = lerpColor(magNorm);
    const colorAttr = Cesium.ColorGeometryInstanceAttribute.fromColor(
      new Cesium.Color(r, g, b),
    );

    // ── 杆身（圆柱），位于 Z∈[-totalLen/2, -totalLen/2+shaftLen] ──
    const shaftScale = Cesium.Matrix4.fromScale(
      new Cesium.Cartesian3(1, 1, shaftLen),
    );
    const shaftOffset = Cesium.Matrix4.fromTranslation(
      new Cesium.Cartesian3(0, 0, -totalLen / 2 + shaftLen / 2),
    );
    const shaftMatrix = new Cesium.Matrix4();
    Cesium.Matrix4.multiply(rotTranslate, shaftOffset, shaftMatrix);
    Cesium.Matrix4.multiply(shaftMatrix, shaftScale, shaftMatrix);

    instances.push(new Cesium.GeometryInstance({
      geometry: makeShaftGeom(baseR * 0.5),
      modelMatrix: shaftMatrix,
      attributes: { color: colorAttr },
    }));

    // ── 箭头（圆锥），位于 Z∈[+totalLen/2-headLen, +totalLen/2] ──
    const headScale = Cesium.Matrix4.fromScale(
      new Cesium.Cartesian3(1, 1, headLen),
    );
    const headOffset = Cesium.Matrix4.fromTranslation(
      new Cesium.Cartesian3(0, 0, +totalLen / 2 - headLen / 2),
    );
    const headMatrix = new Cesium.Matrix4();
    Cesium.Matrix4.multiply(rotTranslate, headOffset, headMatrix);
    Cesium.Matrix4.multiply(headMatrix, headScale, headMatrix);

    instances.push(new Cesium.GeometryInstance({
      geometry: makeConeGeom(baseR),
      modelMatrix: headMatrix,
      attributes: { color: colorAttr },
    }));
  }

  return instances;
}

// ── 数据加载 ──────────────────────────────────────────────

let loadingPromise: Promise<VectorCell[]> | null = null;

async function loadData(): Promise<VectorCell[]> {
  if (allCells.length > 0) return allCells;
  if (loadingPromise) return loadingPromise;

  loadingPromise = fetch('/data/wind/tunnel_vector')
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    })
    .then((text) => {
      allCells = parseCSV(text);
      console.log(`[VectorField] 加载 ${allCells.length} 个网格单元`);
      return allCells;
    })
    .catch((e) => {
      console.warn('[VectorField] 数据加载失败:', e);
      return [];
    })
    .finally(() => {
      loadingPromise = null;
    });

  return loadingPromise;
}

// ── 渲染 / 清除 ──────────────────────────────────────────

function render(viewer: Cesium.Viewer, cells: VectorCell[]) {
  const transform = getWindTunnelTransform();
  if (!transform) {
    console.warn('[VectorField] 风场隧道模型矩阵不可用，无法定位矢量');
    return;
  }

  const instances = buildArrowInstances(cells, transform.modelMatrix);
  if (!instances.length) {
    console.warn('[VectorField] 无可用矢量箭头');
    return;
  }

  vectorPrimitive = new Cesium.Primitive({
    geometryInstances: instances,
    appearance: new Cesium.PerInstanceColorAppearance({
      flat: false,
      translucent: false,
    }),
    asynchronous: false,
  });

  viewer.scene.primitives.add(vectorPrimitive);
  console.log(`[VectorField] 渲染 ${instances.length} 个几何实例（${Math.ceil(cells.length / SAMPLE_STRIDE)} 个箭头）`);
}

// ── 公共 API ──────────────────────────────────────────────

/** 开启矢量场可视化 */
export async function startVectorField(viewer: Cesium.Viewer) {
  removeVectorField(viewer);

  const transform = getWindTunnelTransform();
  if (!transform) {
    console.warn('[VectorField] 风场隧道模型未就绪，请先进入通风场景');
    return;
  }

  const cells = await loadData();
  if (!cells.length) {
    console.warn('[VectorField] 无可用矢量数据');
    return;
  }

  render(viewer, cells);
}

/** 清除矢量场 */
export function removeVectorField(viewer?: Cesium.Viewer) {
  const v = viewer ?? DTScopeEngine.viewer;
  if (!v || !vectorPrimitive) return;
  try {
    v.scene.primitives.remove(vectorPrimitive);
  } catch (_) {
    /* ignore */
  }
  vectorPrimitive = null;
}

/** 调节显示强度 (0-11)，实时重建箭头几何 */
export function changeVectorPower(power: number) {
  const newPower = Math.max(0, Math.min(11, Math.floor(power)));
  if (newPower === currentPower) return;
  currentPower = newPower;

  const viewer = DTScopeEngine.viewer;
  if (!viewer || !vectorPrimitive || !allCells.length) return;

  removeVectorField(viewer);
  render(viewer, allCells);
}

/** 获取当前强度 */
export function getVectorPower(): number {
  return currentPower;
}

/** 重载数据（数据文件更新后调用） */
export function resetVectorData() {
  allCells = [];
  loadingPromise = null;
}
