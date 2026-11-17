export interface ChartSeries {name:string;values:number[];color:string}
/** Correct only floating-point roundoff at an existing source sample. */
export function snapChartWindow(range:readonly number[],times:readonly number[]){
 return range.map(value=>times.find(time=>Math.abs(time-value)<=Number.EPSILON*Math.max(1,Math.abs(value),Math.abs(time))*16)??value)
}
/** Statistics use existing samples only; window endpoints are never interpolated. */
export function summarizeSeriesWindow(points:readonly (readonly number[])[],range:readonly number[]){
 if(range.length!==2||!range.every(Number.isFinite)||range[0]!>range[1]!||points.some(p=>p.length!==2||!p.every(Number.isFinite)))throw Error('图表窗口或源采样无效')
 const snapped=snapChartWindow(range,points.map(p=>p[0]!))
 const sampled=points.filter(p=>p[0]!>=snapped[0]!&&p[0]!<=snapped[1]!)
 if(!sampled.length)return null
 const first=sampled[0]!,last=sampled.at(-1)!
 return {sampleCount:sampled.length,first:{time:first[0]!,value:first[1]!},last:{time:last[0]!,value:last[1]!},min:Math.min(...sampled.map(p=>p[1]!)),max:Math.max(...sampled.map(p=>p[1]!)),change:last[1]!-first[1]!,measurement:'discrete-source-samples-without-interpolation'}
}
export function validateChartSeries(times:unknown,series:readonly {name:string;values:unknown;color:string}[]):{times:number[];series:ChartSeries[]}{
 if(!Array.isArray(times)||times.length<2||!times.every((t,i)=>Number.isFinite(t)&&(i===0||t>times[i-1])))throw Error('图表时间轴必须为严格递增的有限数值')
 if(!series.length||series.some(s=>!Array.isArray(s.values)||s.values.length!==times.length||!s.values.every(Number.isFinite)))throw Error('图表序列与时间轴不一致或含缺失值，拒绝压缩索引后错位绘图')
 return {times:[...times],series:series.map(s=>({...s,values:[...(s.values as number[])]}))}
}
export function defaultTransientTraces(owner:string,names:readonly string[]){
 const preferred=owner.includes('damper-close')?['CP_2300_Left_Right','CP_2300_DDK_Left','Duct_Right','Duct_Left','Duct_DDK']:['Duct_Right','Ret_Right_0_2300','Duct_Left','Duct_DDK','Exit_Right']
 return [...new Set([...preferred.filter(n=>names.includes(n)),...names])].slice(0,5)
}
