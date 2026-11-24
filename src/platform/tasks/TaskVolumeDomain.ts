import * as C from 'cesium'
import {watch} from 'vue'
import {getTaskVolumeDomain,taskVolumeCutDisplay} from './TaskVolumeCut'

const setVisibility = new WeakMap<C.Viewer, (visible: boolean) => void>()

export function suspendTaskVolumeDomain(viewer: C.Viewer) {
  const show = setVisibility.get(viewer)
  show?.(false)
  return () => show?.(true)
}

/** Thin spatial reference only. Never denotes interpreted geological interfaces. */
export function installTaskVolumeDomain(viewer:C.Viewer){
 let entities:C.Entity[]=[]
 let visible = true
 setVisibility.set(viewer, value => {
   visible = value
   if (viewer.isDestroyed()) return
   entities.forEach(entity => { entity.show = value })
   viewer.scene.requestRender()
 })
 const clear=()=>{if(!viewer.isDestroyed())for(const e of entities)viewer.entities.remove(e);entities=[]}
 const update=()=>{
   clear();if(viewer.isDestroyed())return
   const domain=getTaskVolumeDomain();if(!domain)return
   for(let i=0;i<8;i++)for(const bit of [1,2,4])if(!(i&bit))entities.push(viewer.entities.add({
     show: visible, name:'体数据采样范围边框（非地质边界）',properties:{taskVolumeDomain:true},polyline:{positions:[domain.corners[i]!,domain.corners[i|bit]!],width:1.2,material:C.Color.fromCssColorString('#6bb9ca').withAlpha(.5)},
   }))
   viewer.scene.requestRender()
 }
 update()
 const stop=watch(taskVolumeCutDisplay,update,{flush:'sync'})
 return ()=>{setVisibility.delete(viewer);stop();clear();if(!viewer.isDestroyed())viewer.scene.requestRender()}
}
