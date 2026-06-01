<template>
  <div id="app-container">
    <router-view />
  </div>
</template>

<script setup lang="ts">
</script>

<style>
/* 确保全屏 */
html, body, #app, #app-container { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; }
</style>