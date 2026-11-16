import {expect,it} from 'vitest'
import {validateChartSeries,defaultTransientTraces,summarizeSeriesWindow} from '@/modules/ventilation/chart-series'
it('preserves reverse flow and aligned samples without editing source arrays',()=>{
 const times=[0,5,10],values=[4,0,-2],s={name:'Right',values,color:'#fff'}
 const result=validateChartSeries(times,[s]);expect(result.series[0]!.values).toEqual(values)
 result.times[0]=2;expect(times[0]).toBe(0)
})
it('rejects independent time/value filtering that would shift the curve',()=>{
 expect(()=>validateChartSeries([0,NaN,10],[{name:'Q',values:[1,2,3],color:'#fff'}])).toThrow()
 expect(()=>validateChartSeries([0,5,10],[{name:'Q',values:[1,3],color:'#fff'}])).toThrow()
 expect(()=>validateChartSeries([0,0],[{name:'Q',values:[1,3],color:'#fff'}])).toThrow()
})
it('prioritizes actual right-line and reference branches while retaining an explicit limit',()=>{
 expect(defaultTransientTraces('ventilation.transient-fan-shutdown',['Other','Duct_Left','Duct_Right','Ret_Right_0_2300','Duct_DDK','Exit_Right'])).toEqual(['Duct_Right','Ret_Right_0_2300','Duct_Left','Duct_DDK','Exit_Right'])
 expect(defaultTransientTraces('ventilation.transient-damper-close',['Duct_Right','CP_2300_Left_Right'])).toEqual(['CP_2300_Left_Right','Duct_Right'])
})
it('reports actual window samples and reverse-flow changes without interpolating endpoints',()=>{
 const points=[[0,10],[5,0],[10,-2]]
 expect(summarizeSeriesWindow(points,[0,10])).toMatchObject({sampleCount:3,min:-2,max:10,change:-12,first:{time:0,value:10},last:{time:10,value:-2}})
 expect(summarizeSeriesWindow(points,[1,9])).toMatchObject({sampleCount:1,first:{time:5,value:0},last:{time:5,value:0}})
})
it('does not replace a window with no samples by zero or fabricate crossing times',()=>{
 expect(summarizeSeriesWindow([[0,10],[5,0]],[1,4])).toBeNull()
 expect(()=>summarizeSeriesWindow([[0,NaN]],[0,5])).toThrow()
})
