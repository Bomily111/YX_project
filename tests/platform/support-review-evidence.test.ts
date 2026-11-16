import { describe, expect, it } from 'vitest'
import { supportReviewEvidence } from '@/modules/support/review-evidence'
import type { SupportLayoutRow } from '@/modules/support/longitudinal-layout'
const row:SupportLayoutRow={id:'va:arch',resourceId:'support.test-section',component:'steel_arch',kind:'component-base',type:'ZZ-Va',lengthM:5,offsetsM:[-5.5,-4.7,-3.9],spacingM:.8,sourceSegment:1}
describe('support evidence stopping conditions',()=>{
  it('does not promote valid assembly records to engineering acceptance',()=>{
    const result=supportReviewEvidence([row])
    expect(result.recordStatus).toBe('consistent')
    expect(result.engineeringAcceptance).toBe('not-verified')
    expect(result.evidenceGaps.map(g=>g.id)).toEqual(['section-design','field-measurement','geometry-fit'])
  })
  it.each([[],[NaN],[-6], [0],[-2,-2],[-1,-2]].map(offsetsM=>({offsetsM})))('rejects missing or invalid offsets $offsetsM',({offsetsM})=>{
    expect(supportReviewEvidence([{...row,offsetsM}]).recordStatus).toBe('needs-review')
  })
  it('keeps missing records and unit bases distinct from measured reinforcement',()=>{
    expect(supportReviewEvidence([]).recordStatus).toBe('missing')
    expect(supportReviewEvidence([{...row,kind:'unit-base',spacingM:null}]).checks[0]!.reinforcementSpacingVerified).toBe(false)
  })
})
