import * as C from 'cesium'

export interface ScreenRect {left:number;top:number;right:number;bottom:number}
const targets=new WeakMap<C.Viewer,C.BoundingSphere>()
export function clearTaskViewportTarget(viewer:C.Viewer){targets.delete(viewer)}
export function refitTaskViewport(viewer:C.Viewer){const target=targets.get(viewer);return target?fitTaskCameraToViewport(viewer,target):undefined}
const area=(r:ScreenRect)=>Math.max(0,r.right-r.left)*Math.max(0,r.bottom-r.top)
const overlaps=(a:ScreenRect,b:ScreenRect)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top

/** Largest rectangular working area left by the visible DOM overlays. */
export function freeTaskViewport(width:number,height:number,obstacles:readonly ScreenRect[],padding=16):ScreenRect|null {
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=padding*2||height<=padding*2)return null
  const bounds={left:padding,top:padding,right:width-padding,bottom:height-padding}
  const blocks=obstacles.map(r=>({left:Math.max(bounds.left,r.left-padding),top:Math.max(bounds.top,r.top-padding),right:Math.min(bounds.right,r.right+padding),bottom:Math.min(bounds.bottom,r.bottom+padding)})).filter(r=>area(r)>0)
  const xs=[...new Set([bounds.left,bounds.right,...blocks.flatMap(r=>[r.left,r.right])])].sort((a,b)=>a-b)
  const ys=[...new Set([bounds.top,bounds.bottom,...blocks.flatMap(r=>[r.top,r.bottom])])].sort((a,b)=>a-b)
  let best:ScreenRect|null=null
  for(let i=0;i<xs.length;i++)for(let j=i+1;j<xs.length;j++)for(let k=0;k<ys.length;k++)for(let l=k+1;l<ys.length;l++){
    const r={left:xs[i]!,right:xs[j]!,top:ys[k]!,bottom:ys[l]!}
    if(r.right-r.left<160||r.bottom-r.top<120||blocks.some(b=>overlaps(r,b)))continue
    if(!best||area(r)>area(best))best=r
  }
  return best
}

export function readTaskViewport(viewer:C.Viewer){
  const canvas=viewer.scene.canvas,rect=canvas?.getBoundingClientRect()
  if(!rect?.width||!rect.height)return null
  const doc=canvas.ownerDocument
  const selectors='.agent-window,.agent-assembly-info,.gpr-float,.d2d,.tsp-legend,.tem-legend,.grade-legend,[data-ventilation-enhancement="chart"],.tech-header,.bottom-metrics-bar,.agent-assembly-bottom'
  const obstacles=Array.from(doc.querySelectorAll(selectors)).filter(e=>{
    const css=doc.defaultView?.getComputedStyle(e)
    return css?.display!=='none'&&css?.visibility!=='hidden'
  }).map(e=>e.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0).map(r=>({left:r.left-rect.left,right:r.right-rect.left,top:r.top-rect.top,bottom:r.bottom-rect.top}))
  return {width:rect.width,height:rect.height,safe:freeTaskViewport(rect.width,rect.height,obstacles),obstacles}
}

export function inspectTaskSphereViewport(viewer:C.Viewer,sphere:C.BoundingSphere){
  const viewport=readTaskViewport(viewer),safe=viewport?.safe
  if(!viewport||!safe)return {available:false as const}
  let projected=0,insideSafe=0,behind=0
  const {camera,scene}=viewer
  // Sample the conservative bounding sphere, not the model's visible pixels.
  for(const x of [-1,0,1])for(const y of [-1,0,1])for(const z of [-1,0,1]){
    if(!x&&!y&&!z)continue
    const direction=C.Cartesian3.normalize(new C.Cartesian3(x,y,z),new C.Cartesian3())
    const p=C.Cartesian3.add(sphere.center,C.Cartesian3.multiplyByScalar(direction,sphere.radius,new C.Cartesian3()),new C.Cartesian3())
    if(C.Cartesian3.dot(C.Cartesian3.subtract(p,camera.positionWC,new C.Cartesian3()),camera.directionWC)<=0){behind++;continue}
    const xy=C.SceneTransforms.worldToWindowCoordinates(scene,p)
    if(!xy)continue
    projected++
    if(xy.x>=safe.left&&xy.x<=safe.right&&xy.y>=safe.top&&xy.y<=safe.bottom)insideSafe++
  }
  return {available:true as const,projected,insideSafe,behind,safe,measurement:'26-bounding-sphere-samples-not-visible-model-pixels',occlusion:'not-measured'}
}

/** Fit a conservative sphere in actual free screen space without changing models.
 * This evaluates framing only, not model occlusion. At most two corrections. */
export function fitTaskCameraToViewport(viewer:C.Viewer,sphere:C.BoundingSphere){
  const viewport=readTaskViewport(viewer),safe=viewport?.safe,camera=viewer.camera
  if(!viewport||!safe||!Number.isFinite(sphere.radius)||sphere.radius<=0)return {status:'unavailable' as const}
  const width=safe.right-safe.left,height=safe.bottom-safe.top
  const saved={position:C.Cartesian3.clone(camera.positionWC),direction:C.Cartesian3.clone(camera.directionWC),up:C.Cartesian3.clone(camera.upWC)}
  try{
    let corrections=0
    for(let i=0;i<2;i++){
      const distance=C.Cartesian3.distance(camera.positionWC,sphere.center)
      const pixel=camera.frustum.getPixelDimensions(viewport.width,viewport.height,distance,1,new C.Cartesian2())
      if(!(pixel.x>0&&pixel.y>0))throw Error('当前视锥不可计算')
      // Near side of the sphere projects larger than its center section.
      const ratio=Math.max(2*sphere.radius/pixel.x/(width*.86),2*sphere.radius/pixel.y/(height*.86))
      if(ratio>1){camera.moveBackward(distance*(ratio-1)+sphere.radius*.12);corrections++}
      const xy=C.SceneTransforms.worldToWindowCoordinates(viewer.scene,sphere.center)
      if(!xy)throw Error('目标中心不可投影')
      const nextDistance=C.Cartesian3.distance(camera.positionWC,sphere.center)
      const nextPixel=camera.frustum.getPixelDimensions(viewport.width,viewport.height,nextDistance,1,new C.Cartesian2())
      camera.moveRight((xy.x-(safe.left+safe.right)/2)*nextPixel.x)
      camera.moveUp(((safe.top+safe.bottom)/2-xy.y)*nextPixel.y)
    }
    viewer.scene.requestRender()
    targets.set(viewer,C.BoundingSphere.clone(sphere))
    return {status:'fitted' as const,safe,corrections,measurement:'bounding-sphere-screen-space-not-depth-occlusion'}
  }catch(error){camera.setView({destination:saved.position,orientation:{direction:saved.direction,up:saved.up}});throw error}
}
