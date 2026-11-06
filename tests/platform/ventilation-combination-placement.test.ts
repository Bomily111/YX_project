import * as Cesium from 'cesium'
import { afterEach, describe, expect, it } from 'vitest'
import { chainageService } from '@/platform/coordinates/ChainageService'
import { captureVentilationFrame, setVentilationCombinedPlacement, ventilationPositionToWorld, ventilationPositionToLocal } from '@/views/ventilation-module/spatialFrame'

afterEach(() => setVentilationCombinedPlacement(false))

describe('steady CFD composition on the YK centerline', () => {
  it('can initialize a topic frame while the previous combined scene is still active', () => {
    setVentilationCombinedPlacement(false)
    const point = new Cesium.Cartesian3(20, 3.764577, 3905.151001)
    const expected = ventilationPositionToWorld(point)
    setVentilationCombinedPlacement(true)
    const topic = captureVentilationFrame(false)
    expect(Cesium.Cartesian3.distance(topic.toWorld(point), expected)).toBe(0)
    expect(Cesium.Cartesian3.distance(topic.toLocal(expected), point)).toBeLessThan(1e-7)
  })
  it.each([false, true])('round trips local control points in combined=%s', combined => {
    setVentilationCombinedPlacement(combined)
    for (const point of [new Cesium.Cartesian3(-5.5, 0.2, 3805), new Cesium.Cartesian3(5.5, 6.8, 4005)]) {
      expect(Cesium.Cartesian3.distance(ventilationPositionToLocal(ventilationPositionToWorld(point)), point)).toBeLessThan(1e-7)
    }
  })

  it('keeps a captured field frame stable across page placement changes', () => {
    setVentilationCombinedPlacement(true)
    const frame = captureVentilationFrame()
    const point = new Cesium.Cartesian3(0, 3.764577, 3905.151001)
    const before = frame.toWorld(point)
    const vector = frame.vectorToWorld(Cesium.Cartesian3.UNIT_Z)
    setVentilationCombinedPlacement(false)
    expect(Cesium.Cartesian3.distance(frame.toWorld(point), before)).toBe(0)
    expect(Cesium.Cartesian3.distance(frame.vectorToWorld(Cesium.Cartesian3.UNIT_Z), vector)).toBe(0)
    expect(Cesium.Cartesian3.distance(frame.toLocal(before), point)).toBeLessThan(1e-7)
    expect(Cesium.Cartesian3.distance(ventilationPositionToWorld(point), before)).toBeGreaterThan(1000)
  })
  it('places the right-tunnel CFD interval within one metre of the target alignment', () => {
    setVentilationCombinedPlacement(true)
    for (const [source, target] of [[3805.151, 3900], [3905.151, 4000], [4005.151, 4100]]) {
      const position = chainageService.positionAt(target)!
      const expected = Cesium.Cartesian3.fromDegrees(position.longitude, position.latitude, position.height + 3)
      const actual = ventilationPositionToWorld(new Cesium.Cartesian3(0, 3.764577, source))
      expect(Cesium.Cartesian3.distance(actual, expected)).toBeLessThan(1)
    }
  })
})
