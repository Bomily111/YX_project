<template>
  <div class="top-nav-container">
    <!-- 总览模式：顶部导航选项卡 -->
    <div v-if="!activeScene" class="top-nav-panel">
      <div class="tn-list">
        <div
          v-for="scene in scenes"
          :key="scene.key"
          class="tn-item"
          @click="$emit('select-scene', scene.key)"
        >
          {{ scene.name }}
        </div>
      </div>
    </div>

    <!-- 场景模式：面包屑导航条 -->
    <div v-else class="top-nav-panel">
      <div class="tn-list">
        <div class="tn-item bc-back" @click="$emit('back-to-overview')">
          ← 返回总览
        </div>
        <div class="tn-item bc-scene">
          {{ currentScene?.name }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

export interface SceneDef {
  key: string;
  name: string;
  icon: string;
  color: string;
  status: string;
  statusCls: string;
  metricVal: string;
  metricUnit: string;
}

const props = defineProps<{
  activeScene: string | null;
  scenes: SceneDef[];
}>();

defineEmits<{
  'select-scene': [key: string];
  'back-to-overview': [];
}>();

const currentScene = computed(() =>
  props.scenes.find(s => s.key === props.activeScene) ?? null,
);
</script>

<style scoped lang="scss">
/* ── 顶部导航容器 ─────────────────────────────────────────── */
.top-nav-container {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.top-nav-panel {
  display: flex;
  align-items: center;
  height: 36px;
  pointer-events: all;
}

.tn-list {
  display: flex;
  align-items: center;
  height: 100%;
}

.tn-item {
  position: relative;
  padding: 0 24px;
  font-size: 15px;
  font-weight: bold;
  color: rgba(200, 240, 255, 0.7);
  cursor: pointer;
  transition: all 0.3s ease;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  height: 100%;
  white-space: nowrap;
  flex-shrink: 0;

  /* 细斜线分隔（呼应左侧标题斜切） */
  &:not(:last-child)::after {
    content: '';
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%) skewX(-25deg);
    width: 1.5px;
    height: 40%;
    background: rgba(0, 200, 255, 0.3);
  }

  /* 悬停发光 */
  &:hover {
    color: #00eaff;
    text-shadow: 0 0 12px #00eaff;
  }
}

/* 面包屑特定样式 */
.bc-back {
  color: rgba(0, 200, 255, 0.8);
  
  &:hover {
    color: #00eaff;
    text-shadow: 0 0 10px #00eaff;
  }
}

.bc-scene {
  color: #00eaff;
  text-shadow: 0 0 8px #00eaff;
  cursor: default;
}
</style>
