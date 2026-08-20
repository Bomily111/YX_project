import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue';
import { createAgentEngine } from './AgentEngine';
import { buildSystemPrompt } from './knowledge/prompts/system';
import { registerTools, executeTool, unregisterModule } from './ToolRegistry';
import { commonTools } from './tools/common';
import { getAgentConfig } from './config';
import { aiEvents } from './events';
const props = defineProps();
const emit = defineEmits();
// ── 引擎 ──────────────────────────────────────────────────
const engine = ref(null);
// ── UI 状态 ───────────────────────────────────────────────
const isOpen = ref(false);
const loading = ref(false);
const streaming = ref(false);
const streamBuffer = ref('');
const inputText = ref('');
const toolStatus = ref('');
const unread = ref(0);
const messages = ref([]);
const msgListEl = ref(null);
const inputEl = ref(null);
// ── 计算属性 ──────────────────────────────────────────────
const providerLabel = computed(() => {
    const cfg = getAgentConfig();
    const labels = {
        deepseek: 'DeepSeek', claude: 'Claude', qwen: '通义千问', ollama: 'Ollama',
    };
    return labels[cfg.provider] || cfg.provider;
});
const currentScene = computed(() => props.context?.scene || '');
const defaultQuickCmds = [
    '查看当前掌子面状态',
    '飞往围岩模型区域',
    '打开爆破指挥台',
    '查询今日施工进度',
    '通风状态怎么样',
];
const blastQuickCmds = [
    '查看爆破设计参数',
    '切换到正视掌子面视角',
    '分析当前爆破风险',
    '显示炮孔设计图',
    '对比不同爆破方案',
];
const quickCommands = computed(() => {
    if (props.context?.scene === 'blast')
        return blastQuickCmds;
    return defaultQuickCmds;
});
const welcomeIcon = computed(() => props.welcomeIcon || '🏔');
const welcomeText = computed(() => props.welcomeText || '你好！我是隧道施工数字孪生平台的智能助手。<br>你可以问我查看地质模型、打开场景、查询施工进度等。');
// ── 反馈机制 ──────────────────────────────────────────────
const FEEDBACK_KEY = 'ai-agent-feedback';
const feedbackMap = ref({});
function loadFeedback() {
    try {
        const saved = localStorage.getItem(FEEDBACK_KEY);
        if (saved)
            feedbackMap.value = JSON.parse(saved);
    }
    catch { /* ignore */ }
}
function toggleFeedback(msgIndex, rating) {
    if (feedbackMap.value[msgIndex] === rating) {
        delete feedbackMap.value[msgIndex];
    }
    else {
        feedbackMap.value[msgIndex] = rating;
    }
    feedbackMap.value = { ...feedbackMap.value };
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedbackMap.value));
}
// ── 初始化 ────────────────────────────────────────────────
onMounted(() => {
    loadFeedback();
    // 注册通用工具
    registerTools('common', commonTools);
    // 创建引擎实例
    const sysPrompt = buildSystemPrompt(props.context);
    const instance = createAgentEngine(sysPrompt);
    engine.value = instance;
    // 监听场景打开事件
    aiEvents.on('scene:open', (scene) => {
        emit('sceneOpen', scene);
    });
});
onBeforeUnmount(() => {
    unregisterModule('common');
    if (engine.value)
        engine.value.abort();
});
// 当 context 变化时更新 system prompt
watch(() => props.context, (ctx) => {
    if (engine.value) {
        engine.value.setSystemPrompt(buildSystemPrompt(ctx));
    }
}, { deep: true });
// ── 发送消息 ──────────────────────────────────────────────
const send = async () => {
    const text = inputText.value.trim();
    if (!text || loading.value || !engine.value)
        return;
    inputText.value = '';
    autoResize();
    // 添加用户消息到本地显示
    messages.value.push({ role: 'user', content: text });
    await scrollToBottom();
    loading.value = true;
    streaming.value = false;
    streamBuffer.value = '';
    let firstChunk = true;
    let assistantMsg = '';
    try {
        await engine.value.chat(text, props.context || {}, {
            onText: (delta) => {
                if (firstChunk) {
                    loading.value = false;
                    streaming.value = true;
                    firstChunk = false;
                }
                streamBuffer.value += delta;
                assistantMsg += delta;
                scrollToBottom();
            },
            onToolUse: async (tool) => {
                toolStatus.value = `执行操作：${tool.name}...`;
                const result = await executeTool(tool.name, tool.input);
                toolStatus.value = '';
                return result;
            },
            onComplete: (fullText) => {
                streaming.value = false;
                streamBuffer.value = '';
                messages.value.push({ role: 'assistant', content: fullText });
                if (!isOpen.value)
                    unread.value++;
            },
            onError: (err) => {
                streaming.value = false;
                loading.value = false;
                messages.value.push({ role: 'assistant', content: `❌ ${err.message}` });
            },
        });
    }
    catch (e) {
        if (e.name !== 'AbortError') {
            streaming.value = false;
            loading.value = false;
            messages.value.push({ role: 'assistant', content: '❌ 请求失败，请检查网络连接。' });
        }
    }
    finally {
        loading.value = false;
        streaming.value = false;
        toolStatus.value = '';
        await scrollToBottom();
    }
};
// ── 快捷命令 ──────────────────────────────────────────────
const sendQuick = (cmd) => {
    inputText.value = cmd;
    send();
};
const clearHistory = () => {
    messages.value = [];
    unread.value = 0;
    if (engine.value)
        engine.value.clearHistory();
};
// ── 工具函数 ──────────────────────────────────────────────
const scrollToBottom = async () => {
    await nextTick();
    if (msgListEl.value) {
        msgListEl.value.scrollTop = msgListEl.value.scrollHeight;
    }
};
const autoResize = () => {
    if (!inputEl.value)
        return;
    inputEl.value.style.height = 'auto';
    inputEl.value.style.height = Math.min(inputEl.value.scrollHeight, 96) + 'px';
};
const renderMarkdown = (text) => {
    return text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>')
        .replace(/^- (.+)/gm, '• $1');
};
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['msg-row']} */ ;
/** @type {__VLS_StyleScopedClasses['user']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "agent-root" },
    ...{ class: ({ expanded: __VLS_ctx.isOpen }) },
});
/** @type {__VLS_StyleScopedClasses['agent-root']} */ ;
/** @type {__VLS_StyleScopedClasses['expanded']} */ ;
if (!__VLS_ctx.isOpen) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(!__VLS_ctx.isOpen))
                    return;
                __VLS_ctx.isOpen = true;
                // @ts-ignore
                [isOpen, isOpen, isOpen,];
            } },
        ...{ class: "agent-fab" },
        title: "打开智能助手",
    });
    /** @type {__VLS_StyleScopedClasses['agent-fab']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "fab-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['fab-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "fab-label" },
    });
    /** @type {__VLS_StyleScopedClasses['fab-label']} */ ;
    if (__VLS_ctx.unread > 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "fab-badge" },
        });
        /** @type {__VLS_StyleScopedClasses['fab-badge']} */ ;
        (__VLS_ctx.unread);
    }
}
let __VLS_0;
/** @ts-ignore @type {typeof __VLS_components.transition | typeof __VLS_components.Transition | typeof __VLS_components.transition | typeof __VLS_components.Transition} */
transition;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    name: "agent-pop",
}));
const __VLS_2 = __VLS_1({
    name: "agent-pop",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_3.slots;
if (__VLS_ctx.isOpen) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "agent-window" },
    });
    /** @type {__VLS_StyleScopedClasses['agent-window']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "agent-header" },
    });
    /** @type {__VLS_StyleScopedClasses['agent-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "ah-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['ah-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "ah-title" },
    });
    /** @type {__VLS_StyleScopedClasses['ah-title']} */ ;
    if (__VLS_ctx.currentScene) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ah-scene" },
        });
        /** @type {__VLS_StyleScopedClasses['ah-scene']} */ ;
        (__VLS_ctx.currentScene);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "ah-model" },
    });
    /** @type {__VLS_StyleScopedClasses['ah-model']} */ ;
    (__VLS_ctx.providerLabel);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isOpen))
                    return;
                __VLS_ctx.isOpen = false;
                // @ts-ignore
                [isOpen, isOpen, unread, unread, currentScene, currentScene, providerLabel,];
            } },
        ...{ class: "ah-min" },
        title: "最小化",
    });
    /** @type {__VLS_StyleScopedClasses['ah-min']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.clearHistory) },
        ...{ class: "ah-clear" },
        title: "清空对话",
    });
    /** @type {__VLS_StyleScopedClasses['ah-clear']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "agent-messages" },
        ref: "msgListEl",
    });
    /** @type {__VLS_StyleScopedClasses['agent-messages']} */ ;
    if (__VLS_ctx.messages.length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "welcome-msg" },
        });
        /** @type {__VLS_StyleScopedClasses['welcome-msg']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "wm-icon" },
        });
        /** @type {__VLS_StyleScopedClasses['wm-icon']} */ ;
        (__VLS_ctx.welcomeIcon);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "wm-text" },
        });
        /** @type {__VLS_StyleScopedClasses['wm-text']} */ ;
        (__VLS_ctx.welcomeText);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "quick-cmds" },
        });
        /** @type {__VLS_StyleScopedClasses['quick-cmds']} */ ;
        for (const [cmd] of __VLS_vFor((__VLS_ctx.quickCommands))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.isOpen))
                            return;
                        if (!(__VLS_ctx.messages.length === 0))
                            return;
                        __VLS_ctx.sendQuick(cmd);
                        // @ts-ignore
                        [clearHistory, messages, welcomeIcon, welcomeText, quickCommands, sendQuick,];
                    } },
                key: (cmd),
                ...{ class: "quick-btn" },
            });
            /** @type {__VLS_StyleScopedClasses['quick-btn']} */ ;
            (cmd);
            // @ts-ignore
            [];
        }
    }
    for (const [msg, i] of __VLS_vFor((__VLS_ctx.messages))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (i),
            ...{ class: "msg-row" },
            ...{ class: (msg.role) },
        });
        /** @type {__VLS_StyleScopedClasses['msg-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "msg-avatar" },
        });
        /** @type {__VLS_StyleScopedClasses['msg-avatar']} */ ;
        (msg.role === 'user' ? '👷' : '🤖');
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "msg-block" },
        });
        /** @type {__VLS_StyleScopedClasses['msg-block']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "msg-bubble" },
        });
        __VLS_asFunctionalDirective(__VLS_directives.vHtml, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.renderMarkdown(msg.content)) }, null, null);
        /** @type {__VLS_StyleScopedClasses['msg-bubble']} */ ;
        if (msg.role === 'assistant') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "feedback-row" },
            });
            /** @type {__VLS_StyleScopedClasses['feedback-row']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.isOpen))
                            return;
                        if (!(msg.role === 'assistant'))
                            return;
                        __VLS_ctx.toggleFeedback(i, 'up');
                        // @ts-ignore
                        [messages, renderMarkdown, toggleFeedback,];
                    } },
                ...{ class: "fb-btn" },
                ...{ class: ({ active: __VLS_ctx.feedbackMap[i] === 'up' }) },
                title: "有用",
            });
            /** @type {__VLS_StyleScopedClasses['fb-btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['active']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.isOpen))
                            return;
                        if (!(msg.role === 'assistant'))
                            return;
                        __VLS_ctx.toggleFeedback(i, 'down');
                        // @ts-ignore
                        [toggleFeedback, feedbackMap,];
                    } },
                ...{ class: "fb-btn" },
                ...{ class: ({ active: __VLS_ctx.feedbackMap[i] === 'down' }) },
                title: "没用",
            });
            /** @type {__VLS_StyleScopedClasses['fb-btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['active']} */ ;
        }
        // @ts-ignore
        [feedbackMap,];
    }
    if (__VLS_ctx.streaming) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "msg-row assistant" },
        });
        /** @type {__VLS_StyleScopedClasses['msg-row']} */ ;
        /** @type {__VLS_StyleScopedClasses['assistant']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "msg-avatar" },
        });
        /** @type {__VLS_StyleScopedClasses['msg-avatar']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "msg-bubble streaming" },
        });
        /** @type {__VLS_StyleScopedClasses['msg-bubble']} */ ;
        /** @type {__VLS_StyleScopedClasses['streaming']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalDirective(__VLS_directives.vHtml, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.renderMarkdown(__VLS_ctx.streamBuffer)) }, null, null);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "cursor-blink" },
        });
        /** @type {__VLS_StyleScopedClasses['cursor-blink']} */ ;
    }
    if (__VLS_ctx.loading && !__VLS_ctx.streaming) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "msg-row assistant" },
        });
        /** @type {__VLS_StyleScopedClasses['msg-row']} */ ;
        /** @type {__VLS_StyleScopedClasses['assistant']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "msg-avatar" },
        });
        /** @type {__VLS_StyleScopedClasses['msg-avatar']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "msg-bubble loading" },
        });
        /** @type {__VLS_StyleScopedClasses['msg-bubble']} */ ;
        /** @type {__VLS_StyleScopedClasses['loading']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "dot-pulse" },
        });
        /** @type {__VLS_StyleScopedClasses['dot-pulse']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "dot-pulse" },
        });
        /** @type {__VLS_StyleScopedClasses['dot-pulse']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "dot-pulse" },
        });
        /** @type {__VLS_StyleScopedClasses['dot-pulse']} */ ;
    }
    let __VLS_6;
    /** @ts-ignore @type {typeof __VLS_components.transition | typeof __VLS_components.Transition | typeof __VLS_components.transition | typeof __VLS_components.Transition} */
    transition;
    // @ts-ignore
    const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
        name: "tool-fade",
    }));
    const __VLS_8 = __VLS_7({
        name: "tool-fade",
    }, ...__VLS_functionalComponentArgsRest(__VLS_7));
    const { default: __VLS_11 } = __VLS_9.slots;
    if (__VLS_ctx.toolStatus) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "tool-status" },
        });
        /** @type {__VLS_StyleScopedClasses['tool-status']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ts-spinner" },
        });
        /** @type {__VLS_StyleScopedClasses['ts-spinner']} */ ;
        (__VLS_ctx.toolStatus);
    }
    // @ts-ignore
    [renderMarkdown, streaming, streaming, streamBuffer, loading, toolStatus, toolStatus,];
    var __VLS_9;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "agent-input-row" },
    });
    /** @type {__VLS_StyleScopedClasses['agent-input-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
        ...{ onKeydown: (__VLS_ctx.send) },
        ...{ onInput: (__VLS_ctx.autoResize) },
        ref: "inputEl",
        ...{ class: "agent-input" },
        value: (__VLS_ctx.inputText),
        placeholder: "输入指令或问题（Enter发送，Shift+Enter换行）",
        rows: "1",
    });
    /** @type {__VLS_StyleScopedClasses['agent-input']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.send) },
        ...{ class: "send-btn" },
        disabled: (!__VLS_ctx.inputText.trim() || __VLS_ctx.loading),
    });
    /** @type {__VLS_StyleScopedClasses['send-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.loading ? '◌' : '↑');
}
// @ts-ignore
[loading, loading, send, send, autoResize, inputText, inputText,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
