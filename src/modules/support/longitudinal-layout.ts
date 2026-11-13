export interface SupportLayoutRow {
  id:string;resourceId:string;component:string;kind:'component-base'|'unit-base';type:string;lengthM:number
  offsetsM:number[];spacingM:number|null;sourceSegment:number|null
}
/** Consume recorded transforms' station offsets; never infer from mesh counts. */
export function supportLongitudinalRows(summaries:readonly any[]):SupportLayoutRow[]{
  return summaries.flatMap(s=>{
    if(s.layout==='original-unit-fallback'){
      if(!Array.isArray(s.unitOffsetsM))return []
      return [{id:`${s.id}:units`,resourceId:s.id,component:'units',kind:'unit-base' as const,type:s.supportType,lengthM:s.lengthM,
        offsetsM:[...s.unitOffsetsM],spacingM:null,sourceSegment:null}]
    }
    const rows=new Map<string,SupportLayoutRow>()
    for(const group of s.groups??[]){
      if(!Array.isArray(group.stationOffsetsM)||!group.stationOffsetsM.every(Number.isFinite))continue
      let row=rows.get(group.component)
      if(!row){row={id:`${s.id}:${group.component}`,resourceId:s.id,component:group.component,kind:'component-base',type:s.supportType,lengthM:s.lengthM,
        offsetsM:[],spacingM:Number.isFinite(group.spacingM)?group.spacingM:null,sourceSegment:s.sourceSegment??null};rows.set(group.component,row)}
      if(row.spacingM!==group.spacingM)row.spacingM=null
      for(const offset of group.stationOffsetsM)if(!row.offsetsM.some(s=>Math.abs(s-offset)<1e-8))row.offsetsM.push(offset)
    }
    return [...rows.values()].map(row=>({...row,offsetsM:row.offsetsM.sort((a,b)=>a-b)}))
  })
}
