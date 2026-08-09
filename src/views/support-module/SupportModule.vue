<template>
  <div class="se-root">
    <div ref="host" class="se-viewer"></div>

    <!-- 顶栏 -->
    <header class="se-header">
      <span class="se-title">钢架参数化建模</span>
      <button class="se-back-btn" @click="$router.push('/')">← 返回平台</button>
    </header>

    <!-- 加载提示 -->
    <div v-if="loading" class="se-loading">
      <div class="se-loading-text">{{ loadMsg }}</div>
      <div class="se-loading-bar">
        <div class="se-loading-fill" :style="{ width: loadPct + '%' }"></div>
      </div>
    </div>

    <!-- 右侧参数面板 -->
    <aside class="se-panel">
      <div class="se-panel-title">截面参数</div>

      <div class="se-param">
        <label class="se-param-label">
          顶拱半径 R1
          <span class="se-param-val">{{ R1.toFixed(2) }} m</span>
        </label>
        <div class="se-param-row">
          <input type="range" class="se-slider" min="0.1" max="12" step="0.01"
            v-model.number="R1" />
          <input type="number" class="se-num" min="0.1" max="12" step="0.01"
            v-model.number="R1" />
        </div>
      </div>

      <div class="se-param">
        <label class="se-param-label">
          侧拱半径 R2
          <span class="se-param-val">{{ R2.toFixed(2) }} m</span>
        </label>
        <div class="se-param-row">
          <input type="range" class="se-slider" min="0.1" max="20" step="0.01"
            v-model.number="R2" />
          <input type="number" class="se-num" min="0.1" max="20" step="0.01"
            v-model.number="R2" />
        </div>
      </div>

      <div class="se-param">
        <label class="se-param-label">
          侧拱夹角 β
          <span class="se-param-val">{{ betaDeg.toFixed(2) }}°</span>
        </label>
        <div class="se-param-row">
          <input type="range" class="se-slider" min="0" max="89" step="0.01"
            v-model.number="betaDeg" />
          <input type="number" class="se-num" min="0" max="89" step="0.01"
            v-model.number="betaDeg" />
        </div>
      </div>

      <div class="se-param">
        <label class="se-param-label">工字钢型号</label>
        <select class="se-select" v-model="profileKey">
          <option value="I16">I16</option>
          <option value="I20">I20</option>
        </select>
      </div>

      <div class="se-summary">{{ profileSummary }}</div>
    </aside>

    <!-- 底部工具栏 -->
    <footer class="se-footer">
      <button class="se-fbtn" @click="flyTo('front')">正视</button>
      <button class="se-fbtn" @click="flyTo('side')">侧视</button>
      <button class="se-fbtn" @click="flyTo('top')">俯视</button>
      <button class="se-fbtn" @click="flyTo('reset')">重置视角</button>

      <span class="se-divider"></span>

      <label class="se-check">
        <input type="checkbox" v-model="showTunnel" @change="onToggleTunnel" />
        <i></i>隧道显示
      </label>

      <label class="se-opacity-label">
        透明度
        <input type="range" class="se-opacity-slider" min="0.05" max="1" step="0.05"
          v-model.number="tunnelOpacity" @input="onTunnelOpacity" />
      </label>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import * as Cesium from 'cesium'
import { generateSteelArchGLB, generateWorkfaceGLB, getProfileSummary } from './steelArch'
import {
  createSupportViewer,
  loadTunnelModel,
  setTunnelOpacity,
  getArchFocus,
  getArchModelMatrix,
  setupClickHandler,
  enableOnDemandRender,
  installOrbitControls,
} from './cesiumScene'

const host = ref<HTMLElement>()
const loading = ref(true)
const loadMsg = ref('初始化场景')
const loadPct = ref(0)

const R1 = ref(6.08)
const R2 = ref(10.58)
const betaDeg = ref(15.8797)
const profileKey = ref('I16')
const tunnelOpacity = ref(0.35)
const showTunnel = ref(true)

const profileSummary = computed(() => getProfileSummary(profileKey.value))

