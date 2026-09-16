<template>
  <aside class="tsp-legend" :class="`tsp-legend--${activeType}`" :aria-label="`${legendTitle}图例`">
    <header v-if="classItems" class="category-title">{{ categoryTitle }}</header>
    <header v-else class="legend-header">
      <div class="legend-heading">
        <i></i>
        <div><small>TSP 地震波反射</small><strong>{{ legendTitle }}</strong></div>
      </div>
      <span class="range-badge">{{ rangeBadge }}</span>
    </header>

    <div v-if="classItems" class="category-list">
      <div v-for="item in classItems" :key="item.label" class="category-item">
        <i :style="{ background: item.color }"></i>
        <span>{{ item.label }}</span>
        <small>{{ item.rule }}</small>
      </div>
    </div>

    <div v-else class="scale-body">
      <div class="scale-bar"></div>
      <div class="scale-ticks"><span v-for="tick in ticks" :key="tick">{{ tick }}</span></div>
      <div class="scale-direction"><span>{{ scaleHints[0] }}</span><i></i><span>{{ scaleHints[1] }}</span></div>
    </div>

    <footer v-if="!classItems" class="legend-footer">
      <span><i></i>实测反演结果</span>
      <small v-if="unitLabel">单位：{{ unitLabel }}</small>
    </footer>
  </aside>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  activeType: { type: String, default: 'vs' },
  valueRange: { type: Array, default: null },
  unit: { type: String, default: '' },
});

const TYPE_META = {
  vp: { title: 'P 波速度 Vp', range: [3819.42, 5631.62], unit: 'm/s', hints: ['低波速', '高波速'] },
  vs: { title: 'S 波速度 Vs', range: [1924.45, 2963.53], unit: 'm/s', hints: ['低波速', '高波速'] },
  ratio: { title: '波速比 Vp / Vs', range: [1.4195, 2.8682], unit: 'VP/VS', hints: ['低比值', '高比值'] },
  anomaly: { title: 'TSP 异常指数', range: [0, 1], unit: '', hints: ['稳定', '异常显著'] },
  hardness: { title: '岩体坚硬程度', unit: 'MPa' },
  integrity: { title: '岩体完整程度', unit: '' },
};

const hardnessClasses = [
  { label: '极软岩', rule: '≤ 5', color: '#d73027' },
  { label: '软岩', rule: '(5, 15]', color: '#fc8d59' },
  { label: '较软岩', rule: '(15, 30]', color: '#fee08b' },
  { label: '硬岩', rule: '(30, 60]', color: '#66c2a5' },
  { label: '极硬岩', rule: '> 60', color: '#4575b4' },
];
const integrityClasses = [
  { label: '极破碎', rule: 'I < 0.2', color: '#d73027' },
  { label: '破碎', rule: '[0.2, 0.4)', color: '#fc8d59' },
  { label: '较破碎', rule: '[0.4, 0.6)', color: '#fee08b' },
  { label: '较完整', rule: '[0.6, 0.8)', color: '#66c2a5' },
  { label: '完整', rule: 'I ≥ 0.8', color: '#2b83ba' },
];

const meta = computed(() => TYPE_META[props.activeType] || TYPE_META.vs);
const legendTitle = computed(() => meta.value.title);
const categoryTitle = computed(() => props.activeType === 'hardness' ? '坚硬程度（Rc / MPa）' : '完整程度指示 I');
const unitLabel = computed(() => props.unit || meta.value.unit || '');
const classItems = computed(() => props.activeType === 'hardness'
  ? hardnessClasses
  : props.activeType === 'integrity' ? integrityClasses : null);
const numericRange = computed(() => {
  const source = props.valueRange?.length === 2 ? props.valueRange : meta.value.range;
  return [Number(source?.[0] ?? 0), Number(source?.[1] ?? 1)];
});
const decimals = computed(() => ['ratio', 'anomaly'].includes(props.activeType) ? 2 : 0);
const formatValue = (value) => Number(value).toFixed(decimals.value);
const ticks = computed(() => Array.from({ length: 5 }, (_, index) =>
  formatValue(numericRange.value[0] + (numericRange.value[1] - numericRange.value[0]) * index / 4)));
const scaleHints = computed(() => meta.value.hints || ['低值', '高值']);
const rangeBadge = computed(() => {
  const label = `${formatValue(numericRange.value[0])}–${formatValue(numericRange.value[1])}`;
  return unitLabel.value ? `${label} ${unitLabel.value}` : label;
});
</script>

