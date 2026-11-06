import type { SceneResource } from '@/platform/resources/types'
import * as Cesium from 'cesium'
import { chainageService } from '@/platform/coordinates/ChainageService'
import { FACE_SKETCH_RECORDS } from './data'
export const FACE_PHOTO_ID = 'rock.face-photos'
export const facePhotoCatalog = FACE_SKETCH_RECORDS.map(record => ({ sourceMileage: record.mileage, date: record.date, path: record.photoUrl.replace('_clean.png', '.jpg') })).sort((a,b) => b.date.localeCompare(a.date))
// Explicit example source: no surveyed correspondence to the requested YK is available.
const source = FACE_SKETCH_RECORDS.find(record => record.mileage === facePhotoCatalog[0].sourceMileage)!
export const faceSourceDescription = () => `掌子面示例来源 ${source.mileage}，资料日期 ${source.date}；按目标YK示意装配，尚未建立目标实测对应。`
let loaded = false
let texture: HTMLImageElement | undefined
let viewer: Cesium.Viewer | undefined
let slice: Cesium.Entity | undefined
export const getActiveFaceSlices = () => slice ? [slice] : []
export const getActiveFacePhotos = () => loaded ? [facePhotoCatalog[0]] : []
function placeSlice(chainage: number): void {
  if (!viewer) return
  const station = chainageService.positionWithHeadingAt(chainage)
  if (!station) throw new Error('掌子面模型目标超出YK中线')
  const frame = Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromDegrees(station.longitude, station.latitude, station.height))
  const halfWidth = source.width * 0.96 / 2, halfHeight = source.height * 0.96 / 2
  const lateral = new Cesium.Cartesian3(Math.cos(station.heading), -Math.sin(station.heading), 0)
  const point = (sign: number) => Cesium.Matrix4.multiplyByPoint(frame, Cesium.Cartesian3.multiplyByScalar(lateral, sign * halfWidth, new Cesium.Cartesian3()), new Cesium.Cartesian3())
  if (slice) viewer.entities.remove(slice)
  slice = viewer.entities.add({
    id: 'task-face-slice', name: '掌子面示意模型 · 来源 ' + source.mileage, show: true,
    position: Cesium.Cartesian3.fromDegrees(station.longitude, station.latitude, station.height + 3),
    properties: { sourceMileage: source.mileage, sourceDate: source.date, targetChainage: chainage, placement: 'demonstration' },
    wall: { positions: [point(1), point(-1)],
      minimumHeights: [station.height + 3 - halfHeight, station.height + 3 - halfHeight],
      maximumHeights: [station.height + 3 + halfHeight, station.height + 3 + halfHeight],
      material: new Cesium.ImageMaterialProperty({ image: texture!, transparent: false }) },
  })
  viewer.scene.requestRender()
}
export const facePhotoResource: SceneResource = {
  id: FACE_PHOTO_ID, module: 'rock', type: 'task-workface', chainageRange: { start: 1116, end: 9400 },
  processes: ['excavation', 'inspection'], states: ['reference'], dependencies: ['common.tunnel'], lifetime: 'task',
  async load(context) {
    const image = new Image(); image.src = source.textureUrl; await image.decode()
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('掌子面纹理无法解码')
    if (context.signal?.aborted) throw new DOMException('照片加载已取消', 'AbortError')
    texture = image; loaded = true; viewer = context.viewer
  },
  async activate(task) { placeSlice(task.chainageRange.start) },
  async update(task) { placeSlice(task.chainageRange.start) },
  async unload() {
    if (viewer && !viewer.isDestroyed?.() && slice) viewer.entities.remove(slice)
    slice = undefined; viewer = undefined; texture = undefined; loaded = false
  },
  getActiveAssetPaths: () => loaded ? [source.textureUrl] : [],
  getEnhanceTargets: () => slice ? [{ id: 'task-face-source', type: 'face-source', metadata: {
    sourceMileage: source.mileage, sourceDate: source.date, texture: source.textureUrl, placement: 'demonstration',
    targetChainage: slice.properties?.targetChainage?.getValue(Cesium.JulianDate.now()),
  } }] : [],
}
