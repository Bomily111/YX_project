import {expect,it} from 'vitest'
import {buildTaskVisualGoal,createTaskVisualReviewController,type SceneInspection,type VisualGoalInput} from '@/platform/tasks/TaskVisualGoal'
import type {AgentTaskWorkflowStatus} from '@/platform/tasks/TaskWorkflowBridge'
const status=():AgentTaskWorkflowStatus=>({available:true,prepared:true,taskId:'one',status:'completed',completed:2,total:2,steps:[],contextKeys:[],scenePlans:[],lastCompletedStage:{stepId:'final',assembledResourceIds:['rock.three-bench','support.test-section'],chainageRange:{start:2244,end:2244}}})
const snapshot=(s:AgentTaskWorkflowStatus):SceneInspection=>({taskId:s.taskId!,completedSceneAvailable:true,resourceIds:[...s.lastCompletedStage!.assembledResourceIds],chainageRange:{start:2244,end:2244},issues:[],resources:[]} as unknown as SceneInspection)
const input=(objective:VisualGoalInput['objective']='component-detail'):VisualGoalInput=>({objective,focusResourceIds:['support.test-section'],questions:['支护构件在哪里？'],userRequest:'当前任务视觉分析，查看支护细部'})
it('accepts only a measured component of the one current test-support focus',()=>{
 const s=status(),e={...snapshot(s),resources:[{id:'support.test-section',runtimeState:'loaded',observation:{framing:{available:false},modelCoverage:'declared-targets-only'},componentDisplay:[{component:'steel_arch',totalNodes:2,visibleNodes:0}]}]} as SceneInspection
 const goal={...input(),focusComponent:'steel_arch'}
 expect(buildTaskVisualGoal(s,e,goal).focusComponent).toBe('steel_arch')
 expect(()=>buildTaskVisualGoal(s,e,{...goal,focusComponent:'imagined-component'})).toThrow('已读取')
 expect(()=>buildTaskVisualGoal(s,e,{...goal,objective:'source-review'})).toThrow('构件细部')
 expect(()=>buildTaskVisualGoal(s,snapshot(s),goal)).toThrow('已读取')
 let applied:string|undefined
 const c=createTaskVisualReviewController({status:()=>s,inspect:()=>e,captureView:()=>()=>{},applyView:(_ids,_chainage,_view,_emphasis,_scope,component)=>{applied=component?.component}})
 c.plan(goal);expect(applied).toBeUndefined();c.apply('one');expect(applied).toBe('steel_arch')
 const whole={...goal,objective:'spatial-relation' as const,referenceScope:'full' as const}
 expect(buildTaskVisualGoal(s,e,whole).candidate?.view).toBe('overview')
 let received:unknown
 const overview=createTaskVisualReviewController({status:()=>s,inspect:()=>e,captureView:()=>()=>{},applyView:(ids,_chainage,view,_emphasis,_scope,componentFocus)=>{received={ids,view,componentFocus}}})
 overview.plan(whole);overview.apply('one')
 expect(received).toEqual({ids:['rock.three-bench','support.test-section'],view:'overview',componentFocus:{resourceId:'support.test-section',component:'steel_arch'}})
})
it('same assembly produces different visual objectives without applying effects',()=>{
 const s=status(),e=snapshot(s)
 expect(buildTaskVisualGoal(s,e,input()).candidate?.view).toBe('support')
 expect(buildTaskVisualGoal(s,e,input('spatial-relation')).candidate?.view).toBe('overview')
 expect(buildTaskVisualGoal(s,e,input('source-review')).candidate).toBe(null)
 expect(buildTaskVisualGoal(s,e,input()).referenceResourceIds).toEqual(['rock.three-bench'])
 expect(()=>buildTaskVisualGoal(s,e,{...input(),focusResourceIds:['unknown']})).toThrow('当前任务根资源')
 expect(()=>buildTaskVisualGoal(s,e,{...input(),focusResourceIds:['rock.three-bench','support.test-section']})).toThrow('一种')
})
function setup(){
 const s=status();let view='original',calls=0,fail=false
 const controller=createTaskVisualReviewController({status:()=>s,inspect:()=>snapshot(s),captureView:()=>{const old=view;return()=>{view=old}},applyView:(_ids,_chainage,next)=>{calls++;view=next;if(fail)throw Error('camera failed')}})
 return {s,controller,view:()=>view,calls:()=>calls,fail:()=>{fail=true}}
}
it('plan is read-only; apply and restore preserve the first camera and share a bounded budget across re-planning',()=>{
 const t=setup();t.controller.plan(input());expect(t.calls()).toBe(0)
 expect(t.controller.inspect()?.canRestore).toBe(false)
 t.controller.apply('one');expect(t.view()).toBe('support')
 expect(t.controller.inspect()?.canRestore).toBe(true)
 t.controller.plan(input('spatial-relation'));t.controller.apply('one');expect(t.view()).toBe('overview')
 t.controller.restore('one');expect(t.view()).toBe('original')
 expect(t.controller.inspect()?.canRestore).toBe(false)
 t.controller.plan(input());expect(()=>t.controller.apply('one')).toThrow('2次上限');expect(t.calls()).toBe(2)
 expect(t.controller.inspect()).toMatchObject({remaining:0,budgetPolicy:{scope:'completed-scene',limit:2,replanResets:false,restoreRefunds:false}})
})
it('stale task and invalid id reject before touching the camera',()=>{
 const t=setup();t.controller.plan(input());expect(()=>t.controller.apply('wrong')).toThrow('ID')
 t.s.taskId='new';expect(()=>t.controller.apply('one')).toThrow('过期');expect(()=>t.controller.restore('one')).toThrow('过期');expect(t.calls()).toBe(0)
 t.controller.plan(input());expect(t.controller.inspect()?.remaining).toBe(2)
})
it('failure rolls back its camera change and consumes one attempt, source review has no write candidate',()=>{
 const t=setup();t.controller.plan(input());t.fail();expect(()=>t.controller.apply('one')).toThrow('camera failed');expect(t.view()).toBe('original');expect(t.controller.inspect()).toMatchObject({phase:'failed',remaining:1})
 t.controller.plan(input('source-review'));expect(()=>t.controller.apply('one')).toThrow('没有相机');expect(t.calls()).toBe(1)
})
it('unready resources prevent effects without spending a camera attempt',()=>{
 const s=status();let calls=0
 const c=createTaskVisualReviewController({status:()=>s,inspect:()=>({...snapshot(s),issues:[{code:'model-not-ready',detail:'pending'}]}),captureView:()=>()=>{},applyView:()=>{calls++}})
 c.plan(input());expect(()=>c.apply('one')).toThrow('未就绪');expect(calls).toBe(0);expect(c.inspect()?.remaining).toBe(2)
})

