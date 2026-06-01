<template>
  <div
    class="lining-float"
    :style="{ left: pos.x + 'px', top: pos.y + 'px' }"
  >
    <!-- 拖拽标题栏 -->
    <div class="lf-header" @mousedown="startDrag">
      <span class="lf-icon">⊞</span>
      <span class="lf-title">支护参数 · 衬砌检测</span>
      <button class="lf-close" @click="emit('close')">×</button>
    </div>

    <!-- 内容区 -->
    <div class="lf-body">
      <!-- 里程选择 -->
      <div class="lf-section">
        <div class="sec-label">查询里程</div>
        <div class="mileage-select-row">
          <button class="mile-btn" @click="prevMileage">‹</button>
          <span class="mile-val">{{ currentMileage }}</span>
          <button class="mile-btn" @click="nextMileage">›</button>
        </div>
      </div>

      <!-- 双列参数 -->
      <div class="lf-cols">
        <!-- 初期支护 -->
        <div class="lf-section">
          <div class="sec-label">初期支护</div>
          <div class="kv-list">
            <div class="kv-row"><span>喷混厚度</span><b>{{ current.shotcrete }}<em>cm</em></b></div>
            <div class="kv-row"><span>锚杆间距</span><b>{{ current.boltSpacing }}<em>cm</em></b></div>
            <div class="kv-row"><span>锚杆长度</span><b>{{ current.boltLength }}<em>m</em></b></div>
            <div class="kv-row"><span>钢拱架间距</span><b>{{ current.archSpacing }}<em>m</em></b></div>
            <div class="kv-row"><span>完成率</span>
              <b :class="progressCls(current.progress)">{{ current.progress }}<em>%</em></b>
            </div>
          </div>
        </div>

        <!-- 二次衬砌 -->
        <div class="lf-section">
          <div class="sec-label">二次衬砌</div>
          <div class="kv-list">
            <div class="kv-row"><span>衬砌厚度</span><b>{{ current.liningThick }}<em>cm</em></b></div>
            <div class="kv-row"><span>浇筑方量</span><b>{{ current.concreteVol }}<em>m³</em></b></div>
            <div class="kv-row"><span>衬砌里程</span><b class="highlight">{{ current.liningMileage }}</b></div>
          </div>
          <!-- 状态图例 -->
          <div class="legend-mini">
            <span v-for="l in statusLegend" :key="l.label" class="legend-dot" :style="{ background: l.color }" :title="l.label"></span>
          </div>
        </div>
      </div>

      <!-- 衬砌厚度检测 -->
      <div class="lf-section">
        <div class="sec-label">衬砌厚度检测 (cm)</div>
        <div ref="chartEl" class="lining-chart"></div>
        <div class="thickness-stats">
          <div class="stat-item">
            <div class="stat-val green">45.2<span>cm</span></div>
            <div class="stat-lbl">设计值</div>
          </div>
          <div class="stat-item">
            <div class="stat-val cyan">46.8<span>cm</span></div>
            <div class="stat-lbl">实测均值</div>
          </div>
          <div class="stat-item">
            <div class="stat-val orange">38.5<span>cm</span></div>
            <div class="stat-lbl">最小值</div>
          </div>
          <div class="stat-item">
            <div class="stat-val" :class="qualityCls">{{ qualityLabel }}</div>
            <div class="stat-lbl">厚度评定</div>
          </div>
        </div>
      </div>

      <!-- 各段支护完成率 -->
      <div class="lf-section">
        <div class="sec-label">各段支护完成率</div>
        <div ref="progressChartEl" class="progress-chart"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import * as echarts from 'echarts';

const emit = defineEmits<{ close: [] }>();

// ── 拖拽 ──────────────────────────────────────────────────
const pos = ref({ x: window.innerWidth - 460, y: 80 });
const dragging = ref(false);
let dragStart = { x: 0, y: 0 };

const startDrag = (e: MouseEvent) => {
  dragging.value = true;
  dragStart = { x: e.clientX - pos.value.x, y: e.clientY - pos.value.y };
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
};

