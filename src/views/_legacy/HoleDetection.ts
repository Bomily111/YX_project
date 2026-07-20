/**
 * 炮孔图像识别算法（从 BlastDesignPanel 提取为共享工具）
 * HSV 颜色分类 + BFS 连通区域 + NMS 合并 → SVG 坐标
 */

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

const HSV_RULES = [
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

export interface DetectedHole { color: string; x: number; y: number }

export function detectHoles(imageData: ImageData): DetectedHole[] {
  const { width, height, data } = imageData
  const labelMap = new Int8Array(width * height).fill(-1)
  for (let i = 0; i < width * height; i++) {
    const p = i * 4
    labelMap[i] = classifyPixel(data[p], data[p + 1], data[p + 2], data[p + 3])
  }

  const visited = new Uint8Array(width * height)
  const LABELS = HSV_RULES.map(r => r.label)
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
      if (px < bbXMin) bbXMin = px; if (px > bbXMax) bbXMax = px
      if (py < bbYMin) bbYMin = py; if (py > bbYMax) bbYMax = py
      const nbrs = [idx - width, idx + width, idx - 1, idx + 1]
      for (let ni = 0; ni < 4; ni++) {
        const nIdx = nbrs[ni]
        if (nIdx < 0 || nIdx >= width * height) continue
        if (ni === 2 && px === 0) continue
        if (ni === 3 && px === width - 1) continue
        if (visited[nIdx] || labelMap[nIdx] !== colorIdx) continue
        visited[nIdx] = 1; stk.push(nIdx)
      }
    }
    const bbW = bbXMax - bbXMin + 1, bbH = bbYMax - bbYMin + 1
    if (bbW < minDim || bbH < minDim || bbW > maxDim || bbH > maxDim) continue
    if (Math.min(bbW, bbH) / Math.max(bbW, bbH) < 0.45) continue
    if (count / (bbW * bbH) < 0.08) continue
    rawHoles.push({ color: LABELS[colorIdx], px: (bbXMin + bbXMax) / 2, py: (bbYMin + bbYMax) / 2, area: count })
  }

  const mergeDistPxSq = (width * 0.012) ** 2
  const used = new Uint8Array(rawHoles.length)
  interface MergedHole { color: string; px: number; py: number }
  const merged: MergedHole[] = []
  for (let i = 0; i < rawHoles.length; i++) {
    if (used[i]) continue
    let wSum = rawHoles[i].area, sx = rawHoles[i].px * wSum, sy = rawHoles[i].py * wSum
    for (let j = i + 1; j < rawHoles.length; j++) {
      if (used[j] || rawHoles[j].color !== rawHoles[i].color) continue
      const dx = rawHoles[j].px - rawHoles[i].px, dy = rawHoles[j].py - rawHoles[i].py
      if (dx * dx + dy * dy < mergeDistPxSq) {
        const w = rawHoles[j].area; sx += rawHoles[j].px * w; sy += rawHoles[j].py * w; wSum += w; used[j] = 1
      }
    }
    merged.push({ color: rawHoles[i].color, px: sx / wSum, py: sy / wSum })
  }

  if (merged.length === 0) return []

  let pxMin = Infinity, pxMax = -Infinity, pyMin = Infinity, pyMax = -Infinity
  for (const h of merged) {
    if (h.px < pxMin) pxMin = h.px; if (h.px > pxMax) pxMax = h.px
    if (h.py < pyMin) pyMin = h.py; if (h.py > pyMax) pyMax = h.py
  }
  const MARGIN = 34, usableW = 700 - 2 * MARGIN, usableH = 660 - 2 * MARGIN
  const pxRange = Math.max(pxMax - pxMin, 1), pyRange = Math.max(pyMax - pyMin, 1)
  const sc = Math.min(usableW / pxRange, usableH / pyRange)
  const offX = MARGIN + (usableW - pxRange * sc) / 2
  const offY = MARGIN + (usableH - pyRange * sc) / 2
  return merged.map(h => ({ color: h.color, x: offX + (h.px - pxMin) * sc, y: offY + (h.py - pyMin) * sc }))
}

/** 从 File 对象读取图片并运行炮孔检测，返回 Promise<DetectedHole[]> */
export function detectHolesFromFile(file: File): Promise<DetectedHole[]> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const cvs = document.createElement('canvas')
      cvs.width = img.naturalWidth; cvs.height = img.naturalHeight
      cvs.getContext('2d')!.drawImage(img, 0, 0)
      resolve(detectHoles(cvs.getContext('2d')!.getImageData(0, 0, cvs.width, cvs.height)))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片加载失败')) }
    img.src = url
  })
}
