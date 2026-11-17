import * as C from 'cesium'
import {afterEach,expect,it,vi} from 'vitest'
vi.mock('@/platform/tasks/TaskViewport',()=>({readTaskViewport:()=>({safe:{left:0,top:0,right:100,bottom:100}}),inspectTaskSphereViewport:()=>({available:true,insideSafe:26})}))
import {inspectSupportContext} from '@/platform/tasks/SupportContextFeedback'
import {registerTaskVolumeAccess} from '@/platform/tasks/TaskVolumeCut'
afterEach(()=>{vi.restoreAllMocks();registerTaskVolumeAccess(()=>undefined)})
it('separates complete screen projection from unverified information and depth visibility',()=>{
 registerTaskVolumeAccess(()=>({modelMatrix:C.Matrix4.IDENTITY,properties:{xmin:0,xmax:1,ymin:0,ymax:1,zmin:0,zmax:1},draw:()=>{}}),()=> 'tsp_hardness')
 vi.spyOn(C.SceneTransforms,'worldToWindowCoordinates').mockImplementation((_s,p)=>new C.Cartesian2(p.x,p.z))
 const viewer={camera:{positionWC:new C.Cartesian3(-10,0,0),directionWC:C.Cartesian3.UNIT_X},scene:{}} as any
 const supports=[{boundingSphere:new C.BoundingSphere(new C.Cartesian3(-3,0,0),1)}] as any
 const result=inspectSupportContext(viewer,['rock.tsp-hardness'],supports)
 expect(result).toMatchObject({available:true,screenFraming:'focus-and-local-reference-in-safe-area',informationSufficiency:'not-verified',depthOcclusion:'not-measured'})
 viewer.camera.positionWC=new C.Cartesian3(10,0,0)
 const behind=inspectSupportContext(viewer,['rock.tsp-hardness'],supports)
 expect(behind).toMatchObject({available:true,screenFraming:'incomplete',reference:{insideSafe:0}})
 expect(inspectSupportContext(viewer,['rock.tsp-integrity'],supports).available).toBe(false)
})
