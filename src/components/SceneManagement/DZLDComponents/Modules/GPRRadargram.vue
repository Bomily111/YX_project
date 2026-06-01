<!--
  GPR B-Scan Radargram — Draggable Floating Panel
  Style: matches main interface (glassmorphism + cyan accents)
-->
<template>
  <div
    v-if="visible"
    ref="panelRef"
    class="gpr-float"
    :class="{ collapsed }"
    :style="{ left: pos.x + 'px', top: pos.y + 'px' }"
  >
    <!-- Drag handle -->
    <header class="gpr-header" @mousedown="onDragStart">
      <span class="gpr-icon">≋</span>
      <span class="gpr-title">地质雷达剖面 — {{ radarData?.name || '加载中...' }}</span>
      <span class="gpr-meta" v-if="radarData">{{ radarData.n_scans }}道 · {{ radarData.profile_length_m }}m · εr={{ radarData.dielectric }}</span>
      <button class="gpr-btn-collapse" @mousedown.stop @click="collapsed = !collapsed" :title="collapsed ? '展开' : '折叠'">
        {{ collapsed ? '▸' : '▾' }}
      </button>
      <button class="gpr-btn-close" @mousedown.stop @click="visible = false" title="关闭">×</button>
    </header>

    <div class="gpr-body" v-show="!collapsed">
      <div v-if="!radarData" class="gpr-loading">加载雷达剖面数据中...</div>

      <template v-else>
        <!-- Controls -->
        <div class="gpr-controls">
          <div class="gpr-section-title"><span class="gpr-si">▸</span> 显示设置</div>
          <div class="gpr-ctrl-row">
            <label class="gpr-label">测线
              <select v-model="currentLine" @change="switchLine">
                <option :value="1">测线 1</option>
                <option :value="2">测线 2</option>
              </select>
            </label>
            <label class="gpr-label">色标
              <select v-model="cmap">
                <option value="gray">灰度</option>
                <option value="seismic">地震</option>
                <option value="hot">热力</option>
                <option value="terrain">地形</option>
              </select>
            </label>
            <label class="gpr-label">增益
              <input type="range" v-model.number="gain" min="0.5" max="4" step="0.1" />
              <span class="gpr-gain-val">{{ gain }}x</span>
            </label>
            <label class="gpr-check"><input type="checkbox" v-model="showReflectors" /> 层位</label>
            <label class="gpr-check"><input type="checkbox" v-model="showWiggle" /> 波形</label>
          </div>
        </div>

        <!-- Canvas -->
        <div class="gpr-canvas-wrap" ref="canvasWrap" @mousemove="onMouseMove" @mouseleave="onMouseLeave">
          <canvas ref="radarCanvas"></canvas>
          <div class="gpr-cursor" v-if="cursorPos" :style="{ left: cursorPos.x + 'px' }">
            <div class="gpr-cursor-line"></div>
            <span class="gpr-cursor-tag">Scan {{ cursorScan }} · {{ cursorDist.toFixed(2) }}m · {{ cursorDepth.toFixed(2) }}m</span>
          </div>
        </div>

        <!-- Footer -->
        <footer class="gpr-footer">
          <span>采样: {{ radarData.n_samples }}</span>
          <span>深度: {{ radarData.depth_range_m }}m</span>
          <span>波速: {{ radarData.velocity_m_ns }} m/ns</span>
          <span>层位: {{ radarData.reflectors?.length || 0 }}</span>
        </footer>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'

const props = defineProps({
  initialX: { type: Number, default: 310 },
  initialY: { type: Number, default: 480 },
})

// ---- Panel state ----
const visible = ref(true)
const collapsed = ref(false)
const panelRef = ref(null)
const pos = ref({ x: props.initialX, y: props.initialY })

