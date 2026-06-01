<template>
  <transition name="panel-slide-right">
    <div v-if="show" class="scene-ctrl-panel" :style="{ '--sc': sceneColor }">
      <!-- 顶部 Header -->
      <div class="scp-header">
        <div class="scp-title-group">
          <div class="scp-title">操控面板</div>
          <div class="scp-sub">{{ sceneName }}</div>
        </div>
        <button class="scp-close" @click="$emit('close')" title="关闭">×</button>
      </div>

      <!-- 快捷操作按钮 -->
      <div v-if="(cfg?.actionGroups?.length) || actions.length" class="scp-actions">
        <!-- Grouped Actions -->
        <template v-if="cfg?.actionGroups?.length">
          <div v-for="group in cfg.actionGroups" :key="group.title" class="action-group">
            <div class="scp-section-title">
              <span class="scp-si">▸</span> {{ group.title }}
            </div>
            <div class="scp-action-grid">
              <div
                v-for="action in group.actions"
                :key="action.key"
                class="scp-action-wrapper"
                :class="action.type"
              >
                <button class="scp-action-btn" :class="[action.type, { active: activeAction === action.key }]" @click="handleAction(action, 'view')">
                  <span class="scp-ab-icon">{{ action.icon }}</span>
                  <span class="scp-ab-label">{{ action.label }}</span>
                </button>
                <button v-if="isProcessable(action.key)" class="scp-process-btn" @click="handleAction(action, 'process')" title="自动化处理">
                  <span class="process-icon">🛠️</span>
                </button>
              </div>
            </div>
          </div>
        </template>
        <!-- Ungrouped Actions -->
        <template v-else>
          <div class="scp-section-title">
            <span class="scp-si">▸</span> 快捷操作
          </div>
          <div class="scp-action-grid">
            <button v-for="action in actions" :key="action.key" class="scp-action-btn" :class="[action.type, { active: activeAction === action.key }]" @click="handleAction(action, 'view')">
              <span class="scp-ab-icon">{{ action.icon }}</span>
              <span class="scp-ab-label">{{ action.label }}</span>
            </button>
          </div>
        </template>
      </div>

      <!-- 参数控制 -->
      <div v-if="params.length" class="scp-params">
        <div class="scp-section-title">
          <span class="scp-si">▸</span> 参数设置
        </div>
        <div v-for="p in params" :key="p.key" class="scp-param-row">
          <span class="scp-param-label">{{ p.label }}</span>
          <div class="scp-param-ctrl">
            <template v-if="p.type === 'toggle'">
              <button
                class="scp-toggle"
                :class="{ on: toggleStates[p.key] }"
                @click="toggleStates[p.key] = !toggleStates[p.key]"
              >
                <span class="scp-toggle-knob"></span>
              </button>
              <span class="scp-toggle-label">{{ toggleStates[p.key] ? '开启' : '关闭' }}</span>
            </template>
            <template v-else-if="p.type === 'slider'">
              <input
                class="scp-slider"
                type="range"
                :min="p.min" :max="p.max" :step="p.step ?? 1"
                v-model="sliderValues[p.key]"
              />
              <span class="scp-slider-val">{{ sliderValues[p.key] }}{{ p.unit }}</span>
            </template>
            <template v-else>
              <span class="scp-param-val">{{ p.value }}</span>
            </template>
          </div>
        </div>
      </div>

      <!-- 通风监测（通风场景专用） -->
      <div v-if="props.sceneKey === 'vent'" class="scp-vent-monitor">
        <!-- 趋势图 -->
        <div class="scp-section-title">
          <span class="scp-si">▸</span> 趋势监控（近12h）
        </div>
        <div ref="gasChartEl" class="vent-gas-chart"></div>

        <!-- 仪表盘 -->
        <div class="vent-gauge-row">
          <div ref="windSpeedEl" class="vent-gauge"></div>
          <div ref="windVolEl" class="vent-gauge"></div>
        </div>

        <!-- 气体指标卡片 -->
        <div class="scp-section-title" style="margin-top: 8px;">
          <span class="scp-si">▸</span> 气体指标
        </div>
        <div class="vent-gas-cards">
          <div class="vent-gas-card" v-for="g in gasCards" :key="g.name">
            <div class="vgc-name">{{ g.name }}</div>
            <div class="vgc-val" :style="{ color: g.valColor }">{{ g.value }}<span>{{ g.unit }}</span></div>
            <div class="vgc-bar"><div class="vgc-fill" :style="{ width: g.pct + '%', background: g.barColor }"></div></div>
            <div class="vgc-limit">限值 {{ g.limit }}{{ g.unit }}</div>
          </div>
        </div>
      </div>

      <!-- 实体列表（调度场景专用） -->
      <div v-if="entityList.length" class="scp-entity-list">
        <div class="scp-section-title">
          <span class="scp-si">▸</span> {{ entityListTitle }}
        </div>
        <div
          v-for="item in entityList"
          :key="item.id"
          class="scp-entity-row"
          :class="{ selected: selectedEntity === item.id }"
          @click="selectedEntity = item.id"
        >
          <span class="scp-entity-icon">{{ item.icon }}</span>
          <div class="scp-entity-info">
            <div class="scp-entity-name">{{ item.name }}</div>
            <div class="scp-entity-loc">{{ item.sub }}</div>
          </div>
          <span class="scp-entity-status" :class="item.statusCls">{{ item.status }}</span>
        </div>
      </div>

      <!-- 日志流 -->
      <div class="scp-log">
        <div class="scp-section-title">
          <span class="scp-si">▸</span> 操作日志
        </div>
        <div class="scp-log-list">
          <div v-for="log in logs" :key="log.id" class="scp-log-row">
            <span class="scp-log-time">{{ log.time }}</span>
            <span class="scp-log-msg" :class="log.type">{{ log.msg }}</span>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch, nextTick } from 'vue';
