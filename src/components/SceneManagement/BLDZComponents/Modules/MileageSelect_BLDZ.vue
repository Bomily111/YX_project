<!--
 * @Author: LNX222
 * @Date: 2025-06-30 18:06:00
 * @LastEditors: LNX222
 * @LastEditTime: 2025-06-30 18:06:00
 * @FilePath: Geology-v3\src\views\SceneManagement\ConstructionSurfaceGeoModel\Component\DBHComponents\Modules\MileageSelect_DBH.vue
-->
<template>
  <div>
    <div class="outer">
      <header class="head">
        <div class="title">
          <div class="flex">里程选择</div>
        </div>
        <div class="tunnel_select">
          <select v-model="tunnel_selectedOption" @change="handleTunnelSelectChange" >
            <!-- <option v-for="(item, key) in props.tunnel_options" :key="key" :value="item.value">{{ item.label }}</option> -->
						<option >{{ props.tunnel_selected }}</option>
          </select>
        </div>
      </header>
      <article class="article">
        <div class="middle">
          <div class="el_table">
            <el-table :data="currentPageData" class="el_row_content" @selection-change="selectChange">
              <el-table-column type="selection" width="55"> </el-table-column>
              <el-table-column prop="mileage" label="线路里程"></el-table-column>
              <el-table-column fixed="right" label="操作" width="120">
                <template #default="scope">
                  <el-button link type="primary" @click.prevent="lookAtTo(scope.row)"> 定位 </el-button>
                </template>
              </el-table-column>
              <!-- 其他列如果需要可以继续添加 -->
            </el-table>
            <el-pagination
              class="el_page"
              @size-change="handleSizeChange"
              @current-change="handleCurrentChange"
              :current-page="currentPage"
              :background="background"
              :page-sizes="[5, 10, 20, 30, 3000]"
              :page-size="pageSize"
              layout="total, sizes, prev, pager, next, jumper"
              :total="totalData"
            >
            </el-pagination>
          </div>
        </div>
      </article>
    </div>
    <!-- <Panel v-if="selectedRow" :row="selectedRow" /> -->
  </div>
</template>

<script setup>
import * as echarts from 'echarts';
import { onMounted, ref, reactive, computed, watch, defineEmits, nextTick, onUnmounted } from 'vue';
import { DTScopeEngine } from '@/utils/Common/Viewer';
import * as turf from '@turf/turf';

import AppConfig from '@/config/AppConfig';
import AllLine from '../../ZZMSMComponents/D3K278+100.000~DK300+800.000.json';
import { ipServer } from '@/utils/ServiceProperties';
import Previous from '@/utils/AllPrevious';

let pre = undefined;
let selectedVoxelType = ref('vp');
let { zzsmImage } = new AppConfig().appConfig;
let highlightLineEntities = reactive({}); // 以里程为 key，value 为高亮线实体

// 定义接收的 地质属性信息props
const props = defineProps({
  Points: {
    type: Array,
    required: true,
  },
  tunnel_options: {
    // 初始化下拉框选项
    type: Array,
    required: true,
  },
  tunnel_selected: {
    type: String,
    required: true,
  },
  tunnelType: {
    type: String,
    default: 'BLDZ', // 默认隧道类型
  },
});

const emit = defineEmits(['changeTunnel', 'selectRow']);

// 处理隧道选择变化时的函数
const handleTunnelSelectChange = (value) => {
  DTScopeEngine.getViewer(() => {
    let viewer = DTScopeEngine.viewer;
    //移除数据
    for (let key of Object.keys(loadedAllPointEntities)) {
      viewer.entities.remove(loadedAllPointEntities[key]['entity']);
      viewer.entities.remove(loadedAllPointEntities[key]['lineEntity']);
      viewer.entities.remove(loadedAllPointEntities[key]['labelEntity']);
      // 新增：移除高亮线
      if (loadedAllPointEntities[key]['highlightLineEntity']) {
        viewer.entities.remove(loadedAllPointEntities[key]['highlightLineEntity']);
      }
      delete loadedAllPointEntities[key];
    }
    if (tunnelLineEntity.length != 0) {
      tunnelLineEntity.forEach((tlEntity) => {
        viewer.entities.remove(tlEntity);
      });
      tunnelLineEntity = [];
    }
  });
  emit('changeTunnel', tunnel_selectedOption.value, props.tunnelType); 
};
// 设置默认选中的选项
const tunnel_selectedOption = ref(props.tunnel_selected);
console.log('隧道选择', tunnel_selectedOption);

