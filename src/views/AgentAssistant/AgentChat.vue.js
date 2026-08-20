import { ref, nextTick, onMounted } from 'vue';
import { sendMessage } from '@/services/AgentService';
import { executeTool, registerSceneCallback } from '@/composables/useAgentTools';
const emit = defineEmits();
// ── 状态 ─────────────────────────────────────────────────
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
const quickCmds = [
    '查看当前掌子面状态',
    '飞往围岩模型区域',
    '打开爆破指挥台',
    '查询今日施工进度',
    '通风状态怎么样',
];
// ── 注册场景回调 ─────────────────────────────────────────
onMounted(() => {
    registerSceneCallback((scene) => {
        emit('sceneOpen', scene);
    });
});
// ── 发送消息 ─────────────────────────────────────────────
const send = async () => {
    const text = inputText.value.trim();
    if (!text || loading.value)
        return;
    inputText.value = '';
    autoResize();
    messages.value.push({ role: 'user', content: text });
    await scrollToBottom();
    loading.value = true;
    streaming.value = false;
    streamBuffer.value = '';
    const history = messages.value.slice();
    try {
        let firstChunk = true;
        const fullText = await sendMessage(history, (delta) => {
            if (firstChunk) {
                loading.value = false;
                streaming.value = true;
                firstChunk = false;
            }
            streamBuffer.value += delta;
            scrollToBottom();
        }, async (tool) => {
            toolStatus.value = `执行操作：${tool.name}...`;
            const result = await executeTool(tool);
            toolStatus.value = '';
            return result;
        });
        streaming.value = false;
        streamBuffer.value = '';
        messages.value.push({ role: 'assistant', content: fullText });
        if (!isOpen.value)
            unread.value++;
    }
    catch (e) {
        streaming.value = false;
        loading.value = false;
        messages.value.push({ role: 'assistant', content: '❌ 请求失败，请检查网络连接。' });
    }
    finally {
        loading.value = false;
        streaming.value = false;
        toolStatus.value = '';
        await scrollToBottom();
    }
};
const sendQuick = (cmd) => {
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
    if (msgListEl.value)
        msgListEl.value.scrollTop = msgListEl.value.scrollHeight;
};
const autoResize = () => {
    if (!inputEl.value)
        return;
    inputEl.value.style.height = 'auto';
    inputEl.value.style.height = Math.min(inputEl.value.scrollHeight, 96) + 'px';
};
// 简单 Markdown 渲染（加粗、换行、代码块）
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
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "ah-model" },
    });
    /** @type {__VLS_StyleScopedClasses['ah-model']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isOpen))
                    return;
                __VLS_ctx.isOpen = false;
                // @ts-ignore
                [isOpen, isOpen, unread, unread,];
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
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "wm-text" },
        });
        /** @type {__VLS_StyleScopedClasses['wm-text']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.br)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "quick-cmds" },
        });
        /** @type {__VLS_StyleScopedClasses['quick-cmds']} */ ;
        for (const [cmd] of __VLS_vFor((__VLS_ctx.quickCmds))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.isOpen))
                            return;
                        if (!(__VLS_ctx.messages.length === 0))
                            return;
                        __VLS_ctx.sendQuick(cmd);
                        // @ts-ignore
                        [clearHistory, messages, quickCmds, sendQuick,];
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
            ...{ class: "msg-bubble" },
        });
        __VLS_asFunctionalDirective(__VLS_directives.vHtml, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.renderMarkdown(msg.content)) }, null, null);
        /** @type {__VLS_StyleScopedClasses['msg-bubble']} */ ;
        // @ts-ignore
        [messages, renderMarkdown,];
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
        __VLS_asFunctionalDirective(__VLS_directives.vHtml, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.renderMarkdown(__VLS_ctx.streamBuffer)) }, null, null);
        /** @type {__VLS_StyleScopedClasses['msg-bubble']} */ ;
        /** @type {__VLS_StyleScopedClasses['streaming']} */ ;
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
});
export default {};
