<template>
  <div class="blast-design-overlay">
    <div class="blast-design-root">

      <!-- ══ HEADER ══════════════════════════════════ -->
      <header class="bd-header">
        <div class="bd-logo">爆破设计面板</div>
        <div class="bd-header-info">
          <span class="bd-tag blue">炮孔布置图</span>
          <span class="bd-tag green">φ42 · L=3.5m</span>
        </div>
        <label class="bd-import-btn" :class="{ 'bd-import-busy': importStatus === '识别中…' }" title="导入炮孔点位图片">
          {{ importStatus === '识别中…' ? '◌ 识别中…' : '⊕ 导入图片' }}
          <input type="file" accept="image/*" style="display:none" @change="onImportImage" :disabled="importStatus === '识别中…'">
        </label>
        <span v-if="importStatus && importStatus !== '识别中…'" class="bd-import-badge">{{ importStatus }}</span>
        <button class="bd-close-btn" @click="$emit('close')" title="关闭">×</button>
      </header>

      <!-- ══ BODY ════════════════════════════════════ -->
      <div class="app-body">
        <!-- Left collapsible sidebar -->
        <nav class="sidenav" :class="{ expanded: sidebarOpen }">
          <div class="nav-toggle" @click="sidebarOpen = !sidebarOpen" :title="sidebarOpen ? '收起' : '展开'">
            <span class="toggle-icon">{{ sidebarOpen ? '◀' : '▶' }}</span>
          </div>
          <div class="nav-divider"></div>
          <div
            v-for="item in navItems" :key="item.key"
            class="nav-btn"
            :class="{ active: activeNav === item.key }"
            @click="activeNav = item.key"
            :title="item.label"
          >
            <span class="nav-icon">{{ item.icon }}</span>
            <span class="nav-label">{{ item.label }}</span>
          </div>
        </nav>

        <!-- Main canvas -->
        <BlastDiagram ref="diagramRef" />

        <!-- Right panel -->
        <BlastRightPanel
          @design="onDesign"
          @reset="onReset"
          @eval="onEval"
        />
      </div>

      <!-- ══ STATUS BAR ═══════════════════════════════ -->
      <div class="bd-statusbar">
        <div class="sb-item"><div class="dot"></div><span>设计状态</span></div>
        <div class="sb-item" id="sb-counts">加载中…</div>
        <div class="sb-item" style="margin-left:auto; color:#2c3e50;">BLAST PRO v2.1</div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import BlastDiagram from './BlastDiagram.vue'
import BlastRightPanel from './BlastRightPanel.vue'

defineEmits<{ close: [] }>()

const diagramRef = ref<any>(null)
const sidebarOpen = ref(false)
const activeNav = ref('holes')
const navItems = [
  { key: 'holes',    icon: '⊞', label: '炮孔布置' },
  { key: 'overbreak',icon: '⊿', label: '超欠挖分析' },
  { key: 'params',   icon: '≡', label: '爆破参数' },
  { key: 'history',  icon: '◎', label: '历史记录' },
  { key: 'export',   icon: '↑', label: '报告导出' },
]

function onDesign({ perimN, innerN }: { perimN: number | null; innerN: number | null }) {
  if (diagramRef.value) diagramRef.value.blastUpdate(perimN, innerN)
}
function onReset() {
  if (diagramRef.value) {
    diagramRef.value.blastReset()
    diagramRef.value.blastEvalReset()
  }
}
function onEval() {
  if (diagramRef.value) diagramRef.value.blastEval(0.155)
}

// ── 炮孔精准识别算法 ──────────────────────────────────────

/** RGB [0-255] → HSV [H:0-360, S:0-1, V:0-1] */
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  let h = 0
  if (d > 0) {
    if (max === r)      h = (((g - b) / d) % 6 + 6) % 6
    else if (max === g) h = (b - r) / d + 2
    else                h = (r - g) / d + 4
    h *= 60
  }
  return [h, max > 0 ? d / max : 0, max]
}

/**
 * HSV 匹配规则，对应 SVG 渲染颜色：
 *   blue   #00eaff  H≈187° S=1.00 V=1.00
 *   orange #fb923c  H≈26°  S=0.76 V=0.98
 *   red    #f87171  H≈0°   S=0.55 V=0.97
 *   purple #c084fc  H≈279° S=0.48 V=0.99
 * wrap=true 表示色相跨越 360°/0° 边界（红色）
 */
