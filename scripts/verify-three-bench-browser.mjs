import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
const output='docs/verification/2026-11-11-three-bench-browser'
await fs.mkdir(output,{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}})
 await page.goto('http://localhost:5178',{waitUntil:'domcontentloaded'})
 await page.waitForFunction(async()=>{const {viewerService}=await import('/src/platform/viewer/ViewerService.ts');return !!viewerService.current})
 await page.waitForTimeout(1500)
 const report=await page.evaluate(async()=>{
  const C=window.Cesium,{viewerService}=await import('/src/platform/viewer/ViewerService.ts'),viewer=await viewerService.wait()
  const meta=await fetch('/data/tunnel/三台阶.metadata.json').then(r=>r.json())
  const {default:profile}=await import('/src/modules/face-sketch/tunnel-normal-sections.json')
  for(let i=0;i<viewer.scene.primitives.length;i++)viewer.scene.primitives.get(i).show=false
  viewer.entities.removeAll();viewer.scene.globe.show=false;viewer.scene.skyAtmosphere.show=false;viewer.scene.backgroundColor=C.Color.fromCssColorString('#10202d')
  const enu=C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(94.9046167002,29.5335168988,2951.021))
  const sourceFrame=C.Matrix4.multiply(enu,C.Matrix4.fromRotationTranslation(C.Matrix3.fromRotationX(Math.PI/2)),new C.Matrix4())
  const origin=new C.Cartesian3(...meta.sourceGltfOrigin)
  const mapping=C.Matrix4.fromRotationTranslation(C.Matrix3.fromRotationY(-Math.PI/2),origin)
  const frame=C.Matrix4.multiply(sourceFrame,mapping,new C.Matrix4())
  const model=await C.Model.fromGltfAsync({url:'/data/tunnel/三台阶.glb',modelMatrix:frame,upAxis:C.Axis.Z,forwardAxis:C.Axis.X})
  viewer.scene.primitives.add(model)
  const lines=viewer.scene.primitives.add(new C.PolylineCollection())
  viewer.scene.preRender.addEventListener(()=>{for(let i=0;i<viewer.scene.primitives.length;i++){const primitive=viewer.scene.primitives.get(i);primitive.show=primitive===model||primitive===lines}viewer.scene.skyBox.show=false})
  await new Promise((resolve,reject)=>{const started=Date.now();const timer=setInterval(()=>{viewer.scene.requestRender();if(model.ready){clearInterval(timer);resolve()}else if(Date.now()-started>45000){clearInterval(timer);reject(Error('Model not ready'))}},100)})
  for(const s of profile.sections.filter((_,i)=>[0,6,12,22].includes(i))){
   const positions=s.outline.map(([x,h])=>{
    const point=s.frame.center.map((value,i)=>value+s.frame.lateral[i]*x+s.frame.up[i]*h)
    return C.Matrix4.multiplyByPoint(sourceFrame,new C.Cartesian3(...point),new C.Cartesian3())
   })
   positions.push(positions[0]);lines.add({positions,width:1.5,material:C.Material.fromType('Color',{color:C.Color.CYAN.withAlpha(.65)})})
  }
  viewer.camera.viewBoundingSphere(model.boundingSphere,new C.HeadingPitchRange(.85,-.48,model.boundingSphere.radius*3.3))
  viewer.scene.requestRender()
  const style=document.createElement('style');style.textContent='.dashboard-container > :not(.globe-layer):not(.tech-header){visibility:hidden!important}';document.head.append(style)
  const banner=document.createElement('div');banner.textContent='三台阶 GLB 独立预览 · 青色线：源隧道断面 · 示意参数，尚未接入任务调度';banner.style.cssText='position:fixed;left:24px;top:85px;padding:16px;background:#10202de8;color:#c8efff;z-index:99999;font:18px sans-serif';document.body.append(banner)
  return {ready:model.ready,boundingRadius:model.boundingSphere.radius,profileSections:profile.sections.length,source:meta.profileSource,mode:'isolated asset preview with source-section overlays; not agent dispatch'}
 })
 await page.waitForTimeout(2500)
 await page.screenshot({path:output+'/three-bench.png'})
 await fs.writeFile(output+'/report.json',JSON.stringify({...report,passed:true},null,2)+'\n')
 console.log(report)
}finally{await browser.close()}