it('offers a bounded combined local-reference candidate only for the relevant assembly',()=>{
 const s=status();s.lastCompletedStage!.assembledResourceIds=['rock.tsp-hardness','support.modeler-zz-va']
 const goal={...input('spatial-relation'),focusResourceIds:['support.modeler-zz-va'],referenceScope:'near-support' as const}
 expect(buildTaskVisualGoal(s,snapshot(s),goal).candidate?.view).toBe('support-context')
 expect(()=>buildTaskVisualGoal(s,snapshot(s),{...goal,focusResourceIds:['rock.tsp-hardness']})).toThrow('支护为重点')
 expect(()=>buildTaskVisualGoal(status(),snapshot(status()),{...input('spatial-relation'),referenceScope:'near-support'})).toThrow('仅适用于')
})

it('keeps support emphasis optional and refuses changing the geological semantic palette',()=>{
 const s=status(),e=snapshot(s)
 expect(buildTaskVisualGoal(s,e,input()).emphasis).toBe('source')
 expect(buildTaskVisualGoal(s,e,{...input(),emphasis:'material-focus'}).emphasis).toBe('material-focus')
 const selected=status();selected.lastCompletedStage!.assembledResourceIds=['rock.tsp-hardness','support.modeler-zz-va']
 expect(buildTaskVisualGoal(selected,snapshot(selected),{...input(),focusResourceIds:['support.modeler-zz-va'],emphasis:'material-focus'}).emphasis).toBe('material-focus')
 expect(()=>buildTaskVisualGoal(selected,snapshot(selected),{...input('spatial-relation'),focusResourceIds:['rock.tsp-hardness'],emphasis:'material-focus'})).toThrow('不修改地质语义色标')
})

