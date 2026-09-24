<template>
  <transition name="panel-slide-right">
    <div v-if="show" class="pred-center-panel" :style="{ right: `${rightOffset}px` }">
      <!-- Header -->
      <div class="pc-header">
        <div class="pc-title-group">
          <button
            v-if="activeStage !== 'baseline' && selectedMethod"
            class="pc-back-btn"
            type="button"
            title="返回预测方法列表"
            @click="selectedMethod = null"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M11.8 4.5 6.3 10l5.5 5.5M6.8 10h7"></path></svg>
            <span>返回</span>
          </button>
          <div>
            <div class="pc-title">{{ selectedMethod ? selectedMethod.label : '围岩数字孪生模型' }}</div>
            <div v-if="!selectedMethod" class="pc-subtitle">
              {{ activeStageMeta.subtitle }}
            </div>
          </div>
        </div>
      </div>

      <!-- 同一围岩模型的连续演化状态轴 -->
      <div v-if="showStageNavigation" class="pc-stage-axis" role="tablist" aria-label="围岩模型演化阶段">
        <button
          v-for="(stage, index) in stages"
          :key="stage.key"
          class="pc-stage-btn"
          :class="{ active: activeStage === stage.key, completed: stageIndex > index }"
          role="tab"
          :aria-selected="activeStage === stage.key"
          @click="switchStage(stage.key)"
        >
          <span class="pc-stage-node">{{ index + 1 }}</span>
          <span class="pc-stage-label">{{ stage.label }}</span>
        </button>
      </div>

      <!-- 设计基准：作为全过程长期保留的基础背景 -->
      <div v-if="activeStage === 'baseline'" class="pc-body pc-design-body">
        <div class="pc-version-intro">
          <span class="pc-intro-mark">设</span>
          <div>
            <div class="pc-intro-title">设计基准模型</div>
            <div class="pc-intro-desc">依据勘察与设计资料建立初始围岩状态，作为后续预测更新和揭露校正的长期背景。</div>
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

        <div class="pc-design-section pc-grade-section">
          <div class="pc-section-title"><span class="pc-gi">▸</span> 围岩等级图例</div>
          <div class="pc-grade-legend">
            <div v-for="grade in rockGrades" :key="grade.level" class="pc-grade-item">
              <span class="pc-grade-color" :style="{ background: grade.color, boxShadow: `0 0 7px ${grade.color}` }"></span>
              <span class="pc-grade-level">{{ grade.level }}级</span>
              <span class="pc-grade-desc">{{ grade.description }}</span>
            </div>
          </div>
        </div>

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

      <!-- 超前预测 / 揭露校正：退出全量设计着色，恢复基础隧道分段加载并展示预测成果 -->
      <div v-else-if="!selectedMethod" class="pc-body">
        <div class="pc-version-intro pc-forecast-intro">
          <span class="pc-intro-mark" :class="activeStage">{{ activeStageMeta.mark }}</span>
          <div>
            <div class="pc-intro-title">{{ activeStageMeta.title }}</div>
            <div class="pc-intro-desc">{{ activeStageMeta.description }}</div>
          </div>
        </div>

        <div class="pc-evolution-stack">
          <div class="pc-section-title"><span class="pc-gi">▸</span> 模型叠加状态</div>
          <div class="pc-stack-row base">
            <span class="pc-stack-eye">●</span>
            <span class="pc-stack-name">基础隧道层</span>
            <span class="pc-stack-state">分段加载</span>
          </div>
          <div class="pc-stack-link">＋</div>
          <div class="pc-stack-row correction">
            <span class="pc-stack-eye">●</span>
            <span class="pc-stack-name">{{ activeStageMeta.layerName }}</span>
            <span class="pc-stack-state dynamic">动态叠加</span>
          </div>
        </div>

        <div class="pc-dynamic-section">
          <div class="pc-section-title"><span class="pc-gi">▸</span> 属性维度</div>
          <div class="pc-attribute-grid">
            <button
              v-for="attribute in modelAttributes"
              :key="attribute.key"
              class="pc-attribute-btn"
              :class="{ active: activeAttribute === attribute.key }"
              @click="selectAttribute(attribute.key)"
            >{{ attribute.label }}</button>
          </div>

          <div v-if="activeStage === 'prediction' && activeAttribute === 'grade' && activeAction === 'geophysical_grade'" class="pc-grade-controls">
            <div class="pc-grade-controls__head">
              <span>融合分级显示</span>
              <button type="button" @click="resetFusedGradeControls">恢复默认</button>
            </div>
            <div class="pc-grade-filter" aria-label="围岩等级显示筛选">
              <button
                v-for="grade in fusedGradeOptions"
                :key="grade.level"
                type="button"
                :class="{ active: grade.visible }"
                :aria-pressed="grade.visible"
                @click="toggleFusedGrade(grade.level)"
              >
                <i :style="{ background: grade.color }"></i>
                <span>{{ grade.roman }}级</span>
                <small>{{ grade.visible ? '显示' : '隐藏' }}</small>
              </button>
            </div>
            <label class="pc-grade-adjust">
              <span>透明度</span>
              <input v-model.number="fusedGradeOpacity" type="range" min="0.08" max="1" step="0.01" @input="updateFusedGradeOpacity">
              <b>{{ Math.round(fusedGradeOpacity * 100) }}%</b>
            </label>
            <label class="pc-grade-adjust">
              <span>对比度</span>
              <input v-model.number="fusedGradeContrast" type="range" min="0.6" max="2.4" step="0.05" @input="updateFusedGradeContrast">
              <b>{{ fusedGradeContrast.toFixed(2) }}</b>
            </label>
            <div class="pc-grade-controls__hint">等级筛选与显示参数将同步到中央隧道融合模型</div>
          </div>

          <div
            v-if="activeStage === 'prediction' && ['integrity', 'hardness'].includes(activeAttribute) && ['tsp_integrity', 'tsp_hardness'].includes(activeAction || '')"
            class="pc-tsp-attribute-result"
          >
            <div class="pc-grade-controls__head">
              <span>{{ activeAttribute === 'integrity' ? '完整程度解释结果' : '坚硬程度解释结果' }}</span>
              <em>TSP融合输入</em>
            </div>
            <div class="pc-tsp-class-list">
              <div v-for="item in activeTspAttributeClasses" :key="item.label">
                <i :style="{ background: item.color }"></i>
                <span>{{ item.label }}</span>
                <small>{{ item.rule }}</small>
              </div>
            </div>
            <label class="pc-grade-adjust">
              <span>透明度</span>
              <input v-model.number="tspAttributeOpacity" type="range" min="0.08" max="1" step="0.01" @input="updateTspAttributeOpacity">
              <b>{{ Math.round(tspAttributeOpacity * 100) }}%</b>
            </label>
            <label class="pc-grade-adjust">
              <span>对比度</span>
              <input v-model.number="tspAttributeContrast" type="range" min="0.6" max="2.4" step="0.05" @input="updateTspAttributeContrast">
              <b>{{ tspAttributeContrast.toFixed(2) }}</b>
            </label>
            <div class="pc-grade-controls__hint">
              {{ activeAttribute === 'integrity' ? 'I = 1 − 异常指数，仅表示TSP波速解释完整程度' : '依据TSP波速与动力学参数解释岩体坚硬程度' }}
            </div>
          </div>
        </div>

        <div class="pc-action-row">
          <button class="pc-action-btn" :class="{ active: showChanges }" @click="toggleChanges">
            <span>◈</span><span>{{ showChanges ? '隐藏变化' : '查看变化' }}</span>
          </button>
          <button class="pc-action-btn" :class="{ active: showDataBasis }" @click="showDataBasis = !showDataBasis">
            <span>▤</span><span>数据依据</span>
          </button>
        </div>

        <div v-if="showChanges" class="pc-change-panel">
          <div class="pc-change-title"><span class="pc-change-pulse"></span>设计—当前阶段差异</div>
          <div class="pc-change-desc">三维场景保留设计基准，仅高亮围岩等级变化、破碎区和富水区等动态修正结果。</div>
          <div class="pc-change-legend">
            <span><i class="grade"></i>等级变化</span>
            <span><i class="fracture"></i>破碎区</span>
            <span><i class="water"></i>富水区</span>
          </div>
        </div>

        <div v-if="showDataBasis" class="pc-basis-panel">
          <div v-for="item in activeStageMeta.basis" :key="item.label" class="pc-source-row">
            <span class="pc-source-label">{{ item.label }}</span>
            <span class="pc-source-value">{{ item.value }}</span>
          </div>
        </div>

        <div v-for="group in methodGroups" :key="group.title" class="pc-group">
          <div class="pc-group-title">
            <span class="pc-gi">▸</span> {{ group.title }}
          </div>
          <div class="pc-method-grid">
            <button
              v-for="m in group.methods"
              :key="m.key"
              type="button"
              class="pc-card"
              :class="{ active: activeAction === m.key, featured: m.key === 'tsp' }"
              @click="selectMethod(m)"
            >
              <span class="pc-card-icon">{{ m.icon }}</span>
              <span class="pc-card-info">
                <span class="pc-card-label">{{ m.label }}<span v-if="m.dataStatus === 'available'" class="pc-card-dot"></span></span>
                <span class="pc-card-status">{{ m.key === 'tsp' ? 'TSP 三维体素建模' : (m.key === 'tem' ? '电阻率体素 · 富水异常' : (m.key === 'geophysical_voxel' ? '对话框输入 · 三模型联动' : (m.dataStatus === 'available' ? '已接入 · 可叠加' : '待接入数据'))) }}</span>
              </span>
              <span class="pc-card-arrow">›</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Level 2: Method Detail (Tabs) -->
      <div v-else class="pc-body" :class="{ 'pc-body--tem': selectedMethod.key === 'tem' }">
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
            @view-in-scene="(jobId?: string, subType?: string) => handleViewInScene(jobId, subType)"
            @toggle-envelope="(show: boolean) => setJumboEnvelopeVisible(show)"
            @tem-opacity-change="setTemVolumeOpacity"
            @tem-slice-change="setTemVolumeSlice"
            @face-mileage-change="handleFaceMileageSelect"
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
              <div
                v-for="ds in historyDatasets"
                :key="ds.jobId"
                class="pc-history-card"
                :class="{ active: historySelectedJobId === ds.jobId }"
              >
                <div class="pc-hist-content">
                  <div class="pc-hist-main">{{ ds.mileage || `前向 ${ds.xRange?.map((v:number) => v.toFixed(0)).join('~') || '—'}m` }}</div>
                  <span class="pc-hist-time">{{ ds.createdAt ? ds.createdAt.slice(0, 16).replace('T', ' ') : '—' }}</span>
                  <span v-if="selectedMethod?.key === 'tem'" class="pc-hist-time">平均视电阻率 {{ Number(ds.kMean || 0).toFixed(1) }} Ω·m · {{ ds.anomalyCount ?? 0 }} 个富水异常体</span>
                </div>
                <button
                  v-if="selectedMethod?.key === 'tem'"
                  type="button"
                  class="pc-hist-view"
                  @click="viewTemHistoryResult(ds)"
                >{{ historySelectedJobId === ds.jobId ? '已显示' : '查看等值面' }}</button>
              </div>
            </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import ProcessTab from './PredictionCenter/ProcessTab.vue'