const HSV_RULES = [
  // 蓝色覆盖：青蓝 #00eaff (H≈187°) 到标准蓝 RGB(0,0,255) (H≈240°)
  { label: 'blue',   hMin: 155, hMax: 248, wrap: false, sMin: 0.28, vMin: 0.28 },
  { label: 'orange', hMin:  10, hMax:  50, wrap: false, sMin: 0.40, vMin: 0.50 },
  { label: 'red',    hMin: 335, hMax:  25, wrap: true,  sMin: 0.28, vMin: 0.45 },
  { label: 'purple', hMin: 255, hMax: 310, wrap: false, sMin: 0.18, vMin: 0.45 },
] as const

function classifyPixel(r: number, g: number, b: number, a: number): number {
  if (a < 80) return -1
  const [h, s, v] = rgbToHsv(r, g, b)
  for (let i = 0; i < HSV_RULES.length; i++) {
    const rule = HSV_RULES[i]
    if (s < rule.sMin || v < rule.vMin) continue
    const inH = rule.wrap
      ? (h >= rule.hMin || h <= rule.hMax)
      : (h >= rule.hMin && h <= rule.hMax)
    if (inH) return i
  }
  return -1
}

function detectHoles(imageData: ImageData): Array<{ color: string; x: number; y: number }> {
  const { width, height, data } = imageData

  // ── 1. 像素 HSV 颜色分类 ─────────────────────────────
  const labelMap = new Int8Array(width * height).fill(-1)
  for (let i = 0; i < width * height; i++) {
    const p = i * 4
    labelMap[i] = classifyPixel(data[p], data[p + 1], data[p + 2], data[p + 3])
  }

  // ── 2. BFS 连通区域分析 + 边界框形状过滤 ─────────────
  // 改用边界框检验替代圆度检验：
  //   - 外部图像的炮孔圆内有数字，像素不连通，圆度值严重偏低
  //   - 边界框宽高比 + 尺寸范围 对实心/空心圆均有效
  //   - 边界框中心作为孔位（比像素质心对环形更准确）
  const visited = new Uint8Array(width * height)
  const LABELS = HSV_RULES.map(r => r.label)

  // 炮孔边界框尺寸范围：单边长占图片宽度的 0.6%~7%
  const minDim = width * 0.006
  const maxDim = width * 0.07

  interface RawHole { color: string; px: number; py: number; area: number }
  const rawHoles: RawHole[] = []

  for (let start = 0; start < width * height; start++) {
    if (visited[start] || labelMap[start] < 0) continue
    const colorIdx = labelMap[start]
    visited[start] = 1

    const stk: number[] = [start]
    let head = 0, count = 0
    let bbXMin = width, bbXMax = 0, bbYMin = height, bbYMax = 0

    while (head < stk.length) {
      const idx = stk[head++]
      const px = idx % width, py = (idx / width) | 0
      count++
      if (px < bbXMin) bbXMin = px
      if (px > bbXMax) bbXMax = px
      if (py < bbYMin) bbYMin = py
      if (py > bbYMax) bbYMax = py

      const nbrs = [idx - width, idx + width, idx - 1, idx + 1]
      for (let ni = 0; ni < 4; ni++) {
        const nIdx = nbrs[ni]
        if (nIdx < 0 || nIdx >= width * height) continue
        if (ni === 2 && px === 0) continue
        if (ni === 3 && px === width - 1) continue
        if (visited[nIdx]) continue
        if (labelMap[nIdx] !== colorIdx) continue
        visited[nIdx] = 1
        stk.push(nIdx)
      }
    }

    const bbW = bbXMax - bbXMin + 1
    const bbH = bbYMax - bbYMin + 1

    // 尺寸过滤
    if (bbW < minDim || bbH < minDim || bbW > maxDim || bbH > maxDim) continue

    // 近圆形：宽高比 > 0.45（排除横线/竖线）
    if (Math.min(bbW, bbH) / Math.max(bbW, bbH) < 0.45) continue

    // 填充率：圆形 ≈ π/4=0.785，环形/带文字 ≥ 0.08（极稀疏的是噪声）
    if (count / (bbW * bbH) < 0.08) continue

    // 用边界框中心作为孔位（对实心圆/环形均精确）
    rawHoles.push({
      color: LABELS[colorIdx],
      px: (bbXMin + bbXMax) / 2,
      py: (bbYMin + bbYMax) / 2,
      area: count,
    })
  }

  // ── 3. NMS：像素空间内合并近邻同色检测 ───────────────
  // 合并距离 = 预期孔半径的 2 倍（像素）
  const mergeDistPxSq = (width * 0.012) ** 2
  const used = new Uint8Array(rawHoles.length)
  interface MergedHole { color: string; px: number; py: number }
  const merged: MergedHole[] = []

  for (let i = 0; i < rawHoles.length; i++) {
    if (used[i]) continue
    let wSum = rawHoles[i].area
    let sx = rawHoles[i].px * wSum
    let sy = rawHoles[i].py * wSum

    for (let j = i + 1; j < rawHoles.length; j++) {
      if (used[j] || rawHoles[j].color !== rawHoles[i].color) continue
      const dx = rawHoles[j].px - rawHoles[i].px
      const dy = rawHoles[j].py - rawHoles[i].py
      if (dx * dx + dy * dy < mergeDistPxSq) {
        const w = rawHoles[j].area
        sx += rawHoles[j].px * w
        sy += rawHoles[j].py * w
        wSum += w
        used[j] = 1
      }
    }

    merged.push({ color: rawHoles[i].color, px: sx / wSum, py: sy / wSum })
  }

  if (merged.length === 0) return []

  // ── 4. 内容边界框定标 → SVG 坐标映射 ─────────────────
  // 关键：用检测到的孔的实际像素范围定标，而非图片尺寸
  // 这样可以消除图片自身的留白/边距对边缘孔位置的影响
  let pxMin = Infinity, pxMax = -Infinity
  let pyMin = Infinity, pyMax = -Infinity
  for (const h of merged) {
    if (h.px < pxMin) pxMin = h.px
    if (h.px > pxMax) pxMax = h.px
    if (h.py < pyMin) pyMin = h.py
    if (h.py > pyMax) pyMax = h.py
  }

  // 与 BlastDiagram.vue 中相同的缩放居中逻辑（MARGIN=34, 700×660）
  const MARGIN = 34
  const usableW = 700 - 2 * MARGIN
  const usableH = 660 - 2 * MARGIN
  const pxRange = Math.max(pxMax - pxMin, 1)
  const pyRange = Math.max(pyMax - pyMin, 1)
  const sc = Math.min(usableW / pxRange, usableH / pyRange)
  const offX = MARGIN + (usableW - pxRange * sc) / 2
  const offY = MARGIN + (usableH - pyRange * sc) / 2

  return merged.map(h => ({
    color: h.color,
    x: offX + (h.px - pxMin) * sc,
    y: offY + (h.py - pyMin) * sc,
  }))
}

