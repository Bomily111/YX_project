<template>
  <!-- 遮罩层 -->
  <div class="bs-backdrop" @click.self="emit('close')">

    <!-- 浮窗主体 -->
    <div class="bs-window">

      <!-- ── 标题栏 ─────────────────────────────────────── -->
      <div class="bs-header">
        <div class="bs-title-group">
          <span class="bs-icon">◈</span>
          <span class="bs-title">爆破设计面板</span>
          <span class="bs-mileage">{{ worksite.mileage }}</span>
        </div>
        <div class="bs-header-right">
          <div class="bs-risk-tag" :class="riskCls">{{ worksite.riskLevel }}</div>
          <label class="bd-import-btn" :class="{ busy: importBusy }">
            {{ importBusy ? '◌ 识别中…' : '⊕ 导入图片' }}
            <input type="file" accept="image/*" style="display:none" @change="onImportImage" :disabled="importBusy">
          </label>
          <button class="bs-close-btn" @click="emit('close')" title="关闭">✕</button>
        </div>
      </div>

      <!-- ── 内容区：炮孔图 + 参数面板 ─────────────────── -->
      <div class="bs-body app-body">
        <div class="diagram-wrap">
          <BlastDiagram ref="diagramRef" />
        </div>
        <BlastRightPanel
          @design="onDesign"
          @reset="onReset"
          @eval="onEval"
        />
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import BlastDiagram from '@/views/BlastStation/BlastDiagram.vue';
import BlastRightPanel from '@/views/BlastStation/BlastRightPanel.vue';
import { detectHolesFromFile } from '@/utils/Common/HoleDetection';

const props = defineProps<{
  worksite: {
    id: string;
    name: string;
    mileage: string;
    rockLevel: string;
    area: string;
    method: string;
    riskLevel: string;
  };
}>();
const emit = defineEmits<{ close: [] }>();

const importBusy = ref(false);
const diagramRef = ref<any>(null);

const riskCls = computed(() => {
  const r = props.worksite.riskLevel;
  if (r.includes('高')) return 'risk-high';
  if (r.includes('中')) return 'risk-mid';
  return 'risk-low';
});

async function onImportImage(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || !diagramRef.value) return;
  input.value = '';
  importBusy.value = true;
  try {
    const holes = await detectHolesFromFile(file);
    diagramRef.value.loadDetectedHoles(holes);
  } catch (err) {
    console.error('[BlastStation] 图片识别失败:', err);
  } finally {
    importBusy.value = false;
  }
}

function onDesign({ perimN, innerN }: any) {
  diagramRef.value?.blastUpdate(perimN, innerN);
}
function onReset() {
  diagramRef.value?.blastReset();
  diagramRef.value?.blastEvalReset();
}
function onEval() {
  diagramRef.value?.blastEval(0.155);
}
</script>

<style scoped lang="scss">
/* ── 遮罩 ─────────────────────────────────────────────── */
.bs-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 5, 15, 0.55);
  backdrop-filter: blur(2px);
}

/* ── 浮窗 ─────────────────────────────────────────────── */
.bs-window {
  width: 90vw;
  height: 88vh;
  max-width: 1440px;
  display: flex;
  flex-direction: column;
  background: rgba(0, 8, 22, 0.94);
  border: 1px solid rgba(0, 180, 255, 0.3);
  border-radius: 6px;
  box-shadow:
    0 0 0 1px rgba(0, 100, 200, 0.15),
    0 8px 60px rgba(0, 0, 0, 0.7),
    0 0 40px rgba(0, 100, 255, 0.08);
  overflow: hidden;
  font-family: "Microsoft YaHei", sans-serif;
}

/* ── 标题栏 ────────────────────────────────────────────── */
.bs-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px 0 20px;
  height: 50px;
  background: linear-gradient(to bottom, rgba(0, 18, 42, 0.98), rgba(0, 12, 30, 0.92));
  border-bottom: 1px solid rgba(0, 180, 255, 0.2);
  flex-shrink: 0;
}

.bs-title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bs-icon { font-size: 17px; color: #00aaff; }

.bs-title {
  font-size: 17px;
  font-weight: bold;
  color: #e8f4ff;
  text-shadow: 0 0 10px rgba(0, 200, 255, 0.45);
  letter-spacing: 2px;
}

.bs-mileage {
  font-size: 13px;
  color: rgba(0, 200, 255, 0.7);
  font-family: 'Consolas', monospace;
  background: rgba(0, 60, 120, 0.4);
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid rgba(0, 150, 255, 0.28);
}

.bs-header-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
}

.bs-risk-tag {
  font-size: 11px;
  font-weight: bold;
  padding: 3px 10px;
  border-radius: 3px;

  &.risk-high { background: rgba(255, 40, 40, 0.18); color: #ff6666; border: 1px solid rgba(255, 40, 40, 0.35); }
  &.risk-mid  { background: rgba(255, 160, 0, 0.18);  color: #ffaa44; border: 1px solid rgba(255, 160, 0, 0.35); }
  &.risk-low  { background: rgba(0, 200, 80, 0.18);   color: #44ff88; border: 1px solid rgba(0, 200, 80, 0.35); }
}

.bd-import-btn {
  padding: 4px 11px;
  background: rgba(0, 60, 120, 0.45);
  border: 1px solid rgba(0, 200, 255, 0.35);
  color: #00ddff;
  font-size: 12px;
  cursor: pointer;
  border-radius: 3px;
  transition: all 0.15s;
  white-space: nowrap;

  &:hover { background: rgba(0, 90, 170, 0.55); border-color: rgba(0, 220, 255, 0.55); }
  &.busy  { color: rgba(0, 200, 255, 0.4); cursor: default; }
}

.bs-close-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(60, 0, 0, 0.35);
  border: 1px solid rgba(255, 80, 80, 0.25);
  border-radius: 3px;
  color: rgba(255, 120, 120, 0.65);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: rgba(160, 20, 20, 0.5);
    border-color: rgba(255, 80, 80, 0.55);
    color: #ff8888;
  }
}

/* ── 内容区 ────────────────────────────────────────────── */
.bs-body {
  flex: 1;
  display: flex;
  flex-direction: row;
  overflow: hidden;
  min-height: 0;
}

/* 炮孔图占剩余宽度 */
.diagram-wrap {
  flex: 1;
  overflow: hidden;
  min-width: 0;
  border-right: 1px solid rgba(0, 120, 200, 0.15);
}
</style>
