<template>
  <div class="tm-root">
    <div ref="host" class="tm-viewer"></div>

    <!-- 顶栏 -->
    <header class="tm-header">
      <div class="tm-header-left"><div class="tm-title-container"><span class="tm-brand">钻爆法隧洞群施工数字孪生系统</span></div></div>
      <div class="tm-header-center"><span class="tm-title">开挖爆破</span></div>
      <div class="tm-header-right">
        <span class="tm-sub">正洞 Ⅳ级全断面 · 桩号断面对齐</span>
        <button type="button" class="tm-header-icon disabled" disabled title="当前版块暂不支持里程搜索" aria-label="里程搜索不可用"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg></button>
        <router-link to="/admin" class="tm-header-icon" title="管理后台" aria-label="管理后台"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"></circle><path d="M5.5 20c.5-4 2.7-6 6.5-6s6 2 6.5 6"></path></svg></router-link>
      </div>
    </header>

    <!-- 左：全平台共用目录 -->
    <section class="tm-panel tm-left">
      <button type="button" class="tm-home" @click="router.push('/')"><span>⌂</span><strong>首页</strong></button>
      <button type="button" class="tm-context" @click="openWorksiteOverview"><span>◎</span>工点概览</button>
      <button type="button" class="tm-module-link" @click="openPlatformModule('workface')"><span>⬡</span><strong>隧洞围岩</strong><em>›</em></button>
      <div class="tm-directory-head"><span>✹</span><strong>开挖爆破</strong><em>⌄</em></div>
      <div class="tm-directory-node active"><span class="tm-branch"></span>爆破设计</div>
      <div class="tm-directory-node"><span class="tm-branch"></span>装药连线</div>
      <div class="tm-directory-node"><span class="tm-branch"></span>爆破效果</div>
      <button type="button" class="tm-module-link" @click="openPlatformModule('support')"><span>◈</span><strong>围岩支护</strong><em>›</em></button>
      <button type="button" class="tm-module-link" @click="openPlatformModule('vent')"><span>≋</span><strong>通风除尘</strong><em>›</em></button>
      <button type="button" class="tm-module-link" @click="openPlatformModule('dispatch')"><span>◎</span><strong>装备调度</strong><em>›</em></button>
    </section>

    <!-- 与主页面一致的可拖动、可收起图层控制浮窗 -->
    <section class="tm-layer-float" :class="{ collapsed: layerPanelCollapsed }" :style="{ left: `${layerPanelPosition.left}px`, top: `${layerPanelPosition.top}px` }">
      <header class="tm-layer-header" @mousedown="startLayerPanelDrag">
        <button type="button" @mousedown.stop @click.stop="layerPanelCollapsed = !layerPanelCollapsed">{{ layerPanelCollapsed ? '▸' : '▾' }}</button>
        <strong>图层控制</strong><span>✥</span>
      </header>
      <div v-show="!layerPanelCollapsed" class="tm-layer-content">
        <label class="tm-check"><input type="checkbox" v-model="showTunnel" @change="onToggleTunnel"><i></i>隧道模型</label>
        <label class="tm-check"><input type="checkbox" v-model="showBlast" @change="onToggleBlast"><i></i>爆破效果</label>
        <label class="tm-check"><input type="checkbox" v-model="showDesign2D"><i></i>二维设计图</label>
        <div class="tm-hint" v-if="loading">加载中… {{ loadMsg }}</div>
      </div>
    </section>

    <!-- 右：断面信息 -->
    <section class="tm-panel tm-right">
      <div class="tm-panel-h">爆破断面信息</div>
      <div class="tm-kv"><span>断面</span><b>{{ info.section }}</b></div>
      <div class="tm-grid">
        <div><label>围岩等级</label><b class="warn">Ⅳ级</b></div>
        <div><label>开挖宽</label><b>{{ info.excavationWidthM }} m</b></div>
        <div><label>循环进尺</label><b>{{ info.advanceM }} m</b></div>
        <div><label>拱顶高</label><b>{{ info.crownHeightM }} m</b></div>
      </div>
      <div class="tm-holes">
        <div class="tm-holes-h">炮孔 {{ info.holes.total }} 个</div>
        <span class="hc" style="--c:#1560e6">周边 {{ info.holes.perimeter }}</span>
        <span class="hc" style="--c:#e11d2e">掏槽 {{ info.holes.cut }}</span>
        <span class="hc" style="--c:#f4600a">辅助 {{ info.holes.auxiliary }}</span>
        <span class="hc" style="--c:#9b1fe6">底板 {{ info.holes.floor }}</span>
      </div>
      <div class="tm-kv"><span>爆后点云</span><b>{{ (info.pointCount/10000).toFixed(0) }} 万点 (3.las)</b></div>
    </section>

    <div class="tm-view-actions" aria-label="三维视角控制">
      <button @click="fly('persp')">透视</button>
      <button @click="fly('front')">正视</button>
      <button @click="fly('side')">侧视</button>
      <button @click="fly('top')">俯视</button>
    </div>

    <!-- 图层控制里勾选"二维设计图"时, 在面板下方显示可关闭小窗 -->
    <Design2DPanel :visible="showDesign2D" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import * as Cesium from 'cesium'
