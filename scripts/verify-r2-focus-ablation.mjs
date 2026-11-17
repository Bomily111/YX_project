import {chromium} from 'playwright-core'
import {mkdir,writeFile} from 'node:fs/promises'
const root=process.env.VOLUME_REVIEW_OUTPUT_DIR||'docs/verification/2026-11-17-r2-focus-ablation'
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
   if(c.resource==='rock.tem-resistivity'){
     const legend=page.getByLabel('视电阻率图例')
     if(!await legend.isVisible()||!(await legend.innerText()).includes('P2–P98')||!(await legend.innerText()).includes('553.7'))throw Error('Actual TEM display range and provenance legend unavailable')
   }
   if(['rock.tsp-vp','rock.tsp-vs','rock.tsp-ratio','rock.tsp-anomaly'].includes(c.resource)){
     if(initial.domain.dimensionsM.some((value,i)=>Math.abs(value-[49,98,49][i])>1e-5))throw Error('TSP task did not use its registered metre-scale display mapping')
     const legend=page.locator('.tsp-legend')
     const gradient=await legend.locator('.scale-bar').evaluate(e=>e.style.background)
     if(!await legend.isVisible()||!gradient.includes('linear-gradient')||!(await legend.innerText()).includes('示意重定位'))throw Error('TSP source palette or provenance missing')
     initial.sourceLegend={text:await legend.innerText(),gradient}
   }
   await page.screenshot({path:`${root}/${c.id}.png`})
   let full
   if(c.support){
     const stable=()=>page.evaluate(async()=>{
       const {viewerService}=await import('/src/platform/viewer/ViewerService.ts'),{getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts'),{getActiveModelerSupportModel}=await import('/src/modules/support/modeler-resources.ts')
       const v=viewerService.require(),C=window.Cesium,model=getActiveModelerSupportModel('support.modeler-zz-va')
       if(!window.__r2Support)window.__r2Support=model
       return {taskId:getTaskWorkflowController().getStatus().taskId,camera:[...C.Cartesian3.pack(v.camera.positionWC,[]),...C.Cartesian3.pack(v.camera.directionWC,[]),...C.Cartesian3.pack(v.camera.upWC,[])],supportMatrix:Array.from(model.modelMatrix),sameSupport:window.__r2Support===model}
     })
     await page.evaluate(()=>{delete window.__r2Support})
     const before=await stable(),modes=[]
     for(const [name,button] of [['full','task-cut-toggle'],['geology','task-cut-geology'],['structure','task-cut-structure']]){
       await page.getByTestId(button).click();await page.waitForTimeout(500)
       const actual=await inspect(),identity=await stable()
       if(identity.taskId!==before.taskId||!identity.sameSupport||JSON.stringify(identity.supportMatrix)!==JSON.stringify(before.supportMatrix)||identity.camera.some((value,i)=>Math.abs(value-before.camera[i])>(i<3?1e-6:1e-12)))throw Error('Strategy changed task, camera or support geometry: '+JSON.stringify({before,identity,name}))
       modes.push({name,actual})
       await page.screenshot({path:`${root}/${c.id}-${name}-fixed-camera.png`})
       await page.screenshot({path:`${root}/${c.id}-${name}-comparison.png`,clip:{x:320,y:100,width:680,height:680}})
     }
     if(!(modes[0].actual.cut.ymin===modes[1].actual.cut.ymin&&modes[2].actual.cut.ymin>modes[1].actual.cut.ymin&&modes[0].actual.cut.xmax>modes[1].actual.cut.xmax))throw Error('Strategies did not preserve context or open the near end')
     await page.getByTestId('task-cut-toggle').click();await page.waitForTimeout(300)
     const measure=()=>page.evaluate(async()=>{
       const {viewerService}=await import('/src/platform/viewer/ViewerService.ts'),{getActiveModelerSupportModel}=await import('/src/modules/support/modeler-resources.ts'),{getTaskVolumeCutState}=await import('/src/platform/tasks/TaskVolumeCut.ts')
       const v=viewerService.require(),C=window.Cesium,s=getActiveModelerSupportModel('support.modeler-zz-va').boundingSphere
       const pixel=v.camera.frustum.getPixelDimensions(v.canvas.clientWidth,v.canvas.clientHeight,C.Cartesian3.distance(v.camera.positionWC,s.center),1,new C.Cartesian2())
       return {cut:getTaskVolumeCutState(),projectedSphereDiameterPx:2*s.radius/pixel.y,measurement:'sphere-center-plane-approximation-not-visible-pixels'}
     })
     const combinedBefore={identity:await stable(),measure:await measure()}
     await page.screenshot({path:`${root}/${c.id}-combined-before.png`})
     await page.getByTestId('task-view-support-context').click()
     await page.waitForTimeout(500)
     const combinedAfter={identity:await stable(),measure:await measure()}
     if(combinedAfter.measure.projectedSphereDiameterPx<=combinedBefore.measure.projectedSphereDiameterPx||combinedAfter.measure.cut.ymin!==.2||JSON.stringify(combinedAfter.identity.supportMatrix)!==JSON.stringify(combinedBefore.identity.supportMatrix))throw Error('Combined strategy did not enlarge focus or changed source geometry')
     await page.screenshot({path:`${root}/${c.id}-combined-after.png`})
     const focusStyle=await page.evaluate(async()=>{const C=window.Cesium,{getActiveModelerSupportModel}=await import('/src/modules/support/modeler-resources.ts');const model=getActiveModelerSupportModel('support.modeler-zz-va');const before={color:model.color?C.Color.pack(model.color,[]):null,blendMode:model.colorBlendMode,blendAmount:model.colorBlendAmount,silhouetteSize:model.silhouetteSize,silhouetteColor:C.Color.pack(model.silhouetteColor,[]),lightColor:model.lightColor?C.Cartesian3.pack(model.lightColor,[]):null};window.__restoreFocusStyle=()=>{model.color=before.color?C.Color.unpack(before.color):undefined;model.colorBlendMode=before.blendMode;model.colorBlendAmount=before.blendAmount;model.silhouetteSize=before.silhouetteSize;model.silhouetteColor=C.Color.unpack(before.silhouetteColor);model.lightColor=before.lightColor?C.Cartesian3.unpack(before.lightColor):undefined};model.color=C.Color.fromCssColorString('#fff0bf');model.colorBlendMode=C.ColorBlendMode.MIX;model.colorBlendAmount=.45;model.lightColor=new C.Cartesian3(2,2,2);model.silhouetteColor=C.Color.fromCssColorString('#ffd479');model.silhouetteSize=2;const {viewerService}=await import('/src/platform/viewer/ViewerService.ts');viewerService.require().scene.requestRender();return before})
     for(let frame=0;frame<3;frame++){await page.evaluate(async()=>{const {viewerService}=await import('/src/platform/viewer/ViewerService.ts');viewerService.require().scene.requestRender()});await page.waitForTimeout(200)}
     await page.screenshot({path:`${root}/${c.id}-emphasis.png`})
     const styledIdentity=await stable()
     if(JSON.stringify(styledIdentity.supportMatrix)!==JSON.stringify(combinedAfter.identity.supportMatrix)||styledIdentity.camera.some((n,i)=>Math.abs(n-combinedAfter.identity.camera[i])>(i<3?1e-6:1e-12)))throw Error('Style changed source placement or camera')
     await page.evaluate(async()=>{window.__restoreFocusStyle();const {viewerService}=await import('/src/platform/viewer/ViewerService.ts');viewerService.require().scene.requestRender()})
     report.cases.push({id:c.id+'-focus-style-ablation',before:focusStyle,style:{lightColor:[2,2,2],silhouetteSize:2,silhouetteColor:'#ffd479'},scope:'prototype-appearance-only-not-risk-or-material-change'})
     await page.evaluate(async()=>{const {taskVisualReview,restoreTaskVisualReview}=await import('/src/platform/tasks/TaskVisualReview.ts');restoreTaskVisualReview(taskVisualReview.value.plan.taskId)})
     await page.waitForTimeout(300)
     const combinedRestored={identity:await stable(),measure:await measure()}
     if(JSON.stringify(combinedRestored.measure.cut)!==JSON.stringify(combinedBefore.measure.cut)||combinedRestored.identity.camera.some((n,i)=>Math.abs(n-combinedBefore.identity.camera[i])>(i<3?1e-6:1e-12)))throw Error('Combined camera/cut restoration failed')
     report.cases.push({id:c.id+'-combined-local-context',before:combinedBefore,after:combinedAfter,restored:combinedRestored})
     await page.getByTestId('task-cut-structure').click()
     report.cases.push({id:c.id+'-fixed-camera-strategies',modes,stable:before,scope:'display-clipping-not-geological-interface-or-occlusion-measurement'})

     await page.getByTestId('task-cut-toggle').click();await page.waitForTimeout(200);full=await inspect()
     if(full.edges!==12||full.domain.dimensionsM[0]<=initial.domain.dimensionsM[0]||full.tool.ranges[0][1]!==full.domain.ranges[0][1])throw Error('Cut feedback/border did not follow actual bounds')
     await page.getByTestId('task-view-overview').click();await page.waitForTimeout(200)
     await page.screenshot({path:`${root}/${c.id}-full.png`})
     await page.getByTestId('task-cut-toggle').click();await page.waitForTimeout(100)
     const again=await inspect();if(JSON.stringify(again.domain)!==JSON.stringify(initial.domain))throw Error('Repeated clipping changed sampling transform')
   }
   report.cases.push({id:c.id,initial,full})
 }
 await page.locator('.agent-input').fill('复位当前任务场景');await page.locator('.agent-input').press('Enter')
 await wait(async()=>await page.locator('.agent-assembly-info').count()===0)
 const released=await page.evaluate(async()=>{const {getTaskVolumeDomain}=await import('/src/platform/tasks/TaskVolumeCut.ts'),{viewerService}=await import('/src/platform/viewer/ViewerService.ts');return {domain:!!getTaskVolumeDomain(),edges:viewerService.require().entities.values.filter(e=>e.properties?.taskVolumeDomain).length}})
 if(released.domain||released.edges||report.errors.length||report.modelRequests)throw Error(`Release or page error: ${JSON.stringify(released)}`)
 report.released=released;report.passed=true
 if(report.configRequests.some(url=>url.includes('/tsp_new/')))throw Error('Registered task was replaced by an obsolete database volume URL')
}catch(e){report.failure=e.message;if(page)await page.screenshot({path:`${root}/failure.png`}).catch(()=>{});throw e}
finally{await writeFile(`${root}/report.json`,JSON.stringify(report,null,2));await browser.close()}
