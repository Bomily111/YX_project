import {chromium} from 'playwright-core'
import {mkdir,writeFile} from 'node:fs/promises'
const root=process.env.ONLINE_FEEDBACK_OUTPUT_DIR||'docs/verification/2026-11-16-online-feedback'
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
  const {inspectVentilationCharts}=await import('/src/modules/ventilation/resources.ts'),{getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts'),{viewerService}=await import('/src/platform/viewer/ViewerService.ts')
  const s=getTaskWorkflowController().getStatus(),C=window.Cesium,v=viewerService.require()
  return {taskId:s.taskId,charts:inspectVentilationCharts(),camera:C.Cartesian3.pack(v.camera.positionWC,[])}
 })
 await send('YK4+000 右线风机停机复核，请调出对应一维风网曲线，不要稳态CFD。','assemble-shutdown')
 await wait(async()=>(await state()).charts.length===1)
 const before=await state()
 await send('只读读取当前曲线的实际支路、时间单位和离散采样摘要，不改变任何显示。','inspect-chart')
 if(JSON.stringify(await state())!==JSON.stringify(before))throw Error('Read-only chart query changed current state')
 await send('保持当前任务，只显示Duct_Right和Duct_Left，把图表时间窗口设为0到30秒，并根据窗口源采样说明变化；不要重新装配，不改三维视角。','select-window')
 const changed=await state(),chart=changed.charts[0]
 if(changed.taskId!==before.taskId||JSON.stringify(changed.camera)!==JSON.stringify(before.camera)||JSON.stringify(chart.series.filter(s=>s.visible).map(s=>s.name).sort())!==JSON.stringify(['Duct_Left','Duct_Right'])||Math.abs(chart.visibleTimeRange[1]-30)>1e-6)throw Error('Online model did not apply the exact chart request')
 await send('保持当前任务，请把当前图表时间窗口设为0到999999秒。范围无效就说明，不要改显示或新装配。','invalid-window')
 if(JSON.stringify(await state())!==JSON.stringify(changed))throw Error('Invalid time request changed chart or task')
 const audit=await fetch(`http://localhost:3000/api/ai-agent/task-runs/${changed.taskId}`).then(r=>r.json())
 for(const name of ['inspect_task_chart_review','set_task_chart_review'])if(!audit.events?.some(e=>e.source==='agent'&&e.action===name))throw Error(`Missing real model tool audit: ${name}`)
 report.chartAudit=audit.events.filter(e=>['inspect_task_chart_review','set_task_chart_review'].includes(e.action)).map(e=>({action:e.action,status:e.status,result:e.result_summary}))
 await send('YK4+000只展示现有CO模拟浓度时间曲线，不要稳态CFD。','assemble-co')
 await wait(async()=>(await state()).charts[0]?.owner==='ventilation.co-analysis')
 await send('只读读取当前CO图表的时间单位、源数据范围和采样依据，不改显示。','inspect-co')
 const coBefore=await state()
 await send('保持当前任务，只显示掌子面和洞口，把图表窗口设为0到300秒；请按图表实际时间单位换算后执行，不重装、不改三维视角。','co-seconds-to-minutes')
 const coAfter=await state()
 if(coAfter.taskId!==coBefore.taskId||Math.abs(coAfter.charts[0].visibleTimeRange[1]-5)>1e-6||JSON.stringify(coAfter.charts[0].series.filter(s=>s.visible).map(s=>s.name).sort())!==JSON.stringify(['掌子面','洞口'].sort()))throw Error('Model mixed seconds and minutes in the CO chart')
 if(coAfter.charts[0].visibleTimeRange[1]!==5||coAfter.charts[0].series.find(s=>s.name==='掌子面').windowSummary.last.time!==5)throw Error('Percentage zoom lost the exact source endpoint sample')
 await send('YK2+244 展示现有TSP横波速度Vs解释体，不要其他资料。','assemble-vs')
 const volumeBefore=await page.evaluate(async()=>{const {getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts');return getTaskWorkflowController().getStatus().taskId})
 await send('只读核对当前解释体的实际渲染采样范围、局部轴长和当前裁剪参数。说明它是否能证明地质边界，不改变视角或模型。','inspect-volume')
 const volumeAudit=await fetch(`http://localhost:3000/api/ai-agent/task-runs/${volumeBefore}`).then(r=>r.json())
 if(!volumeAudit.events?.some(e=>e.source==='agent'&&e.action==='inspect_task_volume_review'&&e.status==='completed'))throw Error('Model did not inspect the actual volume domain')
 await send('复位当前任务场景','reset')
 if(report.errors.length||!report.modelRequests)throw Error('Page errors or no online calls')
 report.passed=true
}catch(e){report.failure=e.message;if(page)await page.screenshot({path:`${root}/failure.png`}).catch(()=>{});throw e}
finally{await writeFile(`${root}/report.json`,JSON.stringify(report,null,2));await browser.close()}
