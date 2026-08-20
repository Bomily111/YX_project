import { computed } from 'vue';
const props = defineProps({ row: Object });
const tableData = computed(() => [
    { label: '钻孔编号', value: props.row?.value?.kwinfo?.[0]?.kwbh ?? '' },
    { label: '孔口里程', value: props.row?.value?.['施工里程'] ?? '' },
    { label: '层底里程', value: formatEdkilo(props.row?.value?.fdinfo?.[0]?.edkilo, props.row?.value?.dkname) },
    { label: '长度(m)', value: props.row?.value?.length ?? '' },
    { label: '立角', value: props.row?.value?.kwinfo?.[0]?.kwljangle ?? '' },
    { label: '偏角', value: props.row?.value?.kwinfo?.[0]?.kwpjangle ?? '' },
    { label: '出水量(m³/h)', value: props.row?.value?.kwinfo?.[0]?.dcinfo?.[0]?.csl ?? '' },
    { label: '孔径(mm)', value: props.row?.value?.kwinfo?.[0]?.zkzj ?? '' },
    { label: '探测结论', value: props.row?.value?.conclusionyb ?? '' },
]);
function formatEdkilo(edkilo, dkname) {
    if (edkilo == null || !dkname) {
        return '';
    }
    const num = Number(edkilo);
    if (isNaN(num)) {
        return '';
    }
    const km = Math.floor(num / 1000);
    const m = (num - km * 1000).toFixed(2).padStart(6, '0'); // 保留两位小数，自动补零
    return `${dkname}${km}+${m}`;
}
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['legend-panel-scroll']} */ ;
/** @type {__VLS_StyleScopedClasses['legend-panel-scroll']} */ ;
/** @type {__VLS_StyleScopedClasses['legend-panel-scroll']} */ ;
/** @type {__VLS_StyleScopedClasses['legend-panel-scroll']} */ ;
/** @type {__VLS_StyleScopedClasses['legend-panel-scroll']} */ ;
/** @type {__VLS_StyleScopedClasses['legend-panel-scroll']} */ ;
/** @type {__VLS_StyleScopedClasses['legend-panel-scroll']} */ ;
/** @type {__VLS_StyleScopedClasses['legend-panel-scroll']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "legend-panel" },
});
/** @type {__VLS_StyleScopedClasses['legend-panel']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "legend-panel-head" },
});
/** @type {__VLS_StyleScopedClasses['legend-panel-head']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('close');
            // @ts-ignore
            [$emit,];
        } },
    ...{ class: "legend-close" },
});
/** @type {__VLS_StyleScopedClasses['legend-close']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "legend-close-x" },
});
/** @type {__VLS_StyleScopedClasses['legend-close-x']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "legend-panel-scroll" },
});
/** @type {__VLS_StyleScopedClasses['legend-panel-scroll']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "legend-th" },
});
/** @type {__VLS_StyleScopedClasses['legend-th']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "legend-th" },
});
/** @type {__VLS_StyleScopedClasses['legend-th']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
for (const [item] of __VLS_vFor((__VLS_ctx.tableData))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
        key: (item.label),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "legend-label" },
    });
    /** @type {__VLS_StyleScopedClasses['legend-label']} */ ;
    (item.label);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "legend-value" },
    });
    /** @type {__VLS_StyleScopedClasses['legend-value']} */ ;
    (item.value);
    // @ts-ignore
    [tableData,];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    props: { row: Object },
});
export default {};