import { createViewer, enableOnDemandRender, installOrbitControls } from './scene'
import { loadTunnel, setTunnelVisible, setTunnelTranslucent } from './tunnel'
import { loadBlast, setBlastVisible, flyToBlast, flyToTunnelOverview, getBlastModel, BLAST_INFO } from './blast'
import Design2DPanel from './Design2DPanel.vue'
import { aiEvents } from '@/ai-agent'

const host = ref<HTMLElement>()
const router = useRouter()
const info = BLAST_INFO
const showTunnel = ref(true)
const showBlast = ref(true)
const loading = ref(true)
const loadMsg = ref('')
const showDesign2D = ref(false)  // 二维设计图小窗(图层控制里的勾选项)
const layerPanelCollapsed = ref(false)
const layerPanelPosition = ref({ left: 236, top: 78 })
let stopLayerPanelDrag: (() => void) | null = null
let viewer: Cesium.Viewer
let orbit: { handler: any; resetFocus: () => void }

onMounted(async () => {
  viewer = createViewer(host.value!)
  loadMsg.value = '隧道段'
  await loadTunnel(viewer)                    // 只加载爆破所在段(1段, 68MB)
  setTunnelTranslucent(viewer, false)          // 默认: 保留隧道原始纹理(不透视)
  loadMsg.value = '爆破效果'
  const model = await loadBlast(viewer)
  // 标准轨道控制(左键环绕/右键平移/滚轮缩放, 绕断面中心), 修复 Ctrl+左键甩飞黑屏
  orbit = installOrbitControls(viewer, () => getBlastModel()?.boundingSphere?.center)
  const initView = new URLSearchParams(location.search).get('view')
  model.readyEvent.addEventListener(() => {
    // 默认进入"带纹理整体隧道"总览; 带 ?view= 时直接进对应透视视角(便于调试)
    if (initView && ['persp', 'front', 'side', 'top'].includes(initView)) fly(initView as any)
    else exit()
    loading.value = false
    setTimeout(() => enableOnDemandRender(viewer), 2500)
  })

  // 监听 AI Agent 指令
  aiEvents.on('blast:adjust-view', onAdjustView)
  aiEvents.on('blast:toggle-diagram', onToggleDiagram)
})

onBeforeUnmount(() => {
  aiEvents.off('blast:adjust-view', onAdjustView)
  aiEvents.off('blast:toggle-diagram', onToggleDiagram)
  stopLayerPanelDrag?.()
  try { viewer?.destroy() } catch {}
})

