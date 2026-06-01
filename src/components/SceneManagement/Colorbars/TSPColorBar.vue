<template>
  <div class="out_rectangle">
    <div class="jojo"></div>
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
});

const LABELS = {
  vp: { min: '4052', mid: '4477', max: '4902', unit: 'm/s' },
  vs: { min: '2217', mid: '2562', max: '2692', unit: 'm/s' },
  e:  { min: '0',    mid: '150',  max: '300',  unit: 'm' },
};

const minVal   = computed(() => LABELS[props.activeType]?.min  ?? '');
const midVal   = computed(() => LABELS[props.activeType]?.mid  ?? '');
const maxVal   = computed(() => LABELS[props.activeType]?.max  ?? '');
const unitLabel = computed(() => LABELS[props.activeType]?.unit ?? '');
</script>

<style lang="scss" scoped>
.out_rectangle {
  position: fixed;
  width: 15%;
  height: 30%;
  top: 51%;
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
      rgba(181, 11, 39, 1)
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