// ---- Data ----
const radarData = ref(null)
const currentLine = ref(1)
const cmap = ref('gray')
const gain = ref(1.0)
const showReflectors = ref(true)
const showWiggle = ref(false)
const radarCanvas = ref(null)
const canvasWrap = ref(null)
const cursorPos = ref(null)
const cursorScan = ref(0)
const cursorDist = ref(0)
const cursorDepth = ref(0)

let rawData = null
let resizeObserver = null

// ---- Drag (viewport-clamped, matches DispatchGantt) ----
let dragging = false
let dragStart = { x: 0, y: 0 }

function onDragStart(e) {
  if (e.button !== 0) return
  dragging = true
  dragStart = { x: e.clientX - pos.value.x, y: e.clientY - pos.value.y }
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', onDragEnd)
}

function onDrag(e) {
  if (!dragging) return
  pos.value = {
    x: Math.max(0, Math.min(e.clientX - dragStart.x, window.innerWidth - 300)),
    y: Math.max(0, Math.min(e.clientY - dragStart.y, window.innerHeight - 60)),
  }
}

function onDragEnd() {
  dragging = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', onDragEnd)
}

// ---- Data loading ----
async function switchLine() { await loadData() }

async function loadData() {
  try {
    const url = `data/GPR_new/output/radargram_line${currentLine.value}.json`
    const resp = await fetch(url)
    const json = await resp.json()
    const key = Object.keys(json)[0]
    radarData.value = json[key]
    rawData = {
      data: new Float32Array(radarData.value.data),
      shape: radarData.value.ds_shape,
    }
    await nextTick()
    render()
  } catch (err) {
    console.error('Failed to load GPR radargram data:', err)
  }
}

// ---- Rendering ----
function getColor(val) {
  const v = Math.max(-1, Math.min(1, val))
  switch (cmap.value) {
    case 'seismic': {
      const t = v * 0.5 + 0.5
      return [t < 0.5 ? 0 : (t - 0.5) * 2, 1 - 2 * Math.abs(t - 0.5), t < 0.5 ? (0.5 - t) * 2 : 0]
    }
    case 'hot': {
      const t = v * 0.5 + 0.5
      return [Math.min(1, t * 3), Math.max(0, (t - 0.3) * 3), Math.max(0, (t - 0.6) * 3)]
    }
    case 'terrain': {
      if (v < -0.5) return [0, 0, 0.4 + (v + 1) * 1.2]
      if (v < 0) return [0, 0.5 + v * 1, 0.3 - v * 0.6]
      if (v < 0.5) return [v * 1.6, 0.6 + v * 0.4, 0.15]
      return [0.8 + v * 0.4, 0.8 + v * 0.4, 0.15 + v * 1.7]
    }
    default: {
      const g = v * 0.5 + 0.5
      return [g, g, g]
    }
  }
}

