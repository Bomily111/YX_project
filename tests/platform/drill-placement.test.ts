import * as C from 'cesium'
import { expect, it, vi } from 'vitest'
import { drillPlacement, DRILL_DISPLAY_START, advanceDrillResource, getActiveDrillModels } from '@/modules/rock/drill-resource'
import { chainageService } from '@/platform/coordinates/ChainageService'
it('cleans partial geometry if the second asset fails to load', async () => {
  const primitives = new Set()
  const viewer = { scene: { primitives: { add: (model: unknown) => primitives.add(model), remove: (model: unknown) => primitives.delete(model) }, requestRender() {} } } as any
  const mock = vi.spyOn(C.Model, 'fromGltfAsync').mockResolvedValueOnce({} as any).mockRejectedValueOnce(new Error('second GLB unavailable'))
  try {
    await expect(advanceDrillResource.load({ viewer })).rejects.toThrow('second GLB')
    expect(primitives.size).toBe(0)
    expect(getActiveDrillModels()).toEqual([])
    expect(advanceDrillResource.getActiveAssetPaths!()).toEqual([])
  } finally { mock.mockRestore() }
})
it('maps the delivered display start to the target and native long axis to increasing YK', () => {
  for (const chainage of [1346, 2244, 4000]) {
    const station = chainageService.positionWithHeadingAt(chainage)!
    const center = C.Cartesian3.fromDegrees(station.longitude, station.latitude, station.height + 3)
    const enu = C.Transforms.eastNorthUpToFixedFrame(center)
    const forward = C.Matrix4.multiplyByPointAsVector(enu, new C.Cartesian3(Math.sin(station.heading), Math.cos(station.heading), 0), new C.Cartesian3())
    const matrix = drillPlacement(chainage, 0)
    expect(C.Cartesian3.distance(C.Matrix4.multiplyByPoint(matrix, DRILL_DISPLAY_START, new C.Cartesian3()), center)).toBeLessThan(1e-7)
    const along = C.Cartesian3.normalize(C.Matrix4.multiplyByPointAsVector(matrix, C.Cartesian3.UNIT_X, new C.Cartesian3()), new C.Cartesian3())
    expect(C.Cartesian3.dot(along, forward)).toBeGreaterThan(0.999999)
  }
})
