import {chromium} from 'playwright-core'
import {mkdir,writeFile} from 'node:fs/promises'
const root=process.env.VISUAL_GOALS_OUTPUT_DIR||'docs/verification/2026-11-16-visual-goals-online'
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
 const review=()=>page.evaluate(async()=>{const {taskVisualReview}=await import('/src/platform/tasks/TaskVisualReview.ts');return taskVisualReview.value?JSON.parse(JSON.stringify(taskVisualReview.value)):null})
 await send('在论文测试工段YK2+244展示三台阶和后方5米ZZ-Va支护，不用其他资料。','assemble')
 await wait(async()=>(await state()).scene.completedSceneAvailable)
 const original=await state()
 await send('只规划当前任务视觉分析：分析三台阶与后方支护的整体空间关系，重点是三台阶，支护作为必要参照。提出待回答问题，不执行、不移动相机。','plan-relation')
 let r=await review()
 if(r?.plan.objective!=='spatial-relation'||r.phase!=='planned'||r.plan.candidate.view!=='overview')throw Error('Wrong spatial goal')
 if(JSON.stringify(await state())!==JSON.stringify(original))throw Error('Planning changed the scene')
 await send('规划并执行当前任务视觉分析：改为支护构件细部辨识，重点仅为当前支护模型，三台阶保留作为场景参照。请先规划再应用受控视角，不改显隐、不重装。','apply-detail')
 r=await review();let changed=await state()
 if(r?.plan.objective!=='component-detail'||r.phase!=='applied'||r.remaining!==1||!r.feedback||r.plan.candidate.view!=='support')throw Error('Detail plan not applied with feedback')
 if(changed.taskId!==original.taskId||JSON.stringify(changed.layers)!==JSON.stringify(original.layers)||JSON.stringify(changed.charts)!==JSON.stringify(original.charts))throw Error('Detail review changed resources or visibility')
 report.checks.at(-1).evidence=r
 await page.getByTestId('task-visual-review').scrollIntoViewIfNeeded();await page.screenshot({path:`root-placeholder/detail-goal.png`.replace('root-placeholder',root)})
 await send('规划并执行当前任务视觉分析：现在分析三台阶和后方支护的整体空间关系，两者同屏作必要参照，先规划再应用整体视角。','apply-relation')
 r=await review()
 if(r?.phase!=='applied'||r.plan.candidate.view!=='overview'||r.remaining!==0)throw Error('Second controlled adjustment failed')
 await send('恢复分析前视角','restore')
 const restored=await state();r=await review()
 if(r?.phase!=='restored'||JSON.stringify(restored.camera)!==JSON.stringify(original.camera))throw Error('Original camera not restored exactly')
 const beforeLimit=await state()
 const budgetAnswer=await send('规划并执行当前任务视觉分析：再以支护为重点查看构件细部，先规划再执行。如果预算不足就说明，不要重装。','budget-limit')
 if(!/2次|两次|上限/.test(budgetAnswer))throw Error('Budget rejection did not explain its actual reason')
 if(JSON.stringify(await state())!==JSON.stringify(beforeLimit)||(await review())?.remaining!==0)throw Error('Replanning reset adjustment budget or changed the scene')
 const audit=await fetch(`http://localhost:3000/api/ai-agent/task-runs/${original.taskId}`).then(r=>r.json())
 for(const name of ['plan_task_visual_review','apply_task_visual_review','restore_task_visual_review'])if(!audit.events?.some(e=>e.source==='agent'&&e.action===name&&e.status==='completed'))throw Error(`No real model tool audit: ${name}`)
 report.visualAudit=audit.events.filter(e=>/task_visual_review/.test(e.action)).map(e=>({action:e.action,status:e.status,result:e.result_summary}))
 await send('YK4+000只展示右线风机故障停机的一维风网曲线，不要稳态CFD。','switch-chart')
 if(await review())throw Error('New task retained old visual goal')
 await send('只规划当前任务视觉分析：核查这一维风网曲线的来源和局限，分析目的为来源核查，不执行、不移动相机。','source-only')
 r=await review()
 if(r?.plan.objective!=='source-review'||r.plan.candidate!==null||r.remaining!==2)throw Error('Source-only goal created a camera action or reused old budget')
 await send('复位当前任务场景','reset')
 if(await review()||await page.getByTestId('task-visual-review').count())throw Error('Reset retained visual review')
 if(report.errors.length||!report.modelRequests)throw Error('Page errors or no online calls')
 report.passed=true
}catch(e){report.failure=e.message;if(page)await page.screenshot({path:`${root}/failure.png`}).catch(()=>{});throw e}
finally{await writeFile(`${root}/report.json`,JSON.stringify(report,null,2));await browser.close()}
