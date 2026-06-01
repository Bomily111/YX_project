/**
 * IDW (反距离权重) 三维空间插值
 *
 * 输入散点云 → 规则三维体素网格
 * 使用空间哈希加速邻近点查询
 */

import type { ScatteredPoint } from './coordinateTransform';

export interface Grid3D {
  data: Float32Array;      // 体素值, 索引 = xi*nz*ny + yi*nz + zi
  nx: number; ny: number; nz: number;
  xMin: number; yMin: number; zMin: number;
  dx: number;  dy: number;  dz: number;
}

const IDW_POWER   = 3;
const SEARCH_R    = 25;          // 搜索半径 (m)
const SEARCH_R2   = SEARCH_R * SEARCH_R;
const MIN_POINTS  = 3;

/**
 * 对散点云执行 IDW 三维网格插值
 * @param points    散点云
 * @param resolution 体素边长 (m), 默认 1.0
 */
export function idwInterpolate(
  points: ScatteredPoint[],
  resolution: number = 1.0,
): Grid3D {
  // 1. 确定网格边界 (留少量 padding)
  let xMin = Infinity, xMax = -Infinity;
  let yMin = Infinity, yMax = -Infinity;
  let zMin = Infinity, zMax = -Infinity;

  for (const p of points) {
    if (p.x < xMin) xMin = p.x; if (p.x > xMax) xMax = p.x;
    if (p.y < yMin) yMin = p.y; if (p.y > yMax) yMax = p.y;
    if (p.z < zMin) zMin = p.z; if (p.z > zMax) zMax = p.z;
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

  console.log(`[IDW] 网格: ${nx}×${ny}×${nz} = ${nx*ny*nz} 体素, Δ=${resolution}m`);
  console.log(`[IDW] 范围: X[${xMin.toFixed(1)},${xMax.toFixed(1)}] Y[${yMin.toFixed(1)},${yMax.toFixed(1)}] Z[${zMin.toFixed(1)},${zMax.toFixed(1)}]`);

  // 2. 空间哈希索引
  const cellSize = SEARCH_R;
  const cxMin = Math.floor(xMin / cellSize);
  const cxMax = Math.floor(xMax / cellSize);
  const cyMin = Math.floor(yMin / cellSize);
  const cyMax = Math.floor(yMax / cellSize);
  const czMin = Math.floor(zMin / cellSize);
  const czMax = Math.floor(zMax / cellSize);
  const cxN = cxMax - cxMin + 2;
  const cyN = cyMax - cyMin + 2;

  function cellIdx(cx: number, cy: number, cz: number): number {
    if (cx < cxMin || cx > cxMax || cy < cyMin || cy > cyMax || cz < czMin || cz > czMax) return -1;
    return (cx - cxMin) + (cy - cyMin) * cxN + (cz - czMin) * cxN * cyN;
  }

  const cellMap = new Map<number, number[]>(); // cellIdx → [pointIndex, ...]

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const cx = Math.floor(p.x / cellSize);
    const cy = Math.floor(p.y / cellSize);
    const cz = Math.floor(p.z / cellSize);
    const ci = cellIdx(cx, cy, cz);
    if (ci < 0) continue;
    if (!cellMap.has(ci)) cellMap.set(ci, []);
    cellMap.get(ci)!.push(i);
  }

  console.log(`[IDW] 哈希单元: ${cellMap.size} 占用`);

  // 3. 预计算邻居偏移
  const offs: [number, number, number][] = [];
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      for (let dz = -1; dz <= 1; dz++)
        offs.push([dx, dy, dz]);

  // 4. IDW 插值
  const totalVoxels = nx * ny * nz;
  const grid = new Float32Array(totalVoxels);
  let filled = 0;

  console.log(`[IDW] 插值中...`);

  for (let xi = 0; xi < nx; xi++) {
    if (xi % 20 === 0) console.log(`[IDW]   xi=${xi}/${nx}`);

    const gx = xMin + (xi + 0.5) * resolution;

    for (let yi = 0; yi < ny; yi++) {
      const gy = yMin + (yi + 0.5) * resolution;

      for (let zi = 0; zi < nz; zi++) {
        const gz = zMin + (zi + 0.5) * resolution;

        const cx = Math.floor(gx / cellSize);
        const cy = Math.floor(gy / cellSize);
        const cz = Math.floor(gz / cellSize);

        // 收集邻近点
        const nearby: { d: number; v: number }[] = [];

        for (const [dx, dy, dz] of offs) {
          const ci = cellIdx(cx + dx, cy + dy, cz + dz);
          if (ci < 0) continue;
          const pts = cellMap.get(ci);
          if (!pts) continue;

          for (const pi of pts) {
            const p = points[pi];
            const d2 = (p.x - gx) ** 2 + (p.y - gy) ** 2 + (p.z - gz) ** 2;
            if (d2 < SEARCH_R2) {
              const d = Math.sqrt(d2);
              if (d < 0.001) {
                // 精确重合
                nearby.length = 0;
                nearby.push({ d: 0, v: p.value });
                break;
              }
              nearby.push({ d, v: p.value });
            }
          }
        }

        if (nearby.length < MIN_POINTS) {
          grid[xi * ny * nz + yi * nz + zi] = 0;
          continue;
        }

        // IDW 加权
        let wSum = 0, vwSum = 0;
        for (const { d, v } of nearby) {
          const w = 1 / Math.pow(d, IDW_POWER);
          wSum += w;
          vwSum += w * v;
        }
        grid[xi * ny * nz + yi * nz + zi] = vwSum / wSum;
        filled++;
      }
    }
  }

  console.log(`[IDW] 完成, 填充 ${((filled/totalVoxels)*100).toFixed(1)}%`);

  return {
    data: grid,
    nx, ny, nz,
    xMin, yMin, zMin,
    dx: resolution, dy: resolution, dz: resolution,
  };
}
