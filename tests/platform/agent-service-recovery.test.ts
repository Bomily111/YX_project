import {afterEach,expect,it,vi} from 'vitest'
import {AgentEngine} from '@/ai-agent/AgentEngine'
import {wantsTaskReset} from '@/ai-agent/AgentDispatchIntent'
import {agentServiceError} from '@/ai-agent/ServiceError'
afterEach(()=>vi.unstubAllGlobals())
it('keeps an explicitly requested reset independent of model availability',async()=>{
 const fetch=vi.fn(()=>{throw Error('provider unavailable')});vi.stubGlobal('fetch',fetch)
 let called='',shown=''
 await new AgentEngine('test').chat('复位当前任务场景，释放本次任务模型并恢复主场景。',{}, {onText:d=>shown+=d,onComplete:()=>{},onError:e=>{throw e},onToolUse:async call=>{called=call.name;return '{"ok":true}'}})
 expect(called).toBe('reset_task_scene');expect(fetch).not.toHaveBeenCalled();expect(shown).toContain('已复位')
})
it('does not turn questions or negated resets into an action',()=>{
 for(const text of ['不要复位当前任务场景','如何复位当前任务场景','只咨询：是否可以复位当前任务场景'])expect(wantsTaskReset(text)).toBe(false)
 expect(wantsTaskReset('复位当前任务场景，无需确认，不要重新装配')).toBe(true)
})
it('does not claim reset success if the platform rejects it',async()=>{
 let shown=''
 await new AgentEngine('test').chat('复位当前任务场景',{}, {onText:d=>shown+=d,onComplete:()=>{},onError:e=>{throw e},onToolUse:async()=>'{"ok":false,"reason":"任务正在执行"}'})
 expect(shown).toContain('任务正在执行');expect(shown).not.toContain('已复位')
})
it('reads current support records locally while the model is unavailable',async()=>{
 const fetch=vi.fn(()=>{throw Error('provider unavailable')});vi.stubGlobal('fetch',fetch)
 let shown='',tool=''
 await new AgentEngine('test').chat('当前支护类型是什么，长度多少？',{}, {onText:d=>shown+=d,onComplete:()=>{},onError:e=>{throw e},onToolUse:async call=>{tool=call.name;return JSON.stringify({ok:true,supports:[{type:'ZZ-Va',lengthM:5,layout:'1064m-component-example',components:[]}]})}})
 expect(fetch).not.toHaveBeenCalled();expect(tool).toBe('inspect_current_support');expect(shown).toContain('长度5米')
})
it('reports balance errors without exposing provider request payloads',()=>{
 const message=agentServiceError(500,'402 Insufficient Balance (request_id: private-id)')
 expect(message).toContain('余额不足');expect(message).not.toContain('private-id')
 expect(agentServiceError(401,'private credentials')).not.toContain('private credentials')
})
