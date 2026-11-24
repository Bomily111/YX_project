import {chromium} from 'playwright-core'
import {mkdir,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'

const online=process.env.VERIFY_ONLINE_TASK==='1'
const verifyContext=process.env.VERIFY_HANDOVER_CONTEXT==='1'
const orderedReview=online&&process.env.VERIFY_ORDERED_REVIEW==='1'
const root=process.env.VERIFICATION_OUTPUT||'docs/verification/2026-11-19-original-support-page'
const app='http://localhost:5178'
const mileage=process.env.VERIFY_TASK_MILEAGE||'YK2+244'
const task=`班前要交底 ${mileage} 三台阶开挖与后方初支。班组需要确认开挖面与后方支护的相对位置。请用本次指定的 ZZ-Va 后方 5 米示意段完成装配，${orderedReview?'先看整体关系，保留三台阶和后方支护，再切到钢拱架细部，暂避混凝土外壳':'保留三台阶整体参照，暂避遮住钢拱架的混凝土外壳'}。最后说明哪些布置可以核对，哪些需要设计或实测。请直接执行。`
const original='/support-modeler/outputs/master_demo/ZZ-Va_support_1m_current.glb'
const report={online,passed:false,requests:[],errors:[],modelRequests:0,checks:[]}
await mkdir(root,{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--enable-webgl','--use-gl=angle','--use-angle=d3d11']})
const page=await browser.newPage({viewport:{width:1440,height:900}})
page.on('pageerror',e=>report.errors.push(e.message))
page.on('request',r=>{
 const pathname=new URL(r.url()).pathname
 if(pathname.endsWith('.glb')&&pathname.includes('support-modeler'))report.requests.push(pathname)
 if(pathname==='/api/ai-agent/chat')report.modelRequests++
})
await page.route(app+'/api/**',route=>{
 const url=new URL(route.request().url());url.port='3000'
 return route.continue({url:url.toString()})
})
const read=()=>page.evaluate(async()=>{
 const {getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts')
 const {resourceRegistry}=await import('/src/platform/resources/ResourceRegistry.ts')
 const {taskVisualReview}=await import('/src/platform/tasks/TaskVisualReview.ts')
 const {viewerService}=await import('/src/platform/viewer/ViewerService.ts')
 const id='support.test-section'
 const status=getTaskWorkflowController().getStatus(),targets=resourceRegistry.get(id)?.getEnhanceTargets()??[]
 const models=targets.map(t=>t.object),summary=targets[0]?.metadata
 const excavation=resourceRegistry.get('rock.three-bench')?.getEnhanceTargets()[0]
 const viewer=viewerService.require()
 return {status:status.status,taskId:status.taskId,ids:status.lastCompletedStage?.assembledResourceIds,
  source:resourceRegistry.get(id)?.getActiveAssetPaths(),summary,
  excavation:excavation&&{source:excavation.metadata.sourceReferenceChainage,target:excavation.metadata.taskReferenceChainage,matrix:Array.from(excavation.object.modelMatrix)},
  targets:targets.map(t=>({original:t.metadata.originalGeometry,generated:t.metadata.generatedGeometry})),
  context:viewer.entities.values.filter(e=>e.label?.text?.getValue().startsWith('后方初支')||e.label?.text?.getValue().startsWith('前方  ')).map(e=>({text:e.label.text.getValue(),show:e.show})),
  background:viewer.scene.backgroundColor.toCssColorString(),
  models:models.map(model=>({ready:model.ready,arch:model.getNode('steelArchArrayGroup')?.show,
   concrete:model.getNode('primarySupportConcreteGroup')?.show,lining:model.getNode('secondaryLiningGroup')?.show,
   anchors:model.getNode('systemAnchorGroup')?.show,
   matrix:Array.from(model.modelMatrix)})),phase:taskVisualReview.value?.phase,attempts:taskVisualReview.value?.attempts}
})
try{
 await page.goto(app,{waitUntil:'domcontentloaded'})
 await page.locator('.agent-fab').click()
 if(online){
  await page.locator('.agent-input').fill(task)
  await page.locator('.agent-input').press('Enter')
  await page.locator('.agent-messages .msg-row.assistant .feedback-row').first().waitFor({timeout:100000})
  await page.locator('.agent-input').fill('等待当前任务完成')
  await page.waitForFunction(()=>!document.querySelector('.send-btn')?.disabled,{},{timeout:100000})
  await page.locator('.agent-input').fill('')
  report.replies=await page.locator('.agent-messages .msg-row.assistant').allTextContents()
  if(/余额不足/.test(report.replies.join(' ')))throw Error('模型服务余额不足')
 }else{
  await page.getByRole('button',{name:'表单',exact:true}).click()
  const form=page.locator('.chat-task-form')
  await form.getByLabel('任务类型').selectOption('scene-exploration')
  await form.getByLabel('任务目标').fill(task)
  await form.getByLabel('目标里程').fill(mileage)
  await form.getByLabel('隧洞').locator('option').nth(1).waitFor({state:'attached',timeout:30000})
  await form.getByLabel('隧洞').selectOption({index:1})
  while(await form.getByRole('button',{name:'移除',exact:true}).count())await form.getByRole('button',{name:'移除',exact:true}).first().click()
  for(const id of ['rock.three-bench','support.test-section']){
   await form.getByLabel('追加场景资源').selectOption(id)
   await form.getByRole('button',{name:'添加阶段',exact:true}).click()
  }
  await form.getByLabel('支护长度（米）').fill('5')
  await form.getByRole('button',{name:'校验并创建计划',exact:true}).click()
  await page.getByRole('button',{name:'自主执行剩余步骤',exact:true}).click()
 }
 await page.getByTestId('task-purpose').waitFor({timeout:45000})
 const assembled=await read()
 report.checks.push({id:'original-source-and-task-first-panel',assembled})
 assert.equal(assembled.status,'completed')
 assert.deepEqual(assembled.ids,['rock.three-bench','support.test-section'])
 assert.deepEqual(assembled.source,[original])
 assert.equal(assembled.models.length,5)
 assert.deepEqual(assembled.summary.unitOffsetsM,[-5.5,-4.5,-3.5,-2.5,-1.5])
 assert(assembled.models.every(m=>m.ready&&typeof m.arch==='boolean'))
 assert(assembled.targets.every(t=>t.original===true&&t.generated===false))
 assert(report.requests.includes(original)&&report.requests.every(path=>path===original))
 assert.equal(await page.locator('.agent-assembly-info button, .agent-assembly-info input').count(),0)
 if(verifyContext){
  const target=Number(mileage.replace(/\D/g,''))
  assert.equal(assembled.excavation.source,2244)
  assert.equal(assembled.excavation.target,target)
  assert.equal(assembled.summary.taskReferenceChainage,target)
  assert.equal(assembled.context.filter(item=>item.show).length,orderedReview?0:2)
 }
 await page.screenshot({path:root+'/assembled.png'})
 if(!online){
  await page.evaluate(async request=>{
   const {executeTool}=await import('/src/ai-agent/ToolRegistry.ts')
   const {getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts')
   const goal=JSON.parse(await executeTool('plan_task_visual_review',{objective:'spatial-relation',focusResourceIds:['support.test-section'],focusComponent:'steel_arch',questions:['保留三台阶参照时能看到哪些钢架布置？'],userRequest:request}))
   if(!goal.ok)throw Error(JSON.stringify(goal))
   const result=JSON.parse(await executeTool('apply_task_visual_review',{taskId:getTaskWorkflowController().getStatus().taskId}))
   if(!result.ok)throw Error(JSON.stringify(result))
  },task)
 }
 const enhanced=await read()
 assert.equal(enhanced.phase,'applied')
 if(orderedReview){
  assert.equal(enhanced.attempts,2)
  assert(enhanced.models.every(m=>m.anchors===false))
  assert.equal(report.replies.length,1)
  assert(!report.replies[0].includes('下一步建议'))
 }
 assert(enhanced.models.every(m=>m.arch===true&&m.concrete===false&&m.lining===false))
 assert.deepEqual(enhanced.models.map(m=>m.matrix),assembled.models.map(m=>m.matrix))
 report.checks.push({id:'tool-executes-component-observation',enhanced})
 await page.screenshot({path:root+'/enhanced.png'})
 if(!online){
  if(verifyContext){
   await page.evaluate(async request=>{
    const {executeTool}=await import('/src/ai-agent/ToolRegistry.ts')
    const result=JSON.parse(await executeTool('plan_task_visual_review',{objective:'component-detail',focusResourceIds:['support.test-section'],focusComponent:'steel_arch',questions:['只观察钢拱架组时，原始单元内的钢架是否容易分辨？'],userRequest:request}))
    if(!result.ok)throw Error(JSON.stringify(result))
    const detail=JSON.parse(await executeTool('apply_task_visual_review',{taskId:result.taskId}))
    if(!detail.ok)throw Error(JSON.stringify(detail))
   },task)
   const detail=await read()
   assert(detail.models.every(m=>m.arch&&m.anchors===false))
   assert.deepEqual(detail.models.map(m=>m.matrix),assembled.models.map(m=>m.matrix))
   report.checks.push({id:'isolated-component-with-original-poses',detail})
   await page.screenshot({path:root+'/detail.png'})
  }
  await page.evaluate(async taskId=>{
   const {executeTool}=await import('/src/ai-agent/ToolRegistry.ts')
   const result=JSON.parse(await executeTool('restore_task_visual_review',{taskId}))
   if(!result.ok)throw Error(JSON.stringify(result))
  },enhanced.taskId)
  assert.deepEqual((await read()).models,assembled.models)
  if(verifyContext){
   await page.evaluate(async()=>{
    const {executeTool}=await import('/src/ai-agent/ToolRegistry.ts')
    const result=JSON.parse(await executeTool('set_task_view',{view:'geographic'}))
    if(!result.ok)throw Error(JSON.stringify(result))
   })
   await page.screenshot({path:root+'/geographic.png'})
   const geographic=await read()
   assert(geographic.context.length===2&&geographic.context.every(item=>!item.show))
   assert.notEqual(geographic.background,assembled.background)
   report.checks.push({id:'geographic-restores-main-background',geographic})
  }
 }
 if(process.env.VERIFY_ORIGINAL_SPANS==='1'){
  for(const fixture of [
   {id:'support.modeler-continuous-zz-va-10m',count:10,paths:[original]},
   {id:'support.alternating-zz-va-z-pm',count:50,paths:[original,'/support-modeler/outputs/master_demo/Z-PM_support_1m_partial.glb']},
  ]){
   const current=await page.evaluate(async id=>{
    const {getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts')
    const {resourceRegistry}=await import('/src/platform/resources/ResourceRegistry.ts')
    const controller=getTaskWorkflowController()
    const planned=await controller.prepareScene({description:'核对原支护单元连续装配',targetMileage:'YK1+346',resourceIds:[id],enhanceAfterAssembly:true})
    if(!planned.prepared||planned.notice?.type==='error')throw Error(JSON.stringify(planned.notice))
    const result=await controller.runAll()
    const resource=resourceRegistry.get(id),targets=resource.getEnhanceTargets()
    return {status:result.status,notice:result.notice,paths:resource.getActiveAssetPaths(),
      count:targets.length,allOriginal:targets.every(t=>t.object.ready&&t.metadata.originalGeometry===true)}
   },fixture.id)
   assert.equal(current.status,'completed',JSON.stringify(current.notice))
   assert.deepEqual(current.paths,fixture.paths)
   assert.equal(current.count,fixture.count)
   assert.equal(current.allOriginal,true)
   report.checks.push({id:fixture.id,current})
  }
  await page.screenshot({path:root+'/alternating-original.png'})
 }
 assert.deepEqual(report.errors,[])
 report.passed=true
}catch(error){
 report.failure=String(error)
 await page.screenshot({path:root+'/failure.png'}).catch(()=>{})
 throw error
}finally{
 await writeFile(root+'/report.json',JSON.stringify(report,null,2))
 await browser.close()
}
