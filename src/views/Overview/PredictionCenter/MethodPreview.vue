<template>
  <div class="mp-root">
    <!-- 地震波反射 / TSP 三维体素场 -->
    <template v-if="method.key === 'tsp'">
      <div class="mp-section">
        <div class="mp-section-title">TSP 三维体素模型</div>
        <div class="mp-voxel-status" :class="{ error: tspLoadError }"><span></span>{{ tspLoadError || (tspMeta ? '实测体数据已就绪' : '正在读取体数据…') }}</div>
        <div class="mp-model-types">
          <button
            v-for="t in tspTypes"
            :key="t.key"
            class="mp-type-btn"
            :class="{ active: tspActive === t.key }"
            @click="selectTspType(t.key)"
          >{{ t.label }}</button>
        </div>
        <div class="mp-colorbar-hint">点击属性按钮即可切换三维模型，设计基准模型将继续保留。</div>
        <div v-if="activeTspChannel" class="mp-voxel-meta">
          <span>{{ activeTspChannel.shape.join(' × ') }} 体素</span>
          <span>分辨率 {{ activeTspChannel.voxelSize[0] }} m</span>
          <span>{{ Math.round(activeTspChannel.valueRange[0]) }}～{{ Math.round(activeTspChannel.valueRange[1]) }} {{ activeTspChannel.unit }}</span>
        </div>
      </div>
      <div v-if="tspActive === 'hardness' && activeTspChannel?.categories" class="mp-section">
        <div class="mp-section-title">坚硬程度计算结果</div>
        <div class="mp-kv"><span>单轴饱和抗压强度 Rc</span><b>{{ formatRange(activeTspChannel.valueRange) }} MPa</b></div>
        <div class="mp-kv"><span>动态弹性模量 ED</span><b>{{ formatRange(activeTspChannel.dynamicModulusRange) }} GPa</b></div>
        <div class="mp-kv"><span>岩体密度 ρ</span><b>{{ formatRange(activeTspChannel.densityRange, 2) }} g/cm³</b></div>
        <div class="mp-hardness-list">
          <div v-for="category in activeTspChannel.categories" :key="category.key" class="mp-hardness-row">
            <i :style="{ background: category.color }"></i>
            <span>{{ category.label }}</span>
            <small>{{ category.rule }}</small>
            <b>{{ category.percentage.toFixed(2) }}%</b>
          </div>
        </div>
        <div class="mp-formula-list">
          <div>{{ activeTspChannel.formula?.density }}</div>
          <div>{{ activeTspChannel.formula?.dynamicModulus }}</div>
          <div>{{ activeTspChannel.formula?.ucs }}</div>
        </div>
        <div class="mp-model-note">{{ activeTspChannel.note }}</div>
      </div>
      <div v-if="tspActive === 'integrity' && activeTspChannel?.categories" class="mp-section">
        <div class="mp-section-title">完整程度指示</div>
        <div class="mp-model-note">{{ activeTspChannel.description }}</div>
        <div class="mp-hardness-list">
          <div v-for="category in activeTspChannel.categories" :key="category.key" class="mp-hardness-row">
            <i :style="{ background: category.color }"></i>
            <span>{{ category.label }}</span>
            <small>{{ category.rule }}</small>
            <b>{{ category.percentage.toFixed(2) }}%</b>
          </div>
        </div>
      </div>
      <div v-if="tspMeta" class="mp-section">
        <div class="mp-section-title">探测参数</div>
        <div class="mp-kv"><span>工程名称</span><b>{{ tspMeta.report.projectName }}</b></div>
        <div class="mp-kv"><span>掌子面里程</span><b>{{ tspMeta.report.faceMileage }}</b></div>
        <div class="mp-kv"><span>预报日期</span><b>{{ tspMeta.report.forecastDate }}</b></div>
        <div class="mp-kv"><span>探测长度</span><b>{{ tspMeta.report.detectionLength }} m</b></div>
        <div class="mp-kv"><span>设备</span><b>{{ tspMeta.report.device }}</b></div>
        <div class="mp-kv"><span>激发孔间距</span><b>{{ tspMeta.report.shotSpacing }} m</b></div>
      </div>
      <div v-if="tspMeta" class="mp-section">
        <div class="mp-section-title">网页报告结论</div>
        <div class="mp-report-summary">{{ tspMeta.report.summary }}</div>
      </div>
    </template>

    <!-- 超前水平钻 -->
    <template v-else-if="method.key === 'horiz_drill'">
      <div class="mp-section">
        <div class="mp-section-title">3D 钻孔模型</div>
        <div class="mp-model-grid">
          <div class="mp-model-card">
            <div class="mp-model-icon">🔩</div>
            <div class="mp-model-name">钻孔 1</div>
            <div class="mp-model-src">ahd1/2320835.glb</div>
          </div>
          <div class="mp-model-card">
            <div class="mp-model-icon">🔩</div>
            <div class="mp-model-name">钻孔 2</div>
            <div class="mp-model-src">ahd2/2336197.glb</div>
          </div>
        </div>
      </div>
      <div class="mp-section">
        <div class="mp-section-title">掌子面切片</div>
        <div class="mp-kv"><span>切片数量</span><b>4 个</b></div>
        <div class="mp-kv"><span>分布间距</span><b>~10 m</b></div>
        <div class="mp-kv"><span>里程范围</span><b>D3K278+100 ~ DK300+800</b></div>
      </div>
    </template>

    <!-- 瞬变电磁 -->
    <TemDetail
      v-else-if="method.key === 'tem'"
      @select-result="selectTemType"
      @opacity-change="value => $emit('temOpacityChange', value)"
      @slice-change="(axis, fraction) => $emit('temSliceChange', axis, fraction)"
    />

    <!-- 掌子面素描 -->
    <FaceSketchDetail
      v-else-if="method.key === 'face_sketch'"
      @select-mileage="value => $emit('faceMileageChange', value)"
    />

    <!-- 凿岩台车（实体 + 工作包络） -->
    <template v-else-if="method.key === 'jumbo_rig'">
      <div class="mp-section">
        <div class="mp-section-title">设备模型</div>
        <div class="mp-model-grid">
          <div class="mp-model-card">
            <div class="mp-model-icon">⛏</div>
            <div class="mp-model-name">三臂凿岩台车 ZYS113</div>
            <div class="mp-model-src">jumbo_solid.glb</div>
          </div>
        </div>
      </div>
      <div class="mp-section">
        <div class="mp-section-title">工作包络</div>
        <div class="mp-kv"><span>姿态</span><b>支腿降落 + 臂架收缩</b></div>
        <button
          class="mp-env-toggle"
          :class="{ on: envVisible }"
          @click="toggleEnvelope"
        >
          <span class="mp-env-knob"></span>
          <span class="mp-env-label">{{ envVisible ? '包络已显示' : '包络已隐藏' }}</span>
        </button>
      </div>
    </template>

    <!-- 通用空状态 -->
    <div v-else class="mp-empty">
      <div class="mp-empty-icon">📊</div>
      <div class="mp-empty-text">暂无预览数据</div>
    </div>

    <button v-if="method.key !== 'tem' && method.key !== 'tsp' && method.key !== 'face_sketch'" class="mp-view-btn" @click="handleViewInScene">
      <span>▦</span> 在场景中查看
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

