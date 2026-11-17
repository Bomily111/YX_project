import * as C from 'cesium'
import {afterEach,expect,it} from 'vitest'
import {captureSupportFocusStyle,setSupportFocusStyle,clearSupportFocusStyle} from '@/platform/tasks/SupportFocusStyle'
afterEach(clearSupportFocusStyle)
it('emphasizes display color only and restores an originally undefined color',()=>{
 const model={color:undefined,colorBlendMode:C.ColorBlendMode.HIGHLIGHT,colorBlendAmount:.5,modelMatrix:C.Matrix4.IDENTITY,isDestroyed:()=>false} as unknown as C.Model
 const restore=captureSupportFocusStyle([model]);setSupportFocusStyle([model],'material-focus')
 expect(model.color?.alpha).toBe(1);expect(model.colorBlendMode).toBe(C.ColorBlendMode.MIX);expect(model.modelMatrix).toBe(C.Matrix4.IDENTITY)
 restore();expect(model.color).toBeUndefined();expect(model.colorBlendMode).toBe(C.ColorBlendMode.HIGHLIGHT);expect(model.colorBlendAmount).toBe(.5)
})
it('source expression and task cleanup restore the baseline instead of leaving emphasis behind',()=>{
 const color=C.Color.BLUE.clone(),model={color,colorBlendMode:C.ColorBlendMode.MIX,colorBlendAmount:.2,isDestroyed:()=>false} as unknown as C.Model
 setSupportFocusStyle([model],'material-focus');setSupportFocusStyle([model],'source');expect(model.color).toEqual(color)
 setSupportFocusStyle([model],'material-focus');clearSupportFocusStyle();expect(model.color).toEqual(color);expect(model.colorBlendAmount).toBe(.2)
})
