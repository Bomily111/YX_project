import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import * as echarts from 'echarts';
import store from '../store/index';
//中英文映射
const attrTypeMap = new Map([
    ['岩体完整状态', 'rockIntegrityState'],
    ['岩石强度(MPa)', 'rockStrength'],
    ['硬度', 'hardness'],
    ['风化程度', 'weatheringDegree'],
    ['裂隙状态', 'fissureState'],
    ['围岩级别', 'rockLevel'],
    ['风险等级', 'riskLevel']
]);
const attr_type_value = {
    "岩体完整状态": ["完整",
        "较完整",
        "较破碎",
        "破碎",
        "极破碎",
    ],
    "岩石强度(MPa)": ["5<Rc≤15",
        "15<Rc≤30",
        "30<Rc≤60",
        "其它：>60",
    ],
    "硬度": ["极软岩",
        "较软岩",
        "软岩",
        "硬岩",
        "极硬岩",
    ],
    "风化程度": ["未风化",
        "弱风化",
        "弱风化夹强风化",
        "强风化",
        "强风化夹全风化",
        "全风化",
    ],
    "裂隙状态": ["密闭",
        "无充填",
        "平直粗糙",
        "较发育",
        "发育",
    ],
    "围岩级别": [
        "Ⅰ级",
        "Ⅱ级",
        "Ⅲ级",
        "Ⅵ级",
        "Ⅴ级",
        "Ⅳ级"
    ],
    "风险等级": [
        "正常",
        "黄色预警",
        "红色预警",
    ]
};
// 初始化下拉框选项
const attr_options = ref([
    { label: '岩体完整状态', value: '岩体完整状态' },
    { label: '岩石强度(MPa)', value: '岩石强度(MPa)' },
    { label: '硬度', value: '硬度' },
    { label: '风化程度', value: '风化程度' },
    { label: '裂隙状态', value: '裂隙状态' },
    { label: '围岩级别', value: '围岩级别' },
    { label: '风险等级', value: '风险等级' }
]);
// 设置默认选中的选项
const attr_selectedOption = ref(attr_options.value[0].value);
// {内容:出现次数}格式
const category_statistic = computed(() => {
    let count_result_obj = countOccurrences(store.state[attrTypeMap.get(attr_selectedOption.value)].value);
    let attr_typevalue_arr = attr_type_value[attr_selectedOption.value];
    let data = {};
    for (let type_value of attr_typevalue_arr) {
        if (Object.prototype.hasOwnProperty.call(count_result_obj, type_value)) {
            data[type_value] = count_result_obj[type_value];
        }
        else {
            data[type_value] = 0;
        }
    }
    return data;
});
/**
 * @description: 统计数组array中的内容出现的次数，并以{内容:出现次数}的对象格式返回
 * @param {*} array
 * @return {*}
 */
function countOccurrences(array) {
    return array.reduce((acc, curr) => {
        // 如果当前元素已经在累加器中，则增加其计数  
        if (acc[curr]) {
            acc[curr]++;
        }
        // 如果当前元素不在累加器中，则初始化其计数为1  
        else {
            acc[curr] = 1;
        }
        return acc;
    }, {}); // 初始累加器为一个空对象  
}
// 直方图
let barChartDom = null;
let myBarChart = null;
let statistic_bar_option = computed(() => {
    return {
        xAxis: {
            type: 'category',
            data: Object.keys(category_statistic.value)
        },
        yAxis: {
            type: 'value'
        },
        series: [
            {
                name: attr_selectedOption.value,
                type: 'bar',
                color: ['#00e6e6'],
                data: Object.values(category_statistic.value)
            }
        ],
        legend: {
            textStyle: {
                color: "#fff"
            }
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow'
            },
            formatter: function (params) {
                return params[0].seriesName + "<br>" + params[0].name + "  : " + params[0].value;
            }
        },
    };
});
// 饼图
let pieChartDom = null;
let myPieChart = null;
let pieData = computed(() => {
    let Data = [];
    for (let key of Object.keys(category_statistic.value)) {
        Data.push({
            name: key,
            value: category_statistic.value[key]
        });
    }
    return Data;
});
let statistic_pie_option = computed(() => {
    return {
        title: {
            text: attr_selectedOption.value,
            right: '21%',
            textStyle: {
                color: "#fff"
            }
        },
        tooltip: {
            trigger: 'item'
        },
        legend: {
            orient: 'vertical',
            left: 'left',
            textStyle: {
                color: "#fff"
            }
        },
        series: [
            {
                name: attr_selectedOption.value,
                type: 'pie',
                avoidLabelOverlap: false,
                radius: '65%',
                center: ['60%', '50%'],
                label: {
                    show: false,
                    position: 'center'
                },
                data: pieData.value,
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                }
            }
        ]
    };
});
watch([
    () => statistic_bar_option,
    () => statistic_pie_option
], ([new_barVal, new_pieVal], [old_barVal, old_pieVal]) => {
    myBarChart.dispose();
    myPieChart.dispose();
    // 直方图
    myBarChart = echarts.init(barChartDom);
    statistic_bar_option.value && myBarChart.setOption(statistic_bar_option.value);
    // 饼图
    myPieChart = echarts.init(pieChartDom);
    statistic_pie_option.value && myPieChart.setOption(statistic_pie_option.value);
}, { deep: true });
onMounted((() => {
    // 直方图
    barChartDom = document.getElementById('statistic-bar-graphic');
    myBarChart = echarts.init(barChartDom);
    statistic_bar_option.value && myBarChart.setOption(statistic_bar_option.value);
    // 饼图
    pieChartDom = document.getElementById('statistic-pie-graphic');
    myPieChart = echarts.init(pieChartDom);
    statistic_pie_option.value && myPieChart.setOption(statistic_pie_option.value);
}));
const __VLS_ctx = {
    ...{},
    ...{},
};
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
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "title" },
});
/** @type {__VLS_StyleScopedClasses['title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "select" },
});
/** @type {__VLS_StyleScopedClasses['select']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: (__VLS_ctx.handleTunnelSelectChange) },
    value: (__VLS_ctx.attr_selectedOption),
});
for (const [item, key] of __VLS_vFor((__VLS_ctx.attr_options))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (key),
        value: (item.value),
    });
    (item.label);
    // @ts-ignore
    [handleTunnelSelectChange, attr_selectedOption, attr_options,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
    ...{ class: "article" },
});
/** @type {__VLS_StyleScopedClasses['article']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "middle" },
    id: "statistic-bar-graphic",
});
/** @type {__VLS_StyleScopedClasses['middle']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "split-line" },
});
/** @type {__VLS_StyleScopedClasses['split-line']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "middle" },
    id: "statistic-pie-graphic",
});
/** @type {__VLS_StyleScopedClasses['middle']} */ ;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
