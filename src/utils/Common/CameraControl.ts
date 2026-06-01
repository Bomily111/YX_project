/*
 * @Author: Lincong-pro
 * @Date: 2023-04-16 09:08:39
 * @LastEditors: fuwei 2567873016@qq.com
 * @LastEditTime: 2025-06-20 18:41:37
 * @FilePath: \Geology-v3\src\utils\Common\CameraControl.ts
 * @Description: 此处主要实现相机的控制【缩放、旋转、位移】
 * Copyright (c) 2023 by VGE, All Rights Reserved.
 */
import { DTScopeEngine } from './Viewer';
import { ScreenSpaceCameraController, Cartesian3, EasingFunction, ScreenSpaceEventHandler, Math, ScreenSpaceEventType, Matrix4 } from 'cesium';
import { cartesian3ToCartographic } from '@/utils/Common/Transform';

/**
 * @description: 禁用相机控制
 * @return {void}
 */
const disableCamera = function () {
  const viewer = DTScopeEngine.viewer;
  const cameraController: ScreenSpaceCameraController = viewer.scene.screenSpaceCameraController;
  // disable the default event handler
  cameraController.enableRotate = false;
  cameraController.enableTranslate = false;
  cameraController.enableZoom = false;
  cameraController.enableTilt = false;
  cameraController.enableLook = false;
};

/**
 * @description: 启用相机控制
 * @return {void}
 */
const enableCamera = function () {
  const viewer = DTScopeEngine.viewer;
  //Restore camera view matrix
  viewer.camera.lookAtTransform(Matrix4.IDENTITY);
  const cameraController: ScreenSpaceCameraController = viewer.scene.screenSpaceCameraController;
  // enable the default event handler
  cameraController.enableRotate = true;
  cameraController.enableTranslate = true;
  cameraController.enableZoom = true;
  cameraController.enableTilt = true;
  cameraController.enableLook = true;
};

/**
 * @description: 制作窗口抖动效果
 * @return {void}
 */
const windowShake = () => {
  let viewer = DTScopeEngine.viewer;
  let cameraHeight = cartesian3ToCartographic(viewer.camera.position).height;
  let moveRate = cameraHeight / 100;

  const shake = () => {
    // step1
    viewer.camera.moveLeft(moveRate);
    // step2
    setTimeout(() => {
      viewer.camera.moveUp(moveRate);
      // step3
      setTimeout(() => {
        viewer.camera.moveDown(moveRate);
        // step4
        setTimeout(() => {
          viewer.camera.moveRight(moveRate);
        }, 100);
      }, 100);
    }, 100);
  };
  let count = 0;

  // vibrate for about 5 seconds
  let timerId = setInterval(() => {
    ++count;
    if (count > 24) {
      clearTimeout(timerId);
    } else {
      shake();
    }
  }, 200);
};

/**
 * @description: 设置屏幕中心点和相机可视区域
 * @param {*} viewer
 * @param {*} viewPoint 视点
 * @param {*} duration 飞行时间
 * @return {Promise}
 */
function setCameraViewPoint(viewer, viewPoint, duration) {
  let lon = viewPoint.Position.longitude;
  let lat = viewPoint.Position.latitude;
  let hei = viewPoint.Position.height;
  return new Promise((resolve, reject) => {
    viewer.scene.camera.flyTo({
      destination: Cartesian3.fromDegrees(lon, lat, hei),
      orientation: {
        heading: viewPoint.Orientation.heading,
        pitch: viewPoint.Orientation.pitch,
        roll: viewPoint.Orientation.roll,
      },
      easingFunction: EasingFunction.LINEAR_NONE,
      duration: duration,
      complete: resolve,
      cancel: reject,
    });
  });
}

/**
 * @description: 获取屏幕中心点和相机可视区域 ViewPoint
 * @param {*} viewer
 * @return {string} 相机点位debug信息
 */
export function getCameraViewPoint(viewer) {
  // 获取相机点经纬度
  let camera = viewer.scene.camera;
  let scene = viewer.scene;
  let position = camera.position;

  let text = '';
  text =
    `"orientation":{
            "heading":` +
    camera.heading +
    `,
            "pitch":` +
    camera.pitch +
    `,
            "roll":` +
    camera.roll +
    `
          },
          "position":{
            "x": ` +
    position.x +
    `,
            "y":` +
    position.y +
    `,
            "z":` +
    position.z +
    `
          },`;
  return text;
}

/**
 * @description: 控制切换视角的状态
 * @param {*} viewer
 * @param {*} viewPoint
 * @param {*} duration
 * @param {*} callback
 */
export function flytoControl(viewer, viewPoint, duration, callback) {
  let position = viewPoint.position;
  let orientation = viewPoint.orientation;
  viewer.scene.camera.flyTo({
    easingFunction: EasingFunction.LINEAR_NONE,
    destination: position,
    orientation: orientation,
    duration: duration,
    complete: callback,
  });
}

/**
 * @description: 获取相机位置以及角度信息
 * @param {*} viewer
 */
export function GetCameraPosition(viewer) {
  //let viewer = this._viewer;
  let handler = new ScreenSpaceEventHandler(viewer.canvas);
  handler.setInputAction(function (lclickment) {
    let scene = viewer.scene;
    let ellipsoid = scene.globe.ellipsoid;
    //var cartesian = LoadCesium.Viewer.camera.pickEllipsoid(lclickment.position, ellipsoid);
    let cartesian = viewer.scene.pickPosition(lclickment.position);
    /*eslint-disable-next-line */
    console.log(lclickment.position);
    // console.log("笛卡尔坐标:" + cartesian);
    let camera = viewer.camera;
    if (cartesian) {
      let cartographic = ellipsoid.cartesianToCartographic(cartesian);
      let clicklon = Math.toDegrees(cartographic.longitude).toFixed(7);
      let clicklat = Math.toDegrees(cartographic.latitude).toFixed(7);
      let lon = Math.toDegrees(viewer.camera.positionCartographic.longitude).toFixed(7);
      let lat = Math.toDegrees(viewer.camera.positionCartographic.latitude).toFixed(7);
      //地理高度
      let clickheight = (cartographic.height + 1).toFixed(2);
      //相机高度
      let height = viewer.camera.positionCartographic.height.toFixed(7);
      console.log(getCameraViewPoint(viewer));
      /*eslint-disable-next-line */
      console.log(`"position":{
        "longitude": ${lon},
        "latitude": ${lat},
        "height": ${height}
      }`);
      /*eslint-disable-next-line */
      console.log('鼠标点击经纬度:' + clicklon + ',' + clicklat + ',' + clickheight);
      /*eslint-disable-next-line */
      console.log(cartesian);
    }
  }, ScreenSpaceEventType.LEFT_CLICK);
}

export { disableCamera, enableCamera, windowShake, setCameraViewPoint };
