import * as C from 'cesium'
import {expect,it} from 'vitest'
import {supportContextSphere,supportContextReference} from '@/platform/tasks/SupportContextView'
it('includes the focus and the nearest actual sampling-box reference without framing the full long volume',()=>{
 const corners:C.Cartesian3[]=[];for(const x of [0,10])for(const y of [20,120])for(const z of [0,10])corners.push(new C.Cartesian3(x,y,z))
 const support=new C.BoundingSphere(new C.Cartesian3(5,0,5),3),sphere=supportContextSphere(support,corners)
 expect(C.Cartesian3.distance(sphere.center,support.center)+support.radius).toBeLessThanOrEqual(sphere.radius+1e-6)
 expect(C.Cartesian3.distance(sphere.center,new C.Cartesian3(5,20,5))+4).toBeLessThanOrEqual(sphere.radius+1e-6)
 expect(sphere.radius).toBeLessThan(25)
 expect(()=>supportContextSphere(support,[])).toThrow('缺少')
})

it('keeps reference probes in the sampling domain and rejects a sheared reference basis',()=>{
 const corners:C.Cartesian3[]=[];for(const x of [0,10])for(const y of [20,120])for(const z of [0,10])corners.push(new C.Cartesian3(x,y,z))
 const support=new C.BoundingSphere(new C.Cartesian3(5,0,5),3),reference=supportContextReference(support,corners)
 expect(reference.probes.length).toBeGreaterThan(1)
 expect(reference.probes.every(p=>p.x>=0&&p.x<=10&&p.y>=20&&p.y<=120&&p.z>=0&&p.z<=10)).toBe(true)
 const sheared=corners.map(p=>new C.Cartesian3(p.x+p.z,p.y,p.z))
 expect(()=>supportContextReference(support,sheared)).toThrow('非正交')
})
