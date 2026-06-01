<template>
  <transition name="panel-slide-left">
    <div v-if="show" class="workflow-sidebar">
      <!-- Header -->
      <div class="ws-header">
        <button class="ws-back-btn" @click="$emit('back')" title="返回列表">
          <span class="back-icon">‹</span> 返回
        </button>
        <div class="ws-title-group">
          <div class="ws-title">自动化处理</div>
          <div class="ws-sub">{{ title }}</div>
        </div>
      </div>

      <!-- Body (copied from AutomatedProcessingPanel) -->
      <div class="ws-body">
        <!-- Step 1: Upload -->
        <div class="ap-step" :class="{ done: currentStep > 1, active: currentStep === 1 }">
          <div class="step-header">
            <span class="step-num">1</span>
            <span class="step-title">上传原始数据</span>
          </div>
          <div class="step-content">
            <label class="upload-area" :class="{ dragging: isDragging }"
              @dragover.prevent="isDragging = true"
              @dragleave.prevent="isDragging = false"
              @drop.prevent="handleFileDrop">
              <input type="file" ref="fileInput" @change="handleFileSelect" multiple style="display: none;" />
              <div v-if="files.length === 0">
                <div class="upload-icon">📤</div>
                <div>将文件拖拽至此，或<span class="upload-link" @click="triggerFileInput">点击选择</span></div>
                <div class="upload-hint">支持上传多个文件或单个 .zip 压缩包</div>
              </div>
              <div v-else class="file-list-container">
                <div class="file-list-scroller">
                  <div v-for="(file, index) in files" :key="index" class="file-info">
                    <div class="file-icon">📄</div>
                    <div class="file-details">
                      <div class="file-name" :title="file.name">{{ file.name }}</div>
                      <div class="file-size">{{ (file.size / 1024 / 1024).toFixed(2) }} MB</div>
                    </div>
                  </div>
                </div>
                <button class="file-remove-btn" @click.stop="removeFiles" title="移除所有文件">×</button>
              </div>
            </label>
            <button class="start-btn" :disabled="files.length === 0 || status !== 'idle'" @click="startProcessing">
              {{ status === 'idle' ? '开始处理' : '处理中...' }}
            </button>
          </div>
        </div>

        <!-- Step 2: Processing -->
        <div class="ap-step" :class="{ active: currentStep === 2 }">
          <div class="step-header">
            <span class="step-num">2</span>
            <span class="step-title">云端处理与建模</span>
          </div>
          <div class="step-content">
            <div class="status-bar">
              <div class="status-progress" :style="{ width: progress + '%' }"></div>
              <div class="status-text">{{ statusMessage }}</div>
            </div>
            <div class="status-log" ref="logContainer">
              <div v-for="(log, i) in logs" :key="i" class="log-item">
                <span class="log-time">{{ log.time }}</span>
                <span class="log-message">{{ log.message }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 3: Result -->
        <div class="ap-step" :class="{ done: status === 'complete' }">
          <div class="step-header">
            <span class="step-num">3</span>
            <span class="step-title">完成</span>
          </div>
          <div class="step-content result-content">
            <div v-if="status === 'complete'">
              <div class="result-icon">✅</div>
              <div class="result-text">处理成功！三维模型已生成。</div>
              <button class="view-btn" @click="viewResult">在场景中查看</button>
            </div>
            <div v-else-if="status === 'error'" class="error-info">
              <div class="result-icon">❌</div>
              <div class="result-text">处理失败！</div>
              <div class="error-details">{{ errorMessage }}</div>
            </div>
            <div v-else class="pending-text">
              等待处理结果...
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onBeforeUnmount } from 'vue';

const props = defineProps<{
  show: boolean;
  modelKey: string | null;
}>();

const emit = defineEmits<{
  back: [];
  'process-complete': [];
}>();

const keyNameMap: Record<string, string> = {
  weak_rock: '软弱围岩', high_stress: '高地应力', water_zone: '富水带', fracture_zone: '破碎带',
  face_sketch: '掌子面素描', gpr: '地质雷达', horiz_drill: '超前水平钻',
  deep_hole: '加深炮孔', tsp: 'TSP反演', tem: '瞬变电磁',
};
const title = computed(() => keyNameMap[props.modelKey ?? ''] ?? '自动化处理');

const currentStep = ref(1);
const files = ref<File[]>([]);
const isDragging = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const status = ref<'idle' | 'uploading' | 'processing' | 'complete' | 'error'>('idle');
const statusMessage = ref('准备就绪');
const progress = ref(0);
const logs = ref<{ time: string; message: string }[]>([]);
const logContainer = ref<HTMLElement | null>(null);
const errorMessage = ref('');