interface MethodCard {
  key: string
  label: string
  icon: string
  category: string
  dataStatus: 'available' | 'pending'
  latestResult?: string
}

interface TspChannelMeta {
  valueRange: [number, number]
  shape: [number, number, number]
  voxelSize: [number, number, number]
  unit: string
  densityRange?: [number, number]
  dynamicModulusRange?: [number, number]
  categories?: { key: string; label: string; rule: string; color: string; percentage: number }[]
  formula?: { density: string; dynamicModulus: string; ucs: string }
  note?: string
  description?: string
  anomalyZones?: {
    id: string; type: string; startMileage: string; endMileage: string
    distanceFromFace: [number, number]; intensity: number
  }[]
}

interface TspMetadata {
  report: {
    projectName: string
    forecastDate: string
    faceMileage: string
    detectionLength: number
    device: string
    shotSpacing: number
    summary: string
  }
  channels: Record<'vp' | 'vs' | 'hardness' | 'ratio' | 'anomaly' | 'integrity', TspChannelMeta>
}

import TemDetail from './TemDetail.vue'
import FaceSketchDetail from './FaceSketchDetail.vue'

const props = defineProps<{ method: MethodCard; dataDir?: string }>()
const emit = defineEmits<{
  viewInScene: [jobId?: string, subType?: string]
  viewVoxelCloud: [jobId: string]
  toggleEnvelope: [show: boolean]
  temOpacityChange: [opacity: number]
  temSliceChange: [axis: 'none' | 'x' | 'y' | 'z', fraction: number]
  faceMileageChange: [mileage: string]
}>()

