<template>
  <transition name="panel-slide-left">
    <div v-if="show" class="scene-data-panel" :style="{ '--sc': sceneColor }">
      <!-- 面板顶部 -->
      <div class="sdp-header">
        <span class="sdp-icon">{{ sceneIcon }}</span>
        <div class="sdp-title-group">
          <div class="sdp-title">{{ sceneName }}</div>
          <div class="sdp-sub">实时数据监测</div>
        </div>
        <span class="sdp-live-dot"></span>
      </div>

      <!-- 关键指标网格 -->
      <div class="sdp-metrics">
        <div
          v-for="m in metrics"
          :key="m.label"
          class="sdp-metric-item"
          :class="m.level"
        >
          <div class="sdp-m-val">
            {{ m.val }}<span class="sdp-m-unit">{{ m.unit }}</span>
          </div>
          <div class="sdp-m-label">{{ m.label }}</div>
        </div>
      </div>

      <!-- 趋势折线（迷你图） -->
      <div class="sdp-chart-section">
        <div class="sdp-chart-title">
          <span class="sdp-chart-icon">▸</span>{{ chartTitle }}
        </div>
        <div class="sdp-mini-chart">
          <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none">
            <!-- 网格 -->
            <line v-for="i in 4" :key="i" :y1="H/4*i" :y2="H/4*i" x1="0" :x2="W"
                  stroke="rgba(0,180,255,0.08)" stroke-width="1"/>
            <!-- 面积填充 -->
            <path :d="areaPath" :fill="`url(#grad_${sceneKey})`" />
            <!-- 折线 -->
            <polyline :points="linePoints" fill="none" :stroke="sceneColor" stroke-width="2" stroke-linejoin="round"/>
            <!-- 定义渐变 -->
            <defs>
              <linearGradient :id="`grad_${sceneKey}`" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" :stop-color="sceneColor" stop-opacity="0.35"/>
                <stop offset="100%" :stop-color="sceneColor" stop-opacity="0.02"/>
              </linearGradient>
            </defs>
          </svg>
          <div class="sdp-chart-labels">
            <span v-for="l in chartLabels" :key="l" class="sdp-chl">{{ l }}</span>
          </div>
        </div>
      </div>

      <!-- 状态列表 -->
      <div class="sdp-status-list">
        <div class="sdp-list-title">
          <span class="sdp-chart-icon">▸</span>状态详情
        </div>
        <div v-for="s in statusList" :key="s.label" class="sdp-status-row">
          <span class="sdp-status-key">{{ s.label }}</span>
          <div class="sdp-status-bar-wrap">
            <div
              class="sdp-status-bar"
              :style="{ width: s.pct + '%', background: statusBarColor(s.level) }"
            ></div>
          </div>
          <span class="sdp-status-val" :class="s.level">{{ s.val }}</span>
        </div>
      </div>

      <!-- 风场模拟（通风场景专用） -->
      <div v-if="props.sceneKey === 'vent'" class="sdp-wind-sim">
        <div class="sdp-list-title">
          <span class="sdp-chart-icon">▸</span>风场模拟
        </div>
        <div class="wind-toggle-row">
          <span class="wind-toggle-label">模拟开关</span>
          <el-switch
            v-model="windEnabled"
            active-color="#1b91ff"
            inactive-color="#406a9b"
            size="small"
            @change="onWindToggle"
          />
        </div>
        <template v-if="windEnabled">
          <div class="wind-power-row">
            <input
              type="range"
              class="wind-power-slider"
              :value="windPower"
              :min="1"
              :max="12"
              :step="1"
              :style="{ background: `linear-gradient(to right, #059cfa 0%, #059cfa ${(windPower - 1) / 11 * 100}%, rgba(0,50,100,0.3) ${(windPower - 1) / 11 * 100}%, rgba(0,50,100,0.3) 100%)` }"
              @input="onWindPowerChange"
            />
            <span class="wind-power-val">{{ windPower }} 级</span>
          </div>
        </template>
      </div>

      <!-- 结构树（支护场景） -->
      <div v-if="structureTree.length" class="sdp-structure-tree">
        <div class="sdp-list-title">
          <span class="sdp-chart-icon">▸</span>结构树
        </div>
        <template v-for="node in structureTree" :key="node.id">
          <!-- 父节点 -->
          <div class="st-group">
            <div class="st-parent" @click="toggleNodeExpand(node.id)">
              <span class="st-arrow" :class="{ open: isNodeExpanded(node) }">▶</span>
              <span class="st-icon">{{ node.icon }}</span>
              <span class="st-label">{{ node.label }}</span>
            </div>
            <!-- 子节点 -->
            <div v-show="isNodeExpanded(node)" class="st-children">
              <div
                v-for="child in node.children"
                :key="child.id"
                class="st-leaf"
                @click="toggleNodeVisible(child.id)"
              >
                <span class="st-check" :class="{ on: nodeVisible[child.id] ?? child.visible }">
                  {{ (nodeVisible[child.id] ?? child.visible) ? '✓' : '' }}
                </span>
                <span class="st-icon">{{ child.icon }}</span>
                <span class="st-label">{{ child.label }}</span>
                <button
                  class="st-hl"
                  :class="{ on: nodeHighlight[child.id] }"
                  @click.stop="toggleNodeHighlight(child.id)"
                >高亮</button>
              </div>
              <div v-if="!node.children?.length" class="st-empty">暂无部件</div>
            </div>
          </div>
        </template>
      </div>

      <!-- 告警提示 -->
      <div v-if="alerts.length" class="sdp-alerts">
        <div class="sdp-alert-title">
          <span class="sdp-alert-dot"></span>活跃预警
        </div>
        <div v-for="a in alerts" :key="a.id" class="sdp-alert-item" :class="a.level">
          <span class="sdp-alert-lv">{{ a.level === 'warn' ? '⚠' : '●' }}</span>
          <span class="sdp-alert-text">{{ a.text }}</span>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { setRebarMeshesVisible, loadRebarMeshes, setRebarHighlight } from '@/utils/Common/DrawLine';
