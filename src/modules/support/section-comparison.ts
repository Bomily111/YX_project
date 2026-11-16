import profile from '@/modules/face-sketch/tunnel-normal-sections.json'

export interface SectionBounds {minX:number;maxX:number;minY:number;maxY:number}
/** Compare recorded source envelopes at the shared floor datum, not design clearance. */
export function supportSectionComparison(groups:readonly {component:string;sourceBoundsXY?:SectionBounds}[]){
 const section=profile.supportSections.find(s=>Math.abs(s.distanceM+.5)<1e-8)!
 const floor=Math.min(...section.outline.map(p=>p[1]!))
 const outline=section.outline.map(p=>[p[0]!,p[1]!-floor])
 const tunnel={minX:Math.min(...outline.map(p=>p[0]!)),maxX:Math.max(...outline.map(p=>p[0]!)),minY:0,maxY:Math.max(...outline.map(p=>p[1]!))}
 const envelopes=groups.filter(g=>['primary_concrete','secondary_lining'].includes(g.component)).flatMap(g=>{
   const b=g.sourceBoundsXY
   if(!b||!Object.values(b).every(Number.isFinite)||b.maxX<=b.minX||b.maxY<=b.minY)return []
   // existingSupportPlacement maps template +X to source section -lateral.
   const bounds={minX:-b.maxX,maxX:-b.minX,minY:b.minY,maxY:b.maxY}
   return [{component:g.component,bounds,widthDifferenceM:bounds.maxX-bounds.minX-(tunnel.maxX-tunnel.minX),heightDifferenceM:bounds.maxY-bounds.minY-tunnel.maxY}]
 })
 return {scope:'source-envelope-comparison-not-clearance',referenceOffsetM:-.5,datum:'support-local-zero-aligned-to-source-tunnel-floor-not-surveyed',outline,tunnel,envelopes,
   engineeringAcceptance:'not-verified',note:'隧道为源法向轮廓，支护为源构件包围范围；宽高差不是壁厚、净空侵限或现场偏差。'}
}
