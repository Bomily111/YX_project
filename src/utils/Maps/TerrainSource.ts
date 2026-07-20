import * as Cesium from 'cesium';

export function loadTerrain(viewer: any) {
  Cesium.createWorldTerrainAsync({
    requestVertexNormals: false,
    requestWaterMask: false,
  }).then((provider) => {
    viewer.scene.globe.maximumScreenSpaceError = 8;
    viewer.terrainProvider = provider;
  }).catch((e) => {
    console.warn('[TerrainSource] 地形加载失败：', e);
  });
}

export function unloadTerrain(viewer: any) {
  viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
}
