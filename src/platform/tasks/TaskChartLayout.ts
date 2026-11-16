import type * as C from 'cesium'
/** Give a chart-only task the main analysis area; hybrid 3D tasks keep references. */
export function applyTaskChartLayout(viewer:C.Viewer,ids:readonly string[]){
 if(ids.length!==1||!ids.some(id=>/^ventilation\.transient-/.test(id)||id==='ventilation.co-analysis'))return ()=>{}
 const hosts=Array.from(viewer.container.querySelectorAll<HTMLElement>('[data-ventilation-enhancement="chart"]'))
 const saved=hosts.map(host=>({host,style:host.getAttribute('style'),layout:host.dataset.ventilationLayout}))
 const layout=()=>{
   for(const item of saved){
     if(!item.host.isConnected)continue
     if(viewer.container.clientWidth>=1100){Object.assign(item.host.style,{left:'316px',right:'400px',top:'80px',bottom:'64px',width:'auto',height:'auto',background:'#031421'});item.host.dataset.ventilationLayout='primary-task'}
     else{if(item.style===null)item.host.removeAttribute('style');else item.host.setAttribute('style',item.style);delete item.host.dataset.ventilationLayout}
   }
 }
 layout();window.addEventListener('resize',layout)
 return ()=>{window.removeEventListener('resize',layout);for(const {host,style,layout:previous} of saved){if(style===null)host.removeAttribute('style');else host.setAttribute('style',style);if(previous===undefined)delete host.dataset.ventilationLayout;else host.dataset.ventilationLayout=previous}}
}
