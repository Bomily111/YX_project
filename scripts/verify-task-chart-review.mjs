import {chromium} from 'playwright-core'
import {mkdir,writeFile} from 'node:fs/promises'
const root=process.env.CHART_REVIEW_OUTPUT_DIR||'docs/verification/2026-11-16-chart-review'
await mkdir(root,{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--enable-webgl','--use-gl=angle','--use-angle=d3d11']})
const report={passed:false,modelRequests:0,errors:[],cases:[]};let page
const wait=async fn=>{const end=Date.now()+90000;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,250))}throw Error('Chart review timeout')}
try{
 page=await browser.newPage({viewport:{width:1400,height:900}})
 page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/ai-agent/chat'))report.modelRequests++})
 await page.route('http://localhost:5178/api/**',route=>{const u=new URL(route.request().url());u.port='3000';return route.continue({url:u.toString()})})
 await page.goto('http://localhost:5178',{waitUntil:'domcontentloaded'});await page.locator('.agent-fab').click()
 const cases=[{id:'fan-shutdown',resource:'ventilation.transient-fan-shutdown',file:'transient_fan_shutdown.json',priority:'Duct_Right'},{id:'damper-close',resource:'ventilation.transient-damper-close',file:'transient_damper_close.json',priority:'CP_2300_Left_Right'},{id:'combined',resource:'ventilation.transient-combined',file:'transient_combined.json',priority:'Duct_Right'},{id:'co',resource:'ventilation.co-analysis',file:'co_transport_results.json'}]
 for(const c of cases){
   await page.getByRole('button',{name:'表单',exact:true}).click();const form=page.locator('.chat-task-form')
   await form.getByLabel('任务类型').selectOption('scene-exploration');await form.getByLabel('任务目标').fill('复核已有模拟曲线与工况依据，不作现场达标判断');await form.getByLabel('目标里程').fill('YK4+000')
   await wait(async()=>await form.getByLabel('隧洞').locator('option').count()>1);await form.getByLabel('隧洞').selectOption({index:1})
   while(await form.getByRole('button',{name:'移除',exact:true}).count())await form.getByRole('button',{name:'移除',exact:true}).first().click()
   await form.getByLabel('追加场景资源').selectOption(c.resource);await form.getByRole('button',{name:'添加阶段',exact:true}).click()
   await form.getByRole('button',{name:'校验并创建计划',exact:true}).click();await page.getByRole('button',{name:'自主执行剩余步骤',exact:true}).click()
   const host=page.locator('[data-ventilation-enhancement="chart"]')
   await wait(async()=>await host.count()===1&&await host.getAttribute('data-ventilation-layout')==='primary-task')
   await page.waitForTimeout(300)
   const state=await page.evaluate(async c=>{
     const {inspectVentilationCharts,setVentilationChartReview}=await import('/src/modules/ventilation/resources.ts'),{viewerService}=await import('/src/platform/viewer/ViewerService.ts'),{executeTool}=await import('/src/ai-agent/ToolRegistry.ts')
     const host=document.querySelector('[data-ventilation-enhancement="chart"]'),state=inspectVentilationCharts(true).find(s=>s.owner===c.resource),v=viewerService.require(),C=window.Cesium
     const raw=await fetch(`/data/ventilation/${c.file}`).then(r=>r.json()),data=c.id==='co'?raw.Right:raw
     if(state.series.length!==Object.keys(data.history).length)throw Error('Not all source branches were retained')
     for(const s of state.series){
       const values=c.id==='co'?data.history[s.name]:data.history[s.name].Q
       if(s.samples.length!==data.times.length||s.samples.some((p,i)=>p[0]!==data.times[i]/(c.id==='co'?60:1)||p[1]!==values[i]))throw Error('Chart points differ from source samples')
     }
     if(c.priority&&!state.series.find(s=>s.name===c.priority)?.visible)throw Error('Requested scenario reference branch not selected')
     const camera=C.Cartesian3.clone(v.camera.positionWC),chosen=state.series.at(-1).name,range=state.timeRange,span=range[1]-range[0]
     const changed=JSON.parse(await executeTool('set_task_chart_review',{owner:c.resource,visibleSeries:[c.priority??state.series[0].name,chosen],timeRange:[range[0]+span*.2,range[0]+span*.6]}))
     const after=inspectVentilationCharts().find(s=>s.owner===c.resource)
     if(!changed.ok||!after.series.find(s=>s.name===chosen)?.visible||Math.abs(after.zoom.start-20)>1e-6||!C.Cartesian3.equals(camera,v.camera.positionWC))throw Error('Chart tool selection/zoom failed or changed the 3D camera')
     const sourceValues=c.id==='co'?data.history[chosen]:data.history[chosen].Q
     const sourceWindow=data.times.map((t,i)=>[t/(c.id==='co'?60:1),sourceValues[i]]).filter(p=>p[0]>=after.visibleTimeRange[0]&&p[0]<=after.visibleTimeRange[1])
     const summary=after.series.find(s=>s.name===chosen).windowSummary
     if(!summary||summary.sampleCount!==sourceWindow.length||summary.min!==Math.min(...sourceWindow.map(p=>p[1]))||summary.max!==Math.max(...sourceWindow.map(p=>p[1])))throw Error('Window summary differs from source samples')
     if(!host.querySelector('[data-chart-evidence]').textContent.includes('离散源采样'))throw Error('Window evidence is missing from the visible chart panel')
     const snapshot=JSON.stringify(after)
     try{setVentilationChartReview(c.resource,{visibleSeries:['missing-source-branch']});throw Error('Unknown branch accepted')}catch(e){if(!e.message.includes('不存在'))throw e}
     try{setVentilationChartReview(c.resource,{timeRange:[range[0],range[1]+1]});throw Error('Out-of-range time accepted')}catch(e){if(!e.message.includes('范围无效'))throw e}
     if(JSON.stringify(inspectVentilationCharts().find(s=>s.owner===c.resource))!==snapshot)throw Error('Invalid request changed chart state')
     setVentilationChartReview(c.resource,{visibleSeries:state.series.filter(s=>s.visible).map(s=>s.name),timeRange:state.timeRange})
     const r=host.getBoundingClientRect()
     return {series:state.series.length,samples:state.series[0].sampleCount,priority:c.priority,width:r.width,height:r.height,chartWidth:state.width,chartHeight:state.height,pointerEvents:getComputedStyle(host).pointerEvents,sourceNote:host.querySelector('small').textContent,sourceSamplesEqual:true,cameraUnchanged:true,invalidRequestPreservedState:true}
   },c)
   if(state.width<600||state.height<650||state.chartHeight<500||state.pointerEvents!=='auto')throw Error(`Primary chart layout invalid: ${JSON.stringify(state)}`)
   await host.locator('[data-chart-evidence] > summary').click()
   if(!await host.locator('[data-chart-evidence] > div').isVisible())throw Error('Window evidence cannot be expanded')
   await page.screenshot({path:`${root}/${c.id}.png`})
   await page.setViewportSize({width:1280,height:900});await page.waitForTimeout(300)
   const resized=await host.evaluate(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}))
   if(resized.width<500)throw Error('Narrow primary chart collapsed')
   await page.setViewportSize({width:1400,height:900})
   report.cases.push({id:c.id,state,resized})
 }
 await page.locator('.agent-input').fill('复位当前任务场景');await page.locator('.agent-input').press('Enter');await wait(async()=>await page.locator('[data-ventilation-enhancement="chart"]').count()===0)
 const disposed=await page.evaluate(async()=>{const {inspectVentilationCharts,getVentilationEnhancementLeaseCount}=await import('/src/modules/ventilation/resources.ts');return inspectVentilationCharts().length===0&&getVentilationEnhancementLeaseCount()===0})
 if(!disposed||report.errors.length||report.modelRequests)throw Error('Chart cleanup or page validation failed')
 report.allChartsReleased=disposed;report.passed=true
}catch(e){report.failure=e.message;if(page)await page.screenshot({path:`${root}/failure.png`}).catch(()=>{});throw e}
finally{await writeFile(`${root}/report.json`,JSON.stringify(report,null,2));await browser.close()}
