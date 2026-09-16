<template>
  <div class="tem-legend" aria-label="视电阻率图例">
    <div class="tem-legend__head">
      <span>视电阻率</span>
      <b>{{ rangeLabel }}</b>
    </div>
    <div class="tem-legend__bar"></div>
    <div class="tem-legend__ticks">
      <span v-for="tick in ticks" :key="tick">{{ tick }}</span>
    </div>
    <div class="tem-legend__hint">
      <span>低阻</span>
      <span>高阻</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps({
  minValue: { type: Number, required: true },
  maxValue: { type: Number, required: true },
  unit: { type: String, default: 'Ω·m' },
});

const formatValue = (value: number) => value.toFixed(1);
const ticks = computed(() => Array.from(
  { length: 5 },
  (_, index) => formatValue(props.minValue + (props.maxValue - props.minValue) * index / 4),
));
const rangeLabel = computed(() =>
  `${formatValue(props.minValue)}–${formatValue(props.maxValue)} ${props.unit}`,
);
</script>

<style scoped lang="scss">
.tem-legend {
  position: fixed;
  z-index: 100;
  left: 50%;
  bottom: 42px;
  width: min(380px, 36vw);
  padding: 9px 12px 8px;
  transform: translateX(-50%);
  border: 1px solid rgba(52, 168, 194, .34);
  border-radius: 7px;
  background: rgba(3, 14, 24, .84);
  box-shadow: 0 6px 20px rgba(0, 0, 0, .28), inset 0 0 18px rgba(25, 125, 151, .06);
  color: #9bb7c8;
  pointer-events: none;
  backdrop-filter: blur(6px);
}

.tem-legend__head,
.tem-legend__hint,
.tem-legend__ticks {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tem-legend__head {
  margin-bottom: 6px;
  font-size: 11px;
}

.tem-legend__head span { color: #79d7e7; }
.tem-legend__head b { color: #c3d9e5; font: 500 10px Consolas, monospace; }

.tem-legend__bar {
  height: 10px;
  border: 1px solid rgba(139, 215, 224, .22);
  border-radius: 2px;
  background: linear-gradient(90deg, #440154 0%, #373e8e 20%, #189299 46%, #53ce67 72%, #fde725 100%);
}

.tem-legend__ticks {
  margin-top: 4px;
  color: #a8c1cf;
  font: 9px Consolas, monospace;
}

.tem-legend__hint {
  margin-top: 2px;
  color: #54798d;
  font-size: 9px;
}

@media (max-width: 1100px) {
  .tem-legend { width: 300px; left: 43%; }
}
</style>
