import { chromium } from 'playwright-core'
import { writeFile } from 'node:fs/promises'
const app = process.env.BROWSER_APP_URL || 'http://localhost:5178'
const prefix = 'docs/verification/2026-11-05-agent-blast-layer-control'
const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const report = { cases: [], errors: [], passed: false }
let activePage
const wait = async (fn, timeout = 180000) => {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) { const result = await fn(); if (result) return result; await new Promise(resolve => setTimeout(resolve, 300)) }
  throw new Error('Blast layer control condition timed out')
}
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  activePage = page
  const tasks = [], chats = []
  page.on('pageerror', error => report.errors.push(error.message))
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().endsWith('/api/ai-agent/task-runs')) tasks.push(request.postDataJSON().task.taskId)
    if (request.method() === 'POST' && request.url().endsWith('/api/ai-agent/chat')) chats.push(request.postDataJSON())
  })
  await page.route(`${app}/api/**`, route => { const url = new URL(route.request().url()); url.port = '3000'; return route.continue({ url: url.toString() }) })
  const send = async text => {
    const before = await page.locator('.agent-messages .msg-row.assistant').count()
    await page.locator('.agent-input').fill(text); await page.locator('.agent-input').press('Enter')
    await wait(async () => (await page.locator('.agent-messages .msg-row.assistant').count()) > before)
    await page.locator('.agent-input').fill('idle probe')
    await wait(() => page.locator('.send-btn').isEnabled(), 60000)
    await page.locator('.agent-input').fill('')
    return page.locator('.agent-messages .msg-row.assistant').last().innerText()
  }
  const state = () => page.evaluate(async () => {
    const { getBlastModel } = await import('/src/views/tunnel-module/blast.ts')
    const model = getBlastModel()
    const { layers } = await import('/src/views/ventilation-module/cesiumVentilation.ts')
    return { show: model?.show, holes: model?.getNode('holes').show, pointcloud: model?.getNode('pointcloud').show,
      sameModel: model === window.__blastControlModel, sameMatrix: model && Array.from({ length: 16 }, (_, i) => model.modelMatrix[i]).every((value, index) => value === window.__blastControlMatrix?.[index]),
      checkedHoles: document.querySelector('[data-testid="blast-holes-toggle"]')?.checked,
      checkedPointcloud: document.querySelector('[data-testid="blast-cloud-toggle"]')?.checked,
      points: layers.points?.length, streamlines: layers.streamlines?.length }
  })
  const assertLayers = async (holes, pointcloud, preserve = true) => {
    const actual = await state()
    if (actual.holes !== holes || actual.pointcloud !== pointcloud || actual.checkedHoles !== holes || actual.checkedPointcloud !== pointcloud ||
        (preserve && (!actual.sameModel || !actual.sameMatrix || actual.points !== 3340 || actual.streamlines !== 6))) throw new Error(JSON.stringify(actual))
    return actual
  }
  await page.goto(app, { waitUntil: 'domcontentloaded' }); await page.locator('.agent-fab').click()
  const unavailable = await send('只保留炮孔，隐藏爆后点云')
  if (!unavailable.includes('图层未修改') || tasks.length) throw new Error(`Unavailable model was modified: ${unavailable}`)
  report.cases.push({ id: 'no-model-protection', text: unavailable })
  await send('YK4+000 爆后通风复核，同屏展示右洞稳态风场与爆后点云。')
  if (tasks.length !== 1) throw new Error('Assembly did not create exactly one task')
  await page.evaluate(async () => {
    const { getBlastModel } = await import('/src/views/tunnel-module/blast.ts')
    window.__blastControlModel = getBlastModel()
    window.__blastControlMatrix = Array.from({ length: 16 }, (_, i) => getBlastModel().modelMatrix[i])
  })
  for (const visible of [false, true]) {
    const result = await page.evaluate(async visible => {
      const { executeTool } = await import('/src/ai-agent/ToolRegistry.ts')
      const { getTunnelGlbSegment } = await import('/src/utils/Common/DrawLine.ts')
      const outcome = JSON.parse(await executeTool('toggle_layer', { layer: 'tunnel', visible }))
      const models = Array.from({ length: 17 }, (_, index) => getTunnelGlbSegment(index)).filter(Boolean)
      return { outcome, models: models.map(model => model.show) }
    }, visible)
    if (!result.outcome.ok || !result.models.length || result.models.some(show => show !== visible)) throw new Error(JSON.stringify(result))
    report.cases.push({ id: `actual-tunnel-visible-${visible}`, ...result })
  }
  for (const [text, holes, cloud] of [
    ['只保留炮孔，隐藏爆后点云', true, false],
    ['只显示爆后点云，关闭炮孔', false, true],
  ]) {
    await send(text)
    report.cases.push({ id: text, state: await assertLayers(holes, cloud) })
  }
  await page.locator('[data-testid="blast-holes-toggle"]').check()
  await assertLayers(true, true)
  await send('隐藏爆后点云')
  report.cases.push({ id: 'manual-then-agent-preserves-holes', state: await assertLayers(true, false) })
  await page.screenshot({ path: `${prefix}.png`, timeout: 60000 })
  const audit = await fetch(`http://localhost:3000/api/ai-agent/task-runs/${tasks[0]}`).then(response => response.json())
  const controls = audit.events.filter(event => event.action === 'set_blast_layers')
  if (controls.length !== 3 || controls.some(event => event.status !== 'completed' || !event.result_summary?.layers)) throw new Error('Missing layer control audit results')
  report.taskId = tasks[0]; report.auditedControls = controls.map(event => event.result_summary.layers)
  if (tasks.length !== 1) throw new Error('Layer control rebuilt the task')
  await page.evaluate(async () => { const { default: router } = await import('/src/router/index.ts'); await router.push('/blast-twin?view=persp') })
  await wait(() => page.evaluate(async () => { const { getBlastModel } = await import('/src/views/tunnel-module/blast.ts'); return getBlastModel()?.ready }))
  if (await page.locator('.tm-layer-content [role="alert"]').count()) throw new Error(await page.locator('.tm-layer-content [role="alert"]').innerText())
  await page.locator('.agent-fab').click()
  await send('只显示爆后点云，关闭炮孔')
  report.cases.push({ id: 'blast-topic-agent', state: await assertLayers(false, true, false) })
  await page.locator('.tm-check').filter({ hasText: /^爆破效果$/ }).locator('input').evaluate(input => input.click())
  const hidden = await send('只保留炮孔，隐藏爆后点云')
  if (!hidden.includes('图层未修改') || (await state()).show !== false) throw new Error('Hidden master was silently enabled')
  report.cases.push({ id: 'hidden-master-protection', state: await assertLayers(false, true, false), text: hidden })
  if (tasks.length !== 1 || report.errors.length) throw new Error(JSON.stringify({ tasks, errors: report.errors }))
  for (const chat of chats) {
    const user = [...chat.messages].reverse().find(message => message.role === 'user')?.content
    if (typeof user === 'string' && !user.includes('YK4+000') && (chat.tools.length !== 1 || chat.tools[0].name !== 'set_blast_layers')) throw new Error('Layer control exposed unrelated or duplicated tools')
  }
  report.passed = true
  console.log(JSON.stringify(report))
} catch (error) {
  report.failure = error.message
  if (activePage) {
    await activePage.screenshot({ path: `${prefix}-failure.png`, timeout: 15000 }).catch(() => {})
    report.pageText = await activePage.locator('body').innerText({ timeout: 5000 }).catch(() => '')
  }
  throw error
}
finally { await writeFile(`${prefix}.json`, JSON.stringify(report, null, 2)); await browser.close() }
