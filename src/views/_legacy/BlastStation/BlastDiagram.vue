<template>
  <div class="canvas-wrap">
    <!-- Toolbar -->
    <div class="canvas-toolbar">
      <span class="tb-label">断面炮孔示意图</span>
      <div class="tb-sep"></div>
      <div class="legend">
        <div class="legend-circle"></div>
        <span>炮孔位置</span>
      </div>
      <div class="legend">
        <div class="legend-line"></div>
        <span>设计轮廓线</span>
      </div>
      <div class="tb-right tb-label" id="tb-info">正在生成...</div>
    </div>

    <!-- Canvas -->
    <div class="canvas-scroll" ref="canvasScrollRef">
      <svg id="blast-svg" viewBox="0 0 700 660" xmlns="http://www.w3.org/2000/svg" ref="svgRef">
        <defs>
          <filter id="hglow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur"/>
            <feColorMatrix in="blur" type="matrix"
              values="0 0 0 0 0
                      0 0 0 0 0.92
                      0 0 0 0 1
                      0 0 0 0.5 0" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="hglow-orange" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur"/>
            <feColorMatrix in="blur" type="matrix"
              values="0 0 0 0 0.98
                      0 0 0 0 0.57
                      0 0 0 0 0.24
                      0 0 0 0.5 0" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="hglow-red" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur"/>
            <feColorMatrix in="blur" type="matrix"
              values="0 0 0 0 0.97
                      0 0 0 0 0.44
                      0 0 0 0 0.44
                      0 0 0 0.5 0" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="hglow-purple" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur"/>
            <feColorMatrix in="blur" type="matrix"
              values="0 0 0 0 0.75
                      0 0 0 0 0.52
                      0 0 0 0 0.99
                      0 0 0 0.5 0" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <radialGradient id="bgGrad" cx="50%" cy="45%" r="50%">
            <stop offset="0%" stop-color="#001428" stop-opacity="1"/>
            <stop offset="100%" stop-color="#000810" stop-opacity="1"/>
          </radialGradient>
        </defs>

        <rect width="700" height="660" fill="url(#bgGrad)"/>
        <text x="350" y="20" text-anchor="middle"
          font-family="'IBM Plex Mono', monospace" font-size="16"
          fill="#2c3e50" letter-spacing="3">
          K35+120 · 上台阶 · 炮孔布置图
        </text>

        <g id="g-zoom">
          <g id="diagram-root"></g>
        </g>
      </svg>
      <div class="zoom-reset" id="zoom-reset-btn" title="双击复位">⊡ 复位</div>
    </div>
  </div>
</template>

<script setup>
// @ts-nocheck
import { onMounted } from 'vue'

let blastUpdate        = null
let blastReset         = null
let blastEval          = null
let blastEvalReset     = null
let loadDetectedHoles  = null

