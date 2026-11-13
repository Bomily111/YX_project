import * as C from 'cesium'
import {readonly,ref} from 'vue'
import {chainageService} from '@/platform/coordinates/ChainageService'

const active=ref(false)
export const taskTerrainContextActive=readonly(active)

/** Display-only local terrain attenuation; terrain and source assets are retained. */
export function applyTaskTerrainContext(viewer:C.Viewer,chainage:number):()=>void {
  const translucency=viewer.scene.globe?.translucency
  if(!translucency)return ()=>{}
  const points=[-220,0,220].map(offset=>chainageService.positionWithHeadingAt(chainage+offset)).filter((p):p is NonNullable<typeof p>=>!!p)
  if(!points.length)throw Error('任务地形范围不在中线内')
  const rectangle=C.Rectangle.fromDegrees(
    Math.min(...points.map(p=>p.longitude))-.0025,Math.min(...points.map(p=>p.latitude))-.0025,
    Math.max(...points.map(p=>p.longitude))+.0025,Math.max(...points.map(p=>p.latitude))+.0025)
  const previous={enabled:translucency.enabled,front:translucency.frontFaceAlpha,back:translucency.backFaceAlpha,
    frontDistance:translucency.frontFaceAlphaByDistance?C.NearFarScalar.clone(translucency.frontFaceAlphaByDistance):undefined,
    backDistance:translucency.backFaceAlphaByDistance?C.NearFarScalar.clone(translucency.backFaceAlphaByDistance):undefined,
    rectangle:C.Rectangle.clone(translucency.rectangle),active:active.value}
  let restored=false
  const restore=()=>{
    if(restored)return;restored=true
    if(!viewer.isDestroyed()){
      translucency.enabled=previous.enabled;translucency.frontFaceAlpha=previous.front;translucency.backFaceAlpha=previous.back
      translucency.frontFaceAlphaByDistance=previous.frontDistance;translucency.backFaceAlphaByDistance=previous.backDistance
      translucency.rectangle=previous.rectangle;viewer.scene.requestRender()
    }
    active.value=previous.active
  }
  try{
    translucency.enabled=true;translucency.rectangle=rectangle
    translucency.frontFaceAlphaByDistance=undefined;translucency.backFaceAlphaByDistance=undefined
    translucency.frontFaceAlpha=.08;translucency.backFaceAlpha=.08
    active.value=true;viewer.scene.requestRender();return restore
  }catch(error){restore();throw error}
}
