<template>
  <transition name="panel-slide-right">
    <div v-if="show" class="pred-center-panel">
      <!-- Header -->
      <div class="pc-header">
        <div class="pc-title-group">
          <button v-if="activeVersion === 'forecast' && selectedMethod" class="pc-back-btn" @click="selectedMethod = null">‹ 返回</button>
          <div>
            <div class="pc-title">{{ selectedMethod ? selectedMethod.label : '围岩分级模型' }}</div>
            <div v-if="!selectedMethod" class="pc-subtitle">
              {{ activeVersion === 'design' ? '勘察设计成果' : '超前预报动态成果' }}
            </div>
          </div>
        </div>
        <button class="pc-close" @click="$emit('close')" title="关闭">×</button>
      </div>

      <!-- 围岩模型版本选择 -->
      <div class="pc-version-switch" role="tablist" aria-label="围岩模型版本">
        <button
          v-for="version in versions"
          :key="version.key"
          class="pc-version-btn"
          :class="{ active: activeVersion === version.key }"
          role="tab"
          :aria-selected="activeVersion === version.key"
          @click="switchVersion(version.key)"
        >
          <span class="pc-version-icon">{{ version.icon }}</span>
          <span>{{ version.label }}</span>
        </button>
      </div>

      <!-- 设计版：依据勘察报告围岩分级表生成 -->
      <div v-if="activeVersion === 'design'" class="pc-body pc-design-body">
        <div class="pc-version-intro">
          <span class="pc-intro-mark">设</span>
          <div>
            <div class="pc-intro-title">设计围岩分级模型</div>
            <div class="pc-intro-desc">依据勘察报告中的围岩分级表，按里程区段匹配围岩等级并生成设计模型。</div>
          </div>
        </div>

        <div class="pc-design-section">
          <div class="pc-section-title"><span class="pc-gi">▸</span> 数据依据</div>
          <div class="pc-source-card">
            <div class="pc-source-row">
              <span class="pc-source-label">数据来源</span>
              <span class="pc-source-value">勘察报告</span>
            </div>
            <div class="pc-source-row">
              <span class="pc-source-label">核心依据</span>
              <span class="pc-source-value">围岩分级表</span>
            </div>
            <div class="pc-source-row">
              <span class="pc-source-label">生成方式</span>
              <span class="pc-source-value">里程分段映射</span>
            </div>
          </div>
        </div>

        <div class="pc-design-section">
          <div class="pc-section-title"><span class="pc-gi">▸</span> 建模流程</div>
          <div class="pc-flow">
            <template v-for="(step, index) in designFlow" :key="step">
              <div class="pc-flow-step">
                <span class="pc-flow-index">{{ index + 1 }}</span>
                <span>{{ step }}</span>
              </div>
              <span v-if="index < designFlow.length - 1" class="pc-flow-arrow">↓</span>
            </template>
          </div>
        </div>

        <div class="pc-design-section">
          <div class="pc-section-title"><span class="pc-gi">▸</span> 围岩等级图例</div>
          <div class="pc-grade-legend">
            <div v-for="grade in rockGrades" :key="grade.level" class="pc-grade-item">
              <span class="pc-grade-color" :style="{ background: grade.color, boxShadow: `0 0 7px ${grade.color}` }"></span>
              <span class="pc-grade-level">{{ grade.level }}级</span>
              <span class="pc-grade-desc">{{ grade.description }}</span>
            </div>
          </div>
        </div>

        <button class="pc-model-btn" @click="viewDesignModel">
          <span>◈</span>
          <span>查看设计围岩分级模型</span>
          <span class="pc-model-arrow">›</span>
        </button>

        <div class="pc-design-section pc-segment-section">
          <div class="pc-section-title">
            <span class="pc-gi">▸</span>
            设计分级区段
            <span class="pc-section-count">{{ designSegments.length }}段</span>
          </div>
          <div class="pc-segment-list">
            <div
              v-for="segment in designSegments"
              :key="segment.modelIndex"
              class="pc-segment-row"
              :class="{ active: selectedDesignSegmentIndex === segment.modelIndex }"
              role="button"
              tabindex="0"
              :aria-label="`跳转到${segment.startMileage}至${segment.endMileage}，${romanGrade(segment.grade)}级围岩`"
              @click="selectDesignSegment(segment)"
              @keydown.enter="selectDesignSegment(segment)"
            >
              <span class="pc-grade-color" :style="{ background: gradeColor(segment.grade), boxShadow: `0 0 7px ${gradeColor(segment.grade)}` }"></span>
              <span class="pc-segment-mileage">{{ segment.startMileage }}～{{ segment.endMileage }}</span>
              <span class="pc-segment-grade" :style="{ color: gradeColor(segment.grade) }">{{ romanGrade(segment.grade) }}级</span>
              <span class="pc-segment-arrow">›</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Level 1: Method Card List -->
      <div v-else-if="!selectedMethod" class="pc-body">
        <div class="pc-version-intro pc-forecast-intro">
          <span class="pc-intro-mark forecast">超</span>
          <div>
            <div class="pc-intro-title">超报围岩分级模型</div>
            <div class="pc-intro-desc">融合超前地质预报数据，经处理分析后动态更新围岩分级模型。</div>
          </div>
        </div>
        <div v-for="group in methodGroups" :key="group.title" class="pc-group">
          <div class="pc-group-title">
            <span class="pc-gi">▸</span> {{ group.title }}
          </div>
          <div
            v-for="m in group.methods"
            :key="m.key"
            class="pc-card"
            :class="{ active: activeAction === m.key }"
            @click="selectMethod(m)"
          >
            <span class="pc-card-icon">{{ m.icon }}</span>
            <div class="pc-card-info">
              <div class="pc-card-label">{{ m.label }}</div>
              <div class="pc-card-meta">
                <span class="pc-card-status" :class="m.dataStatus">{{ statusText[m.dataStatus] }}</span>
                <span v-if="m.latestResult" class="pc-card-time">{{ m.latestResult }}</span>
              </div>
            </div>
            <span class="pc-card-arrow">›</span>
          </div>
        </div>
      </div>

      <!-- Level 2: Method Detail (Tabs) -->
      <div v-else class="pc-body">
        <div class="pc-tabs">
          <button
            v-for="t in tabs"
            :key="t.key"
            class="pc-tab"
            :class="{ active: activeTab === t.key }"
            @click="activeTab = t.key"
          >{{ t.label }}</button>
        </div>

        <!-- Tab: Data Preview -->
        <div v-show="activeTab === 'preview'" class="pc-tab-content">
          <MethodPreview
            v-if="selectedMethod.dataStatus === 'available' || selectedMethod.key === 'tem'"
            :key="`${selectedMethod.key}-${refreshKey}`"
            :method="selectedMethod"
            :data-dir="selectedMethod.key === 'tem' ? '/data/tem_output/latest' : undefined"
            @view-in-scene="handleViewInScene"
          />
          <div v-else class="pc-preview-empty">
            <div class="pc-empty-icon">📊</div>
            <div class="pc-empty-text">暂无{{ selectedMethod.label }}数据</div>
            <div class="pc-empty-hint">切换到"新建处理"上传原始数据进行处理</div>
          </div>
        </div>

        <!-- Tab: New Process -->
        <div v-show="activeTab === 'process'" class="pc-tab-content">
          <ProcessTab
            :model-key="selectedMethod.key"
            :model-label="selectedMethod.label"
            @process-complete="onProcessComplete"
          />
        </div>

        <!-- Tab: History -->
        <div v-show="activeTab === 'history'" class="pc-tab-content">
          <div v-if="historyLoading" class="pc-history-empty">加载中...</div>
          <div v-else-if="historyDatasets.length === 0" class="pc-history-empty">
            <div class="pc-empty-icon">📋</div>
            <div class="pc-empty-text">暂无处理记录</div>
          </div>
          <div v-else class="pc-history-list">
            <div v-for="ds in historyDatasets" :key="ds.jobId" class="pc-history-card">
              <div class="pc-hist-main">前向 {{ ds.xRange?.map((v:number) => v.toFixed(0)).join('~') || '—' }}m</div>
              <span class="pc-hist-time">{{ ds.createdAt ? ds.createdAt.slice(0, 16).replace('T', ' ') : '—' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import ProcessTab from './PredictionCenter/ProcessTab.vue'
import MethodPreview from './PredictionCenter/MethodPreview.vue'
import { loadTemAnomalyGlb } from '@/utils/Common/GeoModelController'
import type { DesignRockGradeSegment } from '@/utils/Common/DrawLine'

interface MethodCard {
  key: string
  label: string
  icon: string
  category: string
  dataStatus: 'available' | 'pending'
  latestResult?: string
}

interface Action {
  key: string
  label: string
  icon: string
  type?: string
}

const props = defineProps<{
  show: boolean
  activeAction?: string | null
}>()

const emit = defineEmits<{
  close: []
  action: [action: Action, type: 'view' | 'process']
  versionChange: [version: ModelVersion]
  segmentSelect: [segment: DesignRockGradeSegment]
}>()

const selectedMethod = ref<MethodCard | null>(null)
type ModelVersion = 'design' | 'forecast'
const activeVersion = ref<ModelVersion>('design')
const activeTab = ref<'preview' | 'process' | 'history'>('preview')
const refreshKey = ref(0)
const historyDatasets = ref<any[]>([])
const historyLoading = ref(false)
const designSegments = ref<DesignRockGradeSegment[]>([])
const designGradeColors = ref<Record<string, string>>({})
const selectedDesignSegmentIndex = ref<number | null>(null)

const versions: { key: ModelVersion; label: string; icon: string }[] = [
  { key: 'design', label: '设计版', icon: '▤' },
  { key: 'forecast', label: '超报版', icon: '⌁' },
]

const designFlow = ['读取勘察报告', '提取围岩分级表', '匹配里程区段', '生成分级模型']

const rockGrades = [
  { level: 'Ⅱ', description: '完整—较完整', color: '#44ff88' },
  { level: 'Ⅲ', description: '较完整—较破碎', color: '#7dd3fc' },
  { level: 'Ⅳ', description: '较破碎', color: '#ffcc00' },
  { level: 'Ⅴ', description: '破碎—极破碎', color: '#ff6655' },
]

async function loadDesignSegments() {
  if (designSegments.value.length) return
  try {
    const response = await fetch('/data/tunnel/design-rock-grades.json')
    if (!response.ok) return
    const data = await response.json()
    designSegments.value = data.segments || []
    designGradeColors.value = data.gradeColors || {}
  } catch {
    designSegments.value = []
  }
}

function gradeColor(grade: string) {
  return designGradeColors.value[grade] || '#7dd3fc'
}

function romanGrade(grade: string) {
  return ({ II: 'Ⅱ', III: 'Ⅲ', IV: 'Ⅳ', V: 'Ⅴ' } as Record<string, string>)[grade] || grade
}

async function loadHistory() {
  historyLoading.value = true
  try {
    const r = await fetch('/data/tem_output/index.json')
    if (r.ok) historyDatasets.value = await r.json()
  } catch { historyDatasets.value = [] }
  historyLoading.value = false
}

const tabs = [
  { key: 'preview' as const, label: '数据预览' },
  { key: 'process' as const, label: '新建处理' },
  { key: 'history' as const, label: '历史记录' },
]

const statusText: Record<string, string> = {
  available: '已有数据',
  pending: '待处理',
}

const METHODS: MethodCard[] = [
  { key: 'face_sketch', label: '掌子面素描', icon: '⬡', category: '超前预报', dataStatus: 'available', latestResult: 'D3K278+100~DK300+800' },
  { key: 'gpr', label: '地质雷达', icon: '≋', category: '超前预报', dataStatus: 'pending' },
  { key: 'horiz_drill', label: '超前水平钻', icon: '⊕', category: '超前预报', dataStatus: 'available', latestResult: 'D3K278+100~DK300+800' },
  { key: 'deep_hole', label: '加深炮孔', icon: '⦿', category: '超前预报', dataStatus: 'pending' },
  { key: 'tsp', label: 'TSP反演', icon: '▦', category: '超前预报', dataStatus: 'available', latestResult: 'D3K278+100~DK300+800' },
  { key: 'tem', label: '瞬变电磁', icon: '⚡', category: '超前预报', dataStatus: 'pending' },
  { key: 'weak_rock', label: '软弱围岩', icon: '◈', category: '不良地质', dataStatus: 'pending' },
  { key: 'high_stress', label: '高地应力', icon: '♨', category: '不良地质', dataStatus: 'pending' },
  { key: 'water_zone', label: '富水带', icon: '💧', category: '不良地质', dataStatus: 'pending' },
  { key: 'fracture_zone', label: '破碎带', icon: '▓', category: '不良地质', dataStatus: 'pending' },
]

const methodGroups = computed(() => {
  const groups: { title: string; methods: MethodCard[] }[] = []
  const seen = new Set<string>()
  for (const m of METHODS) {
    if (!seen.has(m.category)) {
      seen.add(m.category)
      groups.push({ title: m.category, methods: METHODS.filter(x => x.category === m.category) })
    }
  }
  return groups
})

function handleViewInScene() {
  if (selectedMethod.value?.key === 'tem') {
    loadTemAnomalyGlb()
  } else if (selectedMethod.value) {
    emit('action', { key: selectedMethod.value.key, label: selectedMethod.value.label, icon: selectedMethod.value.icon }, 'view')
  }
}

function selectMethod(m: MethodCard) {
  selectedMethod.value = m
  activeTab.value = 'preview'
}

function switchVersion(version: ModelVersion) {
  activeVersion.value = version
  selectedMethod.value = null
  selectedDesignSegmentIndex.value = null
  activeTab.value = 'preview'
  if (version === 'design') loadDesignSegments()
  emit('versionChange', version)
}

function viewDesignModel() {
  emit('versionChange', 'design')
}

function selectDesignSegment(segment: DesignRockGradeSegment) {
  selectedDesignSegmentIndex.value = segment.modelIndex
  emit('segmentSelect', segment)
}

function onProcessComplete() {
  if (selectedMethod.value) {
    selectedMethod.value.dataStatus = 'available'
  }
  refreshKey.value++
  loadHistory()
  activeTab.value = 'preview'
}

// 切换到历史 Tab 时加载
watch(activeTab, (tab) => {
  if (tab === 'history') loadHistory()
})

loadDesignSegments()
</script>

<style scoped lang="scss">
.pred-center-panel {
  position: absolute;
  right: 0;
  top: 60px;
  bottom: 0;
  width: 296px;
  background: rgba(0, 6, 18, 0.92);
  border-left: 1px solid rgba(0, 170, 255, 0.2);
  z-index: 18;
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(16px);
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.5);
  color: #c7d5ea;
  font-family: system-ui, "Microsoft YaHei", sans-serif;
}

.pc-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px 12px;
  border-bottom: 1px solid rgba(0, 180, 255, 0.12);
}
.pc-title-group { display: flex; align-items: center; gap: 8px; }
.pc-title { font-size: 16px; font-weight: 700; color: #7dd3fc; }
.pc-subtitle { margin-top: 2px; font-size: 10px; color: #587897; letter-spacing: .5px; }
.pc-back-btn {
  background: none; border: none; color: #8aa0bd; font-size: 18px;
  cursor: pointer; padding: 0; line-height: 1;
  &:hover { color: #fff; }
}
.pc-close {
  background: none; border: none; color: #5a7590; font-size: 20px;
  cursor: pointer; padding: 0 4px; line-height: 1;
  &:hover { color: #fff; }
}

.pc-version-switch {
  display: grid; grid-template-columns: 1fr 1fr; gap: 5px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(0, 180, 255, 0.1);
  background: rgba(0, 20, 44, 0.4);
}
.pc-version-btn {
  display: flex; align-items: center; justify-content: center; gap: 7px;
  height: 34px; border-radius: 4px;
  border: 1px solid rgba(0, 160, 220, 0.18);
  background: rgba(0, 80, 130, 0.08);
  color: #7189a4; font-size: 13px; font-family: inherit;
  cursor: pointer; transition: .18s;
  &:hover { color: #ccecff; border-color: rgba(0, 210, 255, 0.35); }
  &.active {
    color: #00eaff;
    border-color: rgba(0, 234, 255, 0.65);
    background: linear-gradient(135deg, rgba(0, 174, 220, 0.2), rgba(0, 90, 160, 0.16));
    box-shadow: inset 0 0 12px rgba(0, 220, 255, 0.08), 0 0 7px rgba(0, 220, 255, 0.1);
  }
}
.pc-version-icon { font-size: 15px; }

.pc-body { flex: 1; overflow-y: auto; padding: 8px 0; }
.pc-design-body { padding: 12px; }

.pc-version-intro {
  display: flex; align-items: flex-start; gap: 10px;
  margin: 0 0 12px; padding: 11px;
  border: 1px solid rgba(0, 200, 255, 0.12);
  border-radius: 6px;
  background: linear-gradient(135deg, rgba(0, 130, 190, 0.12), rgba(0, 40, 85, 0.16));
}
.pc-forecast-intro { margin: 4px 12px 8px; }
.pc-intro-mark {
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  width: 30px; height: 30px; border-radius: 5px;
  color: #00eaff; font-weight: 700; font-size: 14px;
  border: 1px solid rgba(0, 234, 255, 0.45);
  background: rgba(0, 200, 255, 0.1);
  box-shadow: 0 0 8px rgba(0, 220, 255, 0.12);
  &.forecast { color: #b6a2ff; border-color: rgba(160, 130, 255, .5); background: rgba(130, 90, 255, .12); }
}
.pc-intro-title { color: #dcecff; font-size: 13px; font-weight: 600; margin-bottom: 4px; }
.pc-intro-desc { color: #7189a4; font-size: 11px; line-height: 1.6; }

.pc-design-section { margin-bottom: 13px; }
.pc-section-title {
  display: flex; align-items: center; gap: 4px;
  margin-bottom: 7px; color: #7995b2; font-size: 12px;
}
.pc-source-card {
  border: 1px solid rgba(0, 180, 255, 0.08);
  border-radius: 5px; overflow: hidden;
  background: rgba(0, 40, 80, 0.12);
}
.pc-source-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 10px; border-bottom: 1px solid rgba(0, 180, 255, 0.06);
  &:last-child { border-bottom: 0; }
}
.pc-source-label { color: #607d99; font-size: 11px; }
.pc-source-value { color: #bdd7ed; font-size: 11px; }

.pc-flow {
  display: flex; flex-direction: column; align-items: stretch;
  padding: 2px 0;
}
.pc-flow-step {
  display: flex; align-items: center; gap: 9px;
  padding: 7px 10px; border: 1px solid rgba(0, 180, 255, 0.09);
  border-radius: 4px; background: rgba(0, 80, 130, 0.08);
  color: #a8c3da; font-size: 11px;
}
.pc-flow-index {
  display: flex; align-items: center; justify-content: center;
  width: 17px; height: 17px; border-radius: 50%;
  color: #00eaff; font-size: 9px;
  border: 1px solid rgba(0, 234, 255, .38);
}
.pc-flow-arrow { height: 12px; color: rgba(0, 220, 255, .35); font-size: 11px; text-align: center; line-height: 12px; }

.pc-grade-legend {
  display: grid; grid-template-columns: 1fr 1fr; gap: 5px;
}
.pc-grade-item {
  display: grid; grid-template-columns: 8px 28px 1fr; align-items: center; gap: 6px;
  padding: 7px 8px; border-radius: 4px;
  background: rgba(0, 45, 80, .18); border: 1px solid rgba(0, 180, 255, .07);
}
.pc-grade-color { width: 7px; height: 7px; border-radius: 50%; }
.pc-grade-level { color: #cce3f6; font-size: 11px; font-weight: 600; }
.pc-grade-desc { color: #607d99; font-size: 9px; white-space: nowrap; }

.pc-model-btn {
  display: flex; align-items: center; gap: 9px; width: 100%;
  padding: 10px 12px; border-radius: 5px;
  border: 1px solid rgba(0, 234, 255, .42);
  background: linear-gradient(90deg, rgba(0, 160, 210, .2), rgba(0, 80, 150, .14));
  color: #74e7ff; font-family: inherit; font-size: 12px;
  cursor: pointer; transition: .18s;
  &:hover { border-color: #00eaff; background: rgba(0, 180, 230, .22); box-shadow: 0 0 10px rgba(0, 220, 255, .16); }
}
.pc-model-arrow { margin-left: auto; font-size: 18px; }
.pc-segment-section { margin-top: 14px; }
.pc-section-count { margin-left: auto; color: #4f6f8e; font-size: 10px; }
.pc-segment-list {
  max-height: 190px; overflow-y: auto;
  border: 1px solid rgba(0, 180, 255, .08); border-radius: 5px;
  scrollbar-width: thin; scrollbar-color: rgba(0, 180, 255, .3) transparent;
}
.pc-segment-row {
  display: grid; grid-template-columns: 8px 1fr 32px 10px; align-items: center; gap: 7px;
  padding: 7px 8px; border-bottom: 1px solid rgba(0, 180, 255, .06);
  background: rgba(0, 40, 80, .1);
  cursor: pointer; transition: background .16s, box-shadow .16s;
  &:last-child { border-bottom: 0; }
  &:hover, &:focus {
    outline: none;
    background: rgba(0, 170, 220, .12);
  }
  &.active {
    background: rgba(0, 190, 235, .16);
    box-shadow: inset 2px 0 0 #00eaff;
  }
}
.pc-segment-mileage { color: #91abc3; font-size: 10px; font-family: 'Consolas', monospace; }
.pc-segment-grade { font-size: 11px; font-weight: 700; text-align: right; }
.pc-segment-arrow { color: #3c607e; font-size: 15px; text-align: right; }
.pc-segment-row:hover .pc-segment-arrow,
.pc-segment-row.active .pc-segment-arrow { color: #00eaff; }

.pc-group { margin: 0 12px 4px; }
.pc-group-title {
  font-size: 13px; color: #5a7a9a; padding: 8px 4px 6px;
  display: flex; align-items: center; gap: 4px;
}
.pc-gi { color: #00eaff; font-size: 10px; }

.pc-card {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 6px; cursor: pointer;
  border: 1px solid rgba(0, 180, 255, 0.06);
  background: rgba(0, 180, 255, 0.03);
  margin-bottom: 4px; transition: .15s;
  &:hover { background: rgba(0, 200, 255, 0.08); border-color: rgba(0, 200, 255, 0.2); }
  &.active { border-color: rgba(0, 234, 255, 0.3); background: rgba(0, 200, 255, 0.1); }
}
.pc-card-icon { font-size: 20px; width: 32px; text-align: center; flex-shrink: 0; }
.pc-card-info { flex: 1; min-width: 0; }
.pc-card-label { font-size: 14px; color: #d7e3f5; margin-bottom: 2px; }
.pc-card-meta { display: flex; align-items: center; gap: 8px; }
.pc-card-status {
  font-size: 11px; padding: 1px 6px; border-radius: 8px;
  &.available { background: rgba(68, 255, 136, 0.15); color: #44ff88; }
  &.pending  { background: rgba(160, 180, 200, 0.12); color: #8aa0bd; }
}
.pc-card-time { font-size: 11px; color: #5a7a9a; }
.pc-card-arrow { font-size: 18px; color: #3b5573; flex-shrink: 0; }

.pc-tabs {
  display: flex; gap: 0; border-bottom: 1px solid rgba(0, 180, 255, 0.1);
  padding: 0 12px;
}
.pc-tab {
  padding: 8px 14px; font-size: 13px; color: #8aa0bd;
  background: none; border: none; border-bottom: 2px solid transparent;
  cursor: pointer; transition: .15s;
  &:hover { color: #cfe4fb; }
  &.active { color: #00eaff; border-bottom-color: #00eaff; }
}

.pc-tab-content { padding: 16px 12px; }

.pc-preview-empty, .pc-history-empty {
  text-align: center; padding: 40px 20px;
}
.pc-empty-icon { font-size: 36px; margin-bottom: 12px; }
.pc-empty-text { font-size: 14px; color: #8aa0bd; margin-bottom: 6px; }
.pc-empty-hint { font-size: 12px; color: #5a7a9a; }

.panel-slide-right-enter-active,
.panel-slide-right-leave-active { transition: transform .3s ease, opacity .25s ease; }
.panel-slide-right-enter-from,
.panel-slide-right-leave-to { transform: translateX(100%); opacity: 0; }

.pc-history-list { display: flex; flex-direction: column; gap: 4px; }
.pc-history-card {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 10px; border-radius: 5px; font-size: 12px;
  background: rgba(0, 180, 255, 0.03); border: 1px solid rgba(0, 180, 255, 0.06);
}
.pc-hist-main { color: #c7d5ea; }
.pc-hist-time { color: #5a7a9a; font-size: 11px; }
</style>
