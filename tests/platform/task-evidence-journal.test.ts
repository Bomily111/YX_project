import {afterEach,expect,it} from 'vitest'
import {clearTaskEvidenceJournal,recordTaskLocationEvidence,inspectTaskEvidenceJournal,recordTaskReviewStep,inspectTaskEvidenceProgress,taskEvidenceScopeMatches} from '@/platform/tasks/TaskEvidenceJournal'
afterEach(clearTaskEvidenceJournal)
const input=()=>({taskId:'a',resourceId:'support.test-section',rowId:'arch',component:'steel_arch',offsetM:-2,source:'2d' as const,assetPaths:['/actual.glb'],questions:['间距有何依据？']})
it('retains actual location provenance without interpreting visits as acceptance',()=>{
 const source=input();const returned=recordTaskLocationEvidence(source);returned.assetPaths.push('external');source.assetPaths.push('forged')
 const report=inspectTaskEvidenceJournal('a');expect(report[0]).toMatchObject({offsetM:-2,assetPaths:['/actual.glb'],evidenceType:'assembly-station-visit',engineeringAcceptance:'not-verified'})
 report[0]!.questions!.push('changed');expect(inspectTaskEvidenceJournal('a')[0]!.questions).toHaveLength(1)
 expect(inspectTaskEvidenceJournal('b')).toEqual([])
})
it('bounds history and clears records across task identities',()=>{
 for(let i=0;i<110;i++)recordTaskLocationEvidence({...input(),offsetM:-i})
 expect(inspectTaskEvidenceJournal('a')).toHaveLength(100)
 recordTaskLocationEvidence({...input(),taskId:'b'});expect(inspectTaskEvidenceJournal('a')).toEqual([]);expect(inspectTaskEvidenceJournal('b')[0]!.sequence).toBe(1)
 clearTaskEvidenceJournal();expect(inspectTaskEvidenceJournal('b')).toEqual([])
})

it('reports retained and omitted history without equating a visited question with an answer',()=>{
 for(let i=0;i<105;i++)recordTaskLocationEvidence(input())
 for(let i=0;i<104;i++)recordTaskReviewStep({taskId:'a',resourceId:'support.test-section',rowId:'arch',stepId:'evidence',question:'是否有设计正文？',boundary:'仅进入步骤，未读取正文',assetPaths:['/actual.glb']})
 const report=inspectTaskEvidenceProgress('a')
 expect(report.locationRecords).toEqual({total:105,retained:100,omitted:5})
 expect(report.stepRecords).toEqual({total:104,retained:100,omitted:4})
 expect(report.steps.every(step=>step.status==='visited-not-answered')).toBe(true)
 expect(report.questionsStatus).toBe('unanswered-requires-task-evidence')
 report.steps[0]!.assetPaths.push('forged');expect(inspectTaskEvidenceProgress('a').steps[0]!.assetPaths).toHaveLength(1)
 expect(inspectTaskEvidenceProgress('b').steps).toEqual([])
})
it('copies the actual step context instead of rewriting old observations as steps change',()=>{
 const reviewStep={id:'interface',question:'末站相对位置？',boundary:'未测接缝'}
 const returned=recordTaskLocationEvidence({...input(),reviewStep})
 reviewStep.id='conclusion';returned.reviewStep!.question='forged'
 expect(inspectTaskEvidenceJournal('a')[0]!.reviewStep).toEqual({id:'interface',question:'末站相对位置？',boundary:'未测接缝'})
})

it('rejects evidence writes from a running, failed, replaced or unrelated task scope',()=>{
 const status={prepared:true,status:'completed',taskId:'a',lastCompletedStage:{assembledResourceIds:['support.test-section']}} as any
 expect(taskEvidenceScopeMatches(status,'a','support.test-section')).toBe(true)
 for(const state of ['running','failed','idle'])expect(taskEvidenceScopeMatches({...status,status:state},'a','support.test-section')).toBe(false)
 expect(taskEvidenceScopeMatches(status,'old','support.test-section')).toBe(false)
 expect(taskEvidenceScopeMatches(status,'a','other')).toBe(false)
})