onMounted(() => {
  'use strict'

  const RAW = [
    ['blue',938,31],
    ['blue',1015,34],
    ['blue',858.9,34.4],['blue',785.6,44.5],['blue',1084.0,44.6],['blue',712.2,61.4],
    ['blue',1158.6,61.8],['blue',641.1,85.5],['blue',1231.1,85.8],['blue',570.7,114.0],
    ['blue',1299.4,114.0],['blue',938.1,124.2],['blue',1367.7,152.7],['blue',507.3,152.8],
    ['blue',712.9,158.2],['blue',1160.1,158.2],['blue',1429.7,192.3],['blue',441.2,192.5],
    ['blue',1487.1,239.1],['blue',384.8,239.3],['blue',509.1,256.2],['blue',1363.9,256.4],
    ['blue',330.6,292.7],['blue',1543.2,292.8],
    ['orange',938.3,323.1],['orange',768.3,345.9],['orange',1103.7,345.9],
    ['blue',281.7,349.4],['blue',1588.8,349.5],
    ['blue',236.4,409.9],['blue',1634.9,410.1],['blue',345.1,415.4],['blue',1527.9,415.7],
    ['orange',621.2,431.2],['orange',1250.8,431.4],
    ['blue',198.0,476.7],['blue',1672.8,477.3],
    ['orange',479.8,523.4],['orange',1392.0,523.6],['orange',822.8,533.7],['orange',1051.3,533.7],
    ['blue',163.9,545.2],['blue',1707.2,545.7],
    ['blue',134.5,613.2],['blue',232.1,613.3],
    ['orange',611.3,613.3],['orange',1262.0,613.3],
    ['blue',1641.1,613.4],['blue',1740.6,613.5],
    ['orange',366.5,647.4],['orange',1507.5,647.4],
    ['blue',106.2,682.8],['blue',1764.9,683.1],
    ['red',582.4,739.6],
    ['blue',1786.6,756.8],['blue',82.8,756.9],
    ['orange',379.3,785.4],['orange',475.6,785.4],['orange',1396.6,785.4],['orange',1494.0,785.4],
    ['blue',1691.9,795.2],['blue',179.8,795.3],
    ['orange',277.3,796.7],['orange',1594.7,796.7],
    ['red',1153.1,806.7],['red',1294.5,806.9],['red',723.3,808.0],['red',575.8,829.6],
    ['blue',61.4,835.0],['blue',1808.8,835.0],
    ['red',1295.8,893.5],
    ['blue',1825.7,915.1],['blue',48.8,915.2],
    ['red',575.9,920.7],
    ['orange',469.8,921.7],['orange',1403.5,921.7],['orange',362.2,921.9],['orange',1509.8,921.9],
    ['blue',145.7,950.3],['blue',1725.9,950.3],
    ['orange',253.3,954.6],['orange',1618.6,954.6],
    ['red',718.7,961.6],['red',1153.1,961.6],['red',1295.8,978.7],
    ['blue',38.2,994.6],['blue',1833.4,994.6],
    ['red',575.9,1007.2],
    ['orange',1516.6,1056.8],['orange',355.3,1056.9],['orange',464.0,1058.4],['orange',1407.9,1058.4],
    ['red',1296.1,1068.5],
    ['blue',32.5,1074.2],['blue',1839.0,1079.9],
    ['red',576.0,1098.3],
    ['blue',134.4,1109.6],['blue',1739.4,1109.6],
    ['orange',1628.5,1114.0],['orange',243.2,1114.1],
    ['red',718.6,1119.7],['red',1153.0,1119.7],['red',1296.0,1153.7],
    ['blue',1843.5,1155.0],['blue',32.7,1155.2],
    ['red',576.0,1187.7],
    ['orange',355.1,1193.5],['orange',1516.6,1193.6],['orange',1407.7,1194.8],['orange',463.9,1194.9],
    ['blue',1837.9,1234.6],['blue',33.9,1234.7],
    ['red',1296.0,1240.3],
    ['blue',140.0,1268.9],['blue',1731.5,1268.9],
    ['orange',248.9,1271.0],['orange',1622.8,1271.0],
    ['red',718.6,1274.6],['red',1152.9,1274.6],['red',576.0,1279.0],
    ['blue',41.7,1314.4],['blue',1832.2,1314.6],
    ['red',1295.8,1325.7],
    ['orange',360.8,1330.0],['orange',1511.0,1330.1],['orange',468.3,1331.4],['orange',1403.4,1331.4],
    ['red',575.9,1365.4],
    ['blue',1822.0,1393.9],['blue',49.4,1394.0],
    ['red',1295.9,1415.3],
    ['blue',157.1,1426.7],['blue',1716.9,1426.7],
    ['orange',1611.5,1428.0],['orange',260.3,1428.1],
    ['red',718.7,1432.5],['red',1153.2,1432.5],['red',575.8,1456.6],
    ['orange',367.9,1466.7],['orange',1505.4,1466.7],['orange',1402.2,1467.9],['orange',469.7,1468.0],
    ['blue',56.5,1473.6],['blue',1815.0,1473.7],
    ['red',1296.0,1500.7],
    ['red',576.0,1546.1],
    ['blue',66.6,1553.1],['blue',1809.6,1553.2],
    ['blue',1702.1,1586.1],
    ['red',1295.9,1587.3],
    ['orange',271.7,1587.4],
    ['red',718.8,1587.4],['red',1153.1,1587.4],
    ['orange',1600.2,1587.4],
    ['blue',169.8,1591.9],
    ['orange',1499.8,1603.1],['orange',373.5,1603.2],['orange',1397.9,1604.4],['orange',474.1,1604.5],
    ['blue',1799.7,1632.8],['blue',73.6,1633.1],
    ['red',575.9,1637.4],
    ['orange',229.7,1706.5],['orange',1658.2,1712.6],
    ['orange',530.7,1722.7],['orange',1351.3,1722.7],
    ['orange',684.8,1758.1],['orange',1187.1,1758.1],
    ['blue',174.1,1769.4],['blue',1690.7,1775.1],
    ['orange',394.9,1779.7],['orange',1528.1,1780.8],
    ['orange',853.3,1785.2],['orange',1020.8,1785.2],
    ['orange',520.6,1837.6],['orange',1369.4,1842.1],
    ['blue',315.3,1864.9],['blue',1560.5,1864.9],
    ['orange',1198.4,1881.9],['orange',683.6,1885.5],['orange',830.6,1898.9],['orange',1006.0,1898.9],
    ['blue',456.2,1929.0],['blue',1407.7,1931.0],
    ['blue',610.9,1978.9],['blue',1250.6,1979.9],
    ['blue',1092.3,2007.1],['blue',769.3,2007.4],['blue',932.5,2014.5],
  ]

  const X_MIN = 32, X_MAX = 1843.5
  const Y_MIN = 34, Y_MAX = 2014.5
  const MARGIN = 34
  const usableW = 700 - 2 * MARGIN
  const usableH = 660 - 2 * MARGIN
  const scaleX = usableW / (X_MAX - X_MIN)
  const scaleY = usableH / (Y_MAX - Y_MIN)
  const sc = Math.min(scaleX, scaleY)
  const offX = MARGIN + (usableW - (X_MAX - X_MIN) * sc) / 2
  const offY = MARGIN + (usableH - (Y_MAX - Y_MIN) * sc) / 2
  const txC = cx => offX + (cx - X_MIN) * sc
  const tyC = cy => offY + (cy - Y_MIN) * sc

  const aux = [], cut = []
  for (const [color, cx, cy] of RAW) {
    const pt = { x: txC(cx), y: tyC(cy) }
    if      (color === 'orange') aux.push(pt)
    else if (color === 'red')    cut.push(pt)
  }

  const NS   = 'http://www.w3.org/2000/svg'
  const root = document.getElementById('diagram-root')
  function svgEl(tag, attrs, parent) {
    const el = document.createElementNS(NS, tag)
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    ;(parent || root).appendChild(el)
    return el
  }

  const OUTER_CSV = [
    [938,31],
    [1015,34],
    [1084.0,44.6],[1158.6,61.8],[1231.1,85.8],[1299.4,114.0],
    [1367.7,152.7],[1429.7,192.3],[1487.1,239.1],[1543.2,292.8],
    [1588.8,349.5],[1634.9,410.1],[1672.8,477.3],[1707.2,545.7],
    [1740.6,613.5],[1764.9,683.1],[1786.6,756.8],[1808.8,835.0],
    [1825.7,915.1],[1833.4,994.6],[1839.0,1079.9],[1843.5,1155.0],
    [1837.9,1234.6],[1832.2,1314.6],[1822.0,1393.9],[1815.0,1473.7],
    [1809.6,1553.2],[1799.7,1632.8],[1690.7,1775.1],
    [1560.5,1864.9],[1407.7,1931.0],[1250.6,1979.9],[1092.3,2007.1],
    [932.5,2014.5],[769.3,2007.4],[610.9,1978.9],[456.2,1929.0],
    [315.3,1864.9],[174.1,1769.4],[73.6,1633.1],[66.6,1553.1],
    [56.5,1473.6],[49.4,1394.0],[41.7,1314.4],[33.9,1234.7],
    [32.7,1155.2],[32.5,1074.2],[38.2,994.6],[48.8,915.2],
    [61.4,835.0],[82.8,756.9],[106.2,682.8],[134.5,613.2],
    [163.9,545.2],[198.0,476.7],[236.4,409.9],[281.7,349.4],
    [330.6,292.7],
    [384.8,239.3],[441.2,192.5],[507.3,152.8],[570.7,114.0],
    [641.1,85.5],[712.2,61.4],[785.6,44.5],[858.9,34.4],
  ]

  const BOTTOM_KEYS = new Set([
    '73.6,1633.1',
    '174.1,1769.4',
    '315.3,1864.9',
    '1560.5,1864.9','1407.7,1931','1250.6,1979.9','1092.3,2007.1',
    '932.5,2014.5','769.3,2007.4','610.9,1978.9','456.2,1929',
    '1690.7,1775.1',
    '1799.7,1632.8',
  ])
  const OUTER_KEYS = new Set(OUTER_CSV.map(([x, y]) => `${x},${y}`))

  const perimOuterOrig = [], perimBottomOrig = [], innerOrig = []
  for (const [color, cx, cy] of RAW) {
    if (color !== 'blue') continue
    const key = `${cx},${cy}`
    const pt  = { x: txC(cx), y: tyC(cy) }
    if      (BOTTOM_KEYS.has(key)) perimBottomOrig.push(pt)
    else if (OUTER_KEYS.has(key))  perimOuterOrig.push(pt)
    else                           innerOrig.push(pt)
  }

  const PERIM_HALF_CSV = [
    [938,31],
    [1015,34],[1084.0,44.6],[1158.6,61.8],[1231.1,85.8],[1299.4,114.0],
    [1367.7,152.7],[1429.7,192.3],[1487.1,239.1],[1543.2,292.8],
    [1588.8,349.5],[1634.9,410.1],[1672.8,477.3],[1707.2,545.7],
    [1740.6,613.5],[1764.9,683.1],[1786.6,756.8],[1808.8,835.0],
    [1825.7,915.1],[1833.4,994.6],[1839.0,1079.9],[1843.5,1155.0],
    [1837.9,1234.6],[1832.2,1314.6],[1822.0,1393.9],[1815.0,1473.7],
    [1809.6,1553.2],
  ]
  const INNER_HALF_CSV = [
    [938.1,124.2],
    [1160.1,158.2],[1363.9,256.4],[1527.9,415.7],[1641.1,613.4],
    [1691.9,795.2],[1725.9,950.3],[1739.4,1109.6],[1731.5,1268.9],
    [1716.9,1426.7],[1702.1,1586.1],
  ]
  const CX_SVG = txC(938)

  function smoothPath(pts) {
    const n = pts.length
    let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n]
      const p1 = pts[i]
      const p2 = pts[(i + 1) % n]
      const p3 = pts[(i + 2) % n]
      const cp1x = p1.x + (p2.x - p0.x) / 6
      const cp1y = p1.y + (p2.y - p0.y) / 6
      const cp2x = p2.x - (p3.x - p1.x) / 6
      const cp2y = p2.y - (p3.y - p1.y) / 6
      d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
    }
    return d + ' Z'
  }

  function buildArc(csvPts) {
    const pts = csvPts.map(([cx, cy]) => ({ x: txC(cx), y: tyC(cy) }))
    const arcs = [0]
    for (let i = 1; i < pts.length; i++)
      arcs.push(arcs[i-1] + Math.hypot(pts[i].x - pts[i-1].x, pts[i].y - pts[i-1].y))
    return { pts, arcs, L: arcs[arcs.length - 1] }
  }
  function interpArc({ pts, arcs, L }, t) {
    const d = Math.max(0, Math.min(1, t)) * L
    let i = 1
    while (i < arcs.length - 1 && arcs[i] < d) i++
    const seg = arcs[i] - arcs[i-1]
    const f   = seg < 1e-9 ? 0 : (d - arcs[i-1]) / seg
    return { x: pts[i-1].x + f * (pts[i].x - pts[i-1].x),
             y: pts[i-1].y + f * (pts[i].y - pts[i-1].y) }
  }
  function distributeSymmetric(halfCsvPts, N) {
    if (N <= 0) return []
    const path = buildArc(halfCsvPts)
    const res  = []
    const k    = Math.floor(N / 2)
    if (N % 2 === 1) res.push({ ...path.pts[0] })
    for (let i = 0; i < k; i++) {
      const t  = 1 - (i + 0.5) * 2 / N
      const pt = interpArc(path, t)
      res.push(pt)
      res.push({ x: 2 * CX_SVG - pt.x, y: pt.y })
    }
    return res
  }

  const gBlast = svgEl('g', { id: 'g-blast' })
  const M_TO_SVG = (X_MAX - X_MIN) * sc / 10.25

  blastEval = function(avgM) {
    clearGroup(gBlast)

    const outerPts = OUTER_CSV.map(([cx, cy]) => ({ x: txC(cx), y: tyC(cy) }))
    const n = outerPts.length

    let idxBR = -1, idxBL = -1
    OUTER_CSV.forEach(([cx, cy], i) => {
      if (cx === 1799.7 && Math.abs(cy - 1632.8) < 0.5) idxBR = i
      if (cx === 73.6   && Math.abs(cy - 1633.1) < 0.5) idxBL = i
    })

    let sumX = 0, sumY = 0
    outerPts.forEach(p => { sumX += p.x; sumY += p.y })
    const cen = { x: sumX / n, y: sumY / n }

    let seed = 31
    function rng() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000 }

    const baseOff = Array.from({ length: n }, () => avgM + (rng() - 0.5) * 0.10)
    for (let p = 0; p < 2; p++)
      for (let i = 0; i < n; i++)
        baseOff[i] = (baseOff[(i-1+n)%n] + baseOff[i] * 2 + baseOff[(i+1)%n]) / 4

    const SUBDIV = 9
    const densePts = []

    function addSeg(i, kStart) {
      const p0 = outerPts[i], p1 = outerPts[(i + 1) % n]
      const v0 = baseOff[i],  v1 = baseOff[(i + 1) % n]
      for (let k = kStart; k < SUBDIV; k++) {
        const t  = k / SUBDIV
        const cx = p0.x + (p1.x - p0.x) * t
        const cy = p0.y + (p1.y - p0.y) * t
        const base   = v0 + (v1 - v0) * t
        const jitter = (rng() - 0.5) * 0.07 + (rng() - 0.5) * 0.03
        const v  = Math.max(0.07, Math.min(0.27, base + jitter))
        const dx = cx - cen.x, dy = cy - cen.y
        const len = Math.hypot(dx, dy) || 1
        const d  = v * M_TO_SVG
        densePts.push({ x: cx + dx / len * d, y: cy + dy / len * d, cx, cy, v, bot: false })
      }
    }

    for (let i = 0; i < idxBR; i++) addSeg(i, 0)
    densePts.push({ x: outerPts[idxBR].x, y: outerPts[idxBR].y, v: 0, bot: true })
    densePts.push({ x: outerPts[idxBL].x, y: outerPts[idxBL].y, v: 0, bot: true })
    for (let i = idxBL; i < n; i++) addSeg(i, i === idxBL ? 1 : 0)

    const m = densePts.length
    let pathD = `M ${densePts[0].x.toFixed(1)},${densePts[0].y.toFixed(1)}`
    for (let i = 1; i < m; i++)
      pathD += ` L ${densePts[i].x.toFixed(1)},${densePts[i].y.toFixed(1)}`
    pathD += ' Z'
    svgEl('path', { d: pathD, fill: 'rgba(210,50,50,0.14)', stroke: 'none' }, gBlast)
    svgEl('path', { d: pathD, fill: 'none', stroke: '#e84040',
      'stroke-width': '0.7', opacity: '0.80' }, gBlast)

    const gLbl = svgEl('g', {
      'font-family': "'IBM Plex Mono',monospace",
      'font-size': '4.8', fill: '#fde047', opacity: '0.95'
    }, gBlast)

    densePts.forEach((dp, i) => {
      if (dp.bot || i % 3 !== 0) return
      const rdx = dp.cx - cen.x, rdy = dp.cy - cen.y
      const rlen = Math.hypot(rdx, rdy) || 1
      let ang = Math.atan2(rdy, rdx) * 180 / Math.PI
      if (ang >  90) ang -= 180
      if (ang < -90) ang += 180
      const lx = dp.x + rdx / rlen * 7
      const ly = dp.y + rdy / rlen * 7
      const el = svgEl('text', {
        x: lx.toFixed(1), y: ly.toFixed(1),
        'text-anchor': 'middle', 'dominant-baseline': 'middle',
        transform: `rotate(${ang.toFixed(1)},${lx.toFixed(1)},${ly.toFixed(1)})`
      }, gLbl)
      el.textContent = dp.v.toFixed(3)
    })
  }

  blastEvalReset = function() { clearGroup(gBlast) }

  const contourPts = OUTER_CSV.map(([cx, cy]) => ({ x: txC(cx), y: tyC(cy) }))
  svgEl('path', {
    d: smoothPath(contourPts),
    fill: 'none', stroke: '#34d399',
    'stroke-width': '1.5', 'stroke-dasharray': '9 5', opacity: '0.5'
  })

  const axX  = txC(938).toFixed(1)
  const topY = tyC(Y_MIN) - 4
  const botY = tyC(Y_MAX) + 4
  svgEl('line', {
    x1: axX, y1: topY, x2: axX, y2: botY,
    stroke: '#1a2a3a', 'stroke-width': '0.6', 'stroke-dasharray': '4 6'
  })

  function renderHoles(holes, grp, fill, stroke) {
    for (const h of holes) {
      svgEl('circle', {
        cx: h.x.toFixed(1), cy: h.y.toFixed(1),
        r: '5', fill, stroke, 'stroke-width': '1',
        filter: 'url(#hglow)'
      }, grp)
    }
  }

  const gAux         = svgEl('g', { id: 'g-aux' })
  const gCut         = svgEl('g', { id: 'g-cut' })
  const gPerimBottom = svgEl('g', { id: 'g-perim-bottom' })
  const gInner       = svgEl('g', { id: 'g-inner' })
  const gPerimOuter  = svgEl('g', { id: 'g-perim-outer' })

  const BF = '#00eaff', BS = '#005580'
  const PF = '#c084fc', PS = '#6b21a8'
  function renderBlue(holes, grp) { renderHoles(holes, grp, BF, BS) }
  function clearGroup(grp) { while (grp.firstChild) grp.removeChild(grp.firstChild) }

  // ── 导入图片检测结果图层 ──────────────────────────────
  const gImported = svgEl('g', { id: 'g-imported', opacity: '0.95' })
  const IMPORT_COLOR_MAP = {
    blue:   { fill: '#00eaff', stroke: '#005580', filter: 'url(#hglow)' },
    orange: { fill: '#fb923c', stroke: '#7a3a0a', filter: 'url(#hglow-orange)' },
    red:    { fill: '#f87171', stroke: '#7a1a1a', filter: 'url(#hglow-red)' },
    purple: { fill: '#c084fc', stroke: '#6b21a8', filter: 'url(#hglow-purple)' },
  }
  loadDetectedHoles = function(holes) {
    clearGroup(gImported)
    for (const h of holes) {
      const style = IMPORT_COLOR_MAP[h.color] ?? IMPORT_COLOR_MAP.blue
      svgEl('circle', {
        cx: h.x.toFixed(1), cy: h.y.toFixed(1),
        r: '5', fill: style.fill, stroke: style.stroke,
        'stroke-width': '1', filter: style.filter,
      }, gImported)
    }
  }

  // 初始渲染设计孔位（二维效果图），导入图片后叠加显示
  renderHoles(aux,             gAux,         '#fb923c', '#7a3a0a')
  renderHoles(cut,             gCut,         '#f87171', '#7a1a1a')
  renderHoles(perimBottomOrig, gPerimBottom, PF, PS)
  renderBlue(innerOrig,        gInner)
  renderBlue(perimOuterOrig,   gPerimOuter)

  const N = n => `<span style="color:#fde047;font-weight:600">${n}</span>`
  function updateInfo(po, io) {
    const total = po + io + perimBottomOrig.length + aux.length + cut.length
    const tbInfo = document.getElementById('tb-info')
    const sbCounts = document.getElementById('sb-counts')
    if (tbInfo) tbInfo.innerHTML =
      `周边孔 ${N(po)}  ·  内圈孔 ${N(io)}  ·  辅助孔 ${N(aux.length)}  ·  掏槽孔 ${N(cut.length)}  ·  合计 ${N(total)} 个`
    if (sbCounts) sbCounts.textContent = `总孔数: ${total}  ·  φ42 × 3.5m`
  }

  blastUpdate = function(perimN, innerN) {
    if (perimN !== null) {
      clearGroup(gPerimOuter)
      if (perimN === perimOuterOrig.length) {
        renderBlue(perimOuterOrig, gPerimOuter)
      } else {
        renderBlue(distributeSymmetric(PERIM_HALF_CSV, perimN), gPerimOuter)
      }
    }
    if (innerN !== null) {
      clearGroup(gInner)
      if (innerN === innerOrig.length) {
        renderBlue(innerOrig, gInner)
      } else {
        renderBlue(distributeSymmetric(INNER_HALF_CSV, innerN), gInner)
      }
    }
    const po = perimN !== null ? perimN : perimOuterOrig.length
    const io = innerN !== null ? innerN : innerOrig.length
    updateInfo(po, io)
  }

  blastReset = function() {
    clearGroup(gPerimOuter); renderBlue(perimOuterOrig, gPerimOuter)
    clearGroup(gInner);      renderBlue(innerOrig,      gInner)
    updateInfo(perimOuterOrig.length, innerOrig.length)
  }

  // 初始化工具栏孔数统计
  updateInfo(perimOuterOrig.length, innerOrig.length)

  const SBW = Math.round((1843.5 - 32) * sc / 10.25)
  const SBX = 34, SBY = 636
  const sbg = svgEl('g', { transform: `translate(${SBX},${SBY})` })
  svgEl('line', { x1:0,y1:0,x2:SBW,y2:0, stroke:'#2c3e50','stroke-width':'1.5' }, sbg)
  svgEl('line', { x1:0,y1:-5,x2:0,y2:5, stroke:'#2c3e50','stroke-width':'1.5' }, sbg)
  svgEl('line', { x1:SBW,y1:-5,x2:SBW,y2:5, stroke:'#2c3e50','stroke-width':'1.5' }, sbg)
  const sbTxt = svgEl('text', {
    x: SBW/2, y: 14, 'text-anchor':'middle',
    fill:'#2c3e50','font-size':'9',
    'font-family':"'IBM Plex Mono',monospace",'letter-spacing':'1'
  }, sbg)
  sbTxt.textContent = '1.0 m'

  const legendItems = [
    { fill:'#00eaff', label:'周边孔', x:580, y:20 },
    { fill:'#c084fc', label:'底板孔', x:580, y:36 },
    { fill:'#fb923c', label:'辅助孔', x:580, y:52 },
    { fill:'#f87171', label:'掏槽孔', x:580, y:68 },
  ]
  const lg = svgEl('g', { id: 'g-legend', opacity:'0.75' })
  for (const li of legendItems) {
    svgEl('circle', { cx: li.x, cy: li.y - 3.5, r:'4',
      fill: li.fill, filter:'url(#hglow)' }, lg)
    const t = svgEl('text', {
      x: li.x + 10, y: li.y,
      fill:'rgba(0,200,255,0.5)', 'font-size':'9',
      'font-family':"'IBM Plex Mono',monospace"
    }, lg)
    t.textContent = li.label
  }

  svgEl('rect', {
    x:2, y:2, width:696, height:656,
    fill:'none', stroke:'#101c2b', 'stroke-width':'1.5'
  })

  const svg    = document.getElementById('blast-svg')
  const gZoom  = document.getElementById('g-zoom')
  const canvas = document.querySelector('.canvas-scroll')
  const resetBtn = document.getElementById('zoom-reset-btn')

  let s = 1, panTx = 0, panTy = 0
  let pan = null
  const VW = 700, VH = 660

  function applyZoom() {
    gZoom.setAttribute('transform',
      `translate(${panTx.toFixed(3)},${panTy.toFixed(3)}) scale(${s.toFixed(5)})`)
  }

  function svgPt(clientX, clientY) {
    const r = svg.getBoundingClientRect()
    return {
      x: (clientX - r.left) / r.width  * VW,
      y: (clientY - r.top)  / r.height * VH
    }
  }

  canvas.addEventListener('wheel', e => {
    e.preventDefault()
    const mp   = svgPt(e.clientX, e.clientY)
    const factor = e.deltaY < 0 ? 1.13 : 1 / 1.13
    const ns   = Math.min(Math.max(s * factor, 0.12), 12)
    const r    = ns / s
    panTx = mp.x - (mp.x - panTx) * r
    panTy = mp.y - (mp.y - panTy) * r
    s  = ns
    applyZoom()
  }, { passive: false })

  svg.addEventListener('mousedown', e => {
    if (e.button !== 0) return
    pan = { cx: e.clientX, cy: e.clientY, tx: panTx, ty: panTy }
    canvas.classList.add('panning')
  })
  document.addEventListener('mousemove', e => {
    if (!pan) return
    const r = svg.getBoundingClientRect()
    panTx = pan.tx + (e.clientX - pan.cx) / r.width  * VW
    panTy = pan.ty + (e.clientY - pan.cy) / r.height * VH
    applyZoom()
  })
  document.addEventListener('mouseup', () => {
    pan = null
    canvas.classList.remove('panning')
  })

  let touches = {}
  svg.addEventListener('touchstart', e => {
    e.preventDefault()
    Array.from(e.changedTouches).forEach(t => { touches[t.identifier] = t })
  }, { passive: false })
  svg.addEventListener('touchmove', e => {
    e.preventDefault()
    const ids = Object.keys(touches)
    if (ids.length === 1) {
      const old = touches[ids[0]]
      const cur = e.changedTouches[0]
      const r   = svg.getBoundingClientRect()
      panTx += (cur.clientX - old.clientX) / r.width  * VW
      panTy += (cur.clientY - old.clientY) / r.height * VH
      touches[cur.identifier] = cur
      applyZoom()
    } else if (ids.length >= 2) {
      const pts = Array.from(e.changedTouches).slice(0, 2)
      const old = [touches[pts[0].identifier], touches[pts[1].identifier]]
      if (!old[0] || !old[1]) return
      const r   = svg.getBoundingClientRect()
      const toSvg = t => ({ x:(t.clientX-r.left)/r.width*VW, y:(t.clientY-r.top)/r.height*VH })
      const o0 = toSvg(old[0]), o1 = toSvg(old[1])
      const n0 = toSvg(pts[0]), n1 = toSvg(pts[1])
      const oldDist = Math.hypot(o1.x-o0.x, o1.y-o0.y)
      const newDist = Math.hypot(n1.x-n0.x, n1.y-n0.y)
      if (oldDist < 1) return
      const factor = newDist / oldDist
      const mid = { x:(n0.x+n1.x)/2, y:(n0.y+n1.y)/2 }
      s  = Math.min(Math.max(s * factor, 0.12), 12)
      panTx = mid.x - (mid.x - panTx) * factor
      panTy = mid.y - (mid.y - panTy) * factor
      pts.forEach(t => { touches[t.identifier] = t })
      applyZoom()
    }
  }, { passive: false })
  svg.addEventListener('touchend', e => {
    Array.from(e.changedTouches).forEach(t => { delete touches[t.identifier] })
  })

  function resetZoom() { s = 1; panTx = 0; panTy = 0; applyZoom() }
  resetBtn.addEventListener('click', resetZoom)
  svg.addEventListener('dblclick', resetZoom)
})