it('passes an explicit full reference through execution without confusing it with the current display range',()=>{
 const s=status();let scope:unknown='not-called'
 const controller=createTaskVisualReviewController({status:()=>s,inspect:()=>snapshot(s),captureView:()=>()=>{},applyView:(_ids,_chainage,_view,_emphasis,value)=>{scope=value}})
 expect(buildTaskVisualGoal(s,snapshot(s),input('spatial-relation')).referenceScope).toBeUndefined()
 controller.plan({...input('spatial-relation'),referenceScope:'full'});controller.apply('one');expect(scope).toBe('full')
})

it('restoration reports its measured state without replacing the historical enhanced snapshot',()=>{
 const s=status();let enhanced=false
 const read=()=>({...snapshot(s),resources:[{id:'support.test-section',runtimeState:'loaded',observation:{framing:{available:true,insideSafe:enhanced?26:8},modelCoverage:'declared-targets-only'}}]} as SceneInspection)
 const c=createTaskVisualReviewController({status:()=>s,inspect:read,captureView:()=>{const previous=enhanced;return()=>{enhanced=previous}},applyView:()=>{enhanced=true}})
 c.plan(input());const applied=c.apply('one')
 expect(applied.conditions[0]?.framing).toBe('26-samples-inside')
 const restored=c.restore('one')
 expect(restored.conditions[0]?.framing).toBe('incomplete')
 expect(restored.feedback?.after.resources[0]?.observation.framing).toMatchObject({insideSafe:26})
 expect(restored.restoredFeedback?.resources[0]?.observation.framing).toMatchObject({insideSafe:8})
 expect(restored.remaining).toBe(1)
 c.plan(input());expect(c.inspect()?.restoredFeedback).toBeUndefined()
 c.clear();expect(c.inspect()).toBeUndefined()
})

it('does not claim a rollback succeeded when recovery itself throws',()=>{
 const s=status();let broken=true
 const c=createTaskVisualReviewController({status:()=>s,inspect:()=>snapshot(s),captureView:()=>()=>{if(broken)throw Error('restore failed')},applyView:()=>{throw Error('draw failed')}})
 c.plan(input());expect(()=>c.apply('one')).toThrow('恢复未完成')
 expect(c.inspect()).toMatchObject({phase:'failed',recoveryStatus:'failed',remaining:1})
 expect(c.inspect()?.conditions[0]?.runtime).toBe('not-evaluated')
 broken=false;expect(c.restore('one')).toMatchObject({phase:'restored',remaining:1})
})

it('preserves the undo after failed restoration and reports no old successful conditions',()=>{
 const s=status();let broken=true
 const c=createTaskVisualReviewController({status:()=>s,inspect:()=>snapshot(s),captureView:()=>()=>{if(broken)throw Error('draw failed')},applyView:()=>{}})
 c.plan(input());c.apply('one');expect(()=>c.restore('one')).toThrow('恢复未完成')
 expect(c.inspect()).toMatchObject({phase:'failed',recoveryStatus:'failed',remaining:1})
 broken=false;expect(c.restore('one')).toMatchObject({phase:'restored',recoveryStatus:'restored',remaining:1})
})
it('uses the focused component framing while retaining whole-resource feedback and explicit fallback',()=>{
 const s=status();let enhanced=false,geometry=true
 const read=()=>({...snapshot(s),resources:[{id:'support.test-section',runtimeState:'loaded',observation:{framing:{available:true,insideSafe:14},modelCoverage:'declared-targets-only'},componentDisplay:[{component:'steel_arch',totalNodes:1,framing:geometry?{available:true,insideSafe:enhanced?26:10}:{available:false}}]}]} as SceneInspection)
 const c=createTaskVisualReviewController({status:()=>s,inspect:read,captureView:()=>()=>{enhanced=false},applyView:()=>{enhanced=true}})
 const goal={...input(),focusComponent:'steel_arch'}
 c.plan(goal);expect(c.inspect()?.conditions[0]?.framing).toBe('unknown')
 const applied=c.apply('one');expect(applied.conditions[0]).toMatchObject({framing:'26-samples-inside',framingScope:'focus-component'})
 expect(applied.feedback?.after.resources[0]?.observation.framing).toMatchObject({insideSafe:14})
 expect(c.restore('one').conditions[0]).toMatchObject({framing:'incomplete',framingScope:'focus-component'})
 geometry=false;c.plan(goal);expect(c.apply('one').conditions[0]).toMatchObject({framing:'incomplete',framingScope:'whole-resource-fallback'})
})
