<template>
  <!-- 右下角悬浮对话气泡 -->
  <div class="agent-root" :class="{ expanded: isOpen }">

    <!-- 收起状态：悬浮按钮 -->
    <button v-if="!isOpen" class="agent-fab" @click="isOpen = true" title="打开智能助手">
      <span class="fab-icon">🤖</span>
      <span class="fab-label">AI 助手</span>
      <span v-if="unread > 0" class="fab-badge">{{ unread }}</span>
    </button>

    <!-- 展开状态：对话窗口 -->
    <transition name="agent-pop">
      <div v-if="isOpen" class="agent-window">
        <!-- Header -->
        <div class="agent-header">
          <span class="ah-icon">🤖</span>
          <span class="ah-title">施工智能助手</span>
          <span class="ah-model">Claude Sonnet</span>
          <button class="ah-min" @click="isOpen = false" title="最小化">─</button>
          <button class="ah-clear" @click="clearHistory" title="清空对话">✕</button>
        </div>

        <!-- 消息列表 -->
        <div class="agent-messages" ref="msgListEl">
          <!-- 欢迎语 -->
          <div v-if="messages.length === 0" class="welcome-msg">
            <div class="wm-icon">🏔</div>
            <div class="wm-text">你好！我是隧道施工数字孪生平台的智能助手。<br>你可以问我查看地质模型、打开场景、查询施工进度等。</div>
            <div class="quick-cmds">
              <button v-for="cmd in quickCmds" :key="cmd" class="quick-btn" @click="sendQuick(cmd)">{{ cmd }}</button>
            </div>
          </div>

          <!-- 对话消息 -->
          <div
            v-for="(msg, i) in messages"
            :key="i"
            class="msg-row"
            :class="msg.role"
          >
            <div class="msg-avatar">{{ msg.role === 'user' ? '👷' : '🤖' }}</div>
            <div class="msg-bubble" v-html="renderMarkdown(msg.content)"></div>
          </div>

          <!-- 流式输出中 -->
          <div v-if="streaming" class="msg-row assistant">
            <div class="msg-avatar">🤖</div>
            <div class="msg-bubble streaming" v-html="renderMarkdown(streamBuffer)">
              <span class="cursor-blink">▌</span>
            </div>
          </div>

          <!-- 加载中 -->
          <div v-if="loading && !streaming" class="msg-row assistant">
            <div class="msg-avatar">🤖</div>
            <div class="msg-bubble loading">
              <span class="dot-pulse"></span><span class="dot-pulse"></span><span class="dot-pulse"></span>
            </div>
          </div>
        </div>

        <!-- 工具执行状态提示 -->
        <transition name="tool-fade">
          <div v-if="toolStatus" class="tool-status">
            <span class="ts-spinner">⟳</span> {{ toolStatus }}
          </div>
        </transition>

        <!-- 输入框 -->
        <div class="agent-input-row">
          <textarea
            ref="inputEl"
            class="agent-input"
            v-model="inputText"
            placeholder="输入指令或问题（Enter发送，Shift+Enter换行）"
            rows="1"
            @keydown.enter.exact.prevent="send"
            @input="autoResize"
          ></textarea>
          <button class="send-btn" :disabled="!inputText.trim() || loading" @click="send">
            <span>{{ loading ? '◌' : '↑' }}</span>
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue';
import { sendMessage, type Message, type ToolUseBlock } from '@/services/AgentService';
import { executeTool, registerSceneCallback } from '@/composables/useAgentTools';

// ── Props / Emits ────────────────────────────────────────
const emit = defineEmits<{ sceneOpen: [scene: string] }>();

// ── 状态 ─────────────────────────────────────────────────
const isOpen    = ref(false);
const loading   = ref(false);
const streaming = ref(false);
const streamBuffer = ref('');
const inputText = ref('');
const toolStatus = ref('');
const unread     = ref(0);
const messages   = ref<Message[]>([]);
const msgListEl  = ref<HTMLDivElement | null>(null);
const inputEl    = ref<HTMLTextAreaElement | null>(null);

const quickCmds = [
  '查看当前掌子面状态',
  '飞往围岩模型区域',
  '打开爆破指挥台',
  '查询今日施工进度',
  '通风状态怎么样',
];

// ── 注册场景回调 ─────────────────────────────────────────
onMounted(() => {
  registerSceneCallback((scene: string) => {
    emit('sceneOpen', scene);
  });
});

