import { describe, expect, it } from 'vitest'
import * as Cesium from 'cesium'
import { chainageService } from '@/platform/coordinates/ChainageService'
import { ventilationWorkpointView } from '@/platform/tasks/samples/SceneExplorationWorkflow'
import {
  VENTILATION_DISPLAY_CHAINAGE,
  ventilationPositionToWorld,
  ventilationVectorToWorld,
} from '@/views/ventilation-module/spatialFrame'

const sourceMidpoint = 3905.151001
const sourceHeight = 3.764577
const at = (x: number, z: number) => ventilationPositionToWorld(
  new Cesium.Cartesian3(x, sourceHeight, z),
)

describe('通风异工点空间示意配准', () => {
  it('将右主洞中心投影到 DK278+330 中线，保留 200 m 直线和双洞间距', () => {
    const center = chainageService.positionAt(VENTILATION_DISPLAY_CHAINAGE, chainageService.legacyDkReference)!
    const centerWorld = Cesium.Cartesian3.fromDegrees(center.longitude, center.latitude, center.height + 3)
    expect(Cesium.Cartesian3.distance(at(0, sourceMidpoint), centerWorld)).toBeLessThan(0.01)

    const first = at(0, sourceMidpoint - 100)
    const last = at(0, sourceMidpoint + 100)
    const midpoint = Cesium.Cartesian3.midpoint(first, last, new Cesium.Cartesian3())
    expect(Cesium.Cartesian3.distance(midpoint, centerWorld)).toBeLessThan(0.01)
    expect(Cesium.Cartesian3.distance(first, last)).toBeCloseTo(200, 3)
    expect(Cesium.Cartesian3.distance(at(32, sourceMidpoint), centerWorld)).toBeCloseTo(32, 3)

    for (const [sourceZ, dk] of [[sourceMidpoint - 100, 278230], [sourceMidpoint + 100, 278430]]) {
      const position = chainageService.positionAt(dk, chainageService.legacyDkReference)!
      const tunnel = Cesium.Cartesian3.fromDegrees(position.longitude, position.latitude, position.height + 3)
      expect(Cesium.Cartesian3.distance(at(0, sourceZ), tunnel)).toBeLessThan(3)
    }
    expect(Cesium.Cartesian3.magnitude(ventilationVectorToWorld(new Cesium.Cartesian3(0, 0, 1)))).toBeCloseTo(1, 5)
  })

  it('智能体通风阶段镜头确实朝向配准后的右主洞工点', () => {
    const view = ventilationWorkpointView()
    expect(Cesium.Cartesian3.distance(view.target, at(0, sourceMidpoint))).toBeLessThan(0.01)
    const forward = Cesium.Cartesian3.normalize(
      Cesium.Cartesian3.subtract(view.target, view.destination, new Cesium.Cartesian3()),
      new Cesium.Cartesian3(),
    )
    expect(Cesium.Cartesian3.dot(forward, view.direction)).toBeCloseTo(1, 6)
    expect(Cesium.Cartesian3.magnitude(view.up)).toBeCloseTo(1, 6)
    expect(Cesium.Cartesian3.distance(view.target, view.destination)).toBeGreaterThan(100)
    expect(Cesium.Cartesian3.distance(view.target, view.destination)).toBeLessThan(250)
  })
})
