import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const url = new URL(process.env.BROWSER_APP_URL ?? 'http://127.0.0.1:5178')
const ordinaryUrl = url.toString()
url.searchParams.set('taskControls', 'manual')
const fullReview = process.env.ACCEPTANCE_FULL_REVIEW === '1'
const output = process.env.ACCEPTANCE_OUTPUT_DIR ?? (fullReview
  ? 'docs/verification/2026-11-23-review-full-conditions'
  : 'docs/verification/2026-11-23-review-conditions-terrain')
const viewport = { width: 1440, height: 960 }
const cases = [
  { key: 'support', title: '地质揭示后的开挖与支护变更复核', mileage: 'YK2+244', chainage: 2244,
    placement: '三台阶后方5米ZZ-IVb支护', supportLength: '5', stage: 'baseline',
    resources: ['rock.three-bench', 'support.test-section-zz-ivb', 'blast.design-data', 'rock.tsp-integrity'] },
  { key: 'handoff', title: '爆后排烟与出渣交接复盘', mileage: 'YK4+000', chainage: 4000,
    placement: '洞顶射流风机布置在开挖基准后方12米，出风朝里程增大方向。', stage: 'handoff',
    resources: ['rock.design-grade', 'blast.effect', 'ventilation.ceiling-jet-fan', 'ventilation.co-analysis'] },
]
const [support, handoff] = cases
const sequences = [
  [
    { ...support, stage: 'workface', placement: '掌子面岩面近景', supportLength: undefined, resources: ['rock.workface-surface'] },
    { ...support, stage: 'reveal' },
    support,
    { ...support, stage: 'candidate', placement: '三台阶后方5米ZZ-Va支护',
      resources: support.resources.map(id => id === 'support.test-section-zz-ivb' ? 'support.test-section' : id) },
  ],
  [{ ...handoff, stage: 'blast' }, { ...handoff, stage: 'ventilation' }, handoff],
]

await mkdir(output, { recursive: true })
const report = { passed: false, scope: fullReview ? 'complete workflows, software conditions' : 'representative nodes, software conditions',
  viewport, cases: [], pageErrors: [], modelRequests: 0 }
const browser = await chromium.launch({
  executablePath: process.env.EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=d3d11'],
})

async function openPage(address = url.toString()) {
  const page = await browser.newPage({ viewport })
  page.on('pageerror', error => report.pageErrors.push(error.message))
  page.on('request', request => {
    if (request.method() === 'POST' && /\/api\/ai-agent\/chat$/.test(request.url())) report.modelRequests++
  })
  await page.goto(address, { waitUntil: 'domcontentloaded' })
  await page.locator('.agent-fab').click()
  await page.evaluate(async () => {
    const { viewerService } = await import('/src/platform/viewer/ViewerService.ts')
    const { constructionReview, constructionReviews } = await import('/src/platform/tasks/ConstructionReview.ts')
    const { getTaskWorkflowController } = await import('/src/platform/tasks/TaskWorkflowBridge.ts')
    // Import once. The polling callbacks must return a boolean synchronously.
    window.__reviewComparison = {
      viewer: () => viewerService.current,
      status: () => getTaskWorkflowController().getStatus(),
      review: () => {
        const current = constructionReview.value
        return current && { taskId: current.taskId, assemblyOnly: current.assemblyOnly,
          stage: constructionReviews[current.kind].steps[current.stepIndex]?.key }
      },
    }
  })
  await page.waitForFunction(() => !!window.__reviewComparison.viewer())
  await page.evaluate(() => {
    const viewer = window.__reviewComparison.viewer()
    window.__comparisonViewer = viewer
    window.__terrainTransitions = [viewer.terrainProvider.constructor.name]
    window.__environmentChangedAt = performance.now()
    const markEnvironmentChange = () => { window.__environmentChangedAt = performance.now() }
    viewer.scene.globe.terrainProviderChanged.addEventListener(provider => {
      window.__terrainTransitions.push(provider.constructor.name)
      markEnvironmentChange()
    })
    viewer.imageryLayers.layerAdded.addEventListener(markEnvironmentChange)
    viewer.imageryLayers.layerRemoved.addEventListener(markEnvironmentChange)
  })
  await waitForTiles(page)
  return page
}