defineExpose({
  blastUpdate:        (...args) => blastUpdate       && blastUpdate(...args),
  blastReset:         ()        => blastReset        && blastReset(),
  blastEval:          (...args) => blastEval         && blastEval(...args),
  blastEvalReset:     ()        => blastEvalReset    && blastEvalReset(),
  loadDetectedHoles:  (...args) => loadDetectedHoles && loadDetectedHoles(...args),
})
</script>

<style scoped lang="scss">
.canvas-wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: transparent;
  overflow: hidden;
}

.canvas-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  background: rgba(0, 8, 20, 0.92);
  border-bottom: 1px solid rgba(0, 150, 255, 0.18);
  flex-shrink: 0;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
}

.tb-label {
  color: rgba(0, 200, 255, 0.75);
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.tb-sep {
  width: 1px;
  height: 14px;
  background: rgba(0, 150, 255, 0.25);
  flex-shrink: 0;
}

.legend {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: rgba(180, 220, 255, 0.45);
  white-space: nowrap;
}

.legend-circle {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  border: 1.5px solid rgba(0, 200, 255, 0.6);
  background: transparent;
  flex-shrink: 0;
}

.legend-line {
  width: 14px;
  height: 0;
  border-top: 2px dashed rgba(52, 211, 153, 0.55);
  flex-shrink: 0;
}

.tb-right {
  margin-left: auto;
  font-size: 10px;
  color: rgba(0, 200, 255, 0.5);
  white-space: nowrap;
}

.canvas-scroll {
  flex: 1;
  overflow: hidden;
  position: relative;
  cursor: grab;
  min-height: 0;

  &.panning { cursor: grabbing; }

  svg {
    width: 100%;
    height: 100%;
    display: block;
  }
}

.zoom-reset {
  position: absolute;
  bottom: 8px;
  right: 8px;
  padding: 3px 10px;
  background: rgba(0, 15, 40, 0.82);
  border: 1px solid rgba(0, 150, 255, 0.28);
  border-radius: 3px;
  color: rgba(0, 200, 255, 0.55);
  font-size: 10px;
  cursor: pointer;
  font-family: 'IBM Plex Mono', monospace;
  transition: all 0.15s;
  user-select: none;

  &:hover {
    background: rgba(0, 50, 120, 0.85);
    color: #00eaff;
    border-color: rgba(0, 200, 255, 0.5);
  }
}
</style>
