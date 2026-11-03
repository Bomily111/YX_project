import type { CfdData } from '@/views/ventilation-module/cesiumVentilation'

const fields = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'temp', 'vel'] as const
export const STEADY_DATASET_FILES = {
  cells: 'cfd_cell_data_lite.json',
  vectors: 'cfd_arrows.json',
} as const
export interface SteadyDatasetSummary {
  cellCount: number
  vectorCount: number
  sourceChainage: { start: number; end: number }
  warnings: string[]
}

function inspect(data: CfdData, label: string): { count: number; start: number; end: number; warnings: string[] } {
  if (!data?.meta || typeof data.meta !== 'object') throw new Error(`${label} 缺少 meta 坐标参数`)
  const count = data.x?.length ?? 0
  if (count < 1) throw new Error(`${label} 缺少 CFD 采样点`)
  for (const field of fields) {
    const values = data[field]
    if (!Array.isArray(values) || values.length !== count || values.some(value => !Number.isFinite(value))) {
      throw new Error(`${label} 的 ${field} 数组长度或数值无效`)
    }
  }
  const gap = data.meta.x_gap ?? 20
  if (!Number.isFinite(gap) || !data.x.some(x => x <= gap) || !data.x.some(x => x > gap)) {
    throw new Error(`${label} 的 x_gap 无法区分左右主洞采样点`)
  }
  let start = Number.POSITIVE_INFINITY, end = Number.NEGATIVE_INFINITY
  for (const chainage of data.z) { start = Math.min(start, chainage); end = Math.max(end, chainage) }
  if (end <= start) throw new Error(`${label} 的纵向坐标范围无效`)
  return { count, start, end, warnings: data.meta?.n === count ? []
    : [`${label} 元数据 n=${data.meta?.n ?? '未填'}，实际数组 ${count} 项`] }
}

/** Validate the data actually used by points, vectors, streamlines and particles. */
export function validateSteadyDataset(cells: CfdData, vectors: CfdData): SteadyDatasetSummary {
  const cell = inspect(cells, 'CFD 点云')
  const vector = inspect(vectors, '风向矢量')
  if (Math.abs(cell.start - vector.start) > 1 || Math.abs(cell.end - vector.end) > 1) {
    throw new Error('CFD 点云和风向矢量的纵向坐标范围不一致')
  }
  return { cellCount: cell.count, vectorCount: vector.count,
    sourceChainage: { start: cell.start, end: cell.end },
    warnings: [...cell.warnings, ...vector.warnings] }
}