function onToggleTunnel() { setTunnelVisible(viewer, showTunnel.value) }
function onToggleBlast() { setBlastVisible(viewer, showBlast.value) }
function openWorksiteOverview() {
  router.push({ path: '/', query: { view: 'line-overview' } })
}
function startLayerPanelDrag(event: MouseEvent) {
  if (event.button !== 0) return
  const startX = event.clientX
  const startY = event.clientY
  const origin = { ...layerPanelPosition.value }
  const onMove = (moveEvent: MouseEvent) => {
    layerPanelPosition.value = {
      left: Math.max(216, Math.min(window.innerWidth - 332 - 170, origin.left + moveEvent.clientX - startX)),
      top: Math.max(60, Math.min(window.innerHeight - 48, origin.top + moveEvent.clientY - startY)),
    }
  }
  const onUp = () => stopLayerPanelDrag?.()
  stopLayerPanelDrag?.()
  stopLayerPanelDrag = () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    stopLayerPanelDrag = null
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}
function openPlatformModule(key: 'workface' | 'support' | 'vent' | 'dispatch') {
  if (key === 'vent') {
    router.push('/ventilation-twin')
    return
  }
  router.push({ path: '/', query: { scene: key } })
}
// 点视角按钮: 隧道变透视(半透明) + 飞到爆破断面对应视角
function fly(v: 'persp' | 'front' | 'side' | 'top') {
  orbit?.resetFocus(); setTunnelTranslucent(viewer, true); flyToBlast(viewer, v)
}
// 退出: 恢复带纹理整体隧道 + 总览视角
function exit() {
  orbit?.resetFocus(); setTunnelTranslucent(viewer, false); flyToTunnelOverview(viewer)
}

// ── AI Agent 事件响应 ─────────────────────────────────────
function onAdjustView(view: string) {
  if (!viewer) return
  if (view === 'overview') exit()
  else fly(view as 'persp' | 'front' | 'side' | 'top')
}
function onToggleDiagram(visible: boolean) {
  showDesign2D.value = visible
}
</script>