let pollingInterval: number | null = null;

const stopPolling = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    addLog('已停止查询任务状态。');
  }
};

const resetState = () => {
  currentStep.value = 1;
  files.value = [];
  status.value = 'idle';
  statusMessage.value = '准备就绪';
  progress.value = 0;
  logs.value = [];
  errorMessage.value = '';
};

watch(() => props.show, (newVal) => {
  if (newVal) {
    resetState();
  } else {
    stopPolling(); // 当侧边栏关闭时，停止轮询
  }
});

onBeforeUnmount(() => {
  stopPolling(); // 组件卸载前，确保停止轮询
});

const addLog = (message: string) => {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  logs.value.push({ time, message });
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight;
    }
  });
};

const triggerFileInput = () => { fileInput.value?.click(); };
const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files) files.value = Array.from(target.files);
};
const handleFileDrop = (e: DragEvent) => {
  isDragging.value = false;
  if (e.dataTransfer?.files) files.value = Array.from(e.dataTransfer.files);
};
const removeFiles = () => { files.value = []; };

const startProcessing = async () => {
  if (files.value.length === 0) return;

  // 1. 准备 FormData
  const formData = new FormData();
  files.value.forEach(f => {
    formData.append('files', f, f.name);
  });

  // 2. 重置状态并开始上传
  status.value = 'uploading';
  currentStep.value = 2; // 视觉上进入第二步
  progress.value = 0;
  logs.value = [];
  addLog(`准备上传 ${files.value.length} 个文件...`);
  statusMessage.value = '正在上传...';

  try {
    // 3. 上传文件并发起处理任务
    const uploadResponse = await fetch(`/api/process/${props.modelKey}`, {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`上传失败: ${uploadResponse.status} ${errorText}`);
    }

    const { jobId } = await uploadResponse.json();
    addLog(`上传成功。任务ID: ${jobId}`);
    statusMessage.value = '已进入处理队列...';
    status.value = 'processing';

    // 4. 开始轮询任务状态
    pollingInterval = window.setInterval(async () => {
      try {
        const statusResponse = await fetch(`/api/process/status/${jobId}`);
        if (!statusResponse.ok) throw new Error(`状态查询失败: ${statusResponse.statusText}`);
        
        const jobStatus = await statusResponse.json();

        // 更新UI
        progress.value = jobStatus.progress ?? progress.value;
        if (jobStatus.message) statusMessage.value = jobStatus.message;
        if (jobStatus.log) addLog(jobStatus.log); // 假设后端每次返回一条新日志

        if (jobStatus.status === 'complete') {
          stopPolling();
          status.value = 'complete';
          currentStep.value = 3;
          progress.value = 100;
          addLog('流程处理完毕。');
        } else if (jobStatus.status === 'error') {
          stopPolling();
          status.value = 'error';
          errorMessage.value = jobStatus.error || '未知后端错误';
          addLog(`处理失败: ${errorMessage.value}`);
        }
      } catch (pollError) {
        stopPolling();
        status.value = 'error';
        errorMessage.value = '无法连接服务器获取状态。';
        addLog(errorMessage.value);
      }
    }, 2000); // 每2秒查询一次

  } catch (uploadError) {
    status.value = 'error';
    errorMessage.value = (uploadError as Error).message;
    addLog(errorMessage.value);
  }
};

const viewResult = () => {
  emit('process-complete');
};
</script>

<style scoped lang="scss">
/* Styles adapted from SceneDataPanel and AutomatedProcessingPanel */
.panel-slide-left-enter-active,
.panel-slide-left-leave-active {
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
}
.panel-slide-left-enter-from,
.panel-slide-left-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

.workflow-sidebar {
  position: absolute;
  left: 0;
  top: 60px;
  bottom: 0;
  width: 272px;
  background: rgba(0, 6, 18, 0.88);
  border-right: 1px solid rgba(0, 170, 255, 0.2);
  z-index: 19;
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(16px);
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.5);
  --sc: #00e5ff;
}

.ws-header {
  display: flex;
  align-items: center;
  padding: 14px;
  border-bottom: 1px solid rgba(0, 170, 255, 0.15);
  background: rgba(0, 20, 48, 0.6);
  gap: 10px;
}

