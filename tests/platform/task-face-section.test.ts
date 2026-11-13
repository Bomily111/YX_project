import {expect,it} from 'vitest'
import * as C from 'cesium'
import {taskFaceSection,taskFaceGeometry} from '@/modules/face-sketch/task-face-section'
import profile from '@/modules/face-sketch/tunnel-normal-sections.json'
import origin from '@/modules/rock/three-bench.metadata.json'

it('retains every source section point and bounded uncalibrated photo UVs on its normal plane',()=>{
 const result=taskFaceSection(C.Matrix4.IDENTITY),s=profile.sections[0]!
 expect(result.positions.length).toBe(s.outline.length)
 expect(result.widthM).toBeCloseTo(11,3)
 const geometry=taskFaceGeometry(result)
 expect(geometry.indices!.length).toBeGreaterThan(0)
 for(let i=0;i<result.positions.length;i++){
  const p=result.positions[i]!,source=[origin.sourceGltfOrigin[0]!-p.z,p.y+origin.sourceGltfOrigin[1]!,p.x+origin.sourceGltfOrigin[2]!]
  const delta=source.map((v,j)=>v-s.frame.center[j]!)
  expect(Math.abs(delta.reduce((sum,v,j)=>sum+v*s.frame.forward[j]!,0))).toBeLessThan(1e-10)
  expect(delta.reduce((sum,v,j)=>sum+v*s.frame.lateral[j]!,0)).toBeCloseTo(s.outline[i]![0]!,8)
  expect(delta.reduce((sum,v,j)=>sum+v*s.frame.up[j]!,0)).toBeCloseTo(s.outline[i]![1]!,8)
  expect(result.uv[i]!.x).toBeGreaterThanOrEqual(0);expect(result.uv[i]!.x).toBeLessThanOrEqual(1)
  expect(result.uv[i]!.y).toBeGreaterThanOrEqual(0);expect(result.uv[i]!.y).toBeLessThanOrEqual(1)
  expect(geometry.attributes.st.values[i*2]).toBeCloseTo(result.uv[i]!.x,6)
  expect(geometry.attributes.st.values[i*2+1]).toBeCloseTo(result.uv[i]!.y,6)
 }
})
