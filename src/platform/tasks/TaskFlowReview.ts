import * as C from 'cesium'
import {readonly,ref} from 'vue'
import {layers,getFlowBoundingSphere} from '@/views/ventilation-module/cesiumVentilation'

export type FlowReviewMode='focus'|'context'
export function flowReviewInitialMode(goal:string):FlowReviewMode {
  const positiveGoal=goal.replace(/(?:不要|无需|不用|不看)(?:采用|使用)?局部(?:取景|视图|表达)?/g,'')
  if(/局部|只看.{0,12}(?:附近|重点)|不要.{0,6}(?:全段|全范围)/.test(positiveGoal))return 'focus'
  return /全段|全范围|完整.{0,8}(?:风场|范围)|整体概览|200\s*米/.test(positiveGoal)?'context':'focus'
}
interface ReviewState {mode:FlowReviewMode;radiusM:number;localSamples:number;totalSamples:number;velocityMin:number;velocityMax:number;strategy:'blast-airflow-local-review';occlusion:'not-measured'}
const state=ref<ReviewState>()
export const taskFlowReview=readonly(state)
let current:{set:(mode:FlowReviewMode)=>void;inspect:()=>Record<string,unknown>;dispose:()=>void}|undefined

/** Reversible task strategy. Existing geometry, velocity colors and visibility
 * choices are preserved; a local focus cannot imply full-field evaluation. */
export function installTaskFlowReview(viewer:C.Viewer,blast:C.BoundingSphere,heading:number,initialMode:FlowReviewMode='focus'):()=>void {
  if(current)throw Error('上一任务风场复核表达尚未释放')
  const points=layers.points
  if(!points||points.isDestroyed()||!points.length)throw Error('当前没有已绘制的CFD采样点')
  const radiusM=Math.min(40,Math.max(25,blast.radius*3))
  const originals=Array.from({length:points.length},(_,i)=>{const p=points.get(i);return {point:p,color:C.Color.clone(p.color),size:p.pixelSize}})
  const local=originals.filter(p=>p.point.show&&C.Cartesian3.distance(p.point.position,blast.center)<=radiusM)
  if(!local.length)throw Error('爆破重点附近没有CFD采样点，不执行局部复核表达')
  const localSphere=C.BoundingSphere.fromBoundingSpheres([blast,C.BoundingSphere.fromPoints(local.map(p=>p.point.position))])
  const visuals=([layers.streamlines,layers.particles] as const).filter((p):p is NonNullable<typeof p>=>!!p).map(p=>({object:p,show:p.show}))
  const velocities=originals.map(p=>Number(p.point.id?.velocity)).filter(Number.isFinite)
  const base={radiusM,localSamples:local.length,totalSamples:originals.length,velocityMin:Math.min(...velocities),velocityMax:Math.max(...velocities),strategy:'blast-airflow-local-review' as const,occlusion:'not-measured' as const}
  let mode:FlowReviewMode='context',disposed=false
  const valid=()=>!disposed&&!viewer.isDestroyed()&&!points.isDestroyed()&&layers.points===points
  const style=(next:FlowReviewMode)=>{
    for(const original of originals){
      const near=C.Cartesian3.distance(original.point.position,blast.center)<=radiusM
      original.point.color=next==='focus'?original.color.withAlpha(near?.18:.06):C.Color.clone(original.color)
      original.point.pixelSize=next==='focus'?2:original.size
    }
    for(const item of visuals)if(!item.object.isDestroyed())item.object.show=next==='focus'?false:item.show
  }
  const session={
    inspect(){
      if(!valid())throw Error('当前复核场景已释放或替换')
      const canvas=viewer.scene.canvas,rect=canvas?.getBoundingClientRect()
      if(!rect?.width||!rect.height)throw Error('当前场景画布不可测量')
      const samples=mode==='focus'?local:originals.filter(p=>p.point.show)
      const panels=Array.from(viewer.container.ownerDocument.querySelectorAll('.agent-window,.agent-assembly-info,.gpr-float,[data-ventilation-enhancement="chart"]')).map(e=>e.getBoundingClientRect())
      let sampled=0,inside=0,panelCovered=0,behind=0
      for(let i=0;i<samples.length;i+=Math.max(1,Math.ceil(samples.length/256))){
        const p=samples[i]!.point.position;sampled++
        if(C.Cartesian3.dot(C.Cartesian3.subtract(p,viewer.camera.positionWC,new C.Cartesian3()),viewer.camera.directionWC)<=0){behind++;continue}
        const xy=C.SceneTransforms.worldToWindowCoordinates(viewer.scene,p)
        if(xy&&xy.x>=0&&xy.x<=rect.width&&xy.y>=0&&xy.y<=rect.height){inside++;if(panels.some(r=>xy.x+rect.left>=r.left&&xy.x+rect.left<=r.right&&xy.y+rect.top>=r.top&&xy.y+rect.top<=r.bottom))panelCovered++}
      }
      const center=C.SceneTransforms.worldToWindowCoordinates(viewer.scene,blast.center)
      const edge=C.SceneTransforms.worldToWindowCoordinates(viewer.scene,C.Cartesian3.add(blast.center,C.Cartesian3.multiplyByScalar(viewer.camera.upWC,blast.radius,new C.Cartesian3()),new C.Cartesian3()))
      return {...state.value,scope:mode==='focus'?'local-cfd-samples':'full-cfd-samples',sampled,inside,panelCovered,behind,
        targetDiameterPxApprox:center&&edge?C.Cartesian2.distance(center,edge)*2:null,
        viewport:{width:rect.width,height:rect.height},measurement:'screen-projection-and-panel-rectangles',occlusion:'not-measured',
        note:'投影范围和屏幕面板覆盖的采样近似；未测模型间深度遮挡，不代表通风或安全结论。'}
    },
    set(next:FlowReviewMode){
      if(!valid())throw Error('风场复核表达已失效，未修改场景')
      const before=mode,camera=viewer.camera,position=C.Cartesian3.clone(camera.positionWC),direction=C.Cartesian3.clone(camera.directionWC),up=C.Cartesian3.clone(camera.upWC)
      const sphere=next==='focus'?localSphere:getFlowBoundingSphere()
      if(!sphere)throw Error('风场范围不可用')
      try{
        style(next);camera.cancelFlight()
        const range=Math.max(next==='focus'?65:100,sphere.radius*(next==='focus'?4:3.5))
        camera.viewBoundingSphere(sphere,new C.HeadingPitchRange(heading+.85,-.4,range));camera.lookAtTransform(C.Matrix4.IDENTITY)
        if(viewer.container.closest('.dashboard-container'))camera.moveRight(range*.04)
        mode=next;state.value={...base,mode};viewer.scene.requestRender()
      }catch(error){style(before);camera.setView({destination:position,orientation:{direction,up}});throw error}
    },
    dispose(){
      if(disposed)return
      if(valid())style('context')
      disposed=true
      if(current===session){current=undefined;state.value=undefined}
      if(!viewer.isDestroyed())viewer.scene.requestRender()
    },
  }
  current=session
  try{session.set(initialMode)}catch(error){session.dispose();throw error}
  return session.dispose
}
export function setTaskFlowReview(mode:FlowReviewMode){
  if(mode!=='focus'&&mode!=='context')throw Error('风场复核模式须为focus或context')
  if(!current)throw Error('当前任务没有爆破与稳态风场组合复核表达')
  current.set(mode)
  return {...state.value}
}
export function inspectTaskFlowReview(){
  if(!current)throw Error('当前任务没有爆破与稳态风场组合复核表达')
  return current.inspect()
}
