import { afterEach, expect, it, vi } from 'vitest'
import { resolveTestSupportUpdate } from '@/ai-agent/TestSupportUpdate'
import { wantsTestSupportUpdate, wantsDirectSceneAssembly } from '@/ai-agent/AgentDispatchIntent'
import type { AgentTaskWorkflowStatus } from '@/platform/tasks/TaskWorkflowBridge'
import { AgentEngine } from '@/ai-agent/AgentEngine'
import { registerTools, unregisterModule } from '@/ai-agent/ToolRegistry'
const current = (): AgentTaskWorkflowStatus => ({ available:true,prepared:true,status:'completed',taskId:'previous-task',completed:3,total:3,steps:[],contextKeys:[],scenePlans:[],lastCompletedStage:{stepId:'scene-3',phase:'constructed-then-enhanced',assembledResourceIds:['rock.three-bench','support.test-section'],supportLengthM:5,chainageRange:{start:2244,end:2244}} })
afterEach(()=>{vi.unstubAllGlobals();unregisterModule('common')})
it('preserves length and excavation when only changing the type', () => {
  const next=resolveTestSupportUpdate('把支护改成ZZ-IVb',current())
  expect(next.supportLengthM).toBe(5)
  expect(next.resourceIds).toEqual(['rock.three-bench','support.test-section-zz-ivb'])
  expect(next.parentTaskId).toBe('previous-task')
})
it('preserves the actual type when only changing length and supports changing both', () => {
  const state=current();state.lastCompletedStage!.assembledResourceIds=['rock.three-bench','support.test-section-zz-ivb']
  expect(resolveTestSupportUpdate('长度改为15米',state)).toMatchObject({supportType:'ZZ-IVb',supportLengthM:15})
  expect(resolveTestSupportUpdate('改用Z-PM，长度改为8米',state)).toMatchObject({supportType:'Z-PM',supportLengthM:8})
  state.lastCompletedStage!.assembledResourceIds=['support.test-section-zz-ivb']
  expect(resolveTestSupportUpdate('长度改为8米',state).resourceIds).toEqual(['support.test-section-zz-ivb'])
})
it.each(['长度改为21米','长度改为2.5米','长度改为15','把支护改成ZZ-VI','把支护改成ZZ-II和ZZ-IVb','把支护厚度改为1米'])('rejects invalid changes without mutating current context %s', message=>{
  const state=current(),before=JSON.stringify(state)
  expect(()=>resolveTestSupportUpdate(message,state)).toThrow()
  expect(JSON.stringify(state)).toBe(before)
})
it('refuses unprepared, running, unrelated or out-of-section tasks',()=>{
  for(const change of [{prepared:false},{status:'running'},{lastCompletedStage:{...current().lastCompletedStage!,assembledResourceIds:['rock.tsp-integrity']}},{lastCompletedStage:{...current().lastCompletedStage!,chainageRange:{start:4000,end:4000}}}])expect(()=>resolveTestSupportUpdate('改用Z-PM',{...current(),...change})).toThrow()
})
it('routes short changes without capturing questions or new locations',()=>{
  for(const message of ['把支护改成ZZ-IVb','长度改为十五米','改用Z-PM']){expect(wantsTestSupportUpdate(message)).toBe(true);expect(wantsDirectSceneAssembly(message)).toBe(false)}
  for(const message of ['如何把支护改成ZZ-IVb','把支护改成ZZ-IVb，只预检','在YK4+000把支护改成ZZ-IVb','把照片换成另一张','只给计划不执行'])expect(wantsTestSupportUpdate(message)).toBe(false)
})
it('protects the original follow-up text from model-supplied input',async()=>{
  registerTools('common',[{module:'common',tool:{name:'update_test_support',description:'update',input_schema:{type:'object'}},executor:async()=> '{}'}])
  vi.stubGlobal('fetch',vi.fn(async()=>new Response([
    {type:'content_block_start',content_block:{type:'tool_use',id:'update',name:'update_test_support'}},
    {type:'content_block_delta',delta:{type:'input_json_delta',partial_json:'{"userRequest":"model-forged"}'}},
    {type:'content_block_stop'},
  ].map(event=>`data: ${JSON.stringify(event)}\n\n`).join(''))))
  const calls:any[]=[]
  await new AgentEngine('test').chat('长度改为15米',{}, {onText:()=>{},onComplete:()=>{},onError:error=>{throw error},onToolUse:async tool=>{calls.push(tool);return '{}'}})
  expect(calls).toHaveLength(1)
  expect(calls[0].input.userRequest).toBe('长度改为15米')
})
it('does not merge an older pending clarification into a live-task update',async()=>{
  registerTools('common',['assemble_scene_at_mileage','update_test_support'].map(name=>({module:'common' as const,tool:{name,description:name,input_schema:{type:'object'}},executor:async()=> '{}'})))
  let turn=0
  vi.stubGlobal('fetch',vi.fn(async()=>new Response((++turn===1 ? [
    {type:'content_block_delta',delta:{type:'text_delta',text:'请明确需要哪种资料？'}},
  ] : [
    {type:'content_block_start',content_block:{type:'tool_use',id:'update',name:'update_test_support'}},
    {type:'content_block_delta',delta:{type:'input_json_delta',partial_json:'{}'}},
    {type:'content_block_stop'},
  ]).map(event=>`data: ${JSON.stringify(event)}\n\n`).join(''))))
  const calls:any[]=[],engine=new AgentEngine('test')
  const callbacks={onText:()=>{},onComplete:()=>{},onError:(error:Error)=>{throw error},onToolUse:async(tool:any)=>{calls.push(tool);return '{}'}}
  await engine.chat('在YK2+244展示三台阶和ZZ-Va支护',{},callbacks)
  await engine.chat('把支护改成ZZ-IVb',{},callbacks)
  expect(calls).toHaveLength(1)
  expect(calls[0].input.userRequest).toBe('把支护改成ZZ-IVb')
})
