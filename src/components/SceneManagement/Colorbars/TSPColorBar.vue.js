import { computed, defineProps } from 'vue';
const props = defineProps({
    activeType: { type: String, default: 'vs' },
});
const LABELS = {
    vp: { min: '4052', mid: '4477', max: '4902', unit: 'm/s' },
    vs: { min: '2217', mid: '2562', max: '2692', unit: 'm/s' },
    e: { min: '0', mid: '150', max: '300', unit: 'm' },
};
const minVal = computed(() => LABELS[props.activeType]?.min ?? '');
const midVal = computed(() => LABELS[props.activeType]?.mid ?? '');
const maxVal = computed(() => LABELS[props.activeType]?.max ?? '');
const unitLabel = computed(() => LABELS[props.activeType]?.unit ?? '');
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
    ...{ class: "out_rectangle" },
});
/** @type {__VLS_StyleScopedClasses['out_rectangle']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "jojo" },
});
/** @type {__VLS_StyleScopedClasses['jojo']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "triangle1" },
});
/** @type {__VLS_StyleScopedClasses['triangle1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "triangle2" },
});
/** @type {__VLS_StyleScopedClasses['triangle2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "triangle3" },
});
/** @type {__VLS_StyleScopedClasses['triangle3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-min" },
});
/** @type {__VLS_StyleScopedClasses['text-min']} */ ;
(__VLS_ctx.minVal);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-mid" },
});
/** @type {__VLS_StyleScopedClasses['text-mid']} */ ;
(__VLS_ctx.midVal);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-max" },
});
/** @type {__VLS_StyleScopedClasses['text-max']} */ ;
(__VLS_ctx.maxVal);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-unit" },
});
/** @type {__VLS_StyleScopedClasses['text-unit']} */ ;
(__VLS_ctx.unitLabel);
// @ts-ignore
[minVal, midVal, maxVal, unitLabel,];
const __VLS_export = (await import('vue')).defineComponent({
    props: {
        activeType: { type: String, default: 'vs' },
    },
});
export default {};
