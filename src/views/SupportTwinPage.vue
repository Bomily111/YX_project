<template>
  <div class="support-workspace">
    <header class="support-header">
      <div class="support-title-container"><span class="support-brand">钻爆法隧洞群施工数字孪生系统</span></div>
      <div class="support-header-center"><strong>围岩支护</strong></div>
      <div class="support-header-right">
        <span class="support-header-sub">参数化建模 · 1064 m 支护区段</span>
        <router-link to="/admin" class="support-header-icon" title="管理后台" aria-label="管理后台">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5.5 20c.5-4 2.7-6 6.5-6s6 2 6.5 6"/></svg>
        </router-link>
        <button class="support-menu-toggle" type="button" :aria-expanded="menuOpen" aria-label="切换目录" @click="menuOpen = !menuOpen">☰</button>
      </div>
    </header>

    <div class="support-layout">
      <aside class="support-directory" :class="{ open: menuOpen }" aria-label="围岩支护目录">
        <router-link to="/" class="support-directory-row"><span>⌂</span><b>首页</b></router-link>
        <button type="button" class="support-directory-row" @click="openWorksiteOverview"><span>◎</span>工点概览</button>
        <button type="button" class="support-module-link" @click="openPlatformModule('workface')"><span>⬡</span><b>隧洞围岩</b><em>›</em></button>
        <button type="button" class="support-module-link" @click="openPlatformModule('blast')"><span>✹</span><b>开挖爆破</b><em>›</em></button>
        <div class="support-directory-head"><span>◈</span><b>围岩支护</b><em>⌄</em></div>
        <nav aria-label="支护建模页面">
          <button v-for="item in pages" :key="item.key" type="button" :class="{ active: page === item.key }"
            :aria-current="page === item.key ? 'page' : undefined" @click="selectPage(item.key)"><i></i>{{ item.label }}</button>
        </nav>
        <button type="button" class="support-module-link" @click="openPlatformModule('vent')"><span>≋</span><b>通风除尘</b><em>›</em></button>
        <button type="button" class="support-module-link" @click="openPlatformModule('dispatch')"><span>◎</span><b>装备调度</b><em>›</em></button>
      </aside>

      <main class="support-content">
        <div v-show="page !== 'intro'" ref="cesiumHost" class="support-cesium"></div>
        <div v-if="page !== 'intro'" class="support-scene-label">{{ sceneStatus }}<small>{{ tunnelStatus }}</small></div>
        <iframe ref="modelFrame" class="support-frame" :class="{ 'support-frame-panel': page !== 'intro' }" :src="frameSrc" :title="frameTitle" @load="onFrameLoad" />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SupportCesiumScene, type SupportSceneKind } from './support-cesium/SupportCesiumScene'

type SupportPage = 'intro' | 'editor' | 'alignment'
type PlatformModule = 'workface' | 'blast' | 'vent' | 'dispatch'

const router = useRouter()
const route = useRoute()
const base = import.meta.env.BASE_URL
const pages: { key: SupportPage; label: string; title: string; path: string }[] = [
  { key: 'intro', label: '模块概览', title: '隧道支护模块概览', path: 'support-modeler/index.html' },
  { key: 'editor', label: '单断面编辑', title: '隧道支护参数化编辑器', path: 'support-modeler/demo/support_master_demo_v1_2.html' },
  { key: 'alignment', label: '1064 m 支护区段', title: '1064 米真实线路支护区段', path: 'support-modeler/demo/real_tunnel_1064m_demo.html' },
]
const page = ref<SupportPage>('editor')
const menuOpen = ref(false)
const modelFrame = ref<HTMLIFrameElement>()
const cesiumHost = ref<HTMLElement>()
const sceneStatus = ref('Cesium 场景加载中…')
const tunnelStatus = ref('隧道模型加载中…')
let scene: SupportCesiumScene | undefined
let framePoll: number | undefined
let snapshotTimer: number | undefined
let snapshotSequence = 0
const editorQuery = computed(() => {
  const params = new URLSearchParams()
  for (const key of ['support_type', 'support', 'variant', 'component', 'beta', 'helpers', 'panel', 'view']) {
    const value = route.query[key]
    if (typeof value === 'string') params.set(key, value)
  }
  const query = params.toString()
  return query ? `?${query}` : ''
})
const pageUrl = (key: SupportPage) => {
  const target = pages.find(item => item.key === key)!
  const params = new URLSearchParams(key === 'editor' ? editorQuery.value : '')
  if (key !== 'intro') params.set('cesium_panel', '1')
  return `${base}${target.path}${params.size ? `?${params}` : ''}`
}
const frameSrc = ref(pageUrl('editor'))
const frameTitle = computed(() => pages.find(item => item.key === page.value)!.title)
watch(editorQuery, () => { if (page.value === 'editor') frameSrc.value = pageUrl('editor') })

