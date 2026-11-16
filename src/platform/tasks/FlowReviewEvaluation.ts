export interface FlowScreenFeedback {
  mode?:string;sampled:number;inside:number;panelCovered:number;behind:number
  targetDiameterPxApprox:number|null;targetInSafeViewport?:boolean|null
}
export const FLOW_REVIEW_POLICY=Object.freeze({version:'2026-11-16-screen-review-v1',maxAdjustments:2,minInsideFraction:.85,maxPanelCoveredFraction:.1,minFocusDiameterPx:120})

/** Prototype readability thresholds are fixed before the experiment, not safety limits. */
export function evaluateFlowReview(feedback:FlowScreenFeedback,attempts:number){
 const p=FLOW_REVIEW_POLICY
 const valid=[feedback.sampled,feedback.inside,feedback.panelCovered,feedback.behind].every(Number.isFinite)
   &&feedback.sampled>0&&feedback.inside>=0&&feedback.inside<=feedback.sampled
   &&feedback.behind>=0&&feedback.inside+feedback.behind<=feedback.sampled
   &&feedback.panelCovered>=0&&feedback.panelCovered<=feedback.inside
 const issues:string[]=[]
 if(!valid)issues.push('screen-samples-unavailable')
 else{
   if(feedback.inside/feedback.sampled<p.minInsideFraction)issues.push('samples-outside-viewport')
   if(feedback.panelCovered/feedback.sampled>p.maxPanelCoveredFraction)issues.push('samples-covered-by-panels')
 }
 if(feedback.targetInSafeViewport===false)issues.push('target-outside-safe-viewport')
 if(feedback.mode==='focus'){
   if(feedback.targetDiameterPxApprox===null||!Number.isFinite(feedback.targetDiameterPxApprox))issues.push('target-scale-unavailable')
   else if(feedback.targetDiameterPxApprox<p.minFocusDiameterPx)issues.push('target-too-small')
 }
 const remaining=Math.max(0,p.maxAdjustments-attempts)
 // Framing cannot reliably enlarge a small target without sacrificing required context.
 const fixable=valid&&issues.some(i=>['samples-outside-viewport','samples-covered-by-panels','target-outside-safe-viewport'].includes(i))
 return {policy:p,issues,remainingAdjustments:remaining,
   status:!issues.length?'screen-criteria-met':!remaining?'budget-exhausted':fixable?'adjustment-available':'needs-manual-review',
   candidates:remaining&&fixable?[{id:'fit-safe-viewport',reason:'保留当前局部/全段任务范围，依据实际面板调整相机。'}]:[],
   stopReason:!issues.length?'当前屏幕采样条件满足；结束调整，深度遮挡和工程结论仍未核验。':!remaining?'本任务调整预算已用完；保留剩余问题供人工核查。':!fixable?'当前候选不能可靠解决尺度或测量缺失；结束自动调整并说明限制。':null,
   engineeringAcceptance:'not-verified',depthOcclusion:'not-measured'}
}
