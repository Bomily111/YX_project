import type { SceneResource } from '@/platform/resources/types'
import * as Cesium from 'cesium'
import { chainageService } from '@/platform/coordinates/ChainageService'
import { FACE_SKETCH_RECORDS } from './data'
import { waitForTunnelGlbSegment } from '@/utils/Common/DrawLine'
import { threeBenchMatrix } from '@/modules/rock/three-bench-resource'
import { taskFaceSection,taskFaceGeometry } from './task-face-section'
export const FACE_PHOTO_ID = 'rock.face-photos'
export const facePhotoCatalog = FACE_SKETCH_RECORDS.map(record => ({ sourceMileage: record.mileage, date: record.date, path: record.photoUrl.replace('_clean.png', '.jpg') })).sort((a,b) => b.date.localeCompare(a.date))
// Explicit example source: no surveyed correspondence to the requested YK is available.
const source = FACE_SKETCH_RECORDS.find(record => record.mileage === facePhotoCatalog[0].sourceMileage)!
export const faceSourceDescription = () => `掌子面示例来源 ${source.mileage}，资料日期 ${source.date}；按目标YK示意装配，尚未建立目标实测对应。照片仅为未标定的平面铺贴，不是实测三维重建；YK2+244使用源隧道法向轮廓载体，其他工段暂保留原载体。`
let loaded = false
let texture: HTMLImageElement | undefined
let viewer: Cesium.Viewer | undefined
let slice: Cesium.Entity | undefined
let sectionFrame:Cesium.Matrix4|undefined
let carrier:Cesium.Primitive|undefined
let placementRevision=0
export const getActiveFaceCarrier=()=>carrier
export const getActiveFaceSlices = () => slice ? [slice] : []
export const getActiveFacePhotos = () => loaded ? [facePhotoCatalog[0]] : []
async function placeSlice(chainage: number): Promise<void> {
  if (!viewer) return
  const revision=++placementRevision,targetViewer=viewer
  const station = chainageService.positionWithHeadingAt(chainage)
  if (!station) throw new Error('掌子面模型目标超出YK中线')
  if(chainage===2244&&!sectionFrame){
    const tunnel=await waitForTunnelGlbSegment(2,viewer)
    sectionFrame=threeBenchMatrix(tunnel.modelMatrix)
  }
  if(revision!==placementRevision||viewer!==targetViewer||targetViewer.isDestroyed())return
  const frame = Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromDegrees(station.longitude, station.latitude, station.height))
  const halfWidth = source.width * 0.96 / 2, halfHeight = source.height * 0.96 / 2
  const lateral = new Cesium.Cartesian3(Math.cos(station.heading), -Math.sin(station.heading), 0)
  const point = (sign: number) => Cesium.Matrix4.multiplyByPoint(frame, Cesium.Cartesian3.multiplyByScalar(lateral, sign * halfWidth, new Cesium.Cartesian3()), new Cesium.Cartesian3())
  if (slice) viewer.entities.remove(slice)
  if(carrier){viewer.scene.primitives.remove(carrier);carrier=undefined}
  if(chainage===2244&&sectionFrame){
    const section=taskFaceSection(sectionFrame)
    slice=viewer.entities.add({id:'task-face-slice',name:'掌子面照片 · 源断面轮廓载体（未标定）',show:true,
      position:section.center,
      properties:{sourceMileage:source.mileage,sourceDate:source.date,targetChainage:chainage,placement:'demonstration',
        carrier:'source-normal-section',profileSource:section.source,textureCalibration:'unverified',surfaceReconstruction:false},
      // Keep the source boundary on the entity for bounds/diagnostics; render
      // with explicit coplanar geometry to avoid geodetic UV triangulation.
      polygon:{show:false,hierarchy:new Cesium.PolygonHierarchy(section.positions),perPositionHeight:true,arcType:Cesium.ArcType.NONE,
        textureCoordinates:new Cesium.PolygonHierarchy(section.uv as unknown as Cesium.Cartesian3[]),
        material:new Cesium.ImageMaterialProperty({image:texture!,transparent:false}),
      },
    })
    carrier=viewer.scene.primitives.add(new Cesium.Primitive({
      geometryInstances:new Cesium.GeometryInstance({id:slice,geometry:taskFaceGeometry(section)}),
      appearance:new Cesium.MaterialAppearance({flat:true,faceForward:true,closed:false,translucent:false,
        material:Cesium.Material.fromType('Image',{image:texture!}),
      }),
      asynchronous:false,
    }))
    viewer.scene.requestRender()
    return
  }
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
    let nextFrame:Cesium.Matrix4|undefined
    if(context.task?.chainageRange.start===2244){
      const tunnel=await waitForTunnelGlbSegment(2,context.viewer)
      if(context.signal?.aborted)throw new DOMException('照片加载已取消','AbortError')
      nextFrame=threeBenchMatrix(tunnel.modelMatrix)
    }
    sectionFrame=nextFrame;texture=image;viewer=context.viewer;loaded=true
  },
  async activate(task) { await placeSlice(task.chainageRange.start) },
  async update(task) { await placeSlice(task.chainageRange.start) },
  async unload() {
    placementRevision++
    if(viewer&&!viewer.isDestroyed?.()&&carrier)viewer.scene.primitives.remove(carrier)
    carrier=undefined
    if (viewer && !viewer.isDestroyed?.() && slice) viewer.entities.remove(slice)
    slice = undefined; viewer = undefined; texture = undefined; sectionFrame=undefined; loaded = false
  },
  getActiveAssetPaths: () => loaded ? [source.textureUrl] : [],
  getEnhanceTargets: () => slice ? [{ id: 'task-face-source', type: 'face-source', metadata: {
    sourceMileage: source.mileage, sourceDate: source.date, texture: source.textureUrl, placement: 'demonstration',
    targetChainage: slice.properties?.targetChainage?.getValue(Cesium.JulianDate.now()),
    carrier:slice.polygon?'source-normal-section':'legacy-wall',textureCalibration:'unverified',surfaceReconstruction:false,
  } }] : [],
}
