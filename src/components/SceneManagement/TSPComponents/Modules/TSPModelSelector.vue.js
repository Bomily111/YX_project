import { ref } from 'vue';
const emit = defineEmits(['change']);
const activeType = ref('vs'); // 默认 VS，与 Layue-master 一致
function select(type) {
    if (activeType.value === type)
        return;
    activeType.value = type;
    emit('change', type);
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
__VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
    ...{ class: "tsp-selector" },
});
/** @type {__VLS_StyleScopedClasses['tsp-selector']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.select('vp');
            // @ts-ignore
            [select,];
        } },
    ...{ class: (__VLS_ctx.activeType === 'vp' ? 'active' : '') },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.select('vs');
            // @ts-ignore
            [select, activeType,];
        } },
    ...{ class: (__VLS_ctx.activeType === 'vs' ? 'active' : '') },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.select('e');
            // @ts-ignore
            [select, activeType,];
        } },
    ...{ class: (__VLS_ctx.activeType === 'e' ? 'active' : '') },
});
// @ts-ignore
[activeType,];
const __VLS_export = (await import('vue')).defineComponent({
    emits: {},
});
export default {};
