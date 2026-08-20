import { computed } from 'vue';
const props = defineProps({ row: Object });
const field = [
    { label: '开挖宽度', key: 'dzsm_kwkd' },
    { label: '开挖高度', key: 'dzsm_kwgd' },
    { label: '开挖面积', key: 'dzsm_kwmj' },
    { label: '掌子面状态', key: 'dzsm_zzmzt' },
    { label: '地质构造应力状态', key: 'dzgzyl' },
    { label: '探测结论', key: 'dzsm_zzmms' },
];
console.log('props.row', props.row);
const tableData = computed(() => {
    const attr = props.row?.value ?? {};
    return field.map(({ label, key }) => ({
        label,
        value: attr[key] ?? '无',
    }));
});
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
