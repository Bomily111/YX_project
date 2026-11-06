import { chromium } from 'playwright-core'
import { writeFile } from 'node:fs/promises'

const browser = await chromium.launch({ headless: true,
  executablePath: process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const app = process.env.BROWSER_APP_URL || 'http://localhost:5178'
const wait = async (page, predicate) => {
  const deadline = Date.now() + 60000
  while (!(await page.evaluate(predicate))) {
    if (Date.now() > deadline) throw new Error('Resource recovery timed out')
    await new Promise(resolve => setTimeout(resolve, 250))
  }
}
const navigate = (page, path) => page.evaluate(async path => {
  const { default: router } = await import('/src/router/index.ts')
  await router.push(path)
}, path)
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 720 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  let attempts = 0
  await page.route('**/data/blast/blast_effect.glb', route => {
    attempts++
    return attempts === 1 ? route.fulfill({ status: 503, body: 'Injected recovery test' }) : route.continue()
  })
  await page.goto(`${app}/blast-twin`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('alert').waitFor()
  await page.getByRole('button', { name: '重试', exact: true }).click()
  await wait(page, async () => {
    const { getBlastModel } = await import('/src/views/tunnel-module/blast.ts')
    const { resourceManager } = await import('/src/platform/resources/ResourceManager.ts')
    return getBlastModel()?.ready === true && resourceManager.getState('blast.effect').references === 1
  })
  if (await page.getByRole('alert').count()) throw new Error('Retry did not clear the error')
  await navigate(page, '/')
  await wait(page, async () => {
    const { resourceManager } = await import('/src/platform/resources/ResourceManager.ts')
    return resourceManager.getState('blast.effect').status === 'idle'
  })
  await page.close()

  // A new page keeps the delayed request independent of the first model cache.
  const delayed = await browser.newPage({ viewport: { width: 1200, height: 720 } })
  delayed.on('pageerror', error => errors.push(error.message))
  let releaseRequest
  const gate = new Promise(resolve => { releaseRequest = resolve })
  let requestStarted
  const started = new Promise(resolve => { requestStarted = resolve })
  await delayed.route('**/data/blast/blast_effect.glb', async route => {
    requestStarted()
    await gate
    await route.continue()
  })
  await delayed.goto(`${app}/blast-twin`, { waitUntil: 'domcontentloaded' })
  await Promise.race([started, new Promise((_, reject) => setTimeout(() => reject(new Error('No delayed request')), 30000))])
  await navigate(delayed, '/')
  releaseRequest()
  await wait(delayed, async () => {
    const { resourceManager } = await import('/src/platform/resources/ResourceManager.ts')
    const { getBlastModel } = await import('/src/views/tunnel-module/blast.ts')
    return resourceManager.getState('blast.effect').status === 'idle' && !getBlastModel() &&
      resourceManager.getState('common.tunnel').status === 'loaded'
  })
  // Wait beyond the old 2.5s callback to detect errors from an obsolete page.
  await new Promise(resolve => setTimeout(resolve, 3000))
  if (errors.length) throw new Error(errors.join('\n'))
  const result = { injected503: true, retryLoaded: true, attempts,
    leftDuringLoad: true, obsoleteModelReleased: true, pageErrors: errors }
  await writeFile('docs/verification/2026-11-05-blast-recovery.json', JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result))
} finally {
  await browser.close()
}
