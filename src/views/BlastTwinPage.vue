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

    <!-- AI 智能助手（爆破场景） -->
    <AgentChat :context="{ scene: 'blast' }" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import TunnelModule from '@/views/tunnel-module/TunnelModule.vue'
import { AgentChat, registerTools, unregisterModule } from '@/ai-agent'
import { blastTools } from '@/ai-agent/tools/blast.tools'

const ready = ref(false)
const loadPercent = ref(0)

onMounted(() => {
  // 注册爆破专项工具到 AI Agent
  registerTools('blast', blastTools)

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

onBeforeUnmount(() => {
  unregisterModule('blast')
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

</style>
