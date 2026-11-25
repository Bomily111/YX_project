import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const base = process.env.BROWSER_APP_URL ?? 'http://127.0.0.1:5178'
const output = process.env.ACCEPTANCE_OUTPUT_DIR ?? 'docs/verification/2026-11-23-construction-review-final'
const browser = await chromium.launch({
  executablePath: process.env.EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  args: process.env.ACCEPTANCE_HARDWARE_GPU === '1'
    ? ['--enable-webgl', '--use-gl=angle', '--use-angle=d3d11']
    : ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
await mkdir(output, { recursive: true })
const viewport = {
  width: Number(process.env.ACCEPTANCE_VIEWPORT_WIDTH ?? 1440),
  height: Number(process.env.ACCEPTANCE_VIEWPORT_HEIGHT ?? 960),
}
const report = { viewport, stages: [], referenceLinks: [], pageErrors: [], passed: false }
try {
  const page = await browser.newPage({ viewport })
  page.on('pageerror', error => report.pageErrors.push(error.message))
  const workfaceRequests = new Set()
  page.on('response', response => {
    const path = new URL(response.url()).pathname
    if (response.ok() && path.startsWith('/data/workface-surface/')) workfaceRequests.add(path)
  })
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.locator('.agent-fab').click()
  const input = page.locator('.agent-input')
  const panel = page.getByTestId('construction-review')
  const assistants = page.locator('.agent-messages .msg-row.assistant .msg-block .msg-bubble')
  await page.waitForFunction(() => document.querySelector('.cesium-widget canvas'))
  await page.evaluate(() => { window.__reviewCanvas = document.querySelector('.cesium-widget canvas') })

  async function send(request) {
    const count = await assistants.count()
    await input.fill(request)
    await input.press('Enter')
    await assistants.nth(count).waitFor({ timeout: 180_000 })
    return (await assistants.last().innerText()).trim()
  }
  function readScene(key) {
    return page.evaluate(async stageKey => {
      const { getTaskWorkflowController } = await import('/src/platform/tasks/TaskWorkflowBridge.ts')
      const { taskCameraSelection } = await import('/src/platform/tasks/TaskCameraView.ts')
      const { getTaskSupportLayers, getTestSectionSupportSummaries, getTestSectionSupportModels } = await import('/src/modules/support/test-section-resource.ts')
      const { getBlastModel } = await import('/src/views/tunnel-module/blast.ts')
      const { getActiveThreeBenchModel } = await import('/src/modules/rock/three-bench-resource.ts')
      const { getActiveJetFan } = await import('/src/modules/ventilation/axial-fan-resource.ts')
      const { nativeRockModels, WORKFACE_SURFACE_ID } = await import('/src/modules/rock/native-model-resources.ts')
      const { getTaskVolumeDomain } = await import('/src/platform/tasks/TaskVolumeCut.ts')
      const { readTaskViewport } = await import('/src/platform/tasks/TaskViewport.ts')
      const { getFocusedTunnelSegment, getTunnelGlbSegment } = await import('/src/utils/Common/DrawLine.ts')
      const { inspectVentilationCharts } = await import('/src/modules/ventilation/resources.ts')
      const { viewerService } = await import('/src/platform/viewer/ViewerService.ts')
      const status = getTaskWorkflowController().getStatus()
      const roots = status.lastCompletedStage.assembledResourceIds
      const viewer = viewerService.require()
      const { positionWC, directionWC, upWC } = viewer.camera
      const faceModel = nativeRockModels([WORKFACE_SURFACE_ID])[0]
      const focusedShell = getFocusedTunnelSegment()
      const cameraObjects = {
        workface: [faceModel?.boundingSphere],
        reveal: [getTaskVolumeDomain()?.sphere, getActiveThreeBenchModel()?.boundingSphere],
        baseline: [getActiveThreeBenchModel()?.boundingSphere, getTestSectionSupportModels(roots)[2]?.boundingSphere],
        candidate: [getActiveThreeBenchModel()?.boundingSphere, getTestSectionSupportModels(roots)[2]?.boundingSphere],
        blast: [getBlastModel()?.boundingSphere],
        ventilation: [getActiveJetFan()?.boundingSphere],
        handoff: [getBlastModel()?.boundingSphere, getActiveJetFan()?.boundingSphere],
      }
      const bounds = readTaskViewport(viewer)
      const span = viewer.entities.getById('construction-review-span')?.polyline.positions.getValue(viewer.clock.currentTime)
      const spanPixels = span?.map(position => window.Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, position))
      const datum = viewer.entities.getById('construction-review-reference-2244')
      const datumPixel = datum?.position && window.Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, datum.position.getValue(viewer.clock.currentTime))
      const inView = point => point && point.x > 0 && point.x < bounds.width && point.y > 0 && point.y < bounds.height &&
        !bounds.obstacles.some(rect => point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom)
      const projectedSpan = spanPixels?.every(Boolean) ? {
        width: Math.abs(spanPixels[0].x - spanPixels[1].x),
        endpointsInView: spanPixels.every(inView),
        datumInView: !!datumPixel && inView(window.Cesium.Cartesian2.add(datumPixel, datum.label.pixelOffset.getValue(viewer.clock.currentTime), new window.Cesium.Cartesian2())),
      } : null
      const targetCenters = cameraObjects[stageKey]?.map(sphere => {
        if (!sphere) return null
        const C = window.Cesium
        const toward = C.Cartesian3.subtract(sphere.center, positionWC, new C.Cartesian3())
        if (C.Cartesian3.dot(toward, directionWC) <= 0) return null
        const point = C.SceneTransforms.worldToWindowCoordinates(viewer.scene, sphere.center)
        if (!point || !bounds) return null
        const covered = bounds.obstacles.some(r => point.x >= r.left && point.x <= r.right && point.y >= r.top && point.y <= r.bottom)
        return { x: point.x, y: point.y, visible: !covered && point.x > 0 && point.x < bounds.width && point.y > 0 && point.y < bounds.height }
      })
      return {
        taskId: status.taskId, roots, view: taskCameraSelection.value,
        sameCanvas: window.__reviewCanvas === document.querySelector('.cesium-widget canvas'),
        targetCenters, projectedSpan,
        workfaceReady: !!faceModel?.ready,
        workfaceTextureDisplay: !!faceModel?.customShader,
        shellAlpha: focusedShell === null ? null : getTunnelGlbSegment(focusedShell)?.color?.alpha,
        workfaceMatrix: faceModel ? Array.from({ length: 16 }, (_, i) => faceModel.modelMatrix[i]) : null,
        camera: [positionWC, directionWC, upWC].map(({ x, y, z }) => [x, y, z]),
        references: viewer.entities.values.filter(item => item.id.startsWith('construction-review-reference-'))
          .map(item => item.label.text.getValue()),
        volumeFrames: viewer.entities.values.filter(item => item.properties?.taskVolumeDomain?.getValue() && item.show).length,
        gradeLabels: viewer.entities.values.filter(item => item.properties?.taskBlastDesignGrade?.getValue() && item.show).length,
        overviewGradeLabels: viewer.entities.values.filter(item => item.properties?.designRockGradeOverview?.getValue() && item.show).length,
        stationGap: viewer.entities.getById('construction-review-station-gap-label')?.label.text.getValue() ?? null,
        cloudVisible: getBlastModel()?.show ?? null,
        supports: getTestSectionSupportSummaries(roots).map(({ supportType, lengthM }) => ({ supportType, lengthM })),
        supportLayers: getTaskSupportLayers(roots).map(({ component, visible }) => ({ component, visible })),
        supportMatrices: getTestSectionSupportModels(roots).map(({ modelMatrix }) => Array.from({ length: 16 }, (_, i) => modelMatrix[i])),
        charts: inspectVentilationCharts().map(({ owner, timeRange, sourceNote }) => ({ owner, timeRange, sourceNote })),
      }
    }, key)
  }
  async function stage(request, key, expectedIds, expectedView) {
    const reply = await send(request)
    report.lastReply = reply
    console.log(key, reply)
    assert.doesNotMatch(reply, /未完成|图表未就绪|❌/)
    await page.locator(`[data-testid="construction-review"][data-stage="${key}"]`).waitFor()
    const facts = await readScene(key)
    assert.deepEqual([...facts.roots].sort(), [...expectedIds].sort())
    assert.equal(facts.view, expectedView)
    assert.equal(facts.sameCanvas, true)
    assert.ok(facts.targetCenters?.every(target => target?.visible), `${key} has offscreen or covered target centers: ${JSON.stringify(facts.targetCenters)}`)
    const rows = await panel.getByTestId('construction-reference').evaluateAll(elements =>
      elements.map(row => `${row.querySelector('dt').textContent} · ${row.querySelector('dd').textContent}`))
    const expectedRows = key === 'blast' ? rows.slice(0, 1) : key === 'ventilation' ? rows.slice(1) : rows
    assert.deepEqual(facts.references, expectedRows)
    assert.equal(await panel.getByTestId('construction-reference').getByRole('button').count(), expectedRows.length)
    assert.equal(await panel.locator('button[aria-pressed="true"]').count(), 0)
    const drawing = page.locator('.d2d')
    const volume = page.getByTestId('task-volume-overlay')
    const chart = page.locator('[data-ventilation-owner="ventilation.co-analysis"]')
    if (expectedIds.includes('blast.design-data')) {
      assert.equal(await drawing.isVisible(), key === 'reveal')
      assert.equal(await volume.isVisible(), key === 'reveal')
      assert.equal(await page.locator('.tsp-legend').isVisible(), key === 'reveal')
      if (key === 'reveal') assert.ok(facts.volumeFrames > 0)
      else assert.equal(facts.volumeFrames, 0)
    } else if (key !== 'workface') {
      assert.equal(await chart.count(), 1)
      assert.equal(await chart.isVisible(), key === 'ventilation')
      assert.equal(facts.cloudVisible, key !== 'ventilation')
      assert.equal(facts.gradeLabels, key === 'blast' ? 1 : 0)
      assert.equal(facts.overviewGradeLabels, 0)
    }
    const lowerPanel = key === 'reveal' ? drawing : key === 'ventilation' ? chart : undefined
    if (lowerPanel) {
      const notes = await page.getByRole('complementary', { name: '当前任务场景信息' }).boundingBox()
      const graphic = await lowerPanel.boundingBox()
      assert.ok(notes.y + notes.height <= graphic.y, '施工复核说明与配套图表不得重叠')
    }
    await page.screenshot({ path: `${output}/${key}.png` })
    report.stages.push({ key, ...facts, reply })
    return facts
  }

  const geology = support => ['rock.three-bench', support, 'blast.design-data', 'rock.tsp-integrity']
  function assertSameCamera(expected, actual) {
    for (let i = 0; i < expected.length; i++) {
      assert.ok(expected[i].every((axis, j) => Math.abs(axis - actual[i][j]) < (i === 0 ? 1e-6 : 1e-12)),
        `支护对照需共享固定机位：${JSON.stringify([expected, actual])}`)
    }
  }
  async function verifyReferenceLink(key, initial, { station, role, buttonName, event }) {
    const markerId = `construction-review-reference-${station}`
    const button = panel.getByRole('button', { name: buttonName })
    const markerState = () => page.evaluate(async ({ id, role }) => {
      const { viewerService } = await import('/src/platform/viewer/ViewerService.ts')
      const { getBlastModel } = await import('/src/views/tunnel-module/blast.ts')
      const { getActiveJetFan } = await import('/src/modules/ventilation/axial-fan-resource.ts')
      const { clock, entities } = viewerService.require()
      const xyz = ({ x, y, z }) => [x, y, z]
      const span = entities.getById('construction-review-span')?.polyline
      const source = role === 'support-span' ? span?.positions.getValue(clock.currentTime)
        : role === 'blast-cloud' ? [getBlastModel().boundingSphere.center] : [getActiveJetFan().boundingSphere.center]
      const focus = entities.values.filter(item => item.id.startsWith('construction-review-focus-'))
      return {
        background: entities.getById(id).label.backgroundColor.getValue(clock.currentTime).toCssHexString(),
        spanWidth: span?.width.getValue(clock.currentTime) ?? null,
        markers: focus.map(item => xyz(item.position.getValue(clock.currentTime))),
        endpointLabels: focus.flatMap(item => item.label ? [item.label.text.getValue(clock.currentTime)] : []),
        source: source.map(xyz),
      }
    }, { id: markerId, role })
    const idle = await markerState()
    await button.click()
    assert.equal(await button.getAttribute('aria-pressed'), 'true')
    const selected = await markerState()
    assert.notEqual(selected.background, idle.background)
    assert.deepEqual(selected.markers, selected.source)
    assert.equal(selected.markers.length, role === 'support-span' ? 2 : 1)
    assert.deepEqual(selected.endpointLabels, role === 'support-span' ? ['+238', '+243'] : [])
    const unitEdges = role === 'support-span' ? await page.evaluate(({ matrices, markers }) => {
      const C = window.Cesium
      return [matrices[0], matrices.at(-1)].map((matrix, index) => {
        const inverse = C.Matrix4.inverseTransformation(C.Matrix4.fromArray(matrix), new C.Matrix4())
        const position = C.Matrix4.multiplyByPoint(inverse, C.Cartesian3.fromArray(markers[index]), new C.Cartesian3())
        return [position.x, position.y, position.z]
      })
    }, { matrices: initial.supportMatrices, markers: selected.markers }) : null
    if (unitEdges) assert.ok(unitEdges.every(([x, , z], index) =>
      Math.abs(x) < 1e-6 && Math.abs(z - (index === 0 ? -.5 : .5)) < 1e-6), `端点未落在首末单元名义端面 ${JSON.stringify(unitEdges)}`)
    if (idle.spanWidth !== null) assert.ok(selected.spanWidth > idle.spanWidth)
    if (event) assert.deepEqual(await panel.locator('.related-event dt').allTextContents(), [event])
    const after = await readScene(key)
    assert.equal(after.taskId, initial.taskId)
    assertSameCamera(initial.camera, after.camera)
    assert.deepEqual(after.supportMatrices, initial.supportMatrices)
    assert.deepEqual(after.supportLayers, initial.supportLayers)
    assert.deepEqual(after.charts, initial.charts)
    assert.equal(after.cloudVisible, initial.cloudVisible)
    await page.screenshot({ path: `${output}/${key}-${role}-linked.png` })

    const hit = await page.evaluate(async id => {
      const { viewerService } = await import('/src/platform/viewer/ViewerService.ts')
      const { canvas, clock, entities, scene } = viewerService.require()
      const marker = entities.getById(id)
      const projection = window.Cesium.SceneTransforms.worldToWindowCoordinates(scene, marker.position.getValue(clock.currentTime))
      const offset = marker.label.pixelOffset.getValue(clock.currentTime)
      const rect = canvas.getBoundingClientRect()
      for (const dy of [0, -4, 4, -8, 8, -12, 12]) {
        for (const dx of [0, 6, -6, 16, -16, 32, -32, 60, -60]) {
          const hit = { x: Math.round(projection.x + offset.x + dx + rect.left), y: Math.round(projection.y + offset.y + dy + rect.top) }
          const point = new window.Cesium.Cartesian2(hit.x - rect.left, hit.y - rect.top)
          if (document.elementFromPoint(hit.x, hit.y) === canvas && scene.pick(point)?.id === marker) return hit
        }
      }
      return null
    }, markerId)
    assert.ok(hit, `${key}: 三维标注 ${markerId} 没有可以直接点击的像素`)
    await page.mouse.click(hit.x, hit.y)
    await page.waitForFunction(name => document.querySelector(`button[aria-label="${name}"]`)?.getAttribute('aria-pressed') === 'false', buttonName, { timeout: 5000 })
    assert.deepEqual(await markerState(), idle)
    assert.equal(await panel.locator('.related-event').count(), 0)
    await page.mouse.click(hit.x, hit.y)
    await page.waitForFunction(name => document.querySelector(`button[aria-label="${name}"]`)?.getAttribute('aria-pressed') === 'true', buttonName)
    assert.deepEqual(await markerState(), selected)
    if (event) assert.deepEqual(await panel.locator('.related-event dt').allTextContents(), [event])
    assertSameCamera(initial.camera, (await readScene(key)).camera)
    await button.press('Enter')
    const modelHit = await page.evaluate(async ({ role, roots }) => {
      const { viewerService } = await import('/src/platform/viewer/ViewerService.ts')
      const { getTestSectionSupportModels } = await import('/src/modules/support/test-section-resource.ts')
      const { getBlastModel } = await import('/src/views/tunnel-module/blast.ts')
      const { getActiveJetFan } = await import('/src/modules/ventilation/axial-fan-resource.ts')
      const { canvas, scene } = viewerService.require()
      const C = window.Cesium
      const models = role === 'support-span' ? getTestSectionSupportModels(roots)
        : [role === 'blast-cloud' ? getBlastModel() : getActiveJetFan()]
      const center = C.SceneTransforms.worldToWindowCoordinates(scene, models[Math.floor(models.length / 2)].boundingSphere.center)
      const rect = canvas.getBoundingClientRect()
      for (const dy of [0, 4, -4, 10, -10, 20, -20]) for (const dx of [0, 4, -4, 10, -10, 20, -20]) {
        const x = Math.round(center.x + dx + rect.left)
        const y = Math.round(center.y + dy + rect.top)
        const point = new C.Cartesian2(x - rect.left, y - rect.top)
        if (document.elementFromPoint(x, y) !== canvas) continue
        const picks = scene.drillPick(point, 4)
        const firstRelevant = picks.find(pick => models.includes(pick.primitive) ||
          (typeof pick.id?.id === 'string' && pick.id.id.startsWith('construction-review-')))
        if (firstRelevant && models.includes(firstRelevant.primitive)) {
          return { x, y, depthIndex: picks.indexOf(firstRelevant) }
        }
      }
      return null
    }, { role, roots: initial.roots })
    assert.ok(modelHit, `${key}: 未找到可直接点击的 ${role} 模型像素`)
    await page.mouse.click(modelHit.x, modelHit.y)
    await page.waitForFunction(name => document.querySelector(`button[aria-label="${name}"]`)?.getAttribute('aria-pressed') === 'true', buttonName, { timeout: 5000 })
    assert.deepEqual(await markerState(), selected)
    if (event) assert.deepEqual(await panel.locator('.related-event dt').allTextContents(), [event])
    assertSameCamera(initial.camera, (await readScene(key)).camera)
    report.referenceLinks.push({ key, station, role, event, canvasClick: hit, modelClick: modelHit, idle, selected, unitEdges, cameraUnchanged: true })
  }
  async function verifyOutlineSwitch(key, outline, sourceLayers) {
    const display = panel.getByTestId('review-support-display')
    assert.equal(await display.getAttribute('data-display'), 'outline')
    const anchors = outline.supportLayers.filter(layer => ['system_anchor', 'lock_foot_anchor'].includes(layer.component))
    assert.ok(anchors.length > 0)
    assert.ok(anchors.every(layer => !layer.visible))
    assert.match(await send('查看初支锚杆'), /已恢复本次对照前的锚杆显示/)
    assert.equal(await display.getAttribute('data-display'), 'assembled')
    const assembled = await readScene()
    assert.equal(assembled.taskId, outline.taskId)
    assertSameCamera(outline.camera, assembled.camera)
    assert.deepEqual(assembled.supportMatrices, outline.supportMatrices)
    assert.deepEqual(assembled.supportLayers, sourceLayers ?? outline.supportLayers.map(layer =>
      anchors.some(anchor => anchor.component === layer.component) ? { ...layer, visible: true } : layer))
    await page.screenshot({ path: `${output}/${key}-anchors.png` })
    assert.match(await send('突出初支轮廓'), /暂收起已有锚杆组/)
    const restoredOutline = await readScene()
    assert.equal(restoredOutline.taskId, outline.taskId)
    assertSameCamera(outline.camera, restoredOutline.camera)
    assert.deepEqual(restoredOutline.supportLayers, outline.supportLayers)
    report[`${key}Outline`] = { cameraUnchanged: true, matricesUnchanged: true, anchors, assembled: assembled.supportLayers }
  }
  async function verifySupportComponent(key, initial, component, label) {
    const toggle = panel.getByRole('button', { name: `显露${label}`, exact: true })
    await page.evaluate(async id => {
      const { captureTaskSupportNodes } = await import('/src/modules/support/test-section-resource.ts')
      window.__reviewSupportSnapshot = captureTaskSupportNodes(id)
    }, initial.roots.find(id => id.startsWith('support.test-section')))
    await toggle.click()
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true')
    const focused = await readScene(key)
    assert.equal(focused.taskId, initial.taskId)
    assertSameCamera(initial.camera, focused.camera)
    assert.deepEqual(focused.supportMatrices, initial.supportMatrices)
    assert.deepEqual(focused.references, initial.references)
    assert.deepEqual(focused.supportLayers.filter(layer => layer.visible).map(layer => layer.component), [component])
    await page.screenshot({ path: `${output}/${key}-${component}.png` })
    await toggle.press('Enter')
    assert.equal(await toggle.getAttribute('aria-pressed'), 'false')
    assert.equal(await page.evaluate(() => window.__reviewSupportSnapshot.isCurrent()), true)
    assert.deepEqual((await readScene(key)).supportLayers, initial.supportLayers)
    report[`${key}Component`] = { component, visibleLayers: [component], exactNodeRestore: true, sameCamera: true }
  }
  const geologyRequest = '掌子面揭示异常后，安排地质揭示后的开挖与支护变更复核，核对受影响的开挖循环、原初支与拟变更初支，列出班组交接要补的证据。'
  const face = await stage(`先仅启动复核。${geologyRequest}`, 'workface', ['rock.workface-surface'], 'face')
  assert.equal(face.workfaceReady, true)
  assert.equal(face.workfaceTextureDisplay, true)
  assert.deepEqual(face.references, ['掌子面岩面 · YK2+244'])
  assert.deepEqual([...workfaceRequests].sort(), ['/data/workface-surface/texturedMesh.glb', '/data/workface-surface/texturedMesh.jpg'])
  const workfaceView = panel.getByTestId('review-workface-view')
  assert.equal(await workfaceView.getAttribute('data-view'), 'oblique')
  assert.match(await send('正视掌子面'), /已切到岩面正视/)
  assert.equal(await workfaceView.getAttribute('data-view'), 'front')
  const front = await readScene('workface')
  assert.equal(front.taskId, face.taskId)
  assert.deepEqual(front.workfaceMatrix, face.workfaceMatrix)
  assert.notDeepEqual(front.camera, face.camera)
  assert.ok(front.targetCenters?.every(target => target?.visible))
  await page.screenshot({ path: `${output}/workface-front.png` })
  assert.match(await send('斜视掌子面'), /已切到岩面斜视/)
  const oblique = await readScene('workface')
  assert.equal(oblique.taskId, face.taskId)
  assert.deepEqual(oblique.workfaceMatrix, face.workfaceMatrix)
  assertSameCamera(face.camera, oblique.camera)
  const initial = await stage('下一步',
    'reveal', geology('support.test-section-zz-ivb'), 'overview')
  assert.equal(initial.workfaceReady, false)
  assert.equal(initial.shellAlpha, .035)
  assert.match(await send('突出初支轮廓'), /请先复核原支护版本或拟变更版本/)
  const before = await stage('复核原支护版本', 'baseline', geology('support.test-section-zz-ivb'), 'support')
  const evidence = panel.getByTestId('review-support-evidence')
  assert.equal(await evidence.locator('[data-version="candidate"]').filter({ hasText: '待复核' }).count(), 3)
  await verifyOutlineSwitch('baseline', before, initial.supportLayers)
  assert.equal(await evidence.getByRole('button', { name: '显露锁脚锚杆' }).count(), 0)
  await verifySupportComponent('baseline', before, 'system_anchor', '系统锚杆')
  await verifyReferenceLink('baseline', before, { station: 2238, role: 'support-span', buttonName: '定位ZZ-IVb 初支 YK2+238–YK2+243' })
  const after = await stage('复核拟变更版本', 'candidate', geology('support.test-section'), 'support')
  const footBolts = evidence.getByRole('row').filter({ hasText: '锁脚锚杆' })
  assert.equal(await footBolts.locator('[data-version="baseline"]').innerText(), '未见分组')
  assert.equal(await footBolts.locator('[data-version="candidate"]').innerText(), '有分组')
  await verifyOutlineSwitch('candidate', after)
  await verifySupportComponent('candidate', after, 'lock_foot_anchor', '锁脚锚杆')
  await verifyReferenceLink('candidate', after, { station: 2238, role: 'support-span', buttonName: '定位ZZ-Va 初支 YK2+238–YK2+243' })
  assert.equal(before.taskId, initial.taskId)
  assert.notEqual(before.taskId, after.taskId)
  assert.deepEqual(before.supports, [{ supportType: 'ZZ-IVb', lengthM: 5 }])
  assert.deepEqual(after.supports, [{ supportType: 'ZZ-Va', lengthM: 5 }])
  assert.deepEqual(before.references, ['开挖基准 · YK2+244', 'ZZ-IVb 初支 · YK2+238–YK2+243'])
  assert.deepEqual(after.references, ['开挖基准 · YK2+244', 'ZZ-Va 初支 · YK2+238–YK2+243'])
  assertSameCamera(before.camera, after.camera)
  const componentButton = label => evidence.getByRole('button', { name: `显露${label}`, exact: true })
  const assertComponentAcrossVersions = async (version, camera, component) => {
    await page.locator(`[data-testid="construction-review"][data-stage="${version}"]`).waitFor()
    const state = await readScene(version)
    assertSameCamera(camera, state.camera)
    assert.deepEqual(state.supportLayers.filter(layer => layer.visible).map(layer => layer.component), [component])
    return state
  }
  await componentButton('系统锚杆').click()
  await send('复核原支护版本')
  const sharedBaseline = await assertComponentAcrossVersions('baseline', after.camera, 'system_anchor')
  assert.notEqual(sharedBaseline.taskId, after.taskId)
  assert.equal(await componentButton('系统锚杆').getAttribute('aria-pressed'), 'true')
  await page.screenshot({ path: `${output}/shared-baseline.png` })
  const componentStatus = panel.getByTestId('review-component-status')
  await componentStatus.getByRole('button', { name: '布置侧视' }).click()
  await componentStatus.getByRole('button', { name: '返回整体' }).waitFor()
  const sideBaseline = await readScene('baseline')
  assert.equal(sideBaseline.taskId, sharedBaseline.taskId)
  assert.notDeepEqual(sideBaseline.camera, sharedBaseline.camera)
  assert.deepEqual(sideBaseline.supportMatrices, sharedBaseline.supportMatrices)
  assert.deepEqual(sideBaseline.supportLayers, sharedBaseline.supportLayers)
  assert.deepEqual(sideBaseline.references, sharedBaseline.references)
  assert.ok(sideBaseline.projectedSpan?.endpointsInView)
  assert.ok(sideBaseline.projectedSpan?.datumInView)
  assert.ok(sideBaseline.targetCenters[1]?.visible)
  assert.ok(sideBaseline.projectedSpan.width > sharedBaseline.projectedSpan.width * 1.25)
  await page.screenshot({ path: `${output}/side-baseline.png` })
  await send('复核拟变更版本')
  const sideCandidate = await assertComponentAcrossVersions('candidate', sideBaseline.camera, 'system_anchor')
  assert.ok(sideCandidate.projectedSpan?.endpointsInView)
  assert.ok(sideCandidate.projectedSpan?.datumInView)
  await page.screenshot({ path: `${output}/side-candidate.png` })
  await componentStatus.getByRole('button', { name: '返回整体' }).click()
  await assertComponentAcrossVersions('candidate', after.camera, 'system_anchor')
  report.supportSideView = { overviewSpanPx: sharedBaseline.projectedSpan.width, sideSpanPx: sideBaseline.projectedSpan.width,
    sameSideCameraAcrossVersions: true, restoresOverview: true }
  await page.screenshot({ path: `${output}/shared-candidate.png` })
  await componentButton('锁脚锚杆').click()
  await send('复核原支护版本')
  assert.match(await componentStatus.innerText(), /当前示例模型未见锁脚锚杆分组/)
  assert.deepEqual((await readScene('baseline')).supportLayers, before.supportLayers)
  await page.screenshot({ path: `${output}/missing-lock-foot.png` })
  await send('复核拟变更版本')
  await assertComponentAcrossVersions('candidate', after.camera, 'lock_foot_anchor')
  assert.equal(await componentButton('锁脚锚杆').getAttribute('aria-pressed'), 'true')
  await send('复核原支护版本')
  await componentStatus.getByRole('button', { name: '清除对照' }).click()
  await componentStatus.waitFor({ state: 'detached' })
  await send('复核拟变更版本')
  assert.deepEqual((await readScene('candidate')).supportLayers, after.supportLayers)
  report.componentVersionComparison = { shared: 'system_anchor', unavailable: 'lock_foot_anchor', resumed: true, cleared: true }
  assert.match(await send('下一步'), /流程边界/)
  assert.equal(await panel.getAttribute('data-stage'), 'candidate')
  await evidence.getByRole('button', { name: '显露锁脚锚杆' }).click()
  await stage('回看揭示', 'reveal', geology('support.test-section-zz-ivb'), 'overview')
  const revisited = await stage('回看掌子面', 'workface', ['rock.workface-surface'], 'face')
  assert.equal(revisited.workfaceReady, true)
  assert.deepEqual(revisited.references, face.references)

  const ventilation = ['rock.design-grade', 'blast.effect', 'ventilation.ceiling-jet-fan', 'ventilation.co-analysis']
  const blastRequest = '夜班完成一个开挖循环后，请做爆后排烟与出渣交接复盘。先对照爆后断面，然后核对排烟与监测，最后列出出渣班组接班需要的同循环记录。'
  const blast = await stage(`先仅启动复核。工点 ＹＫ４＋０００（旧标 DK280+984）。${blastRequest}`,
    'blast', ventilation, 'blast')
  const air = await stage('查看排烟与监测', 'ventilation', ventilation, 'fan')
  const handoff = await stage('查看出渣交接', 'handoff', ventilation, 'overview')
  assert.equal(air.taskId, blast.taskId)
  assert.equal(handoff.taskId, blast.taskId)
  assert.deepEqual(handoff.references, ['爆后点云 · YK4+000', '洞顶射流风机 · YK3+988'])
  assert.equal(handoff.stationGap, '展示里程相差 12 m')
  assert.equal(await panel.getByTestId('review-station-gap').innerText(), handoff.stationGap)
  await verifyReferenceLink('handoff', handoff, { station: 3988, role: 'jet-fan', buttonName: '定位洞顶射流风机 YK3+988', event: '启风' })
  await panel.getByRole('button', { name: '定位洞顶射流风机 YK3+988' }).press('Enter')
  await verifyReferenceLink('handoff', handoff, { station: 4000, role: 'blast-cloud', buttonName: '定位爆后点云 YK4+000', event: '起爆' })
  await panel.getByRole('button', { name: '定位爆后点云 YK4+000' }).press('Space')
  const fanHit = report.referenceLinks.find(link => link.role === 'jet-fan').modelClick
  const originalShellAlpha = await page.evaluate(async ({ x, y }) => {
    const { viewerService } = await import('/src/platform/viewer/ViewerService.ts')
    const { getFocusedTunnelSegment, getTunnelGlbSegment } = await import('/src/utils/Common/DrawLine.ts')
    const { scene, canvas } = viewerService.require()
    const shell = getTunnelGlbSegment(getFocusedTunnelSegment())
    const bounds = canvas.getBoundingClientRect()
    const point = new window.Cesium.Cartesian2(x - bounds.left, y - bounds.top)
    if (scene.pick(point)?.primitive !== shell) throw Error('遮挡试验未命中当前隧道外壳')
    const alpha = shell.color.alpha
    shell.color = shell.color.withAlpha(1)
    scene.requestRender()
    return alpha
  }, fanHit)
  assert.ok(originalShellAlpha < 1)
  await page.mouse.click(fanHit.x, fanHit.y)
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  assert.equal(await panel.locator('button[aria-pressed="true"]').count(), 0)
  await page.evaluate(async alpha => {
    const { viewerService } = await import('/src/platform/viewer/ViewerService.ts')
    const { getFocusedTunnelSegment, getTunnelGlbSegment } = await import('/src/utils/Common/DrawLine.ts')
    const shell = getTunnelGlbSegment(getFocusedTunnelSegment())
    shell.color = shell.color.withAlpha(alpha)
    viewerService.require().scene.requestRender()
  }, originalShellAlpha)
  report.opaqueShellBlocksPicking = true
  await page.evaluate(async () => {
    const { viewerService } = await import('/src/platform/viewer/ViewerService.ts')
    const { camera, scene } = viewerService.require()
    const C = window.Cesium
    camera.setView({ destination: C.Cartesian3.clone(camera.positionWC), orientation: {
      direction: C.Cartesian3.negate(camera.directionWC, new C.Cartesian3()), up: C.Cartesian3.clone(camera.upWC),
    } })
    scene.requestRender()
  })
  const pannedHandoff = await readScene('handoff')
  assert.notDeepEqual(pannedHandoff.camera, handoff.camera)
  assert.ok(pannedHandoff.targetCenters.some(target => !target?.visible))
  await panel.getByRole('button', { name: '定位洞顶射流风机 YK3+988' }).click()
  const recoveredHandoff = await readScene('handoff')
  assert.equal(recoveredHandoff.taskId, handoff.taskId)
  assertSameCamera(handoff.camera, recoveredHandoff.camera)
  assert.ok(recoveredHandoff.targetCenters.every(target => target?.visible))
  assert.deepEqual(await panel.locator('.related-event dt').allTextContents(), ['启风'])
  report.offscreenReference = { target: 'jet-fan', taskUnchanged: true, handoffCameraRestored: true }
  assert.equal(await panel.locator('.events dd').filter({ hasText: '待补' }).count(), 4)
  assert.match(await panel.getByTestId('construction-simulation').innerText(), /CO 模拟相对时间 · 0–60/)
  assert.ok(air.charts.some(chart => chart.owner === 'ventilation.co-analysis' && chart.timeRange[1] > chart.timeRange[0]))
  const beforeStationConflict = await readScene('handoff')
  const stationConflicts = []
  for (const station of ['YK2+244', 'ＹＫ２＋２４４']) {
    const reply = await send(`在${station}做爆后排烟与出渣交接复盘`)
    assert.match(reply, /固定在 YK4\+000/)
    const after = await readScene('handoff')
    assert.equal(after.taskId, beforeStationConflict.taskId)
    assert.deepEqual(after.roots, beforeStationConflict.roots)
    assert.deepEqual(after.references, beforeStationConflict.references)
    assertSameCamera(beforeStationConflict.camera, after.camera)
    stationConflicts.push({ station, reply })
  }
  assert.equal(await panel.getAttribute('data-stage'), 'handoff')
  report.stationValidation = { accepted: 'ＹＫ４＋０００（旧标 DK280+984）', conflicts: stationConflicts, preservedTask: true }
  await send('复位当前任务场景，释放本次任务模型并恢复主场景。')
  await panel.waitFor({ state: 'detached' })
  await page.locator('[data-ventilation-owner="ventilation.co-analysis"]').waitFor({ state: 'detached' })
  assert.equal(await page.evaluate(async () => {
    const { viewerService } = await import('/src/platform/viewer/ViewerService.ts')
    const { screenSpaceEventRegistry } = await import('/src/platform/input/ScreenSpaceEventRegistry.ts')
    if (screenSpaceEventRegistry.get('task.construction-review-reference-pick')) {
      throw Error('未释放复盘标注拾取')
    }
    return viewerService.require().entities.values.filter(item => item.id.startsWith('construction-review-')).length
  }), 0)
  const automaticGeology = await send(geologyRequest)
  assert.match(automaticGeology, /观察掌子面岩面[\s\S]*揭示与影响范围[\s\S]*复核原支护版本[\s\S]*复核拟变更版本/)
  assert.equal(await panel.getAttribute('data-stage'), 'candidate')
  const automaticBlast = await send(blastRequest)
  assert.match(automaticBlast, /爆后断面[\s\S]*排烟与监测[\s\S]*出渣交接/)
  assert.equal(await panel.getAttribute('data-stage'), 'handoff')
  report.automatic = { geology: automaticGeology, blast: automaticBlast }
  await send('复位当前任务场景，释放本次任务模型并恢复主场景。')
  await panel.waitFor({ state: 'detached' })
  assert.deepEqual(report.pageErrors, [])
  report.passed = true
} catch (error) {
  report.failure = String(error.stack ?? error)
  throw error
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2))
  await browser.close()
}