function currentFrameUrl(): string | undefined {
  try { return modelFrame.value?.contentWindow?.location.href }
  catch { return undefined }
}

function selectPage(key: SupportPage) {
  const changed = page.value !== key
  page.value = key
  menuOpen.value = false
  if (changed && key !== 'intro') void loadInitialModel(key)
  const destination = pageUrl(key)
  const current = currentFrameUrl()
  if (current === new URL(destination, location.href).href) return
  if (frameSrc.value === destination) modelFrame.value?.contentWindow?.location.assign(destination)
  else frameSrc.value = destination
}

function onFrameLoad() {
  try {
    const frameWindow = modelFrame.value?.contentWindow
    const pathname = frameWindow?.location.pathname ?? ''
    const current = pages.find(item => pathname.endsWith(item.path))
    if (!current || !frameWindow) return
    if (current.key !== 'intro' && !new URLSearchParams(frameWindow.location.search).has('cesium_panel')) {
      const next = new URL(frameWindow.location.href)
      next.searchParams.set('cesium_panel', '1')
      frameSrc.value = next.href
      return
    }
    if (current.key !== page.value) {
      page.value = current.key
      if (current.key !== 'intro') void loadInitialModel(current.key)
    }
    attachFrameBridge(frameWindow, current.key)
  } catch { /* External links are handled inside the delivered page. */ }
}

function clearFrameBridge() {
  if (framePoll) window.clearInterval(framePoll)
  if (snapshotTimer) window.clearTimeout(snapshotTimer)
  framePoll = undefined
  snapshotTimer = undefined
  snapshotSequence++
}

function bridgeFor(win: Window, key: SupportPage): any {
  return key === 'editor' ? (win as any).masterDemoV12 : (win as any).realTunnelDemo
}

function attachFrameBridge(win: Window, key: SupportPage) {
  clearFrameBridge()
  if (key === 'intro') return
  const doc = win.document
  const schedule = (event: Event) => {
    const target = event.target as HTMLElement
    const button = target.closest?.('button') as HTMLButtonElement | null
    const view = button?.dataset.view
    if (view || button?.id === 'resetCamera' || button?.id === 'fitModel' || button?.id === 'focusSelected') {
      const mode = view ?? (button?.id === 'focusSelected' ? 'selected' : 'overall')
      const index = bridgeFor(win, key)?.getSummary?.().selectedSegmentIndex
      const station = segmentStation(index)
      scene?.focus(key as SupportSceneKind, mode, station)
      if (key === 'alignment') return
    }
    if (target.id === 'segmentSelect') {
      window.setTimeout(() => scene?.focus('alignment', 'selected', segmentStation(Number((target as HTMLSelectElement).value))), 60)
      return
    }
    if (key === 'alignment' && (target.matches?.('[data-component],[data-type],#showAll,#showCenterline,#showRanges') || target.closest?.('#typeToggles'))) {
      window.setTimeout(() => syncAlignmentVisibility(win), 0)
      if (!target.matches?.('#showCenterline,#showRanges')) {
        if (snapshotTimer) window.clearTimeout(snapshotTimer)
        snapshotTimer = window.setTimeout(() => void refreshModel(win, key), 450)
      }
      return
    }
    if (key === 'editor') {
      window.setTimeout(() => syncEditorHelpers(win), 80)
      if (target.matches?.('[id^="helper"]') || target.closest?.('.tree-row')) return
    }
    if (['exportGlb', 'exportGLB', 'exportTunnelGlb', 'saveVariant', 'saveSegmentVariant'].includes(button?.id ?? '')) return
    if (key === 'alignment' && ['availableSegmentVariant', 'editableComponent', 'segmentVariantName'].includes(target.id)) return
    if (snapshotTimer) window.clearTimeout(snapshotTimer)
    snapshotTimer = window.setTimeout(() => void refreshModel(win, key), key === 'editor' ? 450 : 1200)
  }
  doc.addEventListener('input', schedule)
  doc.addEventListener('change', schedule)
  doc.addEventListener('click', schedule)
  framePoll = window.setInterval(() => {
    const bridge = bridgeFor(win, key)
    if (!bridge || (key === 'editor' ? !bridge.ready?.() : !bridge.ready)) return
    if (framePoll) window.clearInterval(framePoll)
    framePoll = undefined
    void refreshModel(win, key)
    if (key === 'editor') syncEditorHelpers(win)
    else syncAlignmentVisibility(win)
  }, 500)
}

