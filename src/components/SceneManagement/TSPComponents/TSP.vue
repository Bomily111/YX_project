<!--
 * @Author: LNX222
 * @Date: 2025-07-01 11:03:00
 * @LastEditors: LNX222
 * @LastEditTime: 2025-07-01 11:03:00
 * @FilePath: Geology-v3\src\views\SceneManagement\ConstructionSurfaceGeoModel\Component\TSPComponents\TSP.vue
-->

<template>
  <div>
    <div class="left">
      <section class="section">
        <MileageSelect
          v-if="showGraph"
          :Points="Points"
          :tunnel_options="tunnel_options"
          :tunnel_selected="tunnel_selected"
          @changeTunnel="changeTunnel"
          @selectRow="handleSelectRow"
        ></MileageSelect>
      </section>
      <section class="section">
        
      </section>
    </div>
    <!-- 右侧面板 -->
    <div class="right-panel" v-if="selectedRow">
      <!-- TSP反演面板 -->
      <Panel v-if="showPanel" :row="selectedRow" @close="showPanel = false" />
      <!-- 结论面板 -->
      <TSPConclusionPanel :fdinfo="selectedRow?.value?.fdinfo" :dkname="selectedRow?.value?.dkname" />
    </div>
    <!-- VP / VS / 弹性模量 切换器 -->
    <TSPModelSelector v-if="modelLoadedDirectly" @change="onTypeChange" />
    <!-- 色标图例 -->
    <TSPColorBar v-if="modelLoadedDirectly" :activeType="activeType" />
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { DTScopeEngine } from '@/utils/Common/Viewer';
import MileageSelect from '../DZLDComponents/Modules/MileageSelect_D.vue';
import Panel from './Modules/panel.vue';
import TSPConclusionPanel from './Modules/TSPConclusionPanel.vue';
import TSPModelSelector from './Modules/TSPModelSelector.vue';
import TSPColorBar from '../Colorbars/TSPColorBar.vue';
import AppConfig from '@/config/AppConfig';
// @ts-ignore
import { switchTSPLayer } from '@/utils/Common/GeoModelController';
//@ts-ignore
import * as Cesium from 'Cesium';
import AllLine from '../ZZMSMComponents/D3K278+100.000~DK300+800.000.json';

let { zzsmImage } = new AppConfig().appConfig;

let Points = ref([]);
let tunnel_options = reactive([]);
let tunnel_selected = ref('TSP反演'); //里程选择默认加载
let showGraph = ref(false);
let selectedRow = ref(null); // 新增：保存当前选中的里程
let showPanel = ref(false);
let showConclusionPanel = ref(false);
let modelLoadedDirectly = ref(false); // 无里程数据时直接加载模型的标志
let activeType = ref('vs'); // 当前显示的模型类型：vp / vs / e

function changeTunnel(tunnel) {
  showGraph.value = false;
  tunnel_selected.value = tunnel;
  show(tunnel);
}

function handleSelectRow(row) {
  selectedRow.value = row;
  showPanel.value = true;
  showConclusionPanel.value = true;
}

function onTypeChange(type) {
  activeType.value = type;
  switchTSPLayer(type);
}

// 加载数据
function show(tunnel) {
  DTScopeEngine.getViewer(() => {
    // 设置请求参数
    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'attribute',
        tunnelname: tunnel,
        // 里程范围可根据实际需求调整
        mileage_range: ['D3K278+100.00', 'D2K999+999.00'],
      }),
    };
    fetch(zzsmImage + '/geodata/acquire', requestOptions)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then((data) => {
        Points.value = data.data;
        // 如有属性统计、图表等，可在此处理
        // 例如：store.commit('SET_XXX', ...)
        // ...
        // 获取隧道列表
        fetch(zzsmImage + '/geodata/allCollention')
          .then((res) => {
            if (!res.ok) {
              throw new Error('Network response was not ok');
            }
            return res.json();
          })
          .then((data) => {
            tunnel_options.length = 0;
            for (let i = 0; i < data.data.length; i++) {
              tunnel_options.push({ label: data.data[i], value: data.data[i] });
            }
            showGraph.value = true;
          })
          .catch((error) => {
            console.error('There was a problem with the fetch operation:', error);
          });
      })
      .catch(() => {
        // 后端无该模块数据时，体数据已由 activateGeoModel 加载（含相机设置）
        // 此处仅标记 UI 状态，不重复加载/不重置相机
        activeType.value = 'vs';
        modelLoadedDirectly.value = true;
      });
  });
}

let allLineEntity = null;
function loadAllLine() {
  DTScopeEngine.getViewer(() => {
    const viewer = DTScopeEngine.viewer;
    const coordinates = AllLine.features[0].geometry.coordinates;

    // 转换为三维坐标（包含高程）
    const positions = coordinates.map((point) =>
      Cesium.Cartesian3.fromDegrees(
        point[0], // 经度
        point[1], // 纬度
        point[2] // 高程（单位：米）
      )
    );

    // 移除旧实体（如果存在）
    if (allLineEntity) {
      viewer.entities.remove(allLineEntity);
    }

    // 创建三维折线实体
    allLineEntity = viewer.entities.add({
      polyline: {
        positions: positions,
        width: 5,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.2,
          color: Cesium.Color.YELLOW.withAlpha(0.8),
        }),
        clampToGround: false, // 禁用贴地，启用三维空间显示
      },
    });

    // 自动缩放到线路范围
    viewer.zoomTo(allLineEntity);
  });
}
function deleteAllLine() {
  DTScopeEngine.getViewer(() => {
    const viewer = DTScopeEngine.viewer;
    viewer.entities.remove(allLineEntity);
  });
}

onMounted(() => {
  show(tunnel_selected.value);
});

onBeforeUnmount(() => {
});
</script>

<style scoped lang="scss">
.left {
  position: absolute;
  top: 75px;
  left: 310px;
  width: 320px;
  overflow: visible;

  .section {
    width: 131%;
    margin-top: 0.5em;
    border-radius: 0.8em;
    overflow: visible;
    background-color: #222c36;
  }
}

.right-panel {
  position: absolute;
  top: 65px;
  right: 40px;
  width: 400px;
  height: 300px;
  padding: 16px;
  border-radius: 8px;
  background: transparent;
}
</style>
