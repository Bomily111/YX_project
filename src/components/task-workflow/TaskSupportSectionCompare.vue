<template>
  <details v-if="comparison.envelopes.length" data-testid="support-section-comparison" class="section-compare">
    <summary>断面范围对照 · 非净空检查</summary>
    <svg viewBox="0 0 240 210" role="img" aria-label="隧道源轮廓与支护源包围范围，等比例对照">
      <line :x1="x(extent.minX)" :x2="x(extent.maxX)" :y1="y(0)" :y2="y(0)" stroke="#506f83" stroke-dasharray="3 3"/>
      <polygon :points="comparison.outline.map(p=>`${x(p[0]!)},${y(p[1]!)}`).join(' ')" fill="#00c9ef18" stroke="#54daef" stroke-width="1.8"/>
      <rect v-for="(e,i) in comparison.envelopes" :key="e.component" :x="x(e.bounds.minX)" :y="y(e.bounds.maxY)" :width="(e.bounds.maxX-e.bounds.minX)*scale" :height="(e.bounds.maxY-e.bounds.minY)*scale" fill="none" :stroke="i?'#d8a6f0':'#efc16a'" stroke-dasharray="5 3"/>
      <text x="8" y="204">源底板为零基准 · 等比例 · 单位m</text>
    </svg>
    <small>青色为隧道源法向轮廓；虚线仅为支护源包围范围，不是支护内外轮廓。</small>
    <small>支护局部0高程对齐隧道源底板；构件包围范围可低于底板，不代表侵限。</small>
    <p v-for="e in comparison.envelopes" :key="e.component">{{ e.component==='primary_concrete'?'初支混凝土':'二次衬砌' }}：总宽差 {{ signed(e.widthDifferenceM) }}m，总高差 {{ signed(e.heightDifferenceM) }}m。</p>
    <small>{{ comparison.note }} 参考位置为测试断面后方0.5m，非目标工段实测。</small>
  </details>
</template>
<script setup lang="ts">
import {computed} from 'vue'
import {supportSectionComparison,type SectionBounds} from '@/modules/support/section-comparison'
const props=defineProps<{groups:{component:string;sourceBoundsXY?:SectionBounds}[]}>()
const comparison=computed(()=>supportSectionComparison(props.groups))
const extent=computed(()=>{
 const boxes=[comparison.value.tunnel,...comparison.value.envelopes.map(e=>e.bounds)]
 return {minX:Math.min(...boxes.map(b=>b.minX)),maxX:Math.max(...boxes.map(b=>b.maxX)),minY:Math.min(...boxes.map(b=>b.minY)),maxY:Math.max(...boxes.map(b=>b.maxY))}
})
const scale=computed(()=>Math.min(216/(extent.value.maxX-extent.value.minX),172/(extent.value.maxY-extent.value.minY)))
const x=(value:number)=>120+(value-(extent.value.minX+extent.value.maxX)/2)*scale.value
const y=(value:number)=>188-(value-extent.value.minY)*scale.value
const signed=(value:number)=>(value>=0?'+':'')+value.toFixed(2)
</script>
<style scoped>
.section-compare{margin-top:10px;padding-top:8px;border-top:1px solid #18435a}summary{cursor:pointer;color:#8be3f0}svg{display:block;width:100%;background:#061f30;margin-top:8px;border-radius:4px}text{fill:#91b4c7;font-size:10px}small{display:block;color:#91b4c7;font-size:11px;line-height:1.5;margin:7px 0}p{font-size:12px;line-height:1.5}
</style>
