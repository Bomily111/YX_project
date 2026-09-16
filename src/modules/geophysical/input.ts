import type { FieldBounds, PointField, ScalarKind, Vector3Tuple } from './types'

const BLOCK_POINTS = 65_536

const VALUE_ALIASES: Record<ScalarKind, string[]> = {
  resistivity: ['resistivity', 'apparentresistivity', 'rho', 'rhos', 'rho_s', 'ρs', 'k', 'value'],
  vp: ['vp', 'v_p', 'pvelocity', 'value'],
  vs: ['vs', 'v_s', 'svelocity', 'value'],
}

class PackedPointBuilder {
  private blocks: Float32Array[] = []
  private current = new Float32Array(BLOCK_POINTS * 4)
  private offset = 0
  count = 0

  push(x: number, y: number, z: number, value: number) {
    if (this.offset === this.current.length) {
      this.blocks.push(this.current)
      this.current = new Float32Array(BLOCK_POINTS * 4)
      this.offset = 0
    }
    this.current[this.offset++] = x
    this.current[this.offset++] = y
    this.current[this.offset++] = z
    this.current[this.offset++] = value
    this.count++
  }

  finish(): Float32Array {
    const result = new Float32Array(this.count * 4)
    let target = 0
    for (const block of this.blocks) {
      result.set(block, target)
      target += block.length
    }
    result.set(this.current.subarray(0, this.offset), target)
    return result
  }
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s\-.()\[\]{}]/g, '')
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string' || value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function validScalar(kind: ScalarKind, value: number): boolean {
  if (!Number.isFinite(value)) return false
  return kind === 'resistivity' || value > 0
}

function readVoxelSize(value: unknown): Vector3Tuple | undefined {
  if (!Array.isArray(value) || value.length !== 3) return undefined
  const parsed = value.map(finiteNumber)
  if (parsed.some(item => item === null || item <= 0)) return undefined
  return parsed as Vector3Tuple
}

function finalizeField(
  builder: PackedPointBuilder,
  kind: ScalarKind,
  rejected: number,
  bounds: FieldBounds,
  valueRange: [number, number],
  sourceName: string,
  voxelSize?: Vector3Tuple,
): PointField {
  if (builder.count === 0) throw new Error(`${sourceName}：没有可用的${kindLabel(kind)}点位`)
  return {
    kind,
    data: builder.finish(),
    count: builder.count,
    rejected,
    bounds,
    valueRange,
    sourceName,
    voxelSize,
  }
}

function kindLabel(kind: ScalarKind): string {
  return ({ resistivity: '视电阻率', vp: 'Vp', vs: 'Vs' })[kind]
}