import { startWind, changePower, removeFlowLine, getCurrentPower } from '@/utils/Common/WindFieldSimulation';
import { DTScopeEngine } from '@/utils/Common/Viewer';

export interface LayerItem { key: string; name: string; }
interface Metric  { label: string; val: string; unit: string; level?: string }
interface Status  { label: string; val: string; pct: number; level?: string }
interface Alert   { id: string; text: string; level: 'warn' | 'info' }
interface TreeNode { id: string; label: string; icon?: string; visible?: boolean; children?: TreeNode[]; defaultExpanded?: boolean }

// 场景数据定义
interface SceneData {
  icon: string; name: string; color: string;
  chartTitle: string; chartLabels: string[];
  chartValues: number[];
  metrics: Metric[];
  statusList: Status[];
  alerts: Alert[];
  structureTree?: TreeNode[];
}

const SCENE_DATA: Record<string, SceneData> = {
  workface: {
    icon: '⬡', name: '隧洞围岩', color: '#00e5ff',
    chartTitle: '近7天进尺(m)', chartLabels: ['04', '05', '06', '07', '08', '09', '10'],
    chartValues: [2.8, 3.1, 2.5, 3.5, 4.0, 3.2, 3.5],
    metrics: [
      { label: '围岩等级', val: 'V', unit: '级', level: 'level-danger' },
      { label: '循环进尺', val: '3.5', unit: 'm' },
      { label: '断面面积', val: '82.3', unit: 'm²' },
      { label: '当前工序', val: '钻孔', unit: '' },
      { label: '在岗人数', val: '12', unit: '人' },
      { label: '今日进尺', val: '3.5', unit: 'm', level: 'level-good' },
    ],
    statusList: [
      { label: '围岩稳定性', val: '中等', pct: 55, level: 'warn' },
      { label: '超前支护', val: '已施做', pct: 90, level: 'good' },
      { label: '地下水', val: '少量渗水', pct: 30, level: 'info' },
      { label: '瓦斯浓度', val: '0.0%', pct: 0, level: 'good' },
    ],
    alerts: [
      { id: 'a1', text: '前方30m疑似富水断裂带，加强超前探孔', level: 'warn' },
    ],
  },
  support: {
    icon: '◈', name: '支护监测', color: '#aa88ff',
    chartTitle: '拱顶沉降趋势(mm)', chartLabels: ['04', '05', '06', '07', '08', '09', '10'],
    chartValues: [8.1, 9.5, 10.2, 11.0, 11.8, 12.1, 12.4],
    metrics: [
      { label: '监测断面', val: '36', unit: '个' },
      { label: '拱顶沉降', val: '12.4', unit: 'mm', level: 'level-warn' },
      { label: '水平收敛', val: '8.2', unit: 'mm' },
      { label: '净空面积', val: '7.6', unit: 'm²' },
      { label: '初支厚度', val: '20', unit: 'cm' },
      { label: '喷锚完成', val: '98', unit: '%', level: 'level-good' },
    ],
    statusList: [
      { label: '结构稳定性', val: '稳定', pct: 85, level: 'good' },
      { label: '沉降速率', val: '0.3mm/d', pct: 35, level: 'info' },
      { label: '锚杆应力', val: '正常', pct: 70, level: 'good' },
      { label: '二衬进度', val: '72%', pct: 72, level: 'good' },
    ],
    alerts: [],
    structureTree: [
      {
        id: 'primary_support',
        label: '初支结构',
        icon: '◈',
        defaultExpanded: true,
        children: [
          { id: 'rebar', label: '钢筋衬砌', icon: '⬡', visible: false },
        ],
      },
      {
        id: 'secondary_lining',
        label: '二次衬砌',
        icon: '⬡',
        defaultExpanded: false,
        children: [],
      },
    ],
  },
  vent: {
    icon: '≋', name: '通风系统', color: '#44ff88',
    chartTitle: '风速变化(m/s)', chartLabels: ['04', '05', '06', '07', '08', '09', '10'],
    chartValues: [2.8, 3.0, 3.2, 2.9, 3.1, 3.4, 3.2],
    metrics: [
      { label: '风速', val: '3.2', unit: 'm/s' },
      { label: '风量', val: '248', unit: 'm³/min' },
      { label: '隧道温度', val: '18.5', unit: '°C' },
      { label: 'CO浓度', val: '15', unit: 'ppm' },
      { label: '粉尘浓度', val: '12', unit: 'mg/m³' },
      { label: '氧气含量', val: '20.9', unit: '%', level: 'level-good' },
    ],
    statusList: [
      { label: '主风机', val: '运行中', pct: 100, level: 'good' },
      { label: '风筒完好率', val: '96%', pct: 96, level: 'good' },
      { label: 'CO浓度', val: '正常', pct: 15, level: 'info' },
      { label: '粉尘指数', val: '正常', pct: 24, level: 'info' },
    ],
    alerts: [],
  },
  dispatch: {
    icon: '◎', name: '调度中心', color: '#ffaa00',
    chartTitle: '今日出渣量(m³)', chartLabels: ['06h', '08h', '10h', '12h', '14h', '16h', '18h'],
    chartValues: [0, 55, 120, 185, 260, 350, 420],
    metrics: [
      { label: '在岗人员', val: '28', unit: '人' },
      { label: '在用设备', val: '6', unit: '台' },
      { label: '今日出渣', val: '420', unit: 'm³', level: 'level-good' },
      { label: '运渣趟次', val: '14', unit: '趟' },
      { label: '完成工序', val: '5', unit: '道' },
      { label: '当班效率', val: '92', unit: '%', level: 'level-good' },
    ],
    statusList: [
      { label: '挖掘机', val: '作业中', pct: 100, level: 'good' },
      { label: '装载机', val: '作业中', pct: 100, level: 'good' },
      { label: '渣车调度', val: '2台在途', pct: 80, level: 'good' },
      { label: '通道畅通', val: '正常', pct: 100, level: 'good' },
    ],
    alerts: [],
  },
};