async function waitForTiles(page) {
  await page.waitForFunction(() => {
    const viewer = window.__reviewComparison.viewer()
    if (viewer && viewer !== window.__comparisonViewer) throw Error('实验页面 Viewer 已更换')
    return viewer?.terrainProvider.constructor.name === 'CesiumTerrainProvider' &&
      viewer.imageryLayers.length > 0 && viewer.imageryLayers.get(0).ready &&
      !!viewer.scene.globe.translucency.frontFaceAlphaByDistance && viewer.scene.globe.tilesLoaded &&
      performance.now() - window.__environmentChangedAt >= 500
  }, undefined, { timeout: 45000 })
}

async function send(page, request) {
  const selector = '.agent-messages .msg-row.assistant .msg-block .msg-bubble'
  const index = await page.locator(selector).count()
  await page.locator('.agent-input').fill(request)
  await page.locator('.agent-input').press('Enter')
  await page.waitForFunction(({ selector, index }) => !!document.querySelectorAll(selector)[index]?.textContent?.trim(),
    { selector, index }, { timeout: 90000 })
  return page.locator(selector).nth(index).innerText()
}

async function readScene(page) {
  return page.evaluate(async () => {
    const { getTaskWorkflowController } = await import('/src/platform/tasks/TaskWorkflowBridge.ts')
    const { viewerService } = await import('/src/platform/viewer/ViewerService.ts')
    const { getActiveThreeBenchModel } = await import('/src/modules/rock/three-bench-resource.ts')
    const { getTestSectionSupportModels, getTaskSupportLayers } = await import('/src/modules/support/test-section-resource.ts')
    const { getBlastModel, blastLayerVisibility } = await import('/src/views/tunnel-module/blast.ts')
    const { getActiveJetFan, getJetFanPlacement } = await import('/src/modules/ventilation/axial-fan-resource.ts')
    const { resourceRegistry } = await import('/src/platform/resources/ResourceRegistry.ts')
    const { getTaskVolumeCutState } = await import('/src/platform/tasks/TaskVolumeCut.ts')
    const { nativeRockModels, WORKFACE_SURFACE_ID } = await import('/src/modules/rock/native-model-resources.ts')
    const { constructionReview, constructionReviews } = await import('/src/platform/tasks/ConstructionReview.ts')
    const status = getTaskWorkflowController().getStatus()
    const viewer = viewerService.require()
    const resources = [...(status.lastCompletedStage?.assembledResourceIds ?? [])].sort()
    const workface = nativeRockModels([WORKFACE_SURFACE_ID])[0]
    const matrices = [workface, getActiveThreeBenchModel(), ...getTestSectionSupportModels(resources), getBlastModel(), getActiveJetFan()]
      .filter(Boolean).map(model => Array.from({ length: 16 }, (_, i) => model.modelMatrix[i]))
    const pose = [viewer.camera.positionWC, viewer.camera.directionWC, viewer.camera.upWC]
      .map(({ x, y, z }) => [x, y, z])
    const overlays = document.querySelectorAll('[data-ventilation-owner="ventilation.co-analysis"]')
    const markers = viewer.entities.values.filter(entity => entity.id.startsWith('construction-review-'))
    const globe = viewer.scene.globe
    const translucency = globe.translucency
    const distance = value => value ? [value.near, value.nearValue, value.far, value.farValue] : null
    return {
      taskId: status.taskId, status: status.status, resources, matrices, pose,
      terrainTransitions: [...window.__terrainTransitions],
      step: constructionReview.value && constructionReview.value.taskId === status.taskId
        ? constructionReviews[constructionReview.value.kind].steps[constructionReview.value.stepIndex]?.key : null,
      workfaceShader: !!workface?.customShader, blastCloud: getBlastModel()?.show ?? null,
      range: status.lastCompletedStage?.chainageRange, fanStation: getJetFanPlacement()?.chainage ?? null,
      paths: resources.flatMap(id => resourceRegistry.get(id)?.getActiveAssetPaths?.() ?? []).sort(),
      cut: getTaskVolumeCutState(), anchors: getTaskSupportLayers(resources).filter(item => item.component.endsWith('_anchor')),
      blastHoles: resources.includes('blast.effect') ? blastLayerVisibility.holes : null,
      coVisible: [...overlays].some(element => element.getBoundingClientRect().height > 0),
      markers: markers.length, visibleMarkers: markers.filter(entity => entity.show).length,
      environment: {
        terrain: viewer.terrainProvider.constructor.name, globe: globe.show,
        translucency: [translucency.enabled, translucency.frontFaceAlpha, translucency.backFaceAlpha,
          distance(translucency.frontFaceAlphaByDistance), distance(translucency.backFaceAlphaByDistance)],
        imagery: Array.from({ length: viewer.imageryLayers.length }, (_, i) => {
          const layer = viewer.imageryLayers.get(i)
          return { show: layer.show, alpha: layer.alpha, brightness: layer.brightness, saturation: layer.saturation }
        }),
      },
    }
  })
}

