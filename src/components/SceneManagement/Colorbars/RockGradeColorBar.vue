<template>
  <div class="grade-legend">
    <div class="grade-legend__title"><span>综合围岩分级</span><small>TSP波速比 + TEM低阻修正</small></div>
    <div class="grade-legend__items">
      <div v-for="item in grades" :key="item.grade">
        <i :style="{ background: item.color }"></i>
        <b>{{ item.grade }}级</b>
        <span>{{ item.description }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const grades = [
  { grade: 'Ⅱ', color: '#5a9fc6', description: '完整—较完整' },
  { grade: 'Ⅲ', color: '#244b78', description: '较完整—较破碎' },
  { grade: 'Ⅳ', color: '#e8bd35', description: '较破碎' },
  { grade: 'Ⅴ', color: '#8f3f20', description: '破碎—极破碎' },
]
</script>

<style scoped lang="scss">
.grade-legend {
  position:fixed; z-index:100; top:118px; left:310px; width:270px; padding:9px 12px;
  border:1px solid rgba(66,151,183,.34); border-radius:7px;
  background:rgba(3,14,24,.86); box-shadow:0 6px 20px rgba(0,0,0,.3); pointer-events:none;
  backdrop-filter:blur(6px);
}
.grade-legend__title { display:flex; align-items:center; justify-content:space-between; margin-bottom:7px; span { color:#83d8e8; font-size:11px; } small { color:#55778e; font-size:8px; } }
.grade-legend__items { display:grid; grid-template-columns:repeat(2,1fr); gap:7px 10px; div { display:grid; grid-template-columns:10px auto; align-items:center; column-gap:5px; } i { width:9px; height:9px; border-radius:2px; } b { color:#bfd1dc; font-size:9px; } span { grid-column:1/-1; margin-top:2px; color:#58758a; font-size:7px; white-space:nowrap; } }
@media(max-width:1100px) { .grade-legend { left:295px; width:250px; } }
</style>
