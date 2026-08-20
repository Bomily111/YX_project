import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import * as Cesium from 'cesium';
import { generateSteelArchGLB, generateWorkfaceGLB, getProfileSummary } from './steelArch';
import { createSupportViewer, loadTunnelModel, setTunnelOpacity, getArchFocus, getArchModelMatrix, setupClickHandler, enableOnDemandRender, installOrbitControls, } from './cesiumScene';
const host = ref();
const loading = ref(true);
const loadMsg = ref('初始化场景');
const loadPct = ref(0);
const R1 = ref(6.08);
const R2 = ref(10.58);
const betaDeg = ref(15.8797);
const profileKey = ref('I16');
const tunnelOpacity = ref(0.35);
const showTunnel = ref(true);
const profileSummary = computed(() => getProfileSummary(profileKey.value));
let viewer = null;
let orbit = null;
let clickHandler = null;
let tunnelModel = null;
let archModel = null;
let workfaceModel = null;
let archBlobUrl = null;
let workfaceBlobUrl = null;
let showWorkface = false;
let updating = false;
async function regenerateArch() {
    if (!viewer || !tunnelModel || updating)
        return;
    updating = true;
    try {
        const params = {
            R1: R1.value,
            R2: R2.value,
            betaDeg: betaDeg.value,
            profileKey: profileKey.value,
        };
        const modelMatrix = getArchModelMatrix(tunnelModel);
        // 钢架
        const glb = await generateSteelArchGLB(params);
        console.log('[钢架] GLB 生成完成, 大小:', (glb.byteLength / 1024).toFixed(1), 'KB');
        if (archBlobUrl)
            URL.revokeObjectURL(archBlobUrl);
        archBlobUrl = URL.createObjectURL(new Blob([glb], { type: 'application/octet-stream' }));
        const model = await Cesium.Model.fromGltfAsync({ url: archBlobUrl, modelMatrix });
        if (archModel)
            viewer.scene.primitives.remove(archModel);
        archModel = model;
        viewer.scene.primitives.add(model);
        // 工作面
        const wfGlb = await generateWorkfaceGLB(params);
        if (workfaceBlobUrl)
            URL.revokeObjectURL(workfaceBlobUrl);
        workfaceBlobUrl = URL.createObjectURL(new Blob([wfGlb], { type: 'application/octet-stream' }));
        const wfModel = await Cesium.Model.fromGltfAsync({ url: workfaceBlobUrl, modelMatrix });
        wfModel.show = showWorkface;
        if (workfaceModel)
            viewer.scene.primitives.remove(workfaceModel);
        workfaceModel = wfModel;
        viewer.scene.primitives.add(wfModel);
        viewer.scene.requestRender();
        console.log('[钢架] 钢架+工作面已更新');
    }
    catch (err) {
        console.error('[钢架] 更新失败:', err);
    }
    finally {
        updating = false;
    }
}
function toggleWorkface() {
    showWorkface = !showWorkface;
    if (workfaceModel)
        workfaceModel.show = showWorkface;
    // 切换时改变钢架颜色：工作面显示时高亮
    if (archModel) {
        archModel.color = showWorkface
            ? Cesium.Color.fromCssColorString('#e2e8f0')
            : undefined;
        archModel.colorBlendMode = showWorkface
            ? Cesium.ColorBlendMode.REPLACE
            : Cesium.ColorBlendMode.HIGHLIGHT;
    }
    viewer.scene.requestRender();
}
let watchTimer = null;
watch([R1, R2, betaDeg, profileKey], () => {
    if (watchTimer)
        clearTimeout(watchTimer);
    watchTimer = setTimeout(() => regenerateArch(), 30);
});
function flyTo(view) {
    if (!viewer || !tunnelModel)
        return;
    const cam = viewer.camera;
    const focus = getArchFocus(tunnelModel);
    const dist = 25;
    orbit?.resetFocus();
    let offset;
    switch (view) {
        case 'front':
            offset = new Cesium.Cartesian3(0, 0, dist);
            break;
        case 'side':
            offset = new Cesium.Cartesian3(dist, 0, 0);
            break;
        case 'top':
            offset = new Cesium.Cartesian3(0, 0, dist);
            break;
        case 'reset':
        default:
            offset = new Cesium.Cartesian3(dist * 0.5, -dist * 0.4, dist * 0.6);
            break;
    }
    const target = Cesium.Cartesian3.add(focus, offset, new Cesium.Cartesian3());
    cam.flyTo({ destination: target, orientation: {
            heading: Cesium.Math.toRadians(90),
            pitch: Cesium.Math.toRadians(-20),
            roll: 0,
        }, duration: 0.8 });
}
function onToggleTunnel() {
    if (!tunnelModel)
        return;
    tunnelModel.show = showTunnel.value;
    viewer.scene.requestRender();
}
function onTunnelOpacity() {
    if (!tunnelModel)
        return;
    setTunnelOpacity(tunnelModel, tunnelOpacity.value);
    viewer.scene.requestRender();
}
onMounted(async () => {
    try {
        console.log('[钢架] 开始创建 Cesium Viewer...');
        viewer = createSupportViewer(host.value);
        console.log('[钢架] Viewer 创建成功');
        loadMsg.value = '加载隧道模型';
        loadPct.value = 15;
        tunnelModel = await loadTunnelModel(viewer);
        console.log('[钢架] 隧道加载完成, boundingSphere:', JSON.stringify(tunnelModel.boundingSphere));
        setTunnelOpacity(tunnelModel, tunnelOpacity.value);
        loadPct.value = 55;
        orbit = installOrbitControls(viewer, () => {
            if (!tunnelModel)
                return undefined;
            return getArchFocus(tunnelModel);
        });
        clickHandler = setupClickHandler(viewer, () => archModel, () => workfaceModel, toggleWorkface);
        console.log('[钢架] 轨道控制器安装完成');
        loadMsg.value = '生成钢架';
        loadPct.value = 70;
        await regenerateArch();
        console.log('[钢架] 钢架已加载');
        loadPct.value = 100;
        loading.value = false;
        const focus = getArchFocus(tunnelModel);
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.add(focus, new Cesium.Cartesian3(12, -8, 16), new Cesium.Cartesian3()),
            orientation: { heading: Cesium.Math.toRadians(90), pitch: Cesium.Math.toRadians(-25), roll: 0 },
            duration: 0,
        });
        setTimeout(() => enableOnDemandRender(viewer), 1500);
    }
    catch (err) {
        console.error('[钢架模块] 初始化失败:', err);
        if (err instanceof Error) {
            console.error('[钢架模块] 错误消息:', err.message);
            console.error('[钢架模块] 错误堆栈:', err.stack);
        }
        loadMsg.value = '加载失败，请刷新重试';
    }
});
onBeforeUnmount(() => {
    if (watchTimer)
        clearTimeout(watchTimer);
    if (archBlobUrl)
        URL.revokeObjectURL(archBlobUrl);
    if (workfaceBlobUrl)
        URL.revokeObjectURL(workfaceBlobUrl);
    if (clickHandler)
        clickHandler.destroy();
    try {
        viewer?.destroy();
    }
    catch { }
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['se-viewer']} */ ;
/** @type {__VLS_StyleScopedClasses['se-back-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['se-slider']} */ ;
/** @type {__VLS_StyleScopedClasses['se-num']} */ ;
/** @type {__VLS_StyleScopedClasses['se-select']} */ ;
/** @type {__VLS_StyleScopedClasses['se-select']} */ ;
/** @type {__VLS_StyleScopedClasses['se-fbtn']} */ ;
/** @type {__VLS_StyleScopedClasses['se-check']} */ ;
/** @type {__VLS_StyleScopedClasses['se-check']} */ ;
/** @type {__VLS_StyleScopedClasses['se-check']} */ ;
/** @type {__VLS_StyleScopedClasses['se-check']} */ ;
/** @type {__VLS_StyleScopedClasses['se-opacity-slider']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "se-root" },
});
/** @type {__VLS_StyleScopedClasses['se-root']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "host",
    ...{ class: "se-viewer" },
});
/** @type {__VLS_StyleScopedClasses['se-viewer']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
    ...{ class: "se-header" },
});
/** @type {__VLS_StyleScopedClasses['se-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "se-title" },
});
/** @type {__VLS_StyleScopedClasses['se-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$router.push('/');
            // @ts-ignore
            [$router,];
        } },
    ...{ class: "se-back-btn" },
});
/** @type {__VLS_StyleScopedClasses['se-back-btn']} */ ;
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "se-loading" },
    });
    /** @type {__VLS_StyleScopedClasses['se-loading']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "se-loading-text" },
    });
    /** @type {__VLS_StyleScopedClasses['se-loading-text']} */ ;
    (__VLS_ctx.loadMsg);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "se-loading-bar" },
    });
    /** @type {__VLS_StyleScopedClasses['se-loading-bar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "se-loading-fill" },
        ...{ style: ({ width: __VLS_ctx.loadPct + '%' }) },
    });
    /** @type {__VLS_StyleScopedClasses['se-loading-fill']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
    ...{ class: "se-panel" },
});
/** @type {__VLS_StyleScopedClasses['se-panel']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "se-panel-title" },
});
/** @type {__VLS_StyleScopedClasses['se-panel-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "se-param" },
});
/** @type {__VLS_StyleScopedClasses['se-param']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "se-param-label" },
});
/** @type {__VLS_StyleScopedClasses['se-param-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "se-param-val" },
});
/** @type {__VLS_StyleScopedClasses['se-param-val']} */ ;
(__VLS_ctx.R1.toFixed(2));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "se-param-row" },
});
/** @type {__VLS_StyleScopedClasses['se-param-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "range",
    ...{ class: "se-slider" },
    min: "0.1",
    max: "12",
    step: "0.01",
});
(__VLS_ctx.R1);
/** @type {__VLS_StyleScopedClasses['se-slider']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    ...{ class: "se-num" },
    min: "0.1",
    max: "12",
    step: "0.01",
});
(__VLS_ctx.R1);
/** @type {__VLS_StyleScopedClasses['se-num']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "se-param" },
});
/** @type {__VLS_StyleScopedClasses['se-param']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "se-param-label" },
});
/** @type {__VLS_StyleScopedClasses['se-param-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "se-param-val" },
});
/** @type {__VLS_StyleScopedClasses['se-param-val']} */ ;
(__VLS_ctx.R2.toFixed(2));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "se-param-row" },
});
/** @type {__VLS_StyleScopedClasses['se-param-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "range",
    ...{ class: "se-slider" },
    min: "0.1",
    max: "20",
    step: "0.01",
});
(__VLS_ctx.R2);
/** @type {__VLS_StyleScopedClasses['se-slider']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    ...{ class: "se-num" },
    min: "0.1",
    max: "20",
    step: "0.01",
});
(__VLS_ctx.R2);
/** @type {__VLS_StyleScopedClasses['se-num']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "se-param" },
});
/** @type {__VLS_StyleScopedClasses['se-param']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "se-param-label" },
});
/** @type {__VLS_StyleScopedClasses['se-param-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "se-param-val" },
});
/** @type {__VLS_StyleScopedClasses['se-param-val']} */ ;
(__VLS_ctx.betaDeg.toFixed(2));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "se-param-row" },
});
/** @type {__VLS_StyleScopedClasses['se-param-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "range",
    ...{ class: "se-slider" },
    min: "0",
    max: "89",
    step: "0.01",
});
(__VLS_ctx.betaDeg);
/** @type {__VLS_StyleScopedClasses['se-slider']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    ...{ class: "se-num" },
    min: "0",
    max: "89",
    step: "0.01",
});
(__VLS_ctx.betaDeg);
/** @type {__VLS_StyleScopedClasses['se-num']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "se-param" },
});
/** @type {__VLS_StyleScopedClasses['se-param']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "se-param-label" },
});
/** @type {__VLS_StyleScopedClasses['se-param-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ class: "se-select" },
    value: (__VLS_ctx.profileKey),
});
/** @type {__VLS_StyleScopedClasses['se-select']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "I16",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "I20",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "se-summary" },
});
/** @type {__VLS_StyleScopedClasses['se-summary']} */ ;
(__VLS_ctx.profileSummary);
__VLS_asFunctionalElement1(__VLS_intrinsics.footer, __VLS_intrinsics.footer)({
    ...{ class: "se-footer" },
});
/** @type {__VLS_StyleScopedClasses['se-footer']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.flyTo('front');
            // @ts-ignore
            [loading, loadMsg, loadPct, R1, R1, R1, R2, R2, R2, betaDeg, betaDeg, betaDeg, profileKey, profileSummary, flyTo,];
        } },
    ...{ class: "se-fbtn" },
});
/** @type {__VLS_StyleScopedClasses['se-fbtn']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.flyTo('side');
            // @ts-ignore
            [flyTo,];
        } },
    ...{ class: "se-fbtn" },
});
/** @type {__VLS_StyleScopedClasses['se-fbtn']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.flyTo('top');
            // @ts-ignore
            [flyTo,];
        } },
    ...{ class: "se-fbtn" },
});
/** @type {__VLS_StyleScopedClasses['se-fbtn']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.flyTo('reset');
            // @ts-ignore
            [flyTo,];
        } },
    ...{ class: "se-fbtn" },
});
/** @type {__VLS_StyleScopedClasses['se-fbtn']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "se-divider" },
});
/** @type {__VLS_StyleScopedClasses['se-divider']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "se-check" },
});
/** @type {__VLS_StyleScopedClasses['se-check']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: (__VLS_ctx.onToggleTunnel) },
    type: "checkbox",
});
(__VLS_ctx.showTunnel);
__VLS_asFunctionalElement1(__VLS_intrinsics.i, __VLS_intrinsics.i)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "se-opacity-label" },
});
/** @type {__VLS_StyleScopedClasses['se-opacity-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onInput: (__VLS_ctx.onTunnelOpacity) },
    type: "range",
    ...{ class: "se-opacity-slider" },
    min: "0.05",
    max: "1",
    step: "0.05",
});
(__VLS_ctx.tunnelOpacity);
/** @type {__VLS_StyleScopedClasses['se-opacity-slider']} */ ;
// @ts-ignore
[onToggleTunnel, showTunnel, onTunnelOpacity, tunnelOpacity,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
