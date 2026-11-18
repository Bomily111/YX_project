import {afterEach,expect,it,vi} from 'vitest'
import {AgentEngine} from '@/ai-agent/AgentEngine'
import {registerTools,unregisterModule} from '@/ai-agent/ToolRegistry'
import {wantsReadOnlyFlowEvaluation,wantsDirectSceneAssembly,readOnlyTaskReviewTool} from '@/ai-agent/AgentDispatchIntent'
afterEach(()=>{vi.unstubAllGlobals();unregisterModule('common')})
const stream=(events:unknown[])=>new Response(events.map(e=>`data: ${JSON.stringify(e)}\n\n`).join('')+'data: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}})
const text=(value:string)=>[{type:'content_block_delta',delta:{type:'text_delta',text:value}}]
const register=()=>registerTools('common',[{module:'common',tool:{name:'assemble_scene_at_mileage',description:'assemble',input_schema:{type:'object'}},executor:async()=>'{}'}])
it.each(['', '  \n\t'])('reports an unavailable explanation instead of an empty assistant message (%j)',async answer=>{
 let shown='',completed=''
 vi.stubGlobal('fetch',vi.fn(async()=>stream(text(answer))))
 const engine=new AgentEngine('test')
 await engine.chat('介绍一下',{}, {onText:d=>shown+=d,onComplete:t=>{completed=t},onError:e=>{throw e}})
 expect(completed).toContain('未生成可用的文字说明')
 expect(shown).toContain('不能据此认定任务完成')
 expect(engine.getMessages().at(-1)?.content).toBe(completed)
})
it.each(['只读查看当前通风图表，不要重新装配','只读查看当前解释体采样范围，不要重新装配','只读查看当前场景自检和已装配资源，不要重新装配'])('blocks mutating tools during %s',async request=>{
 register();const name=readOnlyTaskReviewTool(request)!;let calls=0
 registerTools('common',[{module:'common',tool:{name,description:'read',input_schema:{type:'object'}},executor:async()=>'{}'}])
 vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{
  expect(JSON.parse(String(init?.body)).tools.map((t:{name:string})=>t.name)).toEqual([name])
  return stream([{type:'content_block_start',content_block:{type:'tool_use',id:'bad',name:'set_task_chart_review'}},{type:'content_block_delta',delta:{type:'input_json_delta',partial_json:'{}'}},{type:'content_block_stop'}])
 }))
 const engine=new AgentEngine('test')
 await engine.chat(request,{}, {onText:()=>{},onComplete:()=>{},onError:e=>{throw e},onToolUse:async()=>{calls++;return '{}'}})
 expect(calls).toBe(name==='inspect_task_scene'?1:0);expect(wantsDirectSceneAssembly(request)).toBe(false)
 expect(engine.getMessages().at(-1)!.content).toContain('只读核查不允许修改')
})
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

it('suppresses historical claims when the scene inspection tool is skipped twice',async()=>{
 registerTools('common',[{module:'common',tool:{name:'inspect_task_scene',description:'read',input_schema:{type:'object'}},executor:async()=>'{}'}])
 let requests=0,shown=''
 vi.stubGlobal('fetch',vi.fn(async()=>{requests++;return stream(text('当前三台阶和支护都正常，全部验收通过。'))}))
 await new AgentEngine('test').chat('只读查看当前场景自检，不改变任何显示',{}, {onText:d=>shown+=d,onComplete:()=>{},onError:e=>{throw e}})
 expect(requests).toBe(2);expect(shown).toContain('未取得当前场景自检结果');expect(shown).not.toContain('全部验收通过')
})

it('plan-only visual requests expose no apply tool and reject an emitted camera write',async()=>{
 registerTools('common',['inspect_task_scene','plan_task_visual_review','apply_task_visual_review'].map(name=>({module:'common' as const,tool:{name,description:name,input_schema:{type:'object'}},executor:async()=>'{}'})))
 let calls=0
 vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{
  expect(JSON.parse(String(init?.body)).tools.map((t:{name:string})=>t.name)).toEqual(['inspect_task_scene','plan_task_visual_review'])
  return stream([{type:'content_block_start',content_block:{type:'tool_use',id:'bad',name:'apply_task_visual_review'}},{type:'content_block_delta',delta:{type:'input_json_delta',partial_json:'{"taskId":"one"}'}},{type:'content_block_stop'}])
 }))
 await new AgentEngine('test').chat('只规划当前任务视觉分析，不执行',{}, {onText:()=>{},onComplete:()=>{},onError:e=>{throw e},onToolUse:async()=>{calls++;return '{}'}})
 expect(calls).toBe(0)
})

