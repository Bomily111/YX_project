import {expect,it} from 'vitest'
import {formatSupportInspection} from '@/ai-agent/SupportInspectionReply'
import {supportSectionComparison} from '@/modules/support/section-comparison'
const support={type:'ZZ-Va',lengthM:5,layout:'1064m-component-example',components:[{label:'钢拱架',visible:true,spacingM:[.8],stations:7}],sourceSectionComparison:supportSectionComparison([{component:'primary_concrete',sourceBoundsXY:{minX:-6.36,maxX:6.36,minY:0,maxY:9.29}}])}
it('reports actual source envelope dimensions without asserting design clearance',()=>{
 const reply=formatSupportInspection([support],'当前支护断面宽多少？')
 expect(reply).toContain('12.72米');expect(reply).toContain('11.00米')
 expect(reply).toContain('不是壁厚、净空侵限或现场偏差')
})
it('keeps ordinary display answers compact and reports missing comparison records',()=>{
 expect(formatSupportInspection([support],'当前钢架间距多少')).not.toContain('源包围范围宽')
 expect(formatSupportInspection([{...support,sourceSectionComparison:null}],'当前支护断面宽多少')).toContain('没有本项源断面对照记录')
})
