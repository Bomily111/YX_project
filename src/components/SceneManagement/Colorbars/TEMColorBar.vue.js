import { computed } from 'vue';
const props = defineProps({
    minValue: { type: Number, default: null },
    maxValue: { type: Number, default: null },
    unit: { type: String, default: '' },
});
const useActual = computed(() => props.minValue != null && props.maxValue != null);
const label1 = computed(() => (useActual.value ? String(Math.round(props.minValue)) : '0'));
const label2 = computed(() => useActual.value ? String(Math.round((props.minValue + props.maxValue) / 2)) : '50');
const label3 = computed(() => (useActual.value ? String(Math.round(props.maxValue)) : '100'));
const unitLabel = computed(() => useActual.value ? `电阻率/${props.unit}` : '电阻率/%');
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
    ...{ class: "text1" },
});
/** @type {__VLS_StyleScopedClasses['text1']} */ ;
(__VLS_ctx.label1);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text2" },
});
/** @type {__VLS_StyleScopedClasses['text2']} */ ;
(__VLS_ctx.label2);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text3" },
});
/** @type {__VLS_StyleScopedClasses['text3']} */ ;
(__VLS_ctx.label3);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text4" },
});
/** @type {__VLS_StyleScopedClasses['text4']} */ ;
(__VLS_ctx.unitLabel);
// @ts-ignore
[label1, label2, label3, unitLabel,];
const __VLS_export = (await import('vue')).defineComponent({
    props: {
        minValue: { type: Number, default: null },
        maxValue: { type: Number, default: null },
        unit: { type: String, default: '' },
    },
});
export default {};
