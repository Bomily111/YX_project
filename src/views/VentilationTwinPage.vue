<template>
  <div class="ventilation-twin-wrapper">
    <VentilationModule />
    <AgentChat :context="{ scene: 'vent' }" />
  </div>
</template>

<script setup lang="ts">
import VentilationModule from '@/views/ventilation-module/VentilationModule.vue'
import { AgentChat } from '@/ai-agent'
</script>

<style scoped>.ventilation-twin-wrapper{position:fixed;inset:0}</style>