import MethodPreview from './PredictionCenter/MethodPreview.vue'
import {
  selectFaceSketchMileage,
  setFusedGradeContrast,
  setFusedGradeOpacity,
  setFusedGradeVisibility,
  setJumboEnvelopeVisible,
  setTemVolumeOpacity,
  setTemVolumeSlice,
  setTspAttributeContrast,
  setTspAttributeOpacity,
  loadTemAnomalyGlb,
} from '@/utils/Common/GeoModelController'
import type { DesignRockGradeSegment } from '@/utils/Common/DrawLine'

interface MethodCard {
  key: string
  label: string
  icon: string
  category: string
  stage: Exclude<ModelStage, 'baseline'>
  dataStatus: 'available' | 'pending'
  latestResult?: string
}

interface Action {
  key: string
  label: string
  icon: string
  type?: string
  subType?: 'vp' | 'vs' | 'hardness' | 'ratio' | 'anomaly' | 'integrity' | 'resistivity' | 'water' | 'isosurface'
}

const props = defineProps<{
  show: boolean
  activeAction?: string | null
  stage?: 'baseline' | 'prediction' | 'correction'
  rightOffset?: number
  showStageNavigation?: boolean
}>()

const rightOffset = computed(() => props.rightOffset ?? 0)
const showStageNavigation = computed(() => props.showStageNavigation ?? true)