import * as echarts from 'echarts';

interface Action { key: string; label: string; icon: string; type?: string }
interface ActionGroup { title: string; actions: Action[] }
interface Param  { key: string; label: string; type: 'toggle' | 'slider' | 'text'; value?: string; min?: number; max?: number; step?: number; unit?: string }
interface EntityItem { id: string; icon: string; name: string; sub: string; status: string; statusCls: string }
interface Log   { id: string; time: string; msg: string; type?: string }

const SCENE_CFG: Record<string, {
  color: string; name: string;
  actions: Action[];
  actionGroups?: ActionGroup[];
  params: Param[];
  entityListTitle: string;
  entityList: EntityItem[];
  logs: Log[];
}> = {
  workface: {
    color: '#00e5ff', name: '超报处理',
    actions: [],
    actionGroups: [
      {
        title: '超前预报',
        actions: [
          { key: 'face_sketch', label: '掌子面素描', icon: '⬡', type: 'primary' },
          { key: 'gpr', label: '地质雷达', icon: '≋', type: 'primary' },
          { key: 'horiz_drill', label: '超前水平钻', icon: '⊕', type: 'secondary' },
          { key: 'deep_hole', label: '加深炮孔', icon: '⦿', type: 'secondary' },
          { key: 'tsp', label: 'TSP反演', icon: '▦', type: 'secondary' },
          { key: 'tem', label: '瞬变电磁', icon: '⚡', type: 'secondary' },
        ],
      },
      {
        title: '不良地质',
        actions: [
          { key: 'weak_rock', label: '软弱围岩', icon: '◈', type: 'secondary' },
          { key: 'high_stress', label: '高地应力', icon: '♨', type: 'secondary' },
          { key: 'water_zone', label: '富水带', icon: '💧', type: 'secondary' },
          { key: 'fracture_zone', label: '破碎带', icon: '▓', type: 'secondary' },
        ],
      },
    ],
    params: [
      { key: 'video', label: '实时视频', type: 'toggle' },
      { key: 'alarm', label: '地质预警', type: 'toggle' },
      { key: 'advance', label: '预报范围', type: 'slider', min: 10, max: 60, step: 5, unit: 'm' },
    ],
    entityListTitle: '',
    entityList: [],
    logs: [
      { id: 'l1', time: '15:32', msg: '围岩评级更新：V级', type: 'warn' },
      { id: 'l2', time: '14:45', msg: '超前水平钻完成，取芯2.5m', type: 'info' },
      { id: 'l3', time: '13:20', msg: '掌子面素描已上传', type: 'ok' },
      { id: 'l4', time: '11:00', msg: '当班交接，现场正常', type: 'ok' },
    ],
  },
  support: {
    color: '#aa88ff', name: '支护监测', 
    actions: [
      { key: 'monitor', label: '属性面板', icon: '◈', type: 'primary' },
      { key: 'anchor', label: '锚杆状态', icon: '⊙', type: 'primary' },
      { key: 'shotcrete', label: '喷混记录', icon: '≋', type: 'secondary' },
      { key: 'lining', label: '二衬进度', icon: '⬡', type: 'secondary' },
      { key: 'threshold', label: '报警阈值', icon: '⚠', type: 'secondary' },
      { key: 'report', label: '监测报告', icon: '≡', type: 'secondary' },
    ],
    params: [
      { key: 'auto', label: '自动监测', type: 'toggle' },
      { key: 'alarm', label: '超限告警', type: 'toggle' },
      { key: 'interval', label: '监测间隔', type: 'slider', min: 1, max: 24, step: 1, unit: 'h' },
    ],
    entityListTitle: '',
    entityList: [],
    logs: [
      { id: 'l1', time: '16:00', msg: '拱顶沉降本日累计2.3mm，趋于稳定', type: 'info' },
      { id: 'l2', time: '12:00', msg: '二衬浇筑DK289+200~+180段完成', type: 'ok' },
      { id: 'l3', time: '08:00', msg: '监测自动上报，各点正常', type: 'ok' },
    ],
  },
  vent: {
    color: '#44ff88', name: '通风系统',
    actions: [
      { key: 'fan1', label: '主风机 1#', icon: '≋', type: 'primary' },
      { key: 'fan2', label: '主风机 2#', icon: '≋', type: 'secondary' },
      { key: 'boost', label: '加强通风', icon: '⊕', type: 'primary' },
      { key: 'gas', label: '气体检测', icon: '◎', type: 'secondary' },
      { key: 'duct', label: '风筒检查', icon: '≈', type: 'secondary' },
      { key: 'report', label: '通风报告', icon: '≡', type: 'secondary' },
    ],
    params: [
      { key: 'fan1', label: '风机 1#', type: 'toggle' },
      { key: 'fan2', label: '风机 2#', type: 'toggle' },
      { key: 'speed', label: '目标风速', type: 'slider', min: 1, max: 8, step: 0.5, unit: 'm/s' },
    ],
    entityListTitle: '',
    entityList: [],
    logs: [
      { id: 'l1', time: '15:45', msg: '风机运行正常，风速3.2m/s', type: 'ok' },
      { id: 'l2', time: '14:00', msg: '爆破后加强通风30分钟', type: 'info' },
      { id: 'l3', time: '08:00', msg: '交班检查，通风设备状态良好', type: 'ok' },
    ],
  },
  dispatch: {
    color: '#ffaa00', name: '调度中心',
    actions: [
      { key: 'assign', label: '任务派发', icon: '◎', type: 'primary' },
      { key: 'track', label: '人员追踪', icon: '⊙', type: 'primary' },
      { key: 'gantt', label: '工序甘特', icon: '▦', type: 'secondary' },
      { key: 'equip', label: '设备调度', icon: '⊞', type: 'secondary' },
      { key: 'emerg', label: '应急预案', icon: '⚠', type: 'danger' },
      { key: 'report', label: '调度日志', icon: '≡', type: 'secondary' },
    ],
    params: [
      { key: 'realtime', label: '实时追踪', type: 'toggle' },
      { key: 'notify', label: '任务推送', type: 'toggle' },
    ],
    entityListTitle: '在岗人员 & 设备',
    entityList: [
      { id: 'e1', icon: '👷', name: '张工班长', sub: '掌子面 · 凿岩', status: '作业中', statusCls: 'ok' },
      { id: 'e2', icon: '👷', name: '李师傅', sub: '掌子面 · 支护', status: '作业中', statusCls: 'ok' },
      { id: 'e3', icon: '🚧', name: '挖掘机 01', sub: '掌子面开挖', status: '运行', statusCls: 'ok' },
      { id: 'e4', icon: '🚛', name: '渣车 01', sub: 'DK289→出口', status: '运输中', statusCls: 'moving' },
      { id: 'e5', icon: '🚛', name: '渣车 02', sub: '出口→DK289', status: '返回中', statusCls: 'moving' },
      { id: 'e6', icon: '👷', name: '王技术员', sub: '监测点巡检', status: '巡检中', statusCls: 'info' },
    ],
    logs: [
      { id: 'l1', time: '16:10', msg: '渣车01完成第14趟运输', type: 'ok' },
      { id: 'l2', time: '15:30', msg: '今日出渣量已达420m³', type: 'ok' },
      { id: 'l3', time: '14:30', msg: '爆破完成，人员已恢复进场', type: 'info' },
      { id: 'l4', time: '08:00', msg: '当班开始，28名人员在岗', type: 'ok' },
    ],
  },
};

