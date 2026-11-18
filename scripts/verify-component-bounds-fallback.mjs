import {chromium} from 'playwright-core'
import {mkdir,writeFile} from 'node:fs/promises'
const root='docs/verification/2026-11-18-component-bounds-fallback'
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
   if(ids.some(id=>id.startsWith('support.test-section')))await form.getByLabel('支护长度（米）').fill('5')
   await form.getByRole('button',{name:'校验并创建计划',exact:true}).click()
   await page.getByRole('button',{name:'自主执行剩余步骤',exact:true}).click()
   await wait(async()=>await page.locator('.agent-assembly-info').count()>0&&await page.locator('.agent-assembly-info').innerText().then(t=>t.includes(mileage)))
 }
 const review=()=>page.evaluate(async()=>{const {taskVisualReview}=await import('/src/platform/tasks/TaskVisualReview.ts');return taskVisualReview.value?JSON.parse(JSON.stringify(taskVisualReview.value)):null})
 const nodes=id=>page.evaluate(async id=>{const {getTestSectionSupportModels,getTestSectionSupportSummaries}=await import('/src/modules/support/test-section-resource.ts');const models=getTestSectionSupportModels([id]),summary=getTestSectionSupportSummaries([id])[0];return {matrices:models.map(m=>Array.from(m.modelMatrix)),states:models.flatMap((m,i)=>summary.groups.map(g=>({model:i,name:g.name,component:g.component,show:m.getNode(g.name).show}))) }},id)
 const plan=component=>page.evaluate(async component=>{const {planTaskVisualReview,applyTaskVisualReview}=await import('/src/platform/tasks/TaskVisualReview.ts');const {getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts');const id=getTaskWorkflowController().getStatus().lastCompletedStage.assembledResourceIds.find(id=>id.startsWith('support.test-section'));const p=planTaskVisualReview({objective:'component-detail',focusResourceIds:[id],focusComponent:component,questions:['当前构件节点是否可观察？'],userRequest:'观察实际已有构件，不推断间距'});return applyTaskVisualReview(p.plan.taskId)},component)
 await createScene(['rock.three-bench','support.test-section'],'YK2+244','三台阶和后方5米ZZ-Va支护')
 await wait(()=>page.getByTestId('support-layer-steel_arch').count())
 const old=await plan('steel_arch')
 await createScene(['rock.three-bench','support.test-section-z-pm'],'YK2+244','三台阶和后方5米Z-PM已有独立单元，配筋PARTIAL')
 await wait(async()=>page.evaluate(async oldId=>{const {getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts');const s=getTaskWorkflowController().getStatus();return s.status==='completed'&&s.taskId!==oldId&&s.lastCompletedStage.assembledResourceIds.includes('support.test-section-z-pm')},old.plan.taskId))
 if(await review())throw Error('New task retained the old visual review')
 const before=await nodes('support.test-section-z-pm')
 const rejected=await page.evaluate(async oldTaskId=>{
  const {restoreTaskVisualReview,applyTaskVisualReview,planTaskVisualReview}=await import('/src/platform/tasks/TaskVisualReview.ts'),messages=[]
  for(const fn of [()=>restoreTaskVisualReview(oldTaskId),()=>applyTaskVisualReview(oldTaskId),()=>planTaskVisualReview({objective:'component-detail',focusResourceIds:['support.test-section-z-pm'],focusComponent:'steel_arch',questions:['钢架？'],userRequest:'检查钢架'})])try{fn()}catch(e){messages.push(String(e))}
  return messages
 },old.plan.taskId)
 if(rejected.length!==3||JSON.stringify(await nodes('support.test-section-z-pm'))!==JSON.stringify(before))throw Error('Old task/unknown component changed Z-PM')
 await page.getByTestId('task-view-support').click()
 const camera=()=>page.evaluate(async()=>{const {viewerService}=await import('/src/platform/viewer/ViewerService.ts');const v=viewerService.require(),C=window.Cesium;return [...C.Cartesian3.pack(v.camera.positionWC,[]),...C.Cartesian3.pack(v.camera.directionWC,[]),...C.Cartesian3.pack(v.camera.upWC,[])]})
 const fallbackBefore=await camera()
 const partial=await plan('secondary_rebar_N3'),focused=await nodes('support.test-section-z-pm')
 if(partial.remaining!==1||partial.plan.focusComponent!=='secondary_rebar_N3'||focused.states.filter(n=>n.component==='secondary_lining').some(n=>n.show)||!focused.states.filter(n=>n.component==='secondary_rebar_N3').every(n=>n.show)||JSON.stringify(focused.matrices)!==JSON.stringify(before.matrices))throw Error('Known Z-PM component not handled from actual nodes')
 await page.screenshot({path:`${root}/zpm-known-component.png`})
 await page.evaluate(async()=>{const {restoreTaskVisualReview,taskVisualReview}=await import('/src/platform/tasks/TaskVisualReview.ts');restoreTaskVisualReview(taskVisualReview.value.plan.taskId)})
 if(JSON.stringify(await nodes('support.test-section-z-pm'))!==JSON.stringify(before))throw Error('Z-PM exact restoration failed')
 await page.getByTestId('support-layout').locator(':scope > summary').click()
 if(await page.getByTestId('support-component-reveal').count())throw Error('Unit-base row incorrectly offers a guessed component')
 const geometry=partial.feedback.after.resources.find(r=>r.id==='support.test-section-z-pm').componentDisplay.find(c=>c.component==='secondary_rebar_N3').generatedGeometryAvailable
 if(geometry!==false)throw Error('Z-PM invented a generated geometry range')
 // restore has already returned to the whole-support baseline above.
 const fallbackAfter=await camera()
 if(fallbackAfter.some((n,i)=>Math.abs(n-fallbackBefore[i])>(i<3?1e-6:1e-12)))throw Error('Fallback camera did not restore')
 report.checks.push({id:'partial-component-whole-support-fallback',geometry,fallbackBefore,fallbackAfter})
 report.checks.push({id:'task-switch-and-partial-component-boundary',old,rejected,before,partial,focused})
 await send('复位当前任务场景')
 if(report.errors.length||modelRequests)throw Error('Page errors or unexpected model calls')
 report.modelRequests=modelRequests;report.passed=true
}catch(e){report.failure=e.message;if(page)await page.screenshot({path:`${root}/failure.png`}).catch(()=>{});throw e}
finally{await writeFile(`${root}/report.json`,JSON.stringify(report,null,2));await browser.close()}