const basepath = {
  掌子面素描: `${ipServer}/ConstructionSurfaceGeoModel/康定2号隧道横洞正洞大里程-TFS`,
  富水带: `${ipServer}/ConstructionSurfaceGeoModel/康定二号隧道富水带`,
  破碎带: `${ipServer}/ConstructionSurfaceGeoModel/康定二号隧道破碎带`,
  高地应力: `${ipServer}/ConstructionSurfaceGeoModel/康定二号高低应力`,
  软弱围岩: `${ipServer}/ConstructionSurfaceGeoModel/康定二号软弱围岩`
  //'软弱围岩': "",
  //'高地应力': "",
  //'富水带': "",
  //'破碎带': ""
};
function loadTiles(path, viewer) {
  //加载3dtiles并跳转
  console.log(`数据地址为${path}`);
  let tileset = new Cesium.Cesium3DTileset({
    url: path, // 拼接完整 URL
  });
  viewer.scene.primitives.add(tileset);
  viewer.flyTo(tileset, {
    duration: 2, // 动画持续时间（秒）
    offset: new Cesium.HeadingPitchRange(0, -0.5, 0), // 设置视角偏移，抬升 3000 米
  });
}
function loadVoxel(row, path, viewer) {
  //跳转到位置视角并加载模型
  lookAtTo(row);
  pre = new Previous(viewer);
  pre.clearPrimitiveModel();
  pre.loadForcastModel(path);
}
function loadmodels(row, viewer, tunnel_selectedOption) {
  console.log(`开始表面模型加载进程：${tunnel_selectedOption}`);
  // 根据选项加载不同模型
  const modelLoaders = {
    '掌子面素描': () => loadTiles(basepath['掌子面素描'] + `/${row.mileage}/tileset.json`, viewer),
    '地质雷达': () => loadTiles(basepath['地质雷达'] + `/${row.mileage}/tileset.json`, viewer),
    '超前水平钻': () => loadTiles(basepath['超前水平钻'] + `/${row.mileage}/tileset.json`, viewer),
    '加深炮孔': () => loadTiles(basepath['加深炮孔'] + `/${row.mileage}/tileset.json`, viewer),
    'TSP反演': () => {
      const suffix = selectedVoxelType.value === 'vp' ? '_1.00.json' : '_2.00.json';
      loadVoxel(row, basepath['TSP反演'] + `/${row.mileage}${suffix}`, viewer);
    },
    '瞬变电磁': () => loadTiles(basepath['瞬变电磁'] + `/${row.mileage}/tileset.json`, viewer),



    '富水带': () => loadVoxel(row, 'data/WATER/Water.json', viewer),
    '破碎带': () => loadVoxel(row, 'data/POSUI/posui.json', viewer),
    '高地应力': () => loadTiles(basepath['高地应力'] + `/${row.mileage}/tileset.json`, viewer),
    '软弱围岩': () => loadTiles(basepath['软弱围岩'] + `/${row.mileage}/tileset.json`, viewer),
  }
  // 执行加载逻辑
  const loader = modelLoaders[tunnel_selectedOption];
  if (loader) {
    loader();
  } else {
    console.warn('未知的选项:', tunnel_selectedOption);
  }
}
//属性展示面板数据
const imageSrc = ref('');
const imgPopShowModal = ref(false);
let currentPointCoor = ref(null);
let showModal = ref(false);
let jsonData = ref({});

const currentPage = ref(1);
const pageSize = ref(30);
const lastselectedRowKeys = reactive([]); // 当前页被选中的行
const selectedAllPoints = reactive({}); //所有被选中的点，点信息用里程索引
const loadedAllPointEntities = reactive({}); //所有被加载的点entityes
const loadedAllPointCoors = reactive({}); //所有被被加载的点的Cartesian3坐标（在小球中心），用里程索引
let segmentLineObj = []; // 根据点数据绘制隧道线，分割的路线段，每一段是一个对象，用里程索引，值是点的Cartesian3坐标（在隧道上）

// let tunnelLineEntity = []; //根据点数据绘制隧道线，分割的路线段entity,用以移除

