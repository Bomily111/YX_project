import {expect,it} from 'vitest'
import {supportSectionComparison} from '@/modules/support/section-comparison'
it('compares source bounds with the actual near-end normal section and reflects the lateral axis',()=>{
 const r=supportSectionComparison([{component:'primary_concrete',sourceBoundsXY:{minX:-7,maxX:6,minY:0,maxY:9}}])
 expect(r.envelopes[0]!.bounds).toEqual({minX:-6,maxX:7,minY:0,maxY:9})
 expect(r.envelopes[0]!.widthDifferenceM).toBeCloseTo(2,1)
 expect(r.outline.length).toBeGreaterThan(10)
 expect(r.referenceOffsetM).toBe(-.5)
 expect(r.engineeringAcceptance).toBe('not-verified')
})
it('does not invent envelopes from width alone or from missing/nonfinite bounds',()=>{
 expect(supportSectionComparison([{component:'secondary_lining'},{component:'primary_concrete',sourceBoundsXY:{minX:NaN,maxX:6,minY:0,maxY:9}}]).envelopes).toEqual([])
})