function emptyBounds(): FieldBounds {
  return {
    min: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
    max: [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
  }
}

function updateRanges(
  bounds: FieldBounds,
  valueRange: [number, number],
  x: number,
  y: number,
  z: number,
  scalar: number,
) {
  bounds.min[0] = Math.min(bounds.min[0], x)
  bounds.min[1] = Math.min(bounds.min[1], y)
  bounds.min[2] = Math.min(bounds.min[2], z)
  bounds.max[0] = Math.max(bounds.max[0], x)
  bounds.max[1] = Math.max(bounds.max[1], y)
  bounds.max[2] = Math.max(bounds.max[2], z)
  valueRange[0] = Math.min(valueRange[0], scalar)
  valueRange[1] = Math.max(valueRange[1], scalar)
}

function objectValue(record: Record<string, unknown>, aliases: string[]): unknown {
  const entries = Object.entries(record)
  for (const alias of aliases) {
    const match = entries.find(([key]) => normalizeKey(key) === normalizeKey(alias))
    if (match) return match[1]
  }
  return undefined
}

function parseJson(text: string, kind: ScalarKind, sourceName: string): PointField {
  let root: unknown
  try {
    root = JSON.parse(text)
  } catch (error) {
    throw new Error(`${sourceName}：JSON 解析失败—${(error as Error).message}`)
  }

  let rows: unknown
  let voxelSize: Vector3Tuple | undefined
  if (Array.isArray(root)) {
    rows = root
  } else if (root && typeof root === 'object') {
    const record = root as Record<string, unknown>
    rows = record.points ?? record.data ?? record.values ?? record[kind]
    voxelSize = readVoxelSize(record.voxelSize ?? record.spacing)
  }
  if (!Array.isArray(rows)) {
    throw new Error(`${sourceName}：必须是点位数组，或包含 points/data/values 数组的对象`)
  }

  const builder = new PackedPointBuilder()
  const bounds = emptyBounds()
  const valueRange: [number, number] = [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]
  let rejected = 0

  for (const row of rows) {
    let x: number | null = null
    let y: number | null = null
    let z: number | null = null
    let scalar: number | null = null
    if (Array.isArray(row)) {
      x = finiteNumber(row[0])
      y = finiteNumber(row[1])
      z = finiteNumber(row[2])
      scalar = finiteNumber(row[3])
    } else if (row && typeof row === 'object') {
      const record = row as Record<string, unknown>
      x = finiteNumber(objectValue(record, ['x']))
      y = finiteNumber(objectValue(record, ['y']))
      z = finiteNumber(objectValue(record, ['z']))
      scalar = finiteNumber(objectValue(record, VALUE_ALIASES[kind]))
    }
    if (x === null || y === null || z === null || scalar === null || !validScalar(kind, scalar)) {
      rejected++
      continue
    }
    builder.push(x, y, z, scalar)
    updateRanges(bounds, valueRange, x, y, z, scalar)
  }
  return finalizeField(builder, kind, rejected, bounds, valueRange, sourceName, voxelSize)
}

function splitCsvLine(line: string): string[] {
  const trimmed = line.trim()
  if (!trimmed) return []
  const delimiter = trimmed.includes(',') ? /,/ : trimmed.includes('\t') ? /\t/ : trimmed.includes(';') ? /;/ : /\s+/
  return trimmed.split(delimiter).map(part => part.trim().replace(/^"|"$/g, ''))
}

function columnIndex(headers: string[], aliases: string[]): number {
  const normalized = headers.map(normalizeKey)
  return normalized.findIndex(header => aliases.some(alias => normalizeKey(alias) === header))
}

async function parseCsv(text: string, kind: ScalarKind, sourceName: string): Promise<PointField> {
  const builder = new PackedPointBuilder()
  const bounds = emptyBounds()
  const valueRange: [number, number] = [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]
  let rejected = 0
  let start = 0
  let lineNumber = 0
  let indices: [number, number, number, number] | null = null

  while (start <= text.length) {
    const end = text.indexOf('\n', start)
    const line = text.slice(start, end === -1 ? text.length : end).replace(/\r$/, '')
    start = end === -1 ? text.length + 1 : end + 1
    lineNumber++
    const parts = splitCsvLine(line)
    if (parts.length === 0) continue

    if (indices === null) {
      const numericFirstRow = parts.length >= 4 && parts.slice(0, 4).every(value => finiteNumber(value) !== null)
      if (numericFirstRow) {
        indices = [0, 1, 2, 3]
      } else {
        const x = columnIndex(parts, ['x'])
        const y = columnIndex(parts, ['y'])
        const z = columnIndex(parts, ['z'])
        const value = columnIndex(parts, VALUE_ALIASES[kind])
        if ([x, y, z, value].some(index => index < 0)) {
          throw new Error(`${sourceName}：表头必须包含 x、y、z 和 ${VALUE_ALIASES[kind][0]}`)
        }
        indices = [x, y, z, value]
        continue
      }
    }

    const x = finiteNumber(parts[indices[0]])
    const y = finiteNumber(parts[indices[1]])
    const z = finiteNumber(parts[indices[2]])
    const scalar = finiteNumber(parts[indices[3]])
    if (x === null || y === null || z === null || scalar === null || !validScalar(kind, scalar)) {
      rejected++
      continue
    }
    builder.push(x, y, z, scalar)
    updateRanges(bounds, valueRange, x, y, z, scalar)

    if (lineNumber % 100_000 === 0) await new Promise<void>(resolve => window.setTimeout(resolve, 0))
  }
  return finalizeField(builder, kind, rejected, bounds, valueRange, sourceName)
}

export async function parseScalarInput(source: string | File, kind: ScalarKind): Promise<PointField> {
  const sourceName = typeof source === 'string' ? `${kindLabel(kind)}粘贴数据` : source.name
  const text = typeof source === 'string' ? source : await source.text()
  let firstContent = 0
  while (firstContent < text.length && /\s/.test(text[firstContent])) firstContent++
  if (firstContent === text.length) throw new Error(`${sourceName}：输入为空`)
  return text[firstContent] === '{' || text[firstContent] === '['
    ? parseJson(text, kind, sourceName)
    : parseCsv(text, kind, sourceName)
}
