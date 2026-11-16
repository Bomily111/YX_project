import {chromium} from 'playwright-core'
import {mkdir,writeFile} from 'node:fs/promises'
const root='docs/verification/2026-11-16-local-plan-rejection'
await mkdir(root,{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--enable-webgl','--use-gl=angle','--use-angle=d3d11']})
const report={passed:false,modelRequests:0,errors:[]}
let page
const wait=async fn=>{const end=Date.now()+90000;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,250))}throw Error('Local rejection test timeout')}
try{
 page=await browser.newPage({viewport:{width:1400,height:900}})
 page.on('pageerror',e=>report.errors.push(e.message))
 page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/ai-agent/chat'))report.modelRequests++})
 await page.route('http://localhost:5178/api/**',route=>{const u=new URL(route.request().url());u.port='3000';return route.continue({url:u.toString()})})
 await page.goto('http://localhost:5178',{waitUntil:'domcontentloaded'});await page.locator('.agent-fab').click()
 const prepare=async(ids,description)=>{
   await page.getByRole('button',{name:'表单',exact:true}).click()
   const form=page.locator('.chat-task-form')
   await form.getByLabel('任务类型').selectOption('scene-exploration');await form.getByLabel('任务目标').fill(description);await form.getByLabel('目标里程').fill('YK2+244')
   await wait(async()=>await form.getByLabel('隧洞').locator('option').count()>1);await form.getByLabel('隧洞').selectOption({index:1})
   while(await form.getByRole('button',{name:'移除',exact:true}).count())await form.getByRole('button',{name:'移除',exact:true}).first().click()
   for(const id of ids){await form.getByLabel('追加场景资源').selectOption(id);await form.getByRole('button',{name:'添加阶段',exact:true}).click()}
   if(ids.includes('support.test-section'))await form.getByLabel('支护长度（米）').fill('5')
   await form.getByRole('button',{name:'校验并创建计划',exact:true}).click()
 }
 await prepare(['rock.three-bench','support.test-section'],'三台阶与后方5米ZZ-Va示意核对')
 await page.getByRole('button',{name:'自主执行剩余步骤',exact:true}).click()
 await wait(async()=>await page.locator('.agent-assembly-info').count()>0)
 const before=await page.evaluate(async()=>{
   const {getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts'),{getTestSectionSupportModels}=await import('/src/modules/support/test-section-resource.ts')
   window.__localRejectModels=getTestSectionSupportModels()
   return getTaskWorkflowController().getStatus().taskId
 })
 await prepare(['rock.tsp-hardness','rock.tem-resistivity'],'验证不兼容资料组合拒绝后保留原场景')
 await wait(async()=>await page.locator('.agent-messages .msg-row.assistant').last().innerText().then(t=>t.includes('校验未通过')))
 const preserved=await page.evaluate(async id=>{
   const {getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts'),{getTestSectionSupportModels}=await import('/src/modules/support/test-section-resource.ts')
   const models=getTestSectionSupportModels()
   return getTaskWorkflowController().getStatus().taskId===id&&models.length===window.__localRejectModels.length&&models.every((m,i)=>m===window.__localRejectModels[i]&&!m.isDestroyed())
 },before)
 if(!preserved)throw Error('Invalid form replacement changed the prior task or models')
 report.rejectedReplacementPreservedTaskAndModels=true
 await page.getByRole('button',{name:'表单',exact:true}).click()
 await page.locator('.agent-input').fill('复位当前任务场景，无需确认，不要重新装配');await page.locator('.agent-input').press('Enter')
 await wait(async()=>await page.locator('.agent-assembly-info').count()===0)
 const released=await page.evaluate(async()=>{
   const {resourceManager}=await import('/src/platform/resources/ResourceManager.ts'),{getTestSectionSupportModels}=await import('/src/modules/support/test-section-resource.ts'),{getActiveThreeBenchModel}=await import('/src/modules/rock/three-bench-resource.ts')
   return {supports:getTestSectionSupportModels().length,bench:!!getActiveThreeBenchModel(),taskLoaded:resourceManager.listStates().filter(s=>s.status==='loaded'&&s.id!=='common.tunnel').map(s=>s.id)}
 })
 if(released.supports||released.bench||released.taskLoaded.length||report.modelRequests||report.errors.length)throw Error(`Local cleanup failed: ${JSON.stringify(released)}`)
 report.released=released;report.passed=true
 await page.screenshot({path:`${root}/reset-after-rejection.png`})
}catch(e){report.failure=e.message;if(page)await page.screenshot({path:`${root}/failure.png`}).catch(()=>{});throw e}
finally{await writeFile(`${root}/report.json`,JSON.stringify(report,null,2));await browser.close()}
