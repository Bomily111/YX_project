import { ref, nextTick, watch, onBeforeUnmount } from 'vue';
const props = defineProps();
const emit = defineEmits();
const currentStep = ref(1);
const files = ref([]);
const isDragging = ref(false);
const fileInput = ref(null);
const logEl = ref(null);
const status = ref('idle');
const statusMessage = ref('准备就绪');
const progress = ref(0);
const logs = ref([]);
const errorMessage = ref('');
let pollingInterval = null;
function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}
function resetState() {
    stopPolling();
    currentStep.value = 1;
    files.value = [];
    status.value = 'idle';
    statusMessage.value = '准备就绪';
    progress.value = 0;
    logs.value = [];
    errorMessage.value = '';
}
watch(() => props.modelKey, () => resetState());
onBeforeUnmount(() => stopPolling());
function addLog(msg) {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    logs.value.push({ time, message: msg });
    nextTick(() => { if (logEl.value)
        logEl.value.scrollTop = logEl.value.scrollHeight; });
}
function triggerFileInput() { fileInput.value?.click(); }
function handleFileSelect(e) {
    const t = e.target;
    if (t.files)
        files.value = Array.from(t.files);
}
function handleFileDrop(e) {
    isDragging.value = false;
    if (e.dataTransfer?.files)
        files.value = Array.from(e.dataTransfer.files);
}
function removeFiles() { files.value = []; }
async function startProcessing() {
    if (files.value.length === 0)
        return;
    const formData = new FormData();
    files.value.forEach(f => formData.append('files', f, f.name));
    status.value = 'uploading';
    currentStep.value = 2;
    progress.value = 0;
    logs.value = [];
    addLog(`准备上传 ${files.value.length} 个文件...`);
    statusMessage.value = '正在上传...';
    try {
        const res = await fetch(`/api/process/${props.modelKey}`, { method: 'POST', body: formData });
        if (!res.ok) {
            const t = await res.text();
            throw new Error(`上传失败: ${res.status} ${t}`);
        }
        const { jobId } = await res.json();
        addLog(`上传成功。任务ID: ${jobId}`);
        statusMessage.value = '已进入处理队列...';
        status.value = 'processing';
        let pollFailCount = 0;
        const doPoll = async () => {
            try {
                const sr = await fetch(`/api/process/status/${jobId}`);
                if (!sr.ok) {
                    const errText = await sr.text().catch(() => '');
                    throw new Error(`状态查询失败: ${sr.status} ${errText}`);
                }
                pollFailCount = 0;
                const js = await sr.json();
                progress.value = js.progress ?? progress.value;
                if (js.message)
                    statusMessage.value = js.message;
                if (js.log)
                    addLog(js.log);
                if (js.status === 'complete') {
                    stopPolling();
                    status.value = 'complete';
                    currentStep.value = 3;
                    progress.value = 100;
                    addLog('流程处理完毕。');
                }
                else if (js.status === 'error') {
                    stopPolling();
                    status.value = 'error';
                    errorMessage.value = js.error || '未知错误';
                    addLog(`处理失败: ${errorMessage.value}`);
                }
            }
            catch (e) {
                pollFailCount++;
                if (pollFailCount >= 3) {
                    stopPolling();
                    status.value = 'error';
                    errorMessage.value = `无法连接服务器 (${e.message})`;
                    addLog(errorMessage.value);
                }
                else {
                    addLog(`查询状态失败 (${pollFailCount}/3): ${e.message}`);
                }
            }
        };
        // 延迟 1 秒后再开始轮询，给后端启动 Python 的时间
        setTimeout(() => {
            doPoll();
            pollingInterval = window.setInterval(doPoll, 2000);
        }, 1000);
    }
    catch (e) {
        status.value = 'error';
        errorMessage.value = e.message;
        addLog(errorMessage.value);
    }
}
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
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['done']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "pt-root" },
});
/** @type {__VLS_StyleScopedClasses['pt-root']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "pt-step" },
    ...{ class: ({ done: __VLS_ctx.currentStep > 1, active: __VLS_ctx.currentStep === 1 }) },
});
/** @type {__VLS_StyleScopedClasses['pt-step']} */ ;
/** @type {__VLS_StyleScopedClasses['done']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "pt-step-header" },
});
/** @type {__VLS_StyleScopedClasses['pt-step-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "pt-step-num" },
});
/** @type {__VLS_StyleScopedClasses['pt-step-num']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "pt-step-title" },
});
/** @type {__VLS_StyleScopedClasses['pt-step-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "pt-step-body" },
});
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.currentStep === 1) }, null, null);
/** @type {__VLS_StyleScopedClasses['pt-step-body']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ onDragover: (...[$event]) => {
            __VLS_ctx.isDragging = true;
            // @ts-ignore
            [currentStep, currentStep, currentStep, isDragging,];
        } },
    ...{ onDragleave: (...[$event]) => {
            __VLS_ctx.isDragging = false;
            // @ts-ignore
            [isDragging,];
        } },
    ...{ onDrop: (__VLS_ctx.handleFileDrop) },
    ...{ class: "pt-upload-area" },
    ...{ class: ({ dragging: __VLS_ctx.isDragging }) },
});
/** @type {__VLS_StyleScopedClasses['pt-upload-area']} */ ;
/** @type {__VLS_StyleScopedClasses['dragging']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: (__VLS_ctx.handleFileSelect) },
    type: "file",
    ref: "fileInput",
    multiple: true,
    ...{ style: {} },
});
if (__VLS_ctx.files.length === 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pt-upload-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['pt-upload-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pt-upload-text" },
    });
    /** @type {__VLS_StyleScopedClasses['pt-upload-text']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ onClick: (__VLS_ctx.triggerFileInput) },
        ...{ class: "pt-upload-link" },
    });
    /** @type {__VLS_StyleScopedClasses['pt-upload-link']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pt-upload-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['pt-upload-hint']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pt-file-list" },
    });
    /** @type {__VLS_StyleScopedClasses['pt-file-list']} */ ;
    for (const [f, i] of __VLS_vFor((__VLS_ctx.files))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (i),
            ...{ class: "pt-file-row" },
        });
        /** @type {__VLS_StyleScopedClasses['pt-file-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "pt-file-icon" },
        });
        /** @type {__VLS_StyleScopedClasses['pt-file-icon']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "pt-file-name" },
            title: (f.name),
        });
        /** @type {__VLS_StyleScopedClasses['pt-file-name']} */ ;
        (f.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "pt-file-size" },
        });
        /** @type {__VLS_StyleScopedClasses['pt-file-size']} */ ;
        ((f.size / 1024 / 1024).toFixed(1));
        // @ts-ignore
        [isDragging, handleFileDrop, handleFileSelect, files, files, triggerFileInput,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.removeFiles) },
        ...{ class: "pt-file-clear" },
    });
    /** @type {__VLS_StyleScopedClasses['pt-file-clear']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.startProcessing) },
    ...{ class: "pt-start-btn" },
    disabled: (__VLS_ctx.files.length === 0 || __VLS_ctx.status !== 'idle'),
});
/** @type {__VLS_StyleScopedClasses['pt-start-btn']} */ ;
(__VLS_ctx.status === 'idle' ? '开始处理' : '处理中...');
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "pt-step" },
    ...{ class: ({ active: __VLS_ctx.currentStep === 2 }) },
});
/** @type {__VLS_StyleScopedClasses['pt-step']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "pt-step-header" },
});
/** @type {__VLS_StyleScopedClasses['pt-step-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "pt-step-num" },
});
/** @type {__VLS_StyleScopedClasses['pt-step-num']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "pt-step-title" },
});
/** @type {__VLS_StyleScopedClasses['pt-step-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "pt-step-body" },
});
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.currentStep >= 2) }, null, null);
/** @type {__VLS_StyleScopedClasses['pt-step-body']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "pt-progress-bar" },
});
/** @type {__VLS_StyleScopedClasses['pt-progress-bar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "pt-progress-fill" },
    ...{ style: ({ width: __VLS_ctx.progress + '%' }) },
});
/** @type {__VLS_StyleScopedClasses['pt-progress-fill']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "pt-progress-text" },
});
/** @type {__VLS_StyleScopedClasses['pt-progress-text']} */ ;
(__VLS_ctx.progress);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "pt-status-msg" },
});
/** @type {__VLS_StyleScopedClasses['pt-status-msg']} */ ;
(__VLS_ctx.statusMessage);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "pt-log" },
    ref: "logEl",
});
/** @type {__VLS_StyleScopedClasses['pt-log']} */ ;
for (const [l, i] of __VLS_vFor((__VLS_ctx.logs))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (i),
        ...{ class: "pt-log-row" },
    });
    /** @type {__VLS_StyleScopedClasses['pt-log-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "pt-log-time" },
    });
    /** @type {__VLS_StyleScopedClasses['pt-log-time']} */ ;
    (l.time);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "pt-log-msg" },
    });
    /** @type {__VLS_StyleScopedClasses['pt-log-msg']} */ ;
    (l.message);
    // @ts-ignore
    [currentStep, currentStep, files, removeFiles, startProcessing, status, status, progress, progress, statusMessage, logs,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "pt-step" },
    ...{ class: ({ done: __VLS_ctx.status === 'complete' }) },
});
/** @type {__VLS_StyleScopedClasses['pt-step']} */ ;
/** @type {__VLS_StyleScopedClasses['done']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "pt-step-header" },
});
/** @type {__VLS_StyleScopedClasses['pt-step-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "pt-step-num" },
});
/** @type {__VLS_StyleScopedClasses['pt-step-num']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "pt-step-title" },
});
/** @type {__VLS_StyleScopedClasses['pt-step-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "pt-step-body" },
});
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.status === 'complete' || __VLS_ctx.status === 'error') }, null, null);
/** @type {__VLS_StyleScopedClasses['pt-step-body']} */ ;
if (__VLS_ctx.status === 'complete') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pt-result" },
    });
    /** @type {__VLS_StyleScopedClasses['pt-result']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pt-result-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['pt-result-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pt-result-text" },
    });
    /** @type {__VLS_StyleScopedClasses['pt-result-text']} */ ;
    (__VLS_ctx.modelLabel);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.status === 'complete'))
                    return;
                __VLS_ctx.$emit('process-complete');
                // @ts-ignore
                [status, status, status, status, modelLabel, $emit,];
            } },
        ...{ class: "pt-view-btn" },
    });
    /** @type {__VLS_StyleScopedClasses['pt-view-btn']} */ ;
}
else if (__VLS_ctx.status === 'error') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pt-result pt-error" },
    });
    /** @type {__VLS_StyleScopedClasses['pt-result']} */ ;
    /** @type {__VLS_StyleScopedClasses['pt-error']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pt-result-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['pt-result-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pt-result-text" },
    });
    /** @type {__VLS_StyleScopedClasses['pt-result-text']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pt-error-msg" },
    });
    /** @type {__VLS_StyleScopedClasses['pt-error-msg']} */ ;
    (__VLS_ctx.errorMessage);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.resetState) },
        ...{ class: "pt-retry-btn" },
    });
    /** @type {__VLS_StyleScopedClasses['pt-retry-btn']} */ ;
}
// @ts-ignore
[status, errorMessage, resetState,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
