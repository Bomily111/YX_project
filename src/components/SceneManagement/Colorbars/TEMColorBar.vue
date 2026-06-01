<template>
  <div class="out_rectangle">
    <div class="jojo"></div>
    <div class="triangle1"></div>
    <div class="triangle2"></div>
    <div class="triangle3"></div>
    <div class="text1">{{ label1 }}</div>
    <div class="text2">{{ label2 }}</div>
    <div class="text3">{{ label3 }}</div>
    <div class="text4">{{ unitLabel }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps({
  minValue: { type: Number, default: null },
  maxValue: { type: Number, default: null },
  unit: { type: String, default: '' },
});

const useActual = computed(() => props.minValue != null && props.maxValue != null);

const label1 = computed(() => (useActual.value ? String(Math.round(props.minValue!)) : '0'));
const label2 = computed(() =>
  useActual.value ? String(Math.round((props.minValue! + props.maxValue!) / 2)) : '50',
);
const label3 = computed(() => (useActual.value ? String(Math.round(props.maxValue!)) : '100'));
const unitLabel = computed(() =>
  useActual.value ? `电阻率/${props.unit}` : '电阻率/%',
);
</script>

<style lang="scss" scoped>
.out_rectangle {
  position: fixed;
  width: 15%;
  height: 30%;
  top: 42%;
  right: 1%;

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
      rgba(181, 11, 39, 1),
      rgba(0, 0, 0, 0)
    );
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
    border-top-color: rgba(181, 11, 39, 1);
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
    border-top-color: rgba(228, 217, 211, 1);
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
    border-top-color: rgba(59, 76, 192, 1);
  }

  .text1 {
    position: absolute;
    top: -18%;
    left: 3%;
    font-size: 12px;
    color: white;
  }

  .text2 {
    position: absolute;
    top: -18%;
    left: 48%;
    font-size: 12px;
    color: white;
  }

  .text3 {
    position: absolute;
    top: -18%;
    left: 88%;
    font-size: 12px;
    color: white;
  }

  .text4 {
    position: absolute;
    top: 55px;
    left: 30%;
    font-size: 12px;
    color: white;
  }
}
</style>