<style scoped>
.tm-root { position: fixed; inset: 0; background: #0a0e15; color: #e6eefb; font-family: system-ui, "Microsoft YaHei", sans-serif; }
.tm-viewer { position: absolute; inset: 0; }
.tm-viewer :deep(.cesium-viewer-bottom) { display: none; }

.tm-header { position:absolute;z-index:20;top:0;left:0;right:0;height:60px;min-width:1200px;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(to bottom,rgba(0,20,40,.95),rgba(0,20,40,.6));border-bottom:1px solid rgba(0,255,255,.3);box-shadow:0 0 15px rgba(0,255,255,.2) }
.tm-header-left{display:flex;align-items:center;height:100%;flex-shrink:0}.tm-title-container{position:relative;display:flex;align-items:center;height:100%;padding:0 40px 0 30px;background:linear-gradient(to right,rgba(0,15,30,1),rgba(0,50,90,1))}.tm-title-container::after{content:'';position:absolute;right:-20px;top:0;width:40px;height:100%;background:rgba(0,50,90,1);transform:skewX(-25deg);border-right:2px solid #00eaff;box-shadow:2px 0 8px rgba(0,234,255,.4);z-index:1}.tm-brand{position:relative;z-index:2;font-size:26px;font-weight:bold;letter-spacing:2px;color:#fff;text-shadow:0 0 10px rgba(0,255,255,.8);background:linear-gradient(180deg,#fff,#87cefa);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}.tm-header-center{flex:1;display:flex;align-items:center;padding-left:40px}.tm-title{position:relative;padding:0 24px;color:#00eaff;font-size:15px;font-weight:bold;letter-spacing:1px;text-shadow:0 0 8px #00eaff}.tm-header-right{height:100%;padding:0 20px;display:flex;align-items:center;justify-content:flex-end;gap:10px}.tm-sub{font-size:11px;color:#6d9ab4}.tm-header-icon{width:34px;height:34px;padding:0;display:grid;place-items:center;color:#c8e5f4;background:rgba(0,70,120,.18);border:1px solid rgba(0,170,255,.22);border-radius:50%;cursor:pointer;text-decoration:none;transition:.18s ease}.tm-header-icon svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.tm-header-icon:hover{color:#00eaff;background:rgba(0,180,255,.14);border-color:rgba(0,220,255,.42)}.tm-header-icon.disabled{opacity:.3;cursor:not-allowed}

.tm-panel { position: absolute; z-index: 18; top: 60px; bottom: 0; box-sizing: border-box; background: rgba(2,10,22,.94); backdrop-filter: blur(16px); }
.tm-left { left: 0; width: 216px; border-right: 1px solid rgba(0,170,255,.24); box-shadow: 4px 0 24px rgba(0,0,0,.5); }
.tm-right { right: 0; width: 332px; padding: 16px; overflow-y: auto; border-left: 1px solid rgba(0,170,255,.2); box-shadow: -4px 0 24px rgba(0,0,0,.5); }
.tm-home,.tm-context { display:flex; align-items:center; gap:11px; width:100%; min-height:44px; padding:0 18px; box-sizing:border-box; color:#7892aa; font-family:inherit; font-size:12px; text-align:left; border:0; border-bottom:1px solid rgba(0,150,220,.07); background:transparent; }
.tm-home,.tm-context{cursor:pointer}.tm-home span,.tm-context span{width:18px;color:#4e85aa;text-align:center}.tm-home strong{color:#b9cee0}.tm-home:hover,.tm-context:hover{color:#c9edfa;background:rgba(0,170,235,.08)}.tm-home:hover strong{color:#69dff2}
.tm-directory-head{display:flex;align-items:center;gap:9px;min-height:47px;padding:0 15px;color:#fff;background:linear-gradient(90deg,rgba(0,116,218,.92),rgba(0,174,235,.72));border-block:1px solid rgba(64,207,255,.35);box-shadow:inset 3px 0 0 #7de9ff}.tm-directory-head strong{font-size:14px;letter-spacing:1px}.tm-directory-head em{margin-left:auto;font-style:normal}.tm-directory-node{display:flex;align-items:center;gap:8px;min-height:39px;padding:0 18px 0 29px;color:#829bb4;font-size:12px;background:rgba(0,35,67,.14)}.tm-directory-node.active{color:#e6fbff;background:linear-gradient(90deg,rgba(0,135,230,.28),rgba(0,105,175,.1));box-shadow:inset 3px 0 0 #37dfff}.tm-branch{width:10px;height:1px;background:rgba(80,155,200,.4)}.tm-layer-group{margin-top:8px;padding:14px 16px;border-top:1px solid rgba(0,170,255,.12)}
.tm-module-link{display:grid;grid-template-columns:22px 1fr auto;align-items:center;gap:8px;width:100%;min-height:43px;padding:0 16px;color:#7892aa;text-align:left;font-family:inherit;border:0;border-bottom:1px solid rgba(0,150,220,.07);background:transparent;cursor:pointer;transition:.18s ease}.tm-module-link span{color:#4e85aa;text-align:center}.tm-module-link strong{font-size:12px;font-weight:500}.tm-module-link em{color:#456b87;font-size:16px;font-style:normal}.tm-module-link:hover{color:#dffaff;background:rgba(0,170,235,.07)}.tm-module-link:hover span,.tm-module-link:hover em{color:#69dff2}
.tm-layer-float{position:absolute;z-index:25;width:220px;overflow:hidden;border:1px solid #00eaff;border-radius:4px;background:rgba(0,15,30,.88);box-shadow:0 0 20px rgba(0,200,255,.2);backdrop-filter:blur(10px);user-select:none}.tm-layer-float.collapsed{width:142px}.tm-layer-header{display:flex;align-items:center;gap:8px;min-height:36px;padding:0 12px;color:#fff;background:rgba(0,100,200,.6);font-size:14px;letter-spacing:.4px;cursor:move}.tm-layer-header button{width:18px;height:24px;padding:0;border:0;color:#d8f8ff;background:transparent;cursor:pointer}.tm-layer-header span{margin-left:auto;color:rgba(210,247,255,.72)}.tm-layer-content{padding:14px 15px 12px}
.tm-panel-h { font-size: 14px; font-weight: 600; color: #7dd3fc; margin-bottom: 10px; padding-bottom: 8px;
  border-bottom: 1px solid rgba(56,189,248,.18); }

.tm-check { display: flex; align-items: center; gap: 9px; font-size: 14px; padding: 6px 0; cursor: pointer; color: #d7e3f5; }
.tm-check input { display: none; }
.tm-check i { width: 15px; height: 15px; border: 1px solid #3b5573; border-radius: 4px; display: inline-block; position: relative; }
.tm-check input:checked + i { background: #38bdf8; border-color: #38bdf8; }
.tm-check input:checked + i::after { content: ''; position: absolute; left: 4px; top: 1px; width: 4px; height: 8px;
  border: solid #06121f; border-width: 0 2px 2px 0; transform: rotate(45deg); }
.tm-hint { margin-top: 8px; font-size: 12px; color: #8aa0bd; }

.tm-kv { display: flex; justify-content: space-between; align-items: center; font-size: 13px; padding: 5px 0; color: #a9bcd6; }
.tm-kv b { color: #eaf2ff; font-weight: 600; }
.tm-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 8px 0; }
.tm-grid > div { background: rgba(56,189,248,.06); border-radius: 6px; padding: 7px 9px; }
.tm-grid label { display: block; font-size: 11px; color: #8aa0bd; margin-bottom: 3px; }
.tm-grid b { font-size: 15px; color: #eaf2ff; }
.tm-grid b.warn { color: #fb923c; }
.tm-holes { margin: 10px 0; }
.tm-holes-h { font-size: 12px; color: #8aa0bd; margin-bottom: 6px; }
.hc { display: inline-block; font-size: 12px; margin: 0 6px 6px 0; padding: 2px 8px; border-radius: 10px;
  color: #fff; background: var(--c); font-weight: 600; }

.tm-footer { position: absolute; z-index: 19; right: 332px; bottom: 0; left: 216px; min-height: 52px; display: flex; align-items:center; justify-content:center; gap: 10px; background:rgba(2,10,22,.94); border-top:1px solid rgba(0,170,255,.24); backdrop-filter:blur(16px); }
.tm-footer button { background: rgba(13,20,33,.85); border: 1px solid rgba(56,189,248,.3); color: #cfe4fb;
  padding: 8px 18px; border-radius: 8px; font-size: 13px; cursor: pointer; transition: .15s; }
.tm-footer button:hover { background: rgba(56,189,248,.2); border-color: #38bdf8; color: #fff; }
.tm-footer .tm-exit { border-color: rgba(248,113,113,.5); color: #fca5a5; margin-left: 14px; }
.tm-footer .tm-exit:hover { background: rgba(248,113,113,.2); border-color: #f87171; color: #fff; }

/* 与主平台一致的四周工作区框架。 */
.tm-root { --rock-right-rail: 380px; }
.tm-root::before { content:''; position:absolute; z-index:17; top:60px; right:var(--rock-right-rail); bottom:0; left:216px; border:1px solid rgba(51,205,239,.34); border-radius:14px; box-shadow:0 0 24px rgba(0,0,0,.55); pointer-events:none; }
.tm-viewer { clip-path: inset(60px var(--rock-right-rail) 0 216px round 14px); }
.tm-view-actions { position:absolute;z-index:26;top:76px;right:398px;display:flex;gap:7px;padding:6px;border:1px solid rgba(53,190,224,.28);border-radius:7px;background:rgba(3,17,29,.82);box-shadow:0 6px 18px rgba(0,0,0,.32);backdrop-filter:blur(8px); }
.tm-view-actions button { padding:7px 11px;border:1px solid rgba(72,178,207,.28);border-radius:5px;color:#afd1dc;background:rgba(8,40,58,.78);font-size:12px;cursor:pointer;transition:.15s; }
.tm-view-actions button:hover { color:#fff;border-color:#42dcec;background:rgba(20,104,132,.4); }
.tm-right { width: var(--rock-right-rail); padding: 18px; }
.tm-home,.tm-context { font-size: 14px; }
.tm-directory-head strong { font-size: 16px; }
.tm-directory-node { font-size: 14px; }
.tm-module-link span { font-size: 15px; }
.tm-module-link strong { font-size: 14px; }
.tm-module-link em { font-size: 18px; }
.tm-panel-h { font-size: 18px; margin-bottom: 12px; padding-bottom: 10px; }
.tm-kv { padding-block: 7px; font-size: 14px; }
.tm-grid > div { padding: 10px 11px; }
.tm-grid label { font-size: 12px; }
.tm-grid b { font-size: 17px; }
.tm-holes-h,.hc { font-size: 13px; }

</style>