function syncAlignmentVisibility(win: Window) {
  const summary = bridgeFor(win, 'alignment')?.getSummary?.()
  if (summary) {
    scene?.setAlignmentVisibility(summary.componentVisibility, summary.visibleTypes)
    scene?.setAlignmentLines(summary.centerlineVisible, summary.rangeLinesVisible, summary.visibleTypes)
  }
}

function syncEditorHelpers(win: Window) {
  const helpers = bridgeFor(win, 'editor')?.getHelpers?.()
  if (helpers) scene?.setEditorHelpers(helpers)
}

async function refreshModel(win: Window, key: SupportPage) {
  if (!scene || page.value !== key || key === 'intro') return
  const bridge = bridgeFor(win, key)
  if (!bridge?.exportGlbBuffer) return
  const sequence = ++snapshotSequence
  try {
    sceneStatus.value = '正在同步 Cesium 模型…'
    if (key === 'editor') {
      for (let attempt = 0; attempt < 20 && !bridge.ready?.(); attempt++) {
        await new Promise(resolve => window.setTimeout(resolve, 350))
        if (sequence !== snapshotSequence || page.value !== key) return
      }
    }
    const buffer = await bridge.exportGlbBuffer() as ArrayBuffer
    if (sequence !== snapshotSequence || page.value !== key) return
    await scene.loadBuffer(buffer, key)
    if (sequence === snapshotSequence) sceneStatus.value = key === 'editor' ? 'YK2+170 · 工点A附近 · Cesium 地形 · 实时参数模型' : 'YK1+116—YK2+180 · Cesium 地形 · 1064 m 支护'
  } catch (error) {
    if (sequence === snapshotSequence) sceneStatus.value = `模型同步失败：${String(error)}`
  }
}

const segmentStations = new Map<number, number>()
let defaultAlignmentStation = 1116
function segmentStation(index: number | undefined): number {
  return segmentStations.get(index ?? -1) ?? defaultAlignmentStation
}

async function loadInitialModel(key: Exclude<SupportPage, 'intro'>) {
  if (!scene) return
  tunnelStatus.value = '隧道模型加载中（仅支护范围）'
  void scene.setTunnelForPage(key)
    .catch(error => { if (page.value === key) tunnelStatus.value = `隧道模型加载失败：${String(error)}` })
  const url = key === 'editor'
    ? `${base}support-modeler/outputs/master_demo/ZZ-Va_support_1m_current.glb`
    : `${base}support-modeler/outputs/centerline/real_YK1+098_YK2+162_support.glb`
  sceneStatus.value = 'Cesium 场景加载中…'
  try {
    await scene.loadUrl(url, key)
    if (page.value !== key) return
    scene.focus(key)
    if (key === 'alignment') scene.setEditorHelpers([])
    if (key === 'alignment' && modelFrame.value?.contentWindow) syncAlignmentVisibility(modelFrame.value.contentWindow)
    sceneStatus.value = key === 'editor' ? 'YK2+170 · 工点A附近 · Cesium 地形 · 参数化编辑' : 'YK1+116—YK2+180 · Cesium 地形 · 1064 m 支护'
  } catch (error) { sceneStatus.value = `Cesium 模型加载失败：${String(error)}` }
}

