<!--
 * @Date: 2024-04-02 14:32:40
 * @LastEditors: xingxu-webgis 1833104160@qq.com
 * @LastEditTime: 2024-04-17 13:23:41
 * @FilePath: \Geology-v3_old\src\views\SceneManagement\ConstructionSurfaceGeoModel\Component\ZZMSMComponents\Modules\Statistic.vue
-->
<template>
	<div class="outer">
		<header class="head">
			<div class="title">
				<div class="flex">
					属性统计
				</div>
			</div>

			<div class="select">
				<select v-model="attr_selectedOption" @change="handleTunnelSelectChange">
					<option v-for="(item, key) in attr_options" :key="key" :value="item.value">{{ item.label }}</option>
				</select>
			</div>
		</header>
		<article class="article">
			<div class="middle" id="statistic-bar-graphic"></div>
			<div class="split-line"></div>
			<div class="middle" id="statistic-pie-graphic"></div>
		</article>
	</div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import * as echarts from 'echarts';
import store from '../store/index'


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
	"岩体完整状态":
		["完整",
			"较完整",
			"较破碎",
			"破碎",
			"极破碎",
		],
	"岩石强度(MPa)":
		["5<Rc≤15",
			"15<Rc≤30",
			"30<Rc≤60",
			"其它：>60",
		],
	"硬度":
		["极软岩",
			"较软岩",
			"软岩",
			"硬岩",
			"极硬岩",
		],
	"风化程度":
		["未风化",
			"弱风化",
			"弱风化夹强风化",
			"强风化",
			"强风化夹全风化",
			"全风化",
		],
	"裂隙状态":
		["密闭",
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
	let count_result_obj = countOccurrences(store.state[attrTypeMap.get(attr_selectedOption.value)].value)
	let attr_typevalue_arr = attr_type_value[attr_selectedOption.value]
	let data = {}
	for (let type_value of attr_typevalue_arr) {
		if (Object.prototype.hasOwnProperty.call(count_result_obj, type_value)) {
			data[type_value] = count_result_obj[type_value]
		}
		else {
			data[type_value] = 0
		}
	}
	return data

})
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
let myBarChart = null
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
				return params[0].seriesName + "<br>" + params[0].name + "  : " + params[0].value
			}
		},
	}
});

// 饼图
let pieChartDom = null;
let myPieChart = null
let pieData = computed(() => {
	let Data = []
	for (let key of Object.keys(category_statistic.value)) {
		Data.push({
			name: key,
			value: category_statistic.value[key]
		})
	}
	return Data
})
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
	}
});

watch([
	() => statistic_bar_option,
	() => statistic_pie_option
], ([new_barVal, new_pieVal], [old_barVal, old_pieVal]) => {
	myBarChart.dispose()
	myPieChart.dispose()
	// 直方图
	myBarChart = echarts.init(barChartDom);
	statistic_bar_option.value && myBarChart.setOption(statistic_bar_option.value);

	// 饼图
	myPieChart = echarts.init(pieChartDom);
	statistic_pie_option.value && myPieChart.setOption(statistic_pie_option.value);

}, { deep: true })

onMounted((() => {
	// 直方图
	barChartDom = document.getElementById('statistic-bar-graphic');
	myBarChart = echarts.init(barChartDom);
	statistic_bar_option.value && myBarChart.setOption(statistic_bar_option.value);

	// 饼图
	pieChartDom = document.getElementById('statistic-pie-graphic');
	myPieChart = echarts.init(pieChartDom);
	statistic_pie_option.value && myPieChart.setOption(statistic_pie_option.value);
}))

</script>

<style scoped lang="scss">
@import '@/assets/styles/variables';

.outer {
	width: 100%;

	// padding: 0.5em;
	font-size: 16px;

	.head {
		width: 100%;
		height: 2em;

		// margin-bottom: 0.5em;
		// padding-top: 0.3em;
		padding-left: 1em;
		border-radius: 0.8em 0 0;
		color: white;
		font-size: 18px;
		font-weight: 600;
		white-space: 1em;
		background: linear-gradient(to right, rgb($color-title-01, 1), 80%, rgba($color-title-01, 0));
	}


	.article {
		width: 100%;

		// height: 24em;
		margin-top: 0.2em;
		padding: 0.5em;
		font-size: 16px;

		.split-line {
			width: 100%;
			height: 1px;
			margin-bottom: 10px;
			background: linear-gradient(to right, rgb(255 255 255 / 0%), rgb(255 255 255 / 40%), rgb(255 255 255 / 0%));
		}

		.middle {
			width: 100%;
			height: 14em;
		}
	}
}


.title {
	display: inline-block;
	height: 100%;
	padding-right: 20px;
	font-size: 18px;
	font-weight: 600;
	white-space: 1em;

	.flex {
		display: flex;
		height: 100%;
		align-items: center;
	}
}

.select {
	display: inline-block;
  position: relative;
	top: -2px;
  z-index: 100;
  height: 100%;
  margin-left: 11%;

	select {
		width: 180px;
		height: 100%;
		border-radius: 10px;
		/* stylelint-disable-next-line scss/double-slash-comment-empty-line-before */
		// border-color: #033355;
		border: none;
		color: white;
		font-size: 14px;
		text-align: center;
		background-color: rgb(50 69 139);

		option {
			font-size: 15px;
			text-align: center;
		}
	}
}
</style>