const W = 260, H = 70;

const props = defineProps<{
  show: boolean;
  sceneKey: string | null;
  isModelViewMode: boolean;
}>();

const emit = defineEmits<{
  'select-layer': [item: LayerItem];
}>();

const data = computed(() => (props.sceneKey ? SCENE_DATA[props.sceneKey] : null));
const sceneIcon  = computed(() => data.value?.icon  ?? '');
const sceneName  = computed(() => data.value?.name  ?? '');
const sceneColor = computed(() => data.value?.color ?? '#00e5ff');
const chartTitle = computed(() => data.value?.chartTitle ?? '');
const chartLabels = computed(() => data.value?.chartLabels ?? []);
const metrics    = computed(() => data.value?.metrics    ?? []);
const statusList = computed(() => data.value?.statusList ?? []);

const alerts        = computed(() => data.value?.alerts        ?? []);
const structureTree = computed(() => data.value?.structureTree ?? []);

// 结构树展开/折叠状态
const expandedNodes = reactive<Record<string, boolean>>({});
// 节点可见性（默认从 tree 定义读取）
const nodeVisible = reactive<Record<string, boolean>>({});

// ── 风场模拟状态 ─────────────────────────────────────────
const windEnabled = ref(false);
const windPower = ref(getCurrentPower() + 1);

