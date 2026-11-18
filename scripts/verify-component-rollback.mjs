import {chromium} from 'playwright-core'
import {mkdir,writeFile} from 'node:fs/promises'
const root='docs/verification/2026-11-18-component-rollback'
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
 await createScene(['rock.three-bench','support.test-section'],'YK2+244','三台阶和后方5米支护，地理位置与站位连续核对')
 await wait(async()=>await page.getByTestId('support-layout').count()>0)
 const read=()=>page.evaluate(async()=>{
  const {viewerService}=await import('/src/platform/viewer/ViewerService.ts'),{taskCameraSelection}=await import('/src/platform/tasks/TaskCameraView.ts'),{getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts')
  const v=viewerService.require(),C=window.Cesium
  return {taskId:getTaskWorkflowController().getStatus().taskId,selection:taskCameraSelection.value,camera:[...C.Cartesian3.pack(v.camera.positionWC,[]),...C.Cartesian3.pack(v.camera.directionWC,[]),...C.Cartesian3.pack(v.camera.upWC,[])]}
 })
 const nodeState=()=>page.evaluate(async()=>{
  const {getTestSectionSupportModels,getTestSectionSupportSummaries}=await import('/src/modules/support/test-section-resource.ts')
  const groups=getTestSectionSupportSummaries(['support.test-section'])[0].groups,m=getTestSectionSupportModels(['support.test-section'])[0]
  return {matrix:Array.from(m.modelMatrix),nodes:groups.map(g=>({component:g.component,name:g.name,show:m.getNode(g.name).show}))}
 })
 await page.getByTestId('support-layer-steel_arch').uncheck();await page.getByTestId('support-layer-secondary_lining').check()
 const before={scene:await read(),state:await nodeState()}
 const failed=await page.evaluate(async()=>{
  const {getTestSectionSupportModels,getTestSectionSupportSummaries}=await import('/src/modules/support/test-section-resource.ts'),{planTaskVisualReview,applyTaskVisualReview,taskVisualReview}=await import('/src/platform/tasks/TaskVisualReview.ts')
  const model=getTestSectionSupportModels(['support.test-section'])[0],group=getTestSectionSupportSummaries(['support.test-section'])[0].groups.find(g=>g.component==='secondary_lining'),node=model.getNode(group.name),descriptor=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(node),'show'),own=Object.getOwnPropertyDescriptor(node,'show')
  let once=true,message=''
  Object.defineProperty(node,'show',{configurable:true,get(){return descriptor.get.call(this)},set(value){if(once&&value===false){once=false;throw Error('acceptance-injected-node-write-failure')}descriptor.set.call(this,value)}})
  const p=planTaskVisualReview({objective:'component-detail',focusResourceIds:['support.test-section'],focusComponent:'steel_arch',questions:['故障后是否恢复？'],userRequest:'检查钢架布置并暂避外壳'})
  try{applyTaskVisualReview(p.plan.taskId)}catch(e){message=String(e)}finally{if(own)Object.defineProperty(node,'show',own);else delete node.show}
  return {message,review:JSON.parse(JSON.stringify(taskVisualReview.value))}
 })
 if(!failed.message.includes('acceptance-injected')||failed.review.phase!=='failed'||failed.review.recoveryStatus!=='restored'||failed.review.remaining!==1||JSON.stringify(await nodeState())!==JSON.stringify(before.state))throw Error('Partial node changes were not rolled back')
 const afterFailure=await read()
 if(afterFailure.camera.some((n,i)=>Math.abs(n-before.scene.camera[i])>(i<3?1e-6:1e-12)))throw Error('Failure changed original camera')
 if(await page.getByTestId('component-review-basis').count())throw Error('Failed review shows old successful basis')
 await page.screenshot({path:`${root}/rolled-back.png`})
 const retried=await page.evaluate(async()=>{const {taskVisualReview,applyTaskVisualReview}=await import('/src/platform/tasks/TaskVisualReview.ts');return applyTaskVisualReview(taskVisualReview.value.plan.taskId)})
 if(retried.phase!=='applied'||retried.remaining!==0)throw Error('Retry did not share original budget')
 await page.evaluate(async()=>{const {taskVisualReview,restoreTaskVisualReview}=await import('/src/platform/tasks/TaskVisualReview.ts');restoreTaskVisualReview(taskVisualReview.value.plan.taskId)})
 if(JSON.stringify(await nodeState())!==JSON.stringify(before.state))throw Error('Retry restoration lost original custom visibility')
 report.checks.push({id:'partial-node-write-rollback-and-retry',before,failed,retried})
 await send('复位当前任务场景')
 if(report.errors.length||modelRequests)throw Error('Page errors or unexpected model call')
 report.modelRequests=modelRequests;report.passed=true
}catch(e){report.failure=e.message;if(page)await page.screenshot({path:`${root}/failure.png`}).catch(()=>{});throw e}
finally{await writeFile(`${root}/report.json`,JSON.stringify(report,null,2));await browser.close()}