// ── 发送消息 ─────────────────────────────────────────────
const send = async () => {
  const text = inputText.value.trim();
  if (!text || loading.value) return;
  inputText.value = '';
  autoResize();

  messages.value.push({ role: 'user', content: text });
  await scrollToBottom();

  loading.value   = true;
  streaming.value = false;
  streamBuffer.value = '';

  const history: Message[] = messages.value.slice();

  try {
    let firstChunk = true;
    const fullText = await sendMessage(
      history,
      (delta: string) => {
        if (firstChunk) { loading.value = false; streaming.value = true; firstChunk = false; }
        streamBuffer.value += delta;
        scrollToBottom();
      },
      async (tool: ToolUseBlock) => {
        toolStatus.value = `执行操作：${tool.name}...`;
        const result = await executeTool(tool);
        toolStatus.value = '';
        return result;
      },
    );

    streaming.value = false;
    streamBuffer.value = '';
    messages.value.push({ role: 'assistant', content: fullText });
    if (!isOpen.value) unread.value++;

  } catch (e) {
    streaming.value = false;
    loading.value   = false;
    messages.value.push({ role: 'assistant', content: '❌ 请求失败，请检查网络连接。' });
  } finally {
    loading.value    = false;
    streaming.value  = false;
    toolStatus.value = '';
    await scrollToBottom();
  }
};

const sendQuick = (cmd: string) => {
  inputText.value = cmd;
  send();
};

const clearHistory = () => {
  messages.value = [];
  unread.value = 0;
};

// ── 工具函数 ─────────────────────────────────────────────
const scrollToBottom = async () => {
  await nextTick();
  if (msgListEl.value) msgListEl.value.scrollTop = msgListEl.value.scrollHeight;
};

const autoResize = () => {
  if (!inputEl.value) return;
  inputEl.value.style.height = 'auto';
  inputEl.value.style.height = Math.min(inputEl.value.scrollHeight, 96) + 'px';
};

// 简单 Markdown 渲染（加粗、换行、代码块）
const renderMarkdown = (text: string): string => {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>')
    .replace(/^- (.+)/gm, '• $1');
};
</script>

<style scoped lang="scss">
.agent-root {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 60;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  pointer-events: none;
}

// ── FAB 按钮 ─────────────────────────────────────────────
.agent-fab {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: linear-gradient(135deg, rgba(0, 60, 130, 0.9), rgba(0, 30, 80, 0.85));
  border: 1px solid rgba(0, 200, 255, 0.45);
  border-radius: 24px;
  color: #fff;
  font-size: 14px;
  font-family: "Microsoft YaHei", sans-serif;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(0, 100, 200, 0.4), 0 0 12px rgba(0, 200, 255, 0.2);
  transition: all 0.25s;
  position: relative;

  &:hover {
    background: linear-gradient(135deg, rgba(0, 80, 170, 0.95), rgba(0, 50, 120, 0.9));
    box-shadow: 0 4px 28px rgba(0, 150, 255, 0.5), 0 0 18px rgba(0, 200, 255, 0.35);
    transform: translateY(-2px);
  }
}

.fab-icon { font-size: 20px; }
.fab-label { font-weight: bold; letter-spacing: 1px; color: rgba(200, 240, 255, 0.95); }
.fab-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 18px;
  height: 18px;
  background: #ff4444;
  border-radius: 50%;
  font-size: 10px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid rgba(0, 10, 28, 0.9);
}

// ── 对话窗口 ─────────────────────────────────────────────
.agent-window {
  pointer-events: auto;
  width: 360px;
  max-height: 580px;
  display: flex;
  flex-direction: column;
  background: rgba(0, 8, 22, 0.94);
  border: 1px solid rgba(0, 150, 255, 0.3);
  border-radius: 8px;
  backdrop-filter: blur(20px);
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(0, 100, 200, 0.2);
  overflow: hidden;
}

// ── Header ──────────────────────────────────────────────
.agent-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  background: rgba(0, 30, 70, 0.8);
  border-bottom: 1px solid rgba(0, 150, 255, 0.2);
  flex-shrink: 0;
}

.ah-icon { font-size: 16px; }
.ah-title { font-size: 13px; font-weight: bold; color: rgba(200, 240, 255, 0.95); flex: 1; letter-spacing: 1px; }
.ah-model { font-size: 10px; color: rgba(0, 200, 255, 0.5); font-family: 'Consolas', monospace; }
.ah-min, .ah-clear {
  width: 22px; height: 22px; background: transparent;
  border: 1px solid rgba(180, 220, 255, 0.2); color: rgba(180, 220, 255, 0.5);
  font-size: 12px; cursor: pointer; border-radius: 3px; display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
  &:hover { background: rgba(255, 255, 255, 0.08); color: rgba(200, 240, 255, 0.9); }
}

// ── 消息列表 ────────────────────────────────────────────
.agent-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 150, 255, 0.3) transparent;
}

.welcome-msg {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 16px 8px;
  text-align: center;
}
.wm-icon { font-size: 28px; }
.wm-text { font-size: 12px; color: rgba(180, 220, 255, 0.65); line-height: 1.6; }

