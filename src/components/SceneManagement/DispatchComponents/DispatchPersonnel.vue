<template>
  <div class="dp-float" :style="{ left: pos.x + 'px', top: pos.y + 'px' }">
    <div class="dpf-header" @mousedown="startDrag">
      <span class="dpf-icon">👷</span>
      <span class="dpf-title">人员追踪 · 实时状态</span>
      <span class="dpf-badge">{{ activeCount }}人在岗</span>
      <button class="dpf-close" @click="emit('close')">×</button>
    </div>
    <div class="dpf-body">
      <div class="resource-list">
        <div
          v-for="item in personnel"
          :key="item.id"
          class="resource-item"
          :class="{ selected: selectedItem === item.id }"
          @click="selectedItem = item.id"
        >
          <div class="ri-head">
            <span class="ri-name">{{ item.name }}</span>
            <span class="ri-status" :class="statusCls(item.status)">{{ statusLabel(item.status) }}</span>
          </div>
          <div class="ri-sub">
            <span class="ri-loc">{{ item.location }}</span>
            <span class="ri-task">{{ item.task }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue';

const emit = defineEmits<{ close: [] }>();

const pos = ref({ x: window.innerWidth - 380, y: 80 });
const dragging = ref(false);
let dragStart = { x: 0, y: 0 };

const startDrag = (e: MouseEvent) => {
  dragging.value = true;
  dragStart = { x: e.clientX - pos.value.x, y: e.clientY - pos.value.y };
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
};
const onDrag = (e: MouseEvent) => {
  if (!dragging.value) return;
  pos.value = {
    x: Math.max(0, Math.min(e.clientX - dragStart.x, window.innerWidth - 300)),
    y: Math.max(0, Math.min(e.clientY - dragStart.y, window.innerHeight - 100)),
  };
};
const stopDrag = () => {
  dragging.value = false;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
};
onBeforeUnmount(() => { stopDrag(); });

const selectedItem = ref(1);

const personnel = [
  { id: 1, name: '张建国（班长）', status: 'working', location: 'DK289+450', task: '爆破作业监督' },
  { id: 2, name: '李强',           status: 'working', location: 'DK289+450', task: '钻孔操作' },
  { id: 3, name: '王鹏',           status: 'working', location: 'DK289+450', task: '装药' },
  { id: 4, name: '刘伟',           status: 'break',   location: 'DK285+000', task: '休息中' },
  { id: 5, name: '赵磊',           status: 'working', location: 'DK289+450', task: '通风管理' },
  { id: 11, name: '孙志远',        status: 'working', location: 'DK287+800', task: '初喷支护' },
  { id: 12, name: '周明',          status: 'working', location: 'DK289+450', task: '测量放线' },
  { id: 13, name: '吴涛',          status: 'break',   location: 'DK285+000', task: '休息中' },
];

const activeCount = computed(() => personnel.filter(p => p.status === 'working').length);
const statusCls   = (s: string) => s === 'working' ? 'st-working' : 'st-break';
const statusLabel = (s: string) => s === 'working' ? '作业中' : '休息';
</script>

<style scoped lang="scss">
.dp-float {
  position: fixed;
  z-index: 43;
  width: 290px;
  max-height: 460px;
  background: rgba(0, 8, 22, 0.88);
  border: 1px solid rgba(0, 170, 255, 0.25);
  border-top: 3px solid rgba(100, 200, 255, 0.5);
  border-radius: 6px;
  backdrop-filter: blur(14px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: "Microsoft YaHei", sans-serif;
}

.dpf-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(0, 20, 40, 0.7);
  border-bottom: 1px solid rgba(0, 150, 255, 0.12);
  cursor: move;
  user-select: none;
  flex-shrink: 0;
}
.dpf-icon { font-size: 14px; }
.dpf-title { flex: 1; font-size: 12px; font-weight: bold; color: rgba(200, 240, 255, 0.85); }
.dpf-badge { font-size: 10px; color: #44ff88; background: rgba(0, 200, 80, 0.12); padding: 1px 6px; border-radius: 3px; }
.dpf-close {
  width: 20px; height: 20px; background: rgba(255, 40, 40, 0.15);
  border: 1px solid rgba(255, 40, 40, 0.3); color: #ff8888; font-size: 13px;
  cursor: pointer; border-radius: 3px; display: flex; align-items: center; justify-content: center;
  &:hover { background: rgba(255, 40, 40, 0.3); }
}

.dpf-body {
  overflow-y: auto;
  padding: 8px 10px;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 150, 255, 0.3) transparent;
  &::-webkit-scrollbar { width: 3px; }
  &::-webkit-scrollbar-thumb { background: rgba(0, 150, 255, 0.3); border-radius: 2px; }
}

.resource-list { display: flex; flex-direction: column; gap: 4px; }
.resource-item {
  padding: 7px 10px; background: rgba(0, 25, 60, 0.4);
  border: 1px solid rgba(0, 100, 200, 0.18); border-radius: 4px; cursor: pointer; transition: all 0.15s;
  &:hover { background: rgba(0, 45, 100, 0.5); border-color: rgba(0, 150, 255, 0.35); }
  &.selected { background: rgba(0, 60, 140, 0.6); border-color: #00aaff; box-shadow: 0 0 8px rgba(0, 170, 255, 0.2); }
}
.ri-head { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
.ri-name { flex: 1; font-size: 12px; color: rgba(200, 240, 255, 0.85); }
.ri-status {
  font-size: 10px; padding: 1px 6px; border-radius: 3px; font-weight: bold;
  &.st-working { background: rgba(0, 200, 80, 0.2); color: #44ff88; border: 1px solid rgba(0, 200, 80, 0.35); }
  &.st-break   { background: rgba(255, 160, 0, 0.2);  color: #ffaa00; border: 1px solid rgba(255, 160, 0, 0.35); }
}
.ri-sub { display: flex; gap: 6px; font-size: 10px; color: rgba(180, 220, 255, 0.4); }
.ri-loc { flex-shrink: 0; }
.ri-task { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
