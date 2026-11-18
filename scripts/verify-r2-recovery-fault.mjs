import {chromium} from 'playwright-core'
import {mkdir,writeFile} from 'node:fs/promises'
const root=process.env.VOLUME_REVIEW_OUTPUT_DIR||'docs/verification/2026-11-17-r2-recovery-fault'
await mkdir(root,{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--enable-webgl','--use-gl=angle','--use-angle=d3d11']})
const report={passed:false,modelRequests:0,errors:[],cases:[],diagnostics:[],configRequests:[]}
let page
const wait=async fn=>{const end=Date.now()+120000;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,250))}throw Error('Volume review timeout')}
try{
 page=await browser.newPage({viewport:{width:1400,height:900}})
 page.on('console',m=>{if(['error','warning'].includes(m.type()))report.diagnostics.push({type:m.type(),text:m.text().slice(0,1200)})})
 page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/ai-agent/chat'))report.modelRequests++})
 page.on('request',r=>{const u=new URL(r.url());if(r.method()==='GET'&&u.pathname.includes('/data/')&&u.pathname.endsWith('.json'))report.configRequests.push(u.pathname)})
 await page.route('http://localhost:5178/api/**',route=>{const u=new URL(route.request().url());u.port='3000';return route.continue({url:u.toString()})})
 await page.goto('http://localhost:5178',{waitUntil:'domcontentloaded'});await page.locator('.agent-fab').click()
 const inspect=()=>page.evaluate(async()=>{
   const {getTaskVolumeDomain,getTaskVolumeCutState}=await import('/src/platform/tasks/TaskVolumeCut.ts'),{viewerService}=await import('/src/platform/viewer/ViewerService.ts'),{getActiveGeoModelKey}=await import('/src/utils/Common/GeoModelController.ts')
   const {executeTool}=await import('/src/ai-agent/ToolRegistry.ts'),{inspectTaskSphereViewport}=await import('/src/platform/tasks/TaskViewport.ts')
   const domain=getTaskVolumeDomain(),v=viewerService.require(),C=window.Cesium,time=C.JulianDate.now()
   return {key:getActiveGeoModelKey(),domain:domain&&{dimensionsM:domain.dimensionsM,ranges:domain.ranges,corners:domain.corners.map(p=>[p.x,p.y,p.z])},cut:getTaskVolumeCutState(),edges:v.entities.values.filter(e=>e.properties?.taskVolumeDomain?.getValue(time)).length,framing:domain&&inspectTaskSphereViewport(v,domain.sphere),tool:JSON.parse(await executeTool('inspect_task_volume_review',{}))}
 })
 const cases=[{id:'hardness-support',resource:'rock.tsp-hardness',mileage:'YK1+346',support:true},{id:'integrity-support',resource:'rock.tsp-integrity',mileage:'YK2+244',support:true},{id:'tem',resource:'rock.tem-resistivity',mileage:'YK2+244',support:false}]
 if(process.env.VOLUME_REVIEW_ALL==='1')for(const id of ['tsp-vp','tsp-vs','tsp-ratio','tsp-anomaly','tem-water','geophysical-grade'])cases.push({id,resource:`rock.${id}`,mileage:'YK2+244',support:false})
 for(const c of cases.filter(c=>!process.env.VOLUME_REVIEW_CASES||process.env.VOLUME_REVIEW_CASES.split(',').includes(c.id))){
   await page.getByRole('button',{name:'表单',exact:true}).click();const form=page.locator('.chat-task-form')
   await form.getByLabel('任务类型').selectOption('scene-exploration');await form.getByLabel('任务目标').fill('围岩解释与支护的空间复核，示意资料');await form.getByLabel('目标里程').fill(c.mileage)
   await wait(async()=>await form.getByLabel('隧洞').locator('option').count()>1);await form.getByLabel('隧洞').selectOption({index:1})
   while(await form.getByRole('button',{name:'移除',exact:true}).count())await form.getByRole('button',{name:'移除',exact:true}).first().click()
   for(const id of [c.resource,...(c.support?['support.modeler-zz-va']:[])]){await form.getByLabel('追加场景资源').selectOption(id);await form.getByRole('button',{name:'添加阶段',exact:true}).click()}
   await form.getByRole('button',{name:'校验并创建计划',exact:true}).click();await page.getByRole('button',{name:'自主执行剩余步骤',exact:true}).click()
   await wait(async()=>{
     const status=await page.evaluate(async()=>{const {getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts');return getTaskWorkflowController().getStatus()})
     if(status.status==='failed')throw Error(status.notice?.message||'Volume task failed')
     return await page.getByTestId('task-volume-domain').count()>0
   })
   await page.waitForTimeout(300)
   await wait(async()=>!await page.locator('.tunnel-loading-overlay').isVisible())
   const initial=await inspect()
   if(initial.edges!==12||!initial.tool.ok||initial.tool.engineeringAcceptance!=='not-verified'||initial.framing.insideSafe!==26)throw Error(`Volume domain mismatch ${JSON.stringify(initial)}`)
   const fault=await page.evaluate(async()=>{
     const {viewerService}=await import('/src/platform/viewer/ViewerService.ts'),{planTaskVisualReview,applyTaskVisualReview,restoreTaskVisualReview,taskVisualReview}=await import('/src/platform/tasks/TaskVisualReview.ts')
     const {getTaskVolumeCutState}=await import('/src/platform/tasks/TaskVolumeCut.ts')
     const v=viewerService.require(),C=window.Cesium,camera=()=>[...C.Cartesian3.pack(v.camera.positionWC,[]),...C.Cartesian3.pack(v.camera.directionWC,[]),...C.Cartesian3.pack(v.camera.upWC,[])]
     const original={camera:camera(),cut:getTaskVolumeCutState()}
     const p=planTaskVisualReview({objective:'spatial-relation',referenceScope:'near-support',emphasis:'material-focus',focusResourceIds:['support.modeler-zz-va'],questions:['支护轮廓与局部参照？'],userRequest:'观察支护局部参照并突出支护'})
     applyTaskVisualReview(p.plan.taskId)
     const setView=v.camera.setView
     let message='',failed
     try{v.camera.setView=()=>{throw Error('acceptance-injected-camera-restore-failure')};try{restoreTaskVisualReview(p.plan.taskId)}catch(e){message=String(e)};failed=JSON.parse(JSON.stringify(taskVisualReview.value))}
     finally{v.camera.setView=setView}
     window.__retryVisualRestore=()=>restoreTaskVisualReview(p.plan.taskId)
     return {original,message,failed}
   })
   if(!fault.message.includes('恢复未完成')||fault.failed.phase!=='failed'||fault.failed.recoveryStatus!=='failed'||fault.failed.conditions.some(c=>c.runtime!=='not-evaluated'))throw Error('Fault incorrectly reported successful recovery')
   if(!(await page.getByTestId('visual-review-phase').innerText()).includes('恢复未完成')||await page.getByTestId('support-context-feedback').count())throw Error('Page retained old success feedback')
   await page.screenshot({path:`${root}/${c.id}-recovery-failed.png`})
   const retry=await page.evaluate(async()=>{
     window.__retryVisualRestore();delete window.__retryVisualRestore
     const {taskVisualReview}=await import('/src/platform/tasks/TaskVisualReview.ts'),{viewerService}=await import('/src/platform/viewer/ViewerService.ts'),{getTaskVolumeCutState}=await import('/src/platform/tasks/TaskVolumeCut.ts')
     const v=viewerService.require(),C=window.Cesium
     return {review:JSON.parse(JSON.stringify(taskVisualReview.value)),cut:getTaskVolumeCutState(),camera:[...C.Cartesian3.pack(v.camera.positionWC,[]),...C.Cartesian3.pack(v.camera.directionWC,[]),...C.Cartesian3.pack(v.camera.upWC,[])]}
   })
   if(retry.review.phase!=='restored'||retry.review.remaining!==1||JSON.stringify(retry.cut)!==JSON.stringify(fault.original.cut)||retry.camera.some((n,i)=>Math.abs(n-fault.original.camera[i])>(i<3?1e-6:1e-12)))throw Error('Recovery retry failed or reset budget')
   const card=await page.getByTestId('task-visual-review').innerText()
   if(!card.includes('原计划策略（已撤销）')||!card.includes('支护与邻近围岩局部观察')||card.includes('support-context'))throw Error('Restored plan is still presented as an active raw strategy identifier')
   await page.screenshot({path:`${root}/${c.id}-recovery-retried.png`})
   report.cases.push({id:c.id,fault,retry})
   await page.locator('.agent-input').fill('复位当前任务场景');await page.locator('.agent-input').press('Enter');await wait(async()=>await page.getByTestId('task-volume-domain').count()===0)
 }
 if(report.errors.length||report.modelRequests)throw Error('Page error or unexpected model request')
 report.passed=true
}catch(e){report.failure=e.message;if(page)await page.screenshot({path:`${root}/failure.png`}).catch(()=>{});throw e}
finally{await writeFile(`${root}/report.json`,JSON.stringify(report,null,2));await browser.close()}
