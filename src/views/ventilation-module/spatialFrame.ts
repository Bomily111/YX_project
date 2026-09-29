import * as Cesium from 'cesium'

// 将通风计算使用的局部工程坐标锚定到隧洞围岩版块附近。
// 局部轴：X=横向、Y=高程、Z=隧道里程方向。
export const VENTILATION_LOCAL_REFERENCE = new Cesium.Cartesian3(20.001704, 3.764577, 3905.151001)
// 主隧道中线最长直线段的起点和方向，与 DrawLine 中的直线段检测结果一致。
const WORLD_ANCHOR = Cesium.Cartesian3.fromDegrees(94.9161586857, 29.529427666, 2951.131)
const heading = Cesium.Math.toRadians(128.879572)
// 将双洞首部的横向中心放到中线直线段起点。
const MODEL_HEAD_REFERENCE = new Cesium.Cartesian3(16, 0, 0)

const lateral = new Cesium.Cartesian3(Math.cos(heading), -Math.sin(heading), 0)
const up = Cesium.Cartesian3.UNIT_Z
const forward = new Cesium.Cartesian3(Math.sin(heading), Math.cos(heading), 0)
const rotation = new Cesium.Matrix3()
Cesium.Matrix3.setColumn(rotation, 0, lateral, rotation)
Cesium.Matrix3.setColumn(rotation, 1, up, rotation)
Cesium.Matrix3.setColumn(rotation, 2, forward, rotation)
const rotatedReference = Cesium.Matrix3.multiplyByVector(rotation, MODEL_HEAD_REFERENCE, new Cesium.Cartesian3())
const localTranslation = Cesium.Cartesian3.negate(rotatedReference, new Cesium.Cartesian3())
const localPlacement = Cesium.Matrix4.fromRotationTranslation(rotation, localTranslation)
const enuFrame = Cesium.Transforms.eastNorthUpToFixedFrame(WORLD_ANCHOR)

export const VENTILATION_MODEL_MATRIX = Cesium.Matrix4.multiply(
  enuFrame,
  localPlacement,
  new Cesium.Matrix4(),
)
const VENTILATION_INVERSE_MATRIX = Cesium.Matrix4.inverseTransformation(
  VENTILATION_MODEL_MATRIX,
  new Cesium.Matrix4(),
)

export function ventilationPositionToWorld(position: Cesium.Cartesian3) {
  return Cesium.Matrix4.multiplyByPoint(VENTILATION_MODEL_MATRIX, position, new Cesium.Cartesian3())
}

export function ventilationVectorToWorld(vector: Cesium.Cartesian3) {
  return Cesium.Matrix4.multiplyByPointAsVector(VENTILATION_MODEL_MATRIX, vector, new Cesium.Cartesian3())
}

export function ventilationPositionToLocal(position: Cesium.Cartesian3) {
  return Cesium.Matrix4.multiplyByPoint(VENTILATION_INVERSE_MATRIX, position, new Cesium.Cartesian3())
}

