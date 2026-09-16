<template>
  <div class="td-root">
    <section class="td-section">
      <div class="td-title">三维预测成果</div>
      <div class="td-types">
        <button
          v-for="item in resultTypes"
          :key="item.key"
          type="button"
          :class="{ active: selected && activeType === item.key }"
          :disabled="!metadata"
          @click="selectType(item.key)"
        >
          <i>{{ item.icon }}</i>
          <span><b>{{ item.label }}</b><small>{{ item.description }}</small></span>
        </button>
      </div>
      <div class="td-hint">点击成果按钮切换 TEM 三维体素层或 570 Ω·m 等值面，隧道实体继续保留。</div>
      <div v-if="metadata" class="td-meta-strip">
        <span>{{ metadata.shape.join(' × ') }} 体素</span>
        <span>{{ voxelResolution }}</span>
        <span>{{ activeValueRange }}</span>
      </div>
      <div v-if="activeType !== 'isosurface'" class="td-controls">
        <label class="td-opacity-control"><span>透明度 <b>{{ Math.round(opacity * 100) }}%</b></span><input v-model.number="opacity" :disabled="!selected" type="range" min="0.15" max="1" step="0.01" @input="syncOpacity" /></label>
        <div class="td-control-row"><span>剖切方向</span><div class="td-option-group axis"><button v-for="option in sliceAxes" :key="option.value" type="button" :class="{ active: sliceAxis === option.value }" :disabled="!selected" @click="setSliceAxis(option.value)">{{ option.label }}</button></div></div>
        <div v-if="sliceAxis !== 'none'" class="td-control-row"><span>保留范围</span><div class="td-option-group"><button v-for="option in fractionOptions" :key="option.value" type="button" :class="{ active: sliceFraction === option.value }" @click="setSliceFraction(option.value)">{{ option.label }}</button></div></div>
      </div>
    </section>

    <section v-if="metadata" class="td-section td-fans">
      <div class="td-title-row">
        <div class="td-title">二维扇面成果</div>
        <small>点击放大</small>
      </div>
      <div class="td-fan-grid">
        <button
          v-for="fan in fanSections"
          :key="fan.id"
          type="button"
          :title="`查看${fan.label}`"
          @click="selectedFan = fan"
        >
          <img :src="fan.src" :alt="`${fan.label}视电阻率等值线图`" />
          <span>{{ fan.label }}</span>
        </button>
      </div>
    </section>

    <section v-if="metadata" class="td-section">
      <div class="td-title">结果统计</div>
      <div class="td-stat-grid">
        <div><span>视电阻率体素</span><b>{{ formatCount(metadata.resistivity.count) }}</b></div>
        <div><span>富水异常体素</span><b class="water">{{ formatCount(metadata.water.count) }}</b></div>
        <div><span>富水体素占比</span><b>{{ metadata.water.percentage.toFixed(2) }}%</b></div>
        <div><span>当前显示</span><b>{{ activeResultLabel }}</b></div>
      </div>
    </section>

    <section v-if="metadata" class="td-section td-conclusion">
      <div class="td-title">预报结论</div>
      <template v-if="activeType === 'resistivity'">
        <div class="td-row"><span>电性分布范围</span><b>{{ resistivityRange }}</b></div>
        <div class="td-row"><span>空间解释</span><b>掌子面前方整体电性体素场</b></div>
        <p>视电阻率体素反映掌子面前方岩体电性变化，可与 TSP 波速体素在同一隧道空间中对照分析。</p>
      </template>
      <template v-else-if="activeType === 'water'">
        <div class="td-row"><span>低阻异常位置</span><b>{{ waterForwardRange }}</b></div>
        <div class="td-row"><span>异常规模</span><b>{{ formatCount(metadata.water.count) }} 体素</b></div>
        <div class="td-row"><span>异常强度依据</span><b>ρs &lt; {{ metadata.water.threshold }} Ω·m</b></div>
        <p>低阻体素作为疑似富水异常空间约束，建议结合 TSP、地质雷达、钻孔和掌子面揭露结果进一步验证。</p>
      </template>
      <template v-else>
        <div class="td-row"><span>等值面阈值</span><b>ρs = 570 Ω·m</b></div>
        <div class="td-row"><span>模型文件</span><b>anomaly_k570_4x.glb</b></div>
        <div class="td-row"><span>显示方式</span><b>橙色半透明异常边界</b></div>
        <p>该模型仅表达 570 Ω·m 单一等值边界，不叠加其他阈值；点击模型可切换高亮状态。</p>
      </template>
    </section>

    <div v-if="selectedFan" class="td-fan-modal" @click.self="selectedFan = null">
      <div class="td-fan-modal__card">
        <div><b>{{ selectedFan.label }}视电阻率等值线图</b><button type="button" @click="selectedFan = null">×</button></div>
        <img :src="selectedFan.src" :alt="`${selectedFan.label}视电阻率等值线图`" />
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