// 当前页的数据
const currentPageData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  const showdata = props.Points.slice(start, end);

  return showdata;
});

// 总数据条数
const totalData = computed(() => props.Points.length);

/**
 * @description: 返回 array1 中在 array2 中不存在的对象
 * @param {*} array1
 * @param {*} array2
 * @return {*}
 */
function diffObjects(array1, array2) {
  // 使用 Set 来存储 array2 中所有对象的唯一标识符（例如，JSON 字符串表示）
  const set = new Set(array2.map((obj) => JSON.stringify(obj)));
  // 返回 array1 中在 array2 中不存在的对象
  return array1.filter((obj) => !set.has(JSON.stringify(obj)));
}
function selectChange(selection) {
  // 移除数据
  if (selection.length < lastselectedRowKeys.length) {
    let deleteArray = diffObjects(lastselectedRowKeys, selection);
    for (let index = 0; index < deleteArray.length; index++) {
      let mileage = deleteArray[index].mileage;
      // 移除高亮线
      DTScopeEngine.getViewer(() => {
        let viewer = DTScopeEngine.viewer;
        if (highlightLineEntities[mileage]) {
          viewer.entities.remove(highlightLineEntities[mileage]);
          delete highlightLineEntities[mileage];
        }
      });
      // ...原有移除点的逻辑...
      if (Object.prototype.hasOwnProperty.call(selectedAllPoints, mileage)) {
        delete selectedAllPoints[mileage];
      }
    }
  }
  if (selection.length == 0) {
    // 新页面没有选择
    if (Object.keys(selectedAllPoints).length == 0) {
      //从未选择过
      return;
    }

    // 检索当前页面数据是否加载过
    for (let i = 0; i < currentPageData.value.length; i++) {
      let mileageName = currentPageData.value[i].mileage;
      if (Object.prototype.hasOwnProperty.call(selectedAllPoints, mileageName)) {
        nextTick(() => {
          //找到索引
          document.querySelector('tr.el-table__row:nth-child(' + (i + 1) + ') > td:nth-child(1) > div:nth-child(1) > label').click();
        });
      }
    }
  } else {
    for (let index = 0; index < selection.length; index++) {
      let row = selection[index];
      let mileage = row.mileage;
      if (!Object.prototype.hasOwnProperty.call(selectedAllPoints, mileage)) {
        selectedAllPoints[mileage] = row;
        // ====== 新增：添加高亮线 ======
        addHighlightLine(row);
      }
    }
  }

  lastselectedRowKeys.length = 0;
  for (let index = 0; index < selection.length; index++) {
    lastselectedRowKeys.push(selection[index]);
  }
  emit('selectRow', selection.length > 0 ? selection[0] : null);
}

// 处理每页显示条数改变
function handleSizeChange(val) {
  pageSize.value = val;
  handleCurrentChange(currentPage.value);
}

// 处理当前页码改变
function handleCurrentChange(val) {
  // 每翻页一次，lastselectedRowKeys会清空
  lastselectedRowKeys.length = 0;
  // 检索当前页面数据（翻页前）是否加载过，如果加载过，说明有选中，翻页自动触发selectChange
  let current_has_sel = false;
  for (let i = 0; i < currentPageData.value.length; i++) {
    let mileageName = currentPageData.value[i].mileage;
    if (Object.prototype.hasOwnProperty.call(selectedAllPoints, mileageName)) {
      current_has_sel = true;
    }
    if (i == currentPageData.value.length - 1 && !current_has_sel) {
      // 当前页面未选择的翻页逻辑（为了新页面能够把展示的数据选中），翻页手动触发selectChange
      nextTick(() => {
        currentPage.value = val;
        selectChange([]);
      });
      break;
    }
  }
  currentPage.value = val;
}

let highlightLineEntity = null;

// 工具函数：里程字符串转米数
function mileageToMeters(mileage) {
  // 例：D3K279+840.00
  const match = mileage.match(/K(\d+)\+([\d.]+)/);
  if (!match) {
    return 0;
  }
  return parseInt(match[1]) * 1000 + parseFloat(match[2]);
}

