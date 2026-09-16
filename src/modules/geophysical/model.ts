import type {
  PointField,
  PreparationProgress,
  PreparedVoxelModel,
  Vector3Tuple,
} from './types'

const ALIGNMENT_YIELD_INTERVAL = 50_000
const MAX_DENSE_GRID_CELLS = 80_000_000

interface AxisBracket {
  low: number
  high: number
  weight: number
}

interface Sampler {
  sample: (x: number, y: number, z: number) => number
}

function sortedUnique(field: PointField, component: 0 | 1 | 2): number[] {
  const values = new Set<number>()
  for (let index = component; index < field.data.length; index += 4) values.add(field.data[index])
  return Array.from(values).sort((a, b) => a - b)
}

function coordinateIndex(axis: number[]): Map<number, number> {
  const result = new Map<number, number>()
  axis.forEach((value, index) => result.set(value, index))
  return result
}

function bracket(axis: number[], value: number): AxisBracket | null {
  if (axis.length === 0 || value < axis[0] || value > axis[axis.length - 1]) return null
  let low = 0
  let high = axis.length - 1
  while (low <= high) {
    const middle = (low + high) >>> 1
    const candidate = axis[middle]
    if (candidate === value) return { low: middle, high: middle, weight: 0 }
    if (candidate < value) low = middle + 1
    else high = middle - 1
  }
  if (high < 0 || low >= axis.length) return null
  const span = axis[low] - axis[high]
  return span > 0 ? { low: high, high: low, weight: (value - axis[high]) / span } : null
}

function createDenseSampler(field: PointField): Sampler | null {
  const xs = sortedUnique(field, 0)
  const ys = sortedUnique(field, 1)
  const zs = sortedUnique(field, 2)
  const total = xs.length * ys.length * zs.length
  if (!Number.isSafeInteger(total) || total > MAX_DENSE_GRID_CELLS || total > field.count * 2) return null

  const xMap = coordinateIndex(xs)
  const yMap = coordinateIndex(ys)
  const zMap = coordinateIndex(zs)
  const grid = new Float32Array(total)
  grid.fill(Number.NaN)
  const yz = ys.length * zs.length
  for (let offset = 0; offset < field.data.length; offset += 4) {
    const xi = xMap.get(field.data[offset])
    const yi = yMap.get(field.data[offset + 1])
    const zi = zMap.get(field.data[offset + 2])
    if (xi === undefined || yi === undefined || zi === undefined) continue
    grid[xi * yz + yi * zs.length + zi] = field.data[offset + 3]
  }

  const valueAt = (xi: number, yi: number, zi: number) => grid[xi * yz + yi * zs.length + zi]
  return {
    sample(x, y, z) {
      const bx = bracket(xs, x)
      const by = bracket(ys, y)
      const bz = bracket(zs, z)
      if (!bx || !by || !bz) return Number.NaN

      const xIndices = bx.low === bx.high ? [bx.low] : [bx.low, bx.high]
      const yIndices = by.low === by.high ? [by.low] : [by.low, by.high]
      const zIndices = bz.low === bz.high ? [bz.low] : [bz.low, bz.high]
      let sum = 0
      for (const xi of xIndices) {
        const wx = bx.low === bx.high ? 1 : xi === bx.low ? 1 - bx.weight : bx.weight
        for (const yi of yIndices) {
          const wy = by.low === by.high ? 1 : yi === by.low ? 1 - by.weight : by.weight
          for (const zi of zIndices) {
            const wz = bz.low === bz.high ? 1 : zi === bz.low ? 1 - bz.weight : bz.weight
            const scalar = valueAt(xi, yi, zi)
            if (!Number.isFinite(scalar)) return Number.NaN
            sum += scalar * wx * wy * wz
          }
        }
      }
      return sum
    },
  }
}

function coordinateKey(x: number, y: number, z: number): string {
  return `${x}\u001f${y}\u001f${z}`
}

function createExactSampler(field: PointField): Sampler {
  const values = new Map<string, number>()
  for (let offset = 0; offset < field.data.length; offset += 4) {
    values.set(
      coordinateKey(field.data[offset], field.data[offset + 1], field.data[offset + 2]),
      field.data[offset + 3],
    )
  }
  return { sample: (x, y, z) => values.get(coordinateKey(x, y, z)) ?? Number.NaN }
}

function createSampler(field: PointField): Sampler {
  return createDenseSampler(field) ?? createExactSampler(field)
}

/**
 * Query a TSP velocity field from the TEM coordinate system used by the
 * combined model.
 *
 * TEM: x = forward from the tunnel face, y = transverse, z = elevation.
 * TSP: x = transverse, y = forward mileage, z = elevation. The minimum TSP
 * y value is the first measured section, so it is the data-derived forward
 * origin. The packed input coordinates themselves remain untouched.
 */
