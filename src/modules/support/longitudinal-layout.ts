export interface SupportLayoutRow {
  id:string;resourceId:string;component:string;kind:'component-base'|'unit-base';type:string;lengthM:number
  offsetsM:number[];spacingM:number|null;sourceSegment:number|null
}
export function adjacentSupportIntervals(offsets: readonly number[], selected: number | null) {
  const index = selected === null ? -1 : offsets.indexOf(selected)
  if (index < 0) return []
  return [index - 1, index].flatMap(start => {
    const from = offsets[start], to = offsets[start + 1]
    if (from === undefined || to === undefined || !Number.isFinite(from) || !Number.isFinite(to) || to <= from) return []
    return [{ from, to, distanceM: to - from }]
  })
}
export function supportReviewSteps(row:SupportLayoutRow){
  return [
    {id:'overview',title:'整体理解',question:`本次${row.type} ${row.lengthM}m示意段处于什么范围？`,boundary:'仅核对当前装配范围，不等同现场施工范围。'},
    {id:'interface',title:'末站邻近区',question:'支护末站与三台阶方向的相对位置是否便于辨认？',boundary:'定位到实际记录的末站；未测接缝或断面贴合，不能判为通过。'},
    {id:'components',title:'构件布置',question:row.kind==='unit-base'?'已有单元基准如何分布？':'当前构件装配基准和示例间距是什么？',boundary:row.kind==='unit-base'?'单元间隔不能推断配筋间距。':'基准站位不等同构件中心或实测坐标。'},
    {id:'evidence',title:'来源核对',question:'当前数值来自哪份源模型或元数据？是否有本工段设计和实测？',boundary:'源模型元数据可追溯；工段设计要求、实测与方案页码未提供。'},
    {id:'conclusion',title:'回看与建议',question:'本次确认了哪些装配记录，还有哪些资料必须核查？',boundary:'只汇总示意装配观察与待核查项，不出具工程验收结论。'},
  ]
}
export function supportLayoutFinding(row:SupportLayoutRow){
  const first=row.offsetsM[0],last=row.offsetsM.at(-1)
  const range=first===undefined||last===undefined?'无可用站位记录':`${first.toFixed(2)}m至${last.toFixed(2)}m`
  const unit=row.kind==='unit-base'
  return {rowId:row.id,resourceId:row.resourceId,scope:'demonstration-assembly-not-field-acceptance',
    observation:`${row.type}本次${row.lengthM}m示意段，${row.offsetsM.length}个${unit?'独立单元基准':'构件装配基准'}，相对测试源断面范围${range}。`,
    evidence:unit?'依据为当前独立模型的实际单元放置记录；不是1064米示例的配筋布置。':`依据为1064米示例第${row.sourceSegment??'未提供'}段和本次装配记录；${row.spacingM===null?'该构件的统一基准间距未核验':`示例基准间距${row.spacingM}m`}。`,
    nextCheck:unit?'需核对本工段适用性及相应构件布置说明；不能从单元基准推断配筋间距。':'需按对应工段设计核对该构件间距、首末站布置和标高；定位标记不能证明断面贴合。',
    designRequirement:null,fieldMeasurement:null,acceptance:'not-verified'}
}
/** Consume recorded transforms' station offsets; never infer from mesh counts. */
export function supportLongitudinalRows(summaries:readonly any[]):SupportLayoutRow[]{
  return summaries.flatMap(s=>{
    if(s.layout==='original-unit-fallback'||s.layout==='original-unit-assembly'){
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