.quick-cmds { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.quick-btn {
  padding: 4px 10px; background: rgba(0, 40, 90, 0.6);
  border: 1px solid rgba(0, 150, 255, 0.3); color: rgba(180, 220, 255, 0.75);
  font-size: 11px; cursor: pointer; border-radius: 12px; font-family: inherit;
  transition: all 0.15s;
  &:hover { background: rgba(0, 80, 180, 0.6); border-color: #00aaff; color: #00eaff; }
}

.msg-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;

  &.user { flex-direction: row-reverse; }
}

.msg-avatar { font-size: 18px; flex-shrink: 0; padding-top: 2px; }

.msg-bubble {
  max-width: 82%;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.65;
  word-break: break-word;

  :deep(b) { color: #00eaff; }
  :deep(code) { background: rgba(0, 40, 80, 0.6); color: #44ff88; padding: 1px 4px; border-radius: 3px; font-family: 'Consolas', monospace; font-size: 11px; }

  .user & {
    background: rgba(0, 60, 140, 0.7);
    border: 1px solid rgba(0, 150, 255, 0.3);
    color: rgba(200, 240, 255, 0.92);
    border-radius: 8px 2px 8px 8px;
  }

  .assistant & {
    background: rgba(0, 20, 50, 0.65);
    border: 1px solid rgba(0, 100, 200, 0.2);
    color: rgba(200, 240, 255, 0.85);
    border-radius: 2px 8px 8px 8px;
  }

  &.streaming { border-color: rgba(0, 200, 255, 0.35); }

  &.loading {
    display: flex;
    gap: 4px;
    align-items: center;
    padding: 10px 14px;
  }
}

.cursor-blink {
  animation: blink 0.8s step-end infinite;
  color: #00eaff;
}
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

.dot-pulse {
  width: 6px; height: 6px; border-radius: 50%; background: rgba(0, 200, 255, 0.6);
  animation: dot-bounce 1.2s ease-in-out infinite;

  &:nth-child(2) { animation-delay: 0.2s; }
  &:nth-child(3) { animation-delay: 0.4s; }
}
@keyframes dot-bounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1.1); opacity: 1; } }

// ── 工具状态 ────────────────────────────────────────────
.tool-status {
  padding: 5px 12px;
  background: rgba(0, 40, 80, 0.6);
  border-top: 1px solid rgba(0, 150, 255, 0.15);
  font-size: 11px;
  color: rgba(0, 200, 255, 0.7);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.ts-spinner { animation: spin 1s linear infinite; display: inline-block; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

// ── 输入区 ──────────────────────────────────────────────
.agent-input-row {
  display: flex;
  gap: 6px;
  padding: 10px 10px;
  border-top: 1px solid rgba(0, 150, 255, 0.15);
  background: rgba(0, 10, 28, 0.7);
  flex-shrink: 0;
  align-items: flex-end;
}

.agent-input {
  flex: 1;
  background: rgba(0, 20, 50, 0.6);
  border: 1px solid rgba(0, 150, 255, 0.25);
  border-radius: 6px;
  color: rgba(200, 240, 255, 0.9);
  font-size: 12px;
  font-family: "Microsoft YaHei", sans-serif;
  padding: 7px 10px;
  resize: none;
  outline: none;
  line-height: 1.5;
  min-height: 34px;
  max-height: 96px;
  transition: border-color 0.2s;

  &:focus { border-color: rgba(0, 200, 255, 0.5); box-shadow: 0 0 8px rgba(0, 150, 255, 0.15); }
  &::placeholder { color: rgba(180, 220, 255, 0.3); }
}

.send-btn {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, rgba(0, 80, 180, 0.8), rgba(0, 50, 130, 0.7));
  border: 1px solid rgba(0, 200, 255, 0.4);
  border-radius: 6px;
  color: #00eaff;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  flex-shrink: 0;

  &:hover:not(:disabled) { background: rgba(0, 100, 220, 0.8); box-shadow: 0 0 10px rgba(0, 150, 255, 0.3); }
  &:disabled { opacity: 0.4; cursor: default; }
}

// ── 过渡动画 ─────────────────────────────────────────────
.agent-pop-enter-active  { transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); }
.agent-pop-enter-from    { opacity: 0; transform: scale(0.85) translateY(20px); }
.agent-pop-leave-active  { transition: opacity 0.2s ease, transform 0.2s ease; }
.agent-pop-leave-to      { opacity: 0; transform: scale(0.9) translateY(10px); }

.tool-fade-enter-active, .tool-fade-leave-active { transition: opacity 0.2s; }
.tool-fade-enter-from, .tool-fade-leave-to { opacity: 0; }
</style>