const importStatus = ref('')

function onImportImage(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  input.value = ''
  importStatus.value = '识别中…'

  const url = URL.createObjectURL(file)
  const img = new Image()
  img.onload = () => {
    URL.revokeObjectURL(url)
    const cvs = document.createElement('canvas')
    cvs.width = img.naturalWidth
    cvs.height = img.naturalHeight
    cvs.getContext('2d')!.drawImage(img, 0, 0)
    const holes = detectHoles(cvs.getContext('2d')!.getImageData(0, 0, cvs.width, cvs.height))
    diagramRef.value?.loadDetectedHoles(holes)
    const cnt = { blue: 0, orange: 0, red: 0, purple: 0 } as Record<string, number>
    holes.forEach(h => { cnt[h.color] = (cnt[h.color] || 0) + 1 })
    importStatus.value =
      `蓝${cnt.blue||0} 橙${cnt.orange||0} 红${cnt.red||0} 紫${cnt.purple||0} · 共 ${holes.length} 孔`
    setTimeout(() => { importStatus.value = '' }, 7000)
  }
  img.onerror = () => {
    URL.revokeObjectURL(url)
    importStatus.value = '图片加载失败'
    setTimeout(() => { importStatus.value = '' }, 3000)
  }
  img.src = url
}
</script>

<style>
/* ── Overlay wrapper ── */
.blast-design-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(2px);
}