function render() {
  if (!radarCanvas.value || !canvasWrap.value || !rawData) return

  const canvas = radarCanvas.value
  const wrap = canvasWrap.value
  const W = wrap.clientWidth
  const H = wrap.clientHeight
  const dpr = window.devicePixelRatio || 1

  canvas.width = W * dpr
  canvas.height = H * dpr
  canvas.style.width = W + 'px'
  canvas.style.height = H + 'px'

  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const { data, shape } = rawData
  const [nScans, nSamples] = shape
  const g = gain.value

  const img = ctx.createImageData(W, H)
  for (let py = 0; py < H; py++) {
    const dIdx = Math.floor(py / H * nSamples)
    const rowBase = dIdx * nScans
    for (let px = 0; px < W; px++) {
      const sIdx = Math.floor(px / W * nScans)
      const val = data[rowBase + sIdx] * g
      const [r, gv, b] = getColor(val)
      const idx = (py * W + px) * 4
      img.data[idx] = Math.round(r * 255)
      img.data[idx + 1] = Math.round(gv * 255)
      img.data[idx + 2] = Math.round(b * 255)
      img.data[idx + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)

  // Reflectors
  if (showReflectors.value && radarData.value?.reflectors) {
    const depthMax = radarData.value.depth_range_m
    ctx.strokeStyle = 'rgba(0,234,255,0.35)'
    ctx.lineWidth = 0.8
    ctx.setLineDash([3, 5])
    ctx.font = '9px "Consolas", monospace'
    ctx.fillStyle = 'rgba(0,234,255,0.8)'
    radarData.value.reflectors.forEach((r) => {
      const y = r.depth_m / depthMax * H
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
      ctx.fillText(r.depth_m.toFixed(1) + 'm', 5, y - 3)
    })
    ctx.setLineDash([])
  }

  // Wiggle
  if (showWiggle.value) {
    const spacing = Math.max(2, Math.floor(nScans / 40))
    const ampScale = W / nScans * 0.5
    ctx.strokeStyle = 'rgba(200,240,255,0.3)'
    ctx.lineWidth = 0.4
    for (let s = 0; s < nScans; s += spacing) {
      const x = s / nScans * W
      ctx.beginPath()
      for (let d = 0; d < nSamples; d++) {
        const val = data[d * nScans + s] * g * ampScale
        const y = d / nSamples * H
        if (d === 0) ctx.moveTo(x + val, y)
        else ctx.lineTo(x + val, y)
      }
      ctx.stroke()
    }
  }
}

// ---- Mouse ----
function onMouseMove(e) {
  if (!canvasWrap.value || !rawData) return
  const rect = canvasWrap.value.getBoundingClientRect()
  const relX = (e.clientX - rect.left) / rect.width
  const relY = (e.clientY - rect.top) / rect.height
  const [nScans] = rawData.shape
  cursorScan.value = Math.floor(relX * nScans)
  cursorDist.value = relX * (radarData.value?.profile_length_m || 4.1)
  cursorDepth.value = relY * (radarData.value?.depth_range_m || 31.82)
  cursorPos.value = { x: e.clientX - rect.left }
}

function onMouseLeave() { cursorPos.value = null }

// ---- Watchers ----
let renderTimer = null
function scheduleRender() {
  if (renderTimer) clearTimeout(renderTimer)
  renderTimer = setTimeout(render, 50)
}
watch([cmap, gain, showReflectors, showWiggle], scheduleRender)

onMounted(() => {
  loadData()
  if (canvasWrap.value) {
    resizeObserver = new ResizeObserver(scheduleRender)
    resizeObserver.observe(canvasWrap.value)
  }
})

onBeforeUnmount(() => {
  onDragEnd()
  if (resizeObserver) resizeObserver.disconnect()
  if (renderTimer) clearTimeout(renderTimer)
})
</script>

<style scoped>
/* ── Floating panel — matches DispatchGantt ─────────── */
.gpr-float {
  position: fixed;
  z-index: 43;
  width: 620px;
  background: rgba(0, 8, 22, 0.88);
  border: 1px solid rgba(0, 170, 255, 0.25);
  border-top: 3px solid rgba(0, 234, 255, 0.5);
  border-radius: 6px;
  backdrop-filter: blur(14px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: 'Microsoft YaHei', sans-serif;
}

/* ── Header — matches .scp-header / .dgf-header ─────── */
.gpr-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(0, 20, 40, 0.7);
  border-bottom: 1px solid rgba(0, 170, 255, 0.12);
  cursor: move;
  user-select: none;
}
.gpr-icon {
  font-size: 14px;
  color: rgba(0, 234, 255, 0.7);
}
.gpr-title {
  flex: 1;
  font-size: 12px;
  font-weight: bold;
  color: rgba(200, 240, 255, 0.85);
}
.gpr-meta {
  font-size: 10px;
  color: rgba(180, 220, 255, 0.45);
  font-family: 'Consolas', monospace;
}

/* Buttons */
.gpr-btn-collapse,
.gpr-btn-close {
  width: 20px; height: 20px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; line-height: 1; flex-shrink: 0;
}
.gpr-btn-collapse {
  border: 1px solid rgba(0, 150, 255, 0.25);
  border-radius: 3px;
  background: rgba(0, 80, 180, 0.2);
  color: rgba(180, 220, 255, 0.6);
  font-size: 11px;
}
.gpr-btn-collapse:hover {
  background: rgba(0, 100, 200, 0.35);
  color: #88ddff;
}
.gpr-btn-close {
  border: 1px solid rgba(255, 80, 80, 0.3);
  border-radius: 3px;
  background: rgba(255, 40, 40, 0.15);
  color: #ff8888;
  font-size: 13px;
}
.gpr-btn-close:hover {
  background: rgba(255, 40, 40, 0.3);
  color: #fff;
}

/* ── Body ──────────────────────────────────────────── */
.gpr-body { display: flex; flex-direction: column; }
.gpr-loading {
  display: flex; justify-content: center; align-items: center;
  height: 200px;
  font-size: 12px;
  color: rgba(180, 220, 255, 0.45);
}

/* ── Controls — matches .scp-section / action buttons ── */
.gpr-controls {
  padding: 8px 12px 6px;
  border-bottom: 1px solid rgba(0, 170, 255, 0.08);
}
.gpr-section-title {
  font-size: 11px;
  color: rgba(180, 220, 255, 0.45);
  letter-spacing: 0.8px;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.gpr-si { color: rgba(0, 234, 255, 0.7); font-size: 10px; }

.gpr-ctrl-row {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.gpr-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: rgba(200, 230, 255, 0.7);
  white-space: nowrap;
}
.gpr-label select {
  padding: 2px 6px;
  border: 1px solid rgba(0, 150, 255, 0.25);
  border-radius: 4px;
  background: rgba(0, 30, 70, 0.5);
  color: #88ddff;
  font-size: 11px;
  cursor: pointer;
}
.gpr-label select option {
  background: rgba(0, 10, 30, 0.95);
  color: #cce;
}
.gpr-label input[type="range"] {
  width: 52px;
  accent-color: rgba(0, 234, 255, 0.7);
}
.gpr-gain-val {
  font-size: 10px;
  color: rgba(0, 234, 255, 0.7);
  font-family: 'Consolas', monospace;
  min-width: 26px;
  text-align: right;
}
.gpr-check {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: rgba(180, 220, 255, 0.55);
  cursor: pointer;
}
.gpr-check input[type="checkbox"] {
  accent-color: rgba(0, 234, 255, 0.6);
}

/* ── Canvas ────────────────────────────────────────── */
.gpr-canvas-wrap {
  position: relative;
  margin: 6px 8px;
  border: 1px solid rgba(0, 170, 255, 0.12);
  height: 250px;
  cursor: crosshair;
  overflow: hidden;
  background: #000;
}
.gpr-canvas-wrap canvas { display: block; }

.gpr-cursor {
  position: absolute; top: 0; bottom: 0;
  pointer-events: none; z-index: 5;
}
.gpr-cursor-line {
  position: absolute; top: 0; bottom: 0;
  width: 1px; background: rgba(255, 255, 0, 0.6);
}
.gpr-cursor-tag {
  position: absolute; top: 4px; left: 5px;
  padding: 2px 6px; border-radius: 2px;
  background: rgba(0, 8, 22, 0.85);
  color: #ff0;
  font-size: 10px;
  font-family: 'Consolas', monospace;
  white-space: nowrap;
}

/* ── Footer ────────────────────────────────────────── */
.gpr-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  padding: 6px 12px;
  font-size: 10px;
  color: rgba(180, 220, 255, 0.4);
  font-family: 'Consolas', monospace;
}

/* ── Collapsed ─────────────────────────────────────── */
.collapsed { width: auto !important; }
.collapsed .gpr-header { border-bottom: none; border-radius: 3px 3px 0 0; }
</style>
