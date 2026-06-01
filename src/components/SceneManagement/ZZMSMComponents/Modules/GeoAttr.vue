<template>
  <div class="outer">
    <header class="head">
      <div class="title">
        <div class="flex">地质属性</div>
      </div>
      <div class="select">
        <select v-model="attr_selectedOption" @change="handleTunnelSelectChange">
          <option v-for="(item, key) in attr_options" :key="key" :value="item.value">{{ item.label }}</option>
        </select>
      </div>
    </header>
    <article class="article">
      <div class="middle" id="geoattr-graphic"></div>
    </article>
  </div>
</template>

<script setup>
import * as echarts from 'echarts';
import { onMounted, ref, computed, watch } from 'vue';
import store from '../store/index';
// 使用 ref 创建响应式引用
let chartDom = null;
let myChart = null;

// 初始化下拉框选项
const attr_options = ref([
  { label: '岩体完整状态', value: '岩体完整状态' },
  { label: '岩石强度(MPa)', value: '岩石强度(MPa)' },
  { label: '硬度', value: '硬度' },
  { label: '风化程度', value: '风化程度' },
  { label: '裂隙状态', value: '裂隙状态' },
  { label: '围岩级别', value: '围岩级别' },
  { label: '风险等级', value: '风险等级' },
]);
// 处理属性选择变化时的函数
const handleTunnelSelectChange = (value) => {
  console.log(lineChartoption.value);
};
// 设置默认选中的选项
const attr_selectedOption = ref(attr_options.value[0].value);
//中英文映射
const attrTypeMap = new Map([
  ['岩体完整状态', 'rockIntegrityState'],
  ['岩石强度(MPa)', 'rockStrength'],
  ['硬度', 'hardness'],
  ['风化程度', 'weatheringDegree'],
  ['裂隙状态', 'fissureState'],
  ['围岩级别', 'rockLevel'],
  ['风险等级', 'riskLevel'],
]);

/**
 * @description: 将里程转换为距离
 * @param {*} mileagename string
 * @return {*} 里程距离
 */
function parseMileageToDistance(mileagename) {
  const regex = /K(.*?)\+(.*)/i;
  const match = mileagename.match(regex);

  if (match) {
    const beforePlus = match[1]; // "K"之后，"+"之前的字符串
    const afterPlus = match[2]; // "+"之后的字符串
    return parseFloat(beforePlus) * 1000 + parseFloat(afterPlus);
  }
  return null; // 如果没有找到匹配项，返回null
}

const y_map = {
  岩体完整状态: new Map([
    ['完整', 0],
    ['较完整', 1],
    ['较破碎', 2],
    ['破碎', 3],
    ['极破碎', 4],
  ]),
  '岩石强度(MPa)': new Map([
    ['5<Rc≤15', 0],
    ['15<Rc≤30', 1],
    ['30<Rc≤60', 2],
    ['其它：>60', 3],
  ]),
  硬度: new Map([
    ['极软岩', 0],
    ['较软岩', 1],
    ['软岩', 2],
    ['硬岩', 3],
    ['极硬岩', 4],
  ]),
  风化程度: new Map([
    ['未风化', 0],
    ['弱风化', 1],
    ['弱风化夹强风化', 2],
    ['强风化', 3],
    ['强风化夹全风化', 4],
    ['全风化', 5],
  ]),
  裂隙状态: new Map([
    ['密闭', 0],
    ['无充填', 1],
    ['平直粗糙', 2],
    ['较发育', 3],
    ['发育', 4],
  ]),
  围岩级别: new Map([
    ['Ⅰ级', 0],
    ['Ⅱ级', 1],
    ['Ⅲ级', 2],
    ['Ⅳ级', 3],
    ['Ⅴ级', 4],
    ['Ⅵ级', 5],
  ]),
  风险等级: new Map([
    ['正常', 0],
    ['黄色预警', 1],
    ['红色预警', 2],
  ]),
};
/**
 * @description: 反转map
 * @param {*} map
 * @param {*} value
 * @return {*}
 */
function findKeyFromMapByValue(map, value) {
  for (let [key, val] of map) {
    if (val === value) {
      return key;
    }
  }
  return null; // 如果没有找到对应的键，则返回null
}

