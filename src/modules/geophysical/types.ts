export type ScalarKind = 'resistivity' | 'vp' | 'vs'

export type Vector3Tuple = [number, number, number]

export interface FieldBounds {
  min: Vector3Tuple
  max: Vector3Tuple
}

/**
 * Packed point field. Every point occupies four consecutive values: x, y, z,
 * scalar. Coordinates are kept exactly as parsed (within Float32 precision).
 */
export interface PointField {
  kind: ScalarKind
  data: Float32Array
  count: number
  rejected: number
  bounds: FieldBounds
  valueRange: [number, number]
  voxelSize?: Vector3Tuple
  sourceName: string
}

export interface PreparationProgress {
  phase: string
  completed: number
  total: number
}

export interface ModelStatistics {
  resistivityInput: number
  waterRich: number
  classified: number
  rejectedDuringAlignment: number
  grades: Record<2 | 3 | 4 | 5, number>
}

export interface PreparedVoxelModel {
  field: PointField
  voxelSize: Vector3Tuple
  center: Vector3Tuple
  waterMask: Uint8Array
  grades: Uint8Array
  vp: Float32Array | null
  vs: Float32Array | null
  statistics: ModelStatistics
}

export interface InputSelection {
  text: string
  file: File | null
}

export interface RenderStatistics {
  resistivity: { available: number; rendered: number }
  water: { available: number; rendered: number }
  grades: Record<2 | 3 | 4 | 5, { available: number; rendered: number }>
}