// 工具函数：两点间球面距离
function getDistance(lon1, lat1, lon2, lat2) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// 处理定位
function lookAtTo(row) {
  DTScopeEngine.getViewer(() => {
    let viewer = DTScopeEngine.viewer;
    let lon = row.value['坐标'][0];
    let lat = row.value['坐标'][1];
    let height = row.value['高程'];
    let destinationCartesian = Cesium.Cartesian3.fromDegrees(lon, lat, height);

    // ====== 高亮全线一段 ======
    const coords = AllLine.features[0].geometry.coordinates;
    // 找到点击点最近的全线索引
    let minIdx = 0,
      minDist = Infinity;
    for (let i = 0; i < coords.length; i++) {
      const [clon, clat] = coords[i];
      const dist = getDistance(clon, clat, lon, lat);
      if (dist < minDist) {
        minDist = dist;
        minIdx = i;
      }
    }
    // length 单位：米
    const length = row.value.length || 0;
    let sum = 0,
      endIdx = minIdx;
    for (let i = minIdx; i < coords.length - 1; i++) {
      const [lon1, lat1] = coords[i];
      const [lon2, lat2] = coords[i + 1];
      sum += getDistance(lon1, lat1, lon2, lat2);
      if (sum >= length) {
        endIdx = i + 1;
        break;
      }
    }
    const highlightCoords = coords.slice(minIdx, endIdx + 1);
    const positions = highlightCoords.map(([lon, lat, h]) => Cesium.Cartesian3.fromDegrees(lon, lat, h));

    // ====== 原有定位逻辑 ======
    viewer.scene.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    viewer.scene.camera.flyTo({
      easingFunction: Cesium.EasingFunction.QUINTIC_OUT,
      destination: destinationCartesian,
      orientation: {
        heading: 5.497791654142265,
        pitch: -0.6154907919216184,
        roll: 0.0,
      },
      duration: 1,
      complete: () => {
        viewer.camera.lookAt(Cesium.Cartesian3.fromDegrees(lon, lat, height), new Cesium.Cartesian3(30, -15, 30));
      },
    });
  });
}