/* ── Root container with CSS variables ── */
.blast-design-root {
  --bd-bg:        #000810;
  --bd-surface:   #00101e;
  --bd-surface2:  #001428;
  --bd-border:    rgba(0, 150, 255, 0.22);
  --bd-border2:   rgba(0, 200, 255, 0.28);
  --bd-hole:      #00eaff;
  --bd-hole-glow: rgba(0, 234, 255, 0.4);
  --bd-contour:   #34d399;
  --bd-text:      rgba(255, 255, 255, 0.88);
  --bd-muted:     rgba(0, 200, 255, 0.52);
  --bd-dim:       rgba(0, 100, 200, 0.3);
  --bd-font-mono: 'IBM Plex Mono', 'Courier New', monospace;
  --bd-font-ui:   'Microsoft YaHei', 'Space Grotesk', 'Segoe UI', system-ui, sans-serif;

  width: 70vw;
  height: 80vh;
  display: flex;
  flex-direction: column;
  background: var(--bd-bg);
  color: var(--bd-text);
  font-family: var(--bd-font-ui);
  font-size: 15px;
  overflow: hidden;
  border-radius: 4px;
  border: 1px solid rgba(0, 255, 255, 0.3);
  box-shadow: 0 0 40px rgba(0, 200, 255, 0.15), 0 8px 60px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(0, 255, 255, 0.08);
}

/* ── Header ── */
.bd-header {
  display: flex;
  align-items: center;
  height: 48px;
  background: linear-gradient(to bottom, rgba(0, 20, 40, 0.98), rgba(0, 20, 40, 0.85));
  border-bottom: 1px solid rgba(0, 255, 255, 0.3);
  box-shadow: 0 0 15px rgba(0, 255, 255, 0.12);
  padding: 0 20px;
  gap: 0;
  flex-shrink: 0;
  z-index: 10;
}
.bd-logo {
  font-family: var(--bd-font-mono);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 3px;
  background: linear-gradient(180deg, #fff, #87cefa);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: none;
  filter: drop-shadow(0 0 6px rgba(0, 255, 255, 0.6));
  padding-right: 20px;
  border-right: 1px solid rgba(0, 255, 255, 0.2);
  margin-right: 20px;
  white-space: nowrap;
}
.bd-logo span { opacity: 0.5; font-weight: 400; }

.bd-header-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--bd-font-mono);
  font-size: 13px;
  color: var(--bd-muted);
}
.bd-header-info strong { color: var(--bd-text); font-weight: 500; }
.bd-header-info .sep { color: var(--bd-dim); }

