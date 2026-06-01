<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="roaming-popup"
      :style="{ left: pos.left + 'px', top: pos.top + 'px' }"
    >
      <div class="popup-header" @mousedown="startDrag">
        <span class="popup-title">隧道漫游控制</span>
        <button class="close-btn" @click="handleClose" title="关闭">✕</button>
      </div>

      <div class="popup-body">
        <!-- 跳转按钮 -->
        <div class="jump-row">
          <button class="roam-btn" title="跳转到隧道入口" @click="jumpToEntrance" :disabled="!ready">
            ◀◀ 入口
          </button>
          <button
            class="roam-btn play-btn"
            :title="playing ? '暂停漫游' : '开始漫游'"
            @click="togglePlay"
            :disabled="!ready"
          >
            <span v-if="playing">⏸ 暂停</span>
            <span v-else>▶ 开始</span>
          </button>
          <button class="roam-btn stop-btn" title="停止并回到起点" @click="stop" :disabled="!ready || (!playing && !paused)">
            ■ 停止
          </button>
          <button class="roam-btn" title="跳转到隧道出口" @click="jumpToExit" :disabled="!ready">
            出口 ▶▶
          </button>
        </div>

        <!-- 速度调节 -->
        <div class="control-row">
          <span class="row-label">漫游速度</span>
          <button class="speed-btn" title="减速" @click="slowDown" :disabled="!ready">−</button>
          <span class="speed-val">{{ speed }}<span class="speed-unit"> m/s</span></span>
          <button class="speed-btn" title="加速" @click="speedUp" :disabled="!ready">+</button>
          <button class="speed-preset" :class="{ active: speed === 10 }" @click="ctrl.setSpeed(10)" :disabled="!ready">10</button>
          <button class="speed-preset" :class="{ active: speed === 30 }" @click="ctrl.setSpeed(30)" :disabled="!ready">30</button>
          <button class="speed-preset" :class="{ active: speed === 80 }" @click="ctrl.setSpeed(80)" :disabled="!ready">80</button>
        </div>

        <!-- 进度与里程 -->
        <div class="control-row">
          <span class="row-label">漫游进度</span>
          <input
            class="progress-slider"
            type="range"
            min="0" max="1000" step="1"
            :value="Math.round(progress * 1000)"
            @input="onSeek"
          />
          <span class="mileage">{{ currentMileage }}</span>
        </div>

        <!-- 状态信息 -->
        <div class="status-row">
          <span class="status-dot" :class="statusCls"></span>
          <span class="status-text">{{ statusText }}</span>
          <span class="waypoint-info">{{ currentWaypoint }} / {{ totalWaypoints }} 航点</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onBeforeUnmount, watch } from 'vue';
import { getRoamingController, type RoamingState } from '@/utils/Common/RoamingController';
import { DTScopeEngine } from '@/utils/Common/Viewer';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

function handleClose() {
  if (playing.value || paused.value) {
    ctrl.exit();
  }
  emit('close');
}

const ctrl = getRoamingController();

const ready = ref(false);
const playing = ref(false);
const paused = ref(false);
const speed = ref(30);
const progress = ref(0);
const currentMileage = ref('DK278+100');
const currentWaypoint = ref(0);
const totalWaypoints = ref(0);

const pos = reactive({ left: 64, top: 96 });

function sync(s: RoamingState) {
  playing.value = s.playing;
  paused.value = s.paused;
  speed.value = s.speed;
  progress.value = s.progress;
  currentMileage.value = s.currentMileage;
  currentWaypoint.value = s.currentWaypoint;
  totalWaypoints.value = s.totalWaypoints;
}

ctrl.onChange(() => sync(ctrl.getState()));

const statusCls = computed(() => {
  if (playing.value) return 'dot-play';
  if (paused.value) return 'dot-pause';
  return 'dot-idle';
});

const statusText = computed(() => {
  if (playing.value) return '漫游中...';
  if (paused.value) return '已暂停';
  return '就绪';
});

function togglePlay() {
  if (!ready.value) return;
  if (playing.value && !paused.value) {
    ctrl.pause();
  } else {
    ctrl.start();
  }
}

function stop() { ctrl.stop(); }
function jumpToEntrance() { ctrl.jumpToEntrance(); }
function jumpToExit() { ctrl.jumpToExit(); }
function speedUp() { ctrl.setSpeed(speed.value + 10); }
function slowDown() { ctrl.setSpeed(speed.value - 10); }

function onSeek(e: Event) {
  const val = Number((e.target as HTMLInputElement).value) / 1000;
  ctrl.seekToProgress(val);
}

// ── 拖拽 ──────────────────────────────────────────────
const drag = reactive({
  isDragging: false,
  startX: 0,
  startY: 0,
});

function startDrag(e: MouseEvent) {
  drag.isDragging = true;
  drag.startX = e.clientX - pos.left;
  drag.startY = e.clientY - pos.top;
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
}

function onDrag(e: MouseEvent) {
  if (!drag.isDragging) return;
  pos.left = e.clientX - drag.startX;
  pos.top = e.clientY - drag.startY;
}

function stopDrag() {
  drag.isDragging = false;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
}

// ── 等待 Viewer 就绪 ──────────────────────────────────
let retryTimer: ReturnType<typeof setInterval> | null = null;