watch(
  () => selectedAllPoints,
  (newVal, oldVal) => {
    DTScopeEngine.getViewer(() => {
      let viewer = DTScopeEngine.viewer;
      //加载数据
      for (let key of Object.keys(selectedAllPoints)) {
        if (!Object.prototype.hasOwnProperty.call(loadedAllPointEntities, key)) {
          let mileagename = selectedAllPoints[key]['mileage'];
          let point_value = selectedAllPoints[key]['value'];
          let attribute = point_value['属性'];
          let point = {
            longitude: point_value['坐标'][0],
            latitude: point_value['坐标'][1],
            height: point_value['高程'],
            properties: { 施工里程: mileagename, 属性: attribute },
          };

          //起始坐标点
          const position = Cesium.Cartesian3.fromDegrees(point.longitude, point.latitude, point.height);

          // 获取地球表面的法线向量
          let surfaceNormal = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(position, new Cesium.Cartesian3());

          // 定义垂线的方向，可以是 surfaceNormal 或者其他垂直于地面的向量
          let lineDirection = surfaceNormal;

          // 归一化方向向量
          Cesium.Cartesian3.normalize(lineDirection, lineDirection);

          // 计算线的终点，假设长度为1000米
          let lineLength = 1.5;
          let endPointVertical = Cesium.Cartesian3.add(
            position,
            Cesium.Cartesian3.multiplyByScalar(lineDirection, lineLength, new Cesium.Cartesian3()),
            new Cesium.Cartesian3()
          );

          // 创建垂直于地面的线
          const lineEntity = viewer.entities.add({
            polyline: {
              positions: [position, endPointVertical],
              width: 2,
              material: Cesium.Color.YELLOW,
            },
          });

          // 在垂线尽头创建实体（球体）
          const entity = viewer.entities.add({
            name: 'ZZMellipsoid',
            position: endPointVertical,
            ellipsoid: {
              radii: new Cesium.Cartesian3(0.1, 0.1, 0.1), // 半径，可以根据需要调整
              material: Cesium.Color.BLUE.withAlpha(0.8),
            },
            // 将属性附加到实体以供点击时使用
            properties: point.properties,
          });
          // 将球坐标存入，用里程段索引
          loadedAllPointCoors[key] = endPointVertical;

          // 创建 label
          const labelEntity = viewer.entities.add({
            position: position,
            label: {
              text: point.properties['施工里程'],
              font: 'bold 12px sans-serif',
              pixelOffset: new Cesium.Cartesian2(-50, 0),
              fillColor: Cesium.Color.YELLOW,
              outlineColor: Cesium.Color.BLACK,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              // heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND, // 将 label 的位置相对于地面
              // distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 500),
            },
          });
          const highlightLineEntity = addHighlightLine(selectedAllPoints[key], viewer);
          loadedAllPointEntities[key] = {
            entity: entity,
            lineEntity: lineEntity,
            labelEntity: labelEntity,
            highlightLineEntity: highlightLineEntity, // 新增
          };
        }
      }
      //移除数据
      for (let key of Object.keys(loadedAllPointEntities)) {
        if (!Object.prototype.hasOwnProperty.call(selectedAllPoints, key)) {
          viewer.entities.remove(loadedAllPointEntities[key]['entity']);
          viewer.entities.remove(loadedAllPointEntities[key]['lineEntity']);
          viewer.entities.remove(loadedAllPointEntities[key]['labelEntity']);
          // 新增：移除高亮线
          if (loadedAllPointEntities[key]['highlightLineEntity']) {
            viewer.entities.remove(loadedAllPointEntities[key]['highlightLineEntity']);
          }
          delete loadedAllPointEntities[key];
        }
      }
      //重绘隧道线
      if (tunnelLineEntity.length != 0) {
        tunnelLineEntity.forEach((tlEntity) => {
          viewer.entities.remove(tlEntity);
        });
        tunnelLineEntity = []; //隧道entity清空
        segmentLineObj = []; //隧道线段清空
      }
      if (Object.keys(selectedAllPoints).length >= 2) {
        const pointsData = [];
        for (let key of Object.keys(selectedAllPoints)) {
          let point_value = selectedAllPoints[key]['value'];
          // 配置展示在地球上的点数据结构
          pointsData.push({ longitude: point_value['坐标'][0], latitude: point_value['坐标'][1] });
        }
        let positionsArr = [];
        let start_point = null;
        pointsData.forEach((point) => {
          let end_point = [point.longitude, point.latitude];
          let position = Cesium.Cartesian3.fromDegrees(point.longitude, point.latitude);
          if (start_point != null) {
            let segment_length = turf.distance(start_point, end_point, { units: 'meters' });
            if (segment_length < 100) {
              positionsArr.push(position);
            } else {
              segmentLineObj.push(positionsArr);
              positionsArr = [];
            }
          } else {
            positionsArr.push(position);
          }
          start_point = end_point;
        });
        if (positionsArr.length != 0) {
          segmentLineObj.push(positionsArr);
          positionsArr = [];
        }
        // 创建隧道线实体
        segmentLineObj.forEach((pArr) => {
          if (pArr.length > 1) {
            tunnelLineEntity.push(
              viewer.entities.add({
                polyline: {
                  positions: pArr,
                  width: 5,
                  material: Cesium.Color.WHITE,
                },
              })
            );
          }
        });
      }

      // 添加点击事件处理函数
      const eventHandler = viewer.screenSpaceEventHandler.setInputAction(function (click) {
        // 获取点击位置的屏幕坐标
        let pick = viewer.scene.pick(click.position);

        // 如果有实体被选中且名称为“ZZMellipsoid”
        if (Cesium.defined(pick) && Cesium.defined(pick.id) && Cesium.defined(pick.id.name) && pick.id.name === 'ZZMellipsoid') {
          showModal.value = false;
          // 利用watch函数接触事件
          currentPointCoor.value = null;
          currentPointCoor.value = pick.id.position.getValue();
          // 在控制台输出实体被点击的消息
          // console.log('实体被点击了:', pick.id.properties["属性"]._value);
          // jsonData.value = pick.id.properties["属性"]
          // 更新地质素描属性信息
          jsonData.value = pick.id.properties['属性']._value;
          // 使用 Axios 发起请求，获取影像信息
          // 设置请求参数
          const imgRequestOptions = {
            method: 'POST', // 设置请求方法为POST
            headers: {
              'Content-Type': 'application/json', // 设置请求头为JSON格式
            },
            body: JSON.stringify({
              type: 'image',
              tunnelname: tunnel_selectedOption.value,
              mileage: pick.id.properties['施工里程']._value,
            }),
          };
          // 更新面板位置
          updatePanel(currentPointCoor.value, viewer)();
          showModal.value = true;
          fetch(zzsmImage + '/geodata/acquire', imgRequestOptions)
            .then((res) => {
              // 在这里处理 Axios 请求的响应
              if (!res.ok) {
                throw new Error('Network response was not ok②');
              }
              // 读取响应数据
              return res.json();
            })
            .then((img_data) => {
              if ('error' in img_data.data[0]) {
                imageSrc.value = 'data:image/jpeg;base64,' + img_data.data[0]['img_base64'];
                alert(pick.id.properties['施工里程']._value + '无掌子面影像数据！');
              } else {
                imageSrc.value = 'data:image/jpeg;base64,' + img_data.data[0]['value']['img_base64'];
              }
            })
            .catch((error) => {
              console.error('There was a problem with the img request:', error);
            });
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    });
  },
  { deep: true }
);

// 更新面板位置和内容,传入Cartesian3对象
function updatePanel(Cartesian3Coor, viewer) {
  return function () {
    if (isDragging) {
      return;
    } // 拖动时不自动定位
    // 获取屏幕坐标
    let position = Cesium.SceneTransforms.wgs84ToWindowCoordinates(viewer.scene, Cartesian3Coor);
    // 更新面板位置
    if (Cesium.defined(position)) {
      let panel = document.getElementById('panel');
      panel.style.left = position.x - 225 + 'px';
      panel.style.top = position.y - 75 + 'px';
    } else {
      showModal.value = false;
      currentPointCoor.value = null;
    }
  };
}

// 判断数据内容是否是对象
function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
watch(currentPointCoor, (newValue, oldValue) => {
  DTScopeEngine.getViewer(() => {
    let viewer = DTScopeEngine.viewer;
    if (newValue != null) {
      // 先移除旧的监听
      if (currentUpdatePanelListener) {
        viewer.scene.postRender.removeEventListener(currentUpdatePanelListener);
      }
      // 新建监听并保存
      currentUpdatePanelListener = updatePanel(newValue, viewer);
      viewer.scene.postRender.addEventListener(currentUpdatePanelListener);
    } else {
      if (currentUpdatePanelListener) {
        viewer.scene.postRender.removeEventListener(currentUpdatePanelListener);
        currentUpdatePanelListener = null;
      }
    }
  });
});

// 顶部声明
let isDragging = false;
let currentUpdatePanelListener = null;

onMounted(() => {
  nextTick(() => {
    const panel = document.getElementById('panel');
    if (!panel) {
      return;
    }
    // 不要在这里再声明 let isDragging
    let offsetX = 0;
    let offsetY = 0;

    panel.style.cursor = 'move';

    panel.onmousedown = function (e) {
      if (e.button !== 0) {
        return;
      }
      isDragging = true;
      offsetX = e.clientX - panel.offsetLeft;
      offsetY = e.clientY - panel.offsetTop;
      // panel.style.zIndex = 2000;确保面板在最上层

      // 拖动开始时移除自动定位监听
      DTScopeEngine.getViewer(() => {
        let viewer = DTScopeEngine.viewer;
        if (currentUpdatePanelListener) {
          viewer.scene.postRender.removeEventListener(currentUpdatePanelListener);
        }
      });

      document.onmousemove = function (e) {
        if (isDragging) {
          panel.style.left = e.clientX - offsetX + 'px';
          panel.style.top = e.clientY - offsetY + 'px';
          panel.style.right = 'auto';
        }
      };
      document.onmouseup = function () {
        isDragging = false;
        document.onmousemove = null;
        document.onmouseup = null;
        // 拖动结束后不再自动添加监听，面板位置保持用户拖动后的状态
      };
    };
  });
});

onUnmounted(() => {
  DTScopeEngine.getViewer(() => {
    let viewer = DTScopeEngine.viewer;
    //移除数据
    for (let key of Object.keys(loadedAllPointEntities)) {
      viewer.entities.remove(loadedAllPointEntities[key]['entity']);
      viewer.entities.remove(loadedAllPointEntities[key]['lineEntity']);
      viewer.entities.remove(loadedAllPointEntities[key]['labelEntity']);
      // 新增：移除高亮线
      if (loadedAllPointEntities[key]['highlightLineEntity']) {
        viewer.entities.remove(loadedAllPointEntities[key]['highlightLineEntity']);
      }
      delete loadedAllPointEntities[key];
    }
    if (tunnelLineEntity.length != 0) {
      tunnelLineEntity.forEach((tlEntity) => {
        viewer.entities.remove(tlEntity);
      });
      tunnelLineEntity = [];
    }
  });
});

// 直接请求数据库接口，获取所有 JSON 数据列表
onMounted(async () => {
  // 假设接口返回 data.data 是所有 JSON 对象的数组
  const res = await fetch(`${zzsmImage}/geodata/allJson`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'attribute',
    }),
  });
  console.log('这个函数被调用了')
  const data = await res.json();
  // 遍历所有 JSON，每个对象生成一组属性
  tableData.value = data.data
    .map((item) => [
      { label: '施工里程起点', value: item['施工里程'] ?? '' },
      { label: '长度(m)', value: item['length'] ?? '' },
      { label: '探测结论', value: item['conclusionyb'] ?? '' },
      { label: '后续建议', value: item['suggestion'] ?? '' },
    ])
    .flat();
});

