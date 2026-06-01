<template>
  <ul class="tsp-selector">
    <li :class="activeType === 'vp' ? 'active' : ''" @click="select('vp')">VP</li>
    <li :class="activeType === 'vs' ? 'active' : ''" @click="select('vs')">VS</li>
    <li :class="activeType === 'e'  ? 'active' : ''" @click="select('e')">深度</li>
  </ul>
</template>

<script setup>
import { ref } from 'vue';

const emit = defineEmits(['change']);
const activeType = ref('vs'); // 默认 VS，与 Layue-master 一致

function select(type) {
  if (activeType.value === type) return;
  activeType.value = type;
  emit('change', type);
}
</script>

<style lang="scss" scoped>
.tsp-selector {
  position: absolute;
  top: 70px;
  right: 280px;
  list-style-type: none;
  margin: 0;
  padding: 0;
  z-index: 100;

  li {
    cursor: pointer;
    width: 120px;
    height: 35px;
    line-height: 35px;
    text-align: center;
    margin: 10px 0;
    font-size: 16px;
    color: white;
    background-color: rgba(50, 69, 139, 0.85);
    border-radius: 6px;
    border: 1px solid rgba(0, 242, 255, 0.3);
    transition: background-color 0.2s, color 0.2s;

    &:hover {
      background-color: rgba(0, 120, 180, 0.9);
    }
  }

  .active {
    background-color: rgba(0, 80, 160, 0.95);
    color: #00f2ff;
    border-color: #00f2ff;
  }
}
</style>
