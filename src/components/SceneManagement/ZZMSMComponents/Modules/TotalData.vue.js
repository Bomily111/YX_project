import * as echarts from 'echarts';
import { onMounted } from 'vue';
let option;
option = {
    tooltip: {
        trigger: 'item',
    },
    legend: {
        right: 0,
        left: 'center',
        // top: 'center',
        // orient: 'vertical',
        orient: 'horizontal',
        itemWidth: 4,
        itemHeight: 8,
        textStyle: {
            color: '#fff',
            fontSize: 10,
        },
    },
    series: [
        {
            name: '数据总量',
            type: 'pie',
            radius: ['40%', '64%'],
            center: ['50%', '50%'],
            avoidLabelOverlap: false,
            itemStyle: {
                borderRadius: 5,
            },
            label: {
                show: false,
                position: 'center',
            },
            // emphasis: {
            //   label: {
            //     show: true,
            //     fontSize: 12,
            //     fontWeight: 'bold'
            //   }
            // },
            data: [
                { value: 38775, name: '钻爆法', itemStyle: { color: '#91cc75' } },
                { value: 1363, name: 'TBM', itemStyle: { color: '#e66' } },
            ],
        },
    ],
};
onMounted(() => {
    let chartDom = document.getElementById('data-total');
    let myChart = echarts.init(chartDom);
    option && myChart.setOption(option);
});
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "outer" },
});
/** @type {__VLS_StyleScopedClasses['outer']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
    ...{ class: "head" },
});
/** @type {__VLS_StyleScopedClasses['head']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
    ...{ class: "article" },
});
/** @type {__VLS_StyleScopedClasses['article']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "descript" },
});
/** @type {__VLS_StyleScopedClasses['descript']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "nums-title" },
});
/** @type {__VLS_StyleScopedClasses['nums-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
let __VLS_0;
/** @ts-ignore @type {typeof __VLS_components.sapn | typeof __VLS_components.Sapn | typeof __VLS_components.sapn | typeof __VLS_components.Sapn} */
sapn;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ class: "nums-data" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "nums-data" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['nums-data']} */ ;
const { default: __VLS_5 } = __VLS_3.slots;
var __VLS_3;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "split-line" },
});
/** @type {__VLS_StyleScopedClasses['split-line']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "total" },
    id: "data-total",
});
/** @type {__VLS_StyleScopedClasses['total']} */ ;
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