const emit = defineEmits<{
  close: []
  action: [action: Action, type: 'view' | 'process']
  stageChange: [stage: ModelStage]
  attributeChange: [attribute: ModelAttribute]
  changesToggle: [show: boolean]
  segmentSelect: [segment: DesignRockGradeSegment]
}>()

const selectedMethod = ref<MethodCard | null>(null)
type ModelStage = 'baseline' | 'prediction' | 'correction'
type ModelAttribute = 'grade' | 'integrity' | 'hardness' | 'groundwater' | 'stress'
interface StageDefinition {
  key: ModelStage
  label: string
  subtitle: string
  mark: string
  title: string
  description: string
  layerName: string
  basis: { label: string; value: string }[]
}

const activeStage = ref<ModelStage>(props.stage ?? 'baseline')
const activeAttribute = ref<ModelAttribute>('grade')
const showChanges = ref(false)
const showDataBasis = ref(false)
const activeTab = ref<'preview' | 'process' | 'history'>('preview')
const refreshKey = ref(0)
const historyDatasets = ref<any[]>([])
const historyLoading = ref(false)
const historySelectedJobId = ref('')
const designSegments = ref<DesignRockGradeSegment[]>([])
const designGradeColors = ref<Record<string, string>>({})
const selectedDesignSegmentIndex = ref<number | null>(null)
const fusedGradeOpacity = ref(0.68)
const fusedGradeContrast = ref(1.25)
const tspAttributeOpacity = ref(0.68)
const tspAttributeContrast = ref(1.2)
const fusedGradeOptions = reactive([
  { level: 2 as const, roman: 'Ⅱ', color: '#5a9fc6', visible: true },
  { level: 3 as const, roman: 'Ⅲ', color: '#244b78', visible: true },
  { level: 4 as const, roman: 'Ⅳ', color: '#e8bd35', visible: true },
  { level: 5 as const, roman: 'Ⅴ', color: '#8f3f20', visible: true },
])
const tspAttributeClasses = {
  integrity: [
    { label: '极破碎', rule: 'I < 0.2', color: '#d73027' },
    { label: '破碎', rule: '0.2 ≤ I < 0.4', color: '#fc8d59' },
    { label: '较破碎', rule: '0.4 ≤ I < 0.6', color: '#fee08b' },
    { label: '较完整', rule: '0.6 ≤ I < 0.8', color: '#66c2a5' },
    { label: '完整', rule: 'I ≥ 0.8', color: '#2b83ba' },
  ],
  hardness: [
    { label: '极软岩', rule: 'Rc ≤ 5 MPa', color: '#d73027' },
    { label: '软岩', rule: '5 < Rc ≤ 15', color: '#fc8d59' },
    { label: '较软岩', rule: '15 < Rc ≤ 30', color: '#fee08b' },
    { label: '硬岩', rule: '30 < Rc ≤ 60', color: '#66c2a5' },
    { label: '极硬岩', rule: 'Rc > 60 MPa', color: '#4575b4' },
  ],
}
const activeTspAttributeClasses = computed(() => tspAttributeClasses[activeAttribute.value === 'hardness' ? 'hardness' : 'integrity'])

