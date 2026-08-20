import { computed } from 'vue';
const props = defineProps({ fdinfo: Array, dkname: String });
const fdinfoList = computed(() => props.fdinfo ?? []);
function formatEdkilo(edkilo, dkname) {
    if (edkilo == null || !dkname) {
        return '';
    }
    const num = Number(edkilo);
    if (isNaN(num)) {
        return '';
    }
    const km = Math.floor(num / 1000);
    const m = (num - km * 1000).toFixed(2).padStart(6, '0');
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
/** @type {__VLS_StyleScopedClasses['tsp-conclusion-table']} */ ;
/** @type {__VLS_StyleScopedClasses['tsp-conclusion-table']} */ ;
/** @type {__VLS_StyleScopedClasses['tsp-conclusion-table']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "legend-panel tsp-conclusion-panel" },
});
/** @type {__VLS_StyleScopedClasses['legend-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['tsp-conclusion-panel']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "legend-panel-head" },
});
/** @type {__VLS_StyleScopedClasses['legend-panel-head']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "legend-panel-scroll" },
});
/** @type {__VLS_StyleScopedClasses['legend-panel-scroll']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
    ...{ class: "tsp-conclusion-table" },
});
/** @type {__VLS_StyleScopedClasses['tsp-conclusion-table']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
for (const [item, idx] of __VLS_vFor((__VLS_ctx.fdinfoList))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
        key: (idx),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    (idx + 1);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    (__VLS_ctx.formatEdkilo(item.sdkilo, __VLS_ctx.dkname));
    __VLS_asFunctionalElement1(__VLS_intrinsics.br)({});
    (__VLS_ctx.formatEdkilo(item.edkilo, __VLS_ctx.dkname));
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    (item.jlresult);
    // @ts-ignore
    [fdinfoList, formatEdkilo, formatEdkilo, dkname, dkname,];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    props: { fdinfo: Array, dkname: String },
});
export default {};