async function fingerprints(page, taskId) {
  const response = await page.request.get(new URL(`/api/ai-agent/task-runs/${encodeURIComponent(taskId)}/snapshots`, url).toString())
  assert.ok(response.ok(), `task snapshot request failed: ${response.status()}`)
  const snapshots = await response.json()
  const assetVersions = snapshots.filter(item => item.workflow_state?.status === 'completed' && item.data_versions?.length).at(-1)?.data_versions
  assert.ok(assetVersions?.length)
  return assetVersions.map(({ sourceId, algorithm, digest }) => ({ sourceId, algorithm, digest }))
    .sort((a, b) => a.sourceId.localeCompare(b.sourceId))
}

async function assertPanelsSeparate(page, scenario) {
  if (scenario.stage === 'workface') return
  const info = await page.locator('.agent-assembly-info').boundingBox()
  const reference = await page.locator(scenario.key === 'support' ? '.d2d' : '[data-ventilation-owner="ventilation.co-analysis"]').boundingBox()
  assert.ok(info && reference && info.y + info.height <= reference.y, 'task panel covers the reference graphic')
}

async function manualAssembly(page, scenario) {
  await page.getByRole('button', { name: '表单', exact: true }).click()
  const form = page.locator('.chat-task-form')
  await form.getByLabel('任务类型').selectOption('scene-exploration')
  await form.getByLabel('任务目标').fill(`${scenario.title} ${scenario.mileage} ${scenario.placement}`)
  await form.getByLabel('目标里程').fill(scenario.mileage)
  await form.getByLabel('隧洞').locator('option').nth(1).waitFor({ state: 'attached' })
  await form.getByLabel('隧洞').selectOption({ index: 1 })
  const remove = form.getByRole('button', { name: '移除', exact: true })
  while (await remove.count()) await remove.first().click()
  for (const id of scenario.resources) {
    await form.getByLabel('追加场景资源').selectOption(id)
    await form.getByRole('button', { name: '添加阶段', exact: true }).click()
  }
  if (scenario.supportLength) await form.getByLabel('支护长度（米）').fill(scenario.supportLength)
  await form.getByRole('button', { name: '校验并创建计划' }).click()
  await form.waitFor({ state: 'detached' })
  await page.getByRole('button', { name: '记录', exact: true }).click()
  const panel = page.getByRole('complementary', { name: '任务运行记录与调试' })
  const manualTrace = []
  for (let index = 0; index <= scenario.resources.length; index++) {
    const before = await page.evaluate(() => window.__reviewComparison.status())
    if (before.status === 'completed') break
    manualTrace.push(before.currentStepId)
    await panel.getByRole('button', { name: '执行下一步', exact: true }).click()
    await page.waitForFunction(completed => {
      const state = window.__reviewComparison.status()
      if (state.status === 'failed') throw Error(state.notice?.message ?? 'Manual stage failed')
      return state.completed === completed
    }, before.completed + 1, { timeout: 60000 })
  }
  await page.getByRole('button', { name: '关闭任务流程面板', exact: true }).click()
  return manualTrace
}

const placement = ({ resources, matrices, range, paths, fanStation }) => ({ resources, matrices, range, paths, fanStation })
const presentation = ({ anchors, blastHoles, blastCloud, coVisible, cut, markers, visibleMarkers, workfaceShader }) =>
  ({ anchors, blastHoles, blastCloud, coVisible, cut, markers, visibleMarkers, workfaceShader })
function assertSamePose(before, after) {
  for (const [index, vector] of before.entries()) {
    const tolerance = index === 0 ? 1e-6 : 1e-12
    assert.ok(vector.every((value, axis) => Math.abs(value - after[index][axis]) <= tolerance), 'camera pose was not restored')
  }
}

