import {chromium} from 'playwright-core'
import {mkdir,writeFile} from 'node:fs/promises'
const root='docs/verification/2026-11-17-geographic-online'
await mkdir(root,{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--enable-webgl','--use-gl=angle','--use-angle=d3d11']})
const report={passed:false,modelRequests:0,errors:[],cases:[],diagnostics:[],configRequests:[]}
let page
const wait=async fn=>{const end=Date.now()+120000;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,250))}throw Error('Volume review timeout')}
try{
 page=await browser.newPage({viewport:{width:1400,height:900}})
 page.on('console',m=>{if(['error','warning'].includes(m.type()))report.diagnostics.push({type:m.type(),text:m.text().slice(0,1200)})})
 page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/ai-agent/chat'))report.modelRequests++})
 page.on('request',r=>{const u=new URL(r.url());if(r.method()==='GET'&&u.pathname.includes('/data/')&&u.pathname.endsWith('.json'))report.configRequests.push(u.pathname)})
 await page.route('http://localhost:5178/api/**',route=>{const u=new URL(route.request().url());u.port='3000';return route.continue({url:u.toString()})})
 await page.goto('http://localhost:5178',{waitUntil:'domcontentloaded'});await page.locator('.agent-fab').click()
 const environment=()=>page.evaluate(async()=>{
  const {viewerService}=await import('/src/platform/viewer/ViewerService.ts');const v=viewerService.require(),t=v.scene.globe.translucency,C=window.Cesium
  return {imagery:Array.from({length:v.imageryLayers.length},(_,i)=>{const l=v.imageryLayers.get(i);return {brightness:l.brightness,saturation:l.saturation,show:l.show}}),terrain:{enabled:t.enabled,front:t.frontFaceAlpha,back:t.backFaceAlpha,frontDistance:t.frontFaceAlphaByDistance&&[t.frontFaceAlphaByDistance.near,t.frontFaceAlphaByDistance.nearValue,t.frontFaceAlphaByDistance.far,t.frontFaceAlphaByDistance.farValue],rectangle:C.Rectangle.pack(t.rectangle,[])}}
 })
 await wait(async()=>!!(await environment()).terrain.frontDistance);
 await page.waitForTimeout(1000);
 const cases=[{id:'hardness',resources:['rock.tsp-hardness','support.modeler-zz-va'],chainage:1346},{id:'integrity',resources:['rock.tsp-integrity','support.modeler-zz-va'],chainage:2244}]
 for(const c of cases){
  const before=await environment()
  await page.getByRole('button',{name:'表单',exact:true}).click();const form=page.locator('.chat-task-form')
  await form.getByLabel('任务类型').selectOption('scene-exploration');await form.getByLabel('任务目标').fill('基于真实中线的测试工段，保留主页面地形');await form.getByLabel('目标里程').fill(`YK${Math.floor(c.chainage/1000)}+${String(c.chainage%1000).padStart(3,'0')}`)
  await wait(async()=>await form.getByLabel('隧洞').locator('option').count()>1);await form.getByLabel('隧洞').selectOption({index:1})
  while(await form.getByRole('button',{name:'移除',exact:true}).count())await form.getByRole('button',{name:'移除',exact:true}).first().click()
  for(const id of c.resources){await form.getByLabel('追加场景资源').selectOption(id);await form.getByRole('button',{name:'添加阶段',exact:true}).click()}
  await form.getByRole('button',{name:'校验并创建计划',exact:true}).click();await page.getByRole('button',{name:'自主执行剩余步骤',exact:true}).click()
  await wait(async()=>page.evaluate(async()=>{const {getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts');return getTaskWorkflowController().getStatus().status==='completed'}))
  await wait(async()=>!await page.locator('.tunnel-loading-overlay').isVisible())
  const after=await environment()
  if(JSON.stringify(before)!==JSON.stringify(after)||await page.getByTestId('task-terrain-context').count())throw Error('Task changed main-page terrain/imagery: '+JSON.stringify({before,after}))
  const positioning=await page.evaluate(async c=>{
   const {getActiveModelerSupportModel}=await import('/src/modules/support/modeler-resources.ts'),{chainageService}=await import('/src/platform/coordinates/ChainageService.ts'),{viewerService}=await import('/src/platform/viewer/ViewerService.ts')
   const C=window.Cesium,m=getActiveModelerSupportModel('support.modeler-zz-va'),anchor=chainageService.worldPositionAt(c.chainage),point=C.Matrix4.multiplyByPoint(m.modelMatrix,new C.Cartesian3(0,-2.1,0),new C.Cartesian3())
   let threeBenchError
   if(c.id==='three-bench'){const {getActiveThreeBenchModel,threeBenchMatrix}=await import('/src/modules/rock/three-bench-resource.ts'),{getTunnelGlbSegment}=await import('/src/utils/Common/DrawLine.ts');const expected=threeBenchMatrix(getTunnelGlbSegment(2).modelMatrix),actual=getActiveThreeBenchModel().modelMatrix;threeBenchError=Math.max(...Array.from(actual).map((x,i)=>Math.abs(x-expected[i])))}
   return {anchor:C.Cartesian3.pack(anchor,[]),designPoint:C.Cartesian3.pack(point,[]),errorM:C.Cartesian3.distance(anchor,point),threeBenchError,centerlineShown:viewerService.require().entities.getById('centerline-main')?.show}
  },c)
  if(positioning.errorM>1e-6||positioning.threeBenchError>1e-8)throw Error('Centerline placement mismatch')
  await page.screenshot({path:`${root}/${c.id}-detail.png`})
  const send=async request=>{
   const n=await page.locator('.agent-messages .msg-row.assistant').count();await page.locator('.agent-input').fill(request);await page.locator('.agent-input').press('Enter');await wait(async()=>await page.locator('.agent-messages .msg-row.assistant').count()>n);await page.locator('.agent-input').fill('idle');await wait(()=>page.locator('.send-btn').isEnabled());await page.locator('.agent-input').fill('');const answer=await page.locator('.agent-messages .msg-row.assistant').last().innerText();if(/请求失败|余额不足|未生成可用/.test(answer))throw Error(answer);return answer
  }
  const state=()=>page.evaluate(async()=>{
   const {viewerService}=await import('/src/platform/viewer/ViewerService.ts'),{taskCameraSelection}=await import('/src/platform/tasks/TaskCameraView.ts'),{getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts'),{getActiveModelerSupportModel}=await import('/src/modules/support/modeler-resources.ts'),{getTaskVolumeCutState}=await import('/src/platform/tasks/TaskVolumeCut.ts')
   const v=viewerService.require(),C=window.Cesium,m=getActiveModelerSupportModel('support.modeler-zz-va')
   return {taskId:getTaskWorkflowController().getStatus().taskId,matrix:Array.from(m.modelMatrix),cut:getTaskVolumeCutState(),view:taskCameraSelection.value,camera:[...C.Cartesian3.pack(v.camera.positionWC,[]),...C.Cartesian3.pack(v.camera.directionWC,[]),...C.Cartesian3.pack(v.camera.upWC,[])]}
  })
  const start=await state(),geoAnswer=await send('切换到当前任务的中线与地形视角，查看地理位置。'),geo=await state()
  if(geo.view!=='geographic'||geo.taskId!==start.taskId||JSON.stringify(geo.matrix)!==JSON.stringify(start.matrix)||JSON.stringify(geo.cut)!==JSON.stringify(start.cut))throw Error('Geographic chat reassembled or changed display')
  await page.evaluate(async()=>{const {refitTaskViewport}=await import('/src/platform/tasks/TaskViewport.ts'),{viewerService}=await import('/src/platform/viewer/ViewerService.ts');refitTaskViewport(viewerService.require())})
  await page.setViewportSize({width:1280,height:900});await page.waitForTimeout(300)
  const resized=await state();if(resized.camera.some((v,i)=>Math.abs(v-geo.camera[i])>(i<3?1e-6:1e-12)))throw Error('Old detail viewport target changed geographic camera')
  await page.setViewportSize({width:1400,height:900})
  const readAnswer=await send('只读查询当前任务的地理位置和里程，不切换视角，不改显示。'),readState=await state()
  if(readState.camera.some((v,i)=>Math.abs(v-geo.camera[i])>(i<3?1e-6:1e-12))||readState.taskId!==geo.taskId)throw Error('Read-only geographic query changed scene')
  const detailAnswer=await send('切换到当前任务的支护近景。'),detail=await state()
  if(detail.view!=='support'||detail.taskId!==start.taskId||JSON.stringify(detail.matrix)!==JSON.stringify(start.matrix)||JSON.stringify(await environment())!==JSON.stringify(after))throw Error('Detail transition changed location/environment')
  await send('回到当前任务的中线与地形视角。')
  const audit=await fetch(`http://localhost:3000/api/ai-agent/task-runs/${start.taskId}`).then(r=>r.json())
  if((audit.events?.filter(e=>e.action==='set_task_view'&&e.source==='agent'&&e.status==='completed').length??0)<3)throw Error('Missing actual view tool audit')
  report.cases.push({id:c.id+'-online',geoAnswer,readAnswer,detailAnswer,start,geo,resized,detail})
  await page.waitForTimeout(2500);await page.screenshot({path:`${root}/${c.id}-geographic.png`})
  report.cases.push({id:c.id,before,after,positioning})
  await page.locator('.agent-input').fill('复位当前任务场景');await page.locator('.agent-input').press('Enter');await wait(async()=>page.evaluate(async()=>{const {getActiveModelerSupportModel}=await import('/src/modules/support/modeler-resources.ts');return !getActiveModelerSupportModel('support.modeler-zz-va')}))
  if(JSON.stringify(await environment())!==JSON.stringify(before))throw Error('Reset changed the main environment')
 }
 if(report.errors.length||!report.modelRequests)throw Error('Page errors or missing online requests')
 report.passed=true
}catch(e){report.failure=e.message;if(page)await page.screenshot({path:`${root}/failure.png`}).catch(()=>{});throw e}
finally{await writeFile(`${root}/report.json`,JSON.stringify(report,null,2));await browser.close()}