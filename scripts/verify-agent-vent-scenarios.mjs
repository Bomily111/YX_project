import { chromium } from 'playwright-core'
import { writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
const app = process.env.BROWSER_APP_URL || 'http://localhost:5178'
const thermal = process.env.THERMAL_CASE === '1'
const cases = thermal ? [
  { id: 'ventilation.thermal-t200s', file: 'cfd_transient_t200s.json', label: 't=200s', request: 'YK4+000 请展示模拟开始后200秒的右洞温度场和出口温度历程，不需要稳态风速流线。' },
  { id: 'ventilation.thermal-t600s', file: 'cfd_transient_t600s.json', label: 't=600s', request: 'YK4+000 请查看热场模拟10分钟时的右洞温度分布和出口温度历程。' },
] : [
  { id: 'ventilation.transient-fan-shutdown', file: 'transient_fan_shutdown.json', label: '右线风机故障停机',
    request: 'YK4+000 右线风机突然停机，调出对应瞬态风网流量随时间变化曲线，不要默认爬升工况，也不需要三维风场。' },
  { id: 'ventilation.transient-fan-oscillation', file: 'transient_fan_oscillation.json', label: '右线风机波动',
    request: 'YK4+000 右线风机在60%到100%间波动，请查看对应瞬态网络流量变化，不需要稳态CFD。' },
]
const browser = await chromium.launch({ headless: true,
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const results = []
try {
  for (const entry of cases) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
    const errors = []; let taskId
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => {
      if (request.method() === 'POST' && request.url().endsWith('/api/ai-agent/task-runs')) taskId = request.postDataJSON()?.task?.taskId
    })
    await page.route(`${app}/api/**`, route => { const url = new URL(route.request().url()); url.port = '3000'; return route.continue({ url: url.toString() }) })
    await page.goto(app, { waitUntil: 'domcontentloaded' })
    await page.locator('.agent-fab').click()
    await page.locator('.agent-input').fill(entry.request)
    await page.locator('.send-btn').click()
    let snapshot; const deadline = Date.now() + 120000
    while (Date.now() < deadline) {
      if (taskId) {
        const snapshots = await fetch(`http://localhost:3000/api/ai-agent/task-runs/${taskId}/snapshots`).then(r => r.json())
        snapshot = snapshots.at(-1)
        if (snapshot?.workflow_state?.status === 'completed') break
        if (snapshot?.workflow_state?.status === 'failed') throw new Error(JSON.stringify(snapshot.workflow_state))
      }
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    const assets = snapshot?.data_versions?.map(version => version.locator) ?? []
    if (snapshot?.workflow_state?.status !== 'completed' || !assets.includes(`/data/ventilation/${entry.file}`) ||
        assets.includes('/data/ventilation/transient_fan_ramp_up.json')) throw new Error('Incorrect scenario provenance')
    const chart = page.locator('[data-ventilation-enhancement="chart"]')
    await chart.waitFor()
    const chartBox = await chart.boundingBox()
    const chatBox = await page.locator('.agent-input').boundingBox()
    if (!chartBox || !chatBox || chartBox.x + chartBox.width > chatBox.x) throw new Error('Scenario chart is covered by chat')
    if (!(await chart.innerText()).includes(entry.label) || await chart.locator('canvas').count() < 1 || errors.length) throw new Error('Missing scenario chart or page error')
    const chat = await page.locator('.agent-messages').innerText()
    if (!chat.includes(thermal ? '指数松弛' : '一维网络') || !chat.includes(entry.label)) throw new Error('Scenario explanation missing')
    let field
    if (thermal) {
      field = await page.evaluate(async () => {
        const { layers } = await import('/src/views/ventilation-module/cesiumVentilation.ts')
        return { count: layers.points?.length, first: layers.points?.get(0).id,
          left: Array.from({ length: layers.points?.length ?? 0 }, (_, i) => layers.points.get(i).id.tunnel).filter(tunnel => tunnel === 'left').length }
      })
      const data = JSON.parse(readFileSync(`public/data/ventilation/${entry.file}`, 'utf8'))
      if (field.count !== 3340 || field.left || field.first.kind !== 'thermal' || field.first.temperature !== data.temp[field.first.index]) throw new Error('Incorrect thermal slice rendering')
    }
    results.push({ id: entry.id, taskId, status: snapshot.workflow_state.status, assets, field, chartTitle: await chart.innerText(), errors })
    console.log(`PASS ${entry.id}`)
    if (results.length === 1) {
      await page.locator('.tunnel-loading-overlay').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {})
      await page.screenshot({ path: `docs/verification/2026-11-05-agent-${thermal ? 'thermal-slices' : 'vent-scenarios'}.png`, timeout: 60000 })
    }
    await page.close()
  }
  if (thermal) {
    const page = await browser.newPage()
    let tasks = 0, slices = 0
    page.on('request', request => {
      if (request.method() === 'POST' && request.url().endsWith('/api/ai-agent/task-runs')) tasks++
      if (/cfd_transient_t\d+s\.json/.test(request.url())) slices++
    })
    await page.goto(app, { waitUntil: 'domcontentloaded' })
    await page.locator('.agent-fab').click()
    await page.locator('.agent-input').fill('YK4+000 查看模拟250秒时的温度场。')
    await page.locator('.send-btn').click()
    await page.waitForFunction(() => document.querySelector('.agent-messages')?.textContent.includes('没有模拟 250 秒'))
    if (tasks || slices) throw new Error('Unsupported time unexpectedly assembled a slice')
    results.push({ id: 'unsupported-250s', clarified: true, tasks, slices })
    await page.close()
  }
  await writeFile(`docs/verification/2026-11-05-agent-${thermal ? 'thermal-slices' : 'vent-scenarios'}.json`, JSON.stringify(results, null, 2))
} finally { await browser.close() }
