import { describe, expect, it } from 'vitest'
import * as Cesium from 'cesium'
import { chainageService } from '@/platform/coordinates/ChainageService'
import { ventilationWorkpointView } from '@/platform/tasks/samples/SceneExplorationWorkflow'
import {
  VENTILATION_DISPLAY_ENTRANCE_CHAINAGE_YK,
  ventilationPositionToWorld,
  ventilationVectorToWorld,
} from '@/views/ventilation-module/spatialFrame'

const sourceMidpoint = 3905.151001
const sourceEntrance = 0
const sourceHeight = 3.764577
const at = (x: number, z: number) => ventilationPositionToWorld(
  new Cesium.Cartesian3(x, sourceHeight, z),
)

describe('通风异工点空间示意配准', () => {
  it('将右主洞入口放到平台中线直线起点，保留 200 m 直线和双洞间距', () => {
    const center = chainageService.positionAt(VENTILATION_DISPLAY_ENTRANCE_CHAINAGE_YK)!
    const centerWorld = Cesium.Cartesian3.fromDegrees(center.longitude, center.latitude, center.height + 3)
    expect(Cesium.Cartesian3.distance(at(0, sourceEntrance), centerWorld)).toBeLessThan(0.01)

    const first = at(0, sourceEntrance)
    const last = at(0, 200)
    const midpoint = Cesium.Cartesian3.midpoint(first, last, new Cesium.Cartesian3())
    expect(Cesium.Cartesian3.distance(midpoint, at(0, 100))).toBeLessThan(0.01)
    expect(Cesium.Cartesian3.distance(first, last)).toBeCloseTo(200, 3)
    expect(Cesium.Cartesian3.distance(at(32, sourceEntrance), centerWorld)).toBeCloseTo(32, 3)
    const forward = Cesium.Cartesian3.normalize(Cesium.Cartesian3.subtract(at(0, 200), first, new Cesium.Cartesian3()), new Cesium.Cartesian3())
    const up = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(centerWorld, new Cesium.Cartesian3())
    const left = Cesium.Cartesian3.normalize(Cesium.Cartesian3.cross(up, forward, new Cesium.Cartesian3()), new Cesium.Cartesian3())
    const leftTunnel = Cesium.Cartesian3.subtract(at(32, sourceEntrance), first, new Cesium.Cartesian3())
    const ddkSide = Cesium.Cartesian3.subtract(at(-32, sourceEntrance), first, new Cesium.Cartesian3())
    expect(Cesium.Cartesian3.dot(leftTunnel, left)).toBeGreaterThan(31.9)
    expect(Cesium.Cartesian3.dot(ddkSide, left)).toBeLessThan(-31.9)

    for (const [sourceZ, yk] of [[sourceEntrance, VENTILATION_DISPLAY_ENTRANCE_CHAINAGE_YK], [200, VENTILATION_DISPLAY_ENTRANCE_CHAINAGE_YK + 200]]) {
      const position = chainageService.positionAt(yk)!
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