type ResultType = 'resistivity' | 'water' | 'isosurface'
interface FanSection { id: number; label: string; src: string }
interface Metadata {
  shape: number[]
  voxelSize: number[]
  bounds: { min: number[]; max: number[] }
  resistivity: { count: number; valueRange: number[]; unit: string }
  water: { rule: string; threshold: number; count: number; percentage: number; bounds: { min: number[]; max: number[] } }
}

const emit = defineEmits<{
  selectResult: [type: ResultType]
  opacityChange: [opacity: number]
  sliceChange: [axis: 'none' | 'x' | 'y' | 'z', fraction: number]
}>()
const metadata = ref<Metadata | null>(null)
const activeType = ref<ResultType>('resistivity')
const selected = ref(false)
const opacity = ref(0.4)
const sliceAxis = ref<'none' | 'x' | 'y' | 'z'>('none')
const sliceFraction = ref(1)
const selectedFan = ref<FanSection | null>(null)
const fanSections: FanSection[] = Array.from({ length: 4 }, (_, index) => ({
  id: index + 1,
  label: `扇面 ${index + 1}`,
  src: `/data/geophysical_tem/fan_section_${index + 1}.jpg`,
}))
const sliceAxes: { label: string; value: 'none' | 'x' | 'y' | 'z' }[] = [
  { label: '关闭', value: 'none' }, { label: '前向X', value: 'x' }, { label: '横向Y', value: 'y' }, { label: '高程Z', value: 'z' },
]
const fractionOptions = [
  { label: '25%', value: 0.25 }, { label: '50%', value: 0.5 }, { label: '75%', value: 0.75 }, { label: '全部', value: 1 },
]
const resultTypes: { key: ResultType; icon: string; label: string; description: string }[] = [
  { key: 'resistivity', icon: '▦', label: '视电阻率体素', description: '掌子面前方整体电性分布' },
  { key: 'water', icon: '≈', label: '富水异常体', description: 'ρs < 570 Ω·m 低阻区域' },
  { key: 'isosurface', icon: '◈', label: '570 等值面', description: 'ρs = 570 Ω·m 异常边界 GLB' },
]

const voxelResolution = computed(() => metadata.value ? `分辨率 ${metadata.value.voxelSize.map(value => value.toFixed(2)).join('×')} m` : '')
const resistivityRange = computed(() => metadata.value ? `${metadata.value.resistivity.valueRange[0].toFixed(1)}～${metadata.value.resistivity.valueRange[1].toFixed(1)} Ω·m` : '—')
const activeValueRange = computed(() => activeType.value === 'water' ? 'ρs < 570 Ω·m' : activeType.value === 'isosurface' ? 'ρs = 570 Ω·m' : resistivityRange.value)
const activeResultLabel = computed(() => activeType.value === 'water' ? '富水异常体' : activeType.value === 'isosurface' ? '570 等值面' : '视电阻率场')
const waterForwardRange = computed(() => metadata.value ? axisRange(metadata.value.water.bounds.min[0], metadata.value.water.bounds.max[0]) + '（距掌子面）' : '—')

function selectType(type: ResultType) {
  activeType.value = type
  selected.value = true
  emit('selectResult', type)
  emit('opacityChange', opacity.value)
  emit('sliceChange', sliceAxis.value, sliceFraction.value)
}
function syncOpacity() { emit('opacityChange', opacity.value) }
function setSliceAxis(value: 'none' | 'x' | 'y' | 'z') { sliceAxis.value = value; emit('sliceChange', value, sliceFraction.value) }
function setSliceFraction(value: number) { sliceFraction.value = value; emit('sliceChange', sliceAxis.value, value) }
function axisRange(min: number, max: number) { return `${min.toFixed(1)}～${max.toFixed(1)} m` }
function formatCount(value: number) { return new Intl.NumberFormat('zh-CN').format(value) }

onMounted(async () => {
  try {
    const response = await fetch('/data/geophysical_tem/metadata.json')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    metadata.value = await response.json()
  } catch (error) {
    console.warn('[TEM] 成果读取失败:', error)
  }
})
</script>