const stages: StageDefinition[] = [
  {
    key: 'baseline', label: '设计基准', subtitle: '初始状态 · 勘察设计资料', mark: '设',
    title: '设计基准模型', description: '依据勘察与设计资料建立的初始围岩状态。', layerName: '设计基准层',
    basis: [
      { label: '数据来源', value: '勘察及设计资料' },
      { label: '空间基准', value: '设计里程分段' },
    ],
  },
  {
    key: 'prediction', label: '超前预测', subtitle: '局部更新 · 掌子面前方', mark: '预',
    title: '超前预测更新',
    description: '融合 TRT/TSP、TEM、地质雷达和超前钻孔等数据，对掌子面前方围岩状态进行局部更新。',
    layerName: '超前预测修正层',
    basis: [
      { label: '实测来源', value: 'TRT/TSP、TEM、雷达、钻孔' },
      { label: '统一坐标', value: '里程—横向—高程' },
      { label: '空间单元', value: '统一体素网格' },
      { label: '融合依据', value: '覆盖范围、质量、可信度' },
    ],
  },
  {
    key: 'correction', label: '揭露校正', subtitle: '持续修正 · 实际揭露结果', mark: '校',
    title: '掌子面揭露校正',
    description: '结合掌子面素描、岩性、破碎和出水等实际揭露结果，校正已预测区域的围岩属性。',
    layerName: '揭露校正层',
    basis: [
      { label: '实测来源', value: '掌子面素描与现场记录' },
      { label: '校正对象', value: '已揭露围岩体素' },
      { label: '更新方式', value: '实测约束增量修正' },
    ],
  },
]

const activeStageMeta = computed(() => stages.find(stage => stage.key === activeStage.value) || stages[0])
const stageIndex = computed(() => stages.findIndex(stage => stage.key === activeStage.value))

const modelAttributes: { key: ModelAttribute; label: string }[] = [
  { key: 'grade', label: '围岩等级' },
  { key: 'integrity', label: '完整程度' },
  { key: 'hardness', label: '坚硬程度' },
  { key: 'groundwater', label: '地下水状态' },
  { key: 'stress', label: '初始地应力' },
]

const rockGrades = [
  { level: 'Ⅱ', description: '完整—较完整', color: '#5a9fc6' },
  { level: 'Ⅲ', description: '较完整—较破碎', color: '#244b78' },
  { level: 'Ⅳ', description: '较破碎', color: '#e8bd35' },
  { level: 'Ⅴ', description: '破碎—极破碎', color: '#8f3f20' },
]

function toggleFusedGrade(level: 2 | 3 | 4 | 5) {
  const grade = fusedGradeOptions.find(item => item.level === level)
  if (!grade) return
  grade.visible = !grade.visible
  setFusedGradeVisibility(level, grade.visible)
}

function updateFusedGradeOpacity() {
  setFusedGradeOpacity(fusedGradeOpacity.value)
}

function updateFusedGradeContrast() {
  setFusedGradeContrast(fusedGradeContrast.value)
}

function resetFusedGradeControls() {
  fusedGradeOpacity.value = 0.68
  fusedGradeContrast.value = 1.25
  for (const grade of fusedGradeOptions) {
    grade.visible = true
    setFusedGradeVisibility(grade.level, true)
  }
  updateFusedGradeOpacity()
  updateFusedGradeContrast()
}

function updateTspAttributeOpacity() {
  setTspAttributeOpacity(tspAttributeOpacity.value)
}

function updateTspAttributeContrast() {
  setTspAttributeContrast(tspAttributeContrast.value)
}

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
  if (!selectedMethod.value) {
    historyDatasets.value = []
    historyLoading.value = false
    return
  }
  try {
    const r = await fetch(`/data/${selectedMethod.value.key}_output/index.json`)
    if (r.ok) historyDatasets.value = await r.json()
  } catch { historyDatasets.value = [] }
  historyLoading.value = false
}

function viewTemHistoryResult(dataset: { jobId?: string }) {
  if (!dataset.jobId) return
  historySelectedJobId.value = dataset.jobId
  loadTemAnomalyGlb(undefined, `data/tem_output/${dataset.jobId}`)
}

const tabs = computed(() => selectedMethod.value?.key === 'tsp'
  ? [
      { key: 'preview' as const, label: '体素模型' },
      { key: 'process' as const, label: '构建模型' },
      { key: 'history' as const, label: '历史版本' },
    ]
  : selectedMethod.value?.key === 'tem'
    ? [
        { key: 'preview' as const, label: '数据预览' },
        { key: 'process' as const, label: '新建处理' },
        { key: 'history' as const, label: '历史记录' },
      ]
    : [
      { key: 'preview' as const, label: '数据预览' },
      { key: 'process' as const, label: '新建处理' },
      { key: 'history' as const, label: '历史记录' },
    ])

