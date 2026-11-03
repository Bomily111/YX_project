import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
try {
  const page = await browser.newPage()
  await page.goto(`${process.env.BROWSER_APP_URL || 'http://localhost:5173'}/@vite/client`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  const result = await page.evaluate(async () => {
    const { buildInstancedGlb } = await import('/src/modules/support/alternating-resource.ts')
    const buffer = await buildInstancedGlb(1321)
    const view = new DataView(buffer)
    const chunkLength = view.getUint32(12, true)
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, chunkLength)))
    const Cesium = await import('/node_modules/.vite/deps/cesium.js')
    const { modelerSectionFrame } = await import('/src/modules/support/modeler-resources.ts')
    const { chainageService } = await import('/src/platform/coordinates/ChainageService.ts')
    document.body.innerHTML = '<div id="scene" style="width:900px;height:600px"></div>'
    const viewer = new Cesium.Viewer('scene', {
      baseLayer: false, animation: false, timeline: false, geocoder: false,
      baseLayerPicker: false, navigationHelpButton: false, homeButton: false,
      sceneModePicker: false, fullscreenButton: false, infoBox: false,
    })
    const objectUrl = URL.createObjectURL(new Blob([buffer], { type: 'model/gltf-binary' }))
    let renderReady = false
    let centerlineDistance = null
    try {
      const model = await Cesium.Model.fromGltfAsync({
        url: objectUrl, modelMatrix: modelerSectionFrame(1321),
        upAxis: Cesium.Axis.Z, forwardAxis: Cesium.Axis.X,
      })
      viewer.scene.primitives.add(model)
      for (let attempt = 0; attempt < 120 && !model.ready; attempt++) {
        viewer.scene.render()
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      renderReady = model.ready
      if (renderReady) centerlineDistance = Cesium.Cartesian3.distance(
        model.boundingSphere.center, chainageService.worldPositionAt(1346))
    } finally {
      URL.revokeObjectURL(objectUrl)
      viewer.destroy()
    }
    return {
      byteLength: buffer.byteLength,
      extensions: json.extensionsUsed,
      instanceNodes: json.nodes.filter(node => node.extensions?.EXT_mesh_gpu_instancing).length,
      instanceCounts: json.nodes.filter(node => node.extensions?.EXT_mesh_gpu_instancing)
        .map(node => json.accessors[node.extensions.EXT_mesh_gpu_instancing.attributes.TRANSLATION].count),
      renderReady,
      centerlineDistance,
    }
  })
  if (!result.extensions?.includes('EXT_mesh_gpu_instancing') ||
    result.instanceNodes < 2 || result.instanceCounts.some(count => count !== 25) ||
    !result.renderReady || !(result.centerlineDistance < 35)) {
    throw new Error(`Invalid alternating support GLB: ${JSON.stringify(result)}`)
  }
  console.log(JSON.stringify({ bytes: result.byteLength, instanceNodes: result.instanceNodes,
    copiesPerMesh: [...new Set(result.instanceCounts)], cesiumReady: result.renderReady,
    centerlineDistanceM: Math.round(result.centerlineDistance * 100) / 100 }))
} finally {
  await browser.close()
}
