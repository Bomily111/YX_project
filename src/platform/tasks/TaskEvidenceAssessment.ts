import {inspectTaskEvidenceJournal,inspectTaskEvidenceProgress} from './TaskEvidenceJournal'
/** Only synthesizes observed interactions; never marks an engineering question answered. */
export function assessTaskEvidence(taskId:string,resourceIds:readonly string[]){
 const locations=inspectTaskEvidenceJournal(taskId).filter(item=>resourceIds.includes(item.resourceId))
 const progress=inspectTaskEvidenceProgress(taskId)
 const steps=progress.steps.filter(item=>resourceIds.includes(item.resourceId))
 const facts=[...locations.map(item=>({id:`${taskId}:location:${item.sequence}`,resourceId:item.resourceId,rowId:item.rowId,
  kind:'station-visit',text:`${item.source==='2d'?'二维选点':'三维拾取'}访问装配基准${item.offsetM.toFixed(2)}m`,
  assetPaths:[...item.assetPaths],question:item.reviewStep?.question??null,stepId:item.reviewStep?.id??null})),
  ...steps.map(item=>({id:`${taskId}:step:${item.sequence}`,resourceId:item.resourceId,rowId:item.rowId,
   kind:'step-visit',text:`进入核查步骤${item.stepId}；问题仍未回答`,assetPaths:[...item.assetPaths],question:item.question,stepId:item.stepId}))]
 const gaps=[
  {id:'task-design',status:'not-provided-to-this-assessment',question:'源模型与本工段设计是否对应？',nextCheck:'核对适用里程、设计版本和对应章节页码；访问路径不代表正文已读。'},
  {id:'field-data',status:'not-provided-to-this-assessment',question:'是否具备同一基准的实测对比？',nextCheck:'取得同一基准实测记录后再比较；当前不计算施工偏差。'},
  {id:'geometry',status:'not-measured-by-this-assessment',question:'接缝、净空或断面贴合是否成立？',nextCheck:'另行核验源断面适用性及几何关系；定位和取景不能证明贴合。'},
 ]
 return {taskId,resourceIds:[...resourceIds],facts:facts.slice(-40),gaps,factWindow:{availableInRetainedJournal:facts.length,retained:Math.min(40,facts.length),omitted:Math.max(0,facts.length-40),scope:'within-retained-journal-not-full-history'},
  historyWindow:{locations:progress.locationRecords,steps:progress.stepRecords,scope:'whole-task-window-before-resource-filter'},
  conclusion: facts.length?'已记录交互事实，工程问题仍待依据核查':'当前任务尚无这些资源的交互事实，不能沿用其他对象或旧任务的结论',
  questionStatus:'unanswered-requires-task-evidence',engineeringAcceptance:'not-verified',
  stopReason:'本次只汇总实际交互与证据缺口；重复定位或取景不能补齐设计、实测和几何依据'}
}