it('visual detail requests with 改为 bypass the legacy support update route and bind the original goal',async()=>{
 registerTools('common',['inspect_task_scene','plan_task_visual_review','apply_task_visual_review'].map(name=>({module:'common' as const,tool:{name,description:name,input_schema:{type:'object'}},executor:async()=>'{}'})))
 let round=0;const calls:string[]=[]
 const request='规划并执行当前任务视觉分析：改为支护构件细部辨识，先规划再应用受控视角'
 vi.stubGlobal('fetch',vi.fn(async()=>++round<=2?stream([{type:'content_block_start',content_block:{type:'tool_use',id:String(round),name:round===1?'plan_task_visual_review':'apply_task_visual_review'}},{type:'content_block_delta',delta:{type:'input_json_delta',partial_json:'{}'}},{type:'content_block_stop'}]):stream(text('已按当前计划执行视角分析'))))
 await new AgentEngine('test').chat(request,{}, {onText:()=>{},onComplete:()=>{},onError:e=>{throw e},onToolUse:async tool=>{calls.push(tool.name);if(tool.name==='plan_task_visual_review')expect(tool.input.userRequest).toBe(request);return JSON.stringify({ok:true,action:tool.name,review:{}})}})
 expect(calls).toEqual(['plan_task_visual_review','apply_task_visual_review'])
})

it('explains an exhausted visual budget even when the model stops after re-planning',async()=>{
 registerTools('common',[{module:'common',tool:{name:'plan_task_visual_review',description:'plan',input_schema:{type:'object'}},executor:async()=>'{}'}])
 let round=0,shown=''
 vi.stubGlobal('fetch',vi.fn(async()=>++round===1?stream([{type:'content_block_start',content_block:{type:'tool_use',id:'p',name:'plan_task_visual_review'}},{type:'content_block_delta',delta:{type:'input_json_delta',partial_json:'{}'}},{type:'content_block_stop'}]):stream(text('预算不足，本轮不能再移动视角'))))
 const engine=new AgentEngine('test')
 await engine.chat('规划并执行当前任务视觉分析，支护细部',{}, {onText:d=>shown+=d,onComplete:()=>{},onError:e=>{throw e},onToolUse:async()=>JSON.stringify({ok:true,action:'plan_task_visual_review',review:{remaining:0}})})
 expect(shown).toContain('2次上限');expect(shown).not.toContain('未取得所需工具')
 expect(engine.getMessages().filter(m=>m.role==='assistant'&&!m.tool_calls)).toHaveLength(1)
})

it('does not publish a fabricated fact citation after a genuine current-scene query',async()=>{
 registerTools('common',[{module:'common',tool:{name:'inspect_task_scene',description:'read',input_schema:{type:'object'}},executor:async()=>'{}'}])
 let round=0,shown=''
 vi.stubGlobal('fetch',vi.fn(async()=>++round===1?stream([{type:'content_block_start',content_block:{type:'tool_use',id:'r',name:'inspect_task_scene'}},{type:'content_block_delta',delta:{type:'input_json_delta',partial_json:'{}'}},{type:'content_block_stop'}]):stream(text('观察依据scene-old:location:99，全部通过'))))
 await new AgentEngine('test').chat('只读读取当前任务核查摘要',{}, {onText:d=>shown+=d,onComplete:()=>{},onError:e=>{throw e},onToolUse:async()=>JSON.stringify({ok:true,scene:{evidenceAssessment:{facts:[{id:'scene-live:location:1'}]}}})})
 expect(shown).toContain('不属于当前摘要窗口');expect(shown).not.toContain('全部通过');expect(shown).not.toContain('scene-old')
})

it('prioritizes explicit volume clipping over incidental 保留 and 支护 wording',async()=>{
 registerTools('common',['set_task_volume_cut','set_support_layers'].map(name=>({module:'common' as const,tool:{name,description:name,input_schema:{type:'object'}},executor:async()=>'{}'})))
 const calls:string[]=[]
 vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{
 expect(JSON.parse(String(init?.body)).tools.map((t:{name:string})=>t.name)).toEqual(['set_task_volume_cut'])
 return stream([{type:'content_block_start',content_block:{type:'tool_use',id:'c',name:'set_task_volume_cut'}},{type:'content_block_delta',delta:{type:'input_json_delta',partial_json:'{"enabled":true,"preset":"geology-section"}'}},{type:'content_block_stop'}])
 }))
 await new AgentEngine('test').chat('开启当前解释体展示剖切，保留原纵向地质参照，不改相机或支护',{}, {onText:()=>{},onComplete:()=>{},onError:e=>{throw e},onToolUse:async tool=>{calls.push(tool.name);return JSON.stringify({ok:true,action:tool.name})}})
 expect(calls).toEqual(['set_task_volume_cut'])
})

it('obtains a fresh explicit scene observation before the model explains a read-only request',async()=>{
 registerTools('common',[{module:'common',tool:{name:'inspect_task_scene',description:'read',input_schema:{type:'object'}},executor:async()=>'{}'}])
 const order:string[]=[]
 vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{order.push('model');const body=JSON.parse(String(init?.body));expect(body.messages.some((m:any)=>m.role==='tool'&&JSON.parse(m.content).scene?.freshMarker==='this-turn')).toBe(true);return stream(text('局部参照投影不等于可辨地质特征'))}))
 await new AgentEngine('test').chat('只读读取当前场景状态，不改视角',{}, {onText:()=>{},onComplete:()=>{},onError:e=>{throw e},onToolUse:async tool=>{order.push(tool.name);return JSON.stringify({ok:true,scene:{freshMarker:'this-turn'}})}})
 expect(order).toEqual(['inspect_task_scene','model'])
})
