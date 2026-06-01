<!--
 * @Author: LNX222
 * @Date: 2025-06-30 15:04:00
 * @LastEditors: LNX222
 * @LastEditTime: 2025-06-30 15:04:00
 * @FilePath: Geology-v3\src\views\SceneManagement\ConstructionSurfaceGeoModel\Component\AHDComponents\AHD.vue
-->

<template>
  <div>
    <div class="left">
      <section class="section">
        <MileageSelectZZM
          v-if="showGraphZZM"
          :Points="PointsZZM"
          :tunnel_options="tunnel_optionsZZM"
          :tunnel_selected="tunnel_selectedZZM"
          :tunnelType="'ZZM'"
          :targetMileage="highlightMileageZZM"
          @changeTunnel="changeTunnel"
          @selectRow="handleSelectRow('ZZM', $event)"
        ></MileageSelectZZM>
      </section>
      <section class="section">
        <MileageSelectBLDZ
          v-if="showGraphBLDZ"
          :Points="PointsBLDZ"
          :tunnel_options="tunnel_optionsBLDZ"
          :tunnel_selected="tunnel_selectedBLDZ"
          :tunnelType = "'BLDZ'"
          @changeTunnel="changeTunnel"
          @selectRow="handleSelectRow('BLDZ', $event)"
        ></MileageSelectBLDZ>
      </section>
    </div>
    <!-- 右侧面板 -->
    <div class="right-panel" v-if="selectedRowZZM">
      <Panel v-if="showPanel" :row="selectedRowZZM" @close="showPanel = false" />
    </div>
    <!-- 色标图例 -->
    <WaterColorBar v-if="(selectedRowBLDZ || bldzModelLoadedDirectly) && tunnel_selectedBLDZ === '富水带'" />
    <POSUIColorBar v-if="(selectedRowBLDZ || bldzModelLoadedDirectly) && tunnel_selectedBLDZ === '破碎带'" />
  </div>
</template>

<script setup>
import { watch, defineProps, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { DTScopeEngine } from '@/utils/Common/Viewer';
import MileageSelectZZM from './Modules/MileageSelect_ZZM.vue';
import MileageSelectBLDZ from './Modules/MileageSelect_BLDZ.vue';
import Panel from './Modules/panel.vue'; // 新增：引入Panel组件
import WaterColorBar from '../Colorbars/WaterColorBar.vue';
import POSUIColorBar from '../Colorbars/POSUIColorBar.vue';
// import store from './store/index' // 如有全局状态管理可打开
import AppConfig from '@/config/AppConfig';
//@ts-ignore
import * as Cesium from 'Cesium';
import AllLine from '../ZZMSMComponents/D3K278+100.000~DK300+800.000.json';

let { zzsmImage } = new AppConfig().appConfig;

const props = defineProps({
  value: {
    type: String,
    default: '', // 默认值
  },
});
let PointsZZM = ref([]);
let PointsBLDZ = ref([]);
let tunnel_optionsZZM = reactive([]);
let tunnel_selectedZZM = ref('掌子面素描'); //里程选择默认加载
let tunnel_optionsBLDZ = reactive([]);
let tunnel_selectedBLDZ = ref(props.value); //里程选择默认加载
let showGraphZZM = ref(false);
let showGraphBLDZ = ref(false);
let selectedRowZZM = ref(null); // 新增：保存当前选中的里程
let selectedRowBLDZ = ref(null); // 新增：保存当前选中的里程
let showPanel = ref(false); // 控制面板显示的变量
let highlightMileageZZM = ref(null); // 新增：高亮显示的里程
let bldzModelLoadedDirectly = ref(false); // 无里程数据时直接加载模型的标志

//监听不良地质的按钮的变化
watch(() => props.value, (newVal) => {
  tunnel_selectedBLDZ.value = newVal;
});

console.log('BLDZ组件的值:', props.value);
function changeTunnel(tunnel, tunnelType) {
  if (tunnelType === 'ZZM') {
    showGraphZZM.value = false;
    tunnel_selectedZZM.value = tunnel;
    show(tunnel, tunnelType);
  } else if (tunnelType === 'BLDZ') {
    showGraphBLDZ.value = false;
		tunnel_selectedBLDZ.value = tunnel;
    show(tunnel, tunnelType);
  } else {
    console.warn('未知的隧道类型:', tunnelType);
  }
}

function handleSelectRow(type, row) {
  if (type === 'ZZM') {
    showPanel.value = true;
    selectedRowZZM.value = row;
  } else {
    showPanel.value = false;
    selectedRowBLDZ.value = row;
    console.log('选中的BLDZ行:', row);
    highlightMileageZZM.value = row.mileage; 
    console.log('高亮显示的里程:', highlightMileageZZM.value);
  }
} // 选中行后显示面板

// 加载数据
function show(tunnel, tunnelType) {
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
        if (tunnelType === 'ZZM') {
          PointsZZM.value = data.data;
        } else if (tunnelType === 'BLDZ') {
          PointsBLDZ.value = data.data;
        }
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
            if (tunnelType === 'ZZM') {
              tunnel_optionsZZM.length = 0;
              for (let i = 0; i < data.data.length; i++) {
                tunnel_optionsZZM.push({ label: data.data[i], value: data.data[i] });
              }
              showGraphZZM.value = true;
            } else if (tunnelType === 'BLDZ') {
              tunnel_optionsBLDZ.length = 0;
              for (let i = 0; i < data.data.length; i++) {
                tunnel_optionsBLDZ.push({ label: data.data[i], value: data.data[i] });
              }
              showGraphBLDZ.value = true;
            }
          })
          .catch((error) => {
            console.error('There was a problem with the fetch operation:', error);
          });
      })
      .catch(() => {
        // 后端无该模块数据时，体数据已由 activateGeoModel 加载（含相机设置）
        // 此处仅标记 UI 色标显示状态，不重复加载/不重置相机
        if (tunnelType === 'BLDZ') {
          bldzModelLoadedDirectly.value = true;
        }
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
  show(tunnel_selectedZZM.value, 'ZZM');
  show(tunnel_selectedBLDZ.value, 'BLDZ');
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