const envVisible = ref(false)
const tspMeta = ref<TspMetadata | null>(null)
const tspLoadError = ref('')
function toggleEnvelope() {
  envVisible.value = !envVisible.value
  emit('toggleEnvelope', envVisible.value)
}

function handleViewInScene() {
  emit('viewInScene', undefined, props.method.key === 'tsp' ? tspActive.value : undefined)
}

const tspActive = ref('vs')
const tspTypes = [
  { key: 'vp', label: 'VP 波速' },
  { key: 'vs', label: 'VS 波速' },
  { key: 'hardness', label: '坚硬程度' },
  { key: 'integrity', label: '完整程度' },
]
function selectTspType(type: string) {
  tspActive.value = type
  emit('viewInScene', undefined, type)
}
function selectTemType(type: 'resistivity' | 'water' | 'isosurface') {
  emit('viewInScene', undefined, type)
}
const activeTspChannel = computed(() => tspMeta.value?.channels[tspActive.value as keyof TspMetadata['channels']])
const formatRange = (range?: [number, number], digits = 1) => range
  ? `${range[0].toFixed(digits)}～${range[1].toFixed(digits)}`
  : '--'

onMounted(async () => {
  if (props.method.key !== 'tsp') return
  try {
    const response = await fetch('/data/tsp_actual/metadata.json')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    tspMeta.value = await response.json()
  } catch (error) {
    tspLoadError.value = `体数据读取失败：${(error as Error).message}`
  }
})
</script>

<style scoped lang="scss">
.mp-root { font-size: 13px; }

.mp-section {
  margin-bottom: 14px; padding: 10px 12px;
  border-radius: 6px; background: rgba(0, 180, 255, 0.04);
  border: 1px solid rgba(0, 180, 255, 0.08);
}
.mp-section-title {
  font-size: 12px; color: #5a8ab5; margin-bottom: 8px;
  font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
}

