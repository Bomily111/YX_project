import * as Cesium from 'cesium';
import AppConfig from '@/config/AppConfig';
function loadGoogleMap(viewer) {
    viewer.imageryLayers.removeAll();
    viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
        url: 'https://gac-geo.googlecnapps.cn/maps/vt?lyrs=s&x={x}&y={y}&z={z}',
    }));
}
function loadArcGIS(viewer) {
    viewer.imageryLayers.removeAll();
    viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    }));
}
function loadGaodeMap(viewer) {
    viewer.imageryLayers.removeAll();
    viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
        url: 'http://webst02.is.autonavi.com/appmaptile?x={x}&y={y}&z={z}&style=8',
    }));
}
function loadOSM(viewer) {
    viewer.imageryLayers.removeAll();
    viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
        url: 'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
    }));
}
function loadTdT(viewer, appConfig) {
    const token = appConfig.tdtToken || '';
    viewer.imageryLayers.removeAll();
    viewer.imageryLayers.addImageryProvider(new Cesium.WebMapTileServiceImageryProvider({
        url: `https://t0.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=GoogleMapsCompatible&FORMAT=tiles&tk=${token}`,
        layer: 'img',
        style: 'default',
        format: 'image/jpeg',
        tileMatrixSetID: 'GoogleMapsCompatible',
        maximumLevel: 18,
    }));
}
function loadBingMapAerial(viewer, appConfig) {
    viewer.imageryLayers.removeAll();
    viewer.imageryLayers.addImageryProvider(new Cesium.IonImageryProvider({
        assetId: 2,
        accessToken: appConfig.ionToken,
        server: 'https://api.cesium.com',
    }));
}
async function loadCesiumWorldImagery(viewer) {
    viewer.imageryLayers.removeAll();
    const provider = await Cesium.createWorldImageryAsync({
        style: Cesium.IonWorldImageryStyle.AERIAL,
    });
    viewer.imageryLayers.addImageryProvider(provider);
}
export function loadMap(viewer) {
    const appConfig = new AppConfig().appConfig;
    if (!appConfig) {
        console.warn('[MapSource] appConfig 未加载，跳过地图背景初始化');
        return;
    }
    const provider = appConfig.mapProvider?.trim();
    const providerMap = new Map([
        ['ArcGIS Map', () => loadArcGIS(viewer)],
        ['Google Map', () => loadGoogleMap(viewer)],
        ['Tianditu Map', () => loadTdT(viewer, appConfig)],
        ['Bing Map', () => loadBingMapAerial(viewer, appConfig)],
        ['高德地图', () => loadGaodeMap(viewer)],
        ['OpenStreetMap', () => loadOSM(viewer)],
        ['Cesium Ion', () => loadCesiumWorldImagery(viewer)],
    ]);
    const loadCallback = providerMap.get(provider);
    if (loadCallback) {
        loadCallback();
        console.log(`[MapSource] 已加载地图背景: ${provider}`);
    }
    else {
        console.warn(`[MapSource] 未知的地图提供商: ${provider}`);
    }
}
