import { chromium } from 'playwright-core'
import { mkdir, writeFile } from 'node:fs/promises'
const root = process.env.ACCEPTANCE_OUTPUT_DIR || 'docs/verification/acceptance-2026-11-05'
await mkdir(root, { recursive: true })
const app = process.env.BROWSER_APP_URL || 'http://localhost:5178'
const selectedCases = process.env.ACCEPTANCE_CASE_IDS?.split(',')
const cases = [
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
].filter(entry => !selectedCases || selectedCases.includes(entry.id))
if (!cases.length) throw new Error('No matching acceptance cases')
const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const report = { cases: [], errors: [], passed: false }
const wait = async (fn, timeout = 180000) => {
  const end = Date.now() + timeout
  while (Date.now() < end) { const value = await fn(); if (value) return value; await new Promise(resolve => setTimeout(resolve, 350)) }
  throw new Error('Acceptance condition timed out')
}
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  page.on('pageerror', error => report.errors.push(error.message))
  const taskIds = []
  page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/ai-agent/task-runs')) taskIds.push(request.postDataJSON().task.taskId) })
  await page.route(`${app}/api/**`, route => { const url = new URL(route.request().url()); url.port = '3000'; return route.continue({ url: url.toString() }) })
  await page.goto(app, { waitUntil: 'domcontentloaded' }); await page.locator('.agent-fab').click()
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
      const snapshot = await wait(async () => {
        const snapshots = await fetch(`http://localhost:3000/api/ai-agent/task-runs/${taskId}/snapshots`).then(r => r.json())
        const latest = snapshots.at(-1)
        if (latest?.workflow_state?.status === 'failed') throw new Error(`Task failed: ${JSON.stringify(latest.workflow_state)}`)
        return latest?.workflow_state?.status === 'completed' ? latest : null
      })
      const state = snapshot.workflow_state
      const final = state.sharedContext[`scene.stage.${state.total}`]?.value
      if (state.steps.at(-1).action !== 'scene.finalize' || final?.phase !== 'constructed-then-enhanced') throw new Error(`Missing final phase: ${entry.id}`)
      if (JSON.stringify([...final.assembledResourceIds].sort()) !== JSON.stringify([...entry.roots].sort())) throw new Error(`Wrong resources: ${entry.id}`)
      await wait(() => page.locator('.agent-assembly-run').innerText().then(text => text.includes(taskId)).catch(() => false))
      lastRoots = entry.roots
      report.cases.push({ id: entry.id, taskId, total: state.total, phase: final.phase, assets: snapshot.data_versions.map(value => value.locator), elapsedMs: Date.now() - started })
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
      const allowed = new Set(['common.tunnel', ...resourceRegistry.resolveLoadOrder(roots).map(resource => resource.id)])
      return { activePaths: [...allowed].flatMap(id => resourceRegistry.get(id)?.getActiveAssetPaths?.() ?? []), leaked: resourceManager.listStates().filter(state => state.status === 'loaded' && !allowed.has(state.id)).map(state => state.id),
        faces: getActiveFaceSlices().length, drills: getActiveDrillModels().filter(model => model.ready && model.show).length }
    }, lastRoots)
    if (runtime.leaked.length || runtime.faces !== (lastRoots.includes('rock.face-photos') ? 1 : 0) || runtime.drills !== (lastRoots.includes('rock.advance-drill') ? 2 : 0)) throw new Error(`Runtime mismatch ${entry.id}: ${JSON.stringify(runtime)}`)
    if (!entry.reject && !entry.reset && runtime.activePaths.some(path => !report.cases.at(-1).assets.includes(path))) throw new Error(`Snapshot omitted active asset: ${entry.id}`)
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
    if (process.env.ACCEPTANCE_NO_SCREENSHOTS !== '1') await page.screenshot({ path: `${root}/${entry.id}.png`, timeout: 60000 })
    console.log(`PASS ${entry.id}`)
  }
  if (report.errors.length) throw new Error(report.errors.join('\n'))
  report.passed = true
} catch (error) { report.failure = error.message; throw error }
finally { await writeFile(`${root}/report.json`, JSON.stringify(report, null, 2)); await browser.close() }
