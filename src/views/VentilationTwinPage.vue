<template>
  <div class="ventilation-twin-wrapper">
    <VentilationModule />
    <button class="back-btn" @click="$router.push('/')">← 返回平台</button>
    <AgentChat :context="{ scene: 'vent' }" />
  </div>
</template>

<script setup lang="ts">
import VentilationModule from '@/views/ventilation-module/VentilationModule.vue'
import { AgentChat } from '@/ai-agent'
</script>

<style scoped>
.ventilation-twin-wrapper{position:fixed;inset:0}.back-btn{position:fixed;top:17px;left:18px;z-index:100;background:rgba(8,22,34,.9);border:1px solid rgba(56,189,248,.35);color:#cfe4fb;padding:7px 13px;border-radius:7px;cursor:pointer;font-size:12px;transition:.15s}.back-btn:hover{background:rgba(56,189,248,.2);border-color:#38bdf8;color:#fff}
</style>