const props = defineProps<{
  show: boolean;
  sceneKey: string | null;
  isModelViewMode?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  action: [action: Action, type: 'view' | 'process'];
}>();

const cfg = computed(() => (props.sceneKey ? SCENE_CFG[props.sceneKey] : null));
const sceneColor      = computed(() => cfg.value?.color ?? '#00e5ff');
const sceneName       = computed(() => cfg.value?.name ?? '');
const actions         = computed(() => cfg.value?.actions ?? []);
const params          = computed(() => cfg.value?.params ?? []);
const entityListTitle = computed(() => cfg.value?.entityListTitle ?? '');
const entityList      = computed(() => cfg.value?.entityList ?? []);
const logs            = computed(() => cfg.value?.logs ?? []);

const activeAction  = ref<string | null>(null);
const selectedEntity = ref<string | null>(null);

const toggleStates  = reactive<Record<string, boolean>>({
  video: true, alarm: true, auto: true, fan1: true, fan2: false,
  siren: true, cam: true, realtime: true, notify: true,
});
const sliderValues  = reactive<Record<string, number>>({
  advance: 30, range: 200, interval: 4, speed: 3.5,
});

function handleAction(action: Action, type: 'view' | 'process' = 'view') {
  if (type === 'view') {
    activeAction.value = action.key;
    setTimeout(() => { activeAction.value = null; }, 800);
  }
  emit('action', action, type);
}

