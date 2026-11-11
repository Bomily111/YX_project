import * as C from 'cesium'
import { installModelControls, type ModelControlFrame } from '@/views/ventilation-module/scene'
import { chainageService } from '@/platform/coordinates/ChainageService'
import { getTaskWorkflowController, hasTaskWorkflowController } from '@/platform/tasks/TaskWorkflowBridge'
const installed = new WeakMap<C.Viewer, { destroy(): void }>()
export function platformFocus(viewer: C.Viewer, pickDepth = true): C.Cartesian3 {
  const center = new C.Cartesian2(viewer.canvas.clientWidth / 2, viewer.canvas.clientHeight / 2)
  if (pickDepth && viewer.scene.pickPositionSupported) {
    try { const point=viewer.scene.pickPosition(center); if(C.defined(point)) return C.Cartesian3.clone(point) } catch { /* wait for depth */ }
  }
  const task = hasTaskWorkflowController() ? getTaskWorkflowController().getStatus().lastCompletedStage : undefined
  if(task)return chainageService.worldPositionAt(task.chainageRange.start)!
  const camera=viewer.camera,cartographic=C.Cartographic.fromCartesian(camera.positionWC)
  const nearest=chainageService.nearestPosition(C.Math.toDegrees(cartographic.longitude),C.Math.toDegrees(cartographic.latitude)).position
  const tunnel=C.Cartesian3.fromDegrees(nearest.longitude,nearest.latitude,nearest.height)
  const distance=C.Math.clamp(C.Cartesian3.distance(camera.positionWC,tunnel),10,50000)
  const ray=camera.getPickRay(center)
  if(ray){const ground=viewer.scene.globe.pick(ray,viewer.scene);if(C.defined(ground)&&C.Cartesian3.distance(camera.positionWC,ground)<=distance*4)return C.Cartesian3.clone(ground)}
  // Underground or while loading, terrain may lie kilometres behind the tunnel.
  // Keep the fallback plane in front of the camera at the local tunnel scale.
  return C.Cartesian3.add(camera.positionWC,C.Cartesian3.multiplyByScalar(camera.directionWC,distance,new C.Cartesian3()),new C.Cartesian3())
}
/** Same picked-pivot orbit/pan/pointer zoom used by support and ventilation. */
export function installPlatformModelControls(viewer: C.Viewer, focus = () => platformFocus(viewer, false)) {
  installed.get(viewer)?.destroy()
  const controller=viewer.scene.screenSpaceCameraController
  const flags=['enableInputs','enableRotate','enableTranslate','enableZoom','enableTilt','enableLook'] as const
  const previous=Object.fromEntries(flags.map(key=>[key,controller[key]]))
  const pickDepth=viewer.scene.pickTranslucentDepth
  // Use the completed opaque depth buffer on the full platform scene. Cesium's
  // translucent-depth pass can replay already-consumed one-shot compute work
  // while the 17 tunnel segments load, invalidating their GPU vertex arrays.
  viewer.scene.pickTranslucentDepth=false
  let enu=C.Transforms.eastNorthUpToFixedFrame(focus()),inverse=C.Matrix4.inverseTransformation(enu,new C.Matrix4())
  const align=(point:C.Cartesian3)=>{enu=C.Transforms.eastNorthUpToFixedFrame(point);inverse=C.Matrix4.inverseTransformation(enu,new C.Matrix4())}
  const frame: ModelControlFrame = {
    get up(){return C.Matrix4.multiplyByPointAsVector(enu,C.Cartesian3.UNIT_Z,new C.Cartesian3())},
    get right(){return C.Matrix4.multiplyByPointAsVector(enu,C.Cartesian3.UNIT_X,new C.Cartesian3())},
    toLocal:point=>{const p=C.Matrix4.multiplyByPoint(inverse,point,new C.Cartesian3());return new C.Cartesian3(p.x,p.z,p.y)},
    toWorld:p=>C.Matrix4.multiplyByPoint(enu,new C.Cartesian3(p.x,p.z,p.y),new C.Cartesian3()),
  }
  const controls=installModelControls(viewer,focus,align,frame,'platform.camera-controls')
  // Cesium restores enableInputs after completing or cancelling a flight. Keep
  // this adapter authoritative while mounted, including the first input after
  // a flight in request-render mode.
  const disableDefaultInputs=()=>{for(const key of flags)controller[key]=false}
  const removePreUpdate=viewer.scene.preUpdate.addEventListener(disableDefaultInputs)
  const takeControl=()=>{
    viewer.camera.cancelFlight()
    disableDefaultInputs()
    if(!controls.isInteracting())controls.setFocus(focus(),false)
  }
  const inputEvents=['pointerdown','mousedown','touchstart','wheel'] as const
  for(const event of inputEvents)viewer.canvas.addEventListener(event,takeControl,{capture:true,passive:true})
  const removeMoveEnd=viewer.camera.moveEnd.addEventListener(()=>{if(!controls.isInteracting())controls.setFocus(focus(),false)})
  let disposed=false
  const result={...controls,destroy(){if(disposed)return;disposed=true;removeMoveEnd();removePreUpdate();for(const event of inputEvents)viewer.canvas.removeEventListener(event,takeControl,true);if(!viewer.isDestroyed()){controls.destroy();for(const key of flags)controller[key]=previous[key];viewer.scene.pickTranslucentDepth=pickDepth}if(installed.get(viewer)===result)installed.delete(viewer)}}
  installed.set(viewer,result)
  return result
}