async function restorePresentation(page, baseline) {
  assert.match(await send(page, '恢复复盘装配表达'), /已恢复增强前的装配表达/)
  await page.getByTestId('construction-review').waitFor({ state: 'detached' })
  await waitForTiles(page)
  const state = await readScene(page)
  assert.equal(state.taskId, baseline.taskId)
  assert.equal(state.step, baseline.step)
  assert.deepEqual(placement(state), placement(baseline))
  assert.deepEqual(presentation(state), presentation(baseline))
  assert.deepEqual(state.environment, baseline.environment)
  assertSamePose(baseline.pose, state.pose)
  return state
}

async function verifyAnnotationAblation(page, key, enhanced) {
  const panel = page.getByTestId('construction-review')
  const contents = await panel.innerText()
  const clip = await page.evaluate(async () => {
    const { viewerService } = await import('/src/platform/viewer/ViewerService.ts')
    const { readTaskViewport } = await import('/src/platform/tasks/TaskViewport.ts')
    const safe = readTaskViewport(viewerService.require())?.safe
    return safe && { x: Math.ceil(safe.left), y: Math.ceil(safe.top),
      width: Math.floor(safe.right) - Math.ceil(safe.left), height: Math.floor(safe.bottom) - Math.ceil(safe.top) }
  })
  assert.ok(clip)
  const shot = async suffix => {
    await waitForTiles(page)
    await page.evaluate(async () => {
      const { viewerService } = await import('/src/platform/viewer/ViewerService.ts')
      const scene = viewerService.require().scene
      await new Promise(resolve => {
        const stop = scene.postRender.addEventListener(() => { stop(); resolve() })
        scene.requestRender()
      })
    })
    await page.screenshot({ clip, path: `${output}/${key}-annotations-${suffix}.png` })
  }
  assert.ok(enhanced.visibleMarkers > 0)
  const linkedReference = panel.getByRole('button', { name: key === 'support' ? /定位ZZ-IVb 初支/ : /定位洞顶射流风机/ })
  await linkedReference.click()
  assert.equal(await linkedReference.getAttribute('aria-pressed'), 'true')
  const linked = await readScene(page)
  assert.ok(linked.visibleMarkers > enhanced.visibleMarkers)
  assertSamePose(enhanced.pose, linked.pose)
  assert.match(await send(page, '隐藏复盘三维标注'), /已隐藏复盘三维标注/)
  assert.equal(await linkedReference.isDisabled(), true)
  assert.equal(await linkedReference.getAttribute('aria-pressed'), 'false')
  const without = await readScene(page)
  assert.equal(without.taskId, enhanced.taskId)
  assert.equal(without.step, enhanced.step)
  assert.equal(await panel.innerText(), contents)
  assert.deepEqual(placement(without), placement(enhanced))
  assert.deepEqual(without.environment, enhanced.environment)
  assert.deepEqual(presentation(without), { ...presentation(enhanced), visibleMarkers: 0 })
  assertSamePose(enhanced.pose, without.pose)
  await shot('off')
  assert.match(await send(page, '显示复盘三维标注'), /已显示复盘三维标注/)
  assert.equal(await linkedReference.isEnabled(), true)
  assert.equal(await linkedReference.getAttribute('aria-pressed'), 'false')
  const restored = await readScene(page)
  assert.equal(restored.taskId, enhanced.taskId)
  assert.equal(restored.step, enhanced.step)
  assert.equal(await panel.innerText(), contents)
  assert.deepEqual(placement(restored), placement(enhanced))
  assert.deepEqual(restored.environment, enhanced.environment)
  assert.deepEqual(presentation(restored), presentation(enhanced))
  assertSamePose(enhanced.pose, restored.pose)
  await shot('on')
  return { clip, on: enhanced.visibleMarkers, off: without.visibleMarkers, restored: restored.visibleMarkers }
}

