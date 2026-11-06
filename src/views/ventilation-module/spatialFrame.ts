import * as Cesium from 'cesium'
import { chainageService } from '@/platform/coordinates/ChainageService'

// 通风 CFD 原始数据仍属于 K3+805～K4+005。这里只做展示配准：
// 将通风入口放在平台中线由曲线进入直线的位置；仍属于展示配准。
// 局部轴：X=横向、Y=高程、Z=通风数据原始里程方向。
export const VENTILATION_LOCAL_REFERENCE = new Cesium.Cartesian3(20.001704, 3.764577, 3905.151001)
export const VENTILATION_DISPLAY_ENTRANCE_CHAINAGE_YK = 3446
const start = chainageService.positionAt(VENTILATION_DISPLAY_ENTRANCE_CHAINAGE_YK)!
const end = chainageService.positionAt(VENTILATION_DISPLAY_ENTRANCE_CHAINAGE_YK + 200)!
// 用区间弦线定向，避免取单个采样点的切线方向把直段端头甩离中线。
const metresPerDegreeLongitude = 111320 * Math.cos(Cesium.Math.toRadians(start.latitude))
const heading = Math.atan2(
  (end.longitude - start.longitude) * metresPerDegreeLongitude,
  (end.latitude - start.latitude) * 110940,
)
const WORLD_ANCHOR = Cesium.Cartesian3.fromDegrees(start.longitude, start.latitude, start.height + 3)
// 右主洞中心对齐工点中线；另一条主洞保持原始约 32 m 的横向间距。
// The 2D plan shows both main tunnels flush at K0. Anchor that portal,
// rather than the K3+805 CFD sample interval, to the platform straight start.
const MODEL_DISPLAY_REFERENCE = new Cesium.Cartesian3(0, 3.764577, 0)

// In the 2D plan positive X is the left/TBM tunnel. With increasing chainage
// along forward, geographic left is (-cos(heading), sin(heading)).
const lateral = new Cesium.Cartesian3(-Math.cos(heading), Math.sin(heading), 0)
const up = Cesium.Cartesian3.UNIT_Z
const forward = new Cesium.Cartesian3(Math.sin(heading), Math.cos(heading), 0)
const rotation = new Cesium.Matrix3()
Cesium.Matrix3.setColumn(rotation, 0, lateral, rotation)
Cesium.Matrix3.setColumn(rotation, 1, up, rotation)
Cesium.Matrix3.setColumn(rotation, 2, forward, rotation)
const rotatedReference = Cesium.Matrix3.multiplyByVector(rotation, MODEL_DISPLAY_REFERENCE, new Cesium.Cartesian3())
const localTranslation = Cesium.Cartesian3.negate(rotatedReference, new Cesium.Cartesian3())
const localPlacement = Cesium.Matrix4.fromRotationTranslation(rotation, localTranslation)
const enuFrame = Cesium.Transforms.eastNorthUpToFixedFrame(WORLD_ANCHOR)

export const VENTILATION_MODEL_MATRIX = Cesium.Matrix4.multiply(
  enuFrame,
  localPlacement,
  new Cesium.Matrix4(),
)
// Agent composition uses the existing YK tunnel as its carrier. The CFD
// interval is short and straight here; the full 7.8 km ventilation GLB is not
// placed over the project tunnel.
export const VENTILATION_COMBINATION_RANGE_YK = { start: 3900, end: 4100 } as const
const combinedStart = chainageService.positionAt(VENTILATION_COMBINATION_RANGE_YK.start)!
const combinedEnd = chainageService.positionAt(VENTILATION_COMBINATION_RANGE_YK.end)!
const combinedCenter = chainageService.positionAt(4000)!
const combinedHeading = Math.atan2(
  (combinedEnd.longitude - combinedStart.longitude) * 111320 * Math.cos(Cesium.Math.toRadians(combinedCenter.latitude)),
  (combinedEnd.latitude - combinedStart.latitude) * 110940,
)
const combinedRotation = new Cesium.Matrix3()
Cesium.Matrix3.setColumn(combinedRotation, 0, new Cesium.Cartesian3(-Math.cos(combinedHeading), Math.sin(combinedHeading), 0), combinedRotation)
Cesium.Matrix3.setColumn(combinedRotation, 1, Cesium.Cartesian3.UNIT_Z, combinedRotation)
Cesium.Matrix3.setColumn(combinedRotation, 2, new Cesium.Cartesian3(Math.sin(combinedHeading), Math.cos(combinedHeading), 0), combinedRotation)
const combinedReference = new Cesium.Cartesian3(0, 3.764577, 3905.151001)
const combinedTranslation = Cesium.Cartesian3.negate(
  Cesium.Matrix3.multiplyByVector(combinedRotation, combinedReference, new Cesium.Cartesian3()), new Cesium.Cartesian3())
const combinedLocal = Cesium.Matrix4.fromRotationTranslation(combinedRotation, combinedTranslation)
const combinedEnu = Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromDegrees(
  combinedCenter.longitude, combinedCenter.latitude, combinedCenter.height + 3))
const COMBINED_CFD_MATRIX = Cesium.Matrix4.multiply(combinedEnu, combinedLocal, new Cesium.Matrix4())
let useCombinedCfdPlacement = false
export function setVentilationCombinedPlacement(enabled: boolean): void { useCombinedCfdPlacement = enabled }
const VENTILATION_INVERSE_MATRIX = Cesium.Matrix4.inverseTransformation(
  VENTILATION_MODEL_MATRIX,
  new Cesium.Matrix4(),
)
const COMBINED_INVERSE_MATRIX = Cesium.Matrix4.inverseTransformation(COMBINED_CFD_MATRIX, new Cesium.Matrix4())

/** Capture a placement for one layer build, including its animation callbacks. */
export function captureVentilationFrame(combined = useCombinedCfdPlacement) {
  const matrix = combined ? COMBINED_CFD_MATRIX : VENTILATION_MODEL_MATRIX
  const inverse = combined ? COMBINED_INVERSE_MATRIX : VENTILATION_INVERSE_MATRIX
  return {
    toWorld: (position: Cesium.Cartesian3) => Cesium.Matrix4.multiplyByPoint(matrix, position, new Cesium.Cartesian3()),
    vectorToWorld: (vector: Cesium.Cartesian3) => Cesium.Matrix4.multiplyByPointAsVector(matrix, vector, new Cesium.Cartesian3()),
    toLocal: (position: Cesium.Cartesian3) => Cesium.Matrix4.multiplyByPoint(inverse, position, new Cesium.Cartesian3()),
  }
}

export function ventilationPositionToWorld(position: Cesium.Cartesian3) {
  return Cesium.Matrix4.multiplyByPoint(useCombinedCfdPlacement ? COMBINED_CFD_MATRIX : VENTILATION_MODEL_MATRIX, position, new Cesium.Cartesian3())
}

export function ventilationVectorToWorld(vector: Cesium.Cartesian3) {
  return Cesium.Matrix4.multiplyByPointAsVector(useCombinedCfdPlacement ? COMBINED_CFD_MATRIX : VENTILATION_MODEL_MATRIX, vector, new Cesium.Cartesian3())
}

export function ventilationPositionToLocal(position: Cesium.Cartesian3) {
  return Cesium.Matrix4.multiplyByPoint(useCombinedCfdPlacement ? COMBINED_INVERSE_MATRIX : VENTILATION_INVERSE_MATRIX, position, new Cesium.Cartesian3())
}