.ws-back-btn {
  background: rgba(0, 170, 255, 0.1);
  border: 1px solid rgba(0, 170, 255, 0.3);
  color: #00eaff;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;
  &:hover { background: rgba(0, 170, 255, 0.2); }
  .back-icon { font-size: 16px; font-weight: bold; }
}

.ws-title-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ws-title { font-size: 15px; font-weight: bold; color: #e8f4ff; }
.ws-sub { font-size: 10px; color: var(--sc); opacity: 0.8; }

.ws-body {
  padding: 15px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 15px;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 170, 255, 0.3) transparent;
}

/* Copied and adapted from AutomatedProcessingPanel */
.ap-step {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(0, 150, 255, 0.15);
  border-radius: 6px;
  transition: all 0.3s;
  &.done { border-left: 3px solid #44ff88; }
  &.active { border-left: 3px solid #00aaff; }
}
.step-header {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px;
  background: rgba(0, 100, 200, 0.1);
  border-bottom: 1px solid rgba(0, 150, 255, 0.15);
}
.step-num {
  width: 20px; height: 20px;
  border-radius: 50%;
  background: rgba(0, 150, 255, 0.2);
  color: #88ddff;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: bold;
}
.done .step-num { background: #44ff88; color: #000; }
.step-title { font-size: 13px; font-weight: bold; color: #d0e8ff; }
.step-content { padding: 12px; }
.upload-area { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 15px; border: 2px dashed rgba(0, 150, 255, 0.3); border-radius: 4px; text-align: center; color: rgba(255, 255, 255, 0.5); font-size: 12px; cursor: pointer; transition: all 0.2s; }
.upload-area.dragging, .upload-area:hover { background: rgba(0, 150, 255, 0.05); border-color: rgba(0, 180, 255, 0.6); }
.upload-icon { font-size: 28px; }
.upload-link { color: #00aaff; text-decoration: underline; }
.upload-hint { font-size: 11px; margin-top: 4px; color: rgba(255, 255, 255, 0.4); }
.file-list-container { position: relative; width: 100%; }
.file-list-scroller {
  max-height: 90px;
  overflow-y: auto;
  padding-right: 8px;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 170, 255, 0.3) transparent;
}
.file-info {
  display: flex; align-items: center; gap: 10px; width: 100%; text-align: left;
  & + .file-info { margin-top: 6px; }
}
.file-icon { font-size: 28px; color: #88ddff; }
.file-details { flex: 1; min-width: 0; }
.file-name {
  color: #fff; font-weight: bold; font-size: 12px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.file-size { font-size: 11px; color: rgba(255, 255, 255, 0.6); }
.file-remove-btn { position: absolute; top: -5px; right: -5px; background: rgba(255, 80, 80, 0.2); border: 1px solid rgba(255, 80, 80, 0.4); color: #ffaaaa; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 12px; }
.file-remove-btn:hover { background: rgba(255, 80, 80, 0.4); color: #fff; }
.start-btn { width: 100%; padding: 8px; margin-top: 12px; background: #0077cc; border: 1px solid #00aaff; color: #fff; font-size: 13px; font-weight: bold; border-radius: 4px; cursor: pointer; }
.start-btn:hover { background: #0088ee; }
.start-btn:disabled { background: #333; border-color: #555; color: #888; cursor: not-allowed; }
.status-bar { width: 100%; height: 22px; background: rgba(0, 0, 0, 0.3); border-radius: 4px; overflow: hidden; position: relative; }
.status-progress { height: 100%; background: linear-gradient(90deg, #0055aa, #00aaff); transition: width 0.5s ease; }
.status-text { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #fff; text-shadow: 0 0 2px #000; }
.status-log { margin-top: 8px; height: 100px; background: #000; border-radius: 4px; padding: 8px; overflow-y: auto; font-family: 'Consolas', monospace; font-size: 11px; scrollbar-width: thin; scrollbar-color: #00aaff #000; }
.log-item { display: flex; gap: 8px; }
.log-time { color: #888; }
.log-message { color: #ddd; }
.result-content { text-align: center; }
.result-icon { font-size: 28px; }
.result-text { color: #fff; margin: 5px 0 12px; font-size: 13px; }
.error-info .result-text { color: #ff8888; }
.error-details { font-size: 11px; color: #aaa; background: #222; padding: 8px; border-radius: 4px; }
.pending-text { font-size: 12px; color: #888; }
.view-btn { padding: 8px 16px; background: #009955; border: 1px solid #00cc77; color: #fff; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 13px; }
.view-btn:hover { background: #00aa66; }
</style>