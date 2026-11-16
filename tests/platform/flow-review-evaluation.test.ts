import {expect,it} from 'vitest'
import {evaluateFlowReview,FLOW_REVIEW_POLICY} from '@/platform/tasks/FlowReviewEvaluation'
const feedback={mode:'focus',sampled:100,inside:100,panelCovered:0,behind:0,targetDiameterPxApprox:200,targetInSafeViewport:true}
it('stops when screen criteria are met without implying depth or engineering acceptance',()=>{
 const r=evaluateFlowReview(feedback,0)
 expect(r.status).toBe('screen-criteria-met');expect(r.candidates).toEqual([])
 expect(r.depthOcclusion).toBe('not-measured');expect(r.engineeringAcceptance).toBe('not-verified')
})
it('allows only bounded framing in the current task mode',()=>{
 const f={...feedback,inside:60,panelCovered:20,targetInSafeViewport:false}
 expect(evaluateFlowReview(f,0).candidates.map(c=>c.id)).toEqual(['fit-safe-viewport'])
 expect(evaluateFlowReview(f,FLOW_REVIEW_POLICY.maxAdjustments).status).toBe('budget-exhausted')
 expect(evaluateFlowReview(f,2).candidates).toEqual([])
})
it('does not crop required context merely to enlarge a target',()=>{
 expect(evaluateFlowReview({...feedback,targetDiameterPxApprox:60},0).status).toBe('needs-manual-review')
 expect(evaluateFlowReview({...feedback,mode:'context',targetDiameterPxApprox:60},0).status).toBe('screen-criteria-met')
})
it('rejects invalid measurements rather than treating them as passing',()=>{
 for(const overrides of [{sampled:0},{sampled:NaN},{inside:101},{panelCovered:101},{behind:101}]){
   expect(evaluateFlowReview({...feedback,...overrides},0).status).toBe('needs-manual-review')
 }
})
