/*
 * @Author: Lincong-pro
 * @Date: 2023-03-13 11:01:42
 * @LastEditors: Lincong-pro lincong_pro@163.com
 * @LastEditTime: 2024-05-07 14:26:09
 * @FilePath: \Geology-v3\src\utils\Common\Viewer.ts
 * @Description: 拆分Viewer创建类
 * Copyright (c) 2023 by VGE, All Rights Reserved.
 */
import * as Cesium from 'cesium';
import { GetCameraPosition } from '@/utils/Common/CameraControl';
import AppConfig from '@/config/AppConfig';

//函数部分
export function DTScopeEngine(vueGlobalConfig) {
  DTScopeEngine.loading = true;
  if (vueGlobalConfig == null) {
    return;
  }

  let configInstance = new AppConfig();
  let appConfig: any = configInstance.appConfig || configInstance || {};

  // Set Ion access token from config
  if (appConfig.ionToken) {
    Cesium.Ion.defaultAccessToken = appConfig.ionToken;
  }

  // create Cesium Viewer
  let viewer = new Cesium.Viewer('cesiumContainer', {
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    baseLayerPicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    timeline: false,
    animation: false,
    shouldAnimate: true,
    shadows: true,
    terrainShadows: Cesium.ShadowMode.RECEIVE_ONLY,
    contextOptions: {
      webgl: {
        preserveDrawingBuffer: true,
        alpha: true,
        stencil: true,
        antialias: true,
        depth: true,
        powerPreference: 'high-performance',
      },
    },
  });

  console.log('DTScopeEngine.viewer初始化');

  viewer.scene.globe.enableLighting = true;

  // 固定时间为正午，保持场景一直白天
  const noonTime = Cesium.JulianDate.fromIso8601('2024-06-21T04:00:00Z'); // UTC 04:00 = 北京时间 12:00
  viewer.clock.currentTime = noonTime.clone();
  viewer.clock.multiplier = 0;

  // adapter to company api
  DTScopeEngine.viewer = viewer;
  this._vueGlobalConfig = vueGlobalConfig;

  //config the global viewer
  if (Cesium.defined(viewer)) {
    // Configure viewer parameters
    viewer._cesiumWidget._creditContainer.style.display = 'none';
    // Smooth the earth edge
    viewer.scene.postProcessStages.fxaa.enabled = true;
    //@ts-ignore
    viewer._cesiumWidget._supportsImageRenderingPixelated = Cesium.FeatureDetection.supportsImageRenderingPixelated();
    viewer._cesiumWidget._forceResize = true;
    //@ts-ignore
    if (Cesium.FeatureDetection.supportsImageRenderingPixelated()) {
      let vtxfDpr = window.devicePixelRatio;
      while (vtxfDpr >= 2.0) {
        vtxfDpr /= 2.0;
      }
      viewer.resolutionScale = vtxfDpr;
    }
  } else {
    vueGlobalConfig.$Message({
      showClose: true,
      message: 'DTScope引擎初始化失败!',
      type: 'error',
    });
    throw new Cesium.DeveloperError('Init DTScope Engine Failed !');
  }

  if (appConfig.debugMode) {
    GetCameraPosition(viewer); // 右键可输出视角信息
  }

  // 捕获渲染异常，防止 Cesium 永久停止渲染循环
  viewer.scene.renderError.addEventListener((_scene: any, error: any) => {
    console.warn('[DTScope] Cesium 渲染异常，自动恢复渲染循环：', error);
    viewer.useDefaultRenderLoop = true;
  });
}

/**
 * 供js/ts进行调用
 * @returns {Cesium.Viewer}
 */
DTScopeEngine.viewer = undefined;

/**
 * 通过传入一个回调函数执行getViewer回调的过程
 * @param {function} callback
 */
DTScopeEngine.getViewer = (callback) => {
  let timerId = undefined;
  timerId = setTimeout(function monitor() {
    if (typeof DTScopeEngine.viewer == 'undefined') {
      timerId = setTimeout(monitor, 300);
    } else {
      clearTimeout(timerId);
      callback();
    }
  }, 100);
};

// 是否仍然处于初始化引擎中
DTScopeEngine.loading = true;

// 静态属性
DTScopeEngine.instance = null;

/**
 * es5单例模式
 * @param {appContext.config.globalProperties} vueGlobalConfig
 * @returns { DTScopeEngine} instance
 */
DTScopeEngine.getInstance = (vueGlobalConfig) => {
  if (!DTScopeEngine.instance) {
    DTScopeEngine.instance = new DTScopeEngine(vueGlobalConfig);
  }

  return DTScopeEngine.instance;
};

DTScopeEngine.destroy = () => {
  if (DTScopeEngine.viewer) {
    DTScopeEngine.viewer.entities.removeAll();
    DTScopeEngine.viewer.destroy();
  }
  DTScopeEngine.instance = null;
};
