<template>
  <div v-if="activeType === 'hardness'" class="hardness-legend">
    <div class="hardness-title">坚硬程度（Rc / MPa）</div>
    <div v-for="item in hardnessClasses" :key="item.label" class="hardness-item">
      <i :style="{ background: item.color }"></i><span>{{ item.label }}</span><small>{{ item.rule }}</small>
    </div>
  </div>
  <div v-else-if="activeType === 'integrity'" class="hardness-legend">
    <div class="hardness-title">完整程度指示 I</div>
    <div v-for="item in integrityClasses" :key="item.label" class="hardness-item">
      <i :style="{ background: item.color }"></i><span>{{ item.label }}</span><small>{{ item.rule }}</small>
    </div>
  </div>
  <div v-else class="out_rectangle">
    <div class="jojo" :class="{ anomaly: activeType === 'anomaly' }"></div>
    <div class="triangle1"></div>
    <div class="triangle2"></div>
    <div class="triangle3"></div>
    <div class="text-min">{{ minVal }}</div>
    <div class="text-mid">{{ midVal }}</div>
    <div class="text-max">{{ maxVal }}</div>
    <div class="text-unit">{{ unitLabel }}</div>
  </div>
</template>

<script setup>
import { computed, defineProps } from 'vue';

const props = defineProps({
  activeType: { type: String, default: 'vs' },
  valueRange: { type: Array, default: null },
  unit: { type: String, default: 'm/s' },
});

const LABELS = {
  vp: { min: '4052', mid: '4477', max: '4902', unit: 'm/s' },
  vs: { min: '2217', mid: '2562', max: '2692', unit: 'm/s' },
  e:  { min: '0',    mid: '150',  max: '300',  unit: 'm' },
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

const formatValue = (value) => Number(value).toFixed(['ratio', 'anomaly'].includes(props.activeType) ? 2 : 0);
const minVal = computed(() => props.valueRange?.length === 2
  ? formatValue(props.valueRange[0])
  : (LABELS[props.activeType]?.min ?? ''));
const maxVal = computed(() => props.valueRange?.length === 2
  ? formatValue(props.valueRange[1])
  : (LABELS[props.activeType]?.max ?? ''));
const midVal = computed(() => props.valueRange?.length === 2
  ? formatValue((Number(props.valueRange[0]) + Number(props.valueRange[1])) / 2)
  : (LABELS[props.activeType]?.mid ?? ''));
const unitLabel = computed(() => props.unit || LABELS[props.activeType]?.unit || '');
</script>

<style lang="scss" scoped>
.hardness-legend {
  position: fixed; left: 320px; bottom: 35px; z-index: 100;
  width: 260px; padding: 10px 12px; border: 1px solid rgba(0,234,255,.35);
  border-radius: 6px; background: rgba(4,20,35,.88); color: #d8e8f5;
}
.hardness-title { margin-bottom: 7px; color: #00eaff; font-size: 12px; }
.hardness-item {
  display: grid; grid-template-columns: 12px 54px 1fr; align-items: center; gap: 6px;
  margin: 3px 0; font-size: 11px;
  i { width: 10px; height: 10px; border-radius: 2px; }
  small { color: #86a6bd; text-align: right; }
}
.out_rectangle {
  position: fixed;
  width: 240px;
  height: 90px;
  left: 320px;
  bottom: 45px;

  .jojo {
    position: absolute;
    width: 90%;
    height: 40px;
    top: 0%;
    left: 5%;
    background-image: linear-gradient(
      to right,
      rgba(59, 76, 192, 1),
      rgba(95, 127, 232, 1),
      rgba(135, 171, 253, 1),
      rgba(176, 203, 252, 1),
      rgba(220, 220, 220, 1),
      rgba(228, 217, 211, 1),
      rgba(246, 191, 165, 1),
      rgba(243, 149, 118, 1),
      rgba(221, 94, 75, 1),
      rgba(181, 11, 39, 1)
    );
    &.anomaly {
      background-image: linear-gradient(to right, #28a05a, #ffdc46, #dc2d23);
    }
  }

  .triangle1 {
    position: absolute;
    height: 0;
    width: 0;
    top: -5%;
    left: 1.8%;
    font-size: 0;
    line-height: 0;
    border: 10px solid transparent;
    border-top-color: rgba(59, 76, 192, 1);
  }

  .triangle2 {
    position: absolute;
    height: 0;
    width: 0;
    top: -5%;
    left: 48.8%;
    font-size: 0;
    line-height: 0;
    border: 10px solid transparent;
    border-top-color: rgba(220, 220, 220, 1);
  }

  .triangle3 {
    position: absolute;
    height: 0;
    width: 0;
    top: -5%;
    left: 90.8%;
    font-size: 0;
    line-height: 0;
    border: 10px solid transparent;
    border-top-color: rgba(181, 11, 39, 1);
  }

  .text-min {
    position: absolute;
    top: -18%;
    left: 3%;
    font-size: 12px;
    color: white;
  }

  .text-mid {
    position: absolute;
    top: -18%;
    left: 48%;
    font-size: 12px;
    color: white;
  }

  .text-max {
    position: absolute;
    top: -18%;
    left: 85%;
    font-size: 12px;
    color: white;
  }

  .text-unit {
    position: absolute;
    top: 55px;
    left: 35%;
    font-size: 12px;
    color: white;
  }
}
</style>
