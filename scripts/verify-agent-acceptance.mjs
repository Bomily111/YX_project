import { chromium } from 'playwright-core'
import { mkdir, writeFile } from 'node:fs/promises'
const root = process.env.ACCEPTANCE_OUTPUT_DIR || 'docs/verification/acceptance-2026-11-05'
await mkdir(root, { recursive: true })
const app = process.env.BROWSER_APP_URL || 'http://localhost:5178'
const selectedCases = process.env.ACCEPTANCE_CASE_IDS?.split(',')
const cases = [
  { id:'followup-base',request:'在论文测试工段展示三台阶和后方5米ZZ-Va支护，不用其他资料。',unitCount:5,roots:['rock.three-bench','support.test-section'] },
  { id:'followup-type',request:'把支护改成ZZ-IVb',followup:true,unitCount:5,roots:['rock.three-bench','support.test-section-zz-ivb'] },
  { id:'followup-length',request:'长度改为15米',followup:true,unitCount:15,roots:['rock.three-bench','support.test-section-zz-ivb'] },
  { id:'followup-both',request:'把支护改成Z-PM，长度改为8米',followup:true,unitCount:8,roots:['rock.three-bench','support.test-section-z-pm'] },
  { id:'followup-invalid',request:'长度改为21米',reject:true },
  { id:'followup-unknown',request:'把支护改成ZZ-VI',reject:true },
  { id: 'support-length-5', request: '在论文测试工段同屏展示三台阶与后方5米ZZ-Va支护，不用其他资料。', unitCount: 5, roots: ['rock.three-bench','support.test-section'] },
  { id: 'support-length-20', request: '在论文测试工段同屏展示三台阶与后方20米ZZ-Va支护，不用其他资料。', unitCount: 20, roots: ['rock.three-bench','support.test-section'] },
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
  let lastRoots = []
  for (const entry of cases) {
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
    if (entry.reject && taskIds.length !== beforeTasks) throw new Error(`Rejected request created a task: ${entry.id}`)
    if (entry.reset) {
      await wait(() => page.locator('.agent-assembly-info').count().then(count => count === 0))
      lastRoots = []
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
    if (runtime.leaked.length || runtime.faces !== (lastRoots.includes('rock.face-photos') ? 1 : 0) || runtime.drills !== (lastRoots.includes('rock.advance-drill') ? 2 : 0)) throw new Error(`Runtime mismatch ${entry.id}: ${JSON.stringify(runtime)}`)
    if (runtime.solids !== (lastRoots.includes('rock.three-bench') ? 1 : 0)) throw new Error('三台阶任务模型未正确加载或释放')
    if (runtime.testSupports !== (lastRoots.some(id => id === 'support.test-section' || id.startsWith('support.test-section-')) ? 1 : 0)) throw new Error('测试支护模型未正确加载或释放')
    const currentEnvironment=await environment()
    if(JSON.stringify(currentEnvironment)!==JSON.stringify(originalEnvironment)||!currentEnvironment.sameCanvas||currentEnvironment.canvasCount!==1)throw new Error(`任务改用了额外场景或背景: ${JSON.stringify(currentEnvironment)}`)
    report.unifiedEnvironment=currentEnvironment
    if (!entry.reject && !entry.reset && runtime.activePaths.some(path => !report.cases.at(-1).assets.includes(path))) throw new Error(`Snapshot omitted active asset: ${entry.id}`)
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
      if(support.type==='ZZ-Va'&&arch&&(arch.spacingM!==.8||arch.stations!==Math.ceil(support.summary.lengthM/.8)))throw new Error('ZZ-Va未沿用1064米示例0.8米钢架间距')
      if(support.type==='ZZ-IVb'&&arch&&(arch.spacingM!==1||arch.stations!==support.summary.lengthM))throw new Error('ZZ-IVb未沿用示例1米钢架间距')
      if (report.cases.at(-1).assets.some(path => path.includes('测试工段支护'))) throw new Error('仍使用已撤下的自建支护')
      report.cases.at(-1).existingSupport = support
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
    if (entry.reset) report.cases.push({ id: entry.id, reset: true, modelsReleased: true, elapsedMs: Date.now() - started })
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
    if (process.env.VERIFY_GEOMETRY_VIEWS === '1' && entry.unitCount === 20) {
      const views = await page.evaluate(async () => {
        const C=window.Cesium
        const { viewerService }=await import('/src/platform/viewer/ViewerService.ts')
        const { getActiveThreeBenchModel }=await import('/src/modules/rock/three-bench-resource.ts')
        const { getTestSectionSupportModels }=await import('/src/modules/support/test-section-resource.ts')
        const { default: profile }=await import('/src/modules/face-sketch/tunnel-normal-sections.json')
        const viewer=viewerService.require(),bench=getActiveThreeBenchModel(),models=getTestSectionSupportModels()
        const worldVector=source=>C.Cartesian3.normalize(C.Matrix4.multiplyByPointAsVector(bench.modelMatrix,new C.Cartesian3(source[2],source[1],-source[0]),new C.Cartesian3()),new C.Cartesian3())
        let maxAngle=0,maxGap=0
        models.forEach((model,i)=>{
          const actual=C.Cartesian3.normalize(C.Matrix4.multiplyByPointAsVector(model.modelMatrix,C.Cartesian3.UNIT_Z,new C.Cartesian3()),new C.Cartesian3())
          const expected=worldVector(profile.supportSections[i].frame.forward)
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
        const pose=(axis,vertical)=>({position:array(C.Cartesian3.add(sphere.center,C.Cartesian3.multiplyByScalar(axis,sphere.radius*3.6,new C.Cartesian3()),new C.Cartesian3())),direction:array(C.Cartesian3.negate(axis,new C.Cartesian3())),up:array(vertical),pan:sphere.radius*.6})
        return {maxSupportNormalAngleDeg:maxAngle,maxSupportJointGapM:maxGap,oldFixedCutAngleDeg:profile.oldFixedPlaneObliquityDeg,top:pose(up,forward),side:pose(lateral,up),original:{position:array(viewer.camera.positionWC),direction:array(viewer.camera.directionWC),up:array(viewer.camera.upWC)}}
      })
      if(views.maxSupportNormalAngleDeg>.0001||views.maxSupportJointGapM>.01)throw new Error(`实际支护法向/接缝不合格 ${JSON.stringify(views)}`)
      for(const name of ['top','side','original']){
        await page.evaluate(async pose=>{const {viewerService}=await import('/src/platform/viewer/ViewerService.ts');const C=window.Cesium,v=viewerService.require();v.camera.setView({destination:C.Cartesian3.fromArray(pose.position),orientation:{direction:C.Cartesian3.fromArray(pose.direction),up:C.Cartesian3.fromArray(pose.up)}});if(pose.pan)v.camera.moveRight(pose.pan);v.scene.requestRender()},views[name])
        await page.waitForTimeout(600)
        if(name!=='original')await page.screenshot({path:`${root}/${entry.id}-${name}.png`,timeout:60000})
      }
      report.cases.at(-1).geometry={maxSupportNormalAngleDeg:views.maxSupportNormalAngleDeg,maxSupportJointGapM:views.maxSupportJointGapM,oldFixedCutAngleDeg:views.oldFixedCutAngleDeg}
    }
    if (process.env.ACCEPTANCE_NO_SCREENSHOTS !== '1') await page.screenshot({ path: `${root}/${entry.id}.png`, timeout: 60000 })
    console.log(`PASS ${entry.id}`)
  }
  if (report.errors.length) throw new Error(report.errors.join('\n'))
  report.passed = true
} catch (error) { report.failure = error.message; if(page){await writeFile(`${root}/failure.html`,await page.content().catch(()=>''));await page.screenshot({path:`${root}/failure.png`,timeout:10000}).catch(()=>{})} throw error }
finally { await writeFile(`${root}/report.json`, JSON.stringify(report, null, 2)); await browser.close() }
