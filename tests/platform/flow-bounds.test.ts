import {afterEach,expect,it} from 'vitest'
import * as C from 'cesium'
import {getFlowBoundingSphere,layers} from '@/views/ventilation-module/cesiumVentilation'
afterEach(()=>{layers.points?.destroy();layers.points=undefined})
it('uses drawn positions and excludes hidden collections and points',()=>{
 const points=new C.PointPrimitiveCollection()
 points.add({position:new C.Cartesian3(100,200,300)})
 points.add({position:new C.Cartesian3(110,200,300)})
 points.add({position:new C.Cartesian3(9999,200,300),show:false})
 layers.points=points
 const sphere=getFlowBoundingSphere()!
 expect(sphere.radius).toBeCloseTo(5)
 expect(sphere.center.x).toBeCloseTo(105)
 points.show=false
 expect(getFlowBoundingSphere()).toBeUndefined()
})