const METHODS: MethodCard[] = [
  { key: 'geophysical_voxel', label: '综合物探体素建模', icon: '◇', category: '融合建模', stage: 'prediction', dataStatus: 'available' },
  { key: 'tsp', label: '地震波反射', icon: '◉', category: '预测数据源', stage: 'prediction', dataStatus: 'pending' },
  { key: 'tem', label: '瞬变电磁', icon: '⚡', category: '预测数据源', stage: 'prediction', dataStatus: 'available' },
  { key: 'gpr', label: '地质雷达', icon: '≋', category: '预测数据源', stage: 'prediction', dataStatus: 'pending' },
  { key: 'face_sketch', label: '掌子面照片与素描', icon: '⬡', category: '预测数据源', stage: 'prediction', dataStatus: 'available' },
]

const methodGroups = computed(() => {
  const groups: { title: string; methods: MethodCard[] }[] = []
  const seen = new Set<string>()
  const stageMethods = activeStage.value === 'correction'
    ? METHODS.filter(method => method.key === 'face_sketch')
    : METHODS.filter(method => method.stage === activeStage.value)
  if (activeStage.value === 'correction') {
    return [{ title: '揭露资料', methods: stageMethods }]
  }
  for (const m of stageMethods) {
    if (!seen.has(m.category)) {
      seen.add(m.category)
      groups.push({ title: m.category, methods: stageMethods.filter(x => x.category === m.category) })
    }
  }
  return groups
})

function handleViewInScene(jobId?: string, subType?: string) {
  if (selectedMethod.value?.key === 'tem') {
    emit('action', {
      key: 'tem',
      label: selectedMethod.value.label,
      icon: selectedMethod.value.icon,
      subType: subType === 'water' || subType === 'isosurface' ? subType : 'resistivity',
    }, 'view')
    return
  } else if (selectedMethod.value) {
    emit('action', {
      key: selectedMethod.value.key,
      label: selectedMethod.value.label,
      icon: selectedMethod.value.icon,
      subType: selectedMethod.value.key === 'tsp'
        ? (['vp', 'hardness', 'ratio', 'anomaly', 'integrity'].includes(subType || '')
            ? subType as 'vp' | 'hardness' | 'ratio' | 'anomaly' | 'integrity'
            : 'vs')
        : undefined,
    }, 'view')
  }
}

function handleFaceMileageSelect(mileage: string) {
  const alreadyActive = props.activeAction === 'face_sketch'
  // 未激活时先保存目标里程，再由场景激活流程加载全部照片；已激活则直接飞行。
  selectFaceSketchMileage(mileage, alreadyActive)
  if (!alreadyActive) handleViewInScene()
}

function selectMethod(m: MethodCard) {
  if (m.key === 'geophysical_voxel') {
    emit('action', {
      key: m.key,
      label: m.label,
      icon: m.icon,
    }, 'view')
    return
  }
  selectedMethod.value = m
  activeTab.value = 'preview'
}

function applyStage(stage: ModelStage) {
  activeStage.value = stage
  selectedMethod.value = null
  selectedDesignSegmentIndex.value = null
  activeTab.value = 'preview'
  showChanges.value = false
  showDataBasis.value = false
  if (stage === 'baseline') loadDesignSegments()
}

function switchStage(stage: ModelStage) {
  applyStage(stage)
  emit('stageChange', stage)
}

watch(() => props.stage, (stage) => {
  if (stage && stage !== activeStage.value) applyStage(stage)
})

function selectAttribute(attribute: ModelAttribute) {
  activeAttribute.value = attribute
  emit('attributeChange', attribute)
  if (activeStage.value === 'prediction' && attribute === 'grade') {
    emit('action', {
      key: 'geophysical_grade',
      label: '综合围岩分级模型',
      icon: '◆',
    }, 'view')
  } else if (activeStage.value === 'prediction' && attribute === 'integrity') {
    emit('action', {
      key: 'tsp_integrity',
      label: 'TSP完整程度模型',
      icon: '◉',
    }, 'view')
  } else if (activeStage.value === 'prediction' && attribute === 'hardness') {
    emit('action', {
      key: 'tsp_hardness',
      label: 'TSP坚硬程度模型',
      icon: '◆',
    }, 'view')
  }
}

