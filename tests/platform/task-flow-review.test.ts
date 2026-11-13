import {expect,it,vi} from 'vitest'
import * as C from 'cesium'
import {layers} from '@/views/ventilation-module/cesiumVentilation'
import {installTaskFlowReview,setTaskFlowReview,taskFlowReview,flowReviewInitialMode} from '@/platform/tasks/TaskFlowReview'

it('respects an explicit full-field goal for the same resource combination',()=>{
 expect(flowReviewInitialMode('爆后通风复核')).toBe('focus')
 expect(flowReviewInitialMode('查看完整200米风场范围')).toBe('context')
 expect(flowReviewInitialMode('不要全段，只看爆破附近重点')).toBe('focus')
 expect(flowReviewInitialMode('查看完整200米风场范围，不要局部取景')).toBe('context')
})

it('emphasizes the existing local task while restoring exact styles and visibility',()=>{
 const points=new C.PointPrimitiveCollection(),particles=new C.PointPrimitiveCollection()
 for(const x of [0,10,100])points.add({position:new C.Cartesian3(x,0,0),color:new C.Color(.2,.5,.8,.72),pixelSize:4,id:{velocity:.5}})
 layers.points=points;layers.particles=particles;particles.show=false
 const camera={positionWC:new C.Cartesian3(500,0,0),directionWC:C.Cartesian3.UNIT_Y,upWC:C.Cartesian3.UNIT_Z,cancelFlight:vi.fn(),viewBoundingSphere:vi.fn(),lookAtTransform:vi.fn(),setView:vi.fn()}
 const viewer={camera,container:{closest:()=>false},scene:{requestRender:vi.fn()},isDestroyed:()=>false} as any
 const undo=installTaskFlowReview(viewer,new C.BoundingSphere(C.Cartesian3.ZERO,2),0)
 try{
  expect(taskFlowReview.value?.mode).toBe('focus')
  expect(taskFlowReview.value?.localSamples).toBe(2)
  expect(points.get(0).color).toEqual(new C.Color(.2,.5,.8,.18))
  expect(points.get(2).color.alpha).toBe(.06)
  expect(points.get(2).position.x).toBe(100)
  expect(layers.points).toBe(points)
  setTaskFlowReview('context')
  expect(points.get(2).color.alpha).toBe(.72)
  expect(points.get(2).pixelSize).toBe(4)
  expect(particles.show).toBe(false)
  camera.viewBoundingSphere.mockImplementationOnce(()=>{throw Error('camera failure')})
  expect(()=>setTaskFlowReview('focus')).toThrow('camera failure')
  expect(taskFlowReview.value?.mode).toBe('context')
  expect(points.get(2).color.alpha).toBe(.72)
  setTaskFlowReview('focus')
 }finally{undo();undo();points.destroy();particles.destroy();layers.points=undefined;layers.particles=undefined}
 expect(taskFlowReview.value).toBeUndefined()
 expect(()=>setTaskFlowReview('focus')).toThrow('没有')
})
