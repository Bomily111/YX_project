import {chromium} from 'playwright-core'
import {mkdir,writeFile} from 'node:fs/promises'
const root='docs/verification/2026-11-18-station-picking'
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
 await page.getByTestId('task-view-geographic').click()
 await page.getByTestId('support-layout').locator(':scope > summary').click()
 const entry=await read()
 await page.getByTestId('support-station-1').click()
 const station=await read()
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
 if(afterPick.camera.some((v,i)=>Math.abs(v-beforePick.camera[i])>(i<3?1e-6:1e-12)))throw Error('3D selection unexpectedly moved camera')
 const evidence=await page.evaluate(async()=>{const {inspectTaskEvidenceJournal}=await import('/src/platform/tasks/TaskEvidenceJournal.ts'),{getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts');return inspectTaskEvidenceJournal(getTaskWorkflowController().getStatus().taskId)})
 if(evidence.at(-1)?.source!=='3d'||evidence.at(-1).offsetM!==pick.offset)throw Error('Actual 3D click did not generate matching evidence')
 const component=page.getByTestId('support-layout-component'),options=await component.locator('option').evaluateAll(els=>els.map(e=>({value:e.value,text:e.textContent})))
 const initialRow=await component.inputValue(),next=options.find(o=>o.value!==initialRow)
 await component.selectOption(next.value)
 if(!(await page.getByTestId('support-station-selection').innerText()).includes('选择图中站位')||await page.getByTestId('support-review-history').count())throw Error('Component switch retained the old selection/history')
 const oldFact=await page.getByTestId('support-evidence-assessment').innerText()
 if(!oldFact.includes('本行尚无保留的交互事实'))throw Error('Component switch reused old-row facts')
 await component.selectOption(initialRow)
 if(!(await page.getByTestId('support-evidence-assessment').innerText()).includes('交互事实'))throw Error('Returning component lost task evidence')
 await page.screenshot({path:`${root}/3d-selection.png`})
 report.checks.push({id:'actual-3d-pick-and-component-isolation',pick,beforePick,afterPick,evidence,options})
 report.checks.push({id:'geographic-station-return',entry,station,restored,refit})
 await send('复位当前任务场景')
 if(report.errors.length||modelRequests)throw Error('Page error or unexpected model request')
 report.modelRequests=modelRequests;report.passed=true
}catch(e){report.failure=e.message;if(page)await page.screenshot({path:`${root}/failure.png`}).catch(()=>{});throw e}
finally{await writeFile(`${root}/report.json`,JSON.stringify(report,null,2));await browser.close()}