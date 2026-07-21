<template>
  <div class="pt-root">
    <!-- Step 1: Upload -->
    <div class="pt-step" :class="{ done: currentStep > 1, active: currentStep === 1 }">
      <div class="pt-step-header">
        <span class="pt-step-num">1</span>
        <span class="pt-step-title">上传原始数据</span>
      </div>
      <div v-show="currentStep === 1" class="pt-step-body">
        <label
          class="pt-upload-area"
          :class="{ dragging: isDragging }"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="handleFileDrop"
        >
          <input type="file" ref="fileInput" @change="handleFileSelect" multiple style="display:none" />
          <div v-if="files.length === 0">
            <div class="pt-upload-icon">📤</div>
            <div class="pt-upload-text">拖拽文件至此，或<span class="pt-upload-link" @click="triggerFileInput">点击选择</span></div>
            <div class="pt-upload-hint">支持多个文件或 .zip 压缩包</div>
          </div>
          <div v-else class="pt-file-list">
            <div v-for="(f, i) in files" :key="i" class="pt-file-row">
              <span class="pt-file-icon">📄</span>
              <span class="pt-file-name" :title="f.name">{{ f.name }}</span>
              <span class="pt-file-size">{{ (f.size / 1024 / 1024).toFixed(1) }} MB</span>
            </div>
            <button class="pt-file-clear" @click.stop="removeFiles">× 清除</button>
          </div>
        </label>
        <button
          class="pt-start-btn"
          :disabled="files.length === 0 || status !== 'idle'"
          @click="startProcessing"
        >{{ status === 'idle' ? '开始处理' : '处理中...' }}</button>
      </div>
    </div>

    <!-- Step 2: Processing -->
    <div class="pt-step" :class="{ active: currentStep === 2 }">
      <div class="pt-step-header">
        <span class="pt-step-num">2</span>
        <span class="pt-step-title">云端处理与建模</span>
      </div>
      <div v-show="currentStep >= 2" class="pt-step-body">
        <div class="pt-progress-bar">
          <div class="pt-progress-fill" :style="{ width: progress + '%' }"></div>
          <span class="pt-progress-text">{{ progress }}%</span>
        </div>
        <div class="pt-status-msg">{{ statusMessage }}</div>
        <div class="pt-log" ref="logEl">
          <div v-for="(l, i) in logs" :key="i" class="pt-log-row">
            <span class="pt-log-time">{{ l.time }}</span>
            <span class="pt-log-msg">{{ l.message }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Step 3: Complete -->
    <div class="pt-step" :class="{ done: status === 'complete' }">
      <div class="pt-step-header">
        <span class="pt-step-num">3</span>
        <span class="pt-step-title">完成</span>
      </div>
      <div v-show="status === 'complete' || status === 'error'" class="pt-step-body">
        <div v-if="status === 'complete'" class="pt-result">
          <div class="pt-result-icon">✅</div>
          <div class="pt-result-text">{{ modelLabel }}处理成功！结果已生成。</div>
          <button class="pt-view-btn" @click="$emit('process-complete')">返回数据预览</button>
        </div>
        <div v-else-if="status === 'error'" class="pt-result pt-error">
          <div class="pt-result-icon">❌</div>
          <div class="pt-result-text">处理失败</div>
          <div class="pt-error-msg">{{ errorMessage }}</div>
          <button class="pt-retry-btn" @click="resetState">重新上传</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onBeforeUnmount } from 'vue'

const props = defineProps<{
  modelKey: string
  modelLabel: string
}>()

const emit = defineEmits<{
  'process-complete': []
}>()

const currentStep = ref(1)
const files = ref<File[]>([])
const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const logEl = ref<HTMLElement | null>(null)

const status = ref<'idle' | 'uploading' | 'processing' | 'complete' | 'error'>('idle')
const statusMessage = ref('准备就绪')
const progress = ref(0)
const logs = ref<{ time: string; message: string }[]>([])
const errorMessage = ref('')

let pollingInterval: number | null = null

function stopPolling() {
  if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null }
}

function resetState() {
  stopPolling()
  currentStep.value = 1
  files.value = []
  status.value = 'idle'
  statusMessage.value = '准备就绪'
  progress.value = 0
  logs.value = []
  errorMessage.value = ''
}

watch(() => props.modelKey, () => resetState())

onBeforeUnmount(() => stopPolling())

function addLog(msg: string) {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  logs.value.push({ time, message: msg })
  nextTick(() => { if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight })
}

function triggerFileInput() { fileInput.value?.click() }
function handleFileSelect(e: Event) {
  const t = e.target as HTMLInputElement
  if (t.files) files.value = Array.from(t.files)
}
function handleFileDrop(e: DragEvent) {
  isDragging.value = false
  if (e.dataTransfer?.files) files.value = Array.from(e.dataTransfer.files)
}
function removeFiles() { files.value = [] }

