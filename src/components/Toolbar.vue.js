const __VLS_props = defineProps();
const __VLS_emit = defineEmits();
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "toolbar-float" },
});
/** @type {__VLS_StyleScopedClasses['toolbar-float']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('toggle-tool', 'roaming');
            // @ts-ignore
            [$emit,];
        } },
    ...{ class: "tool-btn" },
    ...{ class: ({ active: __VLS_ctx.activeTool === 'roaming' }) },
    title: "隧道漫游",
});
/** @type {__VLS_StyleScopedClasses['tool-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('toggle-tool', 'measure');
            // @ts-ignore
            [$emit, activeTool,];
        } },
    ...{ class: "tool-btn" },
    ...{ class: ({ active: __VLS_ctx.activeTool === 'measure' }) },
    title: "空间测量",
});
/** @type {__VLS_StyleScopedClasses['tool-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('toggle-tool', 'clip');
            // @ts-ignore
            [$emit, activeTool,];
        } },
    ...{ class: "tool-btn" },
    ...{ class: ({ active: __VLS_ctx.activeTool === 'clip' }) },
    title: "模型剖切",
});
/** @type {__VLS_StyleScopedClasses['tool-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('action', 'screenshot');
            // @ts-ignore
            [$emit, activeTool,];
        } },
    ...{ class: "tool-btn" },
    title: "截图导出",
});
/** @type {__VLS_StyleScopedClasses['tool-btn']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('toggle-tool', 'coord');
            // @ts-ignore
            [$emit,];
        } },
    ...{ class: "tool-btn" },
    ...{ class: ({ active: __VLS_ctx.activeTool === 'coord' }) },
    title: "坐标查询",
});
/** @type {__VLS_StyleScopedClasses['tool-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('action', 'fullscreen');
            // @ts-ignore
            [$emit, activeTool,];
        } },
    ...{ class: "tool-btn" },
    title: "全屏显示",
});
/** @type {__VLS_StyleScopedClasses['tool-btn']} */ ;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
