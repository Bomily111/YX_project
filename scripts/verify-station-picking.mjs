import {chromium} from 'playwright-core'
import {mkdir,writeFile} from 'node:fs/promises'
const root=process.env.VERIFICATION_OUTPUT||'docs/verification/2026-11-18-station-picking'
const app=process.env.BROWSER_APP_URL||'http://localhost:5178'
const scenarios={
 steel:{resource:'support.test-section',row:'steel_arch',offsets:[-5.5,-4.7,-3.9,-3.1,-2.3,-1.5,-.7],interval:.8},
 lattice:{resource:'support.test-section-zz-iiix',row:'lattice_arch',offsets:[-5.5,-3.5,-1.5],interval:2},
 units:{resource:'support.test-section-z-pm',row:'units',offsets:[-5.5,-4.5,-3.5,-2.5,-1.5],interval:1},
}
const scenario=scenarios[process.env.STATION_SCENARIO||'steel']
if(!scenario)throw Error('Unknown station scenario')
await mkdir(root,{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--enable-webgl','--use-gl=angle','--use-angle=d3d11']})
const report={passed:false,scenario,errors:[],checks:[]}
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
   const previousTaskId=await page.evaluate(async()=>{const {getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts');return getTaskWorkflowController().getStatus().taskId})
   await page.getByRole('button',{name:'表单',exact:true}).click()
   const form=page.locator('.chat-task-form')
   await form.getByLabel('任务类型').selectOption('scene-exploration')
   await form.getByLabel('任务目标').fill(description)
   await form.getByLabel('目标里程').fill(mileage)
   await wait(async()=>await form.getByLabel('隧洞').locator('option').count()>1)
   await form.getByLabel('隧洞').selectOption({index:1})
   while(await form.getByRole('button',{name:'移除',exact:true}).count())await form.getByRole('button',{name:'移除',exact:true}).first().click()
   for(const id of ids){await form.getByLabel('追加场景资源').selectOption(id);await form.getByRole('button',{name:'添加阶段',exact:true}).click()}
   await form.getByLabel('支护长度（米）').fill('5')
   await form.getByRole('button',{name:'校验并创建计划',exact:true}).click()
   await page.getByRole('button',{name:'自主执行剩余步骤',exact:true}).click()
   await wait(()=>page.evaluate(async({previousTaskId,ids})=>{
    const {getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts')
    const status=getTaskWorkflowController().getStatus()
    return status.status==='completed'&&status.taskId!==previousTaskId&&ids.every(id=>status.lastCompletedStage?.assembledResourceIds.includes(id))
   },{previousTaskId,ids}))
   await wait(async()=>await page.locator('.agent-assembly-info').count()>0&&await page.locator('.agent-assembly-info').innerText().then(t=>t.includes(mileage)))
 }
 await createScene(['rock.three-bench',scenario.resource],'YK2+244','三台阶和后方5米支护，地理位置与站位连续核对')
 await wait(async()=>await page.getByTestId('support-layout').count()>0)
 const read=()=>page.evaluate(async()=>{
  const {viewerService}=await import('/src/platform/viewer/ViewerService.ts'),{taskCameraSelection}=await import('/src/platform/tasks/TaskCameraView.ts'),{getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts')
  const v=viewerService.require(),C=window.Cesium
  return {taskId:getTaskWorkflowController().getStatus().taskId,selection:taskCameraSelection.value,camera:[...C.Cartesian3.pack(v.camera.positionWC,[]),...C.Cartesian3.pack(v.camera.directionWC,[]),...C.Cartesian3.pack(v.camera.upWC,[])]}
 })
 await page.getByTestId('task-view-geographic').click()
 await page.getByTestId('support-layout').locator(':scope > summary').click()
 const layout=page.getByTestId('support-layout')
 const row=await page.getByTestId('support-layout-component').inputValue()
 if(row!==scenario.resource+':'+scenario.row||await layout.locator('[data-selected]').count()!==scenario.offsets.length)throw Error('Wrong station row or duplicated markers')
 if(scenario.row==='units'){
  const spacingRow=layout.getByRole('row').filter({hasText:'配筋间距'})
  if(!(await layout.innerText()).includes('不能据此推断配筋间距')||await page.getByTestId('support-component-reveal').count()||await spacingRow.getByRole('cell').innerText()!=='未核验')throw Error('Independent units were presented as reinforcement')
 }
 const entry=await read()
 await page.getByTestId('support-station-1').click()
 const station=await read()
 const readGuides=()=>page.evaluate(async()=>{
  const {viewerService}=await import('/src/platform/viewer/ViewerService.ts')
  const v=viewerService.require(),C=window.Cesium,t=C.JulianDate.now(),entities=v.entities.values
  const markers=entities.filter(e=>e.properties?.taskSupportStation?.getValue(t))
  return entities.filter(e=>e.properties?.taskSupportInterval?.getValue(t)).map(e=>{
   const offsets=['fromM','toM'].map(k=>e.properties[k].getValue(t))
   const positions=e.polyline.positions.getValue(t)
   return {offsets,matches: offsets.every((offset,i)=>C.Cartesian3.equals(positions[i],markers.find(m=>m.properties.offsetM.getValue(t)===offset)?.position.getValue(t)))}
  })
 })
 const twoDimensional=await readGuides()
 const intervalText=await page.getByTestId('support-station-intervals').innerText()
 if(twoDimensional.length!==2||twoDimensional.some(g=>!g.matches)||[0,1].some(i=>!intervalText.includes(`${scenario.offsets[i].toFixed(2)} 至 ${scenario.offsets[i+1].toFixed(2)}m · ${scenario.interval.toFixed(2)}m`)))throw Error('2D selection or guide endpoints do not match the source intervals')
 if(!intervalText.includes(scenario.row==='units'?'相邻单元基准':'相邻构件基准'))throw Error('Incorrect interval context')
 // Give asynchronously batched Cesium polylines time to reach a rendered frame.
 await page.waitForTimeout(500)
 await page.screenshot({path:`${root}/intervals.png`})
 if(station.selection!=='station'||station.taskId!==entry.taskId||station.camera.every((v,i)=>Math.abs(v-entry.camera[i])<1e-6))throw Error('2D selection did not establish a station camera')
 await page.evaluate(async()=>{const {refitTaskViewport}=await import('/src/platform/tasks/TaskViewport.ts'),{viewerService}=await import('/src/platform/viewer/ViewerService.ts');refitTaskViewport(viewerService.require())})
 const stable=await read();if(stable.camera.some((v,i)=>Math.abs(v-station.camera[i])>(i<3?1e-6:1e-12)))throw Error('Old viewport target changed station camera')
 await page.screenshot({path:`${root}/station.png`})
 await page.getByTestId('support-review-restore').click()
 const restored=await read()
 if(restored.selection!==entry.selection||restored.camera.some((v,i)=>Math.abs(v-entry.camera[i])>(i<3?1e-6:1e-12)))throw Error('Entry camera/selection restoration failed')
 await page.evaluate(async()=>{const {refitTaskViewport}=await import('/src/platform/tasks/TaskViewport.ts'),{viewerService}=await import('/src/platform/viewer/ViewerService.ts');refitTaskViewport(viewerService.require())})
 const refit=await read();if(refit.camera.some((v,i)=>Math.abs(v-entry.camera[i])>(i<3?1e-6:1e-12)))throw Error('Restoration retained a station/detail viewport target')
 await page.screenshot({path:`${root}/returned.png`})
 await page.getByTestId('support-station-1').click()
 const beforePick=await read()
 const pick=await page.evaluate(async()=>{
  const {viewerService}=await import('/src/platform/viewer/ViewerService.ts');const v=viewerService.require(),C=window.Cesium,time=C.JulianDate.now()
  const markers=v.entities.values.filter(e=>e.properties?.taskSupportStation?.getValue(time))
  const entity=markers.at(-1),world=entity.position.getValue(time),xy=C.SceneTransforms.worldToWindowCoordinates(v.scene,world),rect=v.canvas.getBoundingClientRect()
  return {x:xy.x+rect.left,y:xy.y+rect.top,offset:entity.properties.offsetM.getValue(time),count:markers.length}
 })
 await page.mouse.click(pick.x,pick.y)
 await wait(async()=> (await page.getByTestId('support-station-selection').innerText()).includes(pick.offset.toFixed(2)))
 const afterPick=await read()
 const threeDimensional=await readGuides()
 if(threeDimensional.length!==1||!threeDimensional[0].matches||pick.count!==scenario.offsets.length||threeDimensional[0].offsets.some((offset,i)=>Math.abs(offset-scenario.offsets.at(i-2))>1e-8))throw Error('3D end station did not keep just the preceding interval')
 await page.getByTestId('support-station-clear').click()
 if((await readGuides()).length||await page.getByTestId('support-station-intervals').count())throw Error('Clear retained interval guides')
 await page.mouse.click(pick.x,pick.y)
 await wait(async()=> (await page.getByTestId('support-station-selection').innerText()).includes(pick.offset.toFixed(2)))
 if(afterPick.camera.some((v,i)=>Math.abs(v-beforePick.camera[i])>(i<3?1e-6:1e-12)))throw Error('3D selection unexpectedly moved camera')
 const evidence=await page.evaluate(async()=>{const {inspectTaskEvidenceJournal}=await import('/src/platform/tasks/TaskEvidenceJournal.ts'),{getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts');return inspectTaskEvidenceJournal(getTaskWorkflowController().getStatus().taskId)})
 if(evidence.at(-1)?.source!=='3d'||evidence.at(-1).offsetM!==pick.offset)throw Error('Actual 3D click did not generate matching evidence')
 const component=page.getByTestId('support-layout-component'),options=await component.locator('option').evaluateAll(els=>els.map(e=>({value:e.value,text:e.textContent})))
 const initialRow=await component.inputValue(),next=options.find(o=>o.value!==initialRow)
 if(next){
 await component.selectOption(next.value)
 if((await readGuides()).length)throw Error('Component switch retained intervals')
 if(!(await page.getByTestId('support-station-selection').innerText()).includes('选择图中站位')||await page.getByTestId('support-review-history').count())throw Error('Component switch retained the old selection/history')
 const oldFact=await page.getByTestId('support-evidence-assessment').innerText()
 if(!oldFact.includes('本行尚无保留的交互事实'))throw Error('Component switch reused old-row facts')
 await component.selectOption(initialRow)
 if(!(await page.getByTestId('support-evidence-assessment').innerText()).includes('交互事实'))throw Error('Returning component lost task evidence')
 }
 await page.screenshot({path:`${root}/3d-selection.png`})
 await page.getByTestId('support-station-1').click()
 if(process.env.VERIFY_STATION_SWITCH==='1'){
  const question='当前钢架纵向基准如何分布？'
  await page.evaluate(async({resource,component,question})=>{
   const {planTaskVisualReview}=await import('/src/platform/tasks/TaskVisualReview.ts')
   planTaskVisualReview({objective:'component-detail',focusResourceIds:[resource],focusComponent:component,questions:[question],userRequest:'核查当前钢架站位'})
  },{resource:scenario.resource,component:scenario.row,question})
  await component.selectOption(next.value)
  await page.getByTestId('support-station-0').click()
  await component.selectOption(initialRow)
  await page.getByTestId('support-station-1').click()
  const facts=await page.evaluate(async()=>{
   const {inspectTaskEvidenceJournal}=await import('/src/platform/tasks/TaskEvidenceJournal.ts')
   const {getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts')
   return inspectTaskEvidenceJournal(getTaskWorkflowController().getStatus().taskId).slice(-2)
  })
  if(facts.length!==2||facts[0].rowId!==next.value||facts[0].visualObjective||facts[0].questions||facts[1].rowId!==initialRow||facts[1].visualObjective!=='component-detail'||facts[1].questions?.[0]!==question)throw Error('Station evidence crossed the planned component scope')
  report.checks.push({id:'visual-question-stays-with-its-component',facts})
  await page.getByTestId('support-component-reveal').click()
  if(!await page.getByTestId('support-component-restore').count()||(await readGuides()).length!==2)throw Error('Missing active station or reveal before task replacement')
  const oldTaskId=(await read()).taskId
  await createScene(['rock.three-bench',scenarios.units.resource],'YK2+244','换到同里程Z-PM独立单元')
  const status=await page.evaluate(async ({oldTaskId,oldResource})=>{
   const {viewerService}=await import('/src/platform/viewer/ViewerService.ts')
   const {getTestSectionSupportModels}=await import('/src/modules/support/test-section-resource.ts')
   const {inspectTaskEvidenceJournal}=await import('/src/platform/tasks/TaskEvidenceJournal.ts')
   const now=window.Cesium.JulianDate.now(),entities=viewerService.require().entities.values
   return {
    markers:entities.filter(e=>e.properties?.taskSupportStation?.getValue(now)).length,
    intervals:entities.filter(e=>e.properties?.taskSupportInterval?.getValue(now)).length,
    oldModels:getTestSectionSupportModels([oldResource]).length,
    oldEvidence:inspectTaskEvidenceJournal(oldTaskId).length,
   }
  },{oldTaskId,oldResource:scenario.resource})
  if(Object.values(status).some(value=>value!==0)||await page.getByTestId('support-component-restore').count())throw Error('Replaced task retained locator, reveal or active evidence')
  await layout.locator(':scope > summary').click()
  if(await component.inputValue()!==scenarios.units.resource+':units'||await page.getByTestId('support-review-history').count())throw Error('Replacement inherited old locator selection')
  await page.getByTestId('support-station-1').click()
  const newGuides=await readGuides()
  if(newGuides.length!==2||newGuides.some(g=>!g.matches||g.offsets[1]-g.offsets[0]!==1))throw Error('Replacement guides do not match the new unit offsets')
  report.checks.push({id:'task-replacement-releases-old-station-state',oldTaskId,newTaskId:(await read()).taskId,status,newGuides})
  await page.waitForTimeout(500)
  await page.screenshot({path:`${root}/replacement.png`})
 }else{
  await layout.locator(':scope > summary').click()
  await wait(async()=> (await readGuides()).length===0)
 }
 report.checks.push({id:'actual-3d-pick-and-component-isolation',pick,beforePick,afterPick,evidence,options})
 report.checks.push({id:'same-interval-endpoints-in-2d-and-3d',twoDimensional,threeDimensional})
 report.checks.push({id:'geographic-station-return',entry,station,restored,refit})
 await send('复位当前任务场景')
 if(report.errors.length||modelRequests)throw Error('Page error or unexpected model request')
 report.modelRequests=modelRequests;report.passed=true
}catch(e){report.failure=e.message;if(page)await page.screenshot({path:`${root}/failure.png`}).catch(()=>{});throw e}
finally{await writeFile(`${root}/report.json`,JSON.stringify(report,null,2));await browser.close()}
