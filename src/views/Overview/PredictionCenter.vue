<template>
  <transition name="panel-slide-right">
    <div v-if="show" class="pred-center-panel">
      <!-- Header -->
      <div class="pc-header">
        <div class="pc-title-group">
          <button v-if="selectedMethod" class="pc-back-btn" @click="selectedMethod = null">‹ 返回</button>
          <div class="pc-title">{{ selectedMethod ? selectedMethod.label : '超报数据中心' }}</div>
        </div>
        <button class="pc-close" @click="$emit('close')" title="关闭">×</button>
      </div>

      <!-- Level 1: Method Card List -->
      <div v-if="!selectedMethod" class="pc-body">
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
}>()

const selectedMethod = ref<MethodCard | null>(null)
const activeTab = ref<'preview' | 'process' | 'history'>('preview')
const refreshKey = ref(0)
const historyDatasets = ref<any[]>([])
const historyLoading = ref(false)

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

.pc-body { flex: 1; overflow-y: auto; padding: 8px 0; }

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
