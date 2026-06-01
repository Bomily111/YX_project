import * as Cesium from 'cesium';

export function loadTerrain(viewer: any) {
  Cesium.createWorldTerrainAsync({
    requestVertexNormals: true,
    requestWaterMask: false,
  }).then((provider) => {
    viewer.terrainProvider = provider;
  }).catch((e) => {
    console.warn('[TerrainSource] 地形加载失败：', e);
  });
}

export function unloadTerrain(viewer: any) {
  viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
}
