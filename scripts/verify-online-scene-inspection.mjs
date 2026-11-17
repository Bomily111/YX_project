import {chromium} from 'playwright-core'
import {mkdir,writeFile} from 'node:fs/promises'
const root=process.env.SCENE_INSPECTION_OUTPUT_DIR||'docs/verification/2026-11-16-scene-inspection-online'
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
  const {getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts'),{viewerService}=await import('/src/platform/viewer/ViewerService.ts')
  const {resourceManager}=await import('/src/platform/resources/ResourceManager.ts'),{resourceRegistry}=await import('/src/platform/resources/ResourceRegistry.ts'),{inspectTaskScene}=await import('/src/platform/tasks/TaskSceneInspection.ts')
  const {getTaskSupportLayers}=await import('/src/modules/support/test-section-resource.ts')
  const {inspectVentilationCharts}=await import('/src/modules/ventilation/resources.ts')
  const v=viewerService.require(),status=getTaskWorkflowController().getStatus()
  const scene=inspectTaskScene(status,resourceRegistry,resourceManager.listStates(),v);delete scene.capturedAt
  return {taskId:status.taskId,scene,layers:getTaskSupportLayers(scene.resourceIds),charts:inspectVentilationCharts(),camera:window.Cesium.Cartesian3.pack(v.camera.positionWC,[])}
 })
 await send('只读检查当前场景状态、已装配对象和来源，不要装配或修改显示。','empty-scene')
 if((await state()).scene.completedSceneAvailable)throw Error('Empty scene claimed a completed task')
 for(const entry of [
  {id:'support',request:'在论文测试工段YK2+244展示三台阶和后方5米ZZ-Va支护，不用其他资料。',roots:['rock.three-bench','support.test-section']},
  {id:'chart',request:'YK4+000只展示右线风机故障停机的一维风网曲线，不要稳态CFD。',roots:['ventilation.transient-fan-shutdown']},
  {id:'volume',request:'YK2+244只展示TSP横波速度Vs解释体，不要其他资料。',roots:['rock.tsp-vs']},
 ]){
  await send(entry.request,`assemble-${entry.id}`)
  await wait(async()=>{const r=(await state()).scene;return r.completedSceneAvailable&&JSON.stringify([...r.resourceIds].sort())===JSON.stringify([...entry.roots].sort())})
  const before=await state()
  await send('只读核查当前场景状态：实际装配资源、模型就绪和显隐、资产来源、观察不足及下一步待核查项。不重新装配、不移动相机、不修改任何显示。',`inspect-${entry.id}`)
  const after=await state()
  if(JSON.stringify(before)!==JSON.stringify(after))throw Error(`Scene inspection mutated current state: ${entry.id}`)
  const audit=await fetch(`http://localhost:3000/api/ai-agent/task-runs/${after.taskId}`).then(r=>r.json())
  const events=audit.events?.filter(e=>e.source==='agent'&&e.action==='inspect_task_scene'&&e.status==='completed')
  if(!events?.length)throw Error(`Missing real inspection tool call: ${entry.id}`)
  report.checks.at(-1).evidence={scene:after.scene,audit:events.map(e=>({action:e.action,status:e.status,result:e.result_summary}))}
 }
 await send('复位当前任务场景','reset')
 await send('只读检查当前场景状态和已装配模型；没有任务就说明，不要沿用上一任务。','after-reset')
 const reset=await state()
 if(reset.scene.completedSceneAvailable||reset.scene.resources.length)throw Error('Reset scene reused a historical completed stage')
 if(report.errors.length||!report.modelRequests)throw Error('Page errors or no online calls')
 report.passed=true
}catch(e){report.failure=e.message;if(page)await page.screenshot({path:`${root}/failure.png`}).catch(()=>{});throw e}
finally{await writeFile(`${root}/report.json`,JSON.stringify(report,null,2));await browser.close()}
