import * as Cesium from 'cesium'
import { describe, expect, it } from 'vitest'
import { demoReanchorTransform } from '@/platform/coordinates/DemoReanchor'
import { chainageService } from '@/platform/coordinates/ChainageService'

describe('demo centerline reanchoring', () => {
  it('maps the source centerline anchor onto the requested YK target', () => {
    const source = chainageService.worldPositionAt(2244)!
    const target = chainageService.worldPositionAt(1346)!
    const moved = Cesium.Matrix4.multiplyByPoint(demoReanchorTransform(2244, 1346), source, new Cesium.Cartesian3())
    expect(Cesium.Cartesian3.distance(moved, target)).toBeLessThan(0.001)
  })

  it('rejects a target outside the surveyed YK centerline', () => {
    expect(() => demoReanchorTransform(2244, 100)).toThrow('超出 YK 中线范围')
  })
})