onMounted(async () => {
  await nextTick()
  if (!cesiumHost.value) return
  try {
    scene = new SupportCesiumScene(cesiumHost.value)
    scene.onTunnelProgress = (ready, total) => {
      tunnelStatus.value = ready === total ? `隧道模型已加载（${ready}/${total}段）` : `隧道模型加载中（${ready}/${total}段）`
    }
    scene.onModelPick = (origin, direction, kind) => {
      if (page.value !== kind || !modelFrame.value?.contentWindow) return
      const bridge = bridgeFor(modelFrame.value.contentWindow, kind)
      if (kind === 'editor') {
        bridge?.pickComponentRay?.(origin, direction)
        syncEditorHelpers(modelFrame.value.contentWindow)
      }
      else {
        const index = bridge?.pickSegmentRay?.(origin, direction)
        if (index) scene?.focus('alignment', 'selected', segmentStation(index))
      }
    }
    scene.onSegmentPick = index => {
      const bridge = modelFrame.value?.contentWindow && bridgeFor(modelFrame.value.contentWindow, 'alignment')
      bridge?.selectSegment?.(index)
      scene?.focus('alignment', 'selected', segmentStation(index))
    }
    void loadInitialModel('editor')
    const [response, visibilityResponse, lineResponse] = await Promise.all([
      fetch(`${base}support-modeler/outputs/centerline/real_YK1+098_YK2+162_support.metadata.json`),
      fetch(`${base}support-modeler/outputs/centerline/visibility_nodes.json`),
      fetch(`${base}support-modeler/outputs/centerline/real_centerline_0_1064m.json`),
    ])
    const data = await response.json()
    scene.setVisibilityNodes(await visibilityResponse.json())
    for (const segment of data.metadata?.support_segments ?? []) {
      segmentStations.set(segment.segment_index, 1116 + ((segment.centerline_start_distance_m ?? 0) + (segment.centerline_end_distance_m ?? 0)) / 2)
    }
    const defaultSegment = (data.metadata?.support_segments ?? []).find((segment: any) => segment.support_type === 'ZZ-IVa' && segment.model_status !== 'MODEL_INCOMPLETE')
    if (defaultSegment) defaultAlignmentStation = segmentStations.get(defaultSegment.segment_index) ?? 1116
    const line = await lineResponse.json()
    scene.setAlignmentSourceTangent(line.points[1])
    scene.setAlignmentRanges(data.metadata?.support_segments ?? [])
    if (page.value === 'alignment') void loadInitialModel('alignment')
  } catch (error) { sceneStatus.value = `Cesium 初始化失败：${String(error)}` }
})
onBeforeUnmount(() => { clearFrameBridge(); scene?.destroy() })

function openWorksiteOverview() {
  router.push({ path: '/', query: { view: 'line-overview' } })
}

function openPlatformModule(key: PlatformModule) {
  menuOpen.value = false
  if (key === 'blast') return router.push('/blast-twin')
  if (key === 'vent') return router.push('/ventilation-twin')
  return router.push({ path: '/', query: { scene: key } })
}
</script>

