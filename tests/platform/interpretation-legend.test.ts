import {expect,it} from 'vitest'
import fs from 'node:fs'
import {sourceInterpretationLegend} from '@/modules/rock/interpretation-legend'
const read=(file:string)=>JSON.parse(fs.readFileSync(file,'utf8'))
it.each([['vp','vp'],['vs','vs'],['ratio','vp_vs_ratio'],['anomaly','tsp_anomaly']])('reads actual %s units, range and source colour stops', (type,file)=>{
 const meta=read('public/data/tsp_actual/metadata.json'),config=read(`public/data/tsp_actual/${file}.json`)
 const legend=sourceInterpretationLegend(type!,meta,config)
 expect(legend.range).toEqual(meta.channels[type!].valueRange)
 expect(legend.unit).toBe(meta.channels[type!].unit)
 for(const stop of config.colourmaps[0].colours)expect(legend.gradient).toContain(stop.colour)
})
it('refuses missing calibration rather than inventing a default range',()=>{
 expect(()=>sourceInterpretationLegend('vp',{channels:{}},{})).toThrow()
})
