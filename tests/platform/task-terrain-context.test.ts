import {expect,it,vi} from 'vitest'
import * as C from 'cesium'
import {applyTaskTerrainContext,taskTerrainContextActive} from '@/platform/tasks/TaskTerrainContext'

it('limits terrain attenuation to a task rectangle and restores existing distance rules exactly',()=>{
 const original={enabled:true,frontFaceAlpha:.7,backFaceAlpha:.6,
  frontFaceAlphaByDistance:new C.NearFarScalar(400,.9,800,.9),backFaceAlphaByDistance:undefined,
  rectangle:C.Rectangle.clone(C.Rectangle.MAX_VALUE)}
 const translucency=Object.assign(new C.GlobeTranslucency(),original)
 const viewer={scene:{globe:{translucency},requestRender:vi.fn()},isDestroyed:()=>false} as any
 const undo=applyTaskTerrainContext(viewer,1346)
 expect(taskTerrainContextActive.value).toBe(true)
 expect(translucency.frontFaceAlpha).toBe(.08)
 expect(translucency.frontFaceAlphaByDistance).toBeUndefined()
 expect(C.Rectangle.computeWidth(translucency.rectangle)).toBeLessThan(.02)
 undo();undo()
 expect(translucency.enabled).toBe(original.enabled)
 expect(translucency.frontFaceAlpha).toBe(original.frontFaceAlpha)
 expect(translucency.backFaceAlpha).toBe(original.backFaceAlpha)
 expect(translucency.frontFaceAlphaByDistance).toEqual(original.frontFaceAlphaByDistance)
 expect(translucency.backFaceAlphaByDistance).toEqual(original.backFaceAlphaByDistance)
 expect(translucency.rectangle).toEqual(original.rectangle)
 expect(taskTerrainContextActive.value).toBe(false)
})