let viewer: Cesium.Viewer | null = null
let orbit: { handler: any; resetFocus: () => void } | null = null
let clickHandler: Cesium.ScreenSpaceEventHandler | null = null
let tunnelModel: Cesium.Model | null = null
let archModel: Cesium.Model | null = null
let workfaceModel: Cesium.Model | null = null
let archBlobUrl: string | null = null
let workfaceBlobUrl: string | null = null
let showWorkface = false
let updating = false

async function regenerateArch() {
  if (!viewer || !tunnelModel || updating) return
  updating = true

  try {
    const params = {
      R1: R1.value,
      R2: R2.value,
      betaDeg: betaDeg.value,
      profileKey: profileKey.value,
    }
    const modelMatrix = getArchModelMatrix(tunnelModel)

    // 钢架
    const glb = await generateSteelArchGLB(params)
    console.log('[钢架] GLB 生成完成, 大小:', (glb.byteLength / 1024).toFixed(1), 'KB')
    if (archBlobUrl) URL.revokeObjectURL(archBlobUrl)
    archBlobUrl = URL.createObjectURL(new Blob([glb], { type: 'application/octet-stream' }))
    const model = await Cesium.Model.fromGltfAsync({ url: archBlobUrl, modelMatrix })

    if (archModel) viewer.scene.primitives.remove(archModel)
    archModel = model
    viewer.scene.primitives.add(model)

    // 工作面
    const wfGlb = await generateWorkfaceGLB(params)
    if (workfaceBlobUrl) URL.revokeObjectURL(workfaceBlobUrl)
    workfaceBlobUrl = URL.createObjectURL(new Blob([wfGlb], { type: 'application/octet-stream' }))
    const wfModel = await Cesium.Model.fromGltfAsync({ url: workfaceBlobUrl, modelMatrix })
    wfModel.show = showWorkface

    if (workfaceModel) viewer.scene.primitives.remove(workfaceModel)
    workfaceModel = wfModel
    viewer.scene.primitives.add(wfModel)

    viewer.scene.requestRender()
    console.log('[钢架] 钢架+工作面已更新')
  } catch (err) {
    console.error('[钢架] 更新失败:', err)
  } finally {
    updating = false
  }
}

function toggleWorkface() {
  showWorkface = !showWorkface
  if (workfaceModel) workfaceModel.show = showWorkface
  // 切换时改变钢架颜色：工作面显示时高亮
  if (archModel) {
    archModel.color = showWorkface
      ? Cesium.Color.fromCssColorString('#e2e8f0')
      : undefined
    archModel.colorBlendMode = showWorkface
      ? Cesium.ColorBlendMode.REPLACE
      : Cesium.ColorBlendMode.HIGHLIGHT
  }
  viewer!.scene.requestRender()
}

let watchTimer: ReturnType<typeof setTimeout> | null = null
watch([R1, R2, betaDeg, profileKey], () => {
  if (watchTimer) clearTimeout(watchTimer)
  watchTimer = setTimeout(() => regenerateArch(), 30)
})

function flyTo(view: 'front' | 'side' | 'top' | 'reset') {
  if (!viewer || !tunnelModel) return
  const cam = viewer.camera
  const focus = getArchFocus(tunnelModel)
  const dist = 25

  orbit?.resetFocus()

  let offset: Cesium.Cartesian3
  switch (view) {
    case 'front':
      offset = new Cesium.Cartesian3(0, 0, dist)
      break
    case 'side':
      offset = new Cesium.Cartesian3(dist, 0, 0)
      break
    case 'top':
      offset = new Cesium.Cartesian3(0, 0, dist)
      break
    case 'reset':
    default:
      offset = new Cesium.Cartesian3(dist * 0.5, -dist * 0.4, dist * 0.6)
      break
  }

  const target = Cesium.Cartesian3.add(focus, offset, new Cesium.Cartesian3())
  cam.flyTo({ destination: target, orientation: {
    heading: Cesium.Math.toRadians(90),
    pitch: Cesium.Math.toRadians(-20),
    roll: 0,
  }, duration: 0.8 })
}

