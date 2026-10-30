import { chromium } from 'playwright-core'

const watchdog = setTimeout(() => {
  console.error('Voxel depth prototype exceeded 90 seconds')
  process.exit(124)
}, 90_000)
watchdog.unref()

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 720 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.route('**/voxel-depth-harness*', route => route.fulfill({
    status: 200, contentType: 'text/html', body: `<!doctype html><html><head>
      <link rel="stylesheet" href="/cesium/Widgets/widgets.css">
      <style>html,body,#viewer{width:100%;height:100%;margin:0;overflow:hidden}</style>
      </head><body><div id="viewer"></div><script src="/cesium/Cesium.js"></script></body></html>`,
  }))
  const appUrl = process.env.BROWSER_APP_URL || 'http://localhost:5173'
  const harnessUrl = new URL('/voxel-depth-harness', appUrl)
  if (process.env.DEBUG_VOLUME) harnessUrl.searchParams.set('debug-volume',
    process.env.DEBUG_VOLUME === 'depth' ? '2' : '1')
  await page.goto(harnessUrl.href, { waitUntil: 'load' })
  await page.waitForFunction(() => !!window.Cesium, null, { timeout: 45_000 })
  console.log('Cesium harness ready')
  const state = await page.evaluate(async ({ depthTest, postprocessProbe, realTsp }) => {
    let stage = 'imports'
    try {
    const Cesium = window.Cesium
    if (!Cesium) throw new Error('Cesium global is unavailable')
    const { modelerSectionFrame } = await import('/src/modules/support/modeler-resources.ts')
    const viewer = new Cesium.Viewer('viewer', { imageryProvider: false, baseLayerPicker: false,
      geocoder: false, homeButton: false, navigationHelpButton: false, timeline: false,
      animation: false, sceneModePicker: false, infoBox: false, selectionIndicator: false })
    window.__voxelDepthViewer = viewer
    viewer.scene.globe.show = false
    viewer.scene.skyBox.show = false
    viewer.scene.skyAtmosphere.show = false
    viewer.scene.backgroundColor = Cesium.Color.BLACK
    stage = 'frame'
    const frame = modelerSectionFrame(1346)
    const center = Cesium.Matrix4.getTranslation(frame, new Cesium.Cartesian3())
    const box = viewer.entities.add({
      position: center,
      box: { dimensions: new Cesium.Cartesian3(8, 8, 8), material: Cesium.Color.YELLOW },
    })
    const dimension = 16
    const values = new Uint8Array(dimension ** 3).fill(180)
    const provider = {
      ready: true, shape: Cesium.VoxelShapeType.BOX,
      dimensions: new Cesium.Cartesian3(dimension, dimension, dimension),
      names: ['value'], types: [Cesium.MetadataType.SCALAR],
      componentTypes: [Cesium.MetadataComponentType.UINT8],
      maximumTileCount: 1,
      minBounds: new Cesium.Cartesian3(-1, -1, -1), maxBounds: Cesium.Cartesian3.ONE,
      requestData: () => Promise.resolve(Cesium.VoxelContent.fromMetadataArray([values])),
    }
    stage = 'voxel transform'
    const transform = Cesium.Matrix4.fromTranslationQuaternionRotationScale(
      center, Cesium.Quaternion.IDENTITY, new Cesium.Cartesian3(6, 6, 6), new Cesium.Matrix4())
    stage = 'voxel constructor'
    const voxel = new Cesium.VoxelPrimitive({ provider, modelMatrix: transform,
      customShader: new Cesium.CustomShader({ fragmentShaderText: `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
        material.diffuse = vec3(0.0, 0.75, 1.0);
        material.alpha = 0.24;
      }` }),
    })
    window.__voxelDepthPrototype = voxel
    voxel.depthTest = depthTest
    if (!realTsp) viewer.scene.primitives.add(voxel)
    stage = 'support model'
    const support = await Cesium.Model.fromGltfAsync({
      url: '/support-modeler/outputs/master_demo/ZZ-Va_support_1m_current.glb',
      modelMatrix: frame,
    })
    window.__voxelDepthSupport = support
    viewer.scene.primitives.add(support)
    stage = 'camera'
    viewer.camera.viewBoundingSphere(new Cesium.BoundingSphere(center, 12), new Cesium.HeadingPitchRange(0.3, -0.3, 42))
    viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
    const toCamera = Cesium.Cartesian3.normalize(Cesium.Cartesian3.subtract(viewer.camera.positionWC, center,
      new Cesium.Cartesian3()), new Cesium.Cartesian3())
    box.position = new Cesium.ConstantPositionProperty(Cesium.Cartesian3.add(center,
      Cesium.Cartesian3.multiplyByScalar(toCamera, -4, new Cesium.Cartesian3()), new Cesium.Cartesian3()))
    if (realTsp) {
      stage = 'real TSP postprocess'
      const { createDepthAwareTspVolume } = await import('/src/modules/rock/depth-aware-tsp-volume.ts')
      const local = Cesium.Matrix4.fromArray([
        40, 0, 0, 0, 0, 0, 100, 0, 0, 40, 0, 0, -20, -20, -10, 1,
      ])
      const volumeMatrix = Cesium.Matrix4.multiply(frame, local, new Cesium.Matrix4())
      const tsp = await createDepthAwareTspVolume(viewer, '/data/tsp_actual/hardness.json',
        volumeMatrix, 'hardness', undefined, Number(new URLSearchParams(location.search).get('debug-volume') || 0))
      window.__realTspDepthVolume = tsp
      const target = Cesium.Matrix4.multiplyByPoint(volumeMatrix,
        new Cesium.Cartesian3(0.5, 0.23, 0.5), new Cesium.Cartesian3())
      viewer.camera.viewBoundingSphere(new Cesium.BoundingSphere(target, 22),
        new Cesium.HeadingPitchRange(0.6, -0.35, 70))
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
    }
    if (postprocessProbe) {
      viewer.scene.postProcessStages.add(new Cesium.PostProcessStage({
        name: 'voxel-depth-probe',
        fragmentShader: `uniform sampler2D colorTexture;
          uniform sampler2D depthTexture;
          in vec2 v_textureCoordinates;
          void main() {
            vec2 uv = v_textureCoordinates;
            vec4 color = texture(colorTexture, uv);
            float depth = czm_readDepth(depthTexture, uv);
            if (uv.x > 0.30 && uv.x < 0.70 && uv.y > 0.25 && uv.y < 0.75 && depth > 0.999) {
              color.rgb = mix(color.rgb, vec3(0.0, 0.2, 1.0), 0.75);
            }
            out_FragColor = color;
          }`,
      }))
    }
    viewer.scene.requestRender()
    return { voxelReady: voxel.ready, depthTest: voxel.depthTest, supportReady: support.ready,
      postprocessProbe, realTsp }
    } catch (error) { return { stage, error: String(error), stack: error?.stack } }
  }, { depthTest: process.env.DEPTH_TEST !== 'false', postprocessProbe: process.env.POSTPROCESS_PROBE === 'true',
    realTsp: process.env.REAL_TSP === 'true' })
  console.log('Setup:', JSON.stringify(state))
  if (state.error) process.exitCode = 1
  await page.waitForTimeout(5000)
  const ready = await page.evaluate(async () => {
    return { voxelReady: window.__voxelDepthPrototype?.ready ?? false,
      supportReady: window.__voxelDepthSupport?.ready ?? false,
      realTspReady: window.__realTspDepthVolume?.stage.ready ?? false }
  })
  if (process.env.SCREENSHOT_PATH) await page.screenshot({ path: process.env.SCREENSHOT_PATH, timeout: 60_000 })
  console.log(JSON.stringify({ ...state, ...ready, errors }, null, 2))
  if ((!state.realTsp && !ready.voxelReady) || (state.realTsp && !ready.realTspReady) ||
      !ready.supportReady || errors.length) process.exitCode = 1
} finally {
  clearTimeout(watchdog)
  await browser.close()
}