function getCesiumViewer(): any {
  if ((window as any).viewer) return (window as any).viewer;
  if (DTScopeEngine && (DTScopeEngine as any).viewer) return (DTScopeEngine as any).viewer;
  return null;
}

function initViewer() {
  const viewer = getCesiumViewer();
  if (viewer) {
    ctrl.setViewer(viewer);
    ready.value = true;
    sync(ctrl.getState());
    return true;
  }
  return false;
}

watch(() => props.visible, (v) => {
  if (v && !ready.value) {
    if (!initViewer()) {
      let retry = 0;
      retryTimer = setInterval(() => {
        if (initViewer() || ++retry > 15) {
          if (retryTimer) clearInterval(retryTimer);
        }
      }, 200);
    }
  }
}, { immediate: true });

onBeforeUnmount(() => {
  if (retryTimer) clearInterval(retryTimer);
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
  ctrl.exit();
});
</script>

<style scoped lang="scss">
.roaming-popup {
  position: fixed;
  z-index: 100;
  width: 420px;
  background: rgba(0, 15, 35, 0.92);
  border: 1px solid rgba(0, 200, 255, 0.4);
  border-radius: 4px;
  box-shadow: 0 0 24px rgba(0, 120, 200, 0.3), 0 8px 32px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(12px);
  font-family: "Microsoft YaHei", sans-serif;
  user-select: none;
  overflow: hidden;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 12px;
  height: 32px;
  background: rgba(0, 80, 160, 0.5);
  border-bottom: 1px solid rgba(0, 200, 255, 0.3);
  cursor: move;
}

.popup-title {
  font-size: 13px;
  font-weight: bold;
  color: #00eaff;
  letter-spacing: 1px;
}

.close-btn {
  width: 20px;
  height: 20px;
  padding: 0;
  background: transparent;
  border: 1px solid transparent;
  color: rgba(200, 220, 255, 0.7);
  font-size: 14px;
  cursor: pointer;
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(255, 80, 80, 0.3);
    border-color: rgba(255, 100, 100, 0.5);
    color: #ff6b6b;
  }
}

.popup-body {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.jump-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.roam-btn {
  height: 28px;
  padding: 0 12px;
  background: rgba(0, 70, 140, 0.35);
  border: 1px solid rgba(0, 200, 255, 0.35);
  color: #00d4ff;
  font-size: 12px;
  font-family: "Microsoft YaHei", sans-serif;
  cursor: pointer;
  border-radius: 2px;
  white-space: nowrap;
  transition: all 0.15s;

  &:hover:not(:disabled) {
    background: rgba(0, 200, 255, 0.18);
    box-shadow: 0 0 8px rgba(0, 200, 255, 0.2);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}

.play-btn {
  min-width: 72px;
}

.stop-btn {
  color: #ff8888;
  border-color: rgba(255, 120, 120, 0.35);

  &:hover:not(:disabled) {
    background: rgba(255, 80, 80, 0.15);
    border-color: rgba(255, 100, 100, 0.5);
    color: #ff6b6b;
  }
}

.control-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.row-label {
  font-size: 12px;
  color: rgba(180, 210, 240, 0.7);
  min-width: 56px;
  white-space: nowrap;
}

.speed-btn {
  width: 22px;
  height: 22px;
  padding: 0;
  background: rgba(0, 70, 140, 0.3);
  border: 1px solid rgba(0, 180, 220, 0.3);
  color: #00d4ff;
  font-size: 14px;
  cursor: pointer;
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;

  &:hover:not(:disabled) {
    background: rgba(0, 180, 255, 0.2);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}

.speed-val {
  font-size: 12px;
  color: #00d4ff;
  min-width: 52px;
  text-align: center;
  font-family: 'Consolas', monospace;
}

.speed-unit {
  font-size: 10px;
  color: rgba(0, 200, 255, 0.5);
}

.speed-preset {
  width: 28px;
  height: 20px;
  padding: 0;
  background: rgba(0, 60, 120, 0.25);
  border: 1px solid rgba(0, 160, 200, 0.25);
  color: rgba(180, 210, 240, 0.6);
  font-size: 11px;
  font-family: 'Consolas', monospace;
  cursor: pointer;
  border-radius: 2px;
  transition: all 0.15s;

  &:hover:not(:disabled) {
    background: rgba(0, 160, 220, 0.2);
    color: #fff;
  }

  &.active {
    background: rgba(0, 180, 255, 0.25);
    border-color: rgba(0, 220, 255, 0.55);
    color: #00eaff;
    box-shadow: 0 0 6px rgba(0, 200, 255, 0.2);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}

.progress-slider {
  flex: 1;
  height: 4px;
  cursor: pointer;
  accent-color: #00d4ff;
}

.mileage {
  font-size: 12px;
  color: #00eaff;
  font-family: 'Consolas', monospace;
  min-width: 72px;
  text-align: right;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px solid rgba(0, 180, 220, 0.15);
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;

  &.dot-play  { background: #44ff88; box-shadow: 0 0 6px #44ff88; animation: pulse 1s ease-in-out infinite; }
  &.dot-pause { background: #ffcc00; box-shadow: 0 0 6px #ffcc00; }
  &.dot-idle  { background: rgba(150, 200, 240, 0.5); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.status-text {
  font-size: 12px;
  color: rgba(200, 230, 255, 0.8);
}

.waypoint-info {
  font-size: 11px;
  color: rgba(150, 200, 230, 0.5);
  margin-left: auto;
}
</style>
