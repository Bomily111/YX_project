import {chromium} from 'playwright-core'
import {mkdir,writeFile} from 'node:fs/promises'
const root=process.env.LAYOUT_DETAILS_OUTPUT_DIR||'docs/verification/2026-11-16-layout-details'
const app=process.env.BROWSER_APP_URL||'http://localhost:5178'
await mkdir(root,{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--enable-webgl','--use-gl=angle','--use-angle=d3d11']})
const report={passed:false,errors:[],checks:[]}
let modelRequests=0
let page
const wait=async fn=>{const end=Date.now()+120000;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,300))}throw Error('Layout details timeout')}
try{
 page=await browser.newPage({viewport:{width:1400,height:900}})
 page.on('pageerror',e=>report.errors.push(e.message))
 page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/ai-agent/chat'))modelRequests++})
 await page.route(`${app}/api/**`,route=>{const url=new URL(route.request().url());url.port='3000';return route.continue({url:url.toString()})})
 await page.goto(app,{waitUntil:'domcontentloaded'});await page.locator('.agent-fab').click()
 const send=async text=>{
   const previous=await page.locator('.agent-messages .msg-row.assistant').count()
   await page.locator('.agent-input').fill(text);await page.locator('.agent-input').press('Enter')
   await wait(async()=>await page.locator('.agent-messages .msg-row.assistant').count()>previous)
   await page.locator('.agent-input').fill('idle');await wait(()=>page.locator('.send-btn').isEnabled());await page.locator('.agent-input').fill('')
   return page.locator('.agent-messages .msg-row.assistant').last().innerText()
 }
 const createScene=async(ids,mileage,description)=>{
   await page.getByRole('button',{name:'表单',exact:true}).click()
   const form=page.locator('.chat-task-form')
   await form.getByLabel('任务类型').selectOption('scene-exploration')
   await form.getByLabel('任务目标').fill(description)
   await form.getByLabel('目标里程').fill(mileage)
   await wait(async()=>await form.getByLabel('隧洞').locator('option').count()>1)
   await form.getByLabel('隧洞').selectOption({index:1})
   while(await form.getByRole('button',{name:'移除',exact:true}).count())await form.getByRole('button',{name:'移除',exact:true}).first().click()
   for(const id of ids){await form.getByLabel('追加场景资源').selectOption(id);await form.getByRole('button',{name:'添加阶段',exact:true}).click()}
   if(ids.includes('support.test-section'))await form.getByLabel('支护长度（米）').fill('5')
   await form.getByRole('button',{name:'校验并创建计划',exact:true}).click()
   await page.getByRole('button',{name:'自主执行剩余步骤',exact:true}).click()
   await wait(async()=>await page.locator('.agent-assembly-info').count()>0&&await page.locator('.agent-assembly-info').innerText().then(t=>t.includes(mileage)))
 }
 await createScene(['rock.three-bench','support.test-section'],'YK2+244','三台阶和后方5米ZZ-Va支护示意核对')
 await wait(async()=>await page.getByTestId('support-source-baseline').count()>0)
 await page.evaluate(async()=>{const {planTaskVisualReview}=await import('/src/platform/tasks/TaskVisualReview.ts');planTaskVisualReview({objective:'component-detail',focusResourceIds:['support.test-section'],questions:['站位与本次装配记录是否对应？'],userRequest:'持续测试：核对当前支护站位'})})
 await page.getByTestId('support-layout').locator(':scope > summary').click()
 await page.getByTestId('support-station-1').click()
 const locationEvidence=await page.evaluate(async()=>{const {getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts');const {inspectTaskEvidenceJournal}=await import('/src/platform/tasks/TaskEvidenceJournal.ts');return inspectTaskEvidenceJournal(getTaskWorkflowController().getStatus().taskId)})
 if(!locationEvidence.some(e=>e.source==='2d'&&e.visualObjective==='component-detail'&&e.questions?.length===1&&e.assetPaths.length&&e.engineeringAcceptance==='not-verified'))throw Error('定位证据未关联实际任务视觉问题')
 report.checks.push({id:'location-evidence-goal-binding',evidence:locationEvidence})
 await page.getByTestId('support-layout').locator(':scope > summary').click()
 await page.getByTestId('task-view-overview').click()

 const baseline=page.getByTestId('support-source-baseline'),comparison=page.getByTestId('support-section-comparison')
 await baseline.locator(':scope > summary').click();await comparison.locator('summary').click()
 await comparison.locator('svg').scrollIntoViewIfNeeded()
 const svg=await comparison.locator('svg').evaluate(e=>{const r=e.getBoundingClientRect(),parent=e.closest('.agent-assembly-info').getBoundingClientRect();return {width:r.width,height:r.height,inside:r.top>=parent.top&&r.bottom<=parent.bottom,rectangles:e.querySelectorAll('rect').length}})
 if(!svg.inside||svg.rectangles!==2)throw Error(`Source diagram clipped or missing envelopes: ${JSON.stringify(svg)}`)
 await page.screenshot({path:`${root}/source-envelope-comparison.png`})
 const answer=await send('当前支护断面宽多少，核对源隧道和支护尺寸依据，还缺什么？')
 if(!answer.includes('12.72米')||!answer.includes('11.00米')||!answer.includes('不是壁厚、净空侵限或现场偏差'))throw Error('Actual chat did not report source dimensions and limits')
 report.checks.push({id:'source-envelope-diagram-and-chat',svg,answer})
 await baseline.locator(':scope > summary').click()
 for(const width of [1280,1400]){
   await page.setViewportSize({width,height:900})
   await page.getByTestId('task-view-overview').click()
   await page.waitForTimeout(300)
   const framing=await page.evaluate(async()=>{
     const {viewerService}=await import('/src/platform/viewer/ViewerService.ts'),{inspectTaskSphereViewport}=await import('/src/platform/tasks/TaskViewport.ts')
     const {getTestSectionSupportModels}=await import('/src/modules/support/test-section-resource.ts'),{getActiveThreeBenchModel}=await import('/src/modules/rock/three-bench-resource.ts')
     const models=[getActiveThreeBenchModel(),...getTestSectionSupportModels()].filter(m=>m?.ready)
     return inspectTaskSphereViewport(viewerService.require(),window.Cesium.BoundingSphere.fromBoundingSpheres(models.map(m=>m.boundingSphere)))
   })
   if(!framing.available||framing.insideSafe!==26)throw Error(`Narrow framing failed: ${JSON.stringify(framing)}`)
   report.checks.push({id:`support-framing-${width}`,framing})
   await page.screenshot({path:`${root}/support-${width}.png`})
 }
 await createScene(['blast.design-data'],'YK1+346','炮孔施工交底：二维设计与分类数量、进尺')
 for(const width of [1280,1400]){
   await page.setViewportSize({width,height:900});await page.waitForTimeout(250)
   const panel=page.getByTestId('blast-design-panel')
   const bounds=await panel.evaluate(e=>{const r=e.getBoundingClientRect(),s=e.querySelector('svg').getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,height:r.height,svgHeight:s.height,scroll:e.scrollHeight>e.clientHeight}})
   if(bounds.width<500||bounds.svgHeight!==420||!(await panel.innerText()).includes('孔径未提供'))throw Error(`Design layout failed: ${JSON.stringify(bounds)}`)
   report.checks.push({id:`design-primary-${width}`,bounds})
   await page.screenshot({path:`${root}/design-${width}.png`})
 }
 await createScene(['blast.effect','ventilation.steady-cfd'],'YK4+000','爆后通风复核：爆后轮廓与风向参照，不用二维设计')
 await page.getByTestId('flow-review-evaluate').click()
 if(!await page.getByTestId('flow-review-evaluation').isVisible())throw Error('Local flow evaluation unavailable')
 await page.getByTestId('flow-review-context').click()
 if(await page.getByTestId('flow-review-evaluation').count())throw Error('Mode switch retained stale evaluation')
 const flow=await page.evaluate(async()=>{
   const r=await import('/src/platform/tasks/TaskFlowReview.ts')
   return {feedback:r.inspectTaskFlowReview(),evaluation:r.evaluateTaskFlowReview()}
 })
 if(flow.feedback.mode!=='context'||flow.evaluation.remainingAdjustments!==2)throw Error('Form flow task lost scope or inherited adjustment budget')
 await page.getByTestId('flow-review-evaluate').click()
 await page.screenshot({path:`${root}/flow-local-evaluation.png`})
 report.checks.push({id:'local-flow-panel-and-fresh-budget',...flow})
 await send('复位当前任务场景，释放本次任务模型并恢复主场景。')
 if(await page.getByTestId('blast-design-panel').count()||await page.getByTestId('support-source-baseline').count())throw Error('Task overlays leaked after reset')
 if(report.errors.length)throw Error(report.errors.join('\n'))
 if(modelRequests)throw Error('Local recovery/form test unexpectedly requested a model')
 report.modelRequests=modelRequests
 report.passed=true
}catch(e){report.failure=e.message;if(page)await page.screenshot({path:`${root}/failure.png`}).catch(()=>{});throw e}
finally{await writeFile(`${root}/report.json`,JSON.stringify(report,null,2));await browser.close()}