const onDrag = (e: MouseEvent) => {
  if (!dragging.value) return;
  pos.value = {
    x: Math.max(0, Math.min(e.clientX - dragStart.x, window.innerWidth - 420)),
    y: Math.max(0, Math.min(e.clientY - dragStart.y, window.innerHeight - 100)),
  };
};

const stopDrag = () => {
  dragging.value = false;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
};

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
});

// ── 里程数据 ─────────────────────────────────────────────
const mileages = [
  'DK278+200', 'DK280+500', 'DK283+000', 'DK285+400',
  'DK287+800', 'DK289+450', 'DK291+200', 'DK293+600',
];
const mileageIdx = ref(5);
const currentMileage = computed(() => mileages[mileageIdx.value]);
const prevMileage = () => { if (mileageIdx.value > 0) mileageIdx.value--; };
const nextMileage = () => { if (mileageIdx.value < mileages.length - 1) mileageIdx.value++; };

const liningData = [
  { shotcrete: 26, boltSpacing: 100, boltLength: 3.5, archSpacing: 0.8, progress: 100, liningThick: 45, concreteVol: 128, liningMileage: 'DK278+200' },
  { shotcrete: 24, boltSpacing: 100, boltLength: 3.0, archSpacing: 1.0, progress: 100, liningThick: 45, concreteVol: 115, liningMileage: 'DK280+500' },
  { shotcrete: 22, boltSpacing: 120, boltLength: 3.0, archSpacing: 1.0, progress: 100, liningThick: 40, concreteVol: 108, liningMileage: 'DK283+000' },
  { shotcrete: 26, boltSpacing: 100, boltLength: 3.5, archSpacing: 0.8, progress: 100, liningThick: 45, concreteVol: 132, liningMileage: 'DK285+400' },
  { shotcrete: 26, boltSpacing: 80,  boltLength: 4.0, archSpacing: 0.6, progress: 85,  liningThick: 45, concreteVol: 96,  liningMileage: 'DK287+800' },
  { shotcrete: 28, boltSpacing: 80,  boltLength: 4.5, archSpacing: 0.5, progress: 42,  liningThick: 50, concreteVol: 0,   liningMileage: '-' },
  { shotcrete: 0,  boltSpacing: 0,   boltLength: 0,   archSpacing: 0,   progress: 0,   liningThick: 0,  concreteVol: 0,   liningMileage: '-' },
  { shotcrete: 0,  boltSpacing: 0,   boltLength: 0,   archSpacing: 0,   progress: 0,   liningThick: 0,  concreteVol: 0,   liningMileage: '-' },
];

const current = computed(() => liningData[mileageIdx.value]);
const progressCls = (v: number) => v >= 100 ? 'green' : v > 60 ? 'orange' : v > 0 ? 'yellow' : 'gray';
const qualityCls = computed(() => current.value.progress >= 100 ? 'green' : 'orange');
const qualityLabel = computed(() => current.value.progress >= 100 ? '合格' : '施工中');

const statusLegend = [
  { label: '已完成二衬', color: '#44ff88' },
  { label: '初支完成', color: '#ffaa00' },
  { label: '施工中',   color: '#ff6633' },
  { label: '未施工',   color: '#444' },
];

// ── 图表 ─────────────────────────────────────────────────
const chartEl = ref<HTMLDivElement | null>(null);
const progressChartEl = ref<HTMLDivElement | null>(null);
let radarChart: echarts.ECharts | null = null;
let barChart: echarts.ECharts | null = null;

const radarIndicators = [
  { name: 'P1', max: 60 }, { name: 'P2', max: 60 }, { name: 'P3', max: 60 }, { name: 'P4', max: 60 },
  { name: 'P5', max: 60 }, { name: 'P6', max: 60 }, { name: 'P7', max: 60 }, { name: 'P8', max: 60 },
];

