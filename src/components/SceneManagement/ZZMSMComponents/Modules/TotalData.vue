<!--
 * @Author: anganao
 * @Date: 2024-01-04 14:25:57
 * @LastEditors: xingxu-webgis 1833104160@qq.com
 * @LastEditTime: 2024-04-17 12:15:46
 * @FilePath: \Geology-v3_old\src\views\SceneManagement\ConstructionSurfaceGeoModel\Component\ZZMSMComponents\Modules\TotalData.vue
 * @Description: 
 * Copyright (c) 2024 by VGE, All Rights Reserved. 
-->
<template>
  <div class="outer">
    <header class="head">数据总览</header>
    <article class="article">
      <div class="descript">
        <div class="nums-title">数据总量</div>
        <div><sapn class="nums-data">40138</sapn></div>
        <div><span>条</span></div>
      </div>
      <div class="split-line"></div>
      <div class="total" id="data-total"></div>
    </article>
  </div>
</template>

<script setup>
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
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables';

.outer {
  width: 100%;

  // padding: 0.5em;
  overflow: visible;
  font-size: 16px;

  .head {
    width: 100%;
    height: 2em;
    margin-bottom: 0.5em;
    padding-top: 0.3em;
    padding-left: 1em;
    border-radius: 0.8em 0 0;
    color: white;
    font-size: 18px;
    font-weight: 600;
    white-space: 1em;
    background: linear-gradient(to right, rgb($color-title-01, 1), 40%, rgba($color-title-01, 0));
  }

  .article {
    // display: flex;
    width: 100%;
    height: 300px;
    padding: 0.5em;
    overflow: visible;
    font-size: 16px;

    .descript {
      width: 100%;
      height: calc(40% - 1px);
      color: white;

      div {
        text-align: center;

        .nums-data {
          color: $color-03;
          font-size: 2.6em;
        }
      }

      // .nums-title {
      //   margin-top: 0.5em;
      // }
    }

    .split-line {
      width: 100%;
      height: 1px;
      margin-bottom: 10px;
      background: linear-gradient(to right, rgb(255 255 255 / 0%), rgb(255 255 255 / 40%), rgb(255 255 255 / 0%));
    }

    .total {
      display: flex;
      width: 100%;
      height: 60%;
      overflow: visible;
      flex-direction: column;
      justify-content: center;
      align-items: center; /* 居中饼图 */
    }
  }
}
</style>