const onWindToggle = (val: boolean) => {
  if (val) {
    const viewer = DTScopeEngine.viewer;
    if (viewer) startWind(viewer);
  } else {
    const viewer = DTScopeEngine.viewer;
    if (viewer) removeFlowLine(viewer);
  }
};

const onWindPowerChange = (e: Event) => {
  const val = parseInt((e.target as HTMLInputElement).value);
  windPower.value = val;
  changePower(val - 1);
  if (windEnabled.value) {
    const viewer = DTScopeEngine.viewer;
    if (viewer) startWind(viewer);
  }
};

// 场景切换时清理风场
watch(() => props.sceneKey, (key) => {
  if (key !== 'vent') {
    const viewer = DTScopeEngine.viewer;
    if (viewer) removeFlowLine(viewer);
    windEnabled.value = false;
  }
});

// 场景切换时重置展开状态
watch(() => props.sceneKey, () => {
  for (const key of Object.keys(expandedNodes)) delete expandedNodes[key];
});

function toggleNodeExpand(nodeId: string) {
  expandedNodes[nodeId] = !expandedNodes[nodeId];
}

function isNodeExpanded(node: TreeNode): boolean {
  if (expandedNodes[node.id] !== undefined) return expandedNodes[node.id];
  return node.defaultExpanded ?? false;
}

// 节点高亮状态
const nodeHighlight = reactive<Record<string, boolean>>({});

function toggleNodeVisible(nodeId: string) {
  const current = nodeVisible[nodeId] ?? false;
  nodeVisible[nodeId] = !current;
  if (nodeId === 'rebar') {
    if (!current) {
      loadRebarMeshes();
      setRebarMeshesVisible(true);
      // 加载后同步当前高亮状态
      if (nodeHighlight[nodeId]) {
        setRebarHighlight(true);
      }
    } else {
      setRebarMeshesVisible(false);
      // 隐藏时自动关闭高亮
      nodeHighlight[nodeId] = false;
      setRebarHighlight(false);
    }
  }
}

function toggleNodeHighlight(nodeId: string) {
  nodeHighlight[nodeId] = !nodeHighlight[nodeId];
  if (nodeId === 'rebar') {
    setRebarHighlight(nodeHighlight[nodeId]);
  }
}

