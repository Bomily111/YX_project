import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
const output='docs/verification/2026-11-11-platform-navigation'
await fs.mkdir(output,{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--enable-webgl','--use-gl=angle','--use-angle=d3d11']})
const report={surfaces:[],errors:[],passed:false}
let page
try{
 page=await browser.newPage({viewport:{width:1440,height:1000}})
 page.on('pageerror',error=>report.errors.push(error.message))
 await page.goto('http://localhost:5178',{waitUntil:'domcontentloaded'})
 const state=()=>page.evaluate(async()=>{
  const {viewerService}=await import('/src/platform/viewer/ViewerService.ts'),v=viewerService.require(),C=window.Cesium
  const {screenSpaceEventRegistry}=await import('/src/platform/input/ScreenSpaceEventRegistry.ts')
  return {position:[v.camera.positionWC.x,v.camera.positionWC.y,v.camera.positionWC.z],direction:[v.camera.directionWC.x,v.camera.directionWC.y,v.camera.directionWC.z],owners:screenSpaceEventRegistry.list().map(x=>x.owner),defaultInputs:v.scene.screenSpaceCameraController.enableInputs,viewerId:v.container.dataset.viewerInstanceId}
 })
 const move=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]))
 const drag=async(x,y,dx,dy,button='left')=>{await page.mouse.move(x,y);await page.mouse.down({button});await page.waitForTimeout(100);for(let n=1;n<=8;n++){await page.mouse.move(x+dx*n/8,y+dy*n/8);await page.waitForTimeout(40)}await page.mouse.up({button});await page.waitForTimeout(250)}
 for(const surface of [{id:'main',url:'/'},{id:'rock',url:'/?scene=workface'},{id:'dispatch',url:'/?scene=dispatch'},{id:'blast',url:'/blast-twin'},{id:'main-return',url:'/'}]){
  console.log(`START navigation ${surface.id}`)
  if(surface.id==='rock')await page.locator('.header-center .tn-item').filter({hasText:/^隧洞围岩$/}).click()
  if(surface.id==='dispatch')await page.getByRole('button').filter({hasText:'装备调度'}).click()
  if(surface.id==='blast')await page.getByRole('button').filter({hasText:'开挖爆破'}).click()
  if(surface.id==='main-return')await page.locator('a.tm-home').click()
  if(surface.id==='blast'){
   await page.waitForURL('**/blast-twin')
   await page.locator('a.tm-home').waitFor()
   await page.waitForFunction(async()=>{const {getBlastModel}=await import('/src/views/tunnel-module/blast.ts');return !!getBlastModel()?.ready},{},{timeout:120000})
  }
  if(surface.id==='main-return')await page.locator('.agent-fab').waitFor()
  await page.waitForFunction(async()=>{const {viewerService}=await import('/src/platform/viewer/ViewerService.ts');const {screenSpaceEventRegistry}=await import('/src/platform/input/ScreenSpaceEventRegistry.ts');return !!viewerService.current&&screenSpaceEventRegistry.list().some(x=>x.owner==='platform.camera-controls')},{},{timeout:120000})
  await page.waitForTimeout(surface.id==='blast'?4000:2000)
  console.log(`READY navigation ${surface.id}`)
  await page.evaluate(async surface=>{
   const {viewerService}=await import('/src/platform/viewer/ViewerService.ts'),{chainageService}=await import('/src/platform/coordinates/ChainageService.ts')
   const C=window.Cesium,v=viewerService.require();v.resolutionScale=.6;v.targetFrameRate=20;let target=chainageService.worldPositionAt(2244)
   if(surface==='blast'){const {getBlastModel}=await import('/src/views/tunnel-module/blast.ts');if(getBlastModel()?.ready)target=getBlastModel().boundingSphere.center}
   v.camera.cancelFlight();v.camera.lookAt(target,new C.HeadingPitchRange(1.1,-.4,160));v.camera.lookAtTransform(C.Matrix4.IDENTITY);v.scene.requestRender()
  },surface.id)
  await page.waitForTimeout(500)
  const canvas=page.locator('canvas').filter({visible:true}).first(),box=await canvas.boundingBox(),x=box.x+box.width*.48,y=box.y+box.height*.57
  const before=await state()
  console.log(`GESTURES navigation ${surface.id}`,await page.evaluate(({x,y})=>{const e=document.elementFromPoint(x,y);return {x,y,tag:e?.tagName,cls:e?.className,text:e?.textContent?.slice(0,100)}},{x,y}))
  if(before.defaultInputs||before.owners.filter(x=>/camera-controls$/.test(x)).length!==1)throw Error(`Duplicate/default camera controls on ${surface.id}: ${JSON.stringify(before)}`)
  await drag(x,y,70,25)
  const orbit=await state()
  if(move(before.direction,orbit.direction)<.001||move(before.position,orbit.position)>100000)throw Error(`Orbit failed ${surface.id}: ${JSON.stringify({before,orbit,positionDelta:move(before.position,orbit.position),directionDelta:move(before.direction,orbit.direction)})}`)
  await drag(x,y,45,18,'right')
  const pan=await state()
  if(move(pan.position,orbit.position)<.01||move(pan.direction,orbit.direction)>.00001)throw Error(`Pan failed ${surface.id}: ${JSON.stringify({orbit,pan,positionDelta:move(pan.position,orbit.position),directionDelta:move(pan.direction,orbit.direction)})}`)
  await page.mouse.move(x,y);await page.mouse.wheel(0,-120);await page.waitForTimeout(300)
  const zoom=await state()
  if(move(zoom.position,pan.position)<.01||move(zoom.direction,pan.direction)>.00001)throw Error(`Pointer zoom rotated camera ${surface.id}`)
  await page.keyboard.down('Shift');await drag(x,y,-30,12);await page.keyboard.up('Shift');await page.waitForTimeout(150)
  const shift=await state()
  if(move(shift.position,zoom.position)<.01||move(shift.direction,zoom.direction)>.00001)throw Error(`Shift-pan failed ${surface.id}: ${JSON.stringify({zoom,shift,positionDelta:move(shift.position,zoom.position),directionDelta:move(shift.direction,zoom.direction)})}`)
  report.surfaces.push({id:surface.id,viewerId:before.viewerId,owners:before.owners,orbitPositionDelta:move(before.position,orbit.position),panDirectionDelta:move(pan.direction,orbit.direction),zoomDirectionDelta:move(zoom.direction,pan.direction),shiftPanDirectionDelta:move(shift.direction,zoom.direction)})
  await page.screenshot({path:`${output}/${surface.id}.png`})
  console.log(`PASS navigation ${surface.id}`)
 }
 if(report.errors.length)throw Error(report.errors.join('\n'))
 report.passed=true
}catch(error){report.failure=error.message;if(page){await page.getByText('See more...', {exact:true}).click({timeout:1000}).catch(()=>{});report.renderError=await page.locator('.cesium-widget-errorPanel').innerText().catch(()=>'');await page.screenshot({path:output+'/failure.png',timeout:10000}).catch(()=>{})}throw error}finally{await fs.writeFile(output+'/report.json',JSON.stringify(report,null,2));await browser.close()}
