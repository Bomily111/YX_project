import { expect, it } from 'vitest'
import * as C from 'cesium'
import { readFileSync } from 'node:fs'
import { THREE_BENCH_PATH, threeBenchMatrix, validateThreeBenchChainage } from '@/modules/rock/three-bench-resource'
import metadata from '@/modules/rock/three-bench.metadata.json'
import { resolveAssemblyMileage } from '@/ai-agent/tools/workflow.tools'

it('uses the agreed test section only when requested and preserves explicit mileage', () => {
  expect(resolveAssemblyMileage('YK4+000','在论文测试工段展示三台阶模型')).toBe('YK2+244')
  expect(resolveAssemblyMileage('YK2+244','在YK4+000测试工段展示三台阶')).toBe('YK4+000')
  expect(() => resolveAssemblyMileage('YK2+244','展示支护')).toThrow('用户未明确')
})

it('maps exported bench coordinates back to the original tunnel geometry without rescaling', () => {
  const tunnel = C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(94.9046,29.5335,2950))
  const local = new C.Cartesian3(2,3,-6)
  const actual = C.Matrix4.multiplyByPoint(threeBenchMatrix(tunnel),local,new C.Cartesian3())
  // Asset (lateral,height,-advance) -> original glTF -> Cesium Z-up/X-forward.
  const source = new C.Cartesian3(metadata.sourceGltfOrigin[0]+6,3,metadata.sourceGltfOrigin[2]+2)
  const corrected = new C.Cartesian3(source.z,source.x,source.y)
  const expected = C.Matrix4.multiplyByPoint(tunnel,corrected,new C.Cartesian3())
  expect(C.Cartesian3.distance(actual,expected)).toBeLessThan(1e-6)
})
it('keeps source correspondence within the agreed test section', () => {
  expect(() => validateThreeBenchChainage(2244)).not.toThrow()
  expect(() => validateThreeBenchChainage(4000)).toThrow('其他工段')
})
it('uses the named asset beside the other tunnel models and preserves metadata', () => {
  expect(readFileSync(`public${THREE_BENCH_PATH}`).subarray(0,4).toString()).toBe('glTF')
  expect(JSON.parse(readFileSync('public/data/tunnel/三台阶.metadata.json','utf8'))).toEqual(metadata)
})
