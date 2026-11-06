import { chromium } from 'playwright-core'
import { writeFile } from 'node:fs/promises'
const app = process.env.BROWSER_APP_URL || 'http://localhost:5178'
const designOnly = process.env.DESIGN_ONLY === '1'
const browser = await chromium.launch({ headless: true,
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
  const errors = []; let taskId
  const taskIds = new Set(); let designAttempts = 0
  if (process.env.INJECT_DESIGN_503 === '1') await page.route('**/data/blast/blast-design.json', route => {
    designAttempts++
    return designAttempts === 1 ? route.fulfill({ status: 503, body: 'Injected agent recovery test' }) : route.continue()
  })
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().endsWith('/api/ai-agent/task-runs')) {
      taskId = request.postDataJSON()?.task?.taskId
      taskIds.add(taskId)
    }
  })
  await page.route(`${app}/api/**`, route => { const url = new URL(route.request().url()); url.port = '3000'; return route.continue({ url: url.toString() }) })
  await page.goto(app, { waitUntil: 'domcontentloaded' })
  await page.locator('.agent-fab').click()
  await page.locator('.agent-input').fill(designOnly ? 'YK1+346 炮孔施工交底，只调出二维设计图和分类数量、循环进尺，不需要扫描点云。' : 'YK1+346 爆破施工交底，请调出炮孔二维设计图，核对炮孔分类和循环进尺，并与爆后点云同屏对照。')
  await page.locator('.send-btn').click()
  const deadline = Date.now() + 240000
  let ready = false
  while (Date.now() < deadline) {
    ready = await page.evaluate(async designOnly => {
      const { resourceManager: rm } = await import('/src/platform/resources/ResourceManager.ts')
      return rm.getState('blast.design-data').status === 'loaded' && (designOnly ? rm.getState('blast.effect').status === 'idle' : rm.getState('blast.effect').status === 'loaded') &&
        !!document.querySelector('.d2d-svg circle') && document.querySelector('.agent-assembly-info')?.textContent.includes('炮孔设计')
    }, designOnly)
    if (ready) break
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  if (!ready) throw new Error(`Agent design assembly did not finish: ${await page.locator('body').innerText()}`)
  const summary = await page.evaluate(async () => {
    const { getBlastDesignSummary } = await import('/src/modules/blast/design-resource.ts')
    return getBlastDesignSummary()
  })
  let snapshot
  for (let attempt = 0; attempt < 30; attempt++) {
    const snapshots = await fetch(`http://localhost:3000/api/ai-agent/task-runs/${taskId}/snapshots`).then(r => r.json())
    snapshot = snapshots.at(-1)
    if (snapshot?.workflow_state?.status === 'completed') break
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  if (!snapshot?.data_versions?.some(version => version.locator === '/data/blast/blast-design.json')) throw new Error('Missing design provenance')
  if (summary.holeCount !== 185 || errors.length) throw new Error(JSON.stringify({ summary, errors }))
  const chat = await page.locator('.agent-messages').innerText()
  if (!chat.includes('185') || !chat.includes('2.2') || !chat.includes('非目标工点实测')) throw new Error(`Missing verified design response: ${chat}`)
  if (process.env.INJECT_DESIGN_503 === '1' && (designAttempts !== 2 || taskIds.size !== 1)) throw new Error('Retry must recover the same task exactly once')
  if (process.env.INJECT_DESIGN_503 === '1' && chat.includes('0/1')) throw new Error('Task progress remained stale after recovery')
  await page.screenshot({ path: `docs/verification/2026-11-05-agent-blast-design${process.env.INJECT_DESIGN_503 === '1' ? '-recovery' : designOnly ? '-only' : ''}.png`, timeout: 60000 })
  const result = { taskId, designOnly, designAttempts, taskCount: taskIds.size, summary, chat, svgHoles: await page.locator('.d2d-svg circle').count(),
    status: snapshot.workflow_state.status, assets: snapshot.data_versions.map(version => version.locator), errors }
  await writeFile(`docs/verification/2026-11-05-agent-blast-design${process.env.INJECT_DESIGN_503 === '1' ? '-recovery' : designOnly ? '-only' : ''}.json`, JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result))
} finally { await browser.close() }
