import {captureTaskSupportNodes,revealTaskSupportComponent,getTestSectionSupportModels} from '@/modules/support/test-section-resource'
import {captureSupportFocusStyle,setSupportFocusStyle,clearSupportFocusStyle} from './SupportFocusStyle'
import {getActiveModelerSupportModels} from '@/modules/support/modeler-resources'
import {captureTaskVolumeCut,setTaskVolumeCut,getTaskVolumeCutState} from './TaskVolumeCut'
import {clearTaskEvidenceJournal} from './TaskEvidenceJournal'
import * as C from 'cesium'
import {readonly,shallowRef} from 'vue'
import {resourceRegistry} from '@/platform/resources/ResourceRegistry'
import {resourceManager} from '@/platform/resources/ResourceManager'
import {viewerService} from '@/platform/viewer/ViewerService'
import {getTaskWorkflowController} from './TaskWorkflowBridge'
import {inspectTaskScene} from './TaskSceneInspection'
import {focusTaskCamera,taskCameraSelection,restoreTaskCameraSelection} from './TaskCameraView'
import {captureTaskViewportTarget} from './TaskViewport'
import {createTaskVisualReviewController,type VisualGoalInput} from './TaskVisualGoal'
const componentBaselines=new Map<string,()=>void>()
const supportModels=(ids:readonly string[])=>[...getActiveModelerSupportModels(ids),...getTestSectionSupportModels(ids)].filter((model):model is C.Model=>!!model?.ready)
const controller=createTaskVisualReviewController({
 status:()=>getTaskWorkflowController().getStatus(),
 inspect:()=>inspectTaskScene(getTaskWorkflowController().getStatus(),resourceRegistry,resourceManager.listStates(),viewerService.current),
 captureView:(view)=>{
  const taskIds=getTaskWorkflowController().getStatus().lastCompletedStage?.assembledResourceIds??[]
  const restoreStyle=captureSupportFocusStyle(supportModels(taskIds))
  const restoreCut=taskIds.some(id=>['rock.tsp-hardness','rock.tsp-integrity'].includes(id))&&getTaskVolumeCutState()?captureTaskVolumeCut():undefined
  const restoreNodes=taskIds.filter(id=>id.startsWith('support.test-section')).map(id=>captureTaskSupportNodes(id))
  const v=viewerService.require(),c=v.camera,position=C.Cartesian3.clone(c.positionWC),direction=C.Cartesian3.clone(c.directionWC),up=C.Cartesian3.clone(c.upWC)
  const selection=taskCameraSelection.value,restoreTarget=captureTaskViewportTarget(v)
  return ()=>{if(v.isDestroyed())return;try{restoreCut?.()}finally{try{restoreNodes.forEach(restore=>restore())}finally{restoreStyle();c.cancelFlight();c.setView({destination:position,orientation:{direction,up}});restoreTaskCameraSelection(selection);restoreTarget();v.scene.requestRender()}}}
 },
 applyView:(ids,chainage,view,emphasis='source',referenceScope,componentFocus)=>{
  if(componentFocus){
   const id=componentFocus.resourceId
   if(!componentBaselines.has(id))componentBaselines.set(id,captureTaskSupportNodes(id))
   else componentBaselines.get(id)!()
   revealTaskSupportComponent(id,componentFocus.component,view==='support')
  }
  if(referenceScope==='full'&&view==='overview'&&ids.some(id=>['rock.tsp-hardness','rock.tsp-integrity'].includes(id)))setTaskVolumeCut(false)
  if(view==='support-context')setTaskVolumeCut(true,'structure-window')
  const viewer=viewerService.require()
  focusTaskCamera(viewer,ids,chainage,view,componentFocus)
  setSupportFocusStyle(supportModels(ids),emphasis)
  viewer.scene.requestRender()
 },
})
const display=shallowRef<ReturnType<typeof controller.inspect>>()
export const taskVisualReview=readonly(display)
const publish=()=>{display.value=controller.inspect();return display.value}
export function planTaskVisualReview(input:VisualGoalInput){controller.plan(input);return publish()!}
export function applyTaskVisualReview(taskId:string){try{controller.apply(taskId);return publish()!}finally{publish()}}
export function restoreTaskVisualReview(taskId:string){try{controller.restore(taskId);componentBaselines.clear();return publish()!}finally{publish()}}
export function clearTaskVisualReview(){componentBaselines.forEach(restore=>restore());componentBaselines.clear();clearSupportFocusStyle();controller.clear();clearTaskEvidenceJournal();publish()}
