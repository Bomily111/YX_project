import type {supportSectionComparison} from '@/modules/support/section-comparison'
import type {supportReviewEvidence} from '@/modules/support/review-evidence'
interface SupportInspectionReport {
 type:string;lengthM:number;layout:string;note?:string
 components:{label:string;visible:boolean;spacingM:number[];stations:number|null}[]
 reviewEvidence?:ReturnType<typeof supportReviewEvidence>
 sourceSectionComparison?:ReturnType<typeof supportSectionComparison>|null
}
export function formatSupportInspection(supports:readonly SupportInspectionReport[],request:string){
 return supports.map(support=>{
   const lines=[`当前支护：${support.type}，长度${support.lengthM}米。`]
   if(support.components.length){
     lines.push(...support.components.map(c=>`${c.label}：${c.visible?'显示':'隐藏'}；${c.spacingM.length?`布置间距${c.spacingM.join('/')}米，${c.stations}个布置站位。`:'原模型分组，构件间距未核验。'}`))
     lines.push(support.layout==='1064m-component-example'?'按1064米示例装配；布置站位数不等于单根杆件数量，示例参数不代表现场设计。':support.note??'')
   }else lines.push(support.note??'当前源模型未提供独立构件分组，不能查询各构件间距或显隐。')
   if(/断面|宽|高|尺寸/.test(request)){
     const comparison=support.sourceSectionComparison
     if(comparison?.envelopes.length){
       lines.push(`隧道源法向断面宽约${(comparison.tunnel.maxX-comparison.tunnel.minX).toFixed(2)}米，高约${comparison.tunnel.maxY.toFixed(2)}米。`)
       for(const e of comparison.envelopes)lines.push(`${e.component==='primary_concrete'?'初支混凝土':'二次衬砌'}源包围范围宽${(e.bounds.maxX-e.bounds.minX).toFixed(2)}米、高${(e.bounds.maxY-e.bounds.minY).toFixed(2)}米；总宽差${e.widthDifferenceM.toFixed(2)}米、总高差${e.heightDifferenceM.toFixed(2)}米。`)
       lines.push(comparison.note)
     }else lines.push('当前模型没有本项源断面对照记录，不能据模型类型推断尺寸或净空。')
   }
   if(/核查|核对|依据|缺口|缺什么|还缺|验收|建议/.test(request)&&support.reviewEvidence){
     const evidence=support.reviewEvidence
     lines.push(`记录核查：${evidence.recordStatus==='consistent'?'当前站位记录一致':'当前站位记录需补查'}，工程验收未核验。`,...evidence.evidenceGaps.map(g=>g.nextAction),evidence.stopReason)
   }
   return lines.filter(Boolean).join('\n')
 }).join('\n\n')
}