// SVG 折线坐标
const linePoints = computed(() => {
  const vals = data.value?.chartValues ?? [];
  if (!vals.length) return '';
  const max = Math.max(...vals) || 1;
  const min = Math.min(...vals);
  const range = max - min || 1;
  const padY = 6;
  return vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * W;
    const y = H - padY - ((v - min) / range) * (H - padY * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
});

// SVG 面积路径
const areaPath = computed(() => {
  const vals = data.value?.chartValues ?? [];
  if (!vals.length) return '';
  const max = Math.max(...vals) || 1;
  const min = Math.min(...vals);
  const range = max - min || 1;
  const padY = 6;
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * W;
    const y = H - padY - ((v - min) / range) * (H - padY * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M0,${H} L${pts.join(' L')} L${W},${H} Z`;
});

function statusBarColor(level?: string): string {
  switch (level) {
    case 'warn':  return '#ffcc00';
    case 'danger': return '#ff4444';
    case 'info':  return '#00aaff';
    default:      return '#44ff88';
  }
}
</script>
<style scoped lang="scss">
/* ── 滑入动画 ──────────────────────────────────────── */
.panel-slide-left-enter-active,
.panel-slide-left-leave-active {
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
}
.panel-slide-left-enter-from,
.panel-slide-left-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

/* ── 面板主体 ─────────────────────────────────────── */
.scene-data-panel {
  position: absolute;
  left: 0;
  top: 60px;
  bottom: 0;
  width: 288px;
  background: rgba(0, 6, 18, 0.88);
  border-right: 1px solid rgba(0, 170, 255, 0.2);
  z-index: 18;
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow-y: auto;
  backdrop-filter: blur(16px);
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.5);
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 170, 255, 0.3) transparent;
  --sc: #00e5ff;

  &::-webkit-scrollbar { width: 3px; }
  &::-webkit-scrollbar-thumb { background: rgba(0, 170, 255, 0.3); border-radius: 2px; }
}

/* ── 顶部 Header ─────────────────────────────────── */
.sdp-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px 12px;
  border-bottom: 1px solid rgba(0, 170, 255, 0.15);
  background: rgba(0, 20, 48, 0.6);
}

.sdp-icon {
  font-size: 22px;
  color: var(--sc);
  text-shadow: 0 0 10px var(--sc);
  flex-shrink: 0;
}

.sdp-title-group { flex: 1; min-width: 0; }

.sdp-title {
  font-size: 15px;
  font-weight: bold;
  color: #e8f4ff;
  letter-spacing: 1px;
}

.sdp-sub {
  font-size: 10px;
  color: rgba(180, 220, 255, 0.4);
  letter-spacing: 0.5px;
}

.sdp-live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--sc);
  box-shadow: 0 0 8px var(--sc);
  animation: live-pulse 1.5s ease-in-out infinite;
  flex-shrink: 0;
}
@keyframes live-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.85); }
}

/* ── 指标网格 ─────────────────────────────────────── */
.sdp-metrics {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1px;
  background: rgba(0, 100, 200, 0.1);
  border-bottom: 1px solid rgba(0, 170, 255, 0.12);
}

.sdp-metric-item {
  background: rgba(0, 8, 22, 0.8);
  padding: 10px 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  transition: background 0.2s;

  &:hover { background: rgba(0, 30, 70, 0.7); }

  &.level-good .sdp-m-val { color: #44ff88; text-shadow: 0 0 6px rgba(68, 255, 136, 0.5); }
  &.level-warn .sdp-m-val { color: #ffcc00; text-shadow: 0 0 6px rgba(255, 204, 0, 0.5); }
  &.level-danger .sdp-m-val { color: #ff5555; text-shadow: 0 0 6px rgba(255, 85, 85, 0.5); }
}

.sdp-m-val {
  font-size: 16px;
  font-weight: bold;
  font-family: 'Consolas', monospace;
  color: var(--sc);
  line-height: 1;
}
.sdp-m-unit {
  font-size: 10px;
  color: rgba(180, 220, 255, 0.45);
  margin-left: 2px;
  font-weight: normal;
}
.sdp-m-label {
  font-size: 10px;
  color: rgba(180, 220, 255, 0.45);
  letter-spacing: 0.3px;
}

/* ── 图表区域 ─────────────────────────────────────── */
.sdp-chart-section {
  padding: 12px 16px 10px;
  border-bottom: 1px solid rgba(0, 170, 255, 0.1);
}

.sdp-chart-title {
  font-size: 11px;
  color: rgba(180, 220, 255, 0.55);
  letter-spacing: 0.5px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.sdp-chart-icon {
  color: var(--sc);
  font-size: 10px;
}

.sdp-mini-chart {
  svg {
    width: 100%;
    height: 70px;
    display: block;
  }
}

.sdp-chart-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 3px;
}
.sdp-chl {
  font-size: 9px;
  color: rgba(160, 200, 255, 0.35);
  font-family: 'Consolas', monospace;
}

/* ── 状态列表 ─────────────────────────────────────── */
.sdp-status-list {
  padding: 12px 16px 10px;
  border-bottom: 1px solid rgba(0, 170, 255, 0.1);
}

.sdp-list-title {
  font-size: 11px;
  color: rgba(180, 220, 255, 0.55);
  letter-spacing: 0.5px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.sdp-status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;

  &:last-child { margin-bottom: 0; }
}
.sdp-status-key {
  font-size: 11px;
  color: rgba(180, 220, 255, 0.5);
  width: 70px;
  flex-shrink: 0;
}
.sdp-status-bar-wrap {
  flex: 1;
  height: 4px;
  background: rgba(0, 80, 160, 0.2);
  border-radius: 2px;
  overflow: hidden;
}
.sdp-status-bar {
  height: 100%;
  border-radius: 2px;
  transition: width 0.6s ease;
  box-shadow: 0 0 4px currentColor;
}
.sdp-status-val {
  font-size: 10px;
  font-family: 'Consolas', monospace;
  width: 52px;
  text-align: right;
  flex-shrink: 0;
  color: rgba(180, 220, 255, 0.6);

  &.good   { color: #44ff88; }
  &.warn   { color: #ffcc00; }
  &.danger { color: #ff5555; }
  &.info   { color: #55aaff; }
}

/* ── 结构树 ─────────────────────────────────────── */
.sdp-structure-tree {
  padding: 12px 16px 10px;
  border-bottom: 1px solid rgba(0, 170, 255, 0.1);
}

.st-group {
  margin-bottom: 4px;
}

.st-parent {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.18s;
  user-select: none;

  &:hover { background: rgba(0, 80, 160, 0.2); }
}

.st-arrow {
  font-size: 8px;
  color: rgba(180, 220, 255, 0.4);
  transition: transform 0.2s;
  flex-shrink: 0;

  &.open { transform: rotate(90deg); }
}

.st-icon {
  font-size: 15px;
  flex-shrink: 0;
  color: var(--sc);
}

.st-label {
  font-size: 13px;
  color: #d8eeff;
  flex: 1;
  font-weight: 500;
}

.st-children {
  margin-left: 24px;
  border-left: 1px solid rgba(0, 100, 180, 0.25);
  padding-left: 8px;
}

.st-leaf {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 4px;
  transition: background 0.18s;
  cursor: pointer;

  &:hover { background: rgba(0, 60, 120, 0.2); }

  .st-icon { font-size: 14px; opacity: 0.85; }
  .st-label { font-size: 13px; color: #b8d8f8; }
}

.st-check {
  width: 18px;
  height: 18px;
  border: 1px solid rgba(0, 170, 255, 0.35);
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: transparent;
  flex-shrink: 0;
  transition: all 0.18s;
  cursor: pointer;

  &.on {
    background: rgba(0, 150, 255, 0.25);
    border-color: rgba(0, 200, 255, 0.6);
    color: var(--sc);
    box-shadow: 0 0 6px rgba(0, 200, 255, 0.2);
  }
}

.st-hl {
  height: 22px;
  padding: 0 8px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  font-size: 11px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.18s;
  flex-shrink: 0;
  color: rgba(180, 200, 220, 1);
  border-color: rgba(180, 200, 220, 0.4);
  font-family: "Microsoft YaHei", sans-serif;

  &:hover { border-color: rgba(255, 200, 0, 0.3); color: rgba(255, 200, 0, 0.7); }

  &.on {
    background: rgba(255, 200, 0, 0.15);
    border-color: rgba(255, 200, 0, 0.5);
    color: #ffcc00;
    box-shadow: 0 0 8px rgba(255, 200, 0, 0.25);
  }
}

.st-empty {
  font-size: 10px;
  color: rgba(180, 220, 255, 0.25);
  padding: 6px 10px;
  font-style: italic;
}

/* ── 预警 ─────────────────────────────────────────── */
.sdp-alerts {
  padding: 10px 16px 12px;
}

.sdp-alert-title {
  font-size: 11px;
  color: rgba(255, 180, 100, 0.7);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.sdp-alert-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ffcc00;
  box-shadow: 0 0 6px #ffcc00;
  animation: live-pulse 1.5s ease-in-out infinite;
}

.sdp-alert-item {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 8px 10px;
  border-radius: 4px;
  margin-bottom: 6px;
  font-size: 11px;

  &.warn {
    background: rgba(255, 200, 0, 0.08);
    border-left: 2px solid rgba(255, 200, 0, 0.5);
    color: rgba(255, 220, 100, 0.85);
  }
  &.info {
    background: rgba(0, 160, 255, 0.08);
    border-left: 2px solid rgba(0, 160, 255, 0.5);
    color: rgba(100, 200, 255, 0.85);
  }
}

.sdp-alert-lv {
  flex-shrink: 0;
  font-size: 13px;
}
.sdp-alert-text { line-height: 1.5; }

// ── 风场模拟 ──────────────────────────────────────────────
.sdp-wind-sim {
  padding: 12px 16px 10px;
  border-bottom: 1px solid rgba(0, 170, 255, 0.1);
}

.wind-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0 8px;
}

.wind-toggle-label {
  font-size: 11px;
  color: rgba(180, 220, 255, 0.5);
}

.wind-type-row {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.wind-type-btn {
  flex: 1;
  min-width: 52px;
  padding: 5px 8px;
  font-size: 11px;
  font-family: inherit;
  color: rgba(180, 220, 255, 0.7);
  background: rgba(0, 30, 70, 0.5);
  border: 1px solid rgba(0, 120, 220, 0.3);
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(0, 60, 130, 0.6);
    border-color: rgba(0, 170, 255, 0.5);
    color: rgba(200, 240, 255, 0.9);
  }

  &.active {
    background: rgba(0, 100, 200, 0.4);
    border-color: #00c3ff;
    color: #00c3ff;
    box-shadow: 0 0 6px rgba(0, 195, 255, 0.25);
  }
}

.wind-power-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.wind-power-slider {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  border-radius: 2px;
  outline: none;
  cursor: pointer;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--sc);
    box-shadow: 0 0 6px var(--sc);
    cursor: pointer;
  }
}

.wind-power-val {
  font-size: 11px;
  font-family: 'Consolas', monospace;
  color: var(--sc);
  min-width: 36px;
  text-align: right;
}

/* --- Workface Specific Section --- */
.sdp-workface-specific {
  border-top: 1px solid rgba(0, 170, 255, 0.1);
}

/* --- Model View Navigation Panel (moved from Dashboard) --- */
.sdp-model-nav {
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.sdp-model-nav .back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 12px;
  margin-bottom: 12px;
  background: rgba(0, 60, 120, 0.4);
  border: 1px solid rgba(0, 170, 255, 0.4);
  border-radius: 4px;
  color: #00eaff;
  font-size: 13px;
  font-family: "Microsoft YaHei", sans-serif;
  cursor: pointer;
  transition: all 0.2s;
  letter-spacing: 1px;

  &:hover {
    background: rgba(0, 100, 200, 0.5);
    border-color: #00eaff;
    box-shadow: 0 0 10px rgba(0, 200, 255, 0.25);
  }

  .back-icon { font-size: 15px; }
}

.sdp-model-nav .panel-title {
  color: #fff; font-size: 18px; font-weight: bold;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 10px; margin-bottom: 5px; text-align: left;
}
.sdp-model-nav .group-box { border: 1px solid rgba(0, 255, 255, 0.1); background: rgba(0, 0, 0, 0.2); }
.sdp-model-nav .group-header {
  padding: 10px; background: rgba(0, 100, 255, 0.15); color: #00eaff;
  cursor: pointer; display: flex; justify-content: space-between; align-items: center;
  font-weight: bold; transition: 0.3s;
}
.sdp-model-nav .group-header:hover { background: rgba(0, 100, 255, 0.3); }
.sdp-model-nav .group-content { padding: 5px; }
.sdp-model-nav .arrow { transition: transform 0.3s; font-size: 12px; }
.sdp-model-nav .arrow.open { transform: rotate(180deg); }

/* Buttons */
.sdp-model-nav .layer-btn {
  display: flex; align-items: center; justify-content: space-between;
  margin: 5px 0; padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.05);
  cursor: pointer; transition: all 0.3s; border-radius: 4px;
}
.sdp-model-nav .layer-btn:hover {
  background: rgba(0, 234, 255, 0.15); transform: translateX(5px);
  border-color: rgba(0, 234, 255, 0.3);
}
.sdp-model-nav .layer-btn.selected {
  background: linear-gradient(90deg, rgba(0, 234, 255, 0.3), rgba(0, 234, 255, 0.05));
  border: 1px solid #00eaff; box-shadow: 0 0 10px rgba(0, 234, 255, 0.2);
}
.sdp-model-nav .layer-btn .btn-icon { width: 24px; text-align: center; margin-right: 8px; font-size: 16px; }
.sdp-model-nav .layer-btn .btn-text { flex: 1; color: rgba(255, 255, 255, 0.85); font-size: 15px; }
.sdp-model-nav .layer-btn.selected .btn-text { color: #fff; font-weight: bold; }
.sdp-model-nav .layer-btn .btn-arrow { font-size: 12px; color: #555; transition: all 0.2s; }
.sdp-model-nav .layer-btn.selected .btn-arrow { color: #00eaff; transform: translateX(3px); }

.sdp-workface-actions {
  padding: 15px;
}

.sdp-workface-actions .action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 12px;
  background: rgba(0, 80, 180, 0.3);
  border: 1px solid rgba(0, 150, 255, 0.3);
  color: #88ddff;
  font-size: 14px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  letter-spacing: 1px;

  &:hover {
    background: rgba(0, 100, 200, 0.45);
    border-color: rgba(0, 200, 255, 0.5);
    box-shadow: 0 0 10px rgba(0, 180, 255, 0.2);
  }
}
</style>