function toggleChanges() {
  showChanges.value = !showChanges.value
  emit('changesToggle', showChanges.value)
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

async function checkDataAvailability() {
  const checks: Record<string, string> = {
    face_sketch: '/data/face_sketch/X1DK2_905_0_fitted.jpg',
    gpr: '/data/gpr/gpr1/1665832_1.glb',
    horiz_drill: '/data/ahd/ahd1/2320835.glb',
    tsp: '/data/tsp_actual/metadata.json',
    jumbo_rig: '/data/jumbo/jumbo_solid.glb',
  }
  for (const m of METHODS) {
    const url = checks[m.key]
    if (!url) continue
    try {
      const r = await fetch(url, { method: 'HEAD' })
      if (r.ok) m.dataStatus = 'available'
    } catch { /* no data, stays pending */ }
  }
}

onMounted(() => {
  checkDataAvailability()
})
</script>

<style scoped lang="scss">
.pred-center-panel {
  position: absolute;
  right: 0;
  top: 60px;
  bottom: 0;
  width: var(--rock-right-rail, 380px);
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
  display: flex; align-items: center; gap: 9px;
  padding: 14px 16px 12px;
  border-bottom: 1px solid rgba(0, 180, 255, 0.12);
}
.pc-title-group { min-width:0; display: flex; align-items: center; gap: 8px; }
.pc-title { font-size: 16px; font-weight: 700; color: #7dd3fc; }
.pc-subtitle { margin-top: 2px; font-size: 10px; color: #587897; letter-spacing: .5px; }
.pc-back-btn {
  height: 28px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  border: 1px solid rgba(0, 190, 235, .32);
  border-radius: 3px;
  color: #9fc8d8;
  background: rgba(0, 72, 105, .24);
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: .18s ease;
  svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  &:hover {
    color: #fff;
    border-color: #27d6f5;
    background: rgba(39, 214, 245, .14);
    box-shadow: 0 0 9px rgba(39, 214, 245, .18);
  }
}
.pc-stage-axis {
  position: relative;
  display: grid; grid-template-columns: repeat(3, 1fr);
  padding: 12px 10px 10px;
  border-bottom: 1px solid rgba(0, 180, 255, 0.1);
  background: rgba(0, 20, 44, 0.4);
  &::before {
    content: ''; position: absolute; left: 52px; right: 52px; top: 23px; height: 1px;
    background: linear-gradient(90deg, rgba(0,234,255,.75), rgba(0,234,255,.22));
  }
}
.pc-stage-btn {
  position: relative; z-index: 1;
  display: flex; flex-direction: column; align-items: center; gap: 5px;
  border: 0; background: transparent; color: #607d99;
  font-size: 11px; font-family: inherit; cursor: pointer;
  .pc-stage-node {
    display: flex; align-items: center; justify-content: center;
    width: 22px; height: 22px; border-radius: 50%;
    border: 1px solid rgba(0, 170, 220, .35); background: #061528;
    color: #63839f; font-size: 10px; transition: .18s;
  }
  &:hover { color: #bfeaff; }
  &.completed .pc-stage-node { color: #00d8eb; border-color: rgba(0, 216, 235, .55); }
  &.active {
    color: #dffaff; font-weight: 600;
    .pc-stage-node {
      color: #00121d; border-color: #00eaff; background: #00eaff;
      box-shadow: 0 0 10px rgba(0, 234, 255, .65);
    }
  }
}

.pc-body { flex: 1; overflow-y: auto; padding: 8px 0; }
.pc-body--tem {
  scrollbar-width: none;
  -ms-overflow-style: none;
  &::-webkit-scrollbar { display: none; width: 0; height: 0; }
}
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
  &.prediction { color: #b6a2ff; border-color: rgba(160, 130, 255, .5); background: rgba(130, 90, 255, .12); }
  &.correction { color: #65f4b0; border-color: rgba(70, 235, 160, .5); background: rgba(40, 190, 130, .12); }
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

.pc-evolution-stack, .pc-dynamic-section { margin: 0 12px 12px; }
.pc-stack-row {
  display: grid; grid-template-columns: 14px 1fr auto; align-items: center; gap: 7px;
  padding: 8px 10px; border: 1px solid rgba(0, 180, 255, .1); border-radius: 5px;
  background: rgba(0, 45, 80, .2); font-size: 11px;
  &.base .pc-stack-eye { color: #54829f; }
  &.correction { border-color: rgba(0, 234, 255, .28); background: rgba(0, 160, 205, .09); }
  &.correction .pc-stack-eye { color: #00eaff; text-shadow: 0 0 7px #00eaff; }
}
.pc-stack-name { color: #b9d4e8; }
.pc-stack-state { color: #627f99; font-size: 10px; }
.pc-stack-state.dynamic { color: #60dff0; }
.pc-stack-link { height: 12px; color: rgba(0, 220, 255, .45); line-height: 12px; text-align: center; }

.pc-attribute-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
.pc-attribute-btn {
  min-height: 31px; padding: 6px 7px; border-radius: 4px;
  border: 1px solid rgba(0, 170, 220, .12); background: rgba(0, 55, 95, .15);
  color: #738fa9; font-size: 11px; font-family: inherit; cursor: pointer; transition: .16s;
  &:last-child { grid-column: 1 / -1; }
  &:hover { color: #ccecff; border-color: rgba(0, 210, 255, .32); }
  &.active { color: #00eaff; border-color: rgba(0, 234, 255, .55); background: rgba(0, 170, 215, .16); }
}

.pc-grade-controls {
  margin-top: 8px; padding: 9px; border-radius: 6px;
  border: 1px solid rgba(0, 210, 235, .2);
  background: linear-gradient(145deg, rgba(0, 72, 102, .22), rgba(2, 18, 34, .34));
}
.pc-grade-controls__head {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px;
  color: #9cc8d6; font-size: 10px;
  button {
    padding: 2px 6px; border: 0; background: transparent; color: #4f91a7;
    font: inherit; cursor: pointer;
    &:hover { color: #00eaff; }
  }
}
.pc-grade-filter {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; margin-bottom: 9px;
  button {
    display: grid; grid-template-columns: 8px 1fr; align-items: center; column-gap: 4px;
    min-width: 0; padding: 6px 5px; border-radius: 4px;
    border: 1px solid rgba(90, 120, 140, .16); background: rgba(3, 20, 32, .55);
    color: #526c7e; font: inherit; cursor: pointer;
    i { width: 7px; height: 7px; border-radius: 2px; opacity: .28; filter: grayscale(.45); }
    span { font-size: 11px; font-weight: 600; }
    small { grid-column: 1 / -1; margin-top: 2px; font-size: 8px; color: #425967; }
    &.active {
      color: #d2e8ed; border-color: rgba(0, 210, 235, .34); background: rgba(0, 112, 135, .18);
      i { opacity: 1; filter: none; box-shadow: 0 0 5px currentColor; }
      small { color: #63aabb; }
    }
  }
}
.pc-grade-adjust {
  display: grid; grid-template-columns: 38px 1fr 34px; align-items: center; gap: 7px;
  min-height: 25px; color: #7694a6; font-size: 9px;
  input { width: 100%; height: 3px; margin: 0; accent-color: #35c2d6; cursor: pointer; }
  b { color: #9fc2ce; font-size: 9px; font-weight: 500; text-align: right; font-variant-numeric: tabular-nums; }
}
.pc-grade-controls__hint {
  margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(0, 190, 220, .08);
  color: #486a7b; font-size: 8px; text-align: center;
}
.pc-tsp-attribute-result {
  margin-top: 8px; padding: 9px; border-radius: 6px;
  border: 1px solid rgba(0, 210, 235, .2);
  background: linear-gradient(145deg, rgba(0, 72, 102, .22), rgba(2, 18, 34, .34));
  .pc-grade-controls__head em { color: #4d8191; font-size: 8px; font-style: normal; }
}
.pc-tsp-class-list {
  display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 8px;
  div {
    display: grid; grid-template-columns: 8px 1fr; align-items: center; gap: 4px;
    min-width: 0; padding: 5px; border-radius: 3px; background: rgba(2, 18, 29, .45);
    &:last-child:nth-child(odd) { grid-column: 1 / -1; }
  }
  i { width: 7px; height: 7px; border-radius: 2px; }
  span { color: #b8d0d9; font-size: 9px; }
  small { grid-column: 1 / -1; color: #567687; font-size: 7px; white-space: nowrap; }
}

.pc-action-row { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 0 12px 12px; }
.pc-action-btn {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  height: 34px; border-radius: 5px; border: 1px solid rgba(0, 190, 235, .2);
  background: rgba(0, 70, 115, .14); color: #87a9c3; font-size: 11px; font-family: inherit; cursor: pointer;
  &:hover, &.active { color: #00eaff; border-color: rgba(0, 234, 255, .55); background: rgba(0, 160, 210, .15); }
}

.pc-change-panel, .pc-basis-panel {
  margin: 0 12px 12px; padding: 10px; border-radius: 5px;
  border: 1px solid rgba(255, 190, 40, .22); background: rgba(100, 65, 0, .1);
}
.pc-basis-panel { padding: 0; overflow: hidden; border-color: rgba(0, 190, 235, .16); background: rgba(0, 40, 75, .18); }
.pc-change-title { display: flex; align-items: center; gap: 7px; color: #ffd45b; font-size: 11px; font-weight: 600; }
.pc-change-pulse { width: 7px; height: 7px; border-radius: 50%; background: #ffcc00; box-shadow: 0 0 8px #ffcc00; }
.pc-change-desc { margin: 7px 0; color: #8da3b5; font-size: 10px; line-height: 1.55; }
.pc-change-legend { display: flex; flex-wrap: wrap; gap: 8px; color: #71899d; font-size: 9px; }
.pc-change-legend span { display: flex; align-items: center; gap: 4px; }
.pc-change-legend i { width: 6px; height: 6px; border-radius: 50%; }
.pc-change-legend .grade { background: #ffcc00; }
.pc-change-legend .fracture { background: #ff6655; }
.pc-change-legend .water { background: #33b5ff; }

.pc-grade-legend {
  display: grid; grid-template-columns: 1fr 1fr; gap: 5px;
}
.pc-grade-section .pc-section-title { font-size: 14px; }
.pc-grade-item {
  display: grid; grid-template-columns: 8px 28px 1fr; align-items: center; gap: 6px;
  padding: 9px 8px; border-radius: 4px;
  background: rgba(0, 45, 80, .18); border: 1px solid rgba(0, 180, 255, .07);
}
.pc-grade-color { width: 7px; height: 7px; border-radius: 50%; }
.pc-grade-level { color: #cce3f6; font-size: 13px; font-weight: 600; }
.pc-grade-desc { color: #7894ad; font-size: 11px; white-space: nowrap; }

.pc-segment-section { margin-top: 0; }
.pc-segment-section .pc-section-title { font-size: 14px; }
.pc-section-count { margin-left: auto; color: #6685a1; font-size: 12px; }
.pc-segment-list {
  max-height: 190px; overflow-y: auto;
  border: 1px solid rgba(0, 180, 255, .08); border-radius: 5px;
  scrollbar-width: thin; scrollbar-color: rgba(0, 180, 255, .3) transparent;
}
.pc-segment-row {
  display: grid; grid-template-columns: 8px 1fr 32px 10px; align-items: center; gap: 7px;
  padding: 9px 8px; border-bottom: 1px solid rgba(0, 180, 255, .06);
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
.pc-segment-mileage { color: #a8c2d8; font-size: 12px; font-family: 'Consolas', monospace; }
.pc-segment-grade { font-size: 13px; font-weight: 700; text-align: right; }
.pc-segment-arrow { color: #3c607e; font-size: 15px; text-align: right; }
.pc-segment-row:hover .pc-segment-arrow,
.pc-segment-row.active .pc-segment-arrow { color: #00eaff; }

.pc-group { margin: 0 12px 4px; }
.pc-group-title {
  font-size: 13px; color: #5a7a9a; padding: 8px 4px 6px;
  display: flex; align-items: center; gap: 4px;
}
.pc-gi { color: #00eaff; font-size: 10px; }
.pc-method-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }

.pc-card {
  position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 6px;
  min-width: 0; min-height: 84px; padding: 11px 10px; border-radius: 6px; cursor: pointer;
  border: 1px solid rgba(0, 180, 255, 0.06);
  background: rgba(0, 180, 255, 0.03);
  color: inherit; font-family: inherit; text-align: left; transition: .15s;
  &:hover { background: rgba(0, 200, 255, 0.08); border-color: rgba(0, 200, 255, 0.2); }
  &.active { border-color: rgba(0, 234, 255, 0.3); background: rgba(0, 200, 255, 0.1); }
  &.featured {
    border-color: rgba(0, 234, 255, .38);
    background: linear-gradient(145deg, rgba(0, 185, 225, .15), rgba(0, 55, 100, .12));
    box-shadow: inset 0 0 14px rgba(0, 220, 255, .05);
  }
}
.pc-card-icon { color: #67dcf3; font-size: 21px; line-height: 1; }
.pc-card-info { flex: 1; min-width: 0; }
.pc-card-label { display: block; color: #d7e3f5; font-size: 12px; font-weight: 600; line-height: 1.3; margin-bottom: 3px; }
.pc-card-status { display: block; color: #587590; font-size: 9px; line-height: 1.25; }
.pc-card-dot {
  display: inline-block; width: 8px; height: 8px; border-radius: 50%;
  background: #44ff88; margin-left: 6px; vertical-align: middle;
  box-shadow: 0 0 6px rgba(68, 255, 136, 0.5);
}
.pc-card-arrow { position: absolute; top: 8px; right: 8px; color: #3b6684; font-size: 16px; }

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
  transition: .15s;
  &.active { border-color: rgba(0, 234, 255, .42); background: rgba(0, 200, 255, .09); }
}
.pc-hist-content { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.pc-hist-main { color: #c7d5ea; }
.pc-hist-time { color: #5a7a9a; font-size: 10px; }
.pc-hist-view {
  flex-shrink: 0; margin-left: 8px; padding: 5px 7px; border-radius: 4px;
  border: 1px solid rgba(0, 208, 235, .24); color: #60d9ec;
  background: rgba(0, 180, 220, .08); font-size: 9px; cursor: pointer;
  &:hover { border-color: rgba(0, 234, 255, .55); background: rgba(0, 200, 235, .16); }
}

/* 围岩右栏加宽后的可读性规格。 */
.pc-header { padding: 16px 18px 14px; }
.pc-title { font-size: 18px; }
.pc-subtitle { margin-top: 4px; font-size: 12px; line-height: 1.4; }
.pc-body { padding-inline: 4px; }
.pc-version-intro { padding: 14px; }
.pc-intro-title { font-size: 15px; }
.pc-intro-desc { font-size: 12px; line-height: 1.7; }
.pc-section-title,.pc-group-title { font-size: 13px; }
.pc-source-label,.pc-source-value,.pc-stack-name,.pc-attribute-btn { font-size: 12px; }
.pc-stack-state { font-size: 11px; }
.pc-grade-controls__head { font-size: 12px; }
.pc-grade-filter button span { font-size: 12px; }
.pc-grade-filter button small { font-size: 10px; }
.pc-grade-adjust { min-height: 30px; font-size: 11px; }
.pc-grade-adjust b { font-size: 11px; }
.pc-grade-controls__hint { font-size: 10px; line-height: 1.5; }
.pc-action-btn { min-height: 38px; font-size: 12px; }
.pc-change-title { font-size: 12px; }
.pc-change-desc { font-size: 11px; }
.pc-change-legend { font-size: 10px; }
.pc-grade-desc { font-size: 12px; }
.pc-segment-mileage { font-size: 13px; }
.pc-card { min-height: 92px; padding: 13px 12px; }
.pc-card-label { font-size: 13px; }
.pc-card-status { font-size: 11px; line-height: 1.35; }
.pc-hist-time,.pc-hist-view { font-size: 11px; }
</style>
