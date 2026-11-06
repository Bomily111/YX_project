import { chromium } from 'playwright-core'
import { writeFile } from 'node:fs/promises'
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const app = process.env.BROWSER_APP_URL || 'http://localhost:5178'
const wait = async (page, predicate) => {
  const deadline = Date.now() + 90000
  while (!(await page.evaluate(predicate))) {
    if (Date.now() > deadline) throw new Error('Ventilation recovery timed out')
    await new Promise(resolve => setTimeout(resolve, 250))
  }
}
const fieldReady = async () => {
  const { resourceManager: rm } = await import('/src/platform/resources/ResourceManager.ts')
  const { layers } = await import('/src/views/ventilation-module/cesiumVentilation.ts')
  return layers.model?.ready === true && layers.points?.length === 6786 &&
    rm.getState('ventilation.steady-cfd').references === 1 && rm.getState('ventilation.co-analysis').status === 'idle'
}
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 720 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  let attempts = 0
  await page.route('**/data/ventilation/tunnel-assembled.glb', route => {
    attempts++
    return attempts === 1 ? route.fulfill({ status: 503, body: 'Injected recovery test' }) : route.continue()
  })
  await page.goto(`${app}/ventilation-twin`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('alert').waitFor()
  await page.getByRole('button', { name: '重试', exact: true }).click()
  await wait(page, fieldReady)
  if (await page.getByRole('alert').count()) throw new Error('Scene retry did not clear error')
  const select = name => page.getByRole('button', { name, exact: true }).click()
  let coAttempts = 0
  await page.route('**/data/ventilation/co_transport_results.json', route => {
    coAttempts++
    return coAttempts === 1 ? route.fulfill({ status: 503, body: 'Injected analysis failure' }) : route.continue()
  })
  await select('CO 爆破扩散')
  await page.getByRole('alert').waitFor()
  await page.getByRole('button', { name: '重试', exact: true }).click()
  await wait(page, async () => {
    const { resourceManager: rm } = await import('/src/platform/resources/ResourceManager.ts')
    return rm.getState('ventilation.co-analysis').status === 'loaded' && rm.getState('ventilation.co-analysis').references === 1
  })
  await select('三维风流'); await wait(page, fieldReady)
  await page.unroute('**/data/ventilation/co_transport_results.json')
  let releaseRequest, requestStarted
  let gate = new Promise(resolve => { releaseRequest = resolve })
  let started = new Promise(resolve => { requestStarted = resolve })
  await page.route('**/data/ventilation/co_transport_results.json', async route => {
    requestStarted(); await gate; await route.continue()
  })
  await select('CO 爆破扩散'); await started
  await select('通风设计'); await select('三维风流')
  releaseRequest()
  await wait(page, fieldReady)
  gate = new Promise(resolve => { releaseRequest = resolve })
  started = new Promise(resolve => { requestStarted = resolve })
  await select('CO 爆破扩散'); await started
  const navigation = page.evaluate(async () => {
    const { default: router } = await import('/src/router/index.ts'); await router.push('/')
  })
  releaseRequest(); await navigation
  await wait(page, async () => {
    const { resourceManager: rm } = await import('/src/platform/resources/ResourceManager.ts')
    return location.pathname === '/' && ['ventilation.scene', 'ventilation.steady-cfd', 'ventilation.co-analysis']
      .every(id => rm.getState(id).status === 'idle' && rm.getState(id).references === 0)
  })
  if (errors.length) throw new Error(errors.join('\n'))
  const result = { injectedScene503: true, retryLoaded: true, attempts, analysisRetryLoaded: true, coAttempts, latestTabWon: true,
    leftDuringAnalysisLoad: true, resourcesReleased: true, pageErrors: errors }
  await writeFile('docs/verification/2026-11-05-vent-recovery.json', JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result))
} finally { await browser.close() }