function addHighlightLine(row) {
  DTScopeEngine.getViewer(() => {
    let viewer = DTScopeEngine.viewer;
    let lon = row.value['坐标'][0];
    let lat = row.value['坐标'][1];
    let height = row.value['高程'] || 0;
    let coords = AllLine.features[0].geometry.coordinates;

    // 找到全线最近点索引
    let minIdx = 0,
      minDist = Infinity;
    for (let i = 0; i < coords.length; i++) {
      const [clon, clat] = coords[i];
      const dist = getDistance(clon, clat, lon, lat);
      if (dist < minDist) {
        minDist = dist;
        minIdx = i;
      }
    }

    // length 单位：米
    const length = row.value.length || 0;
    let sum = 0,
      endIdx = minIdx;
    let lastLon = lon,
      lastLat = lat,
      lastH = height;

    // 从小球/垂线坐标开始，累计距离
    for (let i = minIdx; i < coords.length - 1; i++) {
      const [lon2, lat2, h2] = coords[i + 1];
      sum += getDistance(lastLon, lastLat, lon2, lat2);
      lastLon = lon2;
      lastLat = lat2;
      lastH = h2;
      if (sum >= length) {
        endIdx = i + 1;
        break;
      }
    }

    // 高亮线起点用小球/垂线坐标
    const highlightCoords = [[lon, lat, height]].concat(coords.slice(minIdx + 1, endIdx + 1));
    const positions = highlightCoords.map(([lon, lat, h]) => Cesium.Cartesian3.fromDegrees(lon, lat, h));

    // 清除旧高亮
    if (highlightLineEntities[row.mileage]) {
      viewer.entities.remove(highlightLineEntities[row.mileage]);
      delete highlightLineEntities[row.mileage];
    }
    loadmodels(row, viewer, tunnel_selectedOption.value);
    // 添加新高亮
    if (positions.length > 1) {
      highlightLineEntities[row.mileage] = viewer.entities.add({
        polyline: {
          positions,
          width: 8,
          material: Cesium.Color.BLUE.withAlpha(0.8),
          clampToGround: false,
        },
      });
    }
  });
}
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

    // padding-bottom: 0.1em;
    padding-left: 1em;
    border-radius: 0.8em 0 0;
    border: none;
    color: white;
    background: linear-gradient(to right, rgb($color-title-01, 1), 70%, rgba($color-title-01, 0));
  }

  .article {
    width: 100%;
    height: 100%;
    margin-top: 0.2em;
    padding: 0.3em;
    font-size: 16px;

    .middle {
      width: 100%;
      height: 17.5em;
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
  margin-left: 29%;

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

.el_table {
  height: 100%;

  .el_row_content {
    height: 87%;
  }

  .el_page {
    height: 13%;
    background-color: white;
  }
}

.tunnel_select {
  display: inline-block;
  position: relative;
  top: -2px;
  z-index: 100;
  height: 100%;
  margin-left: 32%;

  select {
    appearance: none;
    width: 180px;
    height: 100%;
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

:deep(.el-pager) {
  width: 0;
}

/* stylelint-disable-next-line no-duplicate-selectors */
:deep(.el-pager) {
  display: none;
}
</style>
