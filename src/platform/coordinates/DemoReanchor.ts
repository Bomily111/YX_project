import * as Cesium from 'cesium'
import { chainageService } from './ChainageService'

/** Move an existing local model layout between two surveyed YK centerline frames. Geometry stays unchanged. */
export function demoReanchorTransform(sourceChainage: number, targetChainage: number): Cesium.Matrix4 {
  const source = chainageService.positionWithHeadingAt(sourceChainage)
  const target = chainageService.positionWithHeadingAt(targetChainage)
  if (!source || !target) throw new Error('示意装配目标超出 YK 中线范围')
  const frame = (point: typeof source) => Cesium.Transforms.headingPitchRollToFixedFrame(
    Cesium.Cartesian3.fromDegrees(point.longitude, point.latitude, point.height),
    new Cesium.HeadingPitchRoll(point.heading, 0, 0),
  )
  return Cesium.Matrix4.multiply(
    frame(target),
    Cesium.Matrix4.inverseTransformation(frame(source), new Cesium.Matrix4()),
    new Cesium.Matrix4(),
  )
}
