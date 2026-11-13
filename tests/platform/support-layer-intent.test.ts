import {expect,it} from 'vitest'
import {resolveSupportLayers,wantsSupportLayerControl,wantsSupportInspection} from '@/ai-agent/SupportLayerIntent'
import {wantsDirectSceneAssembly} from '@/ai-agent/AgentDispatchIntent'
const available=['primary_concrete','secondary_lining','steel_arch','system_anchor','lock_foot_anchor','secondary_rebar_N1']
it('routes current inventory and spacing questions read-only without intercepting catalog or action requests',()=>{
 for(const text of ['当前支护有哪些构件','这段钢架间距多少','当前哪些构件正在显示']){expect(wantsSupportInspection(text)).toBe(true);expect(wantsDirectSceneAssembly(text)).toBe(false)}
 for(const text of ['有哪些支护类型','显示钢架','当前只看钢架','装配当前支护'])expect(wantsSupportInspection(text)).toBe(false)
})
it('changes only named existing components and routes without assembly',()=>{
 const s='隐藏二衬，显示钢架和锚杆'
 expect(wantsSupportLayerControl(s)).toBe(true);expect(wantsDirectSceneAssembly(s)).toBe(false)
 expect(Object.fromEntries(resolveSupportLayers(s,available))).toEqual({secondary_lining:false,steel_arch:true,system_anchor:true,lock_foot_anchor:true})
})
it('supports explicit exclusive view and defaults',()=>{
 expect([...resolveSupportLayers('只看钢架',available)].filter(([,v])=>v)).toEqual([['steel_arch',true]])
 expect([...resolveSupportLayers('恢复支护默认显示',available).values()]).toEqual(available.map(()=>'default'))
})
it('rejects absent components, conflicts and missing current model before mutation',()=>{
 for(const s of ['显示钢架和掌子面','隐藏二衬，显示格栅','显示二衬钢筋N7','显示钢架，隐藏钢架','恢复默认并隐藏二衬'])expect(()=>resolveSupportLayers(s,available)).toThrow()
 expect(()=>resolveSupportLayers('只看钢架',[])).toThrow()
 expect(wantsSupportLayerControl('YK2+244装配支护模型')).toBe(false)
})
