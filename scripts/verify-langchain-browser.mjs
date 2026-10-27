import { chromium } from 'playwright-core'

const progress = { requests: [], responses: [], errors: [], taskId: null, database: null }
const watchdog = setTimeout(() => {
  console.error('Browser verification exceeded the overall time limit', JSON.stringify(progress))
  process.exit(124)
}, Number(process.env.BROWSER_TIMEOUT_MS || 150_000))
watchdog.unref()

const appUrl = process.env.BROWSER_APP_URL || 'http://localhost:5173'
const apiPort = process.env.BROWSER_API_PORT || '3000'
const scenario = process.env.BROWSER_SCENARIO || 'hardness-support'
const scenarios = {
  'hardness-support': '在 YK1+346 同屏展示 TSP 围岩坚硬度和结构树支护组合',
  'construction-task': 'YK1+346 即将进行初期支护施工交底，请把岩体坚硬程度和现有支护布置放到同一场景查看',
  'design-grade': '在 YK1+346 展示设计围岩等级模型',
  'steel-frame': '在 YK1+346 只展示结构树既有钢架构件',
  tem: '在 YK2+244 展示瞬变电磁视电阻率模型',
  integrity: '在 YK2+244 展示 TSP 围岩完整度模型',
  'fusion-grade': '在 YK2+244 展示物探融合围岩等级模型',
  'missing-mileage': '展示围岩完整度模型',
  'plan-only': '先给我 YK1+346 的结构树支护组合展示计划，不执行',
}
if (!scenarios[scenario]) throw new Error(`Unknown browser scenario: ${scenario}`)
const apiUrl = new URL(appUrl)
apiUrl.port = apiPort
const health = await fetch(new URL('/api/ai-agent/health', apiUrl)).then(response => response.json())
if (health.provider !== 'deepseek' || !health.hasApiKey) {
  throw new Error('Browser verification requires the isolated DeepSeek backend')
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

try {
  // The contract check exercises dispatch and persistence; software WebGL at
  // full desktop resolution adds a large unrelated ray-marching load.
  const page = await browser.newPage({ viewport: {
    width: Number(process.env.BROWSER_WIDTH || 1100),
    height: Number(process.env.BROWSER_HEIGHT || 720),
  }, deviceScaleFactor: 1 })
  const errors = []
  const chatStatuses = []
  let taskRunsCreated = 0
  let createdTaskId = null
  let databasePollStarted = false
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') {
      errors.push(message.text())
      progress.errors.push(message.text().slice(0, 200))
    }
  })
  page.on('response', response => {
    if (response.url().includes('/api/ai-agent/chat')) chatStatuses.push(response.status())
    if (/ai-agent\/chat|task-snapshots|tsp_actual|geophysical_tem/.test(response.url())) {
      progress.responses.push({ status: response.status(), path: new URL(response.url()).pathname })
    }
  })
  page.on('request', request => {
    if (/ai-agent\/chat|task-snapshots|tsp_actual|geophysical_tem/.test(request.url())) {
      progress.requests.push(new URL(request.url()).pathname)
    }
    if (request.method() === 'POST' && request.url().endsWith('/api/ai-agent/task-runs')) {
      taskRunsCreated++
      createdTaskId = request.postDataJSON()?.task?.taskId ?? null
      progress.taskId = createdTaskId
      if (createdTaskId && !databasePollStarted) {
        databasePollStarted = true
        const endpoint = new URL(`/api/ai-agent/task-runs/${encodeURIComponent(createdTaskId)}/snapshots`, apiUrl)
        const poll = async () => {
          try {
            const response = await fetch(endpoint)
            if (response.ok) {
              const snapshots = await response.json()
              const latest = snapshots.at(-1)
              if (latest) progress.database = {
                status: latest.workflow_state?.status,
                completed: latest.workflow_state?.completed,
                total: latest.workflow_state?.total,
                loaded: latest.resources?.filter(item => item.status === 'loaded').length,
              }
            }
          } catch (error) {
            progress.database = { error: String(error) }
          }
          if (progress.database?.status !== 'completed') {
            const timer = setTimeout(poll, 2000)
            timer.unref()
          }
        }
        poll()
      }
    }
  })
  await page.route(`${appUrl}/api/**`, route => {
    const url = new URL(route.request().url())
    url.port = apiPort
    return route.continue({ url: url.toString() })
  })

  await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  try {
    await page.locator('.agent-fab').click({ timeout: 15_000 })
  } catch (error) {
    console.error('Agent entry unavailable', JSON.stringify({ errors, body: (await page.locator('body').innerText()).slice(0, 800) }))
    throw error
  }
  const repliesBefore = await page.locator('.agent-messages .msg-row.assistant .msg-bubble').count()
  await page.locator('.agent-input').fill(scenarios[scenario])
  await page.locator('.send-btn').click()
  let timedOut = false
  try {
    await page.waitForFunction(({ currentScenario, repliesBefore }) => {
      const replies = [...document.querySelectorAll('.agent-messages .msg-row.assistant .msg-bubble')]
        .map(el => el.textContent ?? '')
      if (replies.length <= repliesBefore) return false
      if (replies.slice(repliesBefore).some(text => /场景装配未完成|加载超时|执行失败/.test(text))) return true
      if (currentScenario === 'missing-mileage') return replies.slice(repliesBefore).some(text => /里程|YK/.test(text))
      if (currentScenario === 'plan-only') return replies.slice(repliesBefore).some(text => /计划|方案|步骤/.test(text))
      const mileage = document.querySelector('.agent-assembly-info h2')?.textContent?.trim()
      const resources = [...document.querySelectorAll('.agent-assembly-info li')].map(el => el.textContent ?? '')
      if (currentScenario === 'tem') return mileage === 'YK2+244' && resources.some(text => text.includes('TEM'))
      if (currentScenario === 'integrity') return mileage === 'YK2+244' && resources.some(text => text.includes('完整度'))
      if (currentScenario === 'fusion-grade') return mileage === 'YK2+244' && resources.some(text => text.includes('融合'))
      if (currentScenario === 'design-grade') return mileage === 'YK1+346' && resources.some(text => text.includes('设计'))
      if (currentScenario === 'steel-frame') return mileage === 'YK1+346' && resources.some(text => text.includes('钢架'))
      return mileage === 'YK1+346' && resources.length >= 2
    }, { currentScenario: scenario, repliesBefore }, { timeout: 180_000 })
  } catch {
    timedOut = true
  }
  if (scenario === 'missing-mileage' || scenario === 'plan-only') {
    await page.locator('.msg-bubble.streaming').waitFor({ state: 'hidden', timeout: 15_000 })
  }
  const snapshot = await page.evaluate(() => {
    return {
      assemblyMileage: document.querySelector('.agent-assembly-info h2')?.textContent?.trim() ?? null,
      assemblyResources: [...document.querySelectorAll('.agent-assembly-info li')].map(el => el.textContent?.trim()),
      assistantMessages: [...document.querySelectorAll('.agent-messages .msg-row.assistant .msg-bubble')].map(el => el.textContent?.trim()),
      chatText: document.querySelector('.agent-messages')?.textContent?.slice(-1500) ?? null,
      toolStatus: document.querySelector('.tool-status')?.textContent?.trim() ?? null,
      viewerInstanceId: document.querySelector('[data-viewer-instance-id]')?.getAttribute('data-viewer-instance-id') ?? null,
      cesiumCanvasCount: document.querySelectorAll('.cesium-widget canvas').length,
      volumeOverlay: (() => {
        const host = document.querySelector('#volume-container')
        const canvas = document.querySelector('#volume-canvas')
        const rect = host?.getBoundingClientRect()
        return { display: host ? getComputedStyle(host).display : null,
          width: rect?.width ?? 0, height: rect?.height ?? 0,
          canvasWidth: canvas?.width ?? 0, canvasHeight: canvas?.height ?? 0 }
      })(),
    }
  })
  if (process.env.CHECK_VOLUME_PIXELS === '1' && ['tem', 'integrity', 'fusion-grade', 'hardness-support', 'construction-task'].includes(scenario)) {
    snapshot.volumePixels = await page.evaluate(async () => {
      const { default: Previous } = await import('/src/utils/AllPrevious/index.js')
      const renderer = Previous.SVData?.[1]
      if (!renderer?.gl) return { error: 'renderer unavailable' }
      renderer.properties.firstLoop = true
      renderer.draw()
      const { gl, canvas } = renderer
      const width = canvas.width
      const height = canvas.height
      const pixels = new Uint8Array(width * height * 4)
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
      let visible = 0
      for (let offset = 0; offset < pixels.length; offset += 4) {
        if (pixels[offset + 3] > 0 && (pixels[offset] || pixels[offset + 1] || pixels[offset + 2])) visible++
      }
      return { width, height, visible, fraction: visible / (width * height), glError: gl.getError() }
    })
  }
  const assemblyExpected = !['missing-mileage', 'plan-only'].includes(scenario)
  const expectedMileage = ['hardness-support', 'construction-task', 'design-grade', 'steel-frame'].includes(scenario) ? 'YK1+346' : 'YK2+244'
  let persisted = null
  if (createdTaskId) {
    const endpoint = new URL(`/api/ai-agent/task-runs/${encodeURIComponent(createdTaskId)}/snapshots`, apiUrl)
    for (let attempt = 0; attempt < 20; attempt++) {
      const response = await fetch(endpoint)
      if (response.ok) {
        const snapshots = await response.json()
        const latest = snapshots.at(-1)
        persisted = latest && {
          status: latest.workflow_state?.status,
          eventType: latest.event_type,
          completed: latest.workflow_state?.completed,
          total: latest.workflow_state?.total,
          chainageFrame: latest.workflow_state?.chainageFrame,
          loadedIds: latest.resources?.filter(item => item.status === 'loaded').map(item => item.id) ?? [],
          assetPaths: latest.data_versions?.map(item => item.locator) ?? [],
        }
        if (persisted?.status === 'completed' || (!assemblyExpected && persisted?.status === 'ready')) break
      }
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }
  const result = { scenario, ...snapshot, timedOut, chatStatuses, taskRunsCreated, createdTaskId,
    persisted, errors: errors.slice(0, 15) }
  console.log(JSON.stringify(result))
  const failures = []
  if (timedOut) failures.push('页面未在时限内给出目标结果')
  if (snapshot.assistantMessages.slice(repliesBefore).some(text => /场景装配未完成|加载超时|执行失败/.test(text))) failures.push('平台报告装配失败')
  if (errors.length) failures.push(`页面错误 ${errors.length} 条`)
  if (!chatStatuses.length || chatStatuses.some(status => status !== 200)) failures.push('模型接口未全部返回 200')
  if (assemblyExpected) {
    if (snapshot.assemblyMileage !== expectedMileage) failures.push('目标里程不正确')
    if (taskRunsCreated !== 1) failures.push(`期望创建 1 条任务运行记录，实际 ${taskRunsCreated}`)
    if (['hardness-support', 'construction-task'].includes(scenario) &&
        (!snapshot.assemblyResources.some(text => /TSP|坚硬度/.test(text)) ||
         !snapshot.assemblyResources.some(text => /支护/.test(text)))) failures.push('TSP 坚硬度或支护资源未显示')
    if (scenario === 'tem' && !snapshot.assemblyResources.some(text => /TEM|电阻率/.test(text))) failures.push('TEM 资源未显示')
    if (scenario === 'integrity' && !snapshot.assemblyResources.some(text => /完整度/.test(text))) failures.push('TSP 完整度资源未显示')
    if (scenario === 'fusion-grade' && !snapshot.assemblyResources.some(text => /融合/.test(text))) failures.push('融合等级资源未显示')
    if (scenario === 'design-grade' && !snapshot.assemblyResources.some(text => /设计/.test(text))) failures.push('设计分级资源未显示')
    if (scenario === 'steel-frame' && !snapshot.assemblyResources.some(text => /钢架/.test(text))) failures.push('结构树钢架资源未显示')
    if (!snapshot.cesiumCanvasCount) failures.push('Cesium 画布不存在')
    if (['hardness-support', 'construction-task', 'tem', 'integrity', 'fusion-grade'].includes(scenario) &&
        (snapshot.volumeOverlay.display === 'none' || snapshot.volumeOverlay.width <= 0 ||
         snapshot.volumeOverlay.height <= 0 || snapshot.volumeOverlay.canvasWidth <= 0)) {
      failures.push('体数据覆盖层或 WebGL 画布在主界面不可见')
    }
    if (process.env.CHECK_VOLUME_PIXELS === '1' &&
        ['hardness-support', 'construction-task', 'tem', 'integrity', 'fusion-grade'].includes(scenario) &&
        (!snapshot.volumePixels?.visible || snapshot.volumePixels.glError !== 0)) {
      failures.push('体数据 WebGL 画布没有绘出有效像素')
    }
    const required = scenario === 'tem' ? ['rock.tem-resistivity']
      : scenario === 'integrity' ? ['rock.tsp-integrity']
      : scenario === 'fusion-grade' ? ['rock.geophysical-grade']
      : scenario === 'design-grade' ? ['rock.design-grade']
      : scenario === 'steel-frame' ? ['support.legacy-steel-frame']
      : ['rock.tsp-hardness', 'support.legacy-assembly']
    if (persisted?.status !== 'completed' || persisted?.completed !== persisted?.total || persisted?.chainageFrame !== 'YK') {
      failures.push('数据库未回读到完成的 YK 任务快照')
    }
    if (required.some(id => !persisted?.loadedIds.includes(id))) failures.push('数据库快照缺少实际加载的根资源')
    if (scenario === 'steel-frame' && persisted?.loadedIds.includes('support.legacy-assembly')) {
      failures.push('单独钢架请求误装配了完整支护组合')
    }
    const sourceFile = scenario === 'tem' ? '/data/geophysical_tem/resistivity_contrast.json'
      : scenario === 'integrity' ? '/data/tsp_actual/integrity.json'
      : scenario === 'fusion-grade' ? '/data/geophysical_grade/fused_rock_grade_2345.json'
      : scenario === 'design-grade' ? null
      : scenario === 'steel-frame' ? '/data/zhihu/ZZ-QJsx-44m/ZZ-QJsx-钢架.glb'
      : '/data/tsp_actual/hardness.json'
    if (sourceFile && !persisted?.assetPaths.includes(sourceFile)) failures.push('数据库快照缺少源数据指纹')
  } else {
    const expectedRuns = scenario === 'plan-only' ? 1 : 0
    if (taskRunsCreated !== expectedRuns) failures.push(`期望创建 ${expectedRuns} 条任务运行记录，实际 ${taskRunsCreated}`)
    if (snapshot.assemblyMileage || snapshot.assemblyResources.length) failures.push('澄清或只规划请求意外装配了场景')
    if (scenario === 'plan-only' && !snapshot.assistantMessages.slice(repliesBefore).some(text => /未执行|等待/.test(text))) {
      failures.push('只规划请求没有明确说明未执行')
    }
    if (scenario === 'plan-only' && (persisted?.status !== 'ready' || persisted?.completed !== 0)) {
      failures.push('数据库中的只规划任务不是待执行状态')
    }
  }
  if (failures.length) throw new Error(`${scenario}: ${failures.join('；')}`)
} finally {
  await browser.close()
}
