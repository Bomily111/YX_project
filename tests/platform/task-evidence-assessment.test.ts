import {afterEach,expect,it} from 'vitest'
import {assessTaskEvidence} from '@/platform/tasks/TaskEvidenceAssessment'
import {clearTaskEvidenceJournal,recordTaskLocationEvidence,recordTaskReviewStep} from '@/platform/tasks/TaskEvidenceJournal'
afterEach(clearTaskEvidenceJournal)
it('separates actual interaction facts from unanswered design and geometry questions',()=>{
 recordTaskLocationEvidence({taskId:'a',resourceId:'support.test-section',rowId:'arch',component:'steel_arch',offsetM:-2,source:'2d',assetPaths:['/actual.glb']})
 recordTaskReviewStep({taskId:'a',resourceId:'support.test-section',rowId:'arch',stepId:'evidence',question:'正文是否已读？',boundary:'未读',assetPaths:['/actual.glb']})
 const report=assessTaskEvidence('a',['support.test-section'])
 expect(report.facts.map(f=>f.id)).toEqual(['a:location:1','a:step:1'])
 expect(report.gaps).toHaveLength(3);expect(report.questionStatus).toContain('unanswered');expect(report.engineeringAcceptance).toBe('not-verified')
})
it('does not reuse another task or another resource as evidence',()=>{
 recordTaskLocationEvidence({taskId:'a',resourceId:'one',rowId:'row',component:'arch',offsetM:-2,source:'3d',assetPaths:[]})
 expect(assessTaskEvidence('a',['other']).facts).toEqual([])
 expect(assessTaskEvidence('b',['one']).facts).toEqual([])
 for(let i=0;i<100;i++)recordTaskLocationEvidence({taskId:'a',resourceId:'one',rowId:'row',component:'arch',offsetM:-i,source:'3d',assetPaths:[]})
 expect(assessTaskEvidence('a',['one']).facts).toHaveLength(40)
 expect(assessTaskEvidence('a',['one']).factWindow.omitted).toBe(60)
})
