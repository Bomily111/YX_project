import { chromium } from 'playwright-core'
import { mkdir, writeFile } from 'node:fs/promises'
const root = process.env.ACCEPTANCE_OUTPUT_DIR || 'docs/verification/acceptance-2026-11-05'
await mkdir(root, { recursive: true })
const app = process.env.BROWSER_APP_URL || 'http://localhost:5178'
const selectedCases = process.env.ACCEPTANCE_CASE_IDS?.split(',')
const cases = [
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
    if (entry.reject) report.cases.push({ id: entry.id, rejected: true, previousScenePreserved: true, elapsedMs: Date.now() - started })
    if (entry.reset) report.cases.push({ id: entry.id, reset: true, modelsReleased: true, elapsedMs: Date.now() - started })
    if (process.env.ACCEPTANCE_NO_SCREENSHOTS !== '1') await page.screenshot({ path: `${root}/${entry.id}.png`, timeout: 60000 })
    console.log(`PASS ${entry.id}`)
  }
  if (report.errors.length) throw new Error(report.errors.join('\n'))
  report.passed = true
} catch (error) { report.failure = error.message; throw error }
finally { await writeFile(`${root}/report.json`, JSON.stringify(report, null, 2)); await browser.close() }
