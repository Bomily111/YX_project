import { chromium } from 'playwright-core'
import { writeFile } from 'node:fs/promises'

const browser = await chromium.launch({ headless: true,
  executablePath: process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 720 } })
  const errors = []
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message) })
  await page.goto(`${process.env.BROWSER_APP_URL || 'http://localhost:5178'}/blast-twin?view=persp`, { waitUntil: 'domcontentloaded' })
  await page.locator('.tm-root').waitFor()
  const deadline = Date.now() + 60000
  while (!(await page.evaluate(async () => {
    const { getBlastModel } = await import('/src/views/tunnel-module/blast.ts')
    return getBlastModel()?.ready === true
  }))) {
    if (Date.now() > deadline) throw new Error('Blast topic model did not become ready')
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  const state = () => page.evaluate(async () => {
    const { getBlastModel } = await import('/src/views/tunnel-module/blast.ts')
    const model = getBlastModel()
    return { show: model.show, holes: model.getNode('holes').show, cloud: model.getNode('pointcloud').show }
  })
  const assertState = async expected => {
    const actual = await state()
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(JSON.stringify({ actual, expected }))
    return actual
  }
  // Inputs use custom styled labels; exercise the visible label as a user does.
  const toggle = testId => page.locator(`label:has([data-testid="${testId}"])`).click()
  const initial = await assertState({ show: true, holes: true, cloud: true })
  await toggle('blast-holes-toggle')
  const cloudOnly = await assertState({ show: true, holes: false, cloud: true })
  await toggle('blast-cloud-toggle')
  await assertState({ show: true, holes: false, cloud: false })
  await toggle('blast-holes-toggle')
  const holesOnly = await assertState({ show: true, holes: true, cloud: false })
  const master = page.locator('.tm-check').filter({ hasText: /^爆破效果$/ })
  await master.click()
  await assertState({ show: false, holes: true, cloud: false })
  await master.click()
  await assertState({ show: true, holes: true, cloud: false })
  await toggle('blast-cloud-toggle')
  await toggle('blast-holes-toggle')
  await assertState({ show: true, holes: false, cloud: true })
  if (errors.length) throw new Error(errors.join('\n'))
  const result = { initial, cloudOnly, holesOnly, masterPreservesSelection: true, errors }
  await writeFile('docs/verification/2026-11-05-blast-topic-layers.json', JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result))
  await page.screenshot({ path: 'docs/verification/2026-11-05-blast-topic-layers.png', timeout: 60000 })
} finally {
  await browser.close()
}
