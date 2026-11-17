import * as C from 'cesium'
import {supportContextReference} from './SupportContextView'
import {readTaskViewport,inspectTaskSphereViewport} from './TaskViewport'
import {getTaskVolumeDomain,getTaskVolumeKey,getTaskVolumeCutState} from './TaskVolumeCut'
export function inspectSupportContext(viewer:C.Viewer,ids:readonly string[],supports:readonly C.Model[]){
 const id=ids.find(value=>['rock.tsp-hardness','rock.tsp-integrity'].includes(value))
 if(!id||id.replace('rock.','').replaceAll('-','_')!==getTaskVolumeKey()||!supports.length)return {available:false as const,reason:'当前缺少匹配的围岩与可观察支护'}
 try{
  const domain=getTaskVolumeDomain(),viewport=readTaskViewport(viewer)
  if(!domain||!viewport?.safe)return {available:false as const,reason:'当前采样范围或可用画面不可测'}
  const focus=C.BoundingSphere.fromBoundingSpheres(supports.map(model=>model.boundingSphere)),reference=supportContextReference(focus,domain.corners)
  let inside=0,behind=0
  for(const point of reference.probes){
   if(C.Cartesian3.dot(C.Cartesian3.subtract(point,viewer.camera.positionWC,new C.Cartesian3()),viewer.camera.directionWC)<=0){behind++;continue}
   const xy=C.SceneTransforms.worldToWindowCoordinates(viewer.scene,point),safe=viewport.safe
   if(xy&&xy.x>=safe.left&&xy.x<=safe.right&&xy.y>=safe.top&&xy.y<=safe.bottom)inside++
  }
  const focusFraming=inspectTaskSphereViewport(viewer,focus),domainFraming=inspectTaskSphereViewport(viewer,domain.sphere)
  const complete=focusFraming.available&&focusFraming.insideSafe===26&&inside===reference.probes.length
  return {available:true as const,scope:'local-sampling-reference-not-geological-feature',resourceId:id,cut:getTaskVolumeCutState(),focusFraming,
   focusDisplay:supports.map(model=>({colorRgba:model.color?C.Color.pack(model.color,[]):null,colorBlendMode:model.colorBlendMode,colorBlendAmount:model.colorBlendAmount})),
   reference:{insideSafe:inside,total:reference.probes.length,behind,scope:'nearest-point-and-axis-probes-within-current-sampling-box'},renderedDomainFraming:domainFraming,
   screenFraming:complete?'focus-and-local-reference-in-safe-area':'incomplete',informationSufficiency:'not-verified',depthOcclusion:'not-measured',
   nextCheck:complete?'重点及局部采样参照投影入区；停止仅为入镜的重复取景，仍需核查数据与构件是否可辨。':'局部参照或重点投影不足；按任务需要选择整体范围或在预算内调整，不得声称参照完整。'}
 }catch(error){return {available:false as const,reason:String(error)}}
}