const isProcessable = (key: string) => {
  const processableKeys = [
    'face_sketch', 'gpr', 'horiz_drill', 'deep_hole', 'tsp', 'tem',
    'weak_rock', 'high_stress', 'water_zone', 'fracture_zone'
  ];
  return processableKeys.includes(key);
};

// 切换场景时重置选中状态
watch(() => props.sceneKey, (key) => {
  activeAction.value = null;
  selectedEntity.value = null;
  if (key === 'vent') {
    nextTick(() => initVentCharts());
  }
});

// ── 通风监测图表 ─────────────────────────────────────────
const gasChartEl = ref<HTMLDivElement | null>(null);
const windSpeedEl = ref<HTMLDivElement | null>(null);
const windVolEl = ref<HTMLDivElement | null>(null);
let gasChart: echarts.ECharts | null = null;
let wsGauge: echarts.ECharts | null = null;
let wvGauge: echarts.ECharts | null = null;

const hours = Array.from({ length: 12 }, (_, i) => `${(new Date().getHours() - 11 + i + 24) % 24}:00`);
const coTrend   = [6, 8, 12, 20, 18, 15, 10, 8, 7, 9, 14, 18];
const o2Trend   = [20.9, 20.8, 20.6, 20.2, 20.3, 20.5, 20.7, 20.8, 20.9, 20.7, 20.4, 20.2];
const dustTrend = [0.5, 0.8, 1.2, 3.5, 3.2, 2.8, 1.5, 1.0, 0.8, 1.1, 2.3, 3.5];

