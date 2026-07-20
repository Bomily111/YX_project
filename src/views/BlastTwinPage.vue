<template>
  <div class="blast-twin-wrapper">
    <div v-if="!ready" class="loading-overlay">
      <div class="loading-box">
        <div class="loading-bar-track">
          <div class="loading-bar-fill" :style="{ width: loadPercent + '%' }"></div>
        </div>
        <div class="loading-text">{{ loadPercent }}%</div>
      </div>
    </div>

    <TunnelModule v-show="ready" />
    <button v-show="ready" class="back-btn" @click="$router.push('/')">← 返回平台</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import TunnelModule from '@/views/tunnel-module/TunnelModule.vue'

const ready = ref(false)
const loadPercent = ref(0)

onMounted(() => {
  const interval = setInterval(() => {
    if (loadPercent.value < 90) {
      loadPercent.value += Math.floor(Math.random() * 15) + 5
      if (loadPercent.value > 90) loadPercent.value = 90
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
.blast-twin-wrapper { position: fixed; inset: 0; }

.loading-overlay {
  position: fixed; inset: 0; z-index: 200;
  display: flex; align-items: center; justify-content: center;
  background: #0a0e15;
}
.loading-box { text-align: center; }
.loading-bar-track {
  width: 280px; height: 4px; background: rgba(56,189,248,.15);
  border-radius: 2px; overflow: hidden; margin: 0 auto;
}
.loading-bar-fill {
  height: 100%; background: linear-gradient(90deg, #00eaff, #38bdf8);
  border-radius: 2px; transition: width .3s ease;
}
.loading-text {
  margin-top: 12px; font-size: 14px; color: #7dd3fc;
  font-family: system-ui, "Microsoft YaHei", sans-serif;
}

.back-btn {
  position: fixed; top: 40px; left: 18px; z-index: 100;
  background: rgba(13,20,33,.85); border: 1px solid rgba(56,189,248,.3);
  color: #cfe4fb; padding: 8px 16px; border-radius: 8px; cursor: pointer;
  font-size: 13px; font-family: inherit; transition: .15s;
}
.back-btn:hover { background: rgba(56,189,248,.2); border-color: #38bdf8; color: #fff; }
</style>
