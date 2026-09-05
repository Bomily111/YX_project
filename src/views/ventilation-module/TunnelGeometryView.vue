<template>
  <section class="tunnel-geometry" :class="{ compact }">
    <div class="legend-row">
      <span><i style="background:#4da6ff"></i>风筒</span>
      <span><i class="built"></i>已建成</span>
      <span><i style="background:#4e342e"></i>设计·钻爆</span>
      <span><i style="background:#1e4a2e"></i>设计·TBM</span>
      <span><i style="background:#e53935"></i>工作面</span>
      <span><i style="background:#c58af9"></i>横通道</span>
      <span><i style="background:#ffa726"></i>风机站</span>
      <span class="jet-legend">⌀ 射流风机</span>
    </div>

    <div class="svg-wrap">
      <svg viewBox="0 0 1050 480" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="三管隧道二维几何模型">
        <defs>
          <pattern id="vent-p-drill" width="14" height="14" patternUnits="userSpaceOnUse">
            <rect width="14" height="14" fill="#3e2723"/><rect width="7" height="7" fill="#4e342e"/>
          </pattern>
          <pattern id="vent-p-tbm" width="12" height="12" patternUnits="userSpaceOnUse">
            <rect width="12" height="12" fill="#1b3a2a"/><rect width="6" height="6" fill="#1e4a2e"/>
          </pattern>
          <filter id="vent-glow"><feGaussianBlur stdDeviation="2"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>

        <g class="chainage-axis">
          <template v-for="z in ticks" :key="z">
            <line :x1="cx(z)" :x2="cx(z)" y1="20" y2="455" :stroke-width="z % 1000 === 0 ? .8 : .3"/>
            <text v-if="z % 1000 === 0" :x="cx(z)" y="17">K{{ z / 1000 }}+000</text>
          </template>
        </g>

        <!-- 左主洞 -->
        <g>
          <text class="tunnel-label" x="123" y="129">左主洞</text>
          <rect :x="cx(0)" y="100" :width="cx(4000)-cx(0)" height="50" rx="5" class="built-tunnel"/>
          <rect :x="cx(4000)" y="100" :width="cx(6800)-cx(4000)" height="50" rx="5" class="design-outline"/>
          <rect :x="cx(4000)" y="104" :width="cx(6800)-cx(4000)" height="42" rx="3" fill="url(#vent-p-tbm)"/>
          <text class="zone-label" :x="(cx(4000)+cx(6800))/2" y="129">设计段 TBM</text>
          <polygon :points="facePoints(4000,100,150)" class="face tbm-face"/>
          <rect :x="cx(4000)-1.5" y="100" width="4" height="50" rx="1" class="face-bar tbm-face"/>
          <text class="face-text tbm-text" :x="cx(4000)-10" y="92">TBM工作面</text>
          <rect :x="cx(0)" :y="125-2.6*4" :width="cx(3940)-cx(0)" :height="2.6*8" rx="4" class="duct"/>
          <text class="duct-label" :x="(cx(0)+cx(3940))/2" y="129">JK-2　Φ2.6m</text>
          <template v-for="z in jetFans" :key="z"><circle :cx="cx(z)" cy="145" r="4" class="jet-fan"/></template>
          <text class="fan-note" :x="cx(500)" y="174">射流风机 ×7</text>
        </g>

        <!-- 右主洞及 DDK 共用段 -->
        <g>
          <text class="tunnel-label" x="123" y="249">右主洞</text>
          <rect :x="cx(0)" y="220" :width="cx(2300)-cx(0)" height="50" rx="5" class="built-tunnel"/>
          <rect :x="cx(2300)" y="220" :width="cx(7800)-cx(2300)" height="50" rx="5" class="design-outline"/>
          <rect :x="cx(6800)" y="224" :width="cx(7800)-cx(6800)" height="42" rx="3" fill="url(#vent-p-tbm)"/>
          <text class="zone-label" :x="(cx(6800)+cx(7800))/2" y="249">设计段 TBM</text>
          <rect :x="cx(2300)" y="220" :width="cx(6800)-cx(2300)" height="14" fill="url(#vent-p-drill)"/>
          <rect :x="cx(2300)" y="256" :width="cx(6800)-cx(2300)" height="14" fill="url(#vent-p-drill)"/>
          <rect :x="cx(2300)" y="234" :width="cx(6800)-cx(2300)" height="22" fill="#1b3240" opacity=".7"/>
          <polygon :points="facePoints(2300,220,270)" class="face drill-face"/>
          <rect :x="cx(2300)-1.5" y="220" width="4" height="50" rx="1" class="face-bar drill-face"/>
          <text class="face-text drill-text" :x="cx(2300)-10" y="212">钻爆工作面</text>
          <polygon :points="facePoints(6800,220,270)" class="face tbm-face"/>
          <rect :x="cx(6800)-1.5" y="220" width="4" height="50" rx="1" class="face-bar tbm-face"/>
          <text class="face-text tbm-text" :x="cx(6800)-10" y="212">TBM工作面</text>
          <rect :x="cx(0)" :y="245-2.4*4" :width="cx(2240)-cx(0)" :height="2.4*8" rx="4" class="duct"/>
          <text class="duct-label" :x="(cx(0)+cx(2240))/2" y="249">JK-3　Φ2.4m</text>
        </g>

        <!-- DDK 斜向接入、转折及共用风筒 -->
        <g>
          <text class="ddk-label" :x="cx(1050)-18" y="334">DDK 探洞</text>
          <polygon :points="ddkTunnelPoints" class="ddk-envelope"/>
          <text class="portal-text" x="123" y="330">洞口</text>
          <polygon :points="ddkDuctPoints" class="ddk-duct"/>
          <text class="duct-label" :x="(cx(2350)+cx(6770))/2" y="249">JK-1　Φ1.5m</text>
          <polygon :points="`${cx(2370)},280 ${cx(2370)-7},272 ${cx(2370)+7},272`" fill="#ff6d00"/>
        </g>

        <!-- 横通道 -->
        <g v-for="(z,index) in crossPassages" :key="z">
          <rect :x="cx(z)-3.5" y="150" width="7" height="70" rx="2"
            :fill="index === 0 ? '#5a4a8a' : 'url(#vent-p-drill)'" :opacity="index === 0 ? .8 : .85"
            :stroke="index === 0 ? '#8e7fc4' : '#8e6fc4'"/>
        </g>

        <!-- YS 2# 的 D线与 A线 -->
        <g>
          <rect :x="cx(4000)-3.5" y="45" width="7" height="55" rx="2" class="shaft-line"/>
          <text class="shaft-label" :x="cx(4000)+7" y="77">D线 钻爆 (YS 2#)</text>
          <rect :x="cx(4000)-3.5" y="270" width="7" height="55" rx="2" class="shaft-line"/>
          <text class="shaft-label" :x="cx(4000)+7" y="302">A线 钻爆 (YS 2#)</text>
        </g>

        <!-- 标准断面 -->
        <g class="section-shape">
          <rect x="900" y="395" width="60" height="50" rx="4"/>
          <path d="M918,437 A12,12 0 0,1 942,437 L942,411 A12,12 0 0,0 918,411 Z"/>
          <text x="930" y="405">马蹄形</text><text x="930" y="417">9m×7.66m</text><text x="930" y="429">A=58.5m²</text>
        </g>
      </svg>
    </div>
  </section>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

const ML = 135
const PLOT_WIDTH = 875
const TOTAL_LEN = 8200
const cx = (z: number) => ML + z / TOTAL_LEN * PLOT_WIDTH
const ticks = Array.from({ length: 17 }, (_, i) => i * 500)
const jetFans = Array.from({ length: 7 }, (_, i) => 500 + i * 500)
const crossPassages = [2300, 4000, 5400, 6800]

function facePoints(z: number, y1: number, y2: number) {
  const x = cx(z); const teeth = 5; const toothW = 8; const toothH = (y2-y1)/(teeth*2-1)
  const points: string[] = []
  for (let i=0;i<teeth;i++) {
    const y = y1+i*toothH*2
    points.push(`${x},${y}`, `${x-toothW},${y+toothH}`)
  }
  points.push(`${x},${y2}`)
  return points.join(' ')
}

const xP=cx(1050), xDrop=cx(2350), xM=cx(2370), xDE=cx(6770)
const ddkH=30, pad=4, polyH=ddkH+pad*2
const portalTop=315, mergeTop=242, approachEnd=257
const ddkTunnelPoints = [
  [xP-20,portalTop-pad],[xDrop-4,approachEnd-pad],[xDrop-4,mergeTop-pad],[xM+pad,mergeTop-pad],
  [xM+pad,mergeTop-pad+polyH],[xDrop-4+polyH,mergeTop-pad+polyH],
  [xDrop-4+polyH,approachEnd-pad+polyH],[xP-20+polyH,portalTop-pad+polyH],
].map(p=>p.join(',')).join(' ')
const ductH=1.5*5.5, fanLeft=xP-8, centerY=portalTop+ddkH/2, centerEnd=approachEnd+ddkH/2, centerMerge=245, ductEnd=xDE-4
const ddkDuctPoints = [
  [fanLeft,centerY-ductH/2],[xDrop-4,centerEnd-ductH/2],[xDrop-4,centerMerge-ductH/2],[ductEnd,centerMerge-ductH/2],
  [ductEnd,centerMerge+ductH/2],[xDrop-4+ductH,centerMerge+ductH/2],
  [xDrop-4+ductH,centerEnd+ductH/2],[fanLeft+ductH,centerY+ductH/2],
].map(p=>p.join(',')).join(' ')
</script>

<style scoped>
.tunnel-geometry{position:absolute;inset:0;background:#0f1a26;display:flex;flex-direction:column;overflow:hidden}
.legend-row{display:flex;gap:14px;align-items:center;min-height:42px;padding:0 20px;border-bottom:1px solid #1a2a3a;flex-wrap:wrap;flex-shrink:0;font-size:11px;color:#6a8aaa}
.legend-row span{white-space:nowrap}.legend-row i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:4px;vertical-align:middle}
.legend-row .built{background:#1b3240;border:1px solid #2d5060}.jet-legend{margin-left:auto;font-size:10px;color:#5a7a9a}
.svg-wrap{flex:1;overflow:auto}svg{width:100%;min-height:480px}
.chainage-axis line{stroke:#1a2a3a}.chainage-axis text{fill:#5a7a9a;font-size:9px;font-weight:700;text-anchor:middle}
.tunnel-label{fill:#c0d8f0;font-size:12px;font-weight:600;text-anchor:end}.ddk-label{fill:#c0d8f0;font-size:10px;font-weight:600;text-anchor:end}
.built-tunnel{fill:#1b3240;stroke:#2d5060;stroke-width:2}.design-outline{fill:#152432;stroke:#5a7a9a;stroke-width:1.5;stroke-dasharray:8 5}
.zone-label{fill:#ccc;font-size:8px;font-weight:700;text-anchor:middle}.face{fill:none;stroke-width:3;stroke-linejoin:round;filter:url(#vent-glow)}
.face-bar{filter:url(#vent-glow)}.tbm-face{stroke:#ff8c42;fill:#ff8c42}.face.tbm-face{fill:none}.drill-face{stroke:#ff1744;fill:#ff1744}.face.drill-face{fill:none}
.face-text{font-size:8px;font-weight:700;text-anchor:end}.tbm-text{fill:#ff8c42}.drill-text{fill:#ff1744}
.duct,.ddk-duct{fill:#1565c0;opacity:.8;stroke:#e65100;stroke-width:1.5}.ddk-duct{stroke-width:1.2}.duct-label{fill:#fff;font-size:7.5px;font-weight:700;text-anchor:middle}
.jet-fan{fill:#ff9800;stroke:#fff;stroke-width:.5}.fan-note{fill:#ffa726;font-size:7px;font-weight:700}
.ddk-envelope{fill:#1b3240;fill-opacity:.45;stroke:#2d5060;stroke-opacity:.5;stroke-width:1.5;stroke-dasharray:6 3}.portal-text{fill:#ffa726;fill-opacity:.5;font-size:8px;font-weight:700;text-anchor:end}
.shaft-line{fill:url(#vent-p-drill);stroke:#8e6fc4;stroke-width:1.5}.shaft-label{fill:#c58af9;font-size:8px;font-weight:700}
.section-shape rect{fill:#152432;stroke:#2a3a4a}.section-shape path{fill:none;stroke:#78909c;stroke-width:1.5}.section-shape text{fill:#78909c;font-size:8px;text-anchor:middle}
.tunnel-geometry.compact{position:relative;inset:auto;width:100%;height:178px;background:#091722;pointer-events:none}
.compact .legend-row{display:none}.compact .svg-wrap{height:100%;overflow:hidden}.compact svg{width:100%;height:100%;min-height:0}
</style>
