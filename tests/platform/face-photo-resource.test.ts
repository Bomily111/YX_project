import { readFileSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import { FACE_PHOTO_ID, facePhotoCatalog, facePhotoResources, getActiveFacePhotos, getActiveFaceSlices } from '@/modules/face-sketch/resources'
import * as Cesium from 'cesium'
vi.mock('@/utils/Common/DrawLine',()=>({waitForTunnelGlbSegment:async()=>({modelMatrix:Cesium.Matrix4.IDENTITY})}))
const facePhotoResource = facePhotoResources.find(resource => resource.id === FACE_PHOTO_ID)!
const task = (start: number) => ({ chainageRange: { start, end: start } }) as any
const stubViewer = () => ({
  entities: new Cesium.EntityCollection(),
  scene: { requestRender: vi.fn(), primitives: new Cesium.PrimitiveCollection() },
  isDestroyed: () => false,
}) as any
function stubTexture() {
  vi.stubGlobal('Image', class { src = ''; naturalWidth = 800; naturalHeight = 600; async decode() {} })
  vi.stubGlobal('HTMLCanvasElement', class {})
  vi.stubGlobal('HTMLImageElement', Image)
  vi.stubGlobal('ImageBitmap', class {})
  vi.stubGlobal('OffscreenCanvas', class {})
}
afterEach(async () => { await facePhotoResource.unload(); vi.unstubAllGlobals() })
it('repositions slice entities without accumulating old slices, then releases them', async () => {
  stubTexture()
  const viewer = stubViewer()
  await facePhotoResource.load({ viewer })
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
  stubTexture()
  await facePhotoResource.load({ viewer: stubViewer() })
  expect(getActiveFacePhotos()).toEqual([])
  await facePhotoResource.activate!(task(4000))
  expect(getActiveFacePhotos()).toEqual([facePhotoCatalog.find(photo => photo.id === FACE_PHOTO_ID)])
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
