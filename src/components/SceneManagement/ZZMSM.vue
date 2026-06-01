<!--
 * @Date: 2024-02-10 08:41:49
 * @LastEditors: 枫林残忆 2997534654@qq.com
 * @LastEditTime: 2024-04-11 20:06:28
 * @FilePath: \Geology-V3\src\views\SceneManagement\ConstructionSurfaceGeoModel\Component\ZZMSM.vue
-->
<template>
  <div>
    <!-- <RightPanel /> -->
    <div id="panel" v-show="showModal">
      <header class="head head-sm">掌子面素描</header>
      <div id="close">
        <span @click="showModal = false">
          <h2>&times;</h2>
        </span>
      </div>
      <div class="desc-content">
        <div class="table-container">
          <div class="table-content">
            <div v-for="(value, key) in jsonData" :key="key" class="table-row">
              <div class="table-cell key">{{ key }}</div>
              <div v-if="isObject(value)" class="table-cell">
                <div v-for="(innerValue, innerKey) in value" :key="innerKey" class="inner-table-row">
                  <div class="table-cell inner-key">{{ innerKey }}</div>
                  <div class="table-cell inner-value">{{ innerValue }}</div>
                </div>
              </div>
              <div v-else class="table-cell value">{{ value }}</div>
            </div>
          </div>
        </div>
      </div>
      <header class="head head-yx">掌子面影像</header>
      <div id="enarge">
        <span @click="imgPopShowModal = true">
          <h2>«»</h2>
        </span>
      </div>
      <!-- 点击放大图片 -->
      <div id="imageContainer">
        <img id="faceImage" :src="imageSrc" @click="imgPopShowModal = true" alt="点击放大图片" />
      </div>
    </div>

    <!-- 掩膜放大图片 -->
    <div class="modal" @click="imgPopShowModal = false" v-show="imgPopShowModal">
      <div class="modal-img-content" @click.stop>
        <div id="close">
          <span @click="imgPopShowModal = false">
            <h2>&times;</h2>
          </span>
        </div>
        <img :src="imageSrc" class="modal-image" alt="放大图片" />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { getCurrentInstance, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import * as turf from '@turf/turf';
import { DTScopeEngine } from '@/utils/Common/Viewer';
import { linePoints } from '../Config/linePoints';
//@ts-ignore
import * as Cesium from 'Cesium';
import AppConfig from '@/config/AppConfig';

let { zzsmImage } = new AppConfig().appConfig;

const imageSrc = ref('');
const imgPopShowModal = ref(false);

const splitIntoGroups = (arr, groupSize) => {
  return Array.from({ length: Math.ceil(arr.length / groupSize) }, (_, index) => arr.slice(index * groupSize, index * groupSize + groupSize));
};

const coordinates = splitIntoGroups(linePoints, 3);

let currentPointCoor = ref(null);

let showModal = ref(false);
let jsonData = ref({});

const ctx = getCurrentInstance();
const _this = ctx.appContext.config.globalProperties;
let imageEntityArray = [];

// 加载数据
function show(): void {
  DTScopeEngine.getViewer(() => {
    const viewer = DTScopeEngine.viewer;

    // 设置掌子面素描数据请求参数
    const requestOptions = {
      method: 'POST', // 设置请求方法为POST
      headers: {
        // 设置请求头为JSON格式
        'Content-Type': 'application/json',
      },
      // 设置请求体为JSON格式的数据
      body: JSON.stringify({
        type: 'image',
        tunnelname: '康定2号隧道',
        mileage_range: ['D2K280+300.00', 'D2K280+500.00'],
      }),
    };
    fetch(zzsmImage + '/geodata/acquire', requestOptions)
      .then((response) => {
        // 检查响应状态
        if (!response.ok) {
          throw new Error('Network response was not ok①');
        }
        // 读取响应数据
        return response.json();
      })
      .then((data) => {
        // 对象数组
        let DATA = data.data;
        // 使用数据
        let target_length_array = DATA.map((point) => point.distance);
        let spatial_target_length = spatialize(target_length_array);
        let coor_half = Math.floor(spatial_target_length.length / 2);
        let coor_half_lon = spatial_target_length[coor_half].coor[0]; // 经度
        let coor_half_lat = spatial_target_length[coor_half].coor[1]; // 纬度
        let coor_half_height = spatial_target_length[coor_half].coor[2]; // 高程
        let destinationCartesian = Cesium.Cartesian3.fromDegrees(coor_half_lon, coor_half_lat, coor_half_height);
        viewer.scene.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
        viewer.scene.camera.flyTo({
          easingFunction: Cesium.EasingFunction.QUINTIC_OUT,
          destination: destinationCartesian,
          orientation: {
            heading: 5.497791654142265,
            pitch: -0.6154907919216184,
            roll: 0.0,
          },
          duration: 0.001,
          complete: () => {
            viewer.camera.lookAt(
              Cesium.Cartesian3.fromDegrees(coor_half_lon, coor_half_lat, coor_half_height),
              new Cesium.Cartesian3(175, -250, 175)
            );
          },
        });

        for (let index = 0; index < spatial_target_length.length; index++) {
          let endpoints = spatial_target_length[index].endpoints;
          let centerpoint = spatial_target_length[index].coor;
          let distance = spatial_target_length[index].target_length;
          let imgObj = findObjectByKeyValue(DATA, 'distance', distance)[0];
          let img_base64 = imgObj.value.img_base64;
          let imageEntity = showimage(viewer, endpoints, centerpoint, img_base64);
          imageEntityArray.push(imageEntity);
        }
      })
      .catch((error) => {
        // 处理错误
        console.error('There was a problem with the fetch operation:', error);
      });
  });
}
/**
 * @description: 将给定的目标里程空间化
 * @param {*} target_length 两种选择，里程距离(m) number / 里程距离(m)数组 array
 * @return {*} result_coordinate 对象数组，对象key包含目标里程距离、空间化结果坐标以及两端点坐标
 * 				{
						target_length: target_length,
						coor: [interpolated_longitude, interpolated_latitude, interpolated_height],
						endpoints: [start_point, end_point]
					}
 */
function spatialize(target_length) {
  // 初始化累计长度
  let cumulative_length = 279700;
  let target_length_index = 0;
  if (typeof target_length === 'number' && !isNaN(target_length)) {
    if (target_length < cumulative_length) {
      return null;
    }
  } else if (Array.isArray(target_length)) {
    if (target_length[0] < cumulative_length) {
      return null;
    }
  } else {
    return null;
  }

  let result_coordinate = [];
  // 遍历坐标数组，计算累计长度
  for (let i = 0; i < coordinates.length - 1; i++) {
    let start_point = coordinates[i];
    let end_point = coordinates[i + 1];
    let segment_length = turf.distance(start_point, end_point, { units: 'meters' });

    cumulative_length += segment_length;
    if (typeof target_length === 'number' && !isNaN(target_length)) {
      // 检查是否满足条件
      if (cumulative_length >= target_length) {
        let remaining_length = target_length - (cumulative_length - segment_length);
        let ratio = remaining_length / segment_length;

        // 插值计算找到坐标
        let interpolated_longitude = start_point[0] + ratio * (end_point[0] - start_point[0]);
        let interpolated_latitude = start_point[1] + ratio * (end_point[1] - start_point[1]);
        let interpolated_height = start_point[2] + ratio * (end_point[2] - start_point[2]);
        result_coordinate.push({
          target_length: target_length,
          coor: [interpolated_longitude, interpolated_latitude, interpolated_height],
          endpoints: [start_point, end_point],
        });
        break;
      }
    } else {
      //@ts-ignore
      for (let index = target_length_index; index < target_length.length; index++) {
        target_length_index = index;
        let target_len = target_length[index];
        // 检查是否满足条件
        if (cumulative_length >= target_len) {
          let remaining_length = target_len - (cumulative_length - segment_length);
          let ratio = remaining_length / segment_length;

          // 插值计算找到坐标
          let interpolated_longitude = start_point[0] + ratio * (end_point[0] - start_point[0]);
          let interpolated_latitude = start_point[1] + ratio * (end_point[1] - start_point[1]);
          let interpolated_height = start_point[2] + ratio * (end_point[2] - start_point[2]);
          result_coordinate.push({
            target_length: target_len,
            coor: [interpolated_longitude, interpolated_latitude, interpolated_height],
            endpoints: [start_point, end_point],
          });
          continue;
        }
        break;
      }
      //@ts-ignore
      if (result_coordinate.length == target_length.length) {
        break;
      }
    }
  }

  return result_coordinate;
}

/**
 * @description: 显示掌子面影像。
 * @param {*} viewer
 * @param {*} pointsdata 影像端坐标数组 [[longitide,latitude,height],[longitide`,latitude`,height`]
 * @param {*} centerdata 影像坐标
 * @param {*} img_base64 影像base64二进制编码
 * @return {*} 影像entity索引
 */
function showimage(viewer, pointsdata, centerdata, img_base64) {
  // 提取经纬度并转换为Cartesian3坐标
  const positions = pointsdata.map((point) => Cesium.Cartesian3.fromDegrees(point[0], point[1], point[2]));
  // 计算长方形的中心点，可以根据需要调整
  let center = Cesium.Cartesian3.fromDegrees(centerdata[0], centerdata[1], centerdata[2]);

  // 计算方向向量
  let lineDirection = Cesium.Cartesian3.subtract(positions[1], positions[0], new Cesium.Cartesian3());
  // 归一化方向向量
  let normalizedLineDirection = Cesium.Cartesian3.normalize(lineDirection, new Cesium.Cartesian3());

  // 获取地球表面的法线向量
  let surfaceNormal = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(center, new Cesium.Cartesian3());
  // 归一化法线向量
  let normalizedsurfaceNormal = Cesium.Cartesian3.normalize(surfaceNormal, new Cesium.Cartesian3());

  // 计算法线向量和方向向量的叉积
  let crossProduct = Cesium.Cartesian3.cross(normalizedLineDirection, normalizedsurfaceNormal, new Cesium.Cartesian3());
  // 归一化叉积向量
  let normalizedCrossDirection = Cesium.Cartesian3.normalize(crossProduct, new Cesium.Cartesian3());
  // 得到叉积向量的反方向向量
  let negatedCrossProduct = new Cesium.Cartesian3(-normalizedCrossDirection.x, -normalizedCrossDirection.y, -normalizedCrossDirection.z);

  let textureUrl = 'data:image/jpeg;base64,' + img_base64;
  let imgMaterial = new Cesium.ImageMaterialProperty({
    //@ts-ignore
    image: textureUrl,
  });

  let V = Cesium.Cartesian3.cross(normalizedCrossDirection, normalizedLineDirection, new Cesium.Cartesian3());

  let Point1 = Cesium.Cartesian3.add(
    center,
    Cesium.Cartesian3.multiplyByScalar(normalizedCrossDirection, 8.5, new Cesium.Cartesian3()),
    new Cesium.Cartesian3()
  );
  let Point2 = Cesium.Cartesian3.add(
    center,
    Cesium.Cartesian3.multiplyByScalar(negatedCrossProduct, 8.5, new Cesium.Cartesian3()),
    new Cesium.Cartesian3()
  );
  let Point4 = Cesium.Cartesian3.add(Point1, Cesium.Cartesian3.multiplyByScalar(V, 17, new Cesium.Cartesian3()), new Cesium.Cartesian3());
  let Point3 = Cesium.Cartesian3.add(Point2, Cesium.Cartesian3.multiplyByScalar(V, 17, new Cesium.Cartesian3()), new Cesium.Cartesian3());

  const points = [Point1, Point2, Point3, Point4];
  // let newpoint = points.map(function (point) {
  // 	let cartographic = Cesium.Cartographic.fromCartesian(point);
  // 	let longitude = Cesium.Math.toDegrees(cartographic.longitude);
  // 	let latitude = Cesium.Math.toDegrees(cartographic.latitude);
  // 	let height = cartographic.height;
  // 	return [longitude, latitude, height];
  // });
  // let positionsArray = Cesium.Cartesian3.fromDegreesArrayHeights([
  // 	newpoint[0][0], newpoint[0][1], newpoint[0][2],
  // 	newpoint[1][0], newpoint[1][1], newpoint[1][2],
  // 	newpoint[2][0], newpoint[2][1], newpoint[2][2],
  // 	newpoint[3][0], newpoint[3][1], newpoint[3][2]

  // ]);

  let imageEntity = {
    polygon: {
      hierarchy: new Cesium.PolygonHierarchy(points),
      material: imgMaterial,
      perPositionHeight: true,
    },
  };
  let addedEntity = viewer.entities.add(imageEntity);

  return addedEntity;
}

// 判断数据内容是否是对象
function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// 检索对象数组中具有特定键值对的对象
/**
 * @description:
 * @param {*} objectsArray 待检索的对象数组
 * @param {*} key 键名
 * @param {*} value 对应值
 * @return {*}
 */
function findObjectByKeyValue(objectsArray, key, value) {
  return objectsArray.filter((obj) => obj[key] === value);
}

onMounted(() => {
  show();
});

onBeforeUnmount(() => {
  DTScopeEngine.getViewer(() => {
    const viewer = DTScopeEngine.viewer;
    for (let index = 0; index < imageEntityArray.length; index++) {
      viewer.entities.remove(imageEntityArray[index]);
    }
  });
});
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables';

#panel {
  position: absolute;

  /* 定义面板宽度 */
  width: 300px;

  /* 定义面板高度 */
  height: 600px;
  border: 1px solid #ccc;

  // padding: 20px;
  border-radius: 5px;

  // top: 0;
  // left: 0;
  // background-color: white;
  border-radius: 0.8em;
  background-color: rgba($color-bg-01, 0.5);
  box-shadow: inset 0 0 8px 2px rgb(186 190 192);

  .head {
    width: 100%;
    height: 5%;
    padding-top: 0.2em;
    padding-left: 1em;
    color: white;
    font-size: 18px;
    font-weight: 600;
    white-space: 1em;
    background: linear-gradient(to right, rgb($color-title-01, 1), 80%, rgba($color-title-01, 0));
  }

  .head-sm {
    border-radius: 0.8em 0 0;
  }

  // 关闭按钮
  #close {
    span {
      position: absolute;
      top: 0;
      right: 0;
      border-right: 4px solid rgb($color-title-01, 1);
      border-left: 2px solid rgb($color-title-01, 1);
      border-radius: 6px 0 0 6px;
      color: white;
      background: linear-gradient(to right, rgb($color-title-01, 1), 15%, rgba($color-title-01, 0), 85%, rgb($color-title-01, 1));
      cursor: pointer;
    }
  }

  .desc-content {
    width: 100%;
    height: 60%;
    border-right: 4px solid rgb($color-title-01, 1);
    border-left: 4px solid rgb($color-title-01, 1);

    /* 当内容超出面板大小时显示滚动条 */
    overflow: auto;
  }

  .table-content {
    display: table;

    // width: 100%;
    border-collapse: collapse;

    .table-row {
      display: table-row;
      width: 100%;

      .table-cell {
        display: table-cell;
        padding: 8px;
        border: 1px solid #ccc;

        .inner-table-row {
          display: table-row;

          .inner-key {
            font-weight: bold;
            background-color: #f9f9f9;
          }

          .inner-value {
            background-color: #fcfcfc;
          }
        }
      }

      .key {
        font-weight: bold;
        background-color: #f0f0f0;
      }
    }
  }

  #imageContainer {
    width: 100%;
    height: 30%;

    // border-top:1px solid #f0f0f0;
    border-left: 4px solid rgb($color-title-01, 1);
    border-right: 4px solid rgb($color-title-01, 1);
    border-bottom: 8px solid rgb($color-title-01, 1);
    border-radius: 0 0 0.8em 0.8em;
  }

  /* 掌子面影像边框样式 */
  #faceImage {
    width: 100%;

    // margin: 0 5px;
    object-fit: contain;
    cursor: pointer;

    /* 图片完全铺满 img 元素 */
  }
}

.modal {
  display: block;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 999;
  width: 100%;
  height: 100%;
  overflow: auto;
  background-color: rgb(0 0 0 / 70%);

  .modal-img-content {
    display: flex;
    position: relative;
    top: 10%;
    width: 60%;
    height: 80%;
    margin: auto;
    padding: 10px;
    justify-content: center;
    background-color: #fff;

    .modal-image {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    #close {
      span {
        position: absolute;
        top: 5px;
        right: 10px;
        border: 1px solid rgb($color-title-01, 1);
        background: linear-gradient(to right, rgb($color-title-01, 1), 15%, rgba($color-title-01, 0), 85%, rgb($color-title-01, 1));
        cursor: pointer;
      }
    }
  }
}

#enarge {
  span {
    position: absolute;
    top: 65%;
    right: 0;
    height: 5%;
    border-right: 4px solid rgb($color-title-01, 1);
    border-left: 2px solid rgb($color-title-01, 1);
    border-radius: 6px 0 0 6px;
    color: white;
    background: linear-gradient(to right, rgb($color-title-01, 1), 15%, rgba($color-title-01, 0), 85%, rgb($color-title-01, 1));
    cursor: pointer;
  }
}
</style>
