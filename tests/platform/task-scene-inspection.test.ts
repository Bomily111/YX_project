import * as C from 'cesium'
import { expect, it, vi } from 'vitest'
import * as viewport from '@/platform/tasks/TaskViewport'
import { inspectTaskScene } from '@/platform/tasks/TaskSceneInspection'
import { ResourceRegistry } from '@/platform/resources/ResourceRegistry'
import type { AgentTaskWorkflowStatus } from '@/platform/tasks/TaskWorkflowBridge'
import type { SceneResource } from '@/platform/resources/types'
const status = (): AgentTaskWorkflowStatus => ({available:true,prepared:true,taskId:'live',status:'completed',completed:2,total:2,steps:[],contextKeys:[],scenePlans:[],lastCompletedStage:{stepId:'final',phase:'constructed-then-enhanced',chainageRange:{start:2244,end:2244},assembledResourceIds:['rock.demo']}})
const setup = () => {
 const registry = new ResourceRegistry()
 const common:SceneResource = {id:'common.tunnel',module:'common',type:'base',processes:[],states:[],async load(){throw Error('read must never load')},async unload(){throw Error('read must never unload')}}
 registry.register(common)
 registry.register({...common,id:'rock.demo',module:'rock',dependencies:['common.tunnel'],getActiveAssetPaths:()=>['/data/demo.glb']})
 return registry
}
it('separates generated component framing from whole-resource framing and never fabricates missing geometry',()=>{
 const registry=setup(),model=Object.create(C.Model.prototype)
 Object.defineProperties(model,{isDestroyed:{value:()=>false},ready:{value:true},show:{value:true},modelMatrix:{value:C.Matrix4.fromTranslation(new C.Cartesian3(20,30,40))},boundingSphere:{value:new C.BoundingSphere(new C.Cartesian3(20,30,40),15)},getNode:{value:()=>({show:true})}})
 registry.register({id:'support.test-section',module:'support',type:'test',processes:[],states:[],async load(){},async unload(){},getEnhanceTargets:()=>[{id:'one',type:'support',object:model,metadata:{layout:'1064m-component-example',groups:[
  {component:'steel_arch',name:'a',generatedBounds:{min:[-1,-1,-1],max:[1,1,1]}},
  {component:'unknown-range',name:'b'},
 ]}}]})
 const projection=vi.spyOn(viewport,'inspectTaskSphereViewport').mockImplementation((_viewer,sphere)=>({available:true,insideSafe:sphere.radius<5?26:14,projected:26,behind:0,safe:{left:0,top:0,right:100,bottom:100},measurement:'26-bounding-sphere-samples-not-visible-model-pixels',occlusion:'not-measured'}))
 try{
  const s=status();s.lastCompletedStage!.assembledResourceIds=['support.test-section']
  const r=inspectTaskScene(s,registry,[{id:'support.test-section',status:'loaded',references:1}],{isDestroyed:()=>false} as C.Viewer).resources[0]!
  expect(r.observation.framing).toMatchObject({insideSafe:14})
  expect(r.componentDisplay.find(c=>c.component==='steel_arch')?.framing).toMatchObject({insideSafe:26})
  expect(r.componentDisplay.find(c=>c.component==='unknown-range')?.framing).toEqual({available:false})
  expect(projection.mock.calls[1]?.[1].center).toEqual(new C.Cartesian3(20,30,40))
 }finally{projection.mockRestore()}
})
it('deduplicates recorded component bases and leaves unprovided spacing unknown',()=>{
 const registry=setup(),model=Object.create(C.Model.prototype)
 Object.defineProperties(model,{isDestroyed:{value:()=>false},ready:{value:true},show:{value:true},color:{value:C.Color.RED},colorBlendMode:{value:C.ColorBlendMode.MIX},colorBlendAmount:{value:.45},boundingSphere:{value:new C.BoundingSphere(C.Cartesian3.ZERO,3)},getNode:{value:()=>({show:true})}})
 registry.register({id:'support.test-section',module:'support',type:'test',processes:[],states:[],async load(){},async unload(){},getEnhanceTargets:()=>[{id:'one',type:'support',object:model,metadata:{sourceSegment:19,sourceStatus:'PARTIAL',groups:[
  {component:'steel_arch',name:'a',spacingM:.8,stationOffsetsM:[-5.5,-4.7]},
  {component:'steel_arch',name:'b',spacingM:.8,stationOffsetsM:[-4.7,-3.9]},
  {component:'secondary_rebar_N3',name:'n3'},
 ]}}]})
 const s=status();s.lastCompletedStage!.assembledResourceIds=['support.test-section']
 const r=inspectTaskScene(s,registry,[{id:'support.test-section',status:'loaded',references:1}])
 expect(r.resources[0]?.sourceHints).toContainEqual({sourceStatus:'PARTIAL'})
 expect(r.resources[0]?.observation.displayStyles).toEqual([{targetId:'one',show:true,colorRgba:[1,0,0,1],colorBlendMode:C.ColorBlendMode.MIX,colorBlendAmount:.45}])
 expect(r.resources[0]?.componentDisplay.find(c=>c.component==='steel_arch')).toMatchObject({totalNodes:2,sourceAssembly:{spacingM:[.8],baseStationCount:3,offsetRangeM:[-5.5,-3.9],sourceSegments:[19]}})
 expect(r.resources[0]?.componentDisplay.find(c=>c.component==='secondary_rebar_N3')?.sourceAssembly).toMatchObject({spacingM:[],baseStationCount:null,offsetRangeM:null})
})
it('reports resource dependencies and observation gaps without treating missing targets as absence',()=>{
 const registry=setup(),s=status(),before=JSON.stringify(s)
 const r=inspectTaskScene(s,registry,[{id:'rock.demo',status:'loaded',references:1}])
 expect(r.resourceIds).toEqual(['rock.demo'])
 expect(r.resources.map(r=>r.id)).toEqual(['common.tunnel','rock.demo'])
 expect(r.resources[1]).toMatchObject({assetPaths:['/data/demo.glb'],observation:{modelCoverage:'incomplete',readyModelCount:0}})
 expect(r.issues).toContainEqual(expect.objectContaining({resourceId:'common.tunnel',code:'not-loaded'}))
 expect(r.engineeringAcceptance).toBe('not-verified')
 expect(JSON.stringify(s)).toBe(before)
})
it('never promotes an old completed stage while a workflow is running or reset',()=>{
 for(const workflowStatus of ['running','failed','idle']){
  const s=status();s.status=workflowStatus
  const r=inspectTaskScene(s,setup(),[{id:'rock.demo',status:'loaded',references:1}])
  expect(r.completedSceneAvailable).toBe(false);expect(r.resources).toEqual([]);expect(r.chainageRange).toBe(null)
 }
})
it('keeps inspection errors and other owners visible without guessing leaks or releasing them',()=>{
 const registry=setup()
 registry.register({id:'rock.broken',module:'rock',type:'broken',processes:[],states:[],async load(){},async unload(){},getActiveAssetPaths:()=>{throw Error('path unavailable')}})
 const s=status();s.lastCompletedStage!.assembledResourceIds=['rock.broken']
 const r=inspectTaskScene(s,registry,[{id:'rock.broken',status:'loaded',references:1},{id:'rock.demo',status:'loaded',references:2}])
 expect(r.loadedOutsideCurrentScene).toEqual(['rock.demo'])
 expect(r.issues).toContainEqual(expect.objectContaining({code:'inspection-error',detail:expect.stringContaining('path unavailable')}))
 expect(r.resources[0]!.assetPaths).toEqual([])
})

