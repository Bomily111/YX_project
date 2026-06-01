/* eslint-disable prettier/prettier */
/*
 * @Author: Lincong-pro
 * @Date: 2023-04-01 22:41:18
 * @LastEditors: Lincong-pro
 * @LastEditTime: 2023-04-17 12:51:17
 * @FilePath: \geoproject2.0\src\utils\Common\Transform.ts
 * @Description: 坐标变换工具
 * Copyright (c) 2023 by VGE, All Rights Reserved.
 */
import { Cartesian2, Cartesian3, Cartographic, SceneTransforms } from 'cesium';
import { DTScopeEngine } from './Viewer';

enum ScreenToWGS84Type {
  CameraClass,
  SceneClass,
}

enum WGS84ToCartographicType {
  EllipsoidClass,
  CartographicClass,
}

/**
 * @description: 屏幕坐标转世界坐标
 * @param {Cartesian2} screenPosition
 * @param { ScreenToWGS84Type } type[转换的方式]
 * @return {*}
 */
export function screenToCartesian3(screenPosition: Cartesian2, type: ScreenToWGS84Type = ScreenToWGS84Type.SceneClass): Cartesian3 {
  let position = undefined;
  let viewer = DTScopeEngine.viewer;
  switch (type) {
    case ScreenToWGS84Type.CameraClass: {
      position = viewer.scene.camera.pickEllipsoid(screenPosition, viewer.scene.globe.ellipsoid);
      break;
    }
    case ScreenToWGS84Type.SceneClass: {
      position = viewer.scene.pickPosition(screenPosition);
      break;
    }
  }

  return position;
}

/**
 * @description: 从笛卡尔坐标系变换到屏幕坐标系
 * @param {Cartesian3} cartesian3 空间直角坐标系
 * @return {Cartesian2} 屏幕坐标
 */
export function cartesian3ToScreen(cartesian3: Cartesian3): Cartesian2 {
  let viewer = DTScopeEngine.viewer;
  return SceneTransforms.worldToWindowCoordinates(viewer.scene, cartesian3);
}

/**
 * @description: 空间直角坐标系转化为大地坐标系
 * @param {Cartesian3} cartesian3 笛卡尔坐标系
 * @param {WGS84ToCartographicType} type wgs84转化我大地坐标系的方法
 * @return {Cartographic} 大地坐标系
 */
export function cartesian3ToCartographic(
  cartesian3: Cartesian3,
  type: WGS84ToCartographicType = WGS84ToCartographicType.CartographicClass
): Cartographic {
  let cartographic = undefined;
  let viewer = DTScopeEngine.viewer;
  switch (type) {
    case WGS84ToCartographicType.EllipsoidClass: {
      let globe = viewer.scene.globe;
      let ellipsoid = globe.ellipsoid;
      cartographic = ellipsoid.cartesianToCartographic(cartesian3);
      break;
    }
    case WGS84ToCartographicType.CartographicClass: {
      cartographic = Cartographic.fromCartesian(cartesian3);
      break;
    }
  }

  return cartographic;
}

/**
 * @description: 转换大地坐标到笛卡尔坐标
 * @param {Cartographic} cartographic 笛卡尔坐标
 * @return {*}
 */
export function cartographicToCartesian3(cartographic: Cartographic): Cartesian3 {
  return Cartographic.toCartesian(cartographic);
}

/**
 * @description: 从经纬度数据转化为笛卡尔空间直角坐标
 * @param {Array} pnts [lon,lat,lon,lat...]
 * @return {*}
 */
export function cartographicArrayToCartesian3(pnts: Array<number>) {
  return Cartesian3.fromDegreesArray(pnts);
}

/**
 * @description: 从经度、纬度、高度转化为笛卡尔空间直角坐标
 * @param {Array} pnts [lon,lat,height,lon,lat,height...]
 * @return {*}
 */
export function cartographicArrayHeightsToCartesian3(pnts: Array<number>) {
  return Cartesian3.fromDegreesArrayHeights(pnts);
}
