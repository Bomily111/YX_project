import { computed } from 'vue';
const props = defineProps({ pkinfo: Array });
const pkinfoList = computed(() => props.pkinfo ?? []);
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
/** @type {__VLS_StyleScopedClasses['pkinfo-table']} */ ;
/** @type {__VLS_StyleScopedClasses['pkinfo-table']} */ ;
/** @type {__VLS_StyleScopedClasses['pkinfo-table']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "legend-panel pkinfo-detail-panel" },
});
/** @type {__VLS_StyleScopedClasses['legend-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['pkinfo-detail-panel']} */ ;
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
    ...{ class: "pkinfo-table" },
});
/** @type {__VLS_StyleScopedClasses['pkinfo-table']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
for (const [item, idx] of __VLS_vFor((__VLS_ctx.pkinfoList))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
        key: (idx),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    (idx + 1);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    (item.ZKWZ);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    (item.WCJ);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    (item.ZKCD);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    (item.DZQKJS);
    // @ts-ignore
    [pkinfoList,];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    props: { pkinfo: Array },
});
export default {};
