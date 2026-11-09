import { chromium } from 'playwright-core'
import { writeFile } from 'node:fs/promises'
const app = process.env.BROWSER_APP_URL || 'http://localhost:5178'
const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const report = { errors: [], passed: false }
const wait = async fn => {
  const end = Date.now() + 120000
  while (Date.now() < end) { const value = await fn(); if (value) return value; await new Promise(resolve => setTimeout(resolve, 300)) }
  throw new Error('Capability query timed out')
}
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  const events = []; let tasks = 0
  page.on('pageerror', error => report.errors.push(error.message))
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().endsWith('/api/ai-agent/task-runs')) tasks++
    if (request.method() === 'POST' && request.url().endsWith('/api/ai-agent/task-events')) events.push(request.postDataJSON())
  })
  await page.route(`${app}/api/**`, route => { const url = new URL(route.request().url()); url.port = '3000'; return route.continue({ url: url.toString() }) })
  await page.goto(app, { waitUntil: 'domcontentloaded' })
  const loaded = () => page.evaluate(async () => { const { resourceManager } = await import('/src/platform/resources/ResourceManager.ts'); return resourceManager.listStates().filter(state => state.status === 'loaded').map(state => state.id).sort() })
  await wait(async () => (await loaded()).includes('common.tunnel'))
  const before = await loaded()
  await page.locator('.agent-fab').click()
  await page.locator('.agent-input').fill('目前平台支持哪些场景模型和资料？请先核查资源目录，简要介绍能力和资料对应的限制，不要装配。')
  await page.locator('.agent-input').press('Enter')
  await wait(() => page.locator('.agent-messages .msg-row.assistant').count())
  await page.locator('.agent-input').fill('idle probe'); await wait(() => page.locator('.send-btn').isEnabled()); await page.locator('.agent-input').fill('')
  const audits = events.filter(event => event.action === 'inspect_scene_capabilities')
  const after = await loaded()
  if (tasks || JSON.stringify(before) !== JSON.stringify(after) || !audits.length || audits.some(event => event.status !== 'completed' || !event.resultSummary.capabilityCount || event.resultSummary.targetDataVerified !== false) || report.errors.length) throw new Error(JSON.stringify({ tasks, before, after, audits, errors: report.errors }))
  report.reply = await page.locator('.agent-messages .msg-row.assistant').last().innerText()
  report.capabilityCount = audits.at(-1).resultSummary.capabilityCount
  report.loadedResourcesUnchanged = true; report.tasksCreated = tasks; report.passed = true
  console.log(JSON.stringify(report))
} catch (error) { report.failure = error.message; throw error }
finally { await writeFile('docs/verification/2026-11-07-capabilities-query.json', JSON.stringify(report, null, 2)); await browser.close() }
