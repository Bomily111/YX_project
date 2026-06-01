<template>
  <div class="toolbar-float">
    <button
      class="tool-btn"
      :class="{ active: activeTool === 'roaming' }"
      title="隧道漫游"
      @click="$emit('toggle-tool', 'roaming')"
    >▶▶</button>

    <button
      class="tool-btn"
      :class="{ active: activeTool === 'measure' }"
      title="空间测量"
      @click="$emit('toggle-tool', 'measure')"
    >⊿</button>

    <button
      class="tool-btn"
      :class="{ active: activeTool === 'clip' }"
      title="模型剖切"
      @click="$emit('toggle-tool', 'clip')"
    >◫</button>

    <button
      class="tool-btn"
      title="截图导出"
      @click="$emit('action', 'screenshot')"
    >◎</button>

    <button
      class="tool-btn"
      :class="{ active: activeTool === 'coord' }"
      title="坐标查询"
      @click="$emit('toggle-tool', 'coord')"
    >⊕</button>

    <button
      class="tool-btn"
      title="全屏显示"
      @click="$emit('action', 'fullscreen')"
    >⛶</button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  activeTool: string | null;
}>();

defineEmits<{
  'toggle-tool': [tool: string];
  action: [action: string];
}>();
</script>

<style scoped lang="scss">
.toolbar-float {
  position: fixed;
  left: 12px;
  top: 68px;
  z-index: 50;
  display: flex;
  flex-direction: row;
  gap: 2px;
  padding: 4px 6px;
  background: rgba(0, 15, 35, 0.88);
  border: 1px solid rgba(0, 200, 255, 0.3);
  border-radius: 4px;
  backdrop-filter: blur(10px);
  box-shadow: 0 0 16px rgba(0, 120, 200, 0.25);
}

.tool-btn {
  width: 36px;
  height: 32px;
  padding: 0;
  background: transparent;
  border: 1px solid transparent;
  color: rgba(180, 220, 255, 0.7);
  font-size: 16px;
  cursor: pointer;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  position: relative;

  &:hover {
    background: rgba(0, 180, 255, 0.15);
    border-color: rgba(0, 200, 255, 0.3);
    color: #fff;
  }

  &.active {
    background: rgba(0, 180, 255, 0.22);
    border-color: rgba(0, 220, 255, 0.55);
    color: #00eaff;
    box-shadow: 0 0 8px rgba(0, 200, 255, 0.25);
  }
}
</style>
