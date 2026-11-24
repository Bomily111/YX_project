import {chromium} from 'playwright-core'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
const root=process.env.R3_ENTRY_OUTPUT_DIR||'docs/verification/2026-11-17-r3-entry-normalized'
const appUrl=new URL(process.env.R3_ENTRY_APP_URL||'http://localhost:5178')
appUrl.searchParams.set('taskControls','manual')
await mkdir(root,{recursive:true})
const report={passed:false,scope:'entry-feasibility-not-participant-experiment',errors:[],cases:[],modelRequests:0}
const conditions=process.env.R3_MANUAL_STEPWISE==='1'?['manual-stepwise']:['form-input','agent-assembly','agent-with-review']
const reference=process.env.R3_REFERENCE_REPORT?JSON.parse(await readFile(process.env.R3_REFERENCE_REPORT,'utf8')):undefined
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--enable-webgl','--use-gl=angle','--use-angle=d3d11']})
let page
const wait=async fn=>{const end=Date.now()+120000;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,300))}throw Error('Entry condition timeout')}
try{
 for(const task of [{id:'hardness',resource:'rock.tsp-hardness',name:'TSP坚硬度解释体',mileage:'YK1+346'},{id:'integrity',resource:'rock.tsp-integrity',name:'TSP完整度解释体',mileage:'YK2+244'}]){
  let baseline,preparedCamera
  for(const condition of conditions){
   page=await browser.newPage({viewport:{width:1400,height:900}})
   page.on('pageerror',e=>report.errors.push(e.message))
   page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/ai-agent/chat'))report.modelRequests++})
   await page.goto(appUrl.toString(),{waitUntil:'domcontentloaded'});await page.locator('.agent-fab').click()
   const send=async request=>{
    const n=await page.locator('.agent-messages .msg-row.assistant').count()
    await page.locator('.agent-input').fill(request);await page.locator('.agent-input').press('Enter')
    await wait(async()=>await page.locator('.agent-messages .msg-row.assistant').count()>n)
    await page.locator('.agent-input').fill('idle');await wait(()=>page.locator('.send-btn').isEnabled());await page.locator('.agent-input').fill('')
    const answer=await page.locator('.agent-messages .msg-row.assistant').last().innerText()
    if(/余额不足|请求失败|认证失败|未生成可用的文字说明|模型未生成解释/.test(answer)||answer.replace(/[🤖👍👎\s]/gu,'').length<8)throw Error(answer)
    return answer
   }
   const read=()=>page.evaluate(async()=>{
    const {getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts'),{getTaskVolumeDomain,getTaskVolumeCutState}=await import('/src/platform/tasks/TaskVolumeCut.ts'),{getActiveModelerSupportModel}=await import('/src/modules/support/modeler-resources.ts'),{taskVisualReview}=await import('/src/platform/tasks/TaskVisualReview.ts'),{resourceRegistry}=await import('/src/platform/resources/ResourceRegistry.ts')
    const {viewerService}=await import('/src/platform/viewer/ViewerService.ts')
    const v=viewerService.require(),C=window.Cesium,globe=v.scene.globe,t=globe.translucency
    const status=getTaskWorkflowController().getStatus(),ids=status.lastCompletedStage?.assembledResourceIds??[],support=getActiveModelerSupportModel('support.modeler-zz-va'),domain=getTaskVolumeDomain()
    const imagery=Array.from({length:v.imageryLayers.length},(_,i)=>{const layer=v.imageryLayers.get(i);return {show:layer.show,alpha:layer.alpha,brightness:layer.brightness,saturation:layer.saturation}})
    const distanceValues=s=>s?{near:s.near,nearValue:s.nearValue,far:s.far,farValue:s.farValue}:null
    return {taskId:status.taskId,status:status.status,ids:[...ids].sort(),chainage:status.lastCompletedStage?.chainageRange,cut:getTaskVolumeCutState(),domain:domain?.corners.map(p=>[p.x,p.y,p.z]),matrix:support?Array.from(support.modelMatrix):null,style:support?{color:support.color?C.Color.pack(support.color,[]):null,mode:support.colorBlendMode,amount:support.colorBlendAmount}:null,paths:ids.flatMap(id=>resourceRegistry.get(id)?.getActiveAssetPaths?.()??[]).sort(),camera:[...C.Cartesian3.pack(v.camera.positionWC,[]),...C.Cartesian3.pack(v.camera.directionWC,[]),...C.Cartesian3.pack(v.camera.upWC,[])],environment:{terrainProvider:v.terrainProvider.constructor.name,tilesLoaded:globe.tilesLoaded,globeShow:globe.show,baseColor:C.Color.pack(globe.baseColor,[]),translucencyEnabled:t.enabled,front:t.frontFaceAlpha,back:t.backFaceAlpha,frontDistance:distanceValues(t.frontFaceAlphaByDistance),backDistance:distanceValues(t.backFaceAlphaByDistance),rectangle:C.Rectangle.pack(t.rectangle,[]),imagery},review:taskVisualReview.value?JSON.parse(JSON.stringify(taskVisualReview.value)):null}
   })
   // The configured main page initializes after an 800 ms timer and then
   // resolves world terrain asynchronously. An empty ellipsoid can report
   // tilesLoaded=true before that initialization has even started.
   await wait(async()=>{const e=(await read()).environment;return e.terrainProvider==='CesiumTerrainProvider'&&e.imagery.length>0&&e.frontDistance&&e.tilesLoaded})
   const main=await read(),environmentSettings=({tilesLoaded,...settings})=>settings
   const sameEnvironment=state=>JSON.stringify(environmentSettings(state.environment))===JSON.stringify(environmentSettings(main.environment))
   let answer,manualTrace=[]
   if(condition==='form-input'||condition==='manual-stepwise'){
    await page.getByRole('button',{name:'表单',exact:true}).click();const form=page.locator('.chat-task-form')
    await form.getByLabel('任务类型').selectOption('scene-exploration');await form.getByLabel('任务目标').fill('围岩与支护空间关系，示意资料');await form.getByLabel('目标里程').fill(task.mileage)
    await wait(async()=>await form.getByLabel('隧洞').locator('option').count()>1);await form.getByLabel('隧洞').selectOption({index:1})
    while(await form.getByRole('button',{name:'移除',exact:true}).count())await form.getByRole('button',{name:'移除',exact:true}).first().click()
    for(const id of [task.resource,'support.modeler-zz-va']){await form.getByLabel('追加场景资源').selectOption(id);await form.getByRole('button',{name:'添加阶段',exact:true}).click()}
    await form.getByRole('button',{name:'校验并创建计划',exact:true}).click()
    if(condition==='manual-stepwise'){
     await page.getByRole('button',{name:'记录',exact:true}).click()
     const panel=page.getByRole('complementary',{name:'任务运行记录与调试'})
     for(let i=0;i<8;i++){
      const previous=await page.evaluate(async()=>{const {getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts');return getTaskWorkflowController().getStatus()})
      if(previous.status==='completed')break
      if(previous.status==='failed')throw Error('Manual step failed')
      await panel.getByRole('button',{name:'执行下一步',exact:true}).click()
      await wait(()=>page.evaluate(async completed=>{const {getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts');const s=getTaskWorkflowController().getStatus();if(s.status==='failed')throw Error('Manual step failed');return s.completed>completed},previous.completed))
      manualTrace.push({completedBefore:previous.completed,stepId:previous.currentStepId,input:'existing-manual-step-button'})
     }
     await page.getByRole('button',{name:'关闭任务流程面板',exact:true}).click()
    }else await page.getByRole('button',{name:'自主执行剩余步骤',exact:true}).click()
   }else answer=await send(`在${task.mileage}同屏展示${task.name}和ZZ-Va支护断面，观察围岩与支护空间关系。`)
   await wait(async()=>{const s=await read();if(s.status==='failed')throw Error('Assembly failed');return s.status==='completed'&&s.matrix&&s.domain})
   await wait(async()=>!await page.locator('.tunnel-loading-overlay').isVisible())
   const assembly=await read(),mileage=Number(task.mileage.slice(2).replace('+',''))
   if(condition==='manual-stepwise'&&!await page.locator('.agent-assembly-info').count()){report.failedState={task,condition,assembly,manualTrace};throw Error('Manual execution completed without the shared scene information panel')}
   if(!sameEnvironment(assembly)){report.failedState={task,condition,main,assembly};throw Error('Assembly changed main terrain or imagery settings')}
   if(JSON.stringify(assembly.ids)!==JSON.stringify([task.resource,'support.modeler-zz-va'].sort())||assembly.chainage.start!==mileage||assembly.chainage.end!==mileage)throw Error('Task/resource mismatch')
   const comparable=({ids,chainage,cut,domain,matrix,paths})=>({ids,chainage,cut,domain,matrix,paths})
   if(!baseline)baseline=comparable(assembly)
   else if(JSON.stringify(comparable(assembly))!==JSON.stringify(baseline))throw Error('Entry conditions changed assembly data/placement/display baseline')
   // Shared experimental preparation isolates the explicit task review from
   // the presentation clipping that production assembly applies by default.
   await page.evaluate(async()=>{
    const {setTaskVolumeCut}=await import('/src/platform/tasks/TaskVolumeCut.ts');setTaskVolumeCut(false)
   })
   await page.getByTestId('task-view-overview').click();await page.waitForTimeout(300)
   await wait(async()=> (await read()).environment.tilesLoaded)
   const prepared=await read()
   if(reference){
    const expected=reference.cases.find(c=>c.task.id===task.id&&c.condition==='agent-assembly')?.prepared
    if(!reference.passed||!expected||JSON.stringify(comparable(prepared))!==JSON.stringify(comparable(expected))||prepared.camera.some((n,i)=>Math.abs(n-expected.camera[i])>(i<3?1e-6:1e-12)))throw Error('Manual entry differs from verified agent entry placement or prepared camera')
   }
   if(prepared.cut.xmax<=.5||prepared.cut.ymin>=.2)throw Error('Shared preparation retained automatic clipping')
   if(!preparedCamera)preparedCamera=prepared.camera
   else if(prepared.camera.some((value,i)=>Math.abs(value-preparedCamera[i])>(i<3?1e-6:1e-12)))throw Error('Prepared camera differs between entry conditions')
   let reviewAnswer,enhanced,restoreAnswer,restored
   if(condition==='agent-with-review'){
    reviewAnswer=await send('规划并执行当前任务视觉分析：以支护为重点，围岩只保留邻近采样参照，不看全段；近端剖切并局部取景，支护重点暖色混合，不改源色标和几何。')
    enhanced=await read()
    if(enhanced.review?.phase!=='applied'||enhanced.review.plan.referenceScope!=='near-support'||enhanced.review.plan.emphasis!=='material-focus'||enhanced.taskId!==assembly.taskId||JSON.stringify(enhanced.matrix)!==JSON.stringify(assembly.matrix)||enhanced.cut.xmax!==.5||enhanced.cut.ymin!==.2){report.failedState={task,condition,assembly,prepared,enhanced,reviewAnswer};throw Error('Explicit enhancement mismatch')}
    if(!sameEnvironment(enhanced))throw Error('Enhancement changed main terrain or imagery settings')
   }else if(assembly.review)throw Error('Baseline unexpectedly has an explicit task review')
   await page.screenshot({path:`${root}/${task.id}-${condition}.png`})
   if(condition==='agent-with-review'){
    restoreAnswer=await send('恢复分析前显示与视角')
    restored=await read()
    if(restored.review?.phase!=='restored'||restored.taskId!==prepared.taskId||JSON.stringify(restored.cut)!==JSON.stringify(prepared.cut)||JSON.stringify(restored.style)!==JSON.stringify(prepared.style)||JSON.stringify(restored.matrix)!==JSON.stringify(prepared.matrix)||!sameEnvironment(restored)||restored.camera.some((n,i)=>Math.abs(n-prepared.camera[i])>(i<3?1e-6:1e-12)))throw Error('Restoration did not preserve prepared camera/display/environment baseline')
    await page.screenshot({path:`${root}/${task.id}-restored.png`})
   }
   let dataVersions
   if(condition==='manual-stepwise'){
    const response=await fetch(`http://localhost:3000/api/ai-agent/task-runs/${encodeURIComponent(assembly.taskId)}/snapshots`)
    if(!response.ok)throw Error('Manual task snapshots unavailable')
    const snapshots=await response.json();dataVersions=snapshots.filter(s=>s.workflow_state?.status==='completed'&&s.data_versions?.length).at(-1)?.data_versions
    if(!dataVersions?.length)throw Error('Manual completed asset versions missing')
   }
   report.cases.push({task,condition,main,assembly,prepared,answer,enhanced,reviewAnswer,restored,restoreAnswer,manualTrace,dataVersions})
   await send('复位当前任务场景');await wait(async()=>!(await read()).matrix)
   await page.close();page=undefined
  }
 }
 if(report.errors.length)throw Error('Page errors')
 report.passed=true
}catch(e){report.failure=e.message;if(page)await page.screenshot({path:`${root}/failure.png`}).catch(()=>{});throw e}
finally{await writeFile(`${root}/report.json`,JSON.stringify(report,null,2));await browser.close()}
