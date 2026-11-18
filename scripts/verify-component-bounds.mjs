import {chromium} from 'playwright-core'
import {mkdir,writeFile} from 'node:fs/promises'
const root=process.env.VERIFICATION_OUTPUT||'docs/verification/2026-11-18-component-bounds-page'
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
  const {getTestSectionSupportModels}=await import('/src/modules/support/test-section-resource.ts')
  return {taskId:getTaskWorkflowController().getStatus().taskId,selection:taskCameraSelection.value,styles:getTestSectionSupportModels(['support.test-section']).map(m=>({color:m.color?C.Color.pack(m.color,[]):null,mode:m.colorBlendMode,amount:m.colorBlendAmount})),camera:[...C.Cartesian3.pack(v.camera.positionWC,[]),...C.Cartesian3.pack(v.camera.directionWC,[]),...C.Cartesian3.pack(v.camera.upWC,[])]}
 })
 const nodeState=()=>page.evaluate(async()=>{
  const {getTestSectionSupportModels,getTestSectionSupportSummaries}=await import('/src/modules/support/test-section-resource.ts')
  const groups=getTestSectionSupportSummaries(['support.test-section'])[0].groups,m=getTestSectionSupportModels(['support.test-section'])[0]
  return {matrix:Array.from(m.modelMatrix),nodes:groups.map(g=>({component:g.component,name:g.name,show:m.getNode(g.name).show}))}
 })
 await page.getByTestId('support-layer-steel_arch').check();await page.getByTestId('support-layer-secondary_lining').uncheck();await page.getByTestId('support-layer-primary_concrete').uncheck()
 const measure=()=>page.evaluate(async()=>{
  const {getTestSupportComponentSphere,getTestSectionSupportModels}=await import('/src/modules/support/test-section-resource.ts'),{viewerService}=await import('/src/platform/viewer/ViewerService.ts'),{inspectTaskSphereViewport}=await import('/src/platform/tasks/TaskViewport.ts')
  const sphere=getTestSupportComponentSphere('support.test-section','steel_arch'),model=getTestSectionSupportModels(['support.test-section'])[0],v=viewerService.require(),C=window.Cesium
  return {componentRadius:sphere?.radius,wholeRadius:model.boundingSphere.radius,distance:sphere?C.Cartesian3.distance(v.camera.positionWC,sphere.center):null,framing:sphere?inspectTaskSphereViewport(v,sphere):null}
 })
 await page.getByTestId('task-view-support').click();const before={camera:await read(),state:await nodeState(),measure:await measure()}
 await page.screenshot({path:`${root}/whole-model-framing.png`})
 const applied=await page.evaluate(async warm=>{const {planTaskVisualReview,applyTaskVisualReview}=await import('/src/platform/tasks/TaskVisualReview.ts');const p=planTaskVisualReview({objective:'component-detail',focusResourceIds:['support.test-section'],focusComponent:'steel_arch',emphasis:warm?'material-focus':'source',questions:['钢架布置是否可辨？'],userRequest:'聚焦当前钢拱架细部，保留其他构件原显隐'});return applyTaskVisualReview(p.plan.taskId)},process.env.VERIFY_COMPONENT_WARM==='1')
 const after={camera:await read(),state:await nodeState(),measure:await measure()}
 if(!after.measure.componentRadius||after.measure.componentRadius>=after.measure.wholeRadius||after.measure.distance>=before.measure.distance||after.measure.framing.insideSafe!==26||JSON.stringify(after.state)!==JSON.stringify(before.state))throw Error('Component framing not based on its own conservative geometry bounds')
 if(!applied.feedback.after.resources.find(r=>r.id==='support.test-section').componentDisplay.find(c=>c.component==='steel_arch').generatedGeometryAvailable)throw Error('Missing actual generated geometry capability')
 if(process.env.VERIFY_COMPONENT_WARM==='1'&&after.camera.styles.some(s=>s.mode!==2||s.amount!==.45||JSON.stringify(s.color)!==JSON.stringify([1,240/255,191/255,1])))throw Error('Warm support expression did not take effect')
 await page.screenshot({path:`${root}/component-framing.png`})
 if(process.env.VERIFY_COMPONENT_FACTORS==='1'){
  const cases=[]
  for(const camera of ['whole','component']){
   await page.evaluate(async camera=>{const {focusTaskCamera}=await import('/src/platform/tasks/TaskCameraView.ts'),{viewerService}=await import('/src/platform/viewer/ViewerService.ts');focusTaskCamera(viewerService.require(),['support.test-section'],2244,'support',camera==='component'?{resourceId:'support.test-section',component:'steel_arch'}:undefined)},camera)
   const fixedCamera=await read()
   for(const shells of ['shown','hidden']){
    await page.getByTestId('support-layer-primary_concrete').setChecked(shells==='shown');await page.getByTestId('support-layer-secondary_lining').setChecked(shells==='shown')
    await page.evaluate(async()=>{const {viewerService}=await import('/src/platform/viewer/ViewerService.ts');const v=viewerService.require();v.scene.requestRender();await new Promise(resolve=>{const off=v.scene.postRender.addEventListener(()=>{off();resolve()})})})
    const current={camera:await read(),state:await nodeState(),measure:await measure()}
    if(current.camera.camera.some((n,i)=>Math.abs(n-fixedCamera.camera[i])>(i<3?1e-6:1e-12))||JSON.stringify(current.state.matrix)!==JSON.stringify(before.state.matrix))throw Error('Shell factor changed camera or assembly matrix')
    const screenshot=`${camera}-${shells}.png`;await page.screenshot({path:`${root}/${screenshot}`})
    cases.push({camera,shells,screenshot,...current})
   }
  }
  const response=await fetch(`http://localhost:3000/api/ai-agent/task-runs/${encodeURIComponent(before.camera.taskId)}/snapshots`)
  if(!response.ok)throw Error('Task asset snapshot unavailable')
  const snapshots=await response.json(),snapshot=snapshots.filter(s=>s.workflow_state?.status==='completed'&&s.data_versions?.length).at(-1)
  if(!snapshot)throw Error('Completed task source versions missing')
  report.checks.push({id:'shell-and-framing-four-conditions',scope:'same-task-geometry-and-camera-within-each-shell-pair-not-participant-experiment',dataVersions:snapshot.data_versions,cases})
 }
 await page.evaluate(async()=>{const {restoreTaskVisualReview,taskVisualReview}=await import('/src/platform/tasks/TaskVisualReview.ts');restoreTaskVisualReview(taskVisualReview.value.plan.taskId)})
 const restored=await read()
 if(restored.camera.some((n,i)=>Math.abs(n-before.camera.camera[i])>(i<3?1e-6:1e-12)))throw Error('Component framing did not restore original camera')
 if(JSON.stringify(restored.styles)!==JSON.stringify(before.camera.styles))throw Error('Component review did not restore original display color')
 if(JSON.stringify(await nodeState())!==JSON.stringify(before.state))throw Error('Factor comparison did not restore original node settings')
 report.checks.push({id:'actual-component-geometry-framing',before,applied,after,restored})
 await send('复位当前任务场景')
 if(report.errors.length||modelRequests)throw Error('Page errors or unexpected online model')
 report.modelRequests=modelRequests;report.passed=true
}catch(e){report.failure=e.message;if(page)await page.screenshot({path:`${root}/failure.png`}).catch(()=>{});throw e}
finally{await writeFile(`${root}/report.json`,JSON.stringify(report,null,2));await browser.close()}