const gasCards = computed(() => [
  { name: 'CO',   value: 18, unit: 'ppm', limit: 24, pct: Math.min(18 / 24 * 100, 100), valColor: '#ffaa00', barColor: '#ff9900' },
  { name: 'O₂',   value: 20.2, unit: '%',  limit: 20, pct: Math.min(20.2 / 22 * 100, 100), valColor: '#ff4444', barColor: '#00aaff' },
  { name: '粉尘', value: 3.5, unit: 'mg/m³', limit: 4, pct: Math.min(3.5 / 4 * 100, 100), valColor: '#ffaa00', barColor: '#ff9900' },
  { name: '温度', value: 22, unit: '℃',   limit: 28, pct: Math.min(22 / 28 * 100, 100), valColor: '#00eaff', barColor: '#00eaff' },
]);

function initVentCharts() {
  if (gasChartEl.value && !gasChart) {
    gasChart = echarts.init(gasChartEl.value, 'dark');
    gasChart.setOption({
      backgroundColor: 'transparent',
      grid: { top: 10, right: 10, bottom: 22, left: 36 },
      xAxis: { type: 'category', data: hours, axisLabel: { color: 'rgba(180,220,255,0.4)', fontSize: 8 }, axisLine: { lineStyle: { color: 'rgba(0,150,255,0.15)' } }, axisTick: { show: false } },
      yAxis: [
        { type: 'value', name: 'ppm', nameTextStyle: { color: 'rgba(180,220,255,0.35)', fontSize: 8 }, axisLabel: { color: 'rgba(180,220,255,0.4)', fontSize: 8 }, splitLine: { lineStyle: { color: 'rgba(0,150,255,0.06)', type: 'dashed' } } },
        { type: 'value', name: '%',   nameTextStyle: { color: 'rgba(180,220,255,0.35)', fontSize: 8 }, axisLabel: { color: 'rgba(180,220,255,0.4)', fontSize: 8 }, splitLine: { show: false }, min: 19.5, max: 21.5 },
      ],
      legend: { data: ['CO', 'O₂', '粉尘'], textStyle: { color: 'rgba(180,220,255,0.5)', fontSize: 9 }, right: 0, top: 0, itemWidth: 10, itemHeight: 6 },
      series: [
        { name: 'CO',  type: 'line', data: coTrend,  smooth: true, lineStyle: { color: '#ff9900', width: 1.5 }, itemStyle: { color: '#ff9900' } },
        { name: 'O₂',  type: 'line', data: o2Trend,  smooth: true, lineStyle: { color: '#00aaff', width: 1.5 }, itemStyle: { color: '#00aaff' }, yAxisIndex: 1 },
        { name: '粉尘', type: 'line', data: dustTrend, smooth: true, lineStyle: { color: '#cc44ff', width: 1.5 }, itemStyle: { color: '#cc44ff' } },
      ],
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(0,10,24,0.9)', borderColor: 'rgba(0,200,255,0.3)', textStyle: { color: '#00eaff', fontSize: 10 } },
    });
  }

  const makeGauge = (el: HTMLDivElement | null, name: string, value: number, max: number, unit: string, color: string) => {
    if (!el) return null;
    const c = echarts.init(el, 'dark');
    c.setOption({
      backgroundColor: 'transparent',
      series: [{
        type: 'gauge', radius: '85%',
        startAngle: 200, endAngle: -20,
        min: 0, max,
        splitNumber: 5,
        axisLine: { lineStyle: { width: 6, color: [[value / max, color], [1, 'rgba(0,50,100,0.3)']] } },
        pointer: { width: 2, length: '60%', itemStyle: { color } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { color: 'rgba(180,220,255,0.35)', fontSize: 8, distance: -14 },
        detail: { formatter: `{value}`, color: 'rgba(200,240,255,0.7)', fontSize: 12, offsetCenter: [0, '30%'] },
        title: { color: 'rgba(180,220,255,0.45)', fontSize: 9, offsetCenter: [0, '-18%'] },
        data: [{ value, name }],
      }],
    });
    return c;
  };

  if (windSpeedEl.value && !wsGauge) wsGauge = makeGauge(windSpeedEl.value, '风速 m/s', 0.8, 6, '', '#ff9900');
  if (windVolEl.value && !wvGauge) wvGauge = makeGauge(windVolEl.value, '风量 m³/min', 180, 600, '', '#44ff88');
}

onMounted(() => {
  if (props.sceneKey === 'vent') nextTick(() => initVentCharts());
});
</script>

<style scoped lang="scss">
/* ── 滑入动画 ──────────────────────────────────────── */
.panel-slide-right-enter-active,
.panel-slide-right-leave-active {
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
}
.panel-slide-right-enter-from,
.panel-slide-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

/* ── 面板主体 ─────────────────────────────────────── */
.scene-ctrl-panel {
  position: absolute;
  right: 0;
  top: 60px;
  bottom: 0;
  width: 272px;
  background: rgba(0, 6, 18, 0.88);
  border-left: 1px solid rgba(0, 170, 255, 0.2);
  z-index: 18;
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow-y: auto;
  backdrop-filter: blur(16px);
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.5);
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 170, 255, 0.3) transparent;
  --sc: #00e5ff;

  &::-webkit-scrollbar { width: 3px; }
  &::-webkit-scrollbar-thumb { background: rgba(0, 170, 255, 0.3); border-radius: 2px; }
}

