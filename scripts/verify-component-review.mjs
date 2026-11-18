import {chromium} from 'playwright-core'
import {mkdir,writeFile} from 'node:fs/promises'
const root='docs/verification/2026-11-18-component-review'
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
 await page.getByTestId('task-view-support').click()
 const nodes=()=>page.evaluate(async()=>{
  const {getTestSectionSupportModels,getTestSectionSupportSummaries}=await import('/src/modules/support/test-section-resource.ts')
  const groups=getTestSectionSupportSummaries(['support.test-section'])[0].groups,models=getTestSectionSupportModels(['support.test-section'])
  return {matrix:Array.from(models[0].modelMatrix),states:groups.map(g=>({name:g.name,component:g.component,show:models[0].getNode(g.name).show}))}
 })
 await page.getByTestId('support-layer-steel_arch').uncheck()
 await page.getByTestId('support-layer-secondary_lining').check()
 const original=await nodes()
 await page.getByTestId('support-component-reveal').click()
 const focused=await nodes()
 if(!focused.states.filter(n=>n.component==='steel_arch').every(n=>n.show)||focused.states.filter(n=>['primary_concrete','secondary_lining'].includes(n.component)).some(n=>n.show)||JSON.stringify(focused.matrix)!==JSON.stringify(original.matrix))throw Error('Component focus did not reveal target and avoid shells')
 await page.screenshot({path:`${root}/revealed.png`})
 await page.getByTestId('support-component-restore').click()
 if(JSON.stringify(await nodes())!==JSON.stringify(original))throw Error('Restore lost custom visibility')
 await page.getByTestId('support-component-reveal').click()
 const select=page.getByTestId('support-layout-component'),option=await select.locator('option').evaluateAll(els=>els.map(e=>e.value))
 await select.selectOption(option.find(v=>!v.endsWith(':steel_arch')))
 if(JSON.stringify(await nodes())!==JSON.stringify(original)||await page.getByTestId('support-component-review-note').count())throw Error('Component switch retained the temporary reveal')
 report.checks.push({id:'component-focus-and-exact-restore',original,focused})
 report.checks.push({id:'geographic-station-return',entry,station,restored,refit})
 await send('复位当前任务场景')
 if(report.errors.length||modelRequests)throw Error('Page error or unexpected model request')
 report.modelRequests=modelRequests;report.passed=true
}catch(e){report.failure=e.message;if(page)await page.screenshot({path:`${root}/failure.png`}).catch(()=>{});throw e}
finally{await writeFile(`${root}/report.json`,JSON.stringify(report,null,2));await browser.close()}