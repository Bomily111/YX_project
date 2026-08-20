import { ref, reactive, computed, onBeforeUnmount, watch } from 'vue';
import { getRoamingController } from '@/utils/Common/RoamingController';
import { DTScopeEngine } from '@/utils/Common/Viewer';
const props = defineProps();
const emit = defineEmits();
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
function sync(s) {
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
    if (playing.value)
        return 'dot-play';
    if (paused.value)
        return 'dot-pause';
    return 'dot-idle';
});
const statusText = computed(() => {
    if (playing.value)
        return '漫游中...';
    if (paused.value)
        return '已暂停';
    return '就绪';
});
function togglePlay() {
    if (!ready.value)
        return;
    if (playing.value && !paused.value) {
        ctrl.pause();
    }
    else {
        ctrl.start();
    }
}
function stop() { ctrl.stop(); }
function jumpToEntrance() { ctrl.jumpToEntrance(); }
function jumpToExit() { ctrl.jumpToExit(); }
function speedUp() { ctrl.setSpeed(speed.value + 10); }
function slowDown() { ctrl.setSpeed(speed.value - 10); }
function onSeek(e) {
    const val = Number(e.target.value) / 1000;
    ctrl.seekToProgress(val);
}
// ── 拖拽 ──────────────────────────────────────────────
const drag = reactive({
    isDragging: false,
    startX: 0,
    startY: 0,
});
function startDrag(e) {
    drag.isDragging = true;
    drag.startX = e.clientX - pos.left;
    drag.startY = e.clientY - pos.top;
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
}
function onDrag(e) {
    if (!drag.isDragging)
        return;
    pos.left = e.clientX - drag.startX;
    pos.top = e.clientY - drag.startY;
}
function stopDrag() {
    drag.isDragging = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
}
// ── 等待 Viewer 就绪 ──────────────────────────────────
let retryTimer = null;
function getCesiumViewer() {
    if (window.viewer)
        return window.viewer;
    if (DTScopeEngine && DTScopeEngine.viewer)
        return DTScopeEngine.viewer;
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
                    if (retryTimer)
                        clearInterval(retryTimer);
                }
            }, 200);
        }
    }
}, { immediate: true });
onBeforeUnmount(() => {
    if (retryTimer)
        clearInterval(retryTimer);
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
    ctrl.exit();
});
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
let __VLS_0;
/** @ts-ignore @type {typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
Teleport;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    to: "body",
}));
const __VLS_2 = __VLS_1({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_3.slots;
if (__VLS_ctx.visible) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "roaming-popup" },
        ...{ style: ({ left: __VLS_ctx.pos.left + 'px', top: __VLS_ctx.pos.top + 'px' }) },
    });
    /** @type {__VLS_StyleScopedClasses['roaming-popup']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onMousedown: (__VLS_ctx.startDrag) },
        ...{ class: "popup-header" },
    });
    /** @type {__VLS_StyleScopedClasses['popup-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "popup-title" },
    });
    /** @type {__VLS_StyleScopedClasses['popup-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.handleClose) },
        ...{ class: "close-btn" },
        title: "关闭",
    });
    /** @type {__VLS_StyleScopedClasses['close-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "popup-body" },
    });
    /** @type {__VLS_StyleScopedClasses['popup-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "jump-row" },
    });
    /** @type {__VLS_StyleScopedClasses['jump-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.jumpToEntrance) },
        ...{ class: "roam-btn" },
        title: "跳转到隧道入口",
        disabled: (!__VLS_ctx.ready),
    });
    /** @type {__VLS_StyleScopedClasses['roam-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.togglePlay) },
        ...{ class: "roam-btn play-btn" },
        title: (__VLS_ctx.playing ? '暂停漫游' : '开始漫游'),
        disabled: (!__VLS_ctx.ready),
    });
    /** @type {__VLS_StyleScopedClasses['roam-btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['play-btn']} */ ;
    if (__VLS_ctx.playing) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.stop) },
        ...{ class: "roam-btn stop-btn" },
        title: "停止并回到起点",
        disabled: (!__VLS_ctx.ready || (!__VLS_ctx.playing && !__VLS_ctx.paused)),
    });
    /** @type {__VLS_StyleScopedClasses['roam-btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['stop-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.jumpToExit) },
        ...{ class: "roam-btn" },
        title: "跳转到隧道出口",
        disabled: (!__VLS_ctx.ready),
    });
    /** @type {__VLS_StyleScopedClasses['roam-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "control-row" },
    });
    /** @type {__VLS_StyleScopedClasses['control-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "row-label" },
    });
    /** @type {__VLS_StyleScopedClasses['row-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.slowDown) },
        ...{ class: "speed-btn" },
        title: "减速",
        disabled: (!__VLS_ctx.ready),
    });
    /** @type {__VLS_StyleScopedClasses['speed-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "speed-val" },
    });
    /** @type {__VLS_StyleScopedClasses['speed-val']} */ ;
    (__VLS_ctx.speed);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "speed-unit" },
    });
    /** @type {__VLS_StyleScopedClasses['speed-unit']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.speedUp) },
        ...{ class: "speed-btn" },
        title: "加速",
        disabled: (!__VLS_ctx.ready),
    });
    /** @type {__VLS_StyleScopedClasses['speed-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.visible))
                    return;
                __VLS_ctx.ctrl.setSpeed(10);
                // @ts-ignore
                [visible, pos, pos, startDrag, handleClose, jumpToEntrance, ready, ready, ready, ready, ready, ready, togglePlay, playing, playing, playing, stop, paused, jumpToExit, slowDown, speed, speedUp, ctrl,];
            } },
        ...{ class: "speed-preset" },
        ...{ class: ({ active: __VLS_ctx.speed === 10 }) },
        disabled: (!__VLS_ctx.ready),
    });
    /** @type {__VLS_StyleScopedClasses['speed-preset']} */ ;
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.visible))
                    return;
                __VLS_ctx.ctrl.setSpeed(30);
                // @ts-ignore
                [ready, speed, ctrl,];
            } },
        ...{ class: "speed-preset" },
        ...{ class: ({ active: __VLS_ctx.speed === 30 }) },
        disabled: (!__VLS_ctx.ready),
    });
    /** @type {__VLS_StyleScopedClasses['speed-preset']} */ ;
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.visible))
                    return;
                __VLS_ctx.ctrl.setSpeed(80);
                // @ts-ignore
                [ready, speed, ctrl,];
            } },
        ...{ class: "speed-preset" },
        ...{ class: ({ active: __VLS_ctx.speed === 80 }) },
        disabled: (!__VLS_ctx.ready),
    });
    /** @type {__VLS_StyleScopedClasses['speed-preset']} */ ;
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "control-row" },
    });
    /** @type {__VLS_StyleScopedClasses['control-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "row-label" },
    });
    /** @type {__VLS_StyleScopedClasses['row-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onInput: (__VLS_ctx.onSeek) },
        ...{ class: "progress-slider" },
        type: "range",
        min: "0",
        max: "1000",
        step: "1",
        value: (Math.round(__VLS_ctx.progress * 1000)),
    });
    /** @type {__VLS_StyleScopedClasses['progress-slider']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "mileage" },
    });
    /** @type {__VLS_StyleScopedClasses['mileage']} */ ;
    (__VLS_ctx.currentMileage);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "status-row" },
    });
    /** @type {__VLS_StyleScopedClasses['status-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "status-dot" },
        ...{ class: (__VLS_ctx.statusCls) },
    });
    /** @type {__VLS_StyleScopedClasses['status-dot']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "status-text" },
    });
    /** @type {__VLS_StyleScopedClasses['status-text']} */ ;
    (__VLS_ctx.statusText);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "waypoint-info" },
    });
    /** @type {__VLS_StyleScopedClasses['waypoint-info']} */ ;
    (__VLS_ctx.currentWaypoint);
    (__VLS_ctx.totalWaypoints);
}
// @ts-ignore
[ready, speed, onSeek, progress, currentMileage, statusCls, statusText, currentWaypoint, totalWaypoints,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
