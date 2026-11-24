import type { AgentTaskWorkflowStatus } from './TaskWorkflowBridge'
import {availableTaskCameraViews,type TaskView} from './TaskCameraView'
import type {inspectTaskScene} from './TaskSceneInspection'
export type SceneInspection = ReturnType<typeof inspectTaskScene>
export const visualObjectives = ['spatial-relation','component-detail','source-review'] as const
export type VisualObjective = typeof visualObjectives[number]
export interface VisualGoalInput {objective:VisualObjective;focusResourceIds:string[];questions:string[];userRequest:string;referenceScope?:'full'|'near-support';emphasis?:'source'|'material-focus';focusComponent?:string}
export function visualSceneKey(status:AgentTaskWorkflowStatus) {
 const stage=status.lastCompletedStage
 if(status.status!=='completed'||!status.taskId||!stage)throw Error('请先完成当前场景装配')
 return JSON.stringify([status.taskId,stage.stepId,stage.chainageRange,[...stage.assembledResourceIds].sort()])
}
export function buildTaskVisualGoal(status:AgentTaskWorkflowStatus,inspection:SceneInspection,input:VisualGoalInput) {
 const sceneKey=visualSceneKey(status),ids=status.lastCompletedStage!.assembledResourceIds
 if(!visualObjectives.includes(input.objective))throw Error('不支持的视觉分析目的')
 if(typeof input.userRequest!=='string'||!input.userRequest.trim()||input.userRequest.length>2000)throw Error('任务目标必须来自本轮用户原话，最多2000字')
 if(!Array.isArray(input.focusResourceIds)||!input.focusResourceIds.length||new Set(input.focusResourceIds).size!==input.focusResourceIds.length||input.focusResourceIds.some(id=>!ids.includes(id)))throw Error('重点对象必须是不重复的当前任务根资源，不能猜测或加载新对象')
 if(!Array.isArray(input.questions)||!input.questions.length||input.questions.length>3||input.questions.some(q=>typeof q!=='string'||!q.trim()||q.length>240))throw Error('请提供1至3个待回答问题，每项最多240字')
 if(!inspection.completedSceneAvailable||inspection.taskId!==status.taskId||JSON.stringify([...inspection.resourceIds].sort())!==JSON.stringify([...ids].sort()))throw Error('当前场景反馈与任务不一致，请重新读取')
 const emphasis=input.emphasis??'source'
 if(!['source','material-focus'].includes(emphasis))throw Error('不支持的重点表达')
 if(emphasis==='material-focus'&&input.focusResourceIds.some(id=>!id.startsWith('support.modeler-')&&id!=='support.test-section'&&!id.startsWith('support.test-section-')))throw Error('当前重点着色仅支持已装配支护，不修改地质语义色标')
 if(input.focusComponent!==undefined){
  const id=input.focusResourceIds[0]
  if(!['component-detail','spatial-relation'].includes(input.objective)||input.focusResourceIds.length!==1||!id?.startsWith('support.test-section')||typeof input.focusComponent!=='string'||!inspection.resources.find(r=>r.id===id)?.componentDisplay?.some(c=>c.component===input.focusComponent&&c.totalNodes>0))throw Error('构件显露需要一种已读取的当前测试支护构件及构件细部或空间关系目标')
  if((inspection.resources.find(r=>r.id===id)?.observation.hiddenModelCount??0)>0)throw Error('当前支护模型整体隐藏，请先核查整体显隐；未修改显示')
 }
 let view:TaskView|undefined
 if(input.referenceScope!==undefined&&!['full','near-support'].includes(input.referenceScope))throw Error('不支持的参照范围')
 if(input.referenceScope==='near-support'){
  if(input.objective!=='spatial-relation'||!availableTaskCameraViews(ids).includes('support-context'))throw Error('邻近参照策略仅适用于当前TSP解释体与支护的空间关系任务')
  if(input.focusResourceIds.some(id=>!id.startsWith('support.modeler-')))throw Error('邻近围岩组合必须以当前支护为重点，围岩作为参照')
  view='support-context'
 }else if(input.objective==='spatial-relation')view='overview'
 if(input.objective==='component-detail'){
  const views=availableTaskCameraViews(input.focusResourceIds).filter(view=>view!=='overview'&&view!=='geographic')
  if(views.length!==1)throw Error('细部目标需要明确一种可聚焦对象类别；请拆分问题或选择空间关系')
  view=views[0]
 }
 return {sceneKey,taskId:status.taskId!,objective:input.objective,userRequest:input.userRequest,
  emphasis,referenceScope:input.referenceScope,focusComponent:input.focusComponent,focusResourceIds:[...input.focusResourceIds],referenceResourceIds:ids.filter(id=>!input.focusResourceIds.includes(id)),questions:[...input.questions],
  candidate:view?{type:'camera-view' as const,view,reason:(input.focusComponent?(view==='support'?'在原始单元内单独显露指定构件，其他已识别构件组暂时隐藏；':'显露指定构件，暂避混凝土外壳，保留其他构件作为参照；'):'')+(view==='support-context'?'近端剖切与局部取景组合；仅保留支护及邻近采样参照，不表示全体范围入镜':input.objective==='spatial-relation'?'保留当前全部对象的整体空间参照':'聚焦已声明的当前重点对象；其他资源仍保留但不保证同屏可辨')}:null,
  completionConditions:['执行前后任务与资源保持一致','核对重点对象实际运行状态和26点包围球取景；观察不足单列','画面取景与工程依据分开，待回答问题不作为已证实结论'],
  evidence:inspection,engineeringAcceptance:'not-verified' as const}
}
export interface VisualReviewDependencies {
 status:()=>AgentTaskWorkflowStatus;inspect:()=>SceneInspection;captureView:(view?:TaskView)=>()=>void;
 applyView:(ids:readonly string[],chainage:number,view:TaskView,emphasis?:'source'|'material-focus',referenceScope?:'full'|'near-support',componentFocus?:{resourceId:string;component:string})=>void
}
export function createTaskVisualReviewController(deps:VisualReviewDependencies) {
 let plan:ReturnType<typeof buildTaskVisualGoal>|undefined,scope='',attempts=0,undo:(()=>void)|undefined
 let phase:'planned'|'applied'|'restored'|'failed'='planned'
 let feedback:{before:SceneInspection;after:SceneInspection}|undefined
 let restoredFeedback:SceneInspection|undefined
 let recoveryStatus:'restored'|'failed'|undefined
 const current=()=>{if(!plan||visualSceneKey(deps.status())!==plan.sceneKey)throw Error('分析计划已过期，请按当前任务重新规划');return plan}
 return {
  inspect:()=>plan?{plan,phase,attempts,remaining:Math.max(0,2-attempts),canRestore:!!undo,feedback,restoredFeedback,recoveryStatus,
   budgetPolicy:{scope:'completed-scene',limit:2,replanResets:false,restoreRefunds:false},
   conditions:plan.focusResourceIds.map(id=>{const r=(phase==='restored'?restoredFeedback:phase==='applied'?feedback?.after:undefined)?.resources.find(resource=>resource.id===id),component=plan.focusComponent?r?.componentDisplay?.find(c=>c.component===plan!.focusComponent):undefined,framing=component?.framing?.available?component.framing:r?.observation.framing;return {resourceId:id,
    runtime:r?(r.runtimeState==='loaded'?'loaded':'not-loaded'):'not-evaluated',
    framing:framing?.available?(framing.insideSafe===26?'26-samples-inside':'incomplete'):'unknown',
    framingScope:component?.framing?.available?'focus-component':plan.focusComponent?'whole-resource-fallback':'whole-resource',
    modelCoverage:r?.observation.modelCoverage??'unknown'} }),
   questionsStatus:'unanswered-requires-task-evidence',engineeringAcceptance:'not-verified'}:undefined,
  plan(input:VisualGoalInput){
   const status=deps.status(),key=visualSceneKey(status)
   const next=buildTaskVisualGoal(status,deps.inspect(),input)
   if(key!==scope){attempts=0;undo=undefined;scope=key}
   plan=next;phase='planned';feedback=undefined;restoredFeedback=undefined;recoveryStatus=undefined
   return this.inspect()!
  },
  apply(taskId:string){
   const p=current()
   if(p.taskId!==taskId)throw Error('任务ID与当前分析计划不一致')
   if(!p.candidate)throw Error('来源核查是只读目标，没有相机增强动作')
   if(attempts>=2)throw Error('当前场景的视觉调整已达2次上限；重新规划或恢复不重置预算')
   const before=deps.inspect()
   if(before.issues.some(i=>['not-loaded','model-not-ready','dependency-unresolved'].includes(i.code)))throw Error('当前存在未加载、未就绪或依赖缺失对象，先核查，未移动相机')
   const rollback=deps.captureView(p.candidate.view);attempts++
   try {
    deps.applyView(p.objective==='spatial-relation'?before.resourceIds:p.focusResourceIds,before.chainageRange!.start,p.candidate.view,p.emphasis,p.referenceScope,p.focusComponent?{resourceId:p.focusResourceIds[0]!,component:p.focusComponent}:undefined)
    const after=deps.inspect()
    if(visualSceneKey(deps.status())!==p.sceneKey)throw Error('增强期间任务已变化')
    undo??=rollback;phase='applied';feedback={before,after};restoredFeedback=undefined;recoveryStatus=undefined

    return this.inspect()!
   }catch(error){phase='failed';recoveryStatus='failed';try{rollback();recoveryStatus='restored'}catch{undo??=rollback;throw Error(`视觉调整失败且恢复未完成，请核查当前实际显示。原错误：${String(error)}`)}throw error}
  },
  restore(taskId:string){
   const p=current();if(p.taskId!==taskId)throw Error('任务ID与计划不一致');if(!undo)throw Error('本任务没有可恢复的视觉调整')
   try{undo()}catch(error){phase='failed';recoveryStatus='failed';throw Error(`视觉恢复未完成，请核查当前实际显示。${String(error)}`)}
   undo=undefined;phase='restored';recoveryStatus='restored';restoredFeedback=undefined;restoredFeedback=deps.inspect();return this.inspect()!
  },
  clear(){plan=undefined;scope='';attempts=0;undo=undefined;feedback=undefined;restoredFeedback=undefined;recoveryStatus=undefined;phase='planned'},
 }
}
