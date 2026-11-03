import { describe, expect, it } from 'vitest'
import { validateSteadyDataset } from '@/modules/ventilation/dataset-contract'
import type { CfdData } from '@/views/ventilation-module/cesiumVentilation'
import { readFileSync } from 'node:fs'

const sample = (n = 2): CfdData => ({ meta: { n, x_gap: 0.5 }, x: [0, 1], y: [0, 0],
  z: [3805, 4005], vx: [1, 1], vy: [0, 0], vz: [0, 0], temp: [293, 294], vel: [1, 1] })

describe('incoming steady CFD data contract', () => {
  it('validates the delivered CFD point and vector files', () => {
    const load = (name: string) => JSON.parse(readFileSync(`public/data/ventilation/${name}`, 'utf8')) as CfdData
    const result = validateSteadyDataset(load('cfd_cell_data_lite.json'), load('cfd_arrows.json'))
    expect(result.cellCount).toBe(6786)
    expect(result.vectorCount).toBe(208)
    expect(result.warnings).toHaveLength(1)
  })
  it('accepts the current metadata count mismatch without changing its samples', () => {
    const cells = sample(1)
    expect(validateSteadyDataset(cells, sample())).toEqual({
      cellCount: 2, vectorCount: 2, sourceChainage: { start: 3805, end: 4005 },
      warnings: ['CFD 点云 元数据 n=1，实际数组 2 项'],
    })
    expect(cells.x).toHaveLength(2)
  })
  it('rejects malformed arrays and mismatched source ranges', () => {
    const broken = sample()
    broken.vx.pop()
    expect(() => validateSteadyDataset(broken, sample())).toThrow('vx')
    const shifted = sample()
    shifted.z = [3905, 4105]
    expect(() => validateSteadyDataset(sample(), shifted)).toThrow('坐标范围不一致')
    const unpaired = sample()
    unpaired.meta.x_gap = 2
    expect(() => validateSteadyDataset(unpaired, sample())).toThrow('x_gap')
  })
})
