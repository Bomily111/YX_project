import { describe, expect, it } from 'vitest'
import * as Cesium from 'cesium'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { chainageService } from '@/platform/coordinates/ChainageService'
import { modelerSectionFrame, modelerSupportCatalog } from '@/modules/support/modeler-resources'

describe('delivered support section placement', () => {
  it('maps the delivered design-elevation point onto the platform YK centerline', () => {
    for (const chainage of [1116, 1346, 2170]) {
      const world = Cesium.Matrix4.multiplyByPoint(modelerSectionFrame(chainage),
        new Cesium.Cartesian3(0, -2.1, 0), new Cesium.Cartesian3())
      const centerline = chainageService.worldPositionAt(chainage)!
      expect(Cesium.Cartesian3.distance(world, centerline)).toBeLessThan(0.001)
    }
  })

  it('exposes each delivered 1 m section once with a public GLB path', () => {
    expect(modelerSupportCatalog).toHaveLength(13)
    expect(new Set(modelerSupportCatalog.map(asset => asset.id)).size).toBe(13)
    expect(modelerSupportCatalog.every(asset => asset.path.startsWith('/support-modeler/outputs/')
      && asset.path.endsWith('.glb'))).toBe(true)
    expect(modelerSupportCatalog.every(asset => existsSync(join(process.cwd(), 'public', asset.path.slice(1))))).toBe(true)
  })
})
