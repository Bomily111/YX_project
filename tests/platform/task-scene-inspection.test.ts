import * as C from 'cesium'
import { expect, it } from 'vitest'
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
