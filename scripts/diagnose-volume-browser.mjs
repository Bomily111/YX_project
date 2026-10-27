import { chromium } from 'playwright-core'

const appUrl = process.env.BROWSER_APP_URL || 'http://localhost:5173'
const apiPort = process.env.BROWSER_API_PORT || '3000'
const seconds = Number(process.env.DIAGNOSE_SECONDS || 45)
const scenario = process.env.BROWSER_SCENARIO || 'hardness-support'
const prompt = scenario === 'tem'
  ? '在 YK2+244 展示瞬变电磁视电阻率模型'
  : '在 YK1+346 同屏展示 TSP 围岩坚硬度和结构树支护组合'
const traffic = []
const errors = []
const watchdog = setTimeout(() => {
  console.log(JSON.stringify({ timedOut: true, traffic, errors: errors.slice(0, 30) }, null, 2))
  process.exit(124)
}, (seconds + 15) * 1000)
watchdog.unref()
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error' || /ShareVolume|GeoModelController/.test(message.text())) {
      errors.push(`${message.type()}: ${message.text().slice(0, 300)}`)
    }
  })
  page.on('response', response => {
    if (/tsp_actual|geophysical_tem|ai-agent\/chat/.test(response.url())) {
      traffic.push({ status: response.status(), url: response.url() })
    }
  })
  page.on('requestfailed', request => {
    traffic.push({ failure: request.failure()?.errorText, url: request.url() })
  })
  await page.route(`${appUrl}/api/**`, route => {
    const url = new URL(route.request().url())
    url.port = apiPort
    return route.continue({ url: url.toString() })
  })
  await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  const webgl = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl')
    return {
      supported: !!gl,
      version: gl?.getParameter(gl.VERSION) ?? null,
      maxTextureSize: gl?.getParameter(gl.MAX_TEXTURE_SIZE) ?? null,
      renderer: gl?.getParameter(gl.RENDERER) ?? null,
    }
  })
  await page.locator('.agent-fab').click()
  await page.locator('.agent-input').fill(prompt)
  await page.locator('.send-btn').click()
  await page.waitForTimeout(seconds * 1000)
  const ui = await page.evaluate(() => ({
    status: document.querySelector('#status')?.textContent?.trim() ?? null,
    volumeCanvas: !!document.querySelector('#volume-canvas'),
    reply: [...document.querySelectorAll('.agent-messages .msg-row.assistant .msg-bubble')].map(el => el.textContent?.trim()).slice(-2),
  }))
  console.log(JSON.stringify({ webgl, ui, traffic, errors: errors.slice(0, 30) }, null, 2))
} finally {
  await browser.close()
}