let x_data = computed(() => {
  let newArray = [];
  let labelmap = {};
  for (let item of store.state[attrTypeMap.get(attr_selectedOption.value)].mileage) {
    let diatance = parseMileageToDistance(item);
    newArray.push(diatance);
    labelmap[diatance] = item;
  }
  return { data: newArray, labelmap: labelmap };
});
let y_data = computed(() => {
  if (attr_selectedOption.value == '围岩级别') {
    let designArray = [];
    let adviseArray = [];
    for (let item of store.state[attrTypeMap.get(attr_selectedOption.value)].designValue) {
      designArray.push(y_map[attr_selectedOption.value].get(item));
    }
    for (let item of store.state[attrTypeMap.get(attr_selectedOption.value)].value) {
      adviseArray.push(y_map[attr_selectedOption.value].get(item));
    }
    return [designArray, adviseArray];
  } else if (attr_selectedOption.value == '风险等级') {
    let riskArray = [];
    let valueArray = store.state[attrTypeMap.get(attr_selectedOption.value)].value;
    let typeArray = store.state[attrTypeMap.get(attr_selectedOption.value)].type;
    for (let index = 0; index < valueArray.length; index++) {
      let point = {
        value: y_map[attr_selectedOption.value].get(valueArray[index]),
        risktype: typeArray[index],
      };
      riskArray.push(point);
    }
    return riskArray;
  }

  let newArray = [];
  for (let item of store.state[attrTypeMap.get(attr_selectedOption.value)].value) {
    newArray.push(y_map[attr_selectedOption.value].get(item));
  }
  return newArray;
});
let series_option = computed(() => {
  if (Array.isArray(y_data.value[0]) && y_data.value.length === 2) {
    return [
      {
        name: '设计围岩级别',
        type: 'line',
        smooth: true,
        // prettier-ignore
        data: y_data.value[0],
        lineStyle: {
          color: 'blue', // 设置线的颜色为红色
        },
      },
      {
        name: '建议围岩级别',
        type: 'line',
        smooth: true,
        // prettier-ignore
        data: y_data.value[1],
        lineStyle: {
          color: 'green', // 设置线的颜色为绿色
        },
      },
    ];
  }
  return [
    {
      name: attr_selectedOption.value,
      type: 'line',
      smooth: true,
      // prettier-ignore
      data: y_data.value,
    },
  ];
});
let legend_data = computed(() => {
  if (y_data.value.length == 2 && Array.isArray(y_data.value[0])) {
    return ['设计围岩级别', '建议围岩级别'];
  }
  return [attr_selectedOption.value];
});
let lineChartoption = computed(() => {
  return {
    // title: {
    //   text: '边坡位移监测',
    //   textStyle: {
    //     color: '#fff'
    //   }
    // },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
      },
      formatter: function (params) {
        // console.log(params)
        if (params.length == 2) {
          // 在这里可以使用params.data来访问额外属性
          return (
            x_data.value.labelmap[params[0].name] +
            '  设计围岩级别: ' +
            findKeyFromMapByValue(y_map[attr_selectedOption.value], params[0].value) +
            '<br>' +
            x_data.value.labelmap[params[1].name] +
            '  建议围岩级别: ' +
            findKeyFromMapByValue(y_map[attr_selectedOption.value], params[1].value) +
            '<br>'
          );
        } else if (attr_selectedOption.value == '风险等级') {
          return (
            x_data.value.labelmap[params[0].name] +
            '<br>' +
            attr_selectedOption.value +
            ': ' +
            findKeyFromMapByValue(y_map[attr_selectedOption.value], params[0].value) +
            '<br>' +
            '风险类别： <br>' +
            params[0].data.risktype
          );
        }

        return (
          x_data.value.labelmap[params[0].name] +
          '<br>' +
          attr_selectedOption.value +
          ':<br> ' +
          findKeyFromMapByValue(y_map[attr_selectedOption.value], params[0].value)
        );
      },
    },
    toolbox: {
      show: true,
      feature: {
        saveAsImage: {},
      },
    },
    grid: {
      x: 95,
      y: 40,
      x2: 20,
      y2: 40,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      axisLabel: {
        formatter: function (value, index) {
          // 数值映射
          let labelMap = x_data.value.labelmap;
          return labelMap[value] || value; // 如果找不到映射，则返回原始值
        },
        color: '#fff',
        textStyle: {
          fontSize: 9,
        },
      },
      // prettier-ignore
      data: x_data.value.data,
    },
    yAxis: {
      type: 'value',
      interval: 1,
      min: Math.ceil(0), // dataMin是数据中的最小值
      max: Math.floor(y_map[attr_selectedOption.value].size - 1),
      axisLabel: {
        formatter: function (value, index) {
          const map = y_map[attr_selectedOption.value];
          // 初始化一个数值映射对象
          const labelMap = {};
          // 遍历Map的条目，并交换键和值
          for (const [key1, value1] of map.entries()) {
            labelMap[value1] = key1; // 将原值作为键，原键作为值
          }
          return labelMap[value] !== undefined ? labelMap[value] : undefined; // 如果找不到映射，则返回原始值
        },
        color: '#fff',
      },
      axisPointer: {
        snap: true,
      },
    },
    visualMap: {
      show: false,
      dimension: 0,
      pieces: [
        {
          lte: 1.5,
          color: '#5ec9db',
        },
        {
          gt: 1.5,
          lte: 2.5,
          color: '#f27d51',
        },
        {
          gt: 2.5,
          lte: 3.5,
          color: '#5ec9db',
        },
        {
          gt: 3.5,
          lte: 4.5,
          color: '#f27d51',
        },
        {
          gt: 4.5,
          color: '#5ec9db',
        },
      ],
    },
    series: series_option.value,
    legend: {
      data: legend_data.value,
      textStyle: {
        color: '#fff',
      },
    },
  };
});

watch(
  lineChartoption,
  (newVal, oldVal) => {
    myChart.dispose();
    myChart = echarts.init(chartDom);
    lineChartoption.value && myChart.setOption(lineChartoption.value);
  },
  {
    deep: true, // 开启深度监听
  }
);
onMounted(() => {
  chartDom = document.getElementById('geoattr-graphic');
  myChart = echarts.init(chartDom);
  lineChartoption.value && myChart.setOption(lineChartoption.value);
});
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

    // padding-top: 0.1em;
    // padding-bottom: 0.1em;
    padding-left: 1em;
    border-radius: 0.8em 0 0;
    color: white;
    background: linear-gradient(to right, rgb($color-title-01, 1), 70%, rgba($color-title-01, 0));
  }

  .article {
    width: 100%;
    height: 14em;
    margin-top: 0.2em;
    padding: 0.5em;
    font-size: 16px;

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
  margin-left: 32%;

  select {
    width: 180px;
    height: 100%;

    // height: px;
    border-radius: 10px;

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
