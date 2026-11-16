import {expect,it} from 'vitest'
import {supportLongitudinalRows,supportLayoutFinding,supportReviewSteps} from '@/modules/support/longitudinal-layout'
it('uses recorded placement stations, deduplicates component parts and never infers from counts',()=>{
 const rows=supportLongitudinalRows([{id:'support.test-section',supportType:'ZZ-Va',lengthM:5,layout:'1064m-component-example',sourceSegment:19,
  groups:[{component:'steel_arch',spacingM:.8,stations:7,stationOffsetsM:[-5.5,-4.7,-3.9]},{component:'steel_arch',spacingM:.8,stationOffsetsM:[-5.5,-4.7]},
   {component:'primary_mesh',spacingM:1,stations:5}]}])
 expect(rows).toHaveLength(1)
 expect(rows[0]!.offsetsM).toEqual([-5.5,-4.7,-3.9])
 expect(rows[0]!.spacingM).toBe(.8)
 expect(rows[0]!.sourceSegment).toBe(19)
})
it('labels fallback unit bases without inventing reinforcement spacing',()=>{
 const row=supportLongitudinalRows([{id:'zpm',supportType:'Z-PM',lengthM:2,layout:'original-unit-fallback',unitOffsetsM:[-2.5,-1.5]}])[0]!
 expect(row.kind).toBe('unit-base');expect(row.spacingM).toBeNull();expect(row.sourceSegment).toBeNull()
 const finding=supportLayoutFinding(row)
 expect(finding.observation).toContain('2个独立单元基准')
 expect(finding.evidence).toContain('不是1064米示例')
 expect(finding.designRequirement).toBeNull();expect(finding.fieldMeasurement).toBeNull()
 expect(finding.acceptance).toBe('not-verified')
 const steps=supportReviewSteps(row)
 expect(steps.map(s=>s.id)).toEqual(['overview','interface','components','evidence','conclusion'])
 expect(steps[2]!.question).toContain('单元基准')
 expect(steps[3]!.boundary).toContain('未提供')
 expect(supportLongitudinalRows([{id:'missing',layout:'original-unit-fallback',lengthM:20}])).toEqual([])
})
