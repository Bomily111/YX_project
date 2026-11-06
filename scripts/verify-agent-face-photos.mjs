import { chromium } from 'playwright-core'
import { writeFile } from 'node:fs/promises'
const app = process.env.BROWSER_APP_URL || 'http://localhost:5178'
const gpr = process.env.GPR_REFERENCE === '1'
const triple = process.env.TRIPLE_SCENE === '1'
const browser = await chromium.launch({ headless: true,
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
  const errors = []; let taskId
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/ai-agent/task-runs')) taskId = request.postDataJSON()?.task?.taskId })
  await page.route(`${app}/api/**`, route => { const url = new URL(route.request().url()); url.port = '3000'; return route.continue({ url: url.toString() }) })
  await page.goto(app, { waitUntil: 'domcontentloaded' })
  await page.locator('.agent-fab').click()
  await page.locator('.agent-input').fill(triple ? 'YK2+244 超前探测与支护施工交底，请同屏装配一张掌子面模型、ZZ-Va支护断面和现有超前水平钻模型，查看它们的空间关系，不需要二维照片、TSP或TEM。' : gpr ? 'YK2+244 掌子面前方雷达复核，请装配一张掌子面模型，并调出GPR测线1剖面同屏参考，不需要TSP、TEM或支护。' : 'YK2+244 施工地质交底，请装配一张掌子面模型和ZZ-Va支护断面，查看掌子面支护关系，不要二维照片或多切片切换，也不需要TSP或TEM模型。')
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
  if (await page.locator('.face-photo-reference').count()) throw new Error('Unexpected 2D photo panel')
  const assets = snapshot?.data_versions?.map(version => version.locator) ?? []
  const loaded = snapshot.resources.filter(resource => resource.status === 'loaded').map(resource => resource.id)
  if (!loaded.includes(gpr ? 'rock.gpr-line1' : 'support.modeler-zz-va') || assets.filter(path => path.includes('/face_sketch/')).length !== 1) throw new Error('Incorrect task assembly or redundant photos')
  if (triple && !loaded.includes('rock.advance-drill')) throw new Error('Missing task-required drill model')
  if (snapshot.workflow_state.steps.at(-1).action !== 'scene.finalize') throw new Error('Missing independent final enhancement step')
  const chat = await page.locator('.agent-messages').innerText()
  const sliceState = await page.evaluate(async () => {
    const { getActiveFaceSlices } = await import('/src/modules/face-sketch/resources.ts')
    const slices = getActiveFaceSlices()
    return { count: slices.length, visible: slices.filter(slice => slice.show).length, walls: slices.filter(slice => !!slice.wall).length }
  })
  if (sliceState.count !== 1 || sliceState.visible !== 1 || sliceState.walls !== 1) throw new Error('Missing 3D face slices')
  await new Promise(resolve => setTimeout(resolve, 1000))
  if (!chat.includes('X1DK') || !chat.includes('尚未建立') || errors.length) throw new Error(JSON.stringify({ chat, errors }))
  let radar
  if (gpr) {
    await page.locator('.gpr-float canvas').waitFor()
    radar = await page.locator('.gpr-float canvas').evaluate(canvas => {
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
      return { width: canvas.width, height: canvas.height, shades: new Set(Array.from(pixels).filter((_, i) => i % 4 === 0)).size }
    })
    if (radar.shades < 10 || !assets.includes('/data/GPR_new/output/radargram_line1.json')) throw new Error('Missing real radargram pixels or provenance')
  }
  await page.locator('.tunnel-loading-overlay').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {})
  await page.screenshot({ path: `docs/verification/2026-11-05-agent-${triple ? 'task-triple' : gpr ? 'gpr-face' : 'face-photos'}.png`, timeout: 60000 })
  const result = { taskId, sliceState, radar, status: snapshot.workflow_state.status, loaded, assets, chat, errors }
  await writeFile(`docs/verification/2026-11-05-agent-${triple ? 'task-triple' : gpr ? 'gpr-face' : 'face-photos'}.json`, JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result))
} finally { await browser.close() }
