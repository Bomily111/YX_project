import { expect, it } from 'vitest'
import * as C from 'cesium'
import profile from '@/modules/face-sketch/tunnel-normal-sections.json'
import { existingSupportPlacement } from '@/modules/support/test-section-resource'
it('uses centerline normal planes rather than fixed source X cuts',()=>{
  expect(profile.oldFixedPlaneObliquityDeg).toBeGreaterThan(10)
  for(const s of [...profile.sections,...profile.supportSections]){
    const f=C.Cartesian3.fromArray(s.frame.forward),r=C.Cartesian3.fromArray(s.frame.lateral),u=C.Cartesian3.fromArray(s.frame.up)
    expect(C.Cartesian3.dot(f,r)).toBeCloseTo(0,12)
    expect(C.Cartesian3.dot(f,u)).toBeCloseTo(0,12)
    expect(C.Cartesian3.magnitude(f)).toBeCloseTo(1,12)
  }
})
it('orients every original support unit along its own station tangent without scaling',()=>{
  for(const s of profile.supportSections){
    const m=existingSupportPlacement(s.distanceM)
    const direction=C.Matrix4.multiplyByPointAsVector(m,C.Cartesian3.UNIT_Z,new C.Cartesian3())
    expect(direction.x).toBeCloseTo(s.frame.forward[2],12)
    expect(direction.y).toBeCloseTo(s.frame.forward[1],12)
    expect(direction.z).toBeCloseTo(-s.frame.forward[0],12)
    const scale=C.Matrix4.getScale(m,new C.Cartesian3())
    expect(scale.x).toBeCloseTo(1,12);expect(scale.y).toBeCloseTo(1,12);expect(scale.z).toBeCloseTo(1,12)
  }
})
it('limits curved template joints to millimetres instead of the old lateral offset',()=>{
  let largest=0
  for(let s=-20.5;s< -1.5;s++){
    const a=existingSupportPlacement(s),b=existingSupportPlacement(s+1)
    for(const x of [-6.36,0,6.36]){
      const end=C.Matrix4.multiplyByPoint(a,new C.Cartesian3(x,0,1),new C.Cartesian3())
      const start=C.Matrix4.multiplyByPoint(b,new C.Cartesian3(x,0,0),new C.Cartesian3())
      largest=Math.max(largest,C.Cartesian3.distance(end,start))
    }
  }
  expect(largest).toBeLessThan(.01)
  const first=existingSupportPlacement(-20.5),last=existingSupportPlacement(-1.5)
  expect(C.Matrix3.equalsEpsilon(C.Matrix4.getMatrix3(first,new C.Matrix3()),C.Matrix4.getMatrix3(last,new C.Matrix3()),1e-6)).toBe(false)
})
