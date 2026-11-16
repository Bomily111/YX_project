import {expect,it} from 'vitest'
import * as C from 'cesium'
import {volumeSamplingDomain} from '@/platform/tasks/VolumeSamplingDomain'
const properties={xmin:0,xmax:1,ymin:.2,ymax:1,zmin:0,zmax:1}
it('uses actual transforms and clipping extents rather than declared chainage ranges',()=>{
 const m=C.Matrix4.fromTranslationQuaternionRotationScale(new C.Cartesian3(100,200,300),C.Quaternion.IDENTITY,new C.Cartesian3(20,100,30))
 const r=volumeSamplingDomain(C.Matrix4.toArray(m),properties)
 expect(r.dimensionsM).toEqual([20,80,30]);expect(r.corners).toHaveLength(8)
 expect(r.corners[0]).toEqual(new C.Cartesian3(100,220,300))
 expect(r.sphere.center).toEqual(new C.Cartesian3(110,260,315))
 expect(r.scope).toContain('not-geological-boundary')
})
it('rejects missing, reversed and nonfinite bounds',()=>{
 for(const overrides of [{xmin:NaN},{xmin:1},{ymax:2},{zmin:undefined}])expect(()=>volumeSamplingDomain(C.Matrix4.toArray(C.Matrix4.IDENTITY),{...properties,...overrides})).toThrow()
 expect(()=>volumeSamplingDomain([NaN],properties)).toThrow()
})
