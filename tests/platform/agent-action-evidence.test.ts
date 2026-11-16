import {afterEach,expect,it,vi} from 'vitest'
import {AgentEngine} from '@/ai-agent/AgentEngine'
import {registerTools,unregisterModule} from '@/ai-agent/ToolRegistry'
import {wantsReadOnlyFlowEvaluation,wantsDirectSceneAssembly} from '@/ai-agent/AgentDispatchIntent'
afterEach(()=>{vi.unstubAllGlobals();unregisterModule('common')})
const stream=(events:unknown[])=>new Response(events.map(e=>`data: ${JSON.stringify(e)}\n\n`).join('')+'data: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}})
const text=(value:string)=>[{type:'content_block_delta',delta:{type:'text_delta',text:value}}]
const register=()=>registerTools('common',[{module:'common',tool:{name:'assemble_scene_at_mileage',description:'assemble',input_schema:{type:'object'}},executor:async()=>'{}'}])
it('does not publish historical completion as proof of a new action and retries once',async()=>{
 register();let requests=0,shown='',calls=0
 vi.stubGlobal('fetch',vi.fn(async()=>++requests===1?stream(text('该场景已完成，可继续查看。')):stream([
   {type:'content_block_start',content_block:{type:'tool_use',id:'new',name:'assemble_scene_at_mileage'}},
   {type:'content_block_delta',delta:{type:'input_json_delta',partial_json:'{}'}},{type:'content_block_stop'},
 ])))
 await new AgentEngine('test').chat('YK4+000展示爆后点云与完整风场',{}, {onText:d=>shown+=d,onComplete:()=>{},onError:e=>{throw e},onToolUse:async()=>{calls++;return '{"ok":true}'}})
 expect(requests).toBe(2);expect(calls).toBe(1);expect(shown).not.toContain('已完成')
})
it('stops after one correction without endorsing an unexecuted success',async()=>{
 register();let shown='',requests=0
 vi.stubGlobal('fetch',vi.fn(async()=>{requests++;return stream(text('场景已完成。'))}))
 await new AgentEngine('test').chat('YK4+000展示爆后点云',{}, {onText:d=>shown+=d,onComplete:()=>{},onError:e=>{throw e}})
 expect(requests).toBe(2);expect(shown).toContain('未执行新的场景操作');expect(shown).not.toContain('场景已完成')
})
it('lets a genuine clarification through without retrying execution',async()=>{
 register();let requests=0,shown=''
 vi.stubGlobal('fetch',vi.fn(async()=>{requests++;return stream(text('请提供目标里程？'))}))
 await new AgentEngine('test').chat('展示爆后点云',{}, {onText:d=>shown+=d,onComplete:()=>{},onError:e=>{throw e}})
 expect(requests).toBe(1);expect(shown).toContain('目标里程')
})
it('keeps a read-only flow request out of assembly despite negated assembly wording',()=>{
 const request='只读评价当前爆破通风复核画面，不要修改相机，不要重新装配。'
 expect(wantsReadOnlyFlowEvaluation(request)).toBe(true)
 expect(wantsDirectSceneAssembly(request)).toBe(false)
 expect(wantsReadOnlyFlowEvaluation('优化当前爆破通风画面并评价')).toBe(false)
})
it('rejects a mutating tool even if the model emits one during read-only evaluation',async()=>{
 register();let calls=0,offered:string[]=[]
 registerTools('common',[{module:'common',tool:{name:'evaluate_task_flow_review',description:'read only',input_schema:{type:'object'}},executor:async()=>'{}'}])
 vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{
   offered=JSON.parse(String(init?.body)).tools.map((t:{name:string})=>t.name)
   return stream([{type:'content_block_start',content_block:{type:'tool_use',id:'bad',name:'adjust_task_flow_review'}},{type:'content_block_delta',delta:{type:'input_json_delta',partial_json:'{}'}},{type:'content_block_stop'}])
 }))
 const engine=new AgentEngine('test')
 await engine.chat('只读评价当前爆破通风画面，不要重新装配',{}, {onText:()=>{},onComplete:()=>{},onError:e=>{throw e},onToolUse:async()=>{calls++;return '{}'}})
 expect(offered).toEqual(['evaluate_task_flow_review']);expect(calls).toBe(0)
 expect(engine.getMessages().at(-1)!.content).toContain('只读评价不允许修改')
})
