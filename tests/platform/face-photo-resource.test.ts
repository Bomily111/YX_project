import { readFileSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import { facePhotoResource, facePhotoCatalog, getActiveFacePhotos } from '@/modules/face-sketch/resources'
import * as Cesium from 'cesium'
import { getActiveFaceSlices } from '@/modules/face-sketch/resources'
vi.mock('@/utils/Common/DrawLine',()=>({waitForTunnelGlbSegment:async()=>({modelMatrix:Cesium.Matrix4.IDENTITY})}))
afterEach(async () => { await facePhotoResource.unload(); vi.unstubAllGlobals() })
it('repositions slice entities without accumulating old slices, then releases them', async () => {
  vi.stubGlobal('Image', class { src = ''; naturalWidth = 800; naturalHeight = 600; async decode() {} })
  vi.stubGlobal('HTMLCanvasElement',class {})
  vi.stubGlobal('HTMLImageElement',Image)
  vi.stubGlobal('ImageBitmap',class {})
  vi.stubGlobal('OffscreenCanvas',class {})
  const viewer = { entities: new Cesium.EntityCollection(), scene: { requestRender: vi.fn(),primitives:new Cesium.PrimitiveCollection() },
    camera: { flyToBoundingSphere: vi.fn() }, isDestroyed: () => false } as any
  await facePhotoResource.load({ viewer })
  const task = (start: number) => ({ chainageRange: { start, end: start } }) as any
  await facePhotoResource.activate!(task(2244))
  const time = Cesium.JulianDate.now()
  const before = getActiveFaceSlices()[0].position!.getValue(time)!
  expect(getActiveFaceSlices()[0].polygon).toBeDefined()
  expect(getActiveFaceSlices()[0].wall).toBeUndefined()
  expect(viewer.scene.primitives.length).toBe(1)
  expect(getActiveFaceSlices()[0].properties!.textureCalibration.getValue(time)).toBe('unverified')
  await facePhotoResource.update!(task(4000))
  const after = getActiveFaceSlices()[0].position!.getValue(time)!
  expect(viewer.scene.primitives.length).toBe(0)
  expect(Cesium.Cartesian3.distance(before, after)).toBeGreaterThan(1000)
  await facePhotoResource.update!(task(4000))
  expect(viewer.entities.values).toHaveLength(1)
  expect(Cesium.Cartesian3.distance(after, getActiveFaceSlices()[0].position!.getValue(time)!)).toBe(0)
  await facePhotoResource.unload()
  expect(viewer.entities.values).toHaveLength(0)
})
it('loads only one task texture and preserves source labels', async () => {
  vi.stubGlobal('Image', class { src = ''; naturalWidth = 800; naturalHeight = 600; async decode() {} })
  await facePhotoResource.load({ viewer: {} as any })
  expect(getActiveFacePhotos()).toHaveLength(1)
  for (const photo of facePhotoCatalog) {
    expect(photo.sourceMileage).toMatch(/^X1DK/)
    expect(readFileSync(`public${photo.path}`).subarray(0, 2)).toEqual(Buffer.from([255, 216]))
  }
  expect(facePhotoResource.getActiveAssetPaths!()).toHaveLength(1)
  await facePhotoResource.unload()
  expect(getActiveFacePhotos()).toEqual([])
})
it('does not publish references when image decoding fails', async () => {
  vi.stubGlobal('Image', class { src = ''; async decode() { throw new Error('broken photo') } })
  await expect(facePhotoResource.load({ viewer: {} as any })).rejects.toThrow('broken photo')
  expect(facePhotoResource.getActiveAssetPaths!()).toEqual([])
})
