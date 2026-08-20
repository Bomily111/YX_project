import { onMounted, onBeforeUnmount, ref } from 'vue';
import { createViewer, enableOnDemandRender, installOrbitControls } from './scene';
import { loadTunnel, setTunnelVisible, setTunnelTranslucent } from './tunnel';
import { loadBlast, setBlastVisible, flyToBlast, flyToTunnelOverview, getBlastModel, BLAST_INFO } from './blast';
import Design2DPanel from './Design2DPanel.vue';
import { aiEvents } from '@/ai-agent';
const host = ref();
const info = BLAST_INFO;
const showTunnel = ref(true);
const showBlast = ref(true);
const loading = ref(true);
const loadMsg = ref('');
const showDesign2D = ref(false); // 二维设计图小窗(图层控制里的勾选项)
let viewer;
let orbit;
onMounted(async () => {
    viewer = createViewer(host.value);
    loadMsg.value = '隧道段';
    await loadTunnel(viewer); // 只加载爆破所在段(1段, 68MB)
    setTunnelTranslucent(viewer, false); // 默认: 保留隧道原始纹理(不透视)
    loadMsg.value = '爆破效果';
    const model = await loadBlast(viewer);
    // 标准轨道控制(左键环绕/右键平移/滚轮缩放, 绕断面中心), 修复 Ctrl+左键甩飞黑屏
    orbit = installOrbitControls(viewer, () => getBlastModel()?.boundingSphere?.center);
    const initView = new URLSearchParams(location.search).get('view');
    model.readyEvent.addEventListener(() => {
        // 默认进入"带纹理整体隧道"总览; 带 ?view= 时直接进对应透视视角(便于调试)
        if (initView && ['persp', 'front', 'side', 'top'].includes(initView))
            fly(initView);
        else
            exit();
        loading.value = false;
        setTimeout(() => enableOnDemandRender(viewer), 2500);
    });
    // 监听 AI Agent 指令
    aiEvents.on('blast:adjust-view', onAdjustView);
    aiEvents.on('blast:toggle-diagram', onToggleDiagram);
});
onBeforeUnmount(() => {
    aiEvents.off('blast:adjust-view', onAdjustView);
    aiEvents.off('blast:toggle-diagram', onToggleDiagram);
    try {
        viewer?.destroy();
    }
    catch { }
});
function onToggleTunnel() { setTunnelVisible(viewer, showTunnel.value); }
function onToggleBlast() { setBlastVisible(viewer, showBlast.value); }
// 点视角按钮: 隧道变透视(半透明) + 飞到爆破断面对应视角
function fly(v) {
    orbit?.resetFocus();
    setTunnelTranslucent(viewer, true);
    flyToBlast(viewer, v);
}
// 退出: 恢复带纹理整体隧道 + 总览视角
function exit() {
    orbit?.resetFocus();
    setTunnelTranslucent(viewer, false);
    flyToTunnelOverview(viewer);
}
// ── AI Agent 事件响应 ─────────────────────────────────────
function onAdjustView(view) {
    if (!viewer)
        return;
    if (view === 'overview')
        exit();
    else
        fly(view);
}
function onToggleDiagram(visible) {
    showDesign2D.value = visible;
}
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['tm-viewer']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-check']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-check']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-check']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-check']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-kv']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-footer']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-footer']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-footer']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-footer']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-exit']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "tm-root" },
});
/** @type {__VLS_StyleScopedClasses['tm-root']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "host",
    ...{ class: "tm-viewer" },
});
/** @type {__VLS_StyleScopedClasses['tm-viewer']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
    ...{ class: "tm-header" },
});
/** @type {__VLS_StyleScopedClasses['tm-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "tm-title" },
});
/** @type {__VLS_StyleScopedClasses['tm-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "tm-sub" },
});
/** @type {__VLS_StyleScopedClasses['tm-sub']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "tm-panel tm-left" },
});
/** @type {__VLS_StyleScopedClasses['tm-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-left']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "tm-panel-h" },
});
/** @type {__VLS_StyleScopedClasses['tm-panel-h']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "tm-check" },
});
/** @type {__VLS_StyleScopedClasses['tm-check']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: (__VLS_ctx.onToggleTunnel) },
    type: "checkbox",
});
(__VLS_ctx.showTunnel);
__VLS_asFunctionalElement1(__VLS_intrinsics.i, __VLS_intrinsics.i)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "tm-check" },
});
/** @type {__VLS_StyleScopedClasses['tm-check']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: (__VLS_ctx.onToggleBlast) },
    type: "checkbox",
});
(__VLS_ctx.showBlast);
__VLS_asFunctionalElement1(__VLS_intrinsics.i, __VLS_intrinsics.i)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "tm-check" },
});
/** @type {__VLS_StyleScopedClasses['tm-check']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
});
(__VLS_ctx.showDesign2D);
__VLS_asFunctionalElement1(__VLS_intrinsics.i, __VLS_intrinsics.i)({});
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "tm-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['tm-hint']} */ ;
    (__VLS_ctx.loadMsg);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "tm-panel tm-right" },
});
/** @type {__VLS_StyleScopedClasses['tm-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-right']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "tm-panel-h" },
});
/** @type {__VLS_StyleScopedClasses['tm-panel-h']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "tm-kv" },
});
/** @type {__VLS_StyleScopedClasses['tm-kv']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
(__VLS_ctx.info.section);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "tm-grid" },
});
/** @type {__VLS_StyleScopedClasses['tm-grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({
    ...{ class: "warn" },
});
/** @type {__VLS_StyleScopedClasses['warn']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
(__VLS_ctx.info.excavationWidthM);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
(__VLS_ctx.info.advanceM);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
(__VLS_ctx.info.crownHeightM);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "tm-holes" },
});
/** @type {__VLS_StyleScopedClasses['tm-holes']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "tm-holes-h" },
});
/** @type {__VLS_StyleScopedClasses['tm-holes-h']} */ ;
(__VLS_ctx.info.holes.total);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "hc" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['hc']} */ ;
(__VLS_ctx.info.holes.perimeter);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "hc" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['hc']} */ ;
(__VLS_ctx.info.holes.cut);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "hc" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['hc']} */ ;
(__VLS_ctx.info.holes.auxiliary);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "hc" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['hc']} */ ;
(__VLS_ctx.info.holes.floor);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "tm-kv" },
});
/** @type {__VLS_StyleScopedClasses['tm-kv']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
((__VLS_ctx.info.pointCount / 10000).toFixed(0));
__VLS_asFunctionalElement1(__VLS_intrinsics.footer, __VLS_intrinsics.footer)({
    ...{ class: "tm-footer" },
});
/** @type {__VLS_StyleScopedClasses['tm-footer']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.fly('persp');
            // @ts-ignore
            [onToggleTunnel, showTunnel, onToggleBlast, showBlast, showDesign2D, loading, loadMsg, info, info, info, info, info, info, info, info, info, info, fly,];
        } },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.fly('front');
            // @ts-ignore
            [fly,];
        } },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.fly('side');
            // @ts-ignore
            [fly,];
        } },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.fly('top');
            // @ts-ignore
            [fly,];
        } },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.exit) },
    ...{ class: "tm-exit" },
});
/** @type {__VLS_StyleScopedClasses['tm-exit']} */ ;
const __VLS_0 = Design2DPanel;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    visible: (__VLS_ctx.showDesign2D),
}));
const __VLS_2 = __VLS_1({
    visible: (__VLS_ctx.showDesign2D),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
// @ts-ignore
[showDesign2D, exit,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
