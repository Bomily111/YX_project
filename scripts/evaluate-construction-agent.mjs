import { chromium } from 'playwright-core'
import { readFile, writeFile } from 'node:fs/promises'
const cases = JSON.parse(await readFile('scripts/agent-construction-cases.json', 'utf8'))
const browser = await chromium.launch({ headless: true,
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const page = await browser.newPage()
  const app = process.env.BROWSER_APP_URL || 'http://localhost:5178'
  await page.route(`${app}/api/**`, route => { const url = new URL(route.request().url()); url.port = '3000'; return route.continue({ url: url.toString() }) })
  await page.goto(app, { waitUntil: 'domcontentloaded' })
  await page.locator('.agent-fab').waitFor()
  const results = []
  for (const entry of cases) {
    const result = await page.evaluate(async entry => {
      const { AgentEngine } = await import('/src/ai-agent/AgentEngine.ts')
      const calls = []; let text = '', error
      await new AgentEngine().chat(entry.request, {}, {
        onText: delta => { text += delta }, onComplete: () => {}, onError: value => { error = value.message },
        onToolUse: async call => {
          calls.push({ name: call.name, input: call.input })
          return JSON.stringify({ ok: false, action: call.name, reason: 'Selection evaluation only; tools are not executed' })
        },
      }, 1)
      return { calls, text, error }
    }, entry)
    const expected = [...(entry.resources || [])].sort()
    const actual = [...(result.calls[0]?.input.resourceIds || [])].sort()
    const passed = !result.error && (entry.clarify ? result.calls.length === 0 && /里程|YK|工点|时间|秒|时间片/.test(result.text)
      : result.calls.length === 1 && result.calls[0].name === (entry.planOnly ? 'compose_scene_workflow' : 'assemble_scene_at_mileage') &&
        JSON.stringify(actual) === JSON.stringify(expected))
    results.push({ id: entry.id, request: entry.request, passed, ...result })
    console.log(`${passed ? 'PASS' : 'FAIL'} ${entry.id}`)
  }
  const report = { scope: 'AgentEngine input guards plus real online model selection; tool execution intercepted; not assembly acceptance',
    passed: results.filter(result => result.passed).length, total: results.length, results }
  await writeFile('docs/verification/2026-11-05-construction-agent-eval.json', JSON.stringify(report, null, 2))
  if (report.passed !== report.total) process.exitCode = 1
} finally { await browser.close() }