it('reads whole-model visibility and never touches an unready bounding sphere',()=>{
 const registry=setup(),notReady=Object.create(C.Model.prototype),hidden=Object.create(C.Model.prototype)
 Object.defineProperties(notReady,{isDestroyed:{value:()=>false},ready:{value:false},show:{value:true},boundingSphere:{get:()=>{throw Error('must not read before ready')}}})
 Object.defineProperties(hidden,{isDestroyed:{value:()=>false},ready:{value:true},show:{value:false},boundingSphere:{value:new C.BoundingSphere(C.Cartesian3.ZERO,3)}})
 registry.register({id:'rock.models',module:'rock',type:'models',processes:[],states:[],async load(){},async unload(){},getEnhanceTargets:()=>[{id:'pending',type:'model',object:notReady},{id:'hidden',type:'model',object:hidden,metadata:{note:'示意模型，无测量对应'}}]})
 const s=status();s.lastCompletedStage!.assembledResourceIds=['rock.models']
 const r=inspectTaskScene(s,registry,[{id:'rock.models',status:'loaded',references:1}])
 expect(r.resources[0]!.observation).toMatchObject({pendingModelCount:1,hiddenModelCount:1,readyModelCount:1,framing:{available:false}})
 expect(r.resources[0]!.sourceHints).toEqual([{note:'示意模型，无测量对应'}])
 expect(r.issues.map(i=>i.code)).toEqual(expect.arrayContaining(['model-not-ready','model-hidden']))
})
