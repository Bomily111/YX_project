import {expect,it} from 'vitest'
import {freeTaskViewport} from '@/platform/tasks/TaskViewport'
it('reserves real task and chat rails with margins',()=>{
 const r=freeTaskViewport(1400,900,[{left:20,top:80,right:300,bottom:840},{left:1020,top:60,right:1400,bottom:900}])!
 expect(r.left).toBe(316);expect(r.right).toBe(1004)
 expect(r.top).toBe(16);expect(r.bottom).toBe(884)
})
it('includes floating chart and ignores offscreen overlays',()=>{
 const r=freeTaskViewport(1400,900,[{left:20,top:80,right:400,bottom:840},{left:1020,top:60,right:1400,bottom:900},{left:2000,top:0,right:2400,bottom:900}])!
 expect(r.left).toBe(416);expect(r.right).toBe(1004)
})
it('refuses unusable space rather than inventing a fit',()=>{
 expect(freeTaskViewport(600,400,[{left:0,top:0,right:600,bottom:400}])).toBeNull()
 expect(freeTaskViewport(NaN,500,[])).toBeNull()
})
