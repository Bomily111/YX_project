<template>
  <div class="tm-root">
    <div ref="host" class="tm-viewer"></div>

    <!-- 顶栏 -->
    <header class="tm-header">
      <span class="tm-title">隧道爆破孪生 · 调试模块</span>
      <span class="tm-sub">正洞 Ⅳ级全断面 · 桩号断面对齐</span>
    </header>

    <!-- 左：图层 -->
    <section class="tm-panel tm-left">
      <div class="tm-panel-h">图层控制</div>
      <label class="tm-check"><input type="checkbox" v-model="showTunnel" @change="onToggleTunnel"><i></i>隧道模型</label>
      <label class="tm-check"><input type="checkbox" v-model="showBlast" @change="onToggleBlast"><i></i>爆破效果</label>
      <label class="tm-check"><input type="checkbox" v-model="showDesign2D"><i></i>二维设计图</label>
      <div class="tm-hint" v-if="loading">加载中… {{ loadMsg }}</div>
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

    <!-- 底部：视角(点击进入透视/半透明) + 退出(回带纹理整体隧道) -->
    <footer class="tm-footer">
      <button @click="fly('persp')">透视</button>
      <button @click="fly('front')">正视掌子面</button>
      <button @click="fly('side')">侧视</button>
      <button @click="fly('top')">俯视</button>
      <button class="tm-exit" @click="exit">退出</button>
    </footer>

    <!-- 图层控制里勾选"二维设计图"时, 在面板下方显示可关闭小窗 -->
    <Design2DPanel :visible="showDesign2D" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import * as Cesium from 'cesium'
import { createViewer, enableOnDemandRender, installOrbitControls } from './scene'
import { loadTunnel, setTunnelVisible, setTunnelTranslucent } from './tunnel'
import { loadBlast, setBlastVisible, flyToBlast, flyToTunnelOverview, getBlastModel, BLAST_INFO } from './blast'
import Design2DPanel from './Design2DPanel.vue'
import { aiEvents } from '@/ai-agent'

const host = ref<HTMLElement>()
const info = BLAST_INFO
const showTunnel = ref(true)
const showBlast = ref(true)
const loading = ref(true)
const loadMsg = ref('')
const showDesign2D = ref(false)  // 二维设计图小窗(图层控制里的勾选项)
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
  try { viewer?.destroy() } catch {}
})

function onToggleTunnel() { setTunnelVisible(viewer, showTunnel.value) }
function onToggleBlast() { setBlastVisible(viewer, showBlast.value) }
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

.tm-header { position: absolute; top: 0; left: 0; right: 0; height: 54px; display: flex; align-items: center; gap: 16px;
  padding: 0 22px; background: linear-gradient(180deg, rgba(8,14,24,.92), rgba(8,14,24,0)); pointer-events: none; }
.tm-title { font-size: 20px; font-weight: 700; letter-spacing: 1px; color: #7dd3fc; text-shadow: 0 0 12px rgba(56,189,248,.4); }
.tm-sub { font-size: 13px; color: #93a4bd; }

.tm-panel { position: absolute; top: 74px; background: rgba(13,20,33,.82); border: 1px solid rgba(56,189,248,.22);
  border-radius: 10px; padding: 14px 16px; backdrop-filter: blur(6px); min-width: 190px; }
.tm-left { left: 18px; }
.tm-right { right: 18px; min-width: 230px; }
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

.tm-footer { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; }
.tm-footer button { background: rgba(13,20,33,.85); border: 1px solid rgba(56,189,248,.3); color: #cfe4fb;
  padding: 8px 18px; border-radius: 8px; font-size: 13px; cursor: pointer; transition: .15s; }
.tm-footer button:hover { background: rgba(56,189,248,.2); border-color: #38bdf8; color: #fff; }
.tm-footer .tm-exit { border-color: rgba(248,113,113,.5); color: #fca5a5; margin-left: 14px; }
.tm-footer .tm-exit:hover { background: rgba(248,113,113,.2); border-color: #f87171; color: #fff; }

</style>
