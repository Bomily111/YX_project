import { expect,it } from 'vitest'
import { componentSpacing,componentStations } from '@/modules/support/example-layout'
it('uses the distinct 1064 m component intervals rather than repeating complete units',()=>{
 const va={steel_arch_m:.8,system_anchor_m:.8,secondary_ring_m:.25}
 expect(componentStations(20,componentSpacing('steel_arch',va))).toHaveLength(25)
 expect(componentStations(20,componentSpacing('system_anchor',va))).toHaveLength(25)
 expect(componentStations(20,componentSpacing('secondary_rebar_N1',va))).toHaveLength(80)
 expect(componentStations(20,componentSpacing('primary_concrete',va))).toHaveLength(20)
 expect(componentStations(20,componentSpacing('steel_arch',{steel_arch_m:1}))).toHaveLength(20)
})
it('retains source lattice/advance cycle rules and omits an overhanging connector',()=>{
 expect(componentSpacing('lattice_arch',{}, {longitudinal_spacing_mm:1200})).toBe(1.2)
 expect(componentSpacing('advance_support',{}, {longitudinal_cycle_spacing_mm:6000})).toBe(6)
 expect(componentStations(5,1.2,true)).toEqual([0,1.2,2.4,3.5999999999999996])
 expect(()=>componentStations(20,0)).toThrow()
})