function createTspSampler(field: PointField): Sampler {
  const source = createSampler(field)
  const firstSectionY = field.bounds.min[1]
  return {
    sample(forward, transverse, elevation) {
      return source.sample(transverse, firstSectionY + forward, elevation)
    },
  }
}

function medianSpacing(field: PointField, component: 0 | 1 | 2): number | null {
  const axis = sortedUnique(field, component)
  if (axis.length < 2) return null
  const gaps: number[] = []
  for (let index = 1; index < axis.length; index++) {
    const gap = axis[index] - axis[index - 1]
    if (gap > 0 && Number.isFinite(gap)) gaps.push(gap)
  }
  if (gaps.length === 0) return null
  gaps.sort((a, b) => a - b)
  const middle = gaps.length >>> 1
  return gaps.length % 2 === 1 ? gaps[middle] : (gaps[middle - 1] + gaps[middle]) / 2
}

function resolveVoxelSize(field: PointField): Vector3Tuple {
  if (field.voxelSize) return field.voxelSize
  const spacing: Vector3Tuple = [
    medianSpacing(field, 0) ?? 0,
    medianSpacing(field, 1) ?? 0,
    medianSpacing(field, 2) ?? 0,
  ]
  if (spacing.some(value => value <= 0 || !Number.isFinite(value))) {
    throw new Error('无法仅从点位推导三个方向的体素尺寸；请在 JSON 根对象中提供 voxelSize: [dx, dy, dz]')
  }
  return spacing
}

export function classifyRock(vp: number, vs: number, resistivity: number): 2 | 3 | 4 | 5 | null {
  if (!Number.isFinite(vp) || !Number.isFinite(vs) || !Number.isFinite(resistivity) || vs <= 0 || vp <= 0) return null
  const ratio = vp / vs
  if (!Number.isFinite(ratio)) return null
  let grade: 2 | 3 | 4 | 5 = ratio < 1.7 ? 2 : ratio < 2.0 ? 3 : 4
  if (resistivity < 570) grade = Math.min(5, grade + 1) as 3 | 4 | 5
  return grade
}

export async function prepareVoxelModel(
  resistivity: PointField,
  vp: PointField | null,
  vs: PointField | null,
  onProgress?: (progress: PreparationProgress) => void,
): Promise<PreparedVoxelModel> {
  const waterMask = new Uint8Array(resistivity.count)
  const grades = new Uint8Array(resistivity.count)
  const alignedVp = vp && vs ? new Float32Array(resistivity.count) : null
  const alignedVs = vp && vs ? new Float32Array(resistivity.count) : null
  if (alignedVp) alignedVp.fill(Number.NaN)
  if (alignedVs) alignedVs.fill(Number.NaN)
  const vpSampler = vp && vs ? createTspSampler(vp) : null
  const vsSampler = vp && vs ? createTspSampler(vs) : null
  const gradeCounts: Record<2 | 3 | 4 | 5, number> = { 2: 0, 3: 0, 4: 0, 5: 0 }
  let waterRich = 0
  let classified = 0
  let rejectedDuringAlignment = 0

  for (let index = 0; index < resistivity.count; index++) {
    const offset = index * 4
    const x = resistivity.data[offset]
    const y = resistivity.data[offset + 1]
    const z = resistivity.data[offset + 2]
    const rho = resistivity.data[offset + 3]
    if (rho < 570) {
      waterMask[index] = 1
      waterRich++
    }
    if (vpSampler && vsSampler && alignedVp && alignedVs) {
      const p = vpSampler.sample(x, y, z)
      const s = vsSampler.sample(x, y, z)
      const grade = classifyRock(p, s, rho)
      if (grade === null) {
        rejectedDuringAlignment++
      } else {
        alignedVp[index] = p
        alignedVs[index] = s
        grades[index] = grade
        gradeCounts[grade]++
        classified++
      }
    }
    if (index > 0 && index % ALIGNMENT_YIELD_INTERVAL === 0) {
      onProgress?.({ phase: '按前向/横向语义对齐与分级', completed: index, total: resistivity.count })
      await new Promise<void>(resolve => window.setTimeout(resolve, 0))
    }
  }

  onProgress?.({ phase: '按前向/横向语义对齐与分级', completed: resistivity.count, total: resistivity.count })
  return {
    field: resistivity,
    voxelSize: resolveVoxelSize(resistivity),
    center: [
      (resistivity.bounds.min[0] + resistivity.bounds.max[0]) / 2,
      (resistivity.bounds.min[1] + resistivity.bounds.max[1]) / 2,
      (resistivity.bounds.min[2] + resistivity.bounds.max[2]) / 2,
    ],
    waterMask,
    grades,
    vp: alignedVp,
    vs: alignedVs,
    statistics: {
      resistivityInput: resistivity.count,
      waterRich,
      classified,
      rejectedDuringAlignment,
      grades: gradeCounts,
    },
  }
}
