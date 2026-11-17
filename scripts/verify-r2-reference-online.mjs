import {chromium} from 'playwright-core'
import {mkdir,writeFile} from 'node:fs/promises'
const root='docs/verification/2026-11-17-r2-reference-online'
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
 await send('关闭当前解释体展示剖切，恢复原完整显示范围，不改相机或支护。','initial-full')
 const full=await state()
 await send('规划并执行当前任务视觉分析：重点是支护，围岩只保留邻近空间参照，不看全段；组合近端剖切与局部取景，不改支护几何和源数据。','apply-local-context')
 const review=await page.evaluate(async()=>{const {taskVisualReview}=await import('/src/platform/tasks/TaskVisualReview.ts');return JSON.parse(JSON.stringify(taskVisualReview.value))})
 const after=await state()
 if(review?.plan.candidate?.view!=='support-context'||review.phase!=='applied'||after.cut.ymin!==.2||after.taskId!==full.taskId||JSON.stringify(after.support)!==JSON.stringify(full.support))throw Error('Model did not choose and apply the validated local-reference combination')
 report.checks.at(-1).review=review
 const referenceBefore=await state()
 const auditBefore=await fetch(`http://localhost:3000/api/ai-agent/task-runs/${referenceBefore.taskId}`).then(r=>r.json())
 const readsBefore=auditBefore.events?.filter(e=>e.action==='inspect_task_scene'&&e.source==='agent'&&e.status==='completed').length??0
 const answer=await send('只读读取当前场景状态，核对支护和局部采样参照的投影反馈。说明投影入区是否能证明地质特征可辨或深度遮挡解决，不改显示、不调整视角。','inspect-local-reference')
 const referenceAfter=await state()
 if(referenceAfter.taskId!==referenceBefore.taskId||JSON.stringify(referenceAfter.cut)!==JSON.stringify(referenceBefore.cut)||JSON.stringify(referenceAfter.support)!==JSON.stringify(referenceBefore.support)||referenceAfter.camera.some((n,i)=>Math.abs(n-referenceBefore.camera[i])>1e-6))throw Error('Reference query changed scene')
 const audit=await fetch(`http://localhost:3000/api/ai-agent/task-runs/${referenceBefore.taskId}`).then(r=>r.json())
 if((audit.events?.filter(e=>e.action==='inspect_task_scene'&&e.source==='agent'&&e.status==='completed').length??0)<=readsBefore||/未取得当前场景自检结果/.test(answer))throw Error('No fresh scene feedback read')
 await send('恢复分析前视角','restore-combination')
 const restored=await state()
 if(JSON.stringify(restored.cut)!==JSON.stringify(full.cut)||restored.camera.some((n,i)=>Math.abs(n-full.camera[i])>1e-6))throw Error('Combined strategy did not restore original cut and camera')
 await send('复位当前任务场景','reset')
 if(report.errors.length||!report.modelRequests)throw Error('Page errors or no online calls')
 report.passed=true
}catch(e){report.failure=e.message;if(page)await page.screenshot({path:`${root}/failure.png`}).catch(()=>{});throw e}
finally{await writeFile(`${root}/report.json`,JSON.stringify(report,null,2));await browser.close()}