.mp-model-types { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
.mp-type-btn {
  flex: 1 1 calc(33.333% - 4px); min-width: 72px;
  padding: 4px 10px; border: 1px solid rgba(0, 180, 255, 0.15); border-radius: 4px;
  background: none; color: #8aa0bd; font-size: 12px; cursor: pointer; transition: .15s;
  &:hover { border-color: rgba(0, 200, 255, 0.3); color: #cfe4fb; }
  &.active { background: rgba(0, 234, 255, 0.12); border-color: #00eaff; color: #00eaff; }
}
.mp-colorbar-hint { font-size: 11px; color: #4a6a8a; margin-top: 4px; }
.mp-voxel-status {
  display: flex; align-items: center; gap: 6px; margin-bottom: 9px;
  color: #78dca6; font-size: 11px;
  span { width: 7px; height: 7px; border-radius: 50%; background: #44ff88; box-shadow: 0 0 7px rgba(68,255,136,.7); }
  &.error { color: #ff8a80; span { background: #ff6655; box-shadow: 0 0 7px rgba(255,102,85,.7); } }
}
.mp-voxel-meta { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 9px; }
.mp-voxel-meta span {
  padding: 3px 6px; border-radius: 3px; color: #85a9c3; font-size: 9px;
  border: 1px solid rgba(0, 190, 235, .12); background: rgba(0, 90, 140, .12);
}
.mp-report-summary { color: #a9c0d4; font-size: 11px; line-height: 1.65; text-align: left; }
.mp-hardness-list { margin-top: 9px; display: grid; gap: 5px; }
.mp-hardness-row {
  display: grid; grid-template-columns: 10px 48px 1fr 48px; align-items: center; gap: 6px;
  color: #9db7cd; font-size: 10px;
  i { width: 9px; height: 9px; border-radius: 2px; }
  small { color: #62819d; font-size: 9px; }
  b { color: #d8e8f5; text-align: right; }
}
.mp-formula-list { margin-top: 9px; color: #7ea5c2; font-size: 10px; line-height: 1.6; }
.mp-model-note { margin-top: 7px; color: #708ba1; font-size: 9px; line-height: 1.5; }
.mp-anomaly-zone {
  margin-top: 8px; padding: 7px 8px; border-radius: 4px;
  border: 1px solid rgba(255,176,64,.18); background: rgba(255,130,40,.05);
  > div { display: flex; justify-content: space-between; gap: 8px; margin: 2px 0; font-size: 9px; color: #7796ad; }
  b { color: #ffc167; font-weight: 600; }
}
.mp-kv {
  display: flex; justify-content: space-between; align-items: center;
  padding: 3px 0; font-size: 12px; color: #8aa0bd;
  b { color: #d7e3f5; font-weight: 600; }
}

.mp-model-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.mp-model-card {
  padding: 8px; border-radius: 5px;
  background: rgba(0, 180, 255, 0.04); border: 1px solid rgba(0, 180, 255, 0.06);
  text-align: center;
}
.mp-model-icon { font-size: 20px; margin-bottom: 2px; }
.mp-model-name { font-size: 12px; color: #c7d5ea; font-weight: 600; }
.mp-model-src { font-size: 10px; color: #4a6a8a; word-break: break-all; }

.mp-view-btn {
  margin-top: 8px; width: 100%; padding: 10px; border: none; border-radius: 6px;
  background: linear-gradient(135deg, rgba(56,189,248,.15), rgba(0,234,255,.12));
  color: #00eaff; font-size: 14px; font-weight: 600; cursor: pointer; transition: .15s;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  border: 1px solid rgba(0, 234, 255, 0.2);
  &:hover { background: rgba(0, 234, 255, 0.18); border-color: rgba(0, 234, 255, 0.4); }
}

.mp-empty { text-align: center; padding: 30px 20px; }
.mp-empty-icon { font-size: 32px; margin-bottom: 8px; }
.mp-empty-text { font-size: 13px; color: #5a7a9a; }

.mp-env-toggle {
  margin-top: 8px; width: 100%; padding: 8px 10px; border-radius: 6px;
  display: flex; align-items: center; gap: 8px;
  background: rgba(0, 30, 70, 0.4); border: 1px solid rgba(0, 120, 220, 0.3);
  color: #8aa0bd; font-size: 12px; cursor: pointer; transition: .15s;
  &:hover { border-color: rgba(0, 200, 255, 0.4); }
  &.on { background: rgba(0, 100, 200, 0.25); border-color: #00eaff; color: #00eaff; }
}
.mp-env-knob {
  width: 26px; height: 14px; border-radius: 7px; background: rgba(100, 140, 180, 0.4);
  position: relative; flex-shrink: 0; transition: background .15s;
  &::after {
    content: ''; position: absolute; top: 2px; left: 2px; width: 10px; height: 10px;
    border-radius: 50%; background: #cfe4fb; transition: left .15s;
  }
}
.mp-env-toggle.on .mp-env-knob {
  background: rgba(0, 200, 255, 0.6);
  &::after { left: 14px; background: #00eaff; }
}
.mp-env-label { flex: 1; text-align: left; }
</style>