async function startProcessing() {
  if (files.value.length === 0) return
  const formData = new FormData()
  files.value.forEach(f => formData.append('files', f, f.name))
  status.value = 'uploading'
  currentStep.value = 2
  progress.value = 0
  logs.value = []
  addLog(`准备上传 ${files.value.length} 个文件...`)
  statusMessage.value = '正在上传...'

  try {
    const res = await fetch(`/api/process/${props.modelKey}`, { method: 'POST', body: formData })
    if (!res.ok) { const t = await res.text(); throw new Error(`上传失败: ${res.status} ${t}`) }
    const { jobId } = await res.json()
    addLog(`上传成功。任务ID: ${jobId}`)
    statusMessage.value = '已进入处理队列...'
    status.value = 'processing'

    let pollFailCount = 0
    const doPoll = async () => {
      try {
        const sr = await fetch(`/api/process/status/${jobId}`)
        if (!sr.ok) {
          const errText = await sr.text().catch(() => '')
          throw new Error(`状态查询失败: ${sr.status} ${errText}`)
        }
        pollFailCount = 0
        const js = await sr.json()
        progress.value = js.progress ?? progress.value
        if (js.message) statusMessage.value = js.message
        if (js.log) addLog(js.log)
        if (js.status === 'complete') {
          stopPolling(); status.value = 'complete'; currentStep.value = 3; progress.value = 100
          addLog('流程处理完毕。')
        } else if (js.status === 'error') {
          stopPolling(); status.value = 'error'
          errorMessage.value = js.error || '未知错误'
          addLog(`处理失败: ${errorMessage.value}`)
        }
      } catch (e: any) {
        pollFailCount++
        if (pollFailCount >= 3) {
          stopPolling(); status.value = 'error'
          errorMessage.value = `无法连接服务器 (${e.message})`
          addLog(errorMessage.value)
        } else {
          addLog(`查询状态失败 (${pollFailCount}/3): ${e.message}`)
        }
      }
    }

    // 延迟 1 秒后再开始轮询，给后端启动 Python 的时间
    setTimeout(() => {
      doPoll()
      pollingInterval = window.setInterval(doPoll, 2000)
    }, 1000)
  } catch (e) {
    status.value = 'error'
    errorMessage.value = (e as Error).message
    addLog(errorMessage.value)
  }
}
</script>

<style scoped lang="scss">
.pt-root { font-size: 13px; }

.pt-step {
  margin-bottom: 12px; padding: 12px;
  border-radius: 6px; background: rgba(0, 180, 255, 0.03);
  border: 1px solid rgba(0, 180, 255, 0.06);
  &.active { border-color: rgba(0, 234, 255, 0.2); background: rgba(0, 200, 255, 0.05); }
  &.done { opacity: 0.6; }
}
.pt-step-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.pt-step-num {
  width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; background: rgba(0, 200, 255, 0.15); color: #7dd3fc;
  .active & { background: #00eaff; color: #06121f; }
  .done & { background: #44ff88; color: #06121f; }
}
.pt-step-title { font-size: 13px; color: #c7d5ea; font-weight: 600; }

.pt-step-body { margin-top: 8px; }

.pt-upload-area {
  display: block; padding: 16px; border: 2px dashed rgba(0, 180, 255, 0.2);
  border-radius: 8px; text-align: center; cursor: pointer; transition: .15s;
  &:hover, &.dragging { border-color: rgba(0, 234, 255, 0.5); background: rgba(0, 200, 255, 0.05); }
}
.pt-upload-icon { font-size: 28px; margin-bottom: 6px; }
.pt-upload-text { font-size: 13px; color: #a9bcd6; }
.pt-upload-link { color: #38bdf8; cursor: pointer; &:hover { text-decoration: underline; } }
.pt-upload-hint { font-size: 11px; color: #5a7a9a; margin-top: 4px; }

.pt-file-list { text-align: left; }
.pt-file-row { display: flex; align-items: center; gap: 6px; padding: 3px 0; font-size: 12px; }
.pt-file-icon { flex-shrink: 0; }
.pt-file-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #c7d5ea; }
.pt-file-size { color: #5a7a9a; flex-shrink: 0; }
.pt-file-clear {
  margin-top: 6px; background: none; border: 1px solid rgba(248,113,113,.4);
  color: #fca5a5; padding: 2px 10px; border-radius: 4px; font-size: 11px; cursor: pointer;
}

.pt-start-btn {
  margin-top: 10px; width: 100%; padding: 10px; border: none; border-radius: 6px;
  background: linear-gradient(135deg, #38bdf8, #00eaff); color: #06121f;
  font-size: 14px; font-weight: 700; cursor: pointer; transition: .15s;
  &:hover:not(:disabled) { opacity: 0.9; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
}

.pt-progress-bar {
  height: 6px; background: rgba(0, 200, 255, 0.1); border-radius: 3px;
  overflow: hidden; position: relative; margin-bottom: 8px;
}
.pt-progress-fill {
  height: 100%; background: linear-gradient(90deg, #00eaff, #38bdf8);
  border-radius: 3px; transition: width .3s;
}
.pt-progress-text {
  position: absolute; right: 0; top: -18px; font-size: 11px; color: #7dd3fc;
}
.pt-status-msg { font-size: 12px; color: #8aa0bd; margin-bottom: 6px; }

.pt-log {
  max-height: 140px; overflow-y: auto; font-size: 11px;
  background: rgba(0, 0, 0, 0.3); border-radius: 4px; padding: 6px 8px;
}
.pt-log-row { display: flex; gap: 8px; padding: 1px 0; }
.pt-log-time { color: #3b5573; flex-shrink: 0; }
.pt-log-msg { color: #8aa0bd; word-break: break-all; }

.pt-result { text-align: center; padding: 16px 8px; }
.pt-result-icon { font-size: 32px; margin-bottom: 8px; }
.pt-result-text { font-size: 14px; color: #c7d5ea; margin-bottom: 12px; }
.pt-error-msg { font-size: 12px; color: #fca5a5; margin-bottom: 8px; padding: 6px; background: rgba(248,113,113,.1); border-radius: 4px; }
.pt-view-btn {
  padding: 8px 20px; border: none; border-radius: 6px;
  background: rgba(0, 234, 255, 0.15); color: #00eaff;
  font-size: 13px; cursor: pointer; font-weight: 600;
  &:hover { background: rgba(0, 234, 255, 0.25); }
}
.pt-retry-btn {
  padding: 6px 16px; border: 1px solid rgba(248,113,113,.4);
  background: none; color: #fca5a5; border-radius: 4px; font-size: 12px; cursor: pointer;
}
</style>
