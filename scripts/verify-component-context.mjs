import {chromium} from 'playwright-core'
import {mkdir,writeFile} from 'node:fs/promises'
const root=process.env.VERIFICATION_OUTPUT||'docs/verification/2026-11-18-component-context'
const app=process.env.BROWSER_APP_URL||'http://localhost:5178'
const scenario=process.env.COMPONENT_SCENARIO==='lattice'?{resourceId:'support.test-section-zz-iiix',component:'lattice_arch',label:'格栅拱架',spacingM:2,baseCount:3,sourceSegment:6}:{resourceId:'support.test-section',component:'steel_arch',label:'钢拱架',spacingM:.8,baseCount:7,sourceSegment:19}
const {resourceId,component:focusComponent,label:focusLabel}=scenario
const emphasis=process.env.COMPONENT_EMPHASIS==='material-focus'?'material-focus':'source'
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
   const oldTask=await page.evaluate(async()=>{const {getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts');return getTaskWorkflowController().getStatus().taskId})
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
   await wait(()=>page.evaluate(async({oldTask,ids})=>{const {getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts');const s=getTaskWorkflowController().getStatus();return s.status==='completed'&&s.taskId!==oldTask&&ids.every(id=>s.lastCompletedStage?.assembledResourceIds.includes(id))},{oldTask,ids}))
 }
 await createScene(['rock.three-bench',resourceId],'YK2+244',`三台阶和后方5米支护，${focusLabel}连续核对`)
 await wait(async()=>await page.getByTestId('support-layout').count()>0)
 const read=()=>page.evaluate(async resourceId=>{
  const {viewerService}=await import('/src/platform/viewer/ViewerService.ts'),{taskCameraSelection}=await import('/src/platform/tasks/TaskCameraView.ts'),{getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts')
  const v=viewerService.require(),C=window.Cesium
  const {getTestSectionSupportModels}=await import('/src/modules/support/test-section-resource.ts')
  return {taskId:getTaskWorkflowController().getStatus().taskId,selection:taskCameraSelection.value,styles:getTestSectionSupportModels([resourceId]).map(m=>({color:m.color?C.Color.pack(m.color,[]):null,mode:m.colorBlendMode,amount:m.colorBlendAmount})),camera:[...C.Cartesian3.pack(v.camera.positionWC,[]),...C.Cartesian3.pack(v.camera.directionWC,[]),...C.Cartesian3.pack(v.camera.upWC,[])]}
 },resourceId)
 const nodeState=()=>page.evaluate(async resourceId=>{
  const {getTestSectionSupportModels,getTestSectionSupportSummaries}=await import('/src/modules/support/test-section-resource.ts')
  const groups=getTestSectionSupportSummaries([resourceId])[0].groups,m=getTestSectionSupportModels([resourceId])[0]
  return {matrix:Array.from(m.modelMatrix),nodes:groups.map(g=>({component:g.component,name:g.name,show:m.getNode(g.name).show}))}
 },resourceId)
 await page.getByTestId(`support-layer-${focusComponent}`).uncheck();await page.getByTestId('support-layer-secondary_lining').check()
 const before={scene:await read(),state:await nodeState()}
 const rejected=await page.evaluate(async({resourceId,focusComponent})=>{
  const {planTaskVisualReview}=await import('/src/platform/tasks/TaskVisualReview.ts'),{getTestSectionSupportModels}=await import('/src/modules/support/test-section-resource.ts')
  const input={objective:'component-detail',focusResourceIds:[resourceId],focusComponent,questions:['当前构件是否可辨？'],userRequest:'只规划构件观察'}
  const messages=[]
  try{planTaskVisualReview({...input,focusComponent:'imagined-component'})}catch(e){messages.push(String(e))}
  const model=getTestSectionSupportModels([resourceId])[0],show=model.show
  try{model.show=false;try{planTaskVisualReview(input)}catch(e){messages.push(String(e))}}finally{model.show=show}
  return messages
 },{resourceId,focusComponent})
 if(rejected.length!==2||JSON.stringify(await nodeState())!==JSON.stringify(before.state))throw Error('Invalid/hidden component plan changed display or was not rejected')
 report.checks.push({id:'unknown-and-hidden-plan-rejections',rejected})
 const review=()=>page.evaluate(async()=>{const {taskVisualReview}=await import('/src/platform/tasks/TaskVisualReview.ts');return JSON.parse(JSON.stringify(taskVisualReview.value))})
 const plannedAnswer=await send(`只规划当前任务视觉分析，观察${focusLabel}布置，需要暂避混凝土外壳，保留其他结构；先不要执行。`)
 const planned=await review()
 if(planned.phase!=='planned'||planned.plan.focusComponent!==focusComponent||JSON.stringify(await nodeState())!==JSON.stringify(before.state))throw Error('Read-only component plan missing or changed display: '+plannedAnswer)
 const applyAnswer=await send(`规划并执行当前任务视觉分析：以当前测试支护的${focusLabel}为重点，显露${focusLabel}并暂避其他初支和二衬混凝土外壳，保留其他结构原显隐，不改地形、源几何或装配位置。${emphasis==='material-focus'?'线材偏暗，需要支护重点暖色混合。':'保留源颜色表达。'}`)
 const applied=await review(),focused=await nodeState()
 if(applied.phase!=='applied'||applied.plan.focusComponent!==focusComponent||!focused.nodes.filter(n=>n.component===focusComponent).every(n=>n.show)||focused.nodes.filter(n=>['primary_concrete','secondary_lining'].includes(n.component)).some(n=>n.show)||JSON.stringify(focused.matrix)!==JSON.stringify(before.state.matrix))throw Error('Actual component review not applied: '+applyAnswer)
 const support=applied.feedback.after.resources.find(r=>r.id===resourceId),component=support.componentDisplay.find(c=>c.component===focusComponent)
 if(applied.plan.emphasis!==emphasis)throw Error('Agent did not apply the requested support expression')
 if(emphasis==='material-focus'&&(!support.observation.displayStyles.length||support.observation.displayStyles.some(s=>s.colorBlendMode!==2||s.colorBlendAmount!==.45||JSON.stringify(s.colorRgba)!==JSON.stringify([1,240/255,191/255,1]))))throw Error('Actual warm expression missing from runtime feedback')
 if(!component.generatedGeometryAvailable||component.framing.insideSafe!==26||applied.conditions[0].framingScope!=='focus-component'||applied.conditions[0].framing!=='26-samples-inside')throw Error('Component detail feedback used the whole-resource range')
 if(!await page.getByTestId('component-framing-feedback').innerText().then(t=>t.includes('26/26')))throw Error('Current component framing missing from panel')
 if(!support.sourceHints.some(h=>h.sourceStatus==='PARTIAL')||!await page.getByTestId('component-source-partial').isVisible()||!applyAnswer.includes('PARTIAL'))throw Error('Partial source completeness lost in runtime, panel or model explanation')
 if(JSON.stringify(component.sourceAssembly.spacingM)!==JSON.stringify([scenario.spacingM])||component.sourceAssembly.baseStationCount!==scenario.baseCount||JSON.stringify(component.sourceAssembly.sourceSegments)!==JSON.stringify([scenario.sourceSegment]))throw Error('Current source basis does not match the selected source scenario')
 report.checks.push({id:'component-and-whole-resource-framing',component:component.framing,wholeResource:support.observation.framing,conditions:applied.conditions})
 await page.screenshot({path:`${root}/applied.png`})
 if(process.env.COMPARE_COMPONENT_STYLE==='1'){
  const style=emphasis=>page.evaluate(async({resourceId,emphasis})=>{
   const {getTestSectionSupportModels}=await import('/src/modules/support/test-section-resource.ts'),{setSupportFocusStyle}=await import('/src/platform/tasks/SupportFocusStyle.ts'),{viewerService}=await import('/src/platform/viewer/ViewerService.ts'),C=window.Cesium
   const models=getTestSectionSupportModels([resourceId]),v=viewerService.require()
   if(emphasis)setSupportFocusStyle(models,emphasis)
   v.scene.requestRender();await new Promise(resolve=>{const off=v.scene.postRender.addEventListener(()=>{off();resolve()})})
   return models.map(m=>({color:m.color?C.Color.pack(m.color,[]):null,mode:m.colorBlendMode,amount:m.colorBlendAmount}))
  },{resourceId,emphasis})
  const source={scene:await read(),nodes:await nodeState(),style:await style()}
  const warm={style:await style('material-focus'),scene:await read(),nodes:await nodeState()}
  if(JSON.stringify(warm.nodes)!==JSON.stringify(source.nodes)||warm.scene.camera.some((n,i)=>Math.abs(n-source.scene.camera[i])>(i<3?1e-6:1e-12)))throw Error('Style trial altered camera, nodes or assembly matrix')
  await page.screenshot({path:`${root}/warm-focus.png`})
  const originalStyle=await style('source')
  if(JSON.stringify(originalStyle)!==JSON.stringify(source.style))throw Error('Style trial did not restore source expression')
  report.checks.push({id:'same-camera-component-style-trial',scope:'controlled-operator-comparison-not-agent-strategy-selection',source,warm,restoredStyle:originalStyle})
 }
 if(process.env.CHECK_MANUAL_HIDDEN==='1'){
  await page.getByTestId(`support-layer-${focusComponent}`).uncheck()
  const manuallyHidden={scene:await read(),nodes:await nodeState()}
  const actual=await page.evaluate(async resourceId=>{
   const {inspectTaskScene}=await import('/src/platform/tasks/TaskSceneInspection.ts'),{getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts'),{resourceRegistry}=await import('/src/platform/resources/ResourceRegistry.ts'),{resourceManager}=await import('/src/platform/resources/ResourceManager.ts'),{viewerService}=await import('/src/platform/viewer/ViewerService.ts')
   return inspectTaskScene(getTaskWorkflowController().getStatus(),resourceRegistry,resourceManager.listStates(),viewerService.require()).resources.find(r=>r.id===resourceId)
  },resourceId)
  const answer=await send(`我刚才手动隐藏了${focusLabel}。只读核查现在是否显示，区分当前状态与上次增强快照，不要显露、重新规划或移动相机。`)
  const afterRead={scene:await read(),nodes:await nodeState(),review:await review()}
  if(!actual.componentDisplay.some(c=>c.component===focusComponent&&c.visibleNodes===0)||JSON.stringify(afterRead.nodes)!==JSON.stringify(manuallyHidden.nodes)||JSON.stringify(afterRead.scene.styles)!==JSON.stringify(manuallyHidden.scene.styles)||afterRead.scene.camera.some((n,i)=>Math.abs(n-manuallyHidden.scene.camera[i])>(i<3?1e-6:1e-12))||afterRead.review.attempts!==1||afterRead.review.phase!=='applied'||!/(隐藏|不可见|未显示)/.test(answer))throw Error('Readonly observation reused historical visible component or modified the manual selection: '+answer)
  report.checks.push({id:'fresh-observation-after-manual-hide',historical:component,actual,manuallyHidden,answer,afterRead})
 }
 const fullAnswer=await send(`规划并执行当前任务视觉分析：仍以测试支护${focusLabel}为重点并暂避混凝土外壳，但这次需要完整三台阶和整个5米支护作为总体空间参照，不要只聚焦支护细部。${emphasis==='material-focus'?'继续保留支护重点暖色混合。':'继续保留源颜色表达。'}`)
 const full=await review()
 if(full.phase!=='applied'||full.plan.objective!=='spatial-relation'||full.plan.focusComponent!==focusComponent||full.plan.candidate.view!=='overview'||full.remaining!==0)throw Error('Whole-reference component strategy was not selected: '+fullAnswer)
 if(full.plan.emphasis!==emphasis)throw Error('Whole-reference review silently changed emphasis')
 for(const id of ['rock.three-bench',resourceId])if(full.feedback.after.resources.find(r=>r.id===id)?.observation.framing.insideSafe!==26)throw Error('Whole reference not in safe area')
 await page.screenshot({path:`${root}/whole-reference.png`});report.checks.push({id:'whole-reference-with-component-focus',full,fullAnswer})
 const restoreAnswer=await send('恢复分析前视角'),restored=await review(),after=await read()
 if(restored.phase!=='restored'||JSON.stringify(await nodeState())!==JSON.stringify(before.state)||JSON.stringify(after.styles)!==JSON.stringify(before.scene.styles)||after.taskId!==before.scene.taskId||after.camera.some((n,i)=>Math.abs(n-before.scene.camera[i])>(i<3?1e-6:1e-12)))throw Error('Component review did not restore original custom display, color and camera: '+restoreAnswer)
 report.checks.push({id:'agent-component-plan-apply-restore',before,planned,plannedAnswer,applied,focused,applyAnswer,restored,restoreAnswer})
 await page.screenshot({path:`${root}/restored.png`})
 const budgetAnswer=await send('只读说明当前任务的视觉调整预算：恢复后重新规划能补回次数吗？当前场景还能自主执行暖色增强吗？此时还保留可再次恢复的撤销吗？不要规划、执行、复位或新建任务，只解释当前限制及可用的普通操作。')
 const budgetState=await review(),afterBudget=await read()
 if(budgetState.remaining!==0||budgetState.canRestore!==false||budgetState.phase!=='restored'||budgetState.attempts!==2||afterBudget.taskId!==after.taskId||JSON.stringify(await nodeState())!==JSON.stringify(before.state)||JSON.stringify(afterBudget.styles)!==JSON.stringify(before.scene.styles)||afterBudget.camera.some((n,i)=>Math.abs(n-after.camera[i])>(i<3?1e-6:1e-12))||!/(不重置|不能|不会|不补回|不返还)/.test(budgetAnswer))throw Error('Budget explanation or readonly handling incorrect: '+budgetAnswer)
 if(!await page.getByTestId('visual-review-budget-exhausted').isVisible())throw Error('Exhausted scene budget missing from panel')
 report.checks.push({id:'readonly-budget-explanation-after-restoration',budgetAnswer,budgetState})
 await send('复位当前任务场景')
 if(report.errors.length||!modelRequests)throw Error('Page errors or missing online model')
 report.modelRequests=modelRequests;report.passed=true
}catch(e){report.failure=e.message;if(page)await page.screenshot({path:`${root}/failure.png`}).catch(()=>{});throw e}
finally{await writeFile(`${root}/report.json`,JSON.stringify(report,null,2));await browser.close()}
