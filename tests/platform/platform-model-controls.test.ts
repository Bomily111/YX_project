import { expect, it, vi } from 'vitest'
import * as C from 'cesium'
const state=vi.hoisted(()=>({setFocus:vi.fn(),destroy:vi.fn()}))
vi.mock('@/views/ventilation-module/scene',()=>({installModelControls:()=>({setFocus:state.setFocus,destroy:state.destroy,isInteracting:()=>false})}))
vi.mock('@/platform/tasks/TaskWorkflowBridge',()=>({hasTaskWorkflowController:()=>false,getTaskWorkflowController:vi.fn()}))
vi.mock('@/platform/coordinates/ChainageService',()=>({chainageService:{worldPositionAt:()=>C.Cartesian3.fromDegrees(94.9,29.5,3000),nearestPosition:()=>({position:{longitude:94.9,latitude:29.5,height:3000}})}}))
import { installPlatformModelControls } from '@/platform/input/PlatformModelControls'

it('never does GPU picking inside moveEnd, owns inputs after flights and cleans up on replacement',()=>{
 const listeners=new Map<string,unknown>(),moveEnd=new C.Event(),preUpdate=new C.Event()
 const flags={enableInputs:true,enableRotate:true,enableTranslate:true,enableZoom:true,enableTilt:true,enableLook:true}
 const pickPosition=vi.fn(()=>{throw Error('GPU picking must not reenter scene rendering')})
 const viewer={canvas:{clientWidth:100,clientHeight:100,addEventListener:(key:string,fn:unknown)=>listeners.set(key,fn),removeEventListener:(key:string)=>listeners.delete(key)},
  camera:{moveEnd,getPickRay:()=>undefined,cancelFlight:vi.fn(()=>{flags.enableInputs=true}),positionWC:C.Cartesian3.fromDegrees(94.9,29.5,3100),directionWC:C.Cartesian3.UNIT_Z},scene:{preUpdate,screenSpaceCameraController:flags,pickTranslucentDepth:false,pickPositionSupported:true,pickPosition,globe:{pick:vi.fn()}},isDestroyed:()=>false} as any
 const first=installPlatformModelControls(viewer)
 moveEnd.raiseEvent()
 expect(pickPosition).not.toHaveBeenCalled()
 expect(state.setFocus).toHaveBeenCalled()
 flags.enableInputs=true
 preUpdate.raiseEvent()
 expect(Object.values(flags).every(value=>value===false)).toBe(true)
 for(const event of ['pointerdown','wheel']){
  const calls=state.setFocus.mock.calls.length
  ;(listeners.get(event) as ()=>void)()
  expect(viewer.camera.cancelFlight).toHaveBeenCalled()
  expect(Object.values(flags).every(value=>value===false)).toBe(true)
  expect(state.setFocus.mock.calls.length).toBe(calls+1)
 }
 expect(pickPosition).not.toHaveBeenCalled()
 const replacement=installPlatformModelControls(viewer)
 expect(state.destroy).toHaveBeenCalledTimes(1)
 expect(moveEnd.numberOfListeners).toBe(1)
 expect(preUpdate.numberOfListeners).toBe(1)
 first.destroy()
 replacement.destroy()
 expect(moveEnd.numberOfListeners).toBe(0)
 expect(preUpdate.numberOfListeners).toBe(0)
 expect(listeners.size).toBe(0)
 expect(Object.values(flags).every(Boolean)).toBe(true)
 expect(viewer.scene.pickTranslucentDepth).toBe(false)
})