.bd-header-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
}
.bd-tag {
  font-family: var(--bd-font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  padding: 3px 9px;
  border: 1px solid rgba(0, 150, 255, 0.3);
  color: rgba(0, 200, 255, 0.55);
}
.bd-tag.green { border-color: #34d399; color: #34d399; }
.bd-tag.blue  { border-color: #00eaff; color: #00eaff; box-shadow: 0 0 8px rgba(0, 234, 255, 0.2); }

.bd-import-btn {
  margin-left: auto;
  margin-right: 8px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 12px;
  height: 30px;
  background: linear-gradient(135deg, rgba(0, 80, 150, 0.4), rgba(0, 120, 200, 0.3));
  border: 1px solid #00eaff;
  color: #00eaff;
  font-size: 13px;
  font-family: var(--bd-font-mono);
  cursor: pointer;
  transition: background 0.15s;
  border-radius: 2px;
  user-select: none;
  box-shadow: 0 0 10px rgba(0, 234, 255, 0.2);
}
.bd-import-btn:hover {
  background: rgba(0, 234, 255, 0.18);
}
.bd-import-busy {
  opacity: 0.65;
  cursor: default;
  pointer-events: none;
}
.bd-import-badge {
  font-family: var(--bd-font-mono);
  font-size: 11px;
  color: #34d399;
  background: rgba(52, 211, 153, 0.08);
  border: 1px solid rgba(52, 211, 153, 0.35);
  padding: 2px 9px;
  letter-spacing: 0.5px;
  white-space: nowrap;
  animation: badge-fade-in 0.3s ease;
}
@keyframes badge-fade-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.bd-close-btn {
  flex-shrink: 0;
  flex-shrink: 0;
  background: transparent;
  border: 1px solid rgba(0, 200, 255, 0.25);
  color: var(--bd-muted);
  font-size: 20px;
  line-height: 1;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  border-radius: 2px;
}
.bd-close-btn:hover { color: #ff6060; border-color: #ff6060; box-shadow: 0 0 8px rgba(255, 60, 60, 0.3); }

/* ── Layout ── */
.blast-design-root .app-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

/* ── Sidenav ── */
.blast-design-root .sidenav {
  width: 42px;
  background: rgba(0, 15, 30, 0.92);
  border-right: 1px solid rgba(0, 150, 255, 0.2);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 8px 0;
  gap: 2px;
  flex-shrink: 0;
  overflow: hidden;
  transition: width 0.25s ease;
}
.blast-design-root .sidenav.expanded {
  width: 150px;
}

/* Toggle button */
.blast-design-root .nav-toggle {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 6px 10px;
  cursor: pointer;
  color: var(--bd-muted);
  transition: color 0.15s;
  flex-shrink: 0;
}
.blast-design-root .nav-toggle:hover { color: #00eaff; }
.blast-design-root .toggle-icon { font-size: 10px; }

.blast-design-root .nav-divider {
  height: 1px;
  background: rgba(0, 150, 255, 0.2);
  margin: 4px 8px 6px;
  flex-shrink: 0;
}

/* Nav items */
.blast-design-root .nav-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  cursor: pointer;
  color: var(--bd-muted);
  font-size: 13px;
  transition: color 0.15s, background 0.15s;
  position: relative;
  white-space: nowrap;
  overflow: hidden;
  border-left: 2px solid transparent;
  flex-shrink: 0;
}
.blast-design-root .nav-btn:hover {
  color: var(--bd-text);
  background: rgba(0, 100, 200, 0.15);
}
.blast-design-root .nav-btn.active {
  color: #00eaff;
  background: rgba(0, 234, 255, 0.08);
  border-left-color: #00eaff;
}
.blast-design-root .nav-icon {
  font-size: 15px;
  flex-shrink: 0;
  width: 20px;
  text-align: center;
}
.blast-design-root .nav-label {
  font-size: 13px;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}
.blast-design-root .sidenav.expanded .nav-label {
  opacity: 1;
}

/* ── Canvas ── */
.blast-design-root .canvas-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}
.blast-design-root .canvas-toolbar {
  height: 40px;
  background: var(--bd-surface);
  border-bottom: 1px solid var(--bd-border);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 14px;
  flex-shrink: 0;
}
.blast-design-root .tb-label {
  font-family: var(--bd-font-mono);
  font-size: 12px;
  color: var(--bd-muted);
  letter-spacing: 0.5px;
  white-space: nowrap;
}
.blast-design-root .tb-sep { width: 1px; height: 18px; background: var(--bd-border); }
.blast-design-root .legend {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--bd-muted);
}
.blast-design-root .legend-line {
  display: inline-block;
  width: 22px;
  height: 2px;
  background: repeating-linear-gradient(
    90deg, var(--bd-contour) 0, var(--bd-contour) 5px, transparent 5px, transparent 9px
  );
}
.blast-design-root .legend-circle {
  width: 9px; height: 9px;
  border-radius: 50%;
  background: var(--bd-hole);
  box-shadow: 0 0 5px var(--bd-hole-glow);
}
.blast-design-root .tb-right { margin-left: auto; }
.blast-design-root .canvas-scroll {
  flex: 1;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  user-select: none;
  background-image: radial-gradient(circle, var(--bd-dim) 1px, transparent 1px);
  background-size: 28px 28px;
}
.blast-design-root .canvas-scroll.panning { cursor: grabbing; }
.blast-design-root #blast-svg {
  width: 100%;
  height: 100%;
  display: block;
  overflow: visible;
  touch-action: none;
}
.blast-design-root .zoom-reset {
  position: absolute;
  bottom: 10px; right: 10px;
  font-family: var(--bd-font-mono);
  font-size: 12px;
  color: var(--bd-muted);
  background: var(--bd-surface2);
  border: 1px solid var(--bd-border);
  padding: 3px 8px;
  cursor: pointer;
  letter-spacing: 1px;
  z-index: 5;
}
.blast-design-root .zoom-reset:hover { color: var(--bd-hole); border-color: var(--bd-hole); }

/* ── Right panel ── */
.blast-design-root .right-panel {
  width: 252px;
  min-width: 160px;
  max-width: 480px;
  position: relative;
  background: rgba(0, 15, 30, 0.88);
  border-left: 4px solid #00aaff;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  flex-shrink: 0;
}
.blast-design-root .right-panel::-webkit-scrollbar { width: 4px; }
.blast-design-root .right-panel::-webkit-scrollbar-track { background: transparent; }
.blast-design-root .right-panel::-webkit-scrollbar-thumb { background: var(--bd-border2); }
.blast-design-root .rp-section {
  padding: 14px 16px;
  border-bottom: 1px solid var(--bd-border);
}
.blast-design-root .face-sketch-text {
  margin: 0;
  color: #ffffff;
  font-size: 12px;
  line-height: 1.8;
  text-align: justify;
  letter-spacing: 0.02em;
}
.blast-design-root .rp-title {
  font-family: var(--bd-font-mono);
  font-size: 11px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #00eaff;
  margin-bottom: 12px;
  text-shadow: 0 0 8px rgba(0, 234, 255, 0.4);
}
.blast-design-root .kv-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.blast-design-root .kv-key { font-size: 13px; color: var(--bd-muted); }
.blast-design-root .kv-val {
  font-family: var(--bd-font-mono);
  font-size: 13px;
  color: var(--bd-text);
  font-weight: 500;
}
.blast-design-root .kv-val.accent { color: var(--bd-hole); }

/* Adjustable parameters */
.blast-design-root .param-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 7px;
}
.blast-design-root .param-row label {
  font-size: 13px;
  color: var(--bd-muted);
  white-space: nowrap;
  flex: 1;
}
.blast-design-root .param-row input[type="number"] {
  width: 64px;
  background: var(--bd-surface2);
  border: 1px solid var(--bd-border2);
  color: var(--bd-text);
  font-family: var(--bd-font-mono);
  font-size: 14px;
  padding: 4px 7px;
  text-align: right;
  outline: none;
  transition: border-color 0.15s;
  -moz-appearance: textfield;
  appearance: textfield;
}
.blast-design-root .param-row input[type="number"]:focus { border-color: var(--bd-hole); }
.blast-design-root .param-row input[type="number"]::-webkit-inner-spin-button,
.blast-design-root .param-row input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.blast-design-root .param-unit {
  font-size: 12px;
  color: var(--bd-muted);
  white-space: nowrap;
  min-width: 14px;
}
.blast-design-root .param-divider {
  height: 1px;
  background: var(--bd-border);
  margin: 10px 0;
}
.blast-design-root .param-btn,
.blast-design-root .param-btn-reset,
.blast-design-root .param-btn-eval {
  width: 100%;
  margin-top: 8px;
  padding: 8px 0;
  background: transparent;
  border: 1px solid rgba(0, 200, 255, 0.35);
  color: #00eaff;
  font-size: 13px;
  font-family: var(--bd-font-mono);
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
  display: block;
  text-align: center;
}
.blast-design-root .param-btn:hover,
.blast-design-root .param-btn-reset:hover,
.blast-design-root .param-btn-eval:hover {
  background: rgba(0, 200, 255, 0.12);
  border-color: #00eaff;
  box-shadow: 0 0 10px rgba(0, 234, 255, 0.2);
}

/* Effect output */
.blast-design-root .effect-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 0;
  border-bottom: 1px solid rgba(0, 150, 255, 0.15);
}
.blast-design-root .effect-row:last-child { border-bottom: none; }
.blast-design-root .effect-key { font-size: 13px; color: var(--bd-muted); white-space: nowrap; }
.blast-design-root .effect-val {
  font-family: var(--bd-font-mono);
  font-size: 15px;
  color: #00eaff;
  letter-spacing: 0.04em;
  text-shadow: 0 0 8px rgba(0, 234, 255, 0.5);
}
.blast-design-root .effect-val.pending { color: var(--bd-muted); font-size: 13px; text-shadow: none; }

/* ── Status bar ── */
.bd-statusbar {
  height: 24px;
  background: rgba(0, 15, 30, 0.95);
  border-top: 1px solid rgba(0, 255, 255, 0.15);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 20px;
  flex-shrink: 0;
}
.blast-design-root .sb-item {
  font-family: var(--bd-font-mono);
  font-size: 12px;
  color: var(--bd-muted);
  display: flex;
  align-items: center;
  gap: 5px;
}
.blast-design-root .sb-item .dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--bd-contour);
}
</style>