function onToggleTunnel() {
  if (!tunnelModel) return
  tunnelModel.show = showTunnel.value
  viewer!.scene.requestRender()
}

function onTunnelOpacity() {
  if (!tunnelModel) return
  setTunnelOpacity(tunnelModel, tunnelOpacity.value)
  viewer!.scene.requestRender()
}

onMounted(async () => {
  try {
    console.log('[钢架] 开始创建 Cesium Viewer...')
    viewer = createSupportViewer(host.value!)
    console.log('[钢架] Viewer 创建成功')

    loadMsg.value = '加载隧道模型'
    loadPct.value = 15

    tunnelModel = await loadTunnelModel(viewer)
    console.log('[钢架] 隧道加载完成, boundingSphere:', JSON.stringify(tunnelModel.boundingSphere))
    setTunnelOpacity(tunnelModel, tunnelOpacity.value)
    loadPct.value = 55

    orbit = installOrbitControls(viewer, () => {
      if (!tunnelModel) return undefined
      return getArchFocus(tunnelModel)
    })

    clickHandler = setupClickHandler(viewer,
      () => archModel,
      () => workfaceModel,
      toggleWorkface
    )
    console.log('[钢架] 轨道控制器安装完成')

    loadMsg.value = '生成钢架'
    loadPct.value = 70
    await regenerateArch()
    console.log('[钢架] 钢架已加载')

    loadPct.value = 100
    loading.value = false

    const focus = getArchFocus(tunnelModel)
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.add(focus, new Cesium.Cartesian3(12, -8, 16), new Cesium.Cartesian3()),
      orientation: { heading: Cesium.Math.toRadians(90), pitch: Cesium.Math.toRadians(-25), roll: 0 },
      duration: 0,
    })

    setTimeout(() => enableOnDemandRender(viewer!), 1500)
  } catch (err) {
    console.error('[钢架模块] 初始化失败:', err)
    if (err instanceof Error) {
      console.error('[钢架模块] 错误消息:', err.message)
      console.error('[钢架模块] 错误堆栈:', err.stack)
    }
    loadMsg.value = '加载失败，请刷新重试'
  }
})

onBeforeUnmount(() => {
  if (watchTimer) clearTimeout(watchTimer)
  if (archBlobUrl) URL.revokeObjectURL(archBlobUrl)
  if (workfaceBlobUrl) URL.revokeObjectURL(workfaceBlobUrl)
  if (clickHandler) clickHandler.destroy()
  try { viewer?.destroy() } catch {}
})
</script>