<style scoped>
.support-workspace { position: fixed; inset: 0; z-index: 100; display: flex; flex-direction: column; overflow: hidden; color: #dceaf4; background: #061321; font-family: system-ui, 'Microsoft YaHei', sans-serif; }
.support-header { position: relative; z-index: 20; display: flex; align-items: center; flex: 0 0 60px; min-width: 0; background: linear-gradient(to bottom, rgba(0,20,40,.98), rgba(0,20,40,.78)); border-bottom: 1px solid rgba(0,255,255,.3); box-shadow: 0 0 15px rgba(0,255,255,.2); }
.support-title-container { position: relative; display: flex; align-items: center; height: 100%; flex: none; padding: 0 40px 0 30px; background: linear-gradient(to right, #000f1e, #00325a); }
.support-title-container::after { content: ''; position: absolute; right: -20px; top: 0; width: 40px; height: 100%; z-index: 1; transform: skewX(-25deg); background: #00325a; border-right: 2px solid #00eaff; box-shadow: 2px 0 8px rgba(0,234,255,.4); }
.support-brand { position: relative; z-index: 2; font-size: 26px; font-weight: 700; letter-spacing: 2px; white-space: nowrap; background: linear-gradient(180deg,#fff,#87cefa); background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(0 0 6px rgba(0,255,255,.55)); }
.support-header-center { flex: 1; padding-left: 42px; min-width: 0; }
.support-header-center strong { color: #00eaff; font-size: 15px; letter-spacing: 1px; text-shadow: 0 0 8px #00eaff; white-space: nowrap; }
.support-header-right { display: flex; align-items: center; gap: 14px; height: 100%; padding: 0 24px; }
.support-header-sub { color: #6d9ab4; font-size: 11px; white-space: nowrap; }
.support-header-icon { display: grid; place-items: center; width: 34px; height: 34px; color: #c8e5f4; text-decoration: none; background: rgba(0,70,120,.18); border: 1px solid rgba(0,170,255,.22); border-radius: 50%; }
.support-header-icon:hover { color: #00eaff; border-color: rgba(0,220,255,.42); }
.support-header-icon svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.support-menu-toggle { display: none; color: #c8e5f4; background: rgba(0,70,120,.3); border: 1px solid rgba(0,170,255,.4); border-radius: 5px; padding: 5px 9px; cursor: pointer; }
.support-layout { display: grid; grid-template-columns: 216px minmax(0,1fr); flex: 1; min-height: 0; }
.support-directory { min-height: 0; overflow-y: auto; background: rgba(2,10,22,.94); border-right: 1px solid rgba(0,170,255,.24); box-shadow: 4px 0 24px rgba(0,0,0,.5); }
.support-directory-row { display: flex; align-items: center; gap: 11px; width: 100%; min-height: 44px; box-sizing: border-box; padding: 0 18px; color: #7892aa; font-size: 14px; font-family: inherit; text-align: left; text-decoration: none; border: 0; border-bottom: 1px solid rgba(0,150,220,.07); background: transparent; cursor: pointer; }
.support-directory-row span { width: 18px; color: #4e85aa; text-align: center; }
.support-directory-row b { color: #b9cee0; font-weight: 600; }
.support-directory-row:hover, .support-module-link:hover { color: #dffaff; background: rgba(0,170,235,.07); }
.support-directory-head { display: flex; align-items: center; gap: 9px; min-height: 47px; padding: 0 15px; color: #fff; background: linear-gradient(90deg,rgba(0,116,218,.92),rgba(0,174,235,.72)); border-block: 1px solid rgba(64,207,255,.35); box-shadow: inset 3px 0 0 #7de9ff; }
.support-directory-head b { font-size: 16px; letter-spacing: 1px; }
.support-directory-head em { margin-left: auto; font-style: normal; }
.support-directory nav { padding: 5px 0 7px; background: rgba(0,35,67,.25); }
.support-directory nav button { display: grid; grid-template-columns: 18px 1fr; align-items: center; width: 100%; min-height: 40px; padding: 0 14px 0 25px; color: #829bb4; font-size: 14px; font-family: inherit; text-align: left; border: 0; background: transparent; cursor: pointer; }
.support-directory nav button i { width: 10px; height: 1px; background: rgba(80,155,200,.4); }
.support-directory nav button:hover { color: #c9edfa; background: rgba(0,170,235,.06); }
.support-directory nav button.active { color: #e6fbff; background: linear-gradient(90deg,rgba(0,135,230,.28),rgba(0,105,175,.1)); box-shadow: inset 3px 0 0 #37dfff; }
.support-module-link { display: grid; grid-template-columns: 22px 1fr auto; align-items: center; gap: 8px; width: 100%; min-height: 43px; padding: 0 16px; color: #7892aa; font-size: 14px; font-family: inherit; text-align: left; border: 0; border-bottom: 1px solid rgba(0,150,220,.07); background: transparent; cursor: pointer; }
.support-module-link span { color: #4e85aa; text-align: center; font-size: 15px; }
.support-module-link b { font-weight: 500; }
.support-module-link em { color: #456b87; font-size: 18px; font-style: normal; }
.support-content { position: relative; display: flex; min-width: 0; min-height: 0; background: #091119; }
.support-cesium { flex: 1; min-width: 0; min-height: 0; }
.support-cesium :deep(.cesium-viewer) { width: 100%; height: 100%; }
.support-scene-label { position: absolute; z-index: 2; top: 14px; left: 16px; max-width: calc(100% - 390px); padding: 7px 11px; color: #d9f5ff; font-size: 12px; background: rgba(2,20,35,.76); border: 1px solid rgba(65,207,255,.42); border-radius: 4px; pointer-events: none; }
.support-scene-label small { display: block; margin-top: 3px; color: #9cc5d8; font-size: 11px; }
.support-frame { display: block; width: 100%; height: 100%; border: 0; }
.support-frame-panel { flex: 0 0 352px; width: 352px; min-width: 0; border-left: 1px solid rgba(0,170,255,.32); }
@media (max-width: 1100px) { .support-brand { font-size: 19px; letter-spacing: 1px; } .support-header-sub { display: none; } }
@media (max-width: 760px) { .support-title-container { padding: 0 24px 0 12px; } .support-brand { max-width: 48vw; overflow: hidden; text-overflow: ellipsis; font-size: 14px; } .support-header-center { padding-left: 28px; } .support-header-right { padding: 0 10px; gap: 8px; } .support-menu-toggle { display: block; } .support-layout { grid-template-columns: minmax(0,1fr); } .support-directory { position: absolute; top: 60px; bottom: 0; left: 0; z-index: 19; width: 216px; transform: translateX(-105%); transition: transform .2s ease; } .support-directory.open { transform: translateX(0); } .support-frame-panel { flex-basis: min(340px, 55vw); width: min(340px, 55vw); } .support-scene-label { max-width: calc(45vw - 32px); } }
</style>