async function verifyReferenceLinkAblation(page, key, enhanced) {
  const panel = page.getByTestId('construction-review')
  const text = await panel.innerText()
  const markerId = key === 'support' ? 'construction-review-reference-2238' : 'construction-review-reference-3988'
  const button = panel.getByRole('button', { name: key === 'support' ? /定位ZZ-IVb 初支/ : /定位洞顶射流风机/ })
  const readButtonDisplay = () => button.evaluate(element => {
    const { x, y, width, height } = element.getBoundingClientRect()
    const { color, backgroundColor, borderColor, opacity, fontSize } = getComputedStyle(element)
    return { x, y, width, height, color, backgroundColor, borderColor, opacity, fontSize }
  })
  const buttonDisplay = await readButtonDisplay()
  assert.match(await send(page, '关闭复盘里程联动'), /已关闭复盘里程联动/)
  assert.equal(await button.isDisabled(), true)
  if (key === 'support') assert.equal(await panel.getByRole('button', { name: '显露系统锚杆' }).isEnabled(), true)
  assert.deepEqual(await readButtonDisplay(), buttonDisplay)
  const off = await readScene(page)
  assert.equal(off.taskId, enhanced.taskId)
  assert.deepEqual(placement(off), placement(enhanced))
  assert.deepEqual(presentation(off), presentation(enhanced))
  assert.deepEqual(off.environment, enhanced.environment)
  assertSamePose(enhanced.pose, off.pose)
  assert.equal(await panel.innerText(), text)
  const { labelHit, modelHit } = await page.evaluate(async ({ id, key, roots }) => {
    const { viewerService } = await import('/src/platform/viewer/ViewerService.ts')
    const { getTestSectionSupportModels } = await import('/src/modules/support/test-section-resource.ts')
    const { getActiveJetFan } = await import('/src/modules/ventilation/axial-fan-resource.ts')
    const { canvas, clock, entities, scene } = viewerService.require()
    const C = window.Cesium
    const marker = entities.getById(id)
    const projection = C.SceneTransforms.worldToWindowCoordinates(scene, marker.position.getValue(clock.currentTime))
    const offset = marker.label.pixelOffset.getValue(clock.currentTime)
    const rect = canvas.getBoundingClientRect()
    const scan = (origin, identifies) => {
      for (const dy of [0, 4, -4, 10, -10, 20, -20]) for (const dx of [0, 4, -4, 10, -10, 20, -20]) {
        const x = Math.round(origin.x + dx + rect.left)
        const y = Math.round(origin.y + dy + rect.top)
        if (document.elementFromPoint(x, y) === canvas && identifies(new C.Cartesian2(x - rect.left, y - rect.top))) return { x, y }
      }
      return null
    }
    const models = key === 'support' ? getTestSectionSupportModels(roots) : [getActiveJetFan()]
    const center = C.SceneTransforms.worldToWindowCoordinates(scene, models[Math.floor(models.length / 2)].boundingSphere.center)
    const labelHit = scan(C.Cartesian2.add(projection, offset, new C.Cartesian2()), point => scene.pick(point)?.id === marker)
    const modelHit = scan(center, point => {
      const found = scene.drillPick(point, 4).find(pick => models.includes(pick.primitive) ||
        (typeof pick.id?.id === 'string' && pick.id.id.startsWith('construction-review-')))
      return found && models.includes(found.primitive)
    })
    return { labelHit, modelHit }
  }, { id: markerId, key, roots: enhanced.resources })
  assert.ok(labelHit && modelHit, `找不到 ${markerId} 的可拾取标注与模型像素`)
  await page.mouse.click(labelHit.x, labelHit.y)
  await page.mouse.click(modelHit.x, modelHit.y)
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  assert.equal(await panel.locator('button[aria-pressed="true"]').count(), 0)
  assert.deepEqual(presentation(await readScene(page)), presentation(enhanced))
  assert.match(await send(page, '开启复盘里程联动'), /已开启复盘里程联动/)
  assert.equal(await button.isEnabled(), true)
  await page.mouse.click(modelHit.x, modelHit.y)
  const name = await button.getAttribute('aria-label')
  await page.waitForFunction(label => document.querySelector(`button[aria-label="${label}"]`)?.getAttribute('aria-pressed') === 'true', name, { timeout: 5000 })
  const on = await readScene(page)
  assert.equal(on.taskId, off.taskId)
  assert.deepEqual(placement(on), placement(off))
  assertSamePose(off.pose, on.pose)
  assert.ok(on.visibleMarkers > off.visibleMarkers)
  await button.press('Enter')
  assert.deepEqual(presentation(await readScene(page)), presentation(enhanced))
  return { markerId, labelHit, modelHit, sameCamera: true, sameButtonDisplay: true,
    staticMarkers: off.visibleMarkers, selectedMarkers: on.visibleMarkers }
}
const reset = async page => {
  assert.match(await send(page, '复位当前任务场景'), /复位/)
  await page.locator('.agent-assembly-info').waitFor({ state: 'detached' })
  const state = await readScene(page)
  assert.deepEqual(state.matrices, [])
  assert.equal(state.markers, 0)
}

