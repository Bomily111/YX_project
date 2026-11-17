import {chromium} from 'playwright-core'
import {mkdir,writeFile} from 'node:fs/promises'
const root='docs/verification/2026-11-17-r2-volume-online'
await mkdir(root,{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--enable-webgl','--use-gl=angle','--use-angle=d3d11']})
const report={passed:false,errors:[],checks:[],modelRequests:0};let page
const wait=async fn=>{const end=Date.now()+120000;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,300))}throw Error('Online feedback timeout')}
try{
 page=await browser.newPage({viewport:{width:1400,height:900}})
 page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/ai-agent/chat'))report.modelRequests++})
 await page.route('http://localhost:5178/api/**',route=>{const u=new URL(route.request().url());u.port='3000';return route.continue({url:u.toString()})})
 await page.goto('http://localhost:5178',{waitUntil:'domcontentloaded'});await page.locator('.agent-fab').click()
 const send=async(request,id)=>{
  const count=await page.locator('.agent-messages .msg-row.assistant').count()
  await page.locator('.agent-input').fill(request);await page.locator('.agent-input').press('Enter')
  await wait(async()=>await page.locator('.agent-messages .msg-row.assistant').count()>count)
  await page.locator('.agent-input').fill('idle');await wait(()=>page.locator('.send-btn').isEnabled());await page.locator('.agent-input').fill('')
  const answer=await page.locator('.agent-messages .msg-row.assistant').last().innerText()
  if(/余额不足|请求失败|认证失败/.test(answer))throw Error(answer)
  report.checks.push({id,request,answer});await page.screenshot({path:`${root}/${id}.png`})
  return answer
 }
 const state=()=>page.evaluate(async()=>{
 const {getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts'),{getTaskVolumeCutState}=await import('/src/platform/tasks/TaskVolumeCut.ts'),{viewerService}=await import('/src/platform/viewer/ViewerService.ts'),{getActiveModelerSupportModel}=await import('/src/modules/support/modeler-resources.ts')
 const v=viewerService.require(),s=getTaskWorkflowController().getStatus(),model=getActiveModelerSupportModel('support.modeler-zz-va')
 return {taskId:s.taskId,cut:getTaskVolumeCutState(),camera:window.Cesium.Cartesian3.pack(v.camera.positionWC,[]),support:model?Array.from(model.modelMatrix):null}
 })
 await send('在YK2+244同屏展示TSP坚硬度解释体和ZZ-Va支护断面，观察围岩与支护空间关系。','assemble')
 await wait(async()=>!!(await state()).cut)
 const before=await state()
 for(const [request,id,ymin] of [
 ['开启当前解释体展示剖切，保留原纵向地质参照，不截去近端；不改相机或支护。','geology',0.01],
 ['开启当前解释体的近端支护观察窗口，显露近端支护，不改相机、支护或源色标。','structure',0.2],
 ['关闭当前解释体展示剖切，恢复原完整显示范围，不改相机或支护。','restore',0.01],
 ]){
 await send(request,id);const after=await state()
 if(after.taskId!==before.taskId||JSON.stringify(after.support)!==JSON.stringify(before.support)||after.camera.some((n,i)=>Math.abs(n-before.camera[i])>1e-6))throw Error('Online strategy changed task, camera or support')
 if(Math.abs(after.cut.ymin-ymin)>1e-6||(id!=='restore'&&after.cut.xmax!==0.5)||(id==='restore'&&after.cut.xmax<=0.5))throw Error(`Wrong strategy ${JSON.stringify(after)}`)
 report.checks.at(-1).actual=after
 }
 await send('复位当前任务场景','reset')
 if(report.errors.length||!report.modelRequests)throw Error('Page errors or no online calls')
 report.passed=true
}catch(e){report.failure=e.message;if(page)await page.screenshot({path:`${root}/failure.png`}).catch(()=>{});throw e}
finally{await writeFile(`${root}/report.json`,JSON.stringify(report,null,2));await browser.close()}
