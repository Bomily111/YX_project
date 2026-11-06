import * as C from 'cesium'
import { expect, it } from 'vitest'
import { blastPlacementMatrix, BLAST_SOURCE_FORWARD_GLTF } from '@/views/tunnel-module/blast'
import { segmentModelMatrix } from '@/views/tunnel-module/tunnel'
import { chainageService } from '@/platform/coordinates/ChainageService'

it('aligns the baked blast section normal with increasing target YK chainage', () => {
  const base = segmentModelMatrix(0)
  const correction = C.Matrix4.multiply(C.Matrix4.fromRotationTranslation(C.Matrix3.fromRotationX(Math.PI / 2)),
    C.Matrix4.fromRotationTranslation(C.Matrix3.fromRotationY(Math.PI / 2)), new C.Matrix4())
  const localCenter = C.Matrix4.multiplyByPoint(correction, new C.Cartesian3(252, 1.8, -57), new C.Cartesian3())
  const sourceCenter = C.Matrix4.multiplyByPoint(base, localCenter, new C.Cartesian3())
  const localForward = C.Matrix4.multiplyByPointAsVector(correction, BLAST_SOURCE_FORWARD_GLTF, new C.Cartesian3())
  for (const chainage of [3900, 4000, 4100]) {
    const matrix = blastPlacementMatrix(base, sourceCenter, chainage)
    const actual = C.Cartesian3.normalize(C.Matrix4.multiplyByPointAsVector(matrix, localForward, new C.Cartesian3()), new C.Cartesian3())
    const station = chainageService.positionWithHeadingAt(chainage)!
    const target = C.Cartesian3.fromDegrees(station.longitude, station.latitude, station.height + 3)
    const expected = C.Matrix4.multiplyByPointAsVector(C.Transforms.eastNorthUpToFixedFrame(target),
      new C.Cartesian3(Math.sin(station.heading), Math.cos(station.heading), 0), new C.Cartesian3())
    expect(C.Cartesian3.dot(actual, expected)).toBeGreaterThan(0.99999)
    expect(C.Cartesian3.distance(C.Matrix4.multiplyByPoint(matrix, localCenter, new C.Cartesian3()), target)).toBeLessThan(0.001)
  }
})