async function verifySequence(stages) {
  const result = { key: stages[0].key, stages: stages.map(({ stage }) => ({ key: stage })) }
  report.cases.push(result)
  for (const condition of ['manual', 'assembly', 'enhanced']) {
    const page = await openPage()
    const versionCache = new Map()
    let previous
    for (const [index, scenario] of stages.entries()) {
      const expectedIds = [...scenario.resources].sort()
      const sameResources = previous?.resources.join() === expectedIds.join()
      let manualTrace
      if (condition === 'manual') {
        manualTrace = sameResources ? [] : await manualAssembly(page, scenario)
      } else {
        const command = condition === 'assembly' ? '仅装配整段复盘' : '先仅启动复核'
        const reply = await send(page, index === 0 ? `${command}。${scenario.title}` : '下一步')
        assert.doesNotMatch(reply, /未完成|未就绪/)
      }
      await page.locator('.agent-assembly-info').waitFor()
      if (condition === 'enhanced') {
        await page.locator(`[data-testid="construction-review"][data-stage="${scenario.stage}"]`).waitFor()
      }
      if (condition === 'assembly') {
        await page.waitForFunction(stage => {
          const current = window.__reviewComparison.review()
          const status = window.__reviewComparison.status()
          return current?.assemblyOnly && current.taskId === status.taskId && current.stage === stage
        }, scenario.stage)
      }
      await waitForTiles(page)
      if (condition !== 'enhanced' || ['reveal', 'ventilation'].includes(scenario.stage)) {
        await assertPanelsSeparate(page, scenario)
      }
      const state = await readScene(page)
      const outputState = result.stages[index]
      outputState[condition] = { ...state, manualTrace }
      assert.equal(state.status, 'completed')
      assert.deepEqual(state.resources, expectedIds)
      assert.equal(state.range.start, scenario.chainage)
      if (previous) assert.equal(previous.taskId === state.taskId, sameResources, `unexpected reassembly at ${scenario.stage}`)
      if (!versionCache.has(state.taskId)) versionCache.set(state.taskId, await fingerprints(page, state.taskId))
      outputState[condition].fingerprints = versionCache.get(state.taskId)
      if (condition !== 'manual') {
        assert.equal(state.step, scenario.stage)
        assert.deepEqual(placement(state), placement(outputState.manual))
        assert.deepEqual(state.environment, outputState.manual.environment)
        assert.deepEqual(outputState[condition].fingerprints, outputState.manual.fingerprints)
      }
      if (condition === 'enhanced') {
        assert.ok(state.markers > 0)
        if (scenario.stage === 'workface') assert.equal(state.workfaceShader, true)
        if (['baseline', 'candidate'].includes(scenario.stage)) assert.ok(state.anchors.every(layer => !layer.visible))
        if (scenario.key === 'handoff') {
          assert.equal(state.fanStation, 3988)
          assert.equal(state.coVisible, scenario.stage === 'ventilation')
          assert.equal(state.blastCloud, scenario.stage !== 'ventilation')
        }
      } else {
        assert.equal(state.markers, 0)
        assert.equal(state.workfaceShader, false)
      }
      await page.screenshot({ path: `${output}/${scenario.stage}-${condition}.png` })
      if (condition === 'assembly' && ['workface', 'ventilation'].includes(scenario.stage)) {
        assert.doesNotMatch(await send(page, '增强当前复盘'), /未完成/)
        await page.getByTestId('construction-review').waitFor()
        outputState.restored = await restorePresentation(page, state)
      }
      previous = state
    }
    if (condition !== 'manual') {
      assert.match(await send(page, '下一步'), /已到复盘流程边界/)
      assert.equal((await readScene(page)).taskId, previous.taskId)
    }
    await reset(page)
    await page.close()
  }
}

