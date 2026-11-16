import {chromium} from 'playwright-core'
import {mkdir,writeFile} from 'node:fs/promises'
const root=process.env.MIXED_SCENE_OUTPUT_DIR||'docs/verification/2026-11-16-mixed-scenes'
await mkdir(root,{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--enable-webgl','--use-gl=angle','--use-angle=d3d11']})
const report={passed:false,modelRequests:0,errors:[],cases:[]};let page
const wait=async fn=>{const end=Date.now()+120000;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,250))}throw Error('Mixed scene timeout')}
try{
 page=await browser.newPage({viewport:{width:1400,height:900}})
 page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/ai-agent/chat'))report.modelRequests++})
 await page.route('http://localhost:5178/api/**',route=>{const u=new URL(route.request().url());u.port='3000';return route.continue({url:u.toString()})})
 await page.goto('http://localhost:5178',{waitUntil:'domcontentloaded'});await page.locator('.agent-fab').click()
 const cases=[
  {id:'tsp-support',mileage:'YK1+346',ids:['rock.tsp-hardness','support.modeler-zz-va'],domain:true},
  {id:'fan-shutdown',mileage:'YK4+000',ids:['ventilation.transient-fan-shutdown'],chart:true},
  {id:'bench-va',mileage:'YK2+244',ids:['rock.three-bench','support.test-section']},
  {id:'co',mileage:'YK4+000',ids:['ventilation.co-analysis'],chart:true},
  {id:'tem',mileage:'YK2+244',ids:['rock.tem-resistivity'],domain:true},
  {id:'airflow',mileage:'YK4+000',ids:['blast.effect','ventilation.steady-cfd'],flow:true},
  {id:'vs',mileage:'YK2+244',ids:['rock.tsp-vs'],domain:true},
  {id:'design',mileage:'YK1+346',ids:['blast.design-data']},
 ]
 for(const c of cases){
   const start=Date.now()
   await page.getByRole('button',{name:'表单',exact:true}).click();const form=page.locator('.chat-task-form')
   await form.getByLabel('任务类型').selectOption('scene-exploration');await form.getByLabel('任务目标').fill('跨专题显示、来源与状态恢复复核，使用示例资料');await form.getByLabel('目标里程').fill(c.mileage)
   await wait(async()=>await form.getByLabel('隧洞').locator('option').count()>1);await form.getByLabel('隧洞').selectOption({index:1})
   while(await form.getByRole('button',{name:'移除',exact:true}).count())await form.getByRole('button',{name:'移除',exact:true}).first().click()
   for(const id of c.ids){await form.getByLabel('追加场景资源').selectOption(id);await form.getByRole('button',{name:'添加阶段',exact:true}).click()}
   if(c.ids.includes('support.test-section'))await form.getByLabel('支护长度（米）').fill('5')
   await form.getByRole('button',{name:'校验并创建计划',exact:true}).click();await page.getByRole('button',{name:'自主执行剩余步骤',exact:true}).click()
   await wait(async()=>{
     const state=await page.evaluate(async()=>{const {getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts');return getTaskWorkflowController().getStatus()})
     if(state.status==='failed')throw Error('Mixed task failed')
     return state.status==='completed'
   })
   const state=await page.evaluate(async c=>{
     const {resourceManager}=await import('/src/platform/resources/ResourceManager.ts'),{resourceRegistry}=await import('/src/platform/resources/ResourceRegistry.ts'),{viewerService}=await import('/src/platform/viewer/ViewerService.ts'),{getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts')
     const {getTaskVolumeDomain}=await import('/src/platform/tasks/TaskVolumeCut.ts'),{inspectVentilationCharts}=await import('/src/modules/ventilation/resources.ts'),{taskFlowReview}=await import('/src/platform/tasks/TaskFlowReview.ts')
     const allowed=new Set(['common.tunnel',...resourceRegistry.resolveLoadOrder(c.ids).map(r=>r.id)]),v=viewerService.require(),time=window.Cesium.JulianDate.now()
     window.__mixedCanvas??=v.canvas
     return {taskId:getTaskWorkflowController().getStatus().taskId,sameCanvas:v.canvas===window.__mixedCanvas,leaked:resourceManager.listStates().filter(s=>s.status==='loaded'&&!allowed.has(s.id)).map(s=>s.id),domain:!!getTaskVolumeDomain(),edges:v.entities.values.filter(e=>e.properties?.taskVolumeDomain?.getValue(time)).length,charts:inspectVentilationCharts().map(c=>c.owner),flow:!!taskFlowReview.value}
   },c)
   if(state.leaked.length||!state.sameCanvas||state.domain!==!!c.domain||state.edges!==(c.domain?12:0)||state.charts.length!==(c.chart?1:0)||state.flow!==!!c.flow)throw Error(`Cross-task residue: ${JSON.stringify(state)}`)
   report.cases.push({id:c.id,elapsedMs:Date.now()-start,...state})
   await page.screenshot({path:`${root}/${c.id}.png`})
 }
 await page.locator('.agent-input').fill('复位当前任务场景');await page.locator('.agent-input').press('Enter');await wait(async()=>await page.locator('.agent-assembly-info').count()===0)
 if(report.errors.length||report.modelRequests)throw Error('Page error or unexpected model request')
 report.passed=true
}catch(e){report.failure=e.message;if(page)await page.screenshot({path:`${root}/failure.png`}).catch(()=>{});throw e}
finally{await writeFile(`${root}/report.json`,JSON.stringify(report,null,2));await browser.close()}