<style scoped lang="scss">
.td-root { color:#b8cbe0; font-size:12px; }
.td-section { margin-bottom:12px; padding:10px 12px; border:1px solid rgba(0,180,255,.08); border-radius:6px; background:rgba(0,180,255,.04); }
.td-conclusion p { margin:8px 0 0; color:#648194; font-size:9px; line-height:1.6; }
.td-title { margin-bottom:8px; color:#5a8ab5; font-size:11px; font-weight:600; letter-spacing:.4px; text-transform:uppercase; }
.td-title-row { display:flex; align-items:center; justify-content:space-between; .td-title { margin-bottom:6px; } small { color:#4e7188; font-size:8px; } }
.td-types { display:grid; gap:5px; button { width:100%; padding:8px; display:grid; grid-template-columns:29px 1fr; align-items:center; gap:8px; border:1px solid rgba(0,180,255,.15); border-radius:5px; color:#7896aa; background:rgba(4,19,32,.7); text-align:left; cursor:pointer; transition:.15s; &:hover:not(:disabled),&.active { border-color:#00eaff; background:rgba(0,234,255,.1); } &:disabled { opacity:.45; cursor:default; } > i { width:28px; height:28px; display:grid; place-items:center; border-radius:5px; color:#48d9ec; background:rgba(26,151,178,.12); font-style:normal; font-size:16px; } b,small { display:block; } b { color:#b9d0de; font-size:10px; } small { margin-top:2px; color:#526f84; font-size:8px; } &.active b { color:#00eaff; } } }
.td-hint { margin-top:7px; color:#4f7087; font-size:8px; line-height:1.5; }
.td-meta-strip { margin-top:8px; display:flex; flex-wrap:wrap; gap:4px; span { padding:3px 5px; border-radius:3px; color:#7192a7; background:rgba(38,117,147,.1); font-size:8px; } }
.td-controls { margin-top:9px; padding-top:8px; display:grid; gap:7px; border-top:1px solid rgba(53,137,168,.1); }
.td-opacity-control { display:grid; gap:4px; color:#607f95; font-size:9px; > span { display:flex; justify-content:space-between; } b { color:#4fcfe4; font:600 8px Consolas; } input { width:100%; margin:0; accent-color:#29cce6; cursor:pointer; &:disabled { opacity:.35; cursor:default; } } }
.td-control-row { display:grid; grid-template-columns:62px 1fr; align-items:center; gap:6px; > span { color:#607f95; font-size:9px; } }
.td-option-group { display:grid; grid-template-columns:repeat(3,1fr); gap:3px; &.axis { grid-template-columns:repeat(4,1fr); } button { min-width:0; padding:4px 2px; border:1px solid rgba(46,139,175,.18); border-radius:3px; color:#6f8da2; background:#071a28; cursor:pointer; font-size:8px; &:hover:not(:disabled),&.active { border-color:rgba(35,199,222,.48); color:#55d4e6; background:rgba(22,139,162,.16); } &:disabled { opacity:.35; cursor:default; } } }
.td-row { display:grid; grid-template-columns:78px 1fr; gap:6px; padding:4px 0; border-bottom:1px solid rgba(55,135,165,.08); span { color:#55768e; font-size:9px; } b { color:#abc5d5; font-size:9px; font-weight:600; text-align:right; } }
.td-stat-grid { display:grid; grid-template-columns:1fr 1fr; gap:1px; border:1px solid rgba(52,132,163,.12); background:rgba(52,132,163,.12); div { min-width:0; padding:7px; background:rgba(4,20,33,.85); } span,b { display:block; } span { color:#4e7087; font-size:8px; } b { margin-top:3px; overflow:hidden; color:#aac5d5; font:600 11px Consolas; text-overflow:ellipsis; white-space:nowrap; } b.water { color:#35bdf4; } }
.td-conclusion { border-color:rgba(45,198,158,.16); }
.td-fans { padding-bottom:8px; }
.td-fan-grid { display:grid; grid-template-columns:1fr 1fr; gap:5px; button { position:relative; height:67px; padding:0; overflow:hidden; border:1px solid rgba(45,151,184,.18); border-radius:4px; background:#061522; cursor:zoom-in; transition:.15s; &:hover { border-color:rgba(39,211,231,.62); box-shadow:0 0 9px rgba(30,192,220,.12); } img { width:100%; height:100%; display:block; object-fit:contain; background:#eef2f1; } span { position:absolute; left:3px; bottom:3px; padding:2px 5px; border-radius:2px; color:#d8f4f6; background:rgba(3,18,28,.76); font-size:8px; } } }
.td-fan-modal { position:fixed; z-index:1200; inset:0; display:grid; place-items:center; padding:6vh 370px 6vh 24px; background:rgba(1,7,12,.72); backdrop-filter:blur(4px); }
.td-fan-modal__card { width:min(900px,78vw); padding:10px; border:1px solid rgba(44,194,218,.42); border-radius:7px; background:#071724; box-shadow:0 18px 60px rgba(0,0,0,.55); > div { height:28px; display:flex; align-items:flex-start; justify-content:space-between; color:#9edce8; font-size:11px; button { width:24px; height:24px; padding:0; border:1px solid rgba(75,153,178,.24); border-radius:4px; color:#8db5c5; background:#0b2232; cursor:pointer; font-size:17px; line-height:20px; } } img { width:100%; max-height:72vh; display:block; object-fit:contain; background:#fff; } }
@media (max-width:1100px) { .td-fan-modal { padding-right:330px; } }
</style>