const initCharts = () => {
  if (chartEl.value) {
    radarChart = echarts.init(chartEl.value, 'dark');
    radarChart.setOption({
      backgroundColor: 'transparent',
      radar: {
        indicator: radarIndicators,
        radius: '62%',
        axisLine: { lineStyle: { color: 'rgba(0,150,255,0.2)' } },
        splitLine: { lineStyle: { color: 'rgba(0,150,255,0.1)' } },
        splitArea: { areaStyle: { color: ['rgba(0,60,120,0.15)', 'rgba(0,40,90,0.1)'] } },
        name: { textStyle: { color: 'rgba(180,220,255,0.6)', fontSize: 10 } },
      },
      series: [{
        type: 'radar',
        data: [{ value: [46.2, 47.1, 45.8, 38.5, 44.9, 48.3, 46.7, 45.2], name: '厚度' }],
        lineStyle: { color: '#00eaff', width: 1.5 },
        areaStyle: { color: 'rgba(0,200,255,0.12)' },
        itemStyle: { color: '#00eaff' },
        label: { show: true, color: '#00eaff', fontSize: 9, formatter: (p: any) => p.value + '' },
      }],
      tooltip: { backgroundColor: 'rgba(0,10,24,0.9)', borderColor: 'rgba(0,200,255,0.3)', textStyle: { color: '#00eaff' } },
    });
  }

  if (progressChartEl.value) {
    barChart = echarts.init(progressChartEl.value, 'dark');
    barChart.setOption({
      backgroundColor: 'transparent',
      grid: { top: 6, right: 10, bottom: 24, left: 36 },
      xAxis: {
        type: 'category',
        data: mileages.map(m => m.replace('DK', '')),
        axisLabel: { color: 'rgba(180,220,255,0.45)', fontSize: 8, rotate: 30 },
        axisLine: { lineStyle: { color: 'rgba(0,150,255,0.15)' } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value', min: 0, max: 100,
        axisLabel: { color: 'rgba(180,220,255,0.45)', fontSize: 9, formatter: '{value}%' },
        splitLine: { lineStyle: { color: 'rgba(0,150,255,0.06)', type: 'dashed' } },
      },
      series: [{
        type: 'bar',
        data: liningData.map(d => d.progress),
        itemStyle: {
          color: (p: any) => {
            const v = p.value;
            if (v >= 100) return '#44ff88';
            if (v > 60) return '#ffaa00';
            if (v > 0) return '#ff6633';
            return 'rgba(60,60,80,0.4)';
          },
          borderRadius: [3, 3, 0, 0],
        },
        barMaxWidth: 24,
        markLine: {
          data: [{ yAxis: 100 }],
          lineStyle: { color: 'rgba(68,255,136,0.25)', type: 'dashed' },
          label: { color: 'rgba(68,255,136,0.5)', fontSize: 9 },
        },
      }],
      tooltip: {
        backgroundColor: 'rgba(0,10,24,0.9)', borderColor: 'rgba(0,200,255,0.3)',
        textStyle: { color: '#00eaff', fontSize: 11 },
        formatter: (p: any) => `${mileages[p.dataIndex]}<br/>完成率：<b>${p.value}%</b>`,
      },
    });
  }
};

onMounted(initCharts);
</script>

<style scoped lang="scss">
// ── 浮层容器 ──────────────────────────────────────────────
.lining-float {
  position: fixed;
  z-index: 42;
  width: 400px;
  max-height: calc(100vh - 40px);
  background: rgba(0, 8, 22, 0.88);
  border: 1px solid rgba(0, 170, 255, 0.25);
  border-top: 3px solid rgba(0, 200, 100, 0.5);
  border-radius: 6px;
  backdrop-filter: blur(14px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 150, 100, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: "Microsoft YaHei", sans-serif;
}

// ── 拖拽标题栏 ────────────────────────────────────────────
.lf-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(0, 20, 40, 0.7);
  border-bottom: 1px solid rgba(0, 200, 100, 0.15);
  cursor: move;
  user-select: none;
  flex-shrink: 0;
}

.lf-icon { font-size: 14px; color: #44ff88; }
.lf-title {
  flex: 1;
  font-size: 13px;
  font-weight: bold;
  color: rgba(200, 240, 200, 0.85);
  letter-spacing: 1px;
}

.lf-close {
  width: 22px; height: 22px;
  background: rgba(255, 40, 40, 0.15);
  border: 1px solid rgba(255, 40, 40, 0.3);
  color: #ff8888;
  font-size: 14px;
  cursor: pointer;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  &:hover { background: rgba(255, 40, 40, 0.3); }
}

// ── 内容区 ───────────────────────────────────────────────
.lf-body {
  overflow-y: auto;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 150, 255, 0.3) transparent;

  &::-webkit-scrollbar { width: 3px; }
  &::-webkit-scrollbar-thumb { background: rgba(0, 150, 255, 0.3); border-radius: 2px; }
}

// ── Section ───────────────────────────────────────────────
.lf-section { flex-shrink: 0; }
.sec-label {
  font-size: 10px;
  color: rgba(0, 200, 100, 0.5);
  letter-spacing: 1px;
  font-weight: bold;
  margin-bottom: 5px;
  border-bottom: 1px solid rgba(0, 200, 100, 0.08);
  padding-bottom: 2px;
}

// ── 双列 ─────────────────────────────────────────────────
.lf-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

// ── 里程选择 ──────────────────────────────────────────────
.mileage-select-row {
  display: flex; align-items: center; gap: 6px; justify-content: center;
}
.mile-btn {
  width: 22px; height: 22px;
  background: rgba(0, 60, 120, 0.5);
  border: 1px solid rgba(0, 150, 255, 0.3);
  color: #00aaff;
  font-size: 14px;
  cursor: pointer;
  border-radius: 3px;
  display: flex; align-items: center; justify-content: center;
  line-height: 1;
  &:hover { background: rgba(0, 100, 200, 0.5); }
}
.mile-val {
  font-size: 12px;
  color: #00eaff;
  font-family: 'Consolas', monospace;
  background: rgba(0, 40, 80, 0.5);
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid rgba(0, 150, 255, 0.15);
  flex: 1; text-align: center;
}

// ── KV ───────────────────────────────────────────────────
.kv-list { display: flex; flex-direction: column; gap: 3px; }
.kv-row {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 11px;
  span { color: rgba(180, 220, 255, 0.45); }
  b {
    color: rgba(200, 240, 255, 0.85); font-weight: bold;
    em { font-style: normal; font-size: 9px; color: rgba(180, 220, 255, 0.35); margin-left: 1px; }
    &.green { color: #44ff88; }
    &.orange { color: #ffaa00; }
    &.yellow { color: #ffdd44; }
    &.gray { color: rgba(120, 120, 140, 0.5); }
    &.highlight { color: #00eaff; font-family: 'Consolas', monospace; }
  }
}

// ── 图例 ─────────────────────────────────────────────────
.legend-mini {
  display: flex; gap: 6px; margin-top: 6px; justify-content: center;
}
.legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; opacity: 0.8; }

// ── 雷达图 ───────────────────────────────────────────────
.lining-chart { height: 170px; width: 100%; flex-shrink: 0; }

// ── 厚度统计 ──────────────────────────────────────────────
.thickness-stats {
  display: flex; justify-content: space-around;
  padding: 6px 0;
  border-top: 1px solid rgba(0, 200, 100, 0.08);
  border-bottom: 1px solid rgba(0, 200, 100, 0.08);
  margin-top: 2px;
}
.stat-item { display: flex; flex-direction: column; align-items: center; gap: 1px; }
.stat-val {
  font-size: 15px; font-weight: bold; font-family: 'Consolas', monospace; color: rgba(200, 240, 255, 0.8);
  span { font-size: 9px; color: rgba(180, 220, 255, 0.35); margin-left: 1px; }
  &.cyan { color: #00eaff; } &.green { color: #44ff88; } &.orange { color: #ffaa00; }
}
.stat-lbl { font-size: 9px; color: rgba(180, 220, 255, 0.4); }

// ── 柱状图 ───────────────────────────────────────────────
.progress-chart { height: 140px; width: 100%; flex-shrink: 0; }
</style>