/* ── 顶部 ─────────────────────────────────────────── */
.scp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 14px 12px;
  border-bottom: 1px solid rgba(0, 170, 255, 0.15);
  background: rgba(0, 20, 48, 0.6);
}

.scp-title-group { display: flex; flex-direction: column; gap: 2px; }
.scp-title { font-size: 15px; font-weight: bold; color: #e8f4ff; letter-spacing: 1px; }
.scp-sub   { font-size: 10px; color: var(--sc); opacity: 0.6; letter-spacing: 0.5px; }

.scp-close {
  width: 24px; height: 24px;
  border-radius: 50%;
  background: rgba(255, 80, 80, 0.15);
  border: 1px solid rgba(255, 80, 80, 0.3);
  color: rgba(255, 150, 150, 0.8);
  font-size: 16px;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  line-height: 1;
  transition: all 0.2s;

  &:hover { background: rgba(255, 80, 80, 0.3); color: #fff; }
}

/* ── 通用 Section 标题 ────────────────────────────── */
.scp-section-title {
  font-size: 11px;
  color: rgba(180, 220, 255, 0.45);
  letter-spacing: 0.8px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.scp-si { color: var(--sc); font-size: 10px; }

/* ── 快捷操作 ─────────────────────────────────────── */
.scp-actions { padding: 12px 14px 10px; border-bottom: 1px solid rgba(0, 170, 255, 0.1); }

.scp-action-wrapper {
  position: relative;
  grid-column: span 1; // Default span

  &.special {
    grid-column: span 2;
  }
}

.scp-action-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.scp-action-btn {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.18s;
  border: 1px solid transparent;
  font-family: "Microsoft YaHei", sans-serif;

  &.primary {
    background: rgba(0, 80, 180, 0.3);
    border-color: rgba(0, 150, 255, 0.3);
    color: #88ddff;

    &:hover {
      background: rgba(0, 100, 200, 0.45);
      border-color: rgba(0, 200, 255, 0.5);
      box-shadow: 0 0 10px rgba(0, 180, 255, 0.2);
    }
  }

  &.secondary {
    background: rgba(0, 30, 70, 0.4);
    border-color: rgba(0, 120, 200, 0.2);
    color: rgba(180, 220, 255, 0.6);

    &:hover {
      background: rgba(0, 50, 100, 0.5);
      border-color: rgba(0, 170, 255, 0.35);
      color: #aaddff;
    }
  }

  &.danger {
    background: rgba(180, 40, 20, 0.25);
    border-color: rgba(255, 80, 40, 0.3);
    color: rgba(255, 160, 120, 0.8);

    &:hover {
      background: rgba(200, 50, 20, 0.4);
      border-color: rgba(255, 100, 60, 0.5);
      color: #ffaa88;
    }
  }

  &.special {
    background: linear-gradient(135deg, #00aaff, #aa00ff);
    border-color: rgba(255, 255, 255, 0.4);
    color: #fff;

    &:hover {
      box-shadow: 0 0 15px rgba(170, 0, 255, 0.5);
      transform: scale(1.02);
    }
  }

  &.active {
    transform: scale(0.95);
    box-shadow: 0 0 14px rgba(0, 200, 255, 0.35) inset;
  }
}

.scp-ab-icon  { font-size: 18px; line-height: 1; }
.scp-ab-label { font-size: 11px; letter-spacing: 0.3px; }

.action-group + .action-group {
  margin-top: 12px;
}

.scp-process-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 22px;
  height: 22px;
  background: rgba(0, 150, 255, 0.15);
  border: 1px solid rgba(0, 170, 255, 0.3);
  border-radius: 4px;
  color: #88ddff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 12px;
  transition: all 0.2s;
  z-index: 1;

  &:hover {
    background: rgba(0, 180, 255, 0.6);
    color: #fff;
    transform: scale(1.1);
  }
}

/* ── 参数控制 ─────────────────────────────────────── */
.scp-params { padding: 12px 14px 10px; border-bottom: 1px solid rgba(0, 170, 255, 0.1); }

.scp-param-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;

  &:last-child { margin-bottom: 0; }
}

.scp-param-label {
  font-size: 11px;
  color: rgba(180, 220, 255, 0.5);
  width: 68px;
  flex-shrink: 0;
}

.scp-param-ctrl {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.scp-toggle {
  width: 36px; height: 18px;
  border-radius: 9px;
  background: rgba(0, 60, 120, 0.4);
  border: 1px solid rgba(0, 150, 255, 0.3);
  cursor: pointer;
  position: relative;
  transition: all 0.25s;
  flex-shrink: 0;

  &.on {
    background: rgba(0, 160, 255, 0.35);
    border-color: rgba(0, 220, 255, 0.6);
    box-shadow: 0 0 8px rgba(0, 200, 255, 0.3);

    .scp-toggle-knob { transform: translateX(18px); background: #00e5ff; }
  }
}

.scp-toggle-knob {
  position: absolute;
  left: 1px; top: 1px;
  width: 14px; height: 14px;
  border-radius: 50%;
  background: rgba(180, 220, 255, 0.4);
  transition: all 0.25s;
}

.scp-toggle-label {
  font-size: 10px;
  color: rgba(180, 220, 255, 0.45);
}

.scp-slider {
  flex: 1;
  appearance: none;
  -webkit-appearance: none;
  height: 3px;
  background: rgba(0, 80, 160, 0.4);
  border-radius: 2px;
  outline: none;
  cursor: pointer;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px; height: 12px;
    border-radius: 50%;
    background: var(--sc);
    box-shadow: 0 0 6px var(--sc);
  }
}

.scp-slider-val {
  font-size: 11px;
  font-family: 'Consolas', monospace;
  color: var(--sc);
  min-width: 36px;
  text-align: right;
}

.scp-param-val {
  font-size: 11px;
  color: rgba(180, 220, 255, 0.7);
}

/* ── 实体列表 ─────────────────────────────────────── */
.scp-entity-list { padding: 12px 14px 10px; border-bottom: 1px solid rgba(0, 170, 255, 0.1); }

.scp-entity-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 5px;
  cursor: pointer;
  margin-bottom: 4px;
  transition: background 0.18s;

  &:hover { background: rgba(0, 80, 160, 0.25); }
  &.selected { background: rgba(0, 80, 160, 0.35); border: 1px solid rgba(0, 170, 255, 0.3); }
}

.scp-entity-icon { font-size: 18px; flex-shrink: 0; }
.scp-entity-info { flex: 1; min-width: 0; }
.scp-entity-name { font-size: 12px; color: #d0e8ff; }
.scp-entity-loc  { font-size: 10px; color: rgba(180, 220, 255, 0.4); }
.scp-entity-status {
  font-size: 10px; flex-shrink: 0;
  &.ok     { color: #44ff88; }
  &.moving { color: #ffcc00; }
  &.info   { color: #88aaff; }
  &.warn   { color: #ff8844; }
}

/* ── 日志 ─────────────────────────────────────────── */
.scp-log { padding: 12px 14px 16px; }

.scp-log-list { display: flex; flex-direction: column; gap: 6px; }

.scp-log-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  font-size: 11px;
}

.scp-log-time {
  color: rgba(140, 180, 220, 0.4);
  font-family: 'Consolas', monospace;
  flex-shrink: 0;
}

.scp-log-msg {
  color: rgba(180, 220, 255, 0.6);
  line-height: 1.4;

  &.ok   { color: rgba(68, 255, 136, 0.7); }
  &.warn { color: rgba(255, 200, 0, 0.7); }
  &.info { color: rgba(100, 180, 255, 0.7); }
}

// ── 通风监测图表 ──────────────────────────────────────────
.scp-vent-monitor {
  padding: 10px 14px;
  border-bottom: 1px solid rgba(0, 170, 255, 0.1);
}

.vent-gas-chart {
  height: 140px;
  width: 100%;
  margin-bottom: 4px;
}

.vent-gauge-row {
  display: flex;
  gap: 0;
}

.vent-gauge {
  flex: 1;
  height: 100px;
}

.vent-gas-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
}

.vent-gas-card {
  background: rgba(0, 20, 50, 0.5);
  border: 1px solid rgba(0, 100, 200, 0.2);
  border-radius: 4px;
  padding: 6px 8px;
}

.vgc-name {
  font-size: 9px;
  color: rgba(180, 220, 255, 0.45);
  margin-bottom: 2px;
}

.vgc-val {
  font-size: 16px;
  font-weight: bold;
  font-family: 'Consolas', monospace;
  margin-bottom: 3px;

  span {
    font-size: 9px;
    color: rgba(180, 220, 255, 0.35);
    margin-left: 2px;
  }
}

.vgc-bar {
  height: 2px;
  background: rgba(0, 50, 100, 0.5);
  border-radius: 1px;
  margin-bottom: 2px;
}

.vgc-fill {
  height: 100%;
  border-radius: 1px;
  transition: width 0.5s ease;
}

.vgc-limit {
  font-size: 8px;
  color: rgba(180, 220, 255, 0.25);
}
</style>
