<template>
  <div class="stp-wrapper">
    <div v-if="!ready" class="stp-loading-overlay">
      <div class="stp-loading-box">
        <div class="stp-loading-bar-track">
          <div class="stp-loading-bar-fill" :style="{ width: loadPercent + '%' }"></div>
        </div>
        <div class="stp-loading-text">{{ loadPercent }}%</div>
      </div>
    </div>

    <SupportModule v-show="ready" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import SupportModule from '@/views/support-module/SupportModule.vue'

const ready = ref(false)
const loadPercent = ref(0)

onMounted(() => {
  const interval = setInterval(() => {
    if (loadPercent.value < 85) {
      loadPercent.value += Math.floor(Math.random() * 12) + 3
      if (loadPercent.value > 85) loadPercent.value = 85
    }
  }, 200)

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      clearInterval(interval)
      loadPercent.value = 100
      setTimeout(() => {
        ready.value = true
      }, 150)
    })
  })
})
</script>

<style scoped>
.stp-wrapper { position: fixed; inset: 0; }

.stp-loading-overlay {
  position: fixed; inset: 0; z-index: 200;
  display: flex; align-items: center; justify-content: center;
  background: #0a0e15;
}
.stp-loading-box { text-align: center; }
.stp-loading-bar-track {
  width: 280px; height: 4px; background: rgba(56,189,248,.15);
  border-radius: 2px; overflow: hidden; margin: 0 auto;
}
.stp-loading-bar-fill {
  height: 100%; background: linear-gradient(90deg, #00eaff, #38bdf8);
  border-radius: 2px; transition: width .3s ease;
}
.stp-loading-text {
  margin-top: 12px; font-size: 14px; color: #7dd3fc;
  font-family: system-ui, "Microsoft YaHei", sans-serif;
}
</style>