try {
  if (fullReview) {
    for (const stages of sequences) await verifySequence(stages)
  } else for (const scenario of cases) {
    const result = { key: scenario.key }
    report.cases.push(result)
    const manualPage = await openPage()
    const manualTrace = await manualAssembly(manualPage, scenario)
    await manualPage.locator('.agent-assembly-info').waitFor()
    await assertPanelsSeparate(manualPage, scenario)
    await waitForTiles(manualPage)
    result.manual = { ...await readScene(manualPage), manualTrace }
    assert.equal(result.manual.status, 'completed')
    result.manual.fingerprints = await fingerprints(manualPage, result.manual.taskId)
    await manualPage.screenshot({ path: `${output}/${scenario.key}-manual.png` })
    await reset(manualPage)
    await manualPage.close()

    const agentPage = await openPage()
    assert.match(await send(agentPage, `仅装配复盘场景。${scenario.title}`), /使用平台默认场景表达/)
    await agentPage.locator('.agent-assembly-info').waitFor()
    await assertPanelsSeparate(agentPage, scenario)
    await waitForTiles(agentPage)
    result.assembly = await readScene(agentPage)
    assert.equal(result.assembly.status, 'completed')
    assert.equal(result.assembly.range.start, scenario.chainage)
    assert.deepEqual(result.assembly.resources, [...scenario.resources].sort())
    assert.deepEqual(placement(result.assembly), placement(result.manual))
    assert.deepEqual(result.assembly.environment, result.manual.environment)
    result.assembly.fingerprints = await fingerprints(agentPage, result.assembly.taskId)
    assert.deepEqual(result.assembly.fingerprints, result.manual.fingerprints)
    assert.equal(result.assembly.markers, 0)
    await agentPage.screenshot({ path: `${output}/${scenario.key}-assembly.png` })

    assert.doesNotMatch(await send(agentPage, '增强当前复盘'), /未完成/)
    await agentPage.locator(`[data-testid="construction-review"][data-stage="${scenario.stage}"]`).waitFor()
    await waitForTiles(agentPage)
    result.enhanced = await readScene(agentPage)
    assert.equal(result.enhanced.taskId, result.assembly.taskId)
    assert.deepEqual(placement(result.enhanced), placement(result.assembly))
    assert.deepEqual(result.enhanced.environment, result.assembly.environment)
    assert.ok(result.enhanced.markers > 0)
    assert.notDeepEqual(result.enhanced.pose, result.assembly.pose)
    if (scenario.key === 'support') {
      assert.ok(result.assembly.anchors.some(layer => layer.visible))
      assert.ok(result.enhanced.anchors.every(layer => !layer.visible))
    } else {
      assert.equal(result.assembly.coVisible, true)
      assert.equal(result.enhanced.coVisible, false)
      assert.equal(result.enhanced.blastHoles, false)
      assert.equal(result.enhanced.fanStation, 3988)
    }
    await agentPage.screenshot({ path: `${output}/${scenario.key}-enhanced.png` })
    result.referenceLinkAblation = await verifyReferenceLinkAblation(agentPage, scenario.key, result.enhanced)
    result.annotationAblation = await verifyAnnotationAblation(agentPage, scenario.key, result.enhanced)
    result.restored = await restorePresentation(agentPage, result.assembly)
    await agentPage.screenshot({ path: `${output}/${scenario.key}-restored.png` })
    assert.match(await send(agentPage, '恢复复盘装配表达'), /没有可恢复/)
    assert.doesNotMatch(await send(agentPage, '增强当前复盘'), /未完成/)
    await agentPage.getByTestId('construction-review').waitFor()
    const replay = await readScene(agentPage)
    assert.equal(replay.taskId, result.enhanced.taskId)
    assert.deepEqual(placement(replay), placement(result.enhanced))
    assert.deepEqual(presentation(replay), presentation(result.enhanced))
    assertSamePose(result.enhanced.pose, replay.pose)
    result.replayed = true
    await reset(agentPage)
    await agentPage.close()
  }
  const ordinaryPage = await openPage(ordinaryUrl)
  assert.match(await send(ordinaryPage, `仅装配复盘场景。${cases[0].title}`), /仅用于开发环境/)
  assert.match(await send(ordinaryPage, `仅装配整段复盘。${cases[0].title}`), /仅用于开发环境/)
  assert.equal(await ordinaryPage.locator('.agent-assembly-info').count(), 0)
  assert.match(await send(ordinaryPage, `先仅启动复核。${cases[0].title}`), /观察掌子面岩面/)
  assert.match(await send(ordinaryPage, '关闭复盘里程联动'), /仅用于开发环境/)
  await reset(ordinaryPage)
  assert.deepEqual(report.pageErrors, [])
  assert.equal(report.modelRequests, 0)
  report.passed = true
} catch (error) {
  report.failure = String(error.stack ?? error)
  throw error
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2))
  await browser.close()
}
