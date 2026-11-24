import { chromium } from 'playwright-core'
import { mkdir, writeFile } from 'node:fs/promises'
const root = process.env.ACCEPTANCE_OUTPUT_DIR || 'docs/verification/acceptance-2026-11-05'
await mkdir(root, { recursive: true })
const app = process.env.BROWSER_APP_URL || 'http://localhost:5178'
const selectedCases = process.env.ACCEPTANCE_CASE_IDS?.split(',')
const cases = [
  {id:'workface-backing-preview',request:'请在 YK2+244 直接装配三维掌子面加厚示意模型，保留原岩面，在它背后加厚一段。',roots:['rock.workface-backing-preview']},
  {id:'axial-fan-with-flow',request:'为 YK4+000 施工送风布置交底，请同屏装配轴流风机和已有稳态风场，风机出风端朝里程增大方向。请把风筒接口和风机近景显示清楚，既有风场仅作为方向参照。',roots:['ventilation.axial-fan','ventilation.steady-cfd'],fan:{chainage:4000,sign:1}},
  {id:'axial-fan-reversed',request:'为 YK2+244 施工送风布置交底，请仅装配一台轴流风机，出风端朝里程减小方向。请标出风筒接口，便于班组确认设备朝向。',roots:['ventilation.axial-fan'],fan:{chainage:2244,sign:-1}},
  {id:'axial-fan-with-duct',request:'为 YK4+000 的施工送风接装交底，请装配一台轴流风机，在它的出风法兰接上已有4米柔性风筒实体。两者沿中线布置，出风端朝里程增大方向，让班组看清法兰和接缝。',roots:['ventilation.axial-fan','ventilation.axial-fan-duct'],fan:{chainage:4000,sign:1}},
  {id:'ceiling-jet-fan',request:'为 YK4+000 的洞内纵向通风交底，请装配一台洞顶吊装射流风机，沿隧道轴线布置，出风朝里程增大方向，从下方近景看清吊架和机筒。',roots:['ventilation.ceiling-jet-fan']},
  {id:'three-module-post-blast',request:'为 YK4+000 爆后通风复核准备同屏场景。请装配该工段设计围岩分级、已有爆后点云、稳态风场与一台洞顶射流风机，风机在开挖基准后方12米，出风朝里程增大方向。重点看爆后轮廓，只看爆后点云，保留局部风向与地质分级参照，供班组确定核查对象。',roots:['rock.design-grade','blast.effect','ventilation.steady-cfd','ventilation.ceiling-jet-fan'],jetStation:3988},
  {id:'three-module-support',request:'为 YK2+244 初支与通风设备交底装配前方三台阶、后方10米原版ZZ-Va初期支护和一台洞顶吊装射流风机。风机布置在开挖基准后方14米，出风朝里程增大方向。用隧道侧剖同屏看清台阶、支护边界和风机位置，请保留原版构件。',unitCount:10,roots:['rock.three-bench','support.test-section','ventilation.ceiling-jet-fan'],jetStation:2230},
  {id:'tunnel-side-section',request:'为 YK2+244 的班前施工交底装配前方三台阶与后方5米ZZ-Va初期支护，采用隧道侧面剖切展示，让班组能同时看清台阶和后方初支的空间关系。',unitCount:5,roots:['rock.three-bench','support.test-section']},
  {id:'native-workface-surface',request:'YK2+244 班前地质交底，请直接装配历史带纹理的三维掌子面和邻近岩壁网格，作为示意观察。不要平面照片。',roots:['rock.workface-surface']},
  {id:'native-gpr',request:'请直接执行 YK2+244 围岩交底，仅装配已有三维地质雷达原模型，保留原始几何和材质。不要二维测线。',roots:['rock.gpr-model']},
  {id:'native-tem',request:'请在 YK2+244 装配已有 TEM 异常体的当前版本三维 GLB，仅展示原实体模型。',roots:['rock.tem-anomaly-model']},
  {id:'native-tem-archive',request:'请在 YK2+244 装配已有 TEM 异常体的历史版本三维 GLB，仅展示历史原实体。',roots:['rock.tem-anomaly-model-archive']},
  {id:'native-tem-absolute',request:'请在 YK2+244 装配 TEM 原始绝对电阻率体素，使用源体素文件。',roots:['rock.tem-resistivity-absolute']},
  {id:'face-original-source',request:'为 YK2+244 班前地质交底，请装配来源 X1DK2+905.0 的已有掌子面照片，明确标出照片来源。',roots:['rock.face-photo-2905-0']},
  ...[['885.4','2885-4'],['892.6','2892-6'],['900.0','2900-0']].map(([source,key])=>({id:`face-source-${key}`,request:`在 YK2+244 装配来源 X1DK2+${source} 的原有掌子面照片，保留来源。`,roots:[`rock.face-photo-${key}`]})),


  { id:'followup-base',request:'在论文测试工段展示三台阶和后方5米ZZ-Va支护，不用其他资料。',unitCount:5,roots:['rock.three-bench','support.test-section'] },
  {id:'location-inspection',request:'只读读取当前任务核查摘要，按观察事实、证据缺口和下一步核查回答，并引用实际事实ID。说明二维和三维访问过哪些站位，不要重新装配。',reject:true},
  { id:'followup-type',request:'把支护改成ZZ-IVb',followup:true,unitCount:5,roots:['rock.three-bench','support.test-section-zz-ivb'] },
  { id:'followup-length',request:'长度改为15米',followup:true,unitCount:15,roots:['rock.three-bench','support.test-section-zz-ivb'] },
  { id:'followup-both',request:'把支护改成Z-PM，长度改为8米',followup:true,unitCount:8,roots:['rock.three-bench','support.test-section-z-pm'] },
  { id:'followup-invalid',request:'长度改为21米',reject:true },
  { id:'followup-unknown',request:'把支护改成ZZ-VI',reject:true },
  { id: 'support-length-5', request: '在论文测试工段同屏展示三台阶与后方5米ZZ-Va支护，不用其他资料。', unitCount: 5, roots: ['rock.three-bench','support.test-section'] },
  { id: 'support-length-20', request: '在论文测试工段同屏展示三台阶与后方20米ZZ-Va支护，不用其他资料。', unitCount: 20, roots: ['rock.three-bench','support.test-section'] },
  { id:'baseline-ivb-20',request:'在论文测试工段展示三台阶和后方20米ZZ-IVb支护，不用其他资料。',unitCount:20,roots:['rock.three-bench','support.test-section-zz-ivb'] },
  { id:'baseline-zpm-5',request:'在论文测试工段展示三台阶和后方5米Z-PM支护，不用其他资料。',unitCount:5,roots:['rock.three-bench','support.test-section-z-pm'] },
  { id:'baseline-zpm-20',request:'在论文测试工段展示三台阶和后方20米Z-PM支护，不用其他资料。',unitCount:20,roots:['rock.three-bench','support.test-section-z-pm'] },
  { id: 'support-length-fraction', request: '在论文测试工段同屏展示三台阶与后方2.5米ZZ-Va支护。', reject: true },
  { id: 'support-length-outside', request: '在论文测试工段同屏展示三台阶与后方21米ZZ-Va支护。', reject: true },
  { id: 'three-bench-support-zpm', request: '在论文测试工段同屏展示三台阶和后方Z-PM模型，使用已有10个1米单元，不要其他资料。', roots: ['rock.three-bench', 'support.test-section-z-pm'] },
  { id: 'zpm-section', request: '在论文测试工段单独展示Z-PM一米断面模型，不用其他类型。', roots: ['support.modeler-z-pm'] },
  { id: 'three-bench-support', request: '在论文测试工段，同屏展示三台阶和后方ZZ-Va支护的空间关系，使用示意参数，不用照片。', roots: ['rock.three-bench', 'support.test-section'] },
  { id: 'three-bench-support-ivb', request: '在论文测试工段同屏展示三台阶与后方ZZ-IVb支护，使用10个已有1米单元，不要照片。', roots: ['rock.three-bench', 'support.test-section-zz-ivb'] },
  { id: 'three-bench-support-ii', request: '在论文测试工段同屏展示三台阶与后方ZZ-II支护，使用10个已有1米单元，不要照片。', roots: ['rock.three-bench', 'support.test-section-zz-ii'] },
  { id: 'three-bench-support-clarified', request: '在论文测试工段展示三台阶与后方支护。', clarification: '支护类型用ZZ-IVb', roots: ['rock.three-bench', 'support.test-section-zz-ivb'] },
  { id: 'three-bench', request: '在论文测试工段展示三台阶开挖模型，使用示意参数，不要其他资料。', roots: ['rock.three-bench'] },
  { id: 'continuous-support', request: '从YK2+244起向里程增大方向，展示20米同类型ZZ-Va连续支护示意段；接受1米模板复用示意，不要交替类型或掌子面照片。', roots: ['support.modeler-continuous-zz-va-20m'] },
  { id: 'business-handover', request: '准备YK1+346施工交底场景，说明前方岩体完整性与ZZ-Va支护的空间关系。', roots: ['rock.tsp-integrity', 'support.modeler-zz-va'] },
  { id: 'business-clarified', request: '准备YK2+244初期支护交底场景。', clarification: '主要看前方岩体完整性与支护的关系，支护用ZZ-Va。', roots: ['rock.tsp-integrity', 'support.modeler-zz-va'] },
  { id: 'workface-support-drill', request: 'YK2+244 超前探测与支护施工交底，请同屏装配一张掌子面模型、ZZ-Va支护和现有水平钻模型，不要照片面板或物探体。', roots: ['rock.face-photos', 'support.modeler-zz-va', 'rock.advance-drill'] },
  { id: 'post-blast-airflow', request: 'YK4+000 爆后通风复核，请同屏展示右洞稳态风场与爆后点云，不用设计图。', roots: ['blast.effect', 'ventilation.steady-cfd'] },
  { id: 'post-blast-airflow-overview', request: 'YK4+000 同屏展示右洞稳态风场与爆后点云，查看完整200米风场范围，不要局部取景，不用设计图。', roots: ['blast.effect', 'ventilation.steady-cfd'] },
  { id: 'workface-radar', request: 'YK2+244 掌子面雷达复核，请装配一张掌子面模型并同屏查看GPR测线1处理剖面，不需要支护或其他物探。', roots: ['rock.face-photos', 'rock.gpr-line1'] },
  { id: 'thermal-200', request: 'YK4+000 展示热场模拟200秒时的右洞温度场和出口温度历程。', roots: ['ventilation.thermal-t200s'] },
  { id: 'fan-shutdown', request: 'YK4+000 风机故障停机复核，请调出对应瞬态风网曲线，不要默认爬升或稳态CFD。', roots: ['ventilation.transient-fan-shutdown'] },
  { id: 'design-only', request: 'YK1+346 炮孔施工交底，只调出二维设计和分类数量、进尺，不要爆后点云。', roots: ['blast.design-data'] },
  { id: 'rock-support', request: 'YK1+346 初期支护交底，请同屏展示岩体坚硬程度和新模块ZZ-Va支护，不需要掌子面照片。', roots: ['rock.tsp-hardness', 'support.modeler-zz-va'] },
  { id: 'unavailable-time', request: 'YK4+000 查看模拟250秒的温度场。', reject: true },
  { id: 'incompatible-layers', request: 'YK1+346 请同屏叠加TSP坚硬度和TEM视电阻率，不要分阶段。', reject: true },
  { id: 'repeat-at-new-station', request: 'YK4+000 施工交底，请同屏装配一张掌子面、ZZ-Va支护和现有超前水平钻模型，不要二维照片。', roots: ['rock.face-photos', 'support.modeler-zz-va', 'rock.advance-drill'] },
  { id: 'reset-scene', request: '复位当前任务场景，释放本次任务模型并恢复主场景。', reset: true },
  { id: 'followup-no-current', request:'长度改为5米', reject:true },
  { id: 'no-support-layers', request:'显示钢架', reject:true },
  { id: 'no-support-query', request:'当前支护有哪些构件', reject:true },
].filter(entry => !selectedCases || selectedCases.includes(entry.id))
if (!cases.length) throw new Error('No matching acceptance cases')
const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  args: process.env.ACCEPTANCE_HARDWARE_GPU==='1'?['--enable-webgl','--use-gl=angle','--use-angle=d3d11']:['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const report = { cases: [], errors: [], passed: false }
const wait = async (fn, timeout = 180000) => {
  const end = Date.now() + timeout
  while (Date.now() < end) { const value = await fn(); if (value) return value; await new Promise(resolve => setTimeout(resolve, 350)) }
  throw new Error('Acceptance condition timed out')
}
let page
try {
  page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  page.on('pageerror', error => report.errors.push(error.message))
  const taskIds = []
  const workfaceTextures=[]
  page.on('response',response=>{
    if(new URL(response.url()).pathname==='/data/workface-surface/texturedMesh.jpg')workfaceTextures.push(response.status())
  })
  page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/ai-agent/task-runs')) taskIds.push(request.postDataJSON().task.taskId) })
  await page.route(`${app}/api/**`, route => { const url = new URL(route.request().url()); url.port = '3000'; return route.continue({ url: url.toString() }) })
  await page.goto(app, { waitUntil: 'domcontentloaded' }); await page.locator('.agent-fab').click()
  const environment=()=>page.evaluate(async()=>{
    const {viewerService}=await import('/src/platform/viewer/ViewerService.ts'),v=viewerService.require(),s=v.scene
    window.__acceptanceCanvas??=v.canvas
    return {sameCanvas:window.__acceptanceCanvas===v.canvas,canvasCount:document.querySelectorAll('.cesium-widget canvas').length,background:[s.backgroundColor.red,s.backgroundColor.green,s.backgroundColor.blue,s.backgroundColor.alpha],globe:s.globe.show,skyBox:s.skyBox?.show,skyAtmosphere:s.skyAtmosphere?.show,sun:s.sun?.show,moon:s.moon?.show,fog:s.fog.enabled}
  })
  await page.waitForTimeout(2000)
  const originalEnvironment=await environment()
  const terrainState=()=>page.evaluate(async()=>{
    const {viewerService}=await import('/src/platform/viewer/ViewerService.ts')
    const {taskTerrainContextActive}=await import('/src/platform/tasks/TaskTerrainContext.ts')
    const t=viewerService.require().scene.globe.translucency
    return {enabled:t.enabled,front:t.frontFaceAlpha,back:t.backFaceAlpha,frontDistance:t.frontFaceAlphaByDistance,backDistance:t.backFaceAlphaByDistance,rectangle:t.rectangle,active:taskTerrainContextActive.value}
  })
  const originalTerrain=process.env.VERIFY_TASK_TERRAIN==='1'?await terrainState():undefined
  let lastRoots = []
  for (const entry of cases) {
    const beforeDisplay=process.env.VERIFY_SUPPORT_CONTINUITY==='1'?await page.evaluate(async()=>{const r=await import('/src/modules/support/test-section-resource.ts');return r.getTaskSupportLayers(r.getTestSectionSupportSummaries().map(s=>s.id))}):[]
    const started = Date.now(), beforeTasks = taskIds.length
    const beforeReplies = await page.locator('.agent-messages .msg-row.assistant').count()
    await page.locator('.agent-input').fill(entry.request); await page.locator('.agent-input').press('Enter')
    if (entry.clarification) {
      await wait(async () => (await page.locator('.agent-messages .msg-row.assistant').count()) > beforeReplies)
      await page.locator('.agent-input').fill('idle probe'); await wait(() => page.locator('.send-btn').isEnabled()); await page.locator('.agent-input').fill('')
      if (taskIds.length !== beforeTasks) throw new Error('Ambiguous business goal executed before clarification')
      await page.locator('.agent-input').fill(entry.clarification); await page.locator('.agent-input').press('Enter')
    }
    if (entry.reject || entry.reset) {
      await wait(async () => (await page.locator('.agent-messages .msg-row.assistant').count()) > beforeReplies, 60000)
      await new Promise(resolve => setTimeout(resolve, 1000))
      if (taskIds.length !== beforeTasks) throw new Error(`Non-assembly request created a task: ${entry.id}`)
    } else {
      await wait(() => taskIds.length > beforeTasks)
      const taskId = taskIds.at(-1)
      if (entry.followup) {
        const run = await fetch(`http://localhost:3000/api/ai-agent/task-runs/${taskId}`).then(response=>response.json())
        if (!run.run.description.includes(taskIds.at(-2))) throw new Error('后续任务未关联前一个实际任务')
      }
      let snapshotFailures=0
      const snapshot = await wait(async () => {
        const response=await fetch(`http://localhost:3000/api/ai-agent/task-runs/${taskId}/snapshots`)
        const snapshots = await response.json()
        if(!response.ok||!Array.isArray(snapshots)){if(++snapshotFailures>5)throw new Error(`Snapshot API failed ${response.status}: ${JSON.stringify(snapshots)}`);return null}
        const latest = snapshots.at(-1)
        if (latest?.workflow_state?.status === 'failed') throw new Error(`Task failed: ${JSON.stringify(latest.workflow_state)}`)
        return latest?.workflow_state?.status === 'completed' ? latest : null
      })
      const state = snapshot.workflow_state
      const final = state.sharedContext[`scene.stage.${state.total}`]?.value
      if (entry.unitCount && final.supportLengthM !== entry.unitCount) throw new Error('任务输出未保留指定支护长度')
      if (state.steps.at(-1).action !== 'scene.finalize' || final?.phase !== 'constructed-then-enhanced') throw new Error(`Missing final phase: ${entry.id}`)
      if (JSON.stringify([...final.assembledResourceIds].sort()) !== JSON.stringify([...entry.roots].sort())) throw new Error(`Wrong resources: ${entry.id}`)
      await wait(() => page.locator('.agent-assembly-run').innerText().then(text => text.includes(taskId)).catch(() => false))
      lastRoots = entry.roots
      report.cases.push({ id: entry.id, taskId, total: state.total, phase: final.phase, assets: snapshot.data_versions.map(value => value.locator), elapsedMs: Date.now() - started })
      if (entry.followup) report.cases.at(-1).parentTaskId = taskIds.at(-2)
    }
    await page.locator('.agent-input').fill('acceptance idle probe')
    await wait(() => page.locator('.send-btn').isEnabled(), 60000)
    await page.locator('.agent-input').fill('')
    if(entry.id==='location-inspection'){
      const response=await page.locator('.agent-messages .msg-row.assistant').last().innerText()
      const factIds=await page.evaluate(async()=>{const {getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts');const {assessTaskEvidence}=await import('/src/platform/tasks/TaskEvidenceAssessment.ts');const s=getTaskWorkflowController().getStatus();return assessTaskEvidence(s.taskId,s.lastCompletedStage.assembledResourceIds).facts.map(f=>f.id)})
      const cited=response.match(/scene-[\w-]+:(?:location|step):\d+/g)??[]
      if(!cited.length||cited.some(id=>!factIds.includes(id)))throw Error('核查摘要没有引用实际事实ID或引用了旧任务')
      const audit=await fetch(`http://localhost:3000/api/ai-agent/task-runs/${taskIds.at(-1)}`).then(r=>r.json())
      if(!audit.events?.some(e=>e.source==='agent'&&e.action==='inspect_task_scene'&&e.status==='completed'))throw Error('定位记录查询未调用实际场景自检')
      report.cases.push({id:entry.id,response,taskId:taskIds.at(-1)})
    }
    if (entry.reject && taskIds.length !== beforeTasks) throw new Error(`Rejected request created a task: ${entry.id}`)
    if (entry.reset) {
      await wait(() => page.locator('.agent-assembly-info').count().then(count => count === 0))
      lastRoots = []
      if(process.env.VERIFY_FACE_CARRIER==='1'&&await page.evaluate(async()=>{const r=await import('/src/modules/face-sketch/resources.ts');return !!r.getActiveFaceCarrier()}))throw Error('复位后掌子面轮廓载体残留')
    }
    const runtime = await page.evaluate(async roots => {
      const { resourceManager } = await import('/src/platform/resources/ResourceManager.ts')
      const { resourceRegistry } = await import('/src/platform/resources/ResourceRegistry.ts')
      const { getActiveFaceSlices } = await import('/src/modules/face-sketch/resources.ts')
      const { getActiveDrillModels } = await import('/src/modules/rock/drill-resource.ts')
      const { getActiveThreeBenchModel } = await import('/src/modules/rock/three-bench-resource.ts')
      const { getTestSectionSupport } = await import('/src/modules/support/test-section-resource.ts')
      const allowed = new Set(['common.tunnel', ...resourceRegistry.resolveLoadOrder(roots).map(resource => resource.id)])
      return { activePaths: [...allowed].flatMap(id => resourceRegistry.get(id)?.getActiveAssetPaths?.() ?? []), leaked: resourceManager.listStates().filter(state => state.status === 'loaded' && !allowed.has(state.id)).map(state => state.id),
        testSupports: getTestSectionSupport() ? 1 : 0,
        solids: getActiveThreeBenchModel() ? 1 : 0,
        faces: getActiveFaceSlices().length, drills: getActiveDrillModels().filter(model => model.ready && model.show).length }
    }, lastRoots)
    if (runtime.leaked.length || runtime.faces !== (lastRoots.some(id=>id.startsWith('rock.face-photo')) ? 1 : 0) || runtime.drills !== (lastRoots.includes('rock.advance-drill') ? 2 : 0)) throw new Error(`Runtime mismatch ${entry.id}: ${JSON.stringify(runtime)}`)
    if (runtime.solids !== (lastRoots.includes('rock.three-bench') ? 1 : 0)) throw new Error('三台阶任务模型未正确加载或释放')
    if (runtime.testSupports !== (lastRoots.some(id => id === 'support.test-section' || id.startsWith('support.test-section-')) ? 1 : 0)) throw new Error('测试支护模型未正确加载或释放')
    const currentEnvironment=await environment()
    if(process.env.VERIFY_FLOW_FRAMING==='1'&&lastRoots.some(id=>id==='ventilation.steady-cfd'||/^ventilation\.thermal-t\d+s$/.test(id))){
      const framing=await page.evaluate(async()=>{
        const {viewerService}=await import('/src/platform/viewer/ViewerService.ts')
        const {layers,getFlowBoundingSphere}=await import('/src/views/ventilation-module/cesiumVentilation.ts')
        const C=window.Cesium,v=viewerService.require(),points=layers.points,rect=v.canvas.getBoundingClientRect()
        const panels=[...document.querySelectorAll('.agent-window,.agent-assembly-info,.gpr-float,[data-ventilation-enhancement="chart"]')].map(e=>e.getBoundingClientRect())
        let sampled=0,inside=0,behind=0,panelCovered=0
        const bounds={xmin:Infinity,ymin:Infinity,xmax:-Infinity,ymax:-Infinity}
        for(let i=0;i<points.length;i+=Math.max(1,Math.floor(points.length/250))){
          const p=points.get(i);if(!p.show)continue;sampled++
          const delta=C.Cartesian3.subtract(p.position,v.camera.positionWC,new C.Cartesian3())
          if(C.Cartesian3.dot(delta,v.camera.directionWC)<=0){behind++;continue}
          const xy=C.SceneTransforms.worldToWindowCoordinates(v.scene,p.position)
          if(!xy)continue
          bounds.xmin=Math.min(bounds.xmin,xy.x);bounds.xmax=Math.max(bounds.xmax,xy.x);bounds.ymin=Math.min(bounds.ymin,xy.y);bounds.ymax=Math.max(bounds.ymax,xy.y)
          if(xy.x>=0&&xy.x<=rect.width&&xy.y>=0&&xy.y<=rect.height){
            inside++;if(panels.some(panel=>xy.x+rect.left>=panel.left&&xy.x+rect.left<=panel.right&&xy.y+rect.top>=panel.top&&xy.y+rect.top<=panel.bottom))panelCovered++
          }
        }
        return {scope:'projected-sample-framing-not-occlusion',sampled,inside,behind,panelCovered,panelCount:panels.length,bounds,radius:getFlowBoundingSphere()?.radius,viewport:{width:rect.width,height:rect.height},occlusion:'not-measured'}
      })
      if(!framing.sampled||framing.behind||framing.inside/framing.sampled<.98)throw Error(`实际风场样本未完整入镜 ${JSON.stringify(framing)}`)
      report.cases.at(-1).flowFraming=framing
    }
    if(process.env.VERIFY_TASK_TERRAIN==='1'&&!entry.reject){
      const terrain=await terrainState()
      if(entry.reset){if(JSON.stringify(terrain)!==JSON.stringify(originalTerrain))throw Error('复位后未恢复原地形透明度、距离规则或范围')}
      else if(!terrain.active||terrain.front!==.08||terrain.back!==.08||terrain.frontDistance||terrain.backDistance)throw Error(`任务地形淡化未生效 ${JSON.stringify(terrain)}`)
      if(report.cases.length)report.cases.at(-1).terrainContext=terrain
    }
    if(process.env.VERIFY_FACE_CARRIER==='1'&&lastRoots.some(id=>id.startsWith('rock.face-photo'))){
      const carrier=await page.evaluate(async()=>{
        const {getActiveFaceSlices,getActiveFaceCarrier}=await import('/src/modules/face-sketch/resources.ts')
        const {default:profile}=await import('/src/modules/face-sketch/tunnel-normal-sections.json')
        const C=window.Cesium,f=getActiveFaceSlices()[0],time=C.JulianDate.now(),properties=f.properties.getValue(time)
        return {polygon:!!f.polygon,wall:!!f.wall,coplanarReady:getActiveFaceCarrier()?.ready===true,vertices:f.polygon?.hierarchy.getValue(time)?.positions.length,expectedVertices:profile.sections[0].outline.length,...properties}
      })
      if(carrier.targetChainage===2244&&(!carrier.polygon||carrier.wall||!carrier.coplanarReady||carrier.vertices!==carrier.expectedVertices||carrier.textureCalibration!=='unverified'))throw Error('掌子面未使用实际源法向轮廓或未保留未标定标记')
      report.cases.at(-1).faceCarrier=carrier
      if(lastRoots.some(id=>id.startsWith('rock.gpr-'))){
        const panel=await page.locator('.gpr-float.task-reference').evaluate(e=>({width:e.getBoundingClientRect().width,cssWidth:getComputedStyle(e).width}))
        if(panel.width>402)throw Error(`任务雷达面板未缩窄: ${JSON.stringify(panel)}`)
        report.cases.at(-1).gprPanel=panel
      }
    }
    // The existing excavation handover owns its local background color.
    const expectedEnvironment = entry.id==='tunnel-side-section'||entry.id==='three-module-support' ? {...originalEnvironment,background:currentEnvironment.background} : originalEnvironment
    if(JSON.stringify(currentEnvironment)!==JSON.stringify(expectedEnvironment)||!currentEnvironment.sameCanvas||currentEnvironment.canvasCount!==1)throw new Error(`任务改用了额外场景或背景: ${JSON.stringify(currentEnvironment)}`)
    report.unifiedEnvironment=currentEnvironment
    if(entry.jetStation){
      const detail=await page.evaluate(async(withFlow)=>{
        const {viewerService}=await import('/src/platform/viewer/ViewerService.ts')
        const {getActiveJetFan,getJetFanPlacement}=await import('/src/modules/ventilation/axial-fan-resource.ts')
        const {inspectTaskFlowReview}=await import('/src/platform/tasks/TaskFlowReview.ts')
        const {blastLayerVisibility}=await import('/src/views/tunnel-module/blast.ts')
        const viewer=viewerService.require(), fan=getActiveJetFan()
        const texts=viewer.entities.values.map(entity=>entity.label?.text?.getValue()).filter(Boolean)
        return {fanReady:fan?.ready,fanStation:getJetFanPlacement()?.chainage,labels:texts.filter(x=>/设计围岩|后方.*射流风机|前方.*三台阶|后方初支/.test(x)),
          holes:blastLayerVisibility.holes,flow:withFlow?inspectTaskFlowReview():undefined}
      },entry.id==='three-module-post-blast')
      if(!detail.fanReady||detail.fanStation!==entry.jetStation)throw Error('风机相对位置错误 '+JSON.stringify(detail))
      if(entry.id==='three-module-post-blast'&&(!detail.labels.some(t=>t.startsWith('设计围岩'))||detail.holes||detail.flow?.mode!=='focus'))throw Error('爆后复核参照或重点表达错误 '+JSON.stringify(detail))
      if(entry.id==='three-module-support'&&detail.labels.length<3)throw Error('初支交底缺少三处对象标记 '+JSON.stringify(detail))
      report.cases.at(-1).linkedScene=detail
    }
    if(entry.id==='ceiling-jet-fan'){
      const jet=await page.evaluate(async()=>{
        const C=window.Cesium
        const {getActiveJetFan,getActiveAxialFan,getActiveAxialFanDuct,getJetFanPlacement}=await import('/src/modules/ventilation/axial-fan-resource.ts')
        const {viewerService}=await import('/src/platform/viewer/ViewerService.ts')
        const model=getActiveJetFan(),place=getJetFanPlacement(),viewer=viewerService.require()
        const picked=[[0,-.91,-1.3],[0,-1.3,0],[.25,-1.15,.7]].some(([x,y,z])=>{
          const target=C.Matrix4.multiplyByPoint(model.modelMatrix,new C.Cartesian3(x,y,z),new C.Cartesian3())
          const pixel=C.SceneTransforms.worldToWindowCoordinates(viewer.scene,target)
          return pixel&&viewer.scene.pick(pixel,9,9)?.primitive===model
        })
        const crownCorrectionM=C.Cartesian3.distance(C.Matrix4.getTranslation(model.modelMatrix,new C.Cartesian3()),C.Matrix4.getTranslation(place.matrix,new C.Cartesian3()))
        return {ready:model.ready,picked,chainage:place.chainage,crownCorrectionM,hangers:!!model.getNode('Ceiling suspension and isolators'),
          silencers:!!model.getNode('Inlet and outlet silencers'),groundEquipment:!!(getActiveAxialFan()||getActiveAxialFanDuct()),
          renderError:!!document.querySelector('.cesium-widget-errorPanel')}
      })
      if(!jet.ready||!jet.picked||jet.chainage!==4000||!jet.hangers||!jet.silencers||jet.groundEquipment||jet.renderError)throw Error('洞顶射流风机装配校验失败 '+JSON.stringify(jet))
      report.cases.at(-1).jet=jet
    }
    if(entry.fan) {
      const fan = await page.evaluate(async({chainage,sign})=>{
        const C=window.Cesium
        const {viewerService}=await import('/src/platform/viewer/ViewerService.ts')
        const {chainageService}=await import('/src/platform/coordinates/ChainageService.ts')
        const {getActiveAxialFan}=await import('/src/modules/ventilation/axial-fan-resource.ts')
        const {getFlowBoundingSphere}=await import('/src/views/ventilation-module/cesiumVentilation.ts')
        const viewer=viewerService.require(), model=getActiveAxialFan()
        const {heading,longitude,latitude,height}=chainageService.positionWithHeadingAt(chainage)
        const enu=C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(longitude,latitude,height+.15))
        const inverse=C.Matrix4.inverseTransformation(enu,new C.Matrix4())
        const local=C.Matrix4.multiply(inverse,model.modelMatrix,new C.Matrix4())
        const bladeCount=Array.from({length:8},(_,i)=>model.getNode('Impeller blade '+(i+1))).filter(Boolean).length
        const axis=C.Matrix4.multiplyByPointAsVector(local,C.Cartesian3.UNIT_Z,new C.Cartesian3())
        const outlet=C.Matrix4.multiplyByPoint(model.modelMatrix,new C.Cartesian3(0,.91,1.08),new C.Cartesian3())
        const marker=viewer.entities.values.filter(entity=>entity.label?.text.getValue()==='出风端 · 风筒接口')
        const directionDot=C.Cartesian3.dot(axis,new C.Cartesian3(sign*Math.sin(heading),sign*Math.cos(heading),0))
        const markerDistance=marker.length===1?C.Cartesian3.distance(outlet,marker[0].polyline.positions.getValue()[0]):Infinity
        const picked=[[-.25,.94,-1.08],[0,.91,-1.06],[.25,.94,-1.08],[-.47,1.25,.3],[.47,1.25,.3],[0,1.53,.3]].some(([x,y,z])=>{
          const point=C.Matrix4.multiplyByPoint(model.modelMatrix,new C.Cartesian3(x,y,z),new C.Cartesian3())
          const pixel=C.SceneTransforms.worldToWindowCoordinates(viewer.scene,point)
          return pixel&&viewer.scene.pick(pixel,7,7)?.primitive===model
        })
        return {bladeCount,ready:model.ready,directionDot,markerDistance,markers:marker.length,atTaskStation:Math.abs(Math.hypot(local[12],local[13])-2.1)<.001,
          picked,flowLoaded:!!getFlowBoundingSphere(),renderError:!!document.querySelector('.cesium-widget-errorPanel')}
      },entry.fan)
      if(!fan.ready||fan.bladeCount!==8||fan.directionDot<.999||fan.markerDistance>.001||fan.markers!==1||!fan.atTaskStation||!fan.picked||
        fan.flowLoaded!==lastRoots.includes('ventilation.steady-cfd')||fan.renderError)throw Error('轴流风机装配或风筒接口校验失败 '+JSON.stringify(fan))
      report.cases.at(-1).fan=fan
    }
    if(entry.id==='axial-fan-with-duct'){
      const connected=await page.evaluate(async()=>{
        const C=window.Cesium
        const {viewerService}=await import('/src/platform/viewer/ViewerService.ts')
        const {getActiveAxialFan,getActiveAxialFanDuct}=await import('/src/modules/ventilation/axial-fan-resource.ts')
        const fan=getActiveAxialFan(),duct=getActiveAxialFanDuct(),viewer=viewerService.require()
        const joint=new C.Cartesian3(0,.91,1.08)
        const point=C.Matrix4.multiplyByPoint(duct.modelMatrix,new C.Cartesian3(0,1.54,3.4),new C.Cartesian3())
        const pixel=C.SceneTransforms.worldToWindowCoordinates(viewer.scene,point)
        return {ready:duct.ready,inletAligned:C.Matrix4.equals(fan.modelMatrix,duct.modelMatrix),
          jointGap:C.Cartesian3.distance(C.Matrix4.multiplyByPoint(fan.modelMatrix,joint,new C.Cartesian3()),C.Matrix4.multiplyByPoint(duct.modelMatrix,joint,new C.Cartesian3())),
          picked:!!pixel&&viewer.scene.pick(pixel,11,11)?.primitive===duct}
      })
      if(!connected.ready||!connected.inletAligned||connected.jointGap>.001||!connected.picked)throw Error('风筒接口或画面校验失败 '+JSON.stringify(connected))
      report.cases.at(-1).duct=connected
    }
    if(entry.id==='tunnel-side-section') {
      const state=()=>page.evaluate(async()=>{
        const C=window.Cesium
        const {viewerService}=await import('/src/platform/viewer/ViewerService.ts')
        const {getFocusedTunnelSegment,getTunnelGlbSegment}=await import('/src/utils/Common/DrawLine.ts')
        const {getActiveThreeBenchModel}=await import('/src/modules/rock/three-bench-resource.ts')
        const {getTestSectionSupportModels}=await import('/src/modules/support/test-section-resource.ts')
        const viewer=viewerService.require(), shell=getTunnelGlbSegment(getFocusedTunnelSegment())
        const models=[getActiveThreeBenchModel(),...getTestSectionSupportModels()]
        window.__sectionModels??=models
        return {planes:shell.clippingPlanes.length,edgeWidth:shell.clippingPlanes.edgeWidth,opacity:shell.color.alpha,
          camera:C.Cartesian3.pack(viewer.camera.positionWC,[]),sameModels:models.length===window.__sectionModels.length&&models.every((m,i)=>m===window.__sectionModels[i]),
          stableModels:models.every(model=>model.ready&&model.show&&!model.clippingPlanes?.length),renderError:!!document.querySelector('.cesium-widget-errorPanel')}
      })
      const initial=await state()
      if(initial.planes!==5||initial.edgeWidth!==1||!initial.stableModels||initial.renderError)throw Error(`初始隧道侧剖未生效 ${JSON.stringify(initial)}`)
      await page.screenshot({path:`${root}/section.png`,timeout:30000})
      const count=taskIds.length
      const chat=async(request,reply)=>{
        const target=page.getByText(reply,{exact:true})
        const amount=await target.count()
        await page.locator('.agent-input').fill(request)
        await page.locator('.agent-input').press('Enter')
        await wait(async()=>await target.count()>amount)
        await page.locator('.agent-input').fill('idle');await wait(()=>page.locator('.send-btn').isEnabled());await page.locator('.agent-input').fill('')
      }
      await chat('关闭隧道侧剖','已关闭隧道侧剖，恢复剖切前视图。')
      const baseline=await state()
      if(baseline.planes!==2||baseline.edgeWidth!==0||!baseline.sameModels||baseline.renderError)throw Error('关闭侧剖后原洞壁状态未恢复')
      await page.screenshot({path:`${root}/restored.png`,timeout:30000})
      await chat('打开隧道侧剖','已开启隧道侧剖，保留对侧洞壁、三台阶和后方支护。')
      const reopened=await state()
      if(reopened.planes!==5||!reopened.sameModels||reopened.renderError)throw Error('当前任务的侧剖未重新开启')
      await chat('关闭隧道侧剖','已关闭隧道侧剖，恢复剖切前视图。')
      const restored=await state()
      if(JSON.stringify(baseline)!==JSON.stringify(restored)||taskIds.length!==count)throw Error('侧剖往返改变了原任务或相机状态')
      report.cases.at(-1).tunnelSection={initial,baseline,reopened,restored}
    }
    if (entry.id==='workface-backing-preview') {
      const prepare=async()=>page.evaluate(async()=>{
        const C=window.Cesium
        const {viewerService}=await import('/src/platform/viewer/ViewerService.ts')
        const {nativeRockModels,WORKFACE_BACKING_ID}=await import('/src/modules/rock/native-model-resources.ts')
        const {chainageService}=await import('/src/platform/coordinates/ChainageService.ts')
        const {fitTaskCameraToViewport}=await import('/src/platform/tasks/TaskViewport.ts')
        const v=viewerService.require(),[face,backing]=nativeRockModels([WORKFACE_BACKING_ID])
        if(!face?.ready||!backing?.ready||!C.Matrix4.equals(face.modelMatrix,backing.modelMatrix))throw Error('岩面与加厚模型未使用同一装配矩阵')
        const center=C.BoundingSphere.fromBoundingSpheres([face.boundingSphere,backing.boundingSphere])
        const heading=chainageService.positionWithHeadingAt(2244).heading
        v.camera.viewBoundingSphere(center,new C.HeadingPitchRange(heading+.74,-.31,Math.max(27,center.radius*3.2)))
        v.camera.lookAtTransform(C.Matrix4.IDENTITY)
        fitTaskCameraToViewport(v,center)
        backing.show=false
        v.scene.requestRender()
        return {position:{x:v.camera.positionWC.x,y:v.camera.positionWC.y,z:v.camera.positionWC.z},ready:true}
      })
      const before=await prepare()
      await page.screenshot({path:`${root}/before.png`,timeout:30000})
      const after=await page.evaluate(async()=>{
        const {viewerService}=await import('/src/platform/viewer/ViewerService.ts')
        const {nativeRockModels,WORKFACE_BACKING_ID}=await import('/src/modules/rock/native-model-resources.ts')
        const viewer=viewerService.require(),[,backing]=nativeRockModels([WORKFACE_BACKING_ID])
        backing.show=true
        viewer.scene.requestRender()
        const p=viewer.camera.positionWC
        return {x:p.x,y:p.y,z:p.z}
      })
      if(JSON.stringify(before.position)!==JSON.stringify(after)) throw Error('加厚对照期间相机发生变化')
      report.cases.at(-1).backingComparison={sameCamera:true,bothReady:before.ready,samePlacement:true}
      await page.screenshot({path:`${root}/after.png`,timeout:30000})
      const frontOutline=await page.evaluate(async()=>{
        const C=window.Cesium
        const {viewerService}=await import('/src/platform/viewer/ViewerService.ts')
        const {nativeRockModels,WORKFACE_BACKING_ID}=await import('/src/modules/rock/native-model-resources.ts')
        const {chainageService}=await import('/src/platform/coordinates/ChainageService.ts')
        const {fitTaskCameraToViewport}=await import('/src/platform/tasks/TaskViewport.ts')
        const viewer=viewerService.require(),[face,backing]=nativeRockModels([WORKFACE_BACKING_ID])
        const sphere=face.boundingSphere
        const heading=chainageService.positionWithHeadingAt(2244).heading
        viewer.camera.viewBoundingSphere(sphere,new C.HeadingPitchRange(heading,0,Math.max(28,sphere.radius*3.6)))
        viewer.camera.lookAtTransform(C.Matrix4.IDENTITY)
        fitTaskCameraToViewport(viewer,sphere)
        backing.show=false
        viewer.scene.requestRender()
        return C.Cartesian3.pack(viewer.camera.positionWC,[])
      })
      await page.screenshot({path:`${root}/front-original.png`,timeout:30000})
      const backedOutline=await page.evaluate(async()=>{
        const {viewerService}=await import('/src/platform/viewer/ViewerService.ts')
        const {nativeRockModels,WORKFACE_BACKING_ID}=await import('/src/modules/rock/native-model-resources.ts')
        const viewer=viewerService.require(),[,backing]=nativeRockModels([WORKFACE_BACKING_ID])
        backing.show=true
        viewer.scene.requestRender()
        return window.Cesium.Cartesian3.pack(viewer.camera.positionWC,[])
      })
      if(JSON.stringify(frontOutline)!==JSON.stringify(backedOutline)) throw Error('岩面正视轮廓对照期间相机发生变化')
      await page.screenshot({path:`${root}/front-with-backing.png`,timeout:30000})
      report.cases.at(-1).backingComparison.sameFrontCamera=true
      await page.evaluate(async()=>{
        const {executeTool}=await import('/src/ai-agent/ToolRegistry.ts')
        const front=JSON.parse(await executeTool('set_task_view',{view:'face'}))
        if(!front.ok)throw Error('加厚后掌子面近景不可用')
      })
    }
    if(entry.id==='native-workface-surface'){
      await page.screenshot({path:`${root}/workface-overview.png`,timeout:30000})
      const result = await page.evaluate(async()=>{
        const {nativeRockModels,WORKFACE_SURFACE_ID}=await import('/src/modules/rock/native-model-resources.ts')
        const {viewerService}=await import('/src/platform/viewer/ViewerService.ts')
        const {executeTool}=await import('/src/ai-agent/ToolRegistry.ts')
        const viewer=viewerService.require(),model=nativeRockModels([WORKFACE_SURFACE_ID])[0]
        if(!model?.ready)throw Error('三维岩面未完成渲染准备')
        const before=[...Array.from(model.modelMatrix)],position=viewer.camera.positionWC.clone()
        const changed=JSON.parse(await executeTool('set_task_view',{view:'face'}))
        return {ok:changed.ok,cameraChanged:!position.equals(viewer.camera.positionWC),matrixStable:before.every((v,i)=>v===model.modelMatrix[i])}
      })
      result.textureFetched=workfaceTextures.some(status=>status===200||status===304)
      if(Object.values(result).some(value=>!value))throw Error(`岩面原纹理或取景校验失败：${JSON.stringify(result)}`)
      report.cases.at(-1).view=result
      await page.screenshot({path:`${root}/workface-detail.png`,timeout:30000})
    }
    if (process.env.VERIFY_AGENT_ONLY_PANELS==='1' && !entry.reject && !entry.reset) {
      const controls=await page.locator('.agent-assembly-info button:visible,.agent-assembly-info input:visible,.gpr-float button:visible,.gpr-float input:visible,.gpr-float select:visible').count()
      if(controls!==0)throw Error(`任务侧栏仍有 ${controls} 个手动控件`)
      report.cases.at(-1).visibleManualControls=controls
      if(entry.id==='workface-radar'){
        const pixels=await page.locator('.gpr-float canvas').evaluate(async canvas=>{
          const {getActiveGprSection}=await import('/src/modules/rock/gpr-resources.ts')
          const {ds_shape:[scans,samples],data}=getActiveGprSection('rock.gpr-line1')
          const dpr=window.devicePixelRatio,left=Math.round(39*dpr),width=Math.round((canvas.clientWidth-48)*dpr),height=Math.round((canvas.clientHeight-32)*dpr)
          const context=canvas.getContext('2d');let matched=0,total=0
          for(let x=7;x<width;x+=11)for(let y=9;y<height;y+=13){
            const sample=data[Math.floor(x/width*scans)*samples+Math.floor(y/height*samples)]
            const gray=Math.round((Math.max(-1,Math.min(1,sample))+.5*2)*127.5)
            if(context.getImageData(left+x,y,1,1).data[0]===gray)matched++
            total++
          }
          return {matched,total,dpr}
        })
        if(pixels.matched/pixels.total<.65)throw Error(`雷达剖面采样方向与源矩阵不一致: ${JSON.stringify(pixels)}`)
        report.cases.at(-1).radarPixels=pixels
      }
      if(entry.id==='fan-shutdown'){
        const chart=await page.evaluate(async()=>{
          const {executeTool}=await import('/src/ai-agent/ToolRegistry.ts')
          const {inspectVentilationCharts}=await import('/src/modules/ventilation/resources.ts')
          const before=inspectVentilationCharts()[0]
          if(!before)throw Error('未加载任务曲线')
          const range=[before.timeRange[0],(before.timeRange[0]+before.timeRange[1])/2]
          const name=before.series[0].name
          const changed=JSON.parse(await executeTool('set_task_chart_review',{owner:before.owner,visibleSeries:[name],timeRange:range}))
          if(!changed.ok)throw Error(JSON.stringify(changed))
          const after=inspectVentilationCharts()[0]
          return {range:after.visibleTimeRange,expected:range,visible:after.series.filter(s=>s.visible).map(s=>s.name),name}
        })
        if(chart.visible.length!==1||chart.visible[0]!==chart.name||Math.abs(chart.range[1]-chart.expected[1])>1e-6)throw Error(`智能体图表设置未生效: ${JSON.stringify(chart)}`)
        report.cases.at(-1).chart=chart
      }
    }
    if (!entry.reject && !entry.reset) {
      const missing=runtime.activePaths.filter(path=>!report.cases.at(-1).assets.includes(path))
      if(missing.length)throw new Error(`Snapshot omitted active asset: ${entry.id}: ${missing.join(', ')}`)
    }
    if (entry.id.startsWith('three-bench-support') || entry.unitCount) {
      if (entry.unitCount && !(await page.locator('.agent-assembly-info').innerText()).includes(`${entry.unitCount}米`)) throw new Error('任务栏未显示实际支护长度')
      const support = await page.evaluate(async roots => {
        const { getTestSectionSupportModels, getTestSectionSupportSummaries, testSupportCatalog } = await import('/src/modules/support/test-section-resource.ts')
        const models = getTestSectionSupportModels()
        const asset = testSupportCatalog.find(asset => roots.includes(asset.id))
        const { resourceRegistry } = await import('/src/platform/resources/ResourceRegistry.ts')
        const summary=getTestSectionSupportSummaries(roots)[0]
        return { source: summary.layout==='1064m-component-example'?'/support-modeler/outputs/centerline/task-reference-1064.glb':asset.path, type: asset.type, activePaths: resourceRegistry.get(asset.id).getActiveAssetPaths(), count: models.length, ready: models.every(model => model.ready),summary }
      }, entry.roots)
      if (support.summary.lengthM !== (entry.unitCount ?? 10) || !support.ready || !support.activePaths.includes(support.source) || !report.cases.at(-1).assets.includes(support.source)) throw new Error('未正确加载指定长度和类型的支护示例')
      const arch=support.summary.groups?.find(group=>group.component==='steel_arch')
      if(support.summary.layout==='1064m-component-example') {
        if(support.type==='ZZ-Va'&&arch&&(arch.spacingM!==.8||arch.stations!==Math.ceil(support.summary.lengthM/.8)))throw new Error('ZZ-Va未沿用1064米示例0.8米钢架间距')
        if(support.type==='ZZ-IVb'&&arch&&(arch.spacingM!==1||arch.stations!==support.summary.lengthM))throw new Error('ZZ-IVb未沿用示例1米钢架间距')
      } else if(support.summary.unitOffsetsM?.length!==support.summary.lengthM) throw new Error('原版单元支护的实际布置数量错误')
      if (report.cases.at(-1).assets.some(path => path.includes('测试工段支护'))) throw new Error('仍使用已撤下的自建支护')
      report.cases.at(-1).existingSupport = support
      if(process.env.VERIFY_SOURCE_BASELINE==='1'&&support.summary.layout==='1064m-component-example'){
        const baseline=page.getByTestId('support-source-baseline')
        await baseline.locator(':scope > summary').click()
        const text=await baseline.innerText()
        const joints=support.summary.shellJoints
        if(!joints?.length||joints.some(j=>j.jointCount!==support.summary.lengthM-1||j.measuredJointCount!==j.jointCount||!Number.isFinite(j.maxNearestVertexDistanceM)))throw Error('外壳端截面诊断缺失或混入未测值')
        if(!await page.getByTestId('support-shell-joints').isVisible())throw Error('外壳端截面诊断未显示')
        report.cases.at(-1).shellJointDiagnostics=joints
        const comparison=page.getByTestId('support-section-comparison')
        await comparison.locator('summary').click()
        if(!await comparison.locator('svg').isVisible()||!(await comparison.innerText()).includes('宽高差不是壁厚、净空侵限或现场偏差'))throw Error('源断面对照未显示或缺少边界说明')
        report.cases.at(-1).sourceSectionComparison={text:await comparison.innerText()}
        if(!text.includes('11.00m')||!text.includes('尚未通过工程适用性验收')||!text.includes('未自动缩放'))throw Error('源断面差异或验收边界未显示')
        for(const group of support.summary.groups.filter(g=>['primary_concrete','secondary_lining'].includes(g.component))){
          if(!text.includes(group.sourceWidthM.toFixed(2))||Math.abs(group.sourceAxialExtentM-1)>.001)throw Error('源坐标架或尺寸说明不正确')
        }
        await page.screenshot({path:`${root}/${entry.id}-source-baseline.png`})
        await baseline.locator(':scope > summary').click()
        report.cases.at(-1).sourceBaseline={passed:true,text}
      }
      if(process.env.VERIFY_ASSEMBLY_FOCUS==='1'){
        const count=taskIds.length
        const viewState=()=>page.evaluate(async()=>{
          const {viewerService}=await import('/src/platform/viewer/ViewerService.ts'),{taskCameraSelection}=await import('/src/platform/tasks/TaskCameraView.ts'),r=await import('/src/modules/support/test-section-resource.ts'),b=await import('/src/modules/rock/three-bench-resource.ts'),v=viewerService.require()
          window.__focusModels??=[b.getActiveThreeBenchModel(),...r.getTestSectionSupportModels()]
          const models=[b.getActiveThreeBenchModel(),...r.getTestSectionSupportModels()]
          return {view:taskCameraSelection.value,sameModels:models.every((m,i)=>m===window.__focusModels[i]),position:[v.camera.positionWC.x,v.camera.positionWC.y,v.camera.positionWC.z],renderError:document.querySelector('.cesium-widget-errorPanel')?.textContent||''}
        })
        await page.evaluate(()=>{delete window.__focusModels});await viewState()
        for(const view of ['support','excavation','overview']){
          await page.getByTestId(`task-view-${view}`).click()
          const actual=await viewState()
          if(actual.view!==view||!actual.sameModels||actual.renderError||!actual.position.every(Number.isFinite)||taskIds.length!==count)throw Error(`装配按钮取景失败 ${view}`)
          await page.screenshot({path:`${root}/${entry.id}-${view}.png`})
        }
        for(const [request,view] of [['聚焦三台阶','excavation'],['聚焦支护','support'],['看整体布置','overview']]){
          const replies=await page.locator('.agent-messages .msg-row.assistant').count()
          await page.locator('.agent-input').fill(request);await page.locator('.agent-input').press('Enter')
          await wait(async()=>await page.locator('.agent-messages .msg-row.assistant').count()>replies)
          await page.locator('.agent-input').fill('idle');await wait(()=>page.locator('.send-btn').isEnabled());await page.locator('.agent-input').fill('')
          const actual=await viewState()
          if(actual.view!==view||!actual.sameModels||taskIds.length!==count)throw Error(`装配聊天取景失败 ${request}`)
        }
        report.cases.at(-1).assemblyFocus=true
      }
      if(process.env.VERIFY_SUPPORT_CONTINUITY==='1'){
        const display=await page.evaluate(async()=>{const r=await import('/src/modules/support/test-section-resource.ts');return r.getTaskSupportLayers(r.getTestSectionSupportSummaries().map(s=>s.id))})
        const previous=new Map(beforeDisplay.map(l=>[l.component,l.visible])),missing=entry.followup&&beforeDisplay.some(l=>l.visible)&&!display.some(l=>previous.get(l.component)===true)
        for(const layer of display){
          const expected=entry.followup&&!missing&&previous.has(layer.component)?previous.get(layer.component):support.summary.groups.filter(g=>g.component===layer.component).every(g=>g.visible)
          if(layer.visible!==expected||await page.getByTestId(`support-layer-${layer.component}`).isChecked()!==expected)throw Error(`后续显隐承接错误 ${entry.id}: ${layer.component}`)
        }
        if(missing&&!(await page.locator('.agent-messages').innerText()).includes('新支护类型不包含原先可见的构件'))throw Error('未说明不可承接的显示状态')
        for(const layer of display)await page.getByTestId(`support-layer-${layer.component}`).setChecked(layer.component===(support.type==='Z-PM'?'secondary_rebar_N7':'steel_arch'))
        report.cases.at(-1).displayContinuity={passed:true,missingVisibleComponents:missing||false}
      }
      if(process.env.VERIFY_SUPPORT_QUERY==='1'){
        const lining=page.getByTestId('support-layer-secondary_lining'),hideLining=await lining.count()>0&&await lining.isChecked()
        if(hideLining)await lining.uncheck()
        const beforeQuery=await page.evaluate(async()=>{const r=await import('/src/modules/support/test-section-resource.ts');window.__supportQueryModel=r.getTestSectionSupportModels()[0];return r.getTaskSupportLayers(r.getTestSectionSupportSummaries().map(s=>s.id))})
        const count=taskIds.length,replies=await page.locator('.agent-messages .msg-row.assistant').count()
        await page.locator('.agent-input').fill('当前支护有哪些构件，钢架间距多少，哪些构件正在显示，核对依据还缺什么');await page.locator('.agent-input').press('Enter')
        await wait(async()=>await page.locator('.agent-messages .msg-row.assistant').count()>replies)
        await page.locator('.agent-input').fill('idle');await wait(()=>page.locator('.send-btn').isEnabled());await page.locator('.agent-input').fill('')
        const answer=await page.locator('.agent-messages .msg-row.assistant').last().innerText()
        if(!answer.includes('工程验收未核验')||!answer.includes('重复取景和显隐不能补齐证据'))throw Error('支护回答未说明证据缺口与停止条件')
        if(!answer.includes(support.type)||!answer.includes(`${support.summary.lengthM}米`))throw Error('查询未返回当前实际类型或长度')
        if(arch&&!answer.includes(`布置间距${arch.spacingM}米`))throw Error('查询未返回实际钢架间距')
        if(hideLining&&!answer.includes('二次衬砌：隐藏'))throw Error('查询未读取最新构件显隐状态')
        if(!beforeQuery.length&&!answer.includes('回退')&&!answer.includes('空范围'))throw Error('回退模型查询未说明数据限制')
        const unchanged=await page.evaluate(async before=>{const r=await import('/src/modules/support/test-section-resource.ts');return window.__supportQueryModel===r.getTestSectionSupportModels()[0]&&JSON.stringify(before)===JSON.stringify(r.getTaskSupportLayers(r.getTestSectionSupportSummaries().map(s=>s.id)))},beforeQuery)
        if(taskIds.length!==count||!unchanged)throw Error('只读查询修改了任务或模型显隐')
        report.cases.at(-1).currentSupportQuery={passed:true,answer}
        if(hideLining)await lining.check()
      }
      if(process.env.VERIFY_SUPPORT_LAYERS==='1'){
        const layerState=()=>page.evaluate(async()=>{
          const r=await import('/src/modules/support/test-section-resource.ts'),models=r.getTestSectionSupportModels()
          window.__supportLayerModel??=models[0]
          const summaries=r.getTestSectionSupportSummaries(),layers=r.getTaskSupportLayers(summaries.map(x=>x.id))
          const consistent=layers.every(layer=>r.getTestSectionSupportModels([layer.resourceId]).every(model=>summaries.find(s=>s.id===layer.resourceId).groups.filter(g=>g.component===layer.component).every(g=>model.getNode(g.name).show===layer.visible)))
          return {layers,consistent,sameModel:window.__supportLayerModel===models[0]}
        })
        await page.evaluate(()=>{delete window.__supportLayerModel})
        const initial=await layerState(),taskCount=taskIds.length
        if(initial.layers.length){
          if(!initial.layers.length)throw Error('缺少已有支护构件开关')
          for(const layer of initial.layers){
            const input=page.getByTestId(`support-layer-${layer.component}`)
            if(await input.isChecked()!==layer.visible)throw Error('支护开关与模型状态不一致')
            await input.setChecked(!layer.visible)
            const changed=await layerState()
            if(!changed.sameModel||!changed.consistent||changed.layers.find(x=>x.component===layer.component).visible===layer.visible||taskIds.length!==taskCount)throw Error('构件显隐未正确作用于全部原任务模型')
          }
          await page.screenshot({path:`${root}/${entry.id}-components.png`})
          await page.getByTestId('support-layers-reset').click()
          if(JSON.stringify((await layerState()).layers)!==JSON.stringify(initial.layers))throw Error('未恢复示例默认显隐')
        }else if(await page.locator('[aria-label="支护构件显隐"]').count())throw Error('空示例回退模型不应显示不存在的构件控制')
        report.cases.at(-1).componentControls={passed:true,count:initial.layers.length}
        if(process.env.VERIFY_SUPPORT_LAYER_CHAT==='1'&&initial.layers.length){
          const commands=support.type==='Z-PM'?[['隐藏二衬，显示二衬钢筋N1和N7',{secondary_lining:false,secondary_rebar_N1:true,secondary_rebar_N7:true}],['只看二衬钢筋N7',Object.fromEntries(initial.layers.map(l=>[l.component,l.component==='secondary_rebar_N7']))]]:[['隐藏二衬，显示钢架和锚杆',{secondary_lining:false,steel_arch:true,system_anchor:true,lock_foot_anchor:true}],['只看钢架',Object.fromEntries(initial.layers.map(l=>[l.component,l.component==='steel_arch']))]]
          for(const [request,expected] of [...commands,['恢复支护默认显示',Object.fromEntries(initial.layers.map(l=>[l.component,l.visible]))],['隐藏二衬，显示格栅',Object.fromEntries(initial.layers.map(l=>[l.component,l.visible]))]]){
            const replies=await page.locator('.agent-messages .msg-row.assistant').count()
            await page.locator('.agent-input').fill(request);await page.locator('.agent-input').press('Enter')
            await wait(async()=>await page.locator('.agent-messages .msg-row.assistant').count()>replies)
            await page.locator('.agent-input').fill('idle');await wait(()=>page.locator('.send-btn').isEnabled());await page.locator('.agent-input').fill('')
            const updated=await layerState()
            if(!updated.sameModel||!updated.consistent||taskIds.length!==taskCount||Object.entries(expected).some(([k,v])=>updated.layers.find(l=>l.component===k)?.visible!==v))throw Error(`自然语言构件控制错误: ${request}`)
            for(const layer of updated.layers)if(await page.getByTestId(`support-layer-${layer.component}`).isChecked()!==layer.visible)throw Error('自然语言执行后复选框未同步')
          }
          report.cases.at(-1).naturalLanguageLayers=true
        }
      }
    }
    if (entry.id === 'three-bench') {
      const solid = await page.evaluate(async () => {
        const { getActiveThreeBenchModel } = await import('/src/modules/rock/three-bench-resource.ts')
        const model = getActiveThreeBenchModel()
        return { ready: model?.ready, radius: model?.ready ? model.boundingSphere.radius : 0 }
      })
      if (!solid.ready || solid.radius < 10) throw new Error('三台阶实体未就绪')
      report.cases.at(-1).solid = solid
    }
    if (entry.id === 'continuous-support') {
      const segment = await page.evaluate(async () => {
        const { getActiveModelerSupportModel } = await import('/src/modules/support/modeler-resources.ts')
        const { resourceRegistry } = await import('/src/platform/resources/ResourceRegistry.ts')
        const id = 'support.modeler-continuous-zz-va-20m', model = getActiveModelerSupportModel(id)
        return { ready: model?.ready, radius: model?.ready ? model.boundingSphere.radius : 0, metadata: resourceRegistry.require(id).getEnhanceTargets()[0].metadata }
      })
      if (!segment.ready || segment.radius < 10 || segment.metadata.lengthM !== 20 || segment.metadata.sectionCount !== 20 || segment.metadata.startChainage !== 2244 || segment.metadata.endChainage !== 2264) throw new Error(JSON.stringify(segment))
      report.cases.at(-1).segment = segment
    }
    if (entry.reject) report.cases.push({ id: entry.id, rejected: true, previousScenePreserved: true, elapsedMs: Date.now() - started })
    if(entry.reject&&process.env.VERIFY_SUPPORT_CONTINUITY==='1'){
      const afterDisplay=await page.evaluate(async()=>{const r=await import('/src/modules/support/test-section-resource.ts');return r.getTaskSupportLayers(r.getTestSectionSupportSummaries().map(s=>s.id))})
      if(JSON.stringify(beforeDisplay)!==JSON.stringify(afterDisplay))throw Error('无效任务修改破坏了显隐状态')
    }
    if (entry.reset) report.cases.push({ id: entry.id, reset: true, modelsReleased: true, elapsedMs: Date.now() - started })
    if(entry.reset&&process.env.VERIFY_SUPPORT_LAYERS==='1'&&await page.locator('[aria-label="支护构件显隐"]').count())throw Error('复位后支护构件面板残留')
    if(process.env.VERIFY_SAFE_VIEWPORT==='1'&&!entry.reject&&!entry.reset&&entry.roots?.some(id=>id==='rock.advance-drill'||id==='rock.three-bench')){
      const framing=await page.evaluate(async ids=>{
        const {viewerService}=await import('/src/platform/viewer/ViewerService.ts'),{inspectTaskSphereViewport}=await import('/src/platform/tasks/TaskViewport.ts')
        const {getTestSectionSupportModels}=await import('/src/modules/support/test-section-resource.ts'),{getActiveThreeBenchModel}=await import('/src/modules/rock/three-bench-resource.ts'),{getActiveDrillModels}=await import('/src/modules/rock/drill-resource.ts')
        const models=[...(ids.includes('rock.three-bench')?[getActiveThreeBenchModel()]:[]),...getTestSectionSupportModels(ids),...(ids.includes('rock.advance-drill')?getActiveDrillModels():[])].filter(m=>m?.ready)
        return inspectTaskSphereViewport(viewerService.require(),window.Cesium.BoundingSphere.fromBoundingSpheres(models.map(m=>m.boundingSphere)))
      },entry.roots)
      report.cases.at(-1).safeViewport=framing
      if(!framing.available||framing.projected!==26||framing.insideSafe!==26)throw Error(`场景目标包围球未完整进入可用区域: ${JSON.stringify(framing)}`)
    }
    if(process.env.VERIFY_DESIGN_PRIMARY==='1'&&entry.id==='design-only'){
      const panel=page.getByTestId('blast-design-panel')
      const dimensions=await panel.evaluate(e=>{const r=e.getBoundingClientRect(),svg=e.querySelector('svg')?.getBoundingClientRect();return {left:r.left,width:r.width,height:r.height,svgHeight:svg?.height}})
      if(dimensions.width<500||dimensions.svgHeight<350||!(await panel.innerText()).includes('孔径未提供'))throw Error(`二维主任务布局或资料边界错误: ${JSON.stringify(dimensions)}`)
      if(!await page.getByTestId('blast-design-source').isVisible())throw Error('方案来源缺失')
      report.cases.at(-1).designPrimary=dimensions
    }
    if (process.env.VERIFY_PREFLIGHT === '1' && entry.id === 'thermal-200') {
      const preflights = []
      for (const [request, compatible] of [
        ['YK1+346只做装配预检：TSP坚硬度与TEM视电阻率能否同屏？不要执行。', false],
        ['YK1+346只做装配预检：岩体完整性与ZZ-Va支护能否同屏？不要执行。', true],
      ]) {
        const previous = await page.locator('.agent-messages .msg-row.assistant').count()
        await page.locator('.agent-input').fill(request); await page.locator('.agent-input').press('Enter')
        await wait(async () => (await page.locator('.agent-messages .msg-row.assistant').count()) > previous)
        await page.locator('.agent-input').fill('idle probe'); await wait(() => page.locator('.send-btn').isEnabled()); await page.locator('.agent-input').fill('')
        const reply = await page.locator('.agent-messages .msg-row.assistant').last().innerText()
        if (!reply.includes(compatible ? '装配兼容性预检通过' : '装配兼容性预检未通过') || taskIds.length !== beforeTasks + 1) throw new Error(`Preflight failed or created task: ${reply}`)
        const unchanged = await page.evaluate(async () => {
          const { resourceManager } = await import('/src/platform/resources/ResourceManager.ts')
          const { resourceRegistry } = await import('/src/platform/resources/ResourceRegistry.ts')
          return resourceManager.getState('ventilation.thermal-t200s').status === 'loaded' && (resourceRegistry.get('ventilation.thermal-t200s').getActiveAssetPaths?.() ?? []).some(path => path.includes('t200s'))
        })
        if (!unchanged) throw new Error('Preflight changed the existing thermal slice')
        preflights.push({ request, compatible, reply, thermalSlicePreserved: true })
      }
      report.cases.at(-1).preflights = preflights
    }
    if (process.env.VERIFY_TASK_CUT === '1' && entry.id === 'rock-support') {
      const states = []
      for (const [text, enabled] of [['关闭剖切，恢复完整解释体', false], ['开启解释体剖切', true], ['取消剖切，恢复完整体数据', false]]) {
        const replies = await page.locator('.agent-messages .msg-row.assistant').count()
        await page.locator('.agent-input').fill(text); await page.locator('.agent-input').press('Enter')
        await wait(async () => (await page.locator('.agent-messages .msg-row.assistant').count()) > replies)
        await page.locator('.agent-input').fill('idle probe'); await wait(() => page.locator('.send-btn').isEnabled()); await page.locator('.agent-input').fill('')
        const reply = await page.locator('.agent-messages .msg-row.assistant').last().innerText()
        const cut = await page.evaluate(async () => { const { getTaskVolumeCutState } = await import('/src/platform/tasks/TaskVolumeCut.ts'); return getTaskVolumeCutState() })
        if (!reply.includes(enabled ? '已开启' : '已恢复') || !cut || (enabled ? cut.xmax !== 0.5 || cut.ymin !== 0.2 : cut.xmax <= 0.5 || cut.ymin >= 0.2) || taskIds.length !== beforeTasks + 1) throw new Error(`Cut change failed: ${JSON.stringify({reply,cut})}`)
        const status = await page.locator('[data-testid="task-cut-status"]').innerText()
        if (!status.includes(enabled ? '剖切展示' : '完整范围')) throw new Error(`Cut UI out of sync: ${status}`)
        states.push({ text, cut })
      }
      await page.locator('[data-testid="task-cut-toggle"]').press('Enter')
      await wait(async () => (await page.locator('[data-testid="task-cut-status"]').innerText()).includes('剖切展示'))
      const manual = await page.evaluate(async () => { const { getTaskVolumeCutState } = await import('/src/platform/tasks/TaskVolumeCut.ts'); return getTaskVolumeCutState() })
      if (manual.xmax !== 0.5 || manual.ymin !== 0.2) throw new Error('Manual cut did not update renderer')
      states.push({ text: 'manual-page-button', cut: manual })
      report.cases.at(-1).cutChanges = states
    }
    if (process.env.VERIFY_TASK_VIEWS === '1' && entry.id === 'workface-support-drill') {
      const views = []
      for (const [index, text] of ['拉近掌子面，查看近景', '聚焦支护近景', '聚焦水平钻布置', '切换到整体布置视角'].entries()) {
        const replies = await page.locator('.agent-messages .msg-row.assistant').count()
        await page.locator('.agent-input').fill(text); await page.locator('.agent-input').press('Enter')
        await wait(async () => (await page.locator('.agent-messages .msg-row.assistant').count()) > replies)
        await page.locator('.agent-input').fill('idle probe'); await wait(() => page.locator('.send-btn').isEnabled()); await page.locator('.agent-input').fill('')
        const reply = await page.locator('.agent-messages .msg-row.assistant').last().innerText()
        if (!reply.includes('已切换到') || taskIds.length !== beforeTasks + 1) throw new Error(`View change rebuilt or failed: ${reply}`)
        if (await page.locator(`[data-testid="task-view-${['face','support','drill','overview'][index]}"]`).getAttribute('aria-pressed') !== 'true') throw new Error('Camera toolbar is out of sync with chat')
        const position = await page.evaluate(async () => { const { viewerService } = await import('/src/platform/viewer/ViewerService.ts'); const p = viewerService.require().camera.positionWC; return [p.x,p.y,p.z] })
        views.push({ text, reply, position })
      }
      if (new Set(views.map(view => JSON.stringify(view.position))).size !== 4) throw new Error('Task views did not move the camera')
      if (await page.locator('[data-testid="task-view-blast"]').count()) throw new Error('Unavailable blast view was offered')
      for (const view of ['face', 'overview']) {
        await page.locator(`[data-testid="task-view-${view}"]`).press('Enter')
        await wait(async () => await page.locator(`[data-testid="task-view-${view}"]`).getAttribute('aria-pressed') === 'true')
      }
      if (taskIds.length !== beforeTasks + 1) throw new Error('Manual view rebuilt the task')
      report.cases.at(-1).viewChanges = views
      report.cases.at(-1).manualViews = ['face', 'overview']
    }
    if (process.env.VERIFY_GEOMETRY_VIEWS === '1' && entry.unitCount) {
      const views = await page.evaluate(async () => {
        const C=window.Cesium
        const { viewerService }=await import('/src/platform/viewer/ViewerService.ts')
        const { getActiveThreeBenchModel }=await import('/src/modules/rock/three-bench-resource.ts')
        const { getTestSectionSupportModels, getTestSectionSupportSummaries }=await import('/src/modules/support/test-section-resource.ts')
        const { default: profile }=await import('/src/modules/face-sketch/tunnel-normal-sections.json')
        const viewer=viewerService.require(),bench=getActiveThreeBenchModel(),models=getTestSectionSupportModels()
        const worldVector=source=>C.Cartesian3.normalize(C.Matrix4.multiplyByPointAsVector(bench.modelMatrix,new C.Cartesian3(source[2],source[1],-source[0]),new C.Cartesian3()),new C.Cartesian3())
        let maxAngle=0,maxGap=0
        const layout=getTestSectionSupportSummaries()[0]?.layout
        if(layout==='original-unit-fallback') models.forEach((model,i)=>{
          const actual=C.Cartesian3.normalize(C.Matrix4.multiplyByPointAsVector(model.modelMatrix,C.Cartesian3.UNIT_Z,new C.Cartesian3()),new C.Cartesian3())
          const offset=-models.length-.5+i
          const section=profile.supportSections.reduce((a,b)=>Math.abs(a.distanceM-offset)<Math.abs(b.distanceM-offset)?a:b)
          const expected=worldVector(section.frame.forward)
          maxAngle=Math.max(maxAngle,C.Cartesian3.angleBetween(actual,expected)*180/Math.PI)
          if(i+1<models.length)for(const x of [-6.36,0,6.36]){
            const a=C.Matrix4.multiplyByPoint(model.modelMatrix,new C.Cartesian3(x,0,1),new C.Cartesian3())
            const b=C.Matrix4.multiplyByPoint(models[i+1].modelMatrix,new C.Cartesian3(x,0,0),new C.Cartesian3())
            maxGap=Math.max(maxGap,C.Cartesian3.distance(a,b))
          }
        })
        const sphere=C.BoundingSphere.fromBoundingSpheres([bench,...models].map(model=>model.boundingSphere)),frame=profile.sections[0].frame
        const forward=worldVector(frame.forward),up=worldVector(frame.up),lateral=worldVector(frame.lateral)
        const array=p=>[p.x,p.y,p.z]
        const pose=(axis,vertical,target=sphere)=>({position:array(C.Cartesian3.add(target.center,C.Cartesian3.multiplyByScalar(axis,target.radius*3.6,new C.Cartesian3()),new C.Cartesian3())),direction:array(C.Cartesian3.negate(axis,new C.Cartesian3())),up:array(vertical),pan:target.radius*.6})
        return {layout,maxSupportNormalAngleDeg:layout==='original-unit-fallback'?maxAngle:null,maxSupportJointGapM:layout==='original-unit-fallback'?maxGap:null,oldFixedCutAngleDeg:profile.oldFixedPlaneObliquityDeg,top:pose(up,forward),side:pose(lateral,up),near:pose(lateral,up,C.BoundingSphere.fromBoundingSpheres(models.map(model=>model.boundingSphere))),original:{position:array(viewer.camera.positionWC),direction:array(viewer.camera.directionWC),up:array(viewer.camera.upWC)}}
      })
      if(views.maxSupportNormalAngleDeg>.0001||views.maxSupportJointGapM>.01)throw new Error(`实际支护法向/接缝不合格 ${JSON.stringify(views)}`)
      for(const name of ['top','side','near','original']){
        await page.evaluate(async pose=>{const {viewerService}=await import('/src/platform/viewer/ViewerService.ts');const C=window.Cesium,v=viewerService.require();v.camera.setView({destination:C.Cartesian3.fromArray(pose.position),orientation:{direction:C.Cartesian3.fromArray(pose.direction),up:C.Cartesian3.fromArray(pose.up)}});if(pose.pan)v.camera.moveRight(pose.pan);v.scene.requestRender()},views[name])
        await page.waitForTimeout(600)
        if(name!=='original')await page.screenshot({path:`${root}/${entry.id}-${name}.png`,timeout:60000})
      }
      report.cases.at(-1).geometry={maxSupportNormalAngleDeg:views.maxSupportNormalAngleDeg,maxSupportJointGapM:views.maxSupportJointGapM,oldFixedCutAngleDeg:views.oldFixedCutAngleDeg}
    }
    if(process.env.VERIFY_FLOW_EVALUATION==='1'&&entry.id==='post-blast-airflow'){
      const count=taskIds.length
      const run=()=>page.evaluate(async()=>{
        const {evaluateTaskFlowReview,adjustTaskFlowReview,setTaskFlowReview,inspectTaskFlowReview}=await import('/src/platform/tasks/TaskFlowReview.ts')
        const {viewerService}=await import('/src/platform/viewer/ViewerService.ts'),v=viewerService.require()
        const before=inspectTaskFlowReview(),initial=evaluateTaskFlowReview(),adjustments=[]
        // Deliberately move the real camera off target; no replacement feedback.
        for(let i=0;i<2;i++){
          v.camera.moveRight(180);v.scene.requestRender()
          const bad=evaluateTaskFlowReview()
          if(!bad.candidates.length)throw Error('偏离画面后未给出有限取景候选')
          const changed=adjustTaskFlowReview()
          if(!changed.changed||changed.after.mode!==before.mode)throw Error('受控调整未执行或改变了任务范围')
          adjustments.push(changed)
        }
        v.camera.moveRight(180);v.scene.requestRender()
        const exhausted=adjustTaskFlowReview()
        if(exhausted.changed||exhausted.evaluation.status!=='budget-exhausted'||exhausted.evaluation.remainingAdjustments!==0)throw Error('调整预算未生效')
        setTaskFlowReview('context');setTaskFlowReview('focus')
        if(evaluateTaskFlowReview().remainingAdjustments!==0)throw Error('切换模式重置了任务预算')
        return {initial,adjustments,exhausted,after:inspectTaskFlowReview()}
      })
      report.cases.at(-1).flowEvaluation=await run()
      if(taskIds.length!==count)throw Error('反馈调整创建了新任务')
      await page.getByTestId('flow-review-evaluate').click()
      if(!await page.getByTestId('flow-review-evaluation').isVisible())throw Error('评价结果未显示')
      await page.screenshot({path:`${root}/${entry.id}-evaluation.png`})
      if(process.env.VERIFY_FLOW_EVALUATION_CHAT==='1'){
        const replies=await page.locator('.agent-messages .msg-row.assistant').count()
        const before=await page.evaluate(async()=>{const {viewerService}=await import('/src/platform/viewer/ViewerService.ts');return Array.from(window.Cesium.Cartesian3.pack(viewerService.require().camera.positionWC,[]))})
        await page.locator('.agent-input').fill('只读评价当前爆破通风复核画面，报告屏幕采样问题、剩余调整次数和停止原因。不要修改相机或切换模式，不要重新装配。');await page.locator('.agent-input').press('Enter')
        await wait(async()=>await page.locator('.agent-messages .msg-row.assistant').count()>replies)
        await page.locator('.agent-input').fill('idle');await wait(()=>page.locator('.send-btn').isEnabled());await page.locator('.agent-input').fill('')
        const after=await page.evaluate(async()=>{const {viewerService}=await import('/src/platform/viewer/ViewerService.ts');return Array.from(window.Cesium.Cartesian3.pack(viewerService.require().camera.positionWC,[]))})
        if(JSON.stringify(before)!==JSON.stringify(after)||taskIds.length!==count)throw Error('只读评价改变了相机或任务')
        const audit=await fetch(`http://localhost:3000/api/ai-agent/task-runs/${report.cases.at(-1).taskId}`).then(r=>r.json())
        if(!audit.events?.some(e=>e.source==='agent'&&e.action==='evaluate_task_flow_review'&&e.result_summary?.flowEvaluation?.policy?.version==='2026-11-16-screen-review-v1'))throw Error('真实聊天未读取屏幕评价工具')
        report.cases.at(-1).flowEvaluationChat={answer:await page.locator('.agent-messages .msg-row.assistant').last().innerText(),cameraUnchanged:true}
      }
    }
    if(process.env.VERIFY_FLOW_REVIEW==='1'&&entry.id==='post-blast-airflow'){
      const count=taskIds.length
      const state=()=>page.evaluate(async()=>{
        const {taskFlowReview}=await import('/src/platform/tasks/TaskFlowReview.ts'),{layers}=await import('/src/views/ventilation-module/cesiumVentilation.ts'),{getBlastModel}=await import('/src/views/tunnel-module/blast.ts'),{viewerService}=await import('/src/platform/viewer/ViewerService.ts')
        const C=window.Cesium,v=viewerService.require(),blast=getBlastModel(),points=layers.points
        window.__flowReviewModels??=[blast,points]
        const sphere=blast.boundingSphere,center=C.SceneTransforms.worldToWindowCoordinates(v.scene,sphere.center),edge=C.SceneTransforms.worldToWindowCoordinates(v.scene,C.Cartesian3.add(sphere.center,C.Cartesian3.multiplyByScalar(v.camera.upWC,sphere.radius,new C.Cartesian3()),new C.Cartesian3()))
        let hash=2166136261
        for(let i=0;i<points.length;i++){
          const p=points.get(i),s=JSON.stringify([p.color.red,p.color.green,p.color.blue,p.color.alpha,p.pixelSize,p.show,p.position.x,p.position.y,p.position.z])
          for(let j=0;j<s.length;j++)hash=Math.imul(hash^s.charCodeAt(j),16777619)
        }
        return {...taskFlowReview.value,sameModels:window.__flowReviewModels[0]===blast&&window.__flowReviewModels[1]===points,styleHash:hash,diameterPx:Math.hypot(center.x-edge.x,center.y-edge.y)*2,streamlines:layers.streamlines?.show,particles:layers.particles?.show}
      })
      const focus=await state()
      if(focus.mode!=='focus'||!focus.localSamples||focus.streamlines!==false||focus.particles!==false)throw Error(`重点表达未生效 ${JSON.stringify(focus)}`)
      await page.screenshot({path:`${root}/${entry.id}-focus.png`})
      await page.getByTestId('flow-review-context').click();await page.waitForTimeout(500)
      const context=await state()
      await page.screenshot({path:`${root}/${entry.id}-context.png`})
      await page.getByTestId('flow-review-focus').click();await page.waitForTimeout(500)
      const again=await state()
      if(context.mode!=='context'||again.mode!=='focus'||again.styleHash!==focus.styleHash||!again.sameModels||focus.diameterPx<context.diameterPx*2||taskIds.length!==count)throw Error('复核表达切换未保持原模型、未恢复样式或重点尺度不足')
      await page.getByTestId('flow-review-context').click()
      if((await state()).styleHash!==context.styleHash)throw Error('全段样式未精确恢复')
      await page.getByTestId('flow-review-focus').click()
      const feedback=await page.evaluate(async()=>{const {executeTool}=await import('/src/ai-agent/ToolRegistry.ts');return JSON.parse(await executeTool('inspect_task_flow_review',{}))})
      if(!feedback.ok||feedback.feedback.mode!=='focus'||feedback.feedback.occlusion!=='not-measured'||!feedback.feedback.sampled||feedback.feedback.inside/feedback.feedback.sampled<.95)throw Error('只读复核反馈未报告实际重点范围')
      if((await state()).styleHash!==focus.styleHash||taskIds.length!==count)throw Error('只读反馈改变了表达或任务')
      if(process.env.VERIFY_FLOW_REVIEW_CHAT==='1'){
        const replies=await page.locator('.agent-messages .msg-row.assistant').count()
        await page.locator('.agent-input').fill('读取当前复核反馈，说明目标尺度和采样入镜情况，不调整场景。');await page.locator('.agent-input').press('Enter')
        await wait(async()=>await page.locator('.agent-messages .msg-row.assistant').count()>replies)
        await page.locator('.agent-input').fill('idle probe');await wait(()=>page.locator('.send-btn').isEnabled());await page.locator('.agent-input').fill('')
        const answer=await page.locator('.agent-messages .msg-row.assistant').last().innerText()
        if(!/像素|投影|采样/.test(answer)||(await state()).styleHash!==focus.styleHash||taskIds.length!==count)throw Error('自然语言反馈查询改变了任务或没有报告测量')
        report.cases.at(-1).flowReviewChat=answer
        const run=await fetch(`http://localhost:3000/api/ai-agent/task-runs/${report.cases.at(-1).taskId}`).then(r=>r.json())
        const event=run.events?.find(e=>e.source==='agent'&&e.action==='inspect_task_flow_review'&&e.status==='completed'&&e.result_summary?.flowFeedback?.measurement==='screen-projection-and-panel-rectangles')
        if(!event)throw Error('没有自然语言读取反馈工具的实际审计记录')
        report.cases.at(-1).flowReviewFeedbackAudit={id:event.id,source:event.source,action:event.action,status:event.status}
      }
      report.cases.at(-1).flowReview={focus,context,again,feedback,taskCountUnchanged:true}
    }
    if(process.env.VERIFY_FLOW_REVIEW==='1'&&entry.reset){
      if(await page.getByTestId('task-flow-review').count())throw Error('复位后复核表达面板残留')
      if(await page.evaluate(async()=>{const r=await import('/src/platform/tasks/TaskFlowReview.ts');return !!r.taskFlowReview.value}))throw Error('复位后复核策略残留')
    }
    if(process.env.VERIFY_FLOW_REVIEW==='1'&&entry.id==='post-blast-airflow-overview'){
      const mode=await page.evaluate(async()=>{const r=await import('/src/platform/tasks/TaskFlowReview.ts');return r.taskFlowReview.value?.mode})
      if(mode!=='context')throw Error('完整风场范围请求被擅自改为局部重点')
      report.cases.at(-1).explicitFullFieldGoal={mode,passed:true}
    }
    if(process.env.VERIFY_SUPPORT_LAYOUT==='1'&&entry.unitCount){
      const count=taskIds.length
      const layoutState=()=>page.evaluate(async()=>{
        const {viewerService}=await import('/src/platform/viewer/ViewerService.ts'),r=await import('/src/modules/support/test-section-resource.ts'),l=await import('/src/modules/support/longitudinal-layout.ts')
        const C=window.Cesium,v=viewerService.require(),time=C.JulianDate.now(),markers=v.entities.values.filter(e=>e.properties?.taskSupportStation?.getValue(time)),models=r.getTestSectionSupportModels()
        window.__layoutModels??=models
        return {markers:markers.map(e=>({id:e.id,offset:e.properties.offsetM.getValue(time),label:e.label.show.getValue(time)})),sameModels:models.every((m,i)=>m===window.__layoutModels[i]),rows:l.supportLongitudinalRows(r.getTestSectionSupportSummaries())}
      })
      await page.evaluate(()=>{delete window.__layoutModels})
      if((await layoutState()).markers.length)throw Error('上一任务的支护定位标记未清理')
      const detail=page.getByTestId('support-layout')
      const entryCamera=await page.evaluate(async()=>{const {viewerService}=await import('/src/platform/viewer/ViewerService.ts');const p=viewerService.require().camera.positionWC;return [p.x,p.y,p.z]})
      await detail.locator(':scope > summary').click()
      await wait(async()=>!!(await layoutState()).markers.length)
      const option=await page.getByTestId('support-layout-component').inputValue()
      const initial=await layoutState(),row=initial.rows.find(r=>r.id===option)
      if(initial.markers.length!==row.offsetsM.length||!initial.sameModels)throw Error('二维站位与实际定位标记不一致')
      const query=await page.evaluate(async()=>{const r=await import('/src/modules/support/test-section-resource.ts');return r.getCurrentSupportReport(r.getTestSectionSupportSummaries().map(s=>s.id))})
      const queryRow=query.flatMap(s=>s.longitudinalLayout.rows).find(r=>r.id===row.id)
      if(JSON.stringify(queryRow.offsetsM)!==JSON.stringify(row.offsetsM))throw Error('只读支护报告与二维图使用了不同站位记录')
      await page.getByTestId('support-station-1').click();await page.waitForTimeout(600)
      const picked2d=await layoutState()
      if(!picked2d.markers.find(m=>Math.abs(m.offset-row.offsetsM[1])<1e-8)?.label)throw Error('二维选点未标识实际三维站位')
      const screen=await page.evaluate(async()=>{
        const {viewerService}=await import('/src/platform/viewer/ViewerService.ts'),C=window.Cesium,v=viewerService.require(),time=C.JulianDate.now()
        const markers=v.entities.values.filter(e=>e.properties?.taskSupportStation?.getValue(time)),point=C.SceneTransforms.worldToWindowCoordinates(v.scene,markers[2].position.getValue(time)),rect=v.canvas.getBoundingClientRect()
        return {x:point.x+rect.left,y:point.y+rect.top,offset:markers[2].properties.offsetM.getValue(time),picks:v.scene.drillPick(point,16).map(p=>p.id?.id??p.id?.name??'primitive')}
      })
      await page.mouse.click(screen.x,screen.y)
      await wait(async()=>await page.getByTestId('support-station-2').getAttribute('data-selected')==='true',20000)
      if(!(await page.getByTestId('support-station-selection').innerText()).includes(screen.offset.toFixed(2)))throw Error('三维选点未同步文字记录')
      if(!(await detail.innerText()).includes('工段实测')||!(await detail.innerText()).includes('未提供'))throw Error('缺少实测资料被误报')
      if(!(await layoutState()).sameModels||taskIds.length!==count)throw Error('站位联动重新装配或创建任务')
      await page.screenshot({path:`${root}/${entry.id}-layout-linked.png`})
      const finding=page.getByTestId('support-layout-finding')
      const evidencePanel=page.getByTestId('support-evidence-gaps')
      if(!await evidencePanel.isVisible()||!(await evidencePanel.innerText()).includes('重复取景和显隐不能补齐证据'))throw Error('页面缺少证据缺口及停止条件')
      if(!query.every(s=>s.reviewEvidence?.engineeringAcceptance==='not-verified'&&s.reviewEvidence?.evidenceGaps.length===3&&s.reviewEvidence?.recordStatus==='consistent'))throw Error('智能体支护报告未保留记录核查与工程验收边界')
      if(!(await finding.innerText()).includes('工程验收尚未核验'))throw Error('任务核对说明缺失资料/验收边界')
      if(!query.flatMap(s=>s.longitudinalLayout.findings).some(f=>f.rowId===row.id&&f.acceptance==='not-verified'&&f.designRequirement===null&&f.fieldMeasurement===null))throw Error('只读报告的任务说明与实际资料边界不符')
      await finding.scrollIntoViewIfNeeded();await page.screenshot({path:`${root}/${entry.id}-layout-finding.png`})
      if(process.env.VERIFY_SUPPORT_REVIEW==='1'){
        await page.getByTestId('support-review-interface').click()
        const last=row.offsetsM.at(-1)
        await wait(async()=>(await page.getByTestId('support-station-selection').innerText()).includes(last.toFixed(2)))
        await page.getByTestId('support-review-components').click()
        await page.getByTestId('support-review-evidence').click()
        if(!(await page.getByTestId('support-review-question').innerText()).includes('未提供'))throw Error('来源核对步骤没有保留资料缺口')
        if(!(await page.getByTestId('support-station-selection').innerText()).includes(last.toFixed(2)))throw Error('步骤切换覆盖了前序选择')
        await page.getByTestId('support-review-conclusion').click()
        const history=await page.getByTestId('support-review-history').innerText()
        if(!history.includes(screen.offset.toFixed(2))||!history.includes('非验收通过'))throw Error('前序定位证据丢失或误报通过')
        await page.getByTestId('support-review-restore').click()
        const gap=await page.evaluate(async before=>{const {viewerService}=await import('/src/platform/viewer/ViewerService.ts');return window.Cesium.Cartesian3.distance(viewerService.require().camera.positionWC,window.Cesium.Cartesian3.fromArray(before))},entryCamera)
        if(gap>.001||!(await layoutState()).sameModels||taskIds.length!==count)throw Error('核对步骤未正确恢复视角或更换了模型/任务')
        const progress=await page.evaluate(async()=>{const {getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts');const {inspectTaskEvidenceProgress,inspectTaskEvidenceJournal}=await import('/src/platform/tasks/TaskEvidenceJournal.ts');const id=getTaskWorkflowController().getStatus().taskId;return {progress:inspectTaskEvidenceProgress(id),locations:inspectTaskEvidenceJournal(id)}})
        if(JSON.stringify(progress.progress.steps.map(step=>step.stepId))!==JSON.stringify(['interface','components','evidence','conclusion'])||progress.progress.questionsStatus!=='unanswered-requires-task-evidence'||!progress.locations.some(location=>location.offsetM===last&&location.reviewStep?.id==='interface'))throw Error('步骤访问或定位问题上下文不准确')
        const panel=page.getByTestId('support-review-progress')
        if((await panel.innerText()).split('已记录访问，仍待核查').length-1!==4)throw Error('页面核查进度没有即时更新')
        const selector=page.getByTestId('support-layout-component'),oldRow=await selector.inputValue()
        const options=await selector.locator('option').evaluateAll(nodes=>nodes.map(node=>node.value))
        const otherRow=options.find(value=>value!==oldRow)
        if(otherRow){
          await selector.selectOption(otherRow)
          if((await panel.innerText()).includes('已记录访问，仍待核查'))throw Error('其他构件行串用了原行步骤')
          if(!(await page.getByTestId('support-evidence-assessment').innerText()).includes('本行尚无保留的交互事实'))throw Error('其他构件行串用了事实摘要')
          await selector.selectOption(oldRow)
          if((await panel.innerText()).split('已记录访问，仍待核查').length-1!==4)throw Error('切回原行丢失核查步骤')
        }
        report.cases.at(-1).reviewProgress=progress
        report.cases.at(-1).supportReview={passed:true,history,restoredPositionErrorM:gap}
        await page.screenshot({path:`${root}/${entry.id}-review.png`})
      }
      await detail.locator(':scope > summary').click()
      await wait(async()=>(await layoutState()).markers.length===0)
      await detail.locator(':scope > summary').click()
      await wait(async()=>!!(await layoutState()).markers.length)
      const evidence=await page.evaluate(async()=>{const {getTaskWorkflowController}=await import('/src/platform/tasks/TaskWorkflowBridge.ts');const {inspectTaskEvidenceJournal}=await import('/src/platform/tasks/TaskEvidenceJournal.ts');return inspectTaskEvidenceJournal(getTaskWorkflowController().getStatus().taskId)})
      if(!evidence.some(e=>e.source==='2d'&&e.offsetM===row.offsetsM[1])||!evidence.some(e=>e.source==='3d'&&e.offsetM===screen.offset)||evidence.some(e=>e.engineeringAcceptance!=='not-verified'||!e.assetPaths.length))throw Error('Actual 2D/3D evidence missing or overstated')
      report.cases.at(-1).locationEvidence=evidence
      report.cases.at(-1).supportLayout={passed:true,row,markers:initial.markers.length,picked2d:row.offsetsM[1],picked3d:screen.offset,sameModels:true,taskCountUnchanged:true}
    }
    if(process.env.VERIFY_SUPPORT_LAYOUT==='1'&&entry.reset){
      const remaining=await page.evaluate(async()=>{const {viewerService}=await import('/src/platform/viewer/ViewerService.ts'),C=window.Cesium;return viewerService.require().entities.values.filter(e=>e.properties?.taskSupportStation?.getValue(C.JulianDate.now())).length})
      if(remaining)throw Error('复位后纵向布置定位标记残留')
      if(await page.evaluate(async()=>{const {taskLocationEvidence}=await import('/src/platform/tasks/TaskEvidenceJournal.ts');return taskLocationEvidence.value.length}))throw Error('复位后定位证据残留')
    }
    if (process.env.ACCEPTANCE_NO_SCREENSHOTS !== '1') await page.screenshot({ path: `${root}/${entry.id}.png`, timeout: 60000 })
    console.log(`PASS ${entry.id}`)
  }
  if (report.errors.length) throw new Error(report.errors.join('\n'))
  report.passed = true
} catch (error) { report.failure = error.message; if(page){await writeFile(`${root}/failure.html`,await page.content().catch(()=>''));await page.screenshot({path:`${root}/failure.png`,timeout:10000}).catch(()=>{})} throw error }
finally { await writeFile(`${root}/report.json`, JSON.stringify(report, null, 2)); await browser.close() }
