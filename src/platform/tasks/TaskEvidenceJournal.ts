import {readonly,shallowRef} from 'vue'
import type {AgentTaskWorkflowStatus} from './TaskWorkflowBridge'
const revision=shallowRef(0)
export const taskEvidenceRevision=readonly(revision)
export function taskEvidenceScopeMatches(status:AgentTaskWorkflowStatus,taskId:string,resourceId:string){return status.prepared&&status.status==='completed'&&status.taskId===taskId&&!!status.lastCompletedStage?.assembledResourceIds.includes(resourceId)}
export interface TaskLocationEvidence {
 taskId:string;resourceId:string;rowId:string;component:string;offsetM:number;source:'2d'|'3d';
 reviewStep?:{id:string;question:string;boundary:string};assetPaths:string[];visualObjective?:string;questions?:string[]
}
const entries=shallowRef<Array<TaskLocationEvidence & {sequence:number;recordedAt:string;evidenceType:'assembly-station-visit';engineeringAcceptance:'not-verified'}>>([])
export const taskLocationEvidence=readonly(entries)
let taskId:string|undefined,sequence=0,stepSequence=0
export interface TaskReviewStepEvidence {taskId:string;resourceId:string;rowId:string;stepId:string;question:string;boundary:string;assetPaths:string[]}
const stepEntries: Array<TaskReviewStepEvidence & {sequence:number;recordedAt:string;status:'visited-not-answered'}>=[]
export function clearTaskEvidenceJournal(){entries.value=[];taskId=undefined;sequence=0;stepSequence=0;stepEntries.length=0;revision.value++}
export function recordTaskLocationEvidence(input:TaskLocationEvidence){
 if(!input.taskId||!input.resourceId||!Number.isFinite(input.offsetM))throw Error('定位证据缺少有效任务、资源或站位')
 if(input.source!=='2d'&&input.source!=='3d')throw Error('定位证据必须来自二维或三维交互')
 if(taskId!==input.taskId){clearTaskEvidenceJournal();taskId=input.taskId}
 const record={...input,reviewStep:input.reviewStep?{...input.reviewStep}:undefined,assetPaths:[...input.assetPaths],questions:input.questions?[...input.questions]:undefined,
 sequence:++sequence,recordedAt:new Date().toISOString(),evidenceType:'assembly-station-visit' as const,engineeringAcceptance:'not-verified' as const}
 entries.value=[...entries.value.slice(-99),record];revision.value++
 return {...record,reviewStep:record.reviewStep?{...record.reviewStep}:undefined,assetPaths:[...record.assetPaths],questions:record.questions?[...record.questions]:undefined}
}
export function inspectTaskEvidenceJournal(currentTaskId:string|undefined){return taskId===currentTaskId?entries.value.map(item=>({...item,reviewStep:item.reviewStep?{...item.reviewStep}:undefined,assetPaths:[...item.assetPaths],questions:item.questions?[...item.questions]:undefined})):[]}

export function recordTaskReviewStep(input:TaskReviewStepEvidence){
 if(!input.taskId||!input.resourceId||!input.rowId||!['overview','interface','components','evidence','conclusion'].includes(input.stepId))throw Error('核查步骤身份无效')
 if(taskId!==input.taskId){clearTaskEvidenceJournal();taskId=input.taskId}
 stepEntries.push({...input,assetPaths:[...input.assetPaths],sequence:++stepSequence,recordedAt:new Date().toISOString(),status:'visited-not-answered'})
 if(stepEntries.length>100)stepEntries.shift()
 revision.value++
}
export function inspectTaskEvidenceProgress(currentTaskId:string|undefined){
 const current=!!currentTaskId&&taskId===currentTaskId
 return {scope:'interaction-history-not-question-completion',locationRecords:{total:current?sequence:0,retained:current?entries.value.length:0,omitted:current?sequence-entries.value.length:0},
 stepRecords:{total:current?stepSequence:0,retained:current?stepEntries.length:0,omitted:current?stepSequence-stepEntries.length:0},
 steps:current?stepEntries.map(item=>({...item,assetPaths:[...item.assetPaths]})):[],questionsStatus:'unanswered-requires-task-evidence',engineeringAcceptance:'not-verified'}
}
