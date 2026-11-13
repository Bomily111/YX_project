import {expect,it} from 'vitest'
import {planSupportDisplayContinuity as plan} from '@/ai-agent/SupportDisplayContinuity'
it('preserves shared components across length/type changes and leaves new groups default',()=>{
 const before=[{component:'lining',visible:false},{component:'steel',visible:true}]
 expect(plan(before,[{component:'lining',visible:true},{component:'steel',visible:true},{component:'new',visible:true}])).toEqual({mode:'preserved',changes:before})
})
it('falls back to defaults if the visible group disappears',()=>{
 expect(plan([{component:'steel',visible:true},{component:'lining',visible:false}],[{component:'lining',visible:true}])).toEqual({mode:'missing-visible-components',changes:[]})
})
it('keeps an intentional all-hidden view and supports no previous groups',()=>{
 expect(plan([{component:'lining',visible:false}],[{component:'lining',visible:true},{component:'new',visible:true}]).changes.every(l=>!l.visible)).toBe(true)
 expect(plan([],[{component:'lining',visible:true}])).toEqual({mode:'defaults',changes:[]})
})