<style scoped lang="scss">
.tsp-legend {
  position: fixed;
  z-index: 1200;
  left: clamp(304px, 16.2vw, 326px);
  bottom: 34px;
  width: 276px;
  overflow: hidden;
  border: 1px solid rgba(20, 187, 220, .34);
  border-radius: 7px;
  background: linear-gradient(135deg, rgba(0, 190, 225, .055), transparent 46%), rgba(2, 14, 25, .9);
  box-shadow: 0 8px 26px rgba(0, 0, 0, .4), inset 0 0 24px rgba(0, 170, 210, .035);
  color: #b9cfdd;
  pointer-events: none;
  backdrop-filter: blur(8px);
}
.tsp-legend::before,
.tsp-legend::after {
  content: '';
  position: absolute;
  z-index: 2;
  width: 16px;
  height: 1px;
  background: #00dbf2;
  box-shadow: 0 0 7px rgba(0, 219, 242, .65);
}
.tsp-legend::before { top: 0; left: 0; }
.tsp-legend::after { right: 0; bottom: 0; }

.legend-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 47px;
  padding: 7px 10px 7px 11px;
  border-bottom: 1px solid rgba(38, 161, 191, .16);
  background: rgba(0, 78, 110, .09);
}
.legend-heading {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 8px;
  > i { width: 6px; height: 22px; border-radius: 1px; background: linear-gradient(#00eaff, #08789d); box-shadow: 0 0 8px rgba(0, 224, 248, .45); }
  div { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
  small { color: #4f8096; font-size: 8px; letter-spacing: .8px; }
  strong { color: #8fe9f3; font-size: 12px; font-weight: 600; white-space: nowrap; }
}
.range-badge {
  margin-left: 8px;
  padding: 3px 6px;
  border: 1px solid rgba(59, 181, 207, .2);
  border-radius: 3px;
  background: rgba(0, 115, 150, .12);
  color: #769cad;
  font: 8px Consolas, monospace;
}
.scale-body { padding: 10px 11px 7px; }
.scale-bar {
  height: 11px;
  border: 1px solid rgba(182, 220, 230, .2);
  border-radius: 2px;
  background: linear-gradient(90deg, #3b4cc0 0%, #6f92ef 20%, #b8d3f4 40%, #dddcdc 50%, #f5b095 70%, #dc5c4a 86%, #a60b2d 100%);
}
.tsp-legend--anomaly .scale-bar { background: linear-gradient(90deg, #249c68, #68c37b, #e8d85a, #f39143, #d93b32); }
.scale-ticks { display: flex; justify-content: space-between; margin-top: 5px; color: #9bb5c4; font: 8px Consolas, monospace; }
.scale-direction {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 7px;
  margin-top: 4px;
  color: #4d7185;
  font-size: 8px;
  i { height: 1px; background: linear-gradient(90deg, transparent, rgba(68, 168, 194, .45), transparent); }
}
.legend-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 24px;
  padding: 4px 11px;
  border-top: 1px solid rgba(38, 161, 191, .11);
  background: rgba(0, 45, 66, .1);
  color: #537487;
  font-size: 8px;
  > span { display: flex; align-items: center; gap: 5px; }
  > span i { width: 4px; height: 4px; border-radius: 50%; background: #00ddeb; box-shadow: 0 0 5px #00ddeb; }
  small { font-size: 8px; }
}

.tsp-legend--hardness,
.tsp-legend--integrity {
  width: 260px;
  padding: 10px 12px;
  border-color: rgba(0, 234, 255, .35);
  border-radius: 6px;
  background: rgba(4, 20, 35, .88);
  box-shadow: none;
  backdrop-filter: none;
  &::before, &::after { display: none; }
}
.category-title { margin-bottom: 7px; color: #00eaff; font-size: 12px; }
.category-item {
  display: grid;
  grid-template-columns: 12px 54px 1fr;
  align-items: center;
  gap: 6px;
  margin: 3px 0;
  font-size: 11px;
  i { width: 10px; height: 10px; border-radius: 2px; }
  small { color: #86a6bd; text-align: right; }
}

@media (max-width: 1200px) {
  .tsp-legend { left: 300px; bottom: 24px; }
}
</style>