<style scoped>
.se-root { position: fixed; inset: 0; background: #0a0e15; color: #d7e3f5; font-family: system-ui, "Microsoft YaHei", sans-serif; overflow: hidden; }
.se-viewer { position: absolute; inset: 0; }
.se-viewer :deep(.cesium-viewer-bottom) { display: none; }

.se-header { position: absolute; top: 0; left: 0; right: 0; height: 50px; display: flex; align-items: center; justify-content: space-between;
  padding: 0 18px; background: linear-gradient(180deg, rgba(8,14,24,.95) 60%, rgba(8,14,24,0)); pointer-events: none; z-index: 10; }
.se-title { font-size: 18px; font-weight: 700; letter-spacing: 1px; color: #7dd3fc; text-shadow: 0 0 10px rgba(56,189,248,.35); }
.se-back-btn { pointer-events: auto; background: rgba(13,20,33,.85); border: 1px solid rgba(56,189,248,.28); color: #cfe4fb;
  padding: 6px 14px; border-radius: 7px; cursor: pointer; font-size: 13px; font-family: inherit; transition: .15s; }
.se-back-btn:hover { background: rgba(56,189,248,.18); border-color: #38bdf8; color: #fff; }

.se-loading { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); text-align: center; z-index: 20; }
.se-loading-text { font-size: 15px; color: #7dd3fc; margin-bottom: 14px; }
.se-loading-bar { width: 260px; height: 3px; background: rgba(56,189,248,.12); border-radius: 2px; overflow: hidden; margin: 0 auto; }
.se-loading-fill { height: 100%; background: linear-gradient(90deg, #00eaff, #38bdf8); border-radius: 2px; transition: width .4s ease; }

.se-panel { position: absolute; top: 68px; right: 16px; z-index: 10; width: 240px;
  background: rgba(13,20,33,.85); border: 1px solid rgba(56,189,248,.2);
  border-radius: 10px; padding: 16px; backdrop-filter: blur(8px); }
.se-panel-title { font-size: 14px; font-weight: 600; color: #7dd3fc; margin-bottom: 14px; padding-bottom: 8px;
  border-bottom: 1px solid rgba(56,189,248,.16); }

.se-param { margin-bottom: 12px; }
.se-param-label { display: flex; justify-content: space-between; align-items: baseline; font-size: 12px; color: #93a4bd; margin-bottom: 5px; }
.se-param-val { font-size: 13px; color: #eaf2ff; font-weight: 600; font-variant-numeric: tabular-nums; }
.se-param-row { display: flex; gap: 8px; align-items: center; }

.se-slider { flex: 1; -webkit-appearance: none; appearance: none; height: 5px; border-radius: 3px;
  background: rgba(56,189,248,.18); outline: none; cursor: pointer; }
.se-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%;
  background: #38bdf8; border: 2px solid #0a0e15; cursor: pointer; box-shadow: 0 0 6px rgba(56,189,248,.5); }
.se-num { width: 68px; background: rgba(8,14,24,.6); border: 1px solid rgba(56,189,248,.22); border-radius: 5px;
  color: #eaf2ff; font-size: 12px; padding: 3px 6px; text-align: right; font-family: inherit; font-variant-numeric: tabular-nums; }
.se-num:focus { outline: none; border-color: #38bdf8; }

.se-select { width: 100%; background: rgba(8,14,24,.6); border: 1px solid rgba(56,189,248,.22); border-radius: 5px;
  color: #eaf2ff; font-size: 13px; padding: 5px 8px; font-family: inherit; cursor: pointer; margin-top: 4px; }
.se-select:focus { outline: none; border-color: #38bdf8; }
.se-select option { background: #0d1421; color: #eaf2ff; }

.se-summary { margin-top: 14px; padding: 8px 10px; background: rgba(56,189,248,.06); border-radius: 6px;
  font-size: 11px; color: #8aa0bd; line-height: 1.6; }

.se-footer { position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%); z-index: 10;
  display: flex; align-items: center; gap: 8px; padding: 8px 16px;
  background: rgba(13,20,33,.85); border: 1px solid rgba(56,189,248,.18); border-radius: 10px;
  backdrop-filter: blur(8px); }
.se-fbtn { background: rgba(8,14,24,.7); border: 1px solid rgba(56,189,248,.25); color: #cfe4fb;
  padding: 6px 14px; border-radius: 6px; font-size: 12px; cursor: pointer; font-family: inherit; transition: .15s; }
.se-fbtn:hover { background: rgba(56,189,248,.18); border-color: #38bdf8; color: #fff; }

.se-divider { width: 1px; height: 20px; background: rgba(56,189,248,.15); margin: 0 6px; }

.se-check { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #93a4bd; cursor: pointer; }
.se-check input { display: none; }
.se-check i { width: 13px; height: 13px; border: 1px solid #3b5573; border-radius: 3px; display: inline-block; position: relative; flex-shrink: 0; }
.se-check input:checked + i { background: #38bdf8; border-color: #38bdf8; }
.se-check input:checked + i::after { content: ''; position: absolute; left: 3px; top: 0; width: 4px; height: 8px;
  border: solid #06121f; border-width: 0 2px 2px 0; transform: rotate(45deg); }

.se-opacity-label { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #93a4bd; }
.se-opacity-slider { width: 80px; -webkit-appearance: none; appearance: none; height: 4px; border-radius: 2px;
  background: rgba(56,189,248,.18); outline: none; cursor: pointer; }
.se-opacity-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%;
  background: #38bdf8; border: 2px solid #0a0e15; cursor: pointer; }
</style>
