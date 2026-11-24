import * as C from 'cesium'
type Style={color:C.Color|undefined;mode:C.Model['colorBlendMode'];amount:number}
const baseline=new Map<C.Model,Style>()
const snapshot=(model:C.Model):Style=>({color:model.color?C.Color.clone(model.color):undefined,mode:model.colorBlendMode,amount:model.colorBlendAmount})
const restore=(model:C.Model,style:Style)=>{if(model.isDestroyed())return;model.color=style.color?C.Color.clone(style.color):undefined;model.colorBlendMode=style.mode;model.colorBlendAmount=style.amount}
export function captureSupportFocusStyle(models:readonly C.Model[]){const saved=models.map(model=>({model,style:snapshot(model)}));return ()=>{for(const item of saved)restore(item.model,item.style)}}
export function tintSupportForFocus(model:C.Model){model.color=C.Color.fromCssColorString('#fff0bf');model.colorBlendMode=C.ColorBlendMode.MIX;model.colorBlendAmount=.45}
export function setSupportFocusStyle(models:readonly C.Model[],emphasis:'source'|'material-focus'){
 for(const model of models){
  if(!baseline.has(model))baseline.set(model,snapshot(model))
  if(emphasis==='source')restore(model,baseline.get(model)!)
  else tintSupportForFocus(model)
 }
}
export function clearSupportFocusStyle(){for(const [model,style] of baseline)restore(model,style);baseline.clear()}
