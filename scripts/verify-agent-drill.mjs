import { chromium } from 'playwright-core'
import { writeFile } from 'node:fs/promises'
const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
  const app = 'http://localhost:5178'; let taskId; const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/ai-agent/task-runs')) taskId = request.postDataJSON()?.task?.taskId })
  await page.route(`${app}/api/**`, route => { const url = new URL(route.request().url()); url.port = '3000'; return route.continue({ url: url.toString() }) })
  await page.goto(app, { waitUntil: 'domcontentloaded' }); await page.locator('.agent-fab').click()
  await page.locator('.agent-input').fill('YK2+244 超前探测施工交底，请装配现有超前水平钻示例模型，查看钻孔沿隧道前方的布置，不要掌子面照片、TSP或TEM。')
  await page.locator('.send-btn').click()
  let snapshot; const deadline = Date.now() + 120000
  while (Date.now() < deadline) {
    if (taskId) {
      const snapshots = await fetch(`http://localhost:3000/api/ai-agent/task-runs/${taskId}/snapshots`).then(r => r.json())
      snapshot = snapshots.at(-1)
      if (snapshot?.workflow_state?.status === 'completed') break
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  const models = await page.evaluate(async () => {
    const { getActiveDrillModels } = await import('/src/modules/rock/drill-resource.ts')
    return getActiveDrillModels().map(model => ({ ready: model.ready, show: model.show, radius: model.boundingSphere.radius }))
  })
  const assets = snapshot?.data_versions?.map(version => version.locator) ?? []
  const loaded = snapshot?.resources?.filter(resource => resource.status === 'loaded').map(resource => resource.id) ?? []
  if (models.length !== 2 || models.some(model => !model.ready || !model.show) || assets.filter(path => path.includes('/ahd/')).length !== 2 ||
      snapshot?.workflow_state?.status !== 'completed' || loaded.some(id => id.startsWith('rock.') && id !== 'rock.advance-drill') || errors.length) throw new Error(JSON.stringify({ models, loaded, assets, errors }))
  await page.locator('.tunnel-loading-overlay').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {})
  await page.screenshot({ path: 'docs/verification/2026-11-05-agent-drill.png', timeout: 60000 })
  const result = { taskId, models, assets, loaded, status: snapshot.workflow_state.status, errors }
  await writeFile('docs/verification/2026-11-05-agent-drill.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result))
} finally { await browser.close() }
