<template>
  <div class="dg-float" :style="{ left: pos.x + 'px', top: pos.y + 'px' }">
    <div class="dgf-header" @mousedown="startDrag">
      <span class="dgf-icon">▦</span>
      <span class="dgf-title">今日工序甘特图</span>
      <span class="dgf-date">{{ today }}</span>
      <button class="dgf-close" @click="emit('close')">×</button>
    </div>
    <div class="dgf-body">
      <div ref="ganttEl" class="gantt-chart"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import * as echarts from 'echarts';

const emit = defineEmits<{ close: [] }>();

const today = new Date().toLocaleDateString('zh-CN');

const pos = ref({ x: Math.max(0, window.innerWidth - 620), y: Math.max(0, window.innerHeight - 340) });
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
    x: Math.max(0, Math.min(e.clientX - dragStart.x, window.innerWidth - 580)),
    y: Math.max(0, Math.min(e.clientY - dragStart.y, window.innerHeight - 100)),
  };
};
const stopDrag = () => {
  dragging.value = false;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
};
onBeforeUnmount(() => { stopDrag(); });

const ganttEl = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

const tasks = [
  { name: '出渣作业',   start: 6,    dur: 2,   color: '#ffaa00', done: true },
  { name: '找顶安全',   start: 8,    dur: 1,   color: '#44ff88', done: true },
  { name: '上台阶钻孔', start: 9,    dur: 2.5, color: '#00aaff', done: true },
  { name: '装药连线',   start: 11.5, dur: 1,   color: '#ff9900', done: true },
  { name: '爆破作业',   start: 12.5, dur: 0.5, color: '#ff4444', done: true },
  { name: '通风散烟',   start: 13,   dur: 1.5, color: '#00eaff', done: false },
  { name: '初喷支护',   start: 14.5, dur: 2.5, color: '#88ff44', done: false },
  { name: '系统锚杆',   start: 17,   dur: 2,   color: '#44aaff', done: false },
  { name: '下台阶出渣', start: 19,   dur: 2,   color: '#ffaa00', done: false },
];

onMounted(() => {
  if (!ganttEl.value) return;
  chart = echarts.init(ganttEl.value, 'dark');

  const seriesData = tasks.map((t, i) => ({
    name: t.name,
    value: [i, t.start, t.start + t.dur, t.done ? 1 : 0],
    itemStyle: { color: t.done ? t.color : t.color + '55', borderColor: t.color, borderWidth: 1 },
  }));

  const nowH = new Date().getHours() + new Date().getMinutes() / 60;

  chart.setOption({
    backgroundColor: 'transparent',
    grid: { top: 8, right: 16, bottom: 24, left: 80 },
    xAxis: {
      type: 'value', min: 6, max: 22,
      axisLabel: { color: 'rgba(180,220,255,0.45)', fontSize: 10, formatter: (v: number) => `${Math.floor(v)}:00` },
      splitLine: { lineStyle: { color: 'rgba(0,150,255,0.06)', type: 'dashed' } },
      axisLine: { lineStyle: { color: 'rgba(0,150,255,0.15)' } },
    },
    yAxis: {
      type: 'category',
      data: tasks.map(t => t.name),
      axisLabel: { color: 'rgba(180,220,255,0.55)', fontSize: 10 },
      axisLine: { lineStyle: { color: 'rgba(0,150,255,0.12)' } },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'custom',
        renderItem: (_: any, api: any) => {
          const categoryIndex = api.value(0);
          const start = api.coord([api.value(1), categoryIndex]);
          const end   = api.coord([api.value(2), categoryIndex]);
          const height = api.size([0, 1])[1] * 0.5;
          return {
            type: 'rect',
            shape: { x: start[0], y: start[1] - height / 2, width: end[0] - start[0], height },
            style: api.style(),
          };
        },
        encode: { x: [1, 2], y: 0 },
        data: seriesData,
      },
      {
        type: 'line',
        markLine: {
          symbol: 'none',
          data: [{ xAxis: nowH }],
          lineStyle: { color: '#ffdd00', width: 1.5, type: 'solid' },
          label: { formatter: '现在', color: '#ffdd00', fontSize: 9 },
        },
        data: [],
      },
    ],
    tooltip: {
      backgroundColor: 'rgba(0,10,24,0.9)', borderColor: 'rgba(0,200,255,0.3)',
      textStyle: { color: '#00eaff', fontSize: 11 },
      formatter: (p: any) => {
        const t = tasks[p.data.value[0]];
        return `<b>${t.name}</b><br/>${t.start}:00 → ${(t.start + t.dur).toFixed(1).replace('.0', '')}:00<br/>${t.done ? '✅ 完成' : '⏳ 进行中'}`;
      },
    },
  });
});
</script>

<style scoped lang="scss">
.dg-float {
  position: fixed;
  z-index: 43;
  width: 570px;
  height: 260px;
  background: rgba(0, 8, 22, 0.88);
  border: 1px solid rgba(0, 170, 255, 0.25);
  border-top: 3px solid rgba(255, 170, 0, 0.5);
  border-radius: 6px;
  backdrop-filter: blur(14px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: "Microsoft YaHei", sans-serif;
}

.dgf-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(0, 20, 40, 0.7);
  border-bottom: 1px solid rgba(255, 170, 0, 0.15);
  cursor: move;
  user-select: none;
  flex-shrink: 0;
}
.dgf-icon { font-size: 14px; color: #ffaa00; }
.dgf-title { flex: 1; font-size: 12px; font-weight: bold; color: rgba(240, 220, 200, 0.85); }
.dgf-date { font-size: 10px; color: rgba(180, 220, 255, 0.45); font-family: 'Consolas', monospace; }
.dgf-close {
  width: 20px; height: 20px; background: rgba(255, 40, 40, 0.15);
  border: 1px solid rgba(255, 40, 40, 0.3); color: #ff8888; font-size: 13px;
  cursor: pointer; border-radius: 3px; display: flex; align-items: center; justify-content: center;
  &:hover { background: rgba(255, 40, 40, 0.3); }
}

.dgf-body {
  flex: 1;
  padding: 6px 10px;
  overflow: hidden;
}

.gantt-chart { width: 100%; height: 100%; }
</style>
