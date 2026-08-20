import { ref, computed, nextTick, watch, onBeforeUnmount } from 'vue';
const props = defineProps();
const emit = defineEmits();
const keyNameMap = {
    weak_rock: '软弱围岩', high_stress: '高地应力', water_zone: '富水带', fracture_zone: '破碎带',
    face_sketch: '掌子面素描', gpr: '地质雷达', horiz_drill: '超前水平钻',
    deep_hole: '加深炮孔', tsp: 'TSP反演', tem: '瞬变电磁',
};
const title = computed(() => keyNameMap[props.modelKey ?? ''] ?? '自动化处理');
const currentStep = ref(1);
const files = ref([]);
const isDragging = ref(false);
const fileInput = ref(null);
const status = ref('idle');
const statusMessage = ref('准备就绪');
const progress = ref(0);
const logs = ref([]);
const logContainer = ref(null);
const errorMessage = ref('');
let pollingInterval = null;
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
    }
    else {
        stopPolling(); // 当侧边栏关闭时，停止轮询
    }
});
onBeforeUnmount(() => {
    stopPolling(); // 组件卸载前，确保停止轮询
});
const addLog = (message) => {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    logs.value.push({ time, message });
    nextTick(() => {
        if (logContainer.value) {
            logContainer.value.scrollTop = logContainer.value.scrollHeight;
        }
    });
};
const triggerFileInput = () => { fileInput.value?.click(); };
const handleFileSelect = (e) => {
    const target = e.target;
    if (target.files)
        files.value = Array.from(target.files);
};
const handleFileDrop = (e) => {
    isDragging.value = false;
    if (e.dataTransfer?.files)
        files.value = Array.from(e.dataTransfer.files);
};
const removeFiles = () => { files.value = []; };
const startProcessing = async () => {
    if (files.value.length === 0)
        return;
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
                if (!statusResponse.ok)
                    throw new Error(`状态查询失败: ${statusResponse.statusText}`);
                const jobStatus = await statusResponse.json();
                // 更新UI
                progress.value = jobStatus.progress ?? progress.value;
                if (jobStatus.message)
                    statusMessage.value = jobStatus.message;
                if (jobStatus.log)
                    addLog(jobStatus.log); // 假设后端每次返回一条新日志
                if (jobStatus.status === 'complete') {
                    stopPolling();
                    status.value = 'complete';
                    currentStep.value = 3;
                    progress.value = 100;
                    addLog('流程处理完毕。');
                }
                else if (jobStatus.status === 'error') {
                    stopPolling();
                    status.value = 'error';
                    errorMessage.value = jobStatus.error || '未知后端错误';
                    addLog(`处理失败: ${errorMessage.value}`);
                }
            }
            catch (pollError) {
                stopPolling();
                status.value = 'error';
                errorMessage.value = '无法连接服务器获取状态。';
                addLog(errorMessage.value);
            }
        }, 2000); // 每2秒查询一次
    }
    catch (uploadError) {
        status.value = 'error';
        errorMessage.value = uploadError.message;
        addLog(errorMessage.value);
    }
};
const viewResult = () => {
    emit('process-complete');
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
/** @type {__VLS_StyleScopedClasses['done']} */ ;
/** @type {__VLS_StyleScopedClasses['step-num']} */ ;
/** @type {__VLS_StyleScopedClasses['upload-area']} */ ;
/** @type {__VLS_StyleScopedClasses['upload-area']} */ ;
/** @type {__VLS_StyleScopedClasses['file-info']} */ ;
/** @type {__VLS_StyleScopedClasses['file-remove-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['start-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['start-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['result-text']} */ ;
/** @type {__VLS_StyleScopedClasses['view-btn']} */ ;
let __VLS_0;
/** @ts-ignore @type {typeof __VLS_components.transition | typeof __VLS_components.Transition | typeof __VLS_components.transition | typeof __VLS_components.Transition} */
transition;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    name: "panel-slide-left",
}));
const __VLS_2 = __VLS_1({
    name: "panel-slide-left",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_3.slots;
if (__VLS_ctx.show) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "workflow-sidebar" },
    });
    /** @type {__VLS_StyleScopedClasses['workflow-sidebar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ws-header" },
    });
    /** @type {__VLS_StyleScopedClasses['ws-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.show))
                    return;
                __VLS_ctx.$emit('back');
                // @ts-ignore
                [show, $emit,];
            } },
        ...{ class: "ws-back-btn" },
        title: "返回列表",
    });
    /** @type {__VLS_StyleScopedClasses['ws-back-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "back-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['back-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ws-title-group" },
    });
    /** @type {__VLS_StyleScopedClasses['ws-title-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ws-title" },
    });
    /** @type {__VLS_StyleScopedClasses['ws-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ws-sub" },
    });
    /** @type {__VLS_StyleScopedClasses['ws-sub']} */ ;
    (__VLS_ctx.title);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ws-body" },
    });
    /** @type {__VLS_StyleScopedClasses['ws-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ap-step" },
        ...{ class: ({ done: __VLS_ctx.currentStep > 1, active: __VLS_ctx.currentStep === 1 }) },
    });
    /** @type {__VLS_StyleScopedClasses['ap-step']} */ ;
    /** @type {__VLS_StyleScopedClasses['done']} */ ;
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "step-header" },
    });
    /** @type {__VLS_StyleScopedClasses['step-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "step-num" },
    });
    /** @type {__VLS_StyleScopedClasses['step-num']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "step-title" },
    });
    /** @type {__VLS_StyleScopedClasses['step-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "step-content" },
    });
    /** @type {__VLS_StyleScopedClasses['step-content']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ onDragover: (...[$event]) => {
                if (!(__VLS_ctx.show))
                    return;
                __VLS_ctx.isDragging = true;
                // @ts-ignore
                [title, currentStep, currentStep, isDragging,];
            } },
        ...{ onDragleave: (...[$event]) => {
                if (!(__VLS_ctx.show))
                    return;
                __VLS_ctx.isDragging = false;
                // @ts-ignore
                [isDragging,];
            } },
        ...{ onDrop: (__VLS_ctx.handleFileDrop) },
        ...{ class: "upload-area" },
        ...{ class: ({ dragging: __VLS_ctx.isDragging }) },
    });
    /** @type {__VLS_StyleScopedClasses['upload-area']} */ ;
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
            ...{ class: "upload-icon" },
        });
        /** @type {__VLS_StyleScopedClasses['upload-icon']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ onClick: (__VLS_ctx.triggerFileInput) },
            ...{ class: "upload-link" },
        });
        /** @type {__VLS_StyleScopedClasses['upload-link']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "upload-hint" },
        });
        /** @type {__VLS_StyleScopedClasses['upload-hint']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "file-list-container" },
        });
        /** @type {__VLS_StyleScopedClasses['file-list-container']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "file-list-scroller" },
        });
        /** @type {__VLS_StyleScopedClasses['file-list-scroller']} */ ;
        for (const [file, index] of __VLS_vFor((__VLS_ctx.files))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (index),
                ...{ class: "file-info" },
            });
            /** @type {__VLS_StyleScopedClasses['file-info']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "file-icon" },
            });
            /** @type {__VLS_StyleScopedClasses['file-icon']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "file-details" },
            });
            /** @type {__VLS_StyleScopedClasses['file-details']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "file-name" },
                title: (file.name),
            });
            /** @type {__VLS_StyleScopedClasses['file-name']} */ ;
            (file.name);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "file-size" },
            });
            /** @type {__VLS_StyleScopedClasses['file-size']} */ ;
            ((file.size / 1024 / 1024).toFixed(2));
            // @ts-ignore
            [isDragging, handleFileDrop, handleFileSelect, files, files, triggerFileInput,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.removeFiles) },
            ...{ class: "file-remove-btn" },
            title: "移除所有文件",
        });
        /** @type {__VLS_StyleScopedClasses['file-remove-btn']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.startProcessing) },
        ...{ class: "start-btn" },
        disabled: (__VLS_ctx.files.length === 0 || __VLS_ctx.status !== 'idle'),
    });
    /** @type {__VLS_StyleScopedClasses['start-btn']} */ ;
    (__VLS_ctx.status === 'idle' ? '开始处理' : '处理中...');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ap-step" },
        ...{ class: ({ active: __VLS_ctx.currentStep === 2 }) },
    });
    /** @type {__VLS_StyleScopedClasses['ap-step']} */ ;
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "step-header" },
    });
    /** @type {__VLS_StyleScopedClasses['step-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "step-num" },
    });
    /** @type {__VLS_StyleScopedClasses['step-num']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "step-title" },
    });
    /** @type {__VLS_StyleScopedClasses['step-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "step-content" },
    });
    /** @type {__VLS_StyleScopedClasses['step-content']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "status-bar" },
    });
    /** @type {__VLS_StyleScopedClasses['status-bar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "status-progress" },
        ...{ style: ({ width: __VLS_ctx.progress + '%' }) },
    });
    /** @type {__VLS_StyleScopedClasses['status-progress']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "status-text" },
    });
    /** @type {__VLS_StyleScopedClasses['status-text']} */ ;
    (__VLS_ctx.statusMessage);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "status-log" },
        ref: "logContainer",
    });
    /** @type {__VLS_StyleScopedClasses['status-log']} */ ;
    for (const [log, i] of __VLS_vFor((__VLS_ctx.logs))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (i),
            ...{ class: "log-item" },
        });
        /** @type {__VLS_StyleScopedClasses['log-item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "log-time" },
        });
        /** @type {__VLS_StyleScopedClasses['log-time']} */ ;
        (log.time);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "log-message" },
        });
        /** @type {__VLS_StyleScopedClasses['log-message']} */ ;
        (log.message);
        // @ts-ignore
        [currentStep, files, removeFiles, startProcessing, status, status, progress, statusMessage, logs,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ap-step" },
        ...{ class: ({ done: __VLS_ctx.status === 'complete' }) },
    });
    /** @type {__VLS_StyleScopedClasses['ap-step']} */ ;
    /** @type {__VLS_StyleScopedClasses['done']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "step-header" },
    });
    /** @type {__VLS_StyleScopedClasses['step-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "step-num" },
    });
    /** @type {__VLS_StyleScopedClasses['step-num']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "step-title" },
    });
    /** @type {__VLS_StyleScopedClasses['step-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "step-content result-content" },
    });
    /** @type {__VLS_StyleScopedClasses['step-content']} */ ;
    /** @type {__VLS_StyleScopedClasses['result-content']} */ ;
    if (__VLS_ctx.status === 'complete') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "result-icon" },
        });
        /** @type {__VLS_StyleScopedClasses['result-icon']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "result-text" },
        });
        /** @type {__VLS_StyleScopedClasses['result-text']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.viewResult) },
            ...{ class: "view-btn" },
        });
        /** @type {__VLS_StyleScopedClasses['view-btn']} */ ;
    }
    else if (__VLS_ctx.status === 'error') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "error-info" },
        });
        /** @type {__VLS_StyleScopedClasses['error-info']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "result-icon" },
        });
        /** @type {__VLS_StyleScopedClasses['result-icon']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "result-text" },
        });
        /** @type {__VLS_StyleScopedClasses['result-text']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "error-details" },
        });
        /** @type {__VLS_StyleScopedClasses['error-details']} */ ;
        (__VLS_ctx.errorMessage);
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pending-text" },
        });
        /** @type {__VLS_StyleScopedClasses['pending-text']} */ ;
    }
}
// @ts-ignore
[status, status, status, viewResult, errorMessage,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
