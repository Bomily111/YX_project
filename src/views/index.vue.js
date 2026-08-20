import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import * as Cesium from 'cesium'; // 引入 Cesium
import { ScreenSpaceEventHandler, ScreenSpaceEventType } from 'cesium'; // 引入事件处理器
import DTGlobe from '@/components/DTGlobe/DTGlobe.vue';
import OverviewHUD from '@/views/Overview/OverviewHUD.vue';
import WorkfaceInfoPanel from '@/views/WorkfaceInfoPanel.vue';
import SceneDataPanel from '@/views/Overview/SceneDataPanel.vue';
import SceneControlPanel from '@/views/Overview/SceneControlPanel.vue';
import PredictionCenter from '@/views/Overview/PredictionCenter.vue';
import Lining from '@/components/SceneManagement/LiningComponents/Lining.vue';
import DispatchPersonnel from '@/components/SceneManagement/DispatchComponents/DispatchPersonnel.vue';
import DispatchEquipment from '@/components/SceneManagement/DispatchComponents/DispatchEquipment.vue';
import DispatchGantt from '@/components/SceneManagement/DispatchComponents/DispatchGantt.vue';
import ProcessingWorkflowSidebar from '@/views/chaobao/ProcessingWorkflowSidebar.vue';
import BLDZ from '@/components/SceneManagement/BLDZComponents/BLDZ.vue';
import ZZMSM from '@/components/SceneManagement/ZZMSMComponents/ZZMSM.vue';
import DZLD from '@/components/SceneManagement/DZLDComponents/DZLD.vue';
import AHD from '@/components/SceneManagement/AHDComponents/AHD.vue';
import DBH from '@/components/SceneManagement/DBHComponents/DBH.vue';
import TSP from '@/components/SceneManagement/TSPComponents/TSP.vue';
import TEM from '@/components/SceneManagement/TEMComponents/TEM.vue';
import DTVolume from '@/utils/AllPrevious/All/DTVolume.vue';
import Toolbar from '@/components/Toolbar.vue';
import RoamingToolbar from '@/components/RoamingToolbar.vue';
import MileageSearchBar from '@/components/MileageSearchBar.vue';
import { DTScopeEngine } from '@/utils/Common/Viewer';
import { loadCenterLine, enableBlackModelMode, restoreEarthMode, loadTunnelGlb, enableTerrainTransparency, setTunnelGlbVisible, setTunnelTranslucent, setWindTunnelTranslucent, setCenterLineVisible, removeRebarMeshes, removeSecondRebarMeshes, removeSteelFrameMeshes, removePipeShedMeshes, removeAnchorMeshes, removeConduitMeshes, removeLockAnchorMeshes, loadWindTunnelGlb, removeWindTunnelGlb, setWindTunnelVisible, setDesignRockGradeModelEnabled, flyToDesignRockGradeSegment } from '@/utils/Common/DrawLine';
import { createMileageRuler, getMileageRuler } from '@/utils/Common/MileageRuler';
import { activateGeoModel, deactivateGeoModel, loadRockModel, setRockModelVisible, mergeModelConfigsFromApi } from '@/utils/Common/GeoModelController';
import { loadTerrain } from '@/utils/Maps/TerrainSource';
import { addTunnelEntities, removeTunnelEntities } from '@/utils/Common/TunnelEntities';
import { removeVectorField } from '@/utils/Common/WindVectorField';
import { removeProceduralWind } from '@/utils/Common/TunnelWindSimulation';
import { AgentChat } from '@/ai-agent';
import { useSceneStore } from '@/stores/sceneStore';
import { useTunnelStore } from '@/stores/tunnelStore';
import { useModelStore } from '@/stores/modelStore';
import { useMonitorStore } from '@/stores/monitorStore';
// ── Stores ──────────────────────────────────────────────
const router = useRouter();
const sceneStore = useSceneStore();
const tunnelStore = useTunnelStore();
const modelStore = useModelStore();
// ── 侧边栏 / 模型视图模式状态 ────────────────────────────
const isModelViewMode = ref(false);
// ── 总览/场景模式状态 ─────────────────────────────────────
const activeScene = ref(null);
// ── 场景定义（供 OverviewHUD + fly-to 使用） ──────────────
const SCENE_DEFS = {
    workface: {
        key: 'workface', name: '隧洞围岩', icon: '⬡',
        color: '#00e5ff', status: '作业中', statusCls: 'dot-cyan',
        metricVal: 'V级', metricUnit: '围岩',
        flyTo: { lon: 94.905078, lat: 29.532676, height: 2978.7, heading: 30.49, pitch: -21.33 },
    },
    blast: {
        key: 'blast', name: '开挖爆破', icon: '💥',
        color: '#ff6b35', status: '待命', statusCls: 'dot-orange',
        metricVal: '22:00', metricUnit: '计划',
        flyTo: { lon: 101.7360, lat: 30.0545, height: 3900, heading: 200, pitch: -15 },
    },
    support: {
        key: 'support', name: '围岩支护', icon: '◈',
        color: '#aa88ff', status: '正常', statusCls: 'dot-purple',
        metricVal: '8.2', metricUnit: 'mm',
        flyTo: { lon: 94.894196, lat: 29.532596, height: 2951.3, heading: 39.30, pitch: -10.91 },
    },
    vent: {
        key: 'vent', name: '通风除尘', icon: '≋',
        color: '#44ff88', status: '运行', statusCls: 'dot-green',
        metricVal: '3.2', metricUnit: 'm/s',
        flyTo: { lon: 94.914943, lat: 29.528810, height: 3000.4, heading: 70.61, pitch: -9.83 },
    },
    dispatch: {
        key: 'dispatch', name: '装备调度', icon: '◎',
        color: '#ffaa00', status: '运行', statusCls: 'dot-yellow',
        metricVal: '28', metricUnit: '人在岗',
        flyTo: { lon: 101.8200, lat: 30.0200, height: 3650, heading: 100, pitch: -25 },
    },
};
const SCENE_DEFS_LIST = computed(() => Object.values(SCENE_DEFS));
// 总览模式相机视角（透视隧道整体）
const OVERVIEW_MODE_VIEW = {
    destination: Cesium.Cartesian3.fromDegrees(94.892033, 29.530969, 3066.1),
    orientation: {
        heading: Cesium.Math.toRadians(47.39),
        pitch: Cesium.Math.toRadians(-21.34),
        roll: 0,
    },
};
// ── Header：里程进度 & 系统状态灯 ─────────────────────────
// 线路总里程 DK278+100 ~ DK286+400，当前掌子面 DK281+500
const mileageProgress = ((281500 - 278100) / (286400 - 278100) * 100).toFixed(1);
const sysStatus = [
    { name: '围岩', cls: 'dot-yellow' },
    { name: '通风', cls: 'dot-green' },
    { name: '调度', cls: 'dot-green' },
];
const overviewMetrics = reactive({ advance: '--', personnel: '--', muck: '--' });
// ── 工具栏状态 ─────────────────────────────────────────
const activeTool = ref(null);
function handleToggleTool(tool) {
    activeTool.value = activeTool.value === tool ? null : tool;
}
function handleToolAction(action) {
    if (action === 'fullscreen') {
        const el = document.documentElement;
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }
        else {
            el.requestFullscreen();
        }
    }
    else if (action === 'screenshot') {
        const viewer = getViewer();
        if (viewer) {
            const canvas = viewer.scene.canvas;
            const link = document.createElement('a');
            link.download = `screenshot-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }
    }
}
// ── 支护 / 通风 / 调度场景状态 ────────────────────────────
const showLining = ref(false);
const showDispatchPersonnel = ref(false);
const showDispatchEquipment = ref(false);
const showDispatchGantt = ref(false);
const processingModelKey = ref(null);
// 从 tunnelStore 动态获取工点列表，API 不可用时使用本地默认值
const worksiteList = computed(() => {
    const store = useTunnelStore();
    if (store.worksites.length) {
        return store.worksites.map(w => ({
            id: w.id,
            name: w.name,
            mileage: 'DK' + (w.dk_number / 1000).toFixed(3).replace('.', '+'),
            lon: w.lon,
            lat: w.lat,
            height: w.height,
            rockLevel: w.rock_classification + '级',
            area: w.cross_section_area_m2 ? w.cross_section_area_m2 + ' m²' : '--',
            method: w.excavation_method === 'drill_blast' ? '钻爆法' : w.excavation_method === 'bench_method' ? '台阶法' : w.excavation_method === 'full_face' ? '全断面法' : w.excavation_method,
            hardness: '--',
            riskLevel: w.risk_level === 'high' ? '高风险' : w.risk_level === 'medium' ? '中风险' : w.risk_level === 'low' ? '低风险' : w.risk_level,
        }));
    }
    // fallback
    return [
        { id: 'worksite_a', name: 'DK工点A', mileage: 'DK279+200', lon: 94.905619, lat: 29.533374, height: 2945.5, rockLevel: 'IV级', area: '76.5 m²', method: '台阶法', hardness: '较硬岩', riskLevel: '中风险' },
        { id: 'worksite_b', name: 'DK工点B', mileage: 'DK283+100', lon: 94.938499, lat: 29.513774, height: 2965.0, rockLevel: 'V级', area: '82.3 m²', method: '全断面法', hardness: '软岩', riskLevel: '高风险' },
    ];
});
// ── 工点交互状态 ─────────────────────────────────────────
const selectedWorksite = ref(null);
let worksiteClickHandler = null;
// --- 时间日期逻辑 ---
const timeStr = ref('');
const dateStr = ref('');
let timer = null;
const updateTime = () => {
    const now = new Date();
    timeStr.value = now.toLocaleTimeString('zh-CN', { hour12: false });
    dateStr.value = now.toLocaleDateString('zh-CN');
};
// --- 菜单配置 ---
const groups = reactive({ badGeo: true, forecast: true });
const currentActiveKey = ref('');
// --- 不良地质 / 超前预报 面板状态 ---
const isBLDZ = ref(false);
const selectedValue = ref('');
const showzzmsm = ref(false);
const isRadar = ref(false);
const isAHD = ref(false);
const isDBH = ref(false);
const isTSP = ref(false);
const isTEM = ref(false);
// key → 中文名 映射
const keyNameMap = {
    weak_rock: '软弱围岩',
    high_stress: '高地应力',
    water_zone: '富水带',
    fracture_zone: '破碎带',
    face_sketch: '掌子面素描',
    gpr: '地质雷达',
    horiz_drill: '超前水平钻',
    deep_hole: '加深炮孔',
    tsp: 'TSP反演',
    tem: '瞬变电磁',
};
// --- 辅助函数：安全获取 Viewer 实例 ---
const getViewer = () => {
    if (window.viewer)
        return window.viewer;
    if (DTScopeEngine && DTScopeEngine.viewer)
        return DTScopeEngine.viewer;
    return null;
};
// ── 添加工点实体 ─────────────────────────────────────────
const addWorksiteEntities = (viewer) => {
    worksiteList.value.forEach(site => {
        viewer.entities.add({
            id: site.id,
            name: site.name,
            position: Cesium.Cartesian3.fromDegrees(site.lon, site.lat, site.height),
            point: {
                pixelSize: 16,
                color: Cesium.Color.fromCssColorString('#ff9900'),
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 2,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            label: {
                text: site.name,
                font: 'bold 14px Microsoft YaHei',
                fillColor: Cesium.Color.fromCssColorString('#ffdd88'),
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -24),
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
        });
    });
};
// ── 工点显隐控制 ─────────────────────────────────────────
const setWorksiteVisible = (show) => {
    const viewer = getViewer();
    if (!viewer)
        return;
    worksiteList.value.forEach(site => {
        const entity = viewer.entities.getById(site.id);
        if (entity)
            entity.show = show;
    });
};
// ── 注册工点点击事件 ──────────────────────────────────────
const setupWorksiteClickHandler = (viewer) => {
    worksiteClickHandler = new ScreenSpaceEventHandler(viewer.canvas);
    worksiteClickHandler.setInputAction((click) => {
        const picked = viewer.scene.pick(click.position);
        if (Cesium.defined(picked) && picked.id) {
            const entityId = picked.id.id;
            const site = worksiteList.value.find(s => s.id === entityId);
            if (site) {
                router.push('/blast-twin');
            }
        }
    }, ScreenSpaceEventType.LEFT_CLICK);
};
// ── 相机视角常量 ──────────────────────────────────────────
const INITIAL_VIEW = {
    destination: Cesium.Cartesian3.fromDegrees(101.660451, 30.096231, 4909.6),
    orientation: {
        heading: Cesium.Math.toRadians(104.36),
        pitch: Cesium.Math.toRadians(-11.49),
        roll: 0,
    },
};
// 线路总览视角：俯视整条中线
const OVERVIEW_VIEW = {
    destination: Cesium.Cartesian3.fromDegrees(94.868546, 29.460784, 10402.4),
    orientation: {
        heading: Cesium.Math.toRadians(38.99),
        pitch: Cesium.Math.toRadians(-36.85),
        roll: 0,
    },
};
// ── 跳转线路总览 ──────────────────────────────────────────
const flyToOverview = () => {
    activeScene.value = null;
    const viewer = getViewer();
    if (!viewer)
        return;
    viewer.scene.camera.flyTo({ ...OVERVIEW_VIEW, duration: 2 });
};
// --- 悬浮拖拽逻辑与图层状态 ---
const drag = reactive({ left: window.innerWidth - 550, top: 100, isDragging: false, startX: 0, startY: 0 });
const panelCollapsed = ref(false);
const layerState = reactive({ showModel: true, showMap: true, showTunnel: true, showRock: true, showWindTunnel: true, showMileageRuler: false });
// ── 核心逻辑：初始化场景数据 ─────────────────────────────
const initSceneData = () => {
    let retryCount = 0;
    const tryLoad = () => {
        const viewer = getViewer();
        if (!viewer) {
            if (retryCount < 20) {
                retryCount++;
                setTimeout(tryLoad, 100);
            }
            else {
                console.warn("⚠️ 等待 Viewer 初始化超时，中线可能未加载");
            }
            return;
        }
        console.log("✅ 地图引擎已就绪，加载中线与工点...");
        // skipZoom=true：跳过内部 zoomTo，避免其异步飞行覆盖初始视角
        loadCenterLine(undefined, true, true);
        try {
            loadTunnelGlb();
        }
        catch (e) {
            console.warn('⚠️ 隧道模型加载失败，跳过：', e);
        }
        // 初始化里程刻度尺（默认隐藏，通过图层面板开关控制）
        try {
            createMileageRuler(viewer).hide();
        }
        catch (e) {
            console.warn('⚠️ 里程刻度尺初始化失败：', e);
        }
        // 默认进入总览视角
        viewer.camera.setView(OVERVIEW_MODE_VIEW);
        // 加载隧道动态实体（车辆、人员、热点标记）
        addTunnelEntities((hotspotKey) => {
            handleSelectScene(hotspotKey);
        });
        // 影像默认勾选：loadCenterLine 会调 enableBlackModelMode，在其之后恢复地球
        if (layerState.showMap) {
            restoreEarthMode(viewer);
            loadTerrain(viewer);
            if (viewer.imageryLayers.length > 0)
                viewer.imageryLayers.get(0).show = true;
            enableTerrainTransparency(viewer); // 开启透视效果：远看山体，近看透视隧道/中线
        }
        if (layerState.showRock)
            loadRockModel(viewer);
        addWorksiteEntities(viewer);
        setupWorksiteClickHandler(viewer);
        // 从后端加载场景、隧道、模型配置数据
        sceneStore.fetchScenes();
        tunnelStore.fetchTunnels().then(() => {
            if (tunnelStore.currentTunnelId) {
                modelStore.fetchModels(tunnelStore.currentTunnelId).then(() => {
                    mergeModelConfigsFromApi(modelStore.models);
                });
                tunnelStore.fetchWorksites(tunnelStore.currentTunnelId);
            }
        });
    };
    tryLoad();
};
// --- 交互：点击左侧按钮 ---
const handleLayerSelect = (item) => {
    isModelViewMode.value = true;
    currentActiveKey.value = item.key;
    const name = keyNameMap[item.key] ?? item.name;
    // 重置所有面板
    isBLDZ.value = false;
    showzzmsm.value = false;
    isRadar.value = false;
    isAHD.value = false;
    isDBH.value = false;
    isTSP.value = false;
    isTEM.value = false;
    selectedValue.value = '';
    // 加载对应地质模型（体数据 / GLB 统一由 GeoModelController 处理）
    const VOLUME_KEYS = ['weak_rock', 'water_zone', 'fracture_zone', 'tsp', 'tem', 'face_sketch', 'horiz_drill', 'gpr'];
    if (VOLUME_KEYS.includes(item.key)) {
        activateGeoModel(item.key);
    }
    else {
        // 切换到非体数据界面时清理体数据模型，防止 WebGL canvas 残留
        deactivateGeoModel();
    }
    if (name === '掌子面素描') {
        showzzmsm.value = true;
    }
    else if (name === '地质雷达') {
        isRadar.value = true;
    }
    else if (name === '超前水平钻') {
        isAHD.value = true;
    }
    else if (name === '加深炮孔') {
        isDBH.value = true;
    }
    else if (name === 'TSP反演') {
        isTSP.value = true;
    }
    else if (name === '瞬变电磁') {
        isTEM.value = true;
    }
    else {
        // 不良地质类型：软弱围岩、高地应力、富水带、破碎带
        isBLDZ.value = true;
        selectedValue.value = name;
    }
};
const handlePanelAction = (action, type = 'view') => {
    const isWorkflowAction = activeScene.value === 'workface';
    // 支护场景的"钢架试验"按钮 → 跳转参数化试验子模块
    if (activeScene.value === 'support' && action.key === 'experiment') {
        router.push('/support-experiment');
        return;
    }
    // 支护场景的"属性面板"按钮 → 切换可拖放支护参数面板
    if (activeScene.value === 'support' && action.key === 'monitor') {
        showLining.value = !showLining.value;
        return;
    }
    // 调度场景的各按钮 → 切换对应可拖放面板
    if (activeScene.value === 'dispatch') {
        if (action.key === 'track') {
            showDispatchPersonnel.value = !showDispatchPersonnel.value;
            return;
        }
        if (action.key === 'equip') {
            showDispatchEquipment.value = !showDispatchEquipment.value;
            return;
        }
        if (action.key === 'gantt') {
            showDispatchGantt.value = !showDispatchGantt.value;
            return;
        }
    }
    if (isWorkflowAction && type === 'process') {
        // 点击了 '🛠️' 按钮，打开工作流侧边栏
        // 如果有其他模型视图开着，先关掉
        isModelViewMode.value = false;
        deactivateGeoModel();
        isBLDZ.value = false;
        showzzmsm.value = false;
        isRadar.value = false;
        isAHD.value = false;
        isDBH.value = false;
        isTSP.value = false;
        isTEM.value = false;
        // 打开工作流侧边栏
        processingModelKey.value = action.key;
    }
    else {
        // 对于所有 'view' 点击 (按钮主体), 或者非 workface 场景的点击
        handleLayerSelect({ key: action.key, name: keyNameMap[action.key] || '' });
    }
};
const handleRockVersionChange = async (version) => {
    const viewer = getViewer();
    if (!viewer)
        return;
    layerState.showTunnel = true;
    setTunnelGlbVisible(true);
    try {
        await setDesignRockGradeModelEnabled(version === 'design', viewer);
    }
    catch (error) {
        console.error('[围岩分级] 设计版模型加载失败:', error);
    }
};
const handleRockSegmentSelect = async (segment) => {
    const viewer = getViewer();
    if (!viewer)
        return;
    layerState.showTunnel = true;
    setTunnelGlbVisible(true);
    try {
        await flyToDesignRockGradeSegment(segment.modelIndex, viewer);
    }
    catch (error) {
        console.error('[围岩分级] 里程区段跳转失败:', error);
    }
};
const handleProcessingComplete = () => {
    console.log(`自动化处理完成，准备展示结果...`);
    const completedModelKey = processingModelKey.value;
    if (!completedModelKey) {
        console.error("处理完成，但找不到对应的模型key。");
        return;
    }
    // 关闭处理侧边栏
    processingModelKey.value = null;
    // 调用现有的模型查看逻辑
    // 这会切换到模型视图，并调用 activateGeoModel(completedModelKey)
    handleLayerSelect({ key: completedModelKey, name: keyNameMap[completedModelKey] || '' });
    console.log(`✅ 已触发 '${keyNameMap[completedModelKey]}' 模型的显示。`);
};
const handleWorkflowBack = () => {
    processingModelKey.value = null;
};
// ── 地形透明度滑条 ─────────────────────────────────────────
const terrainAlpha = ref(0.9);
const onTerrainAlphaInput = (e) => {
    const val = Number(e.target.value) / 100;
    terrainAlpha.value = val;
    const viewer = getViewer();
    if (!viewer)
        return;
    const globe = viewer.scene.globe;
    if (!globe.translucency.enabled)
        return;
    globe.translucency.frontFaceAlphaByDistance.nearValue = val;
    globe.translucency.frontFaceAlphaByDistance.farValue = val;
    viewer.scene.requestRender();
};
const startDrag = (e) => {
    drag.isDragging = true;
    drag.startX = e.clientX - drag.left;
    drag.startY = e.clientY - drag.top;
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
};
const onDrag = (e) => {
    if (!drag.isDragging)
        return;
    drag.left = e.clientX - drag.startX;
    drag.top = e.clientY - drag.startY;
};
const stopDrag = () => {
    drag.isDragging = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
};
const toggle3DModel = () => {
    setCenterLineVisible(layerState.showModel);
    setWorksiteVisible(layerState.showModel);
    getViewer()?.scene.requestRender();
};
const toggleTunnelModel = () => {
    setTunnelGlbVisible(layerState.showTunnel);
    getViewer()?.scene.requestRender();
};
// ── 隧道透视状态 ──────────────────────────────────────
const isXray = ref(false);
function toggleXray() {
    isXray.value = !isXray.value;
    setTunnelTranslucent(isXray.value);
    getViewer()?.scene.requestRender();
}
const toggleRockModel = () => {
    if (layerState.showRock) {
        loadRockModel(getViewer());
    }
    setRockModelVisible(layerState.showRock);
    getViewer()?.scene.requestRender();
};
const toggleWindTunnelModel = () => {
    setWindTunnelVisible(layerState.showWindTunnel);
    getViewer()?.scene.requestRender();
};
// ── 通风透视状态 ──────────────────────────────────────
const isWindXray = ref(false);
function toggleWindXray() {
    isWindXray.value = !isWindXray.value;
    setWindTunnelTranslucent(isWindXray.value);
    getViewer()?.scene.requestRender();
}
const toggleImagery = () => {
    const v = getViewer();
    if (!v)
        return;
    // 在模型视图模式下只切换影像图层，不恢复/切换黑底
    if (!isModelViewMode.value) {
        if (layerState.showMap) {
            restoreEarthMode(v);
        }
        else {
            enableBlackModelMode(v);
            // 保留地形高程，确保缩放/旋转手感与有底图时一致
        }
    }
    if (v.imageryLayers.length > 0) {
        v.imageryLayers.get(0).show = layerState.showMap;
    }
    v.scene.requestRender();
};
const toggleMileageRuler = () => {
    const ruler = getMileageRuler();
    if (!ruler)
        return;
    if (layerState.showMileageRuler) {
        ruler.show();
    }
    else {
        ruler.hide();
    }
};
/** 复制当前相机视角到剪贴板 */
const copyCurrentView = () => {
    const viewer = getViewer();
    if (!viewer)
        return;
    const cam = viewer.scene.camera;
    const pos = cam.positionCartographic;
    console.log(`📷 当前视角:\ndestination: Cesium.Cartesian3.fromDegrees(${Cesium.Math.toDegrees(pos.longitude).toFixed(6)}, ${Cesium.Math.toDegrees(pos.latitude).toFixed(6)}, ${pos.height.toFixed(1)}),\norientation: {\n  heading: Cesium.Math.toRadians(${Cesium.Math.toDegrees(cam.heading).toFixed(2)}),\n  pitch:   Cesium.Math.toRadians(${Cesium.Math.toDegrees(cam.pitch).toFixed(2)}),\n  roll:    0,\n},`);
};
// ── AI Agent 场景跳转处理 ───────────────────────────────
const handleAgentSceneOpen = (scene) => {
    if (scene === 'blast') {
        router.push('/blast-twin');
        return;
    }
    if (scene === 'support') {
        router.push('/support-experiment');
        return;
    }
    // 其他场景：在主 Viewer 上激活
    if (SCENE_DEFS[scene]) {
        handleSelectScene(scene);
    }
};
// ── 选择场景：相机飞向近景 + 打开双侧面板 ───────────────
const handleSelectScene = (key) => {
    const def = SCENE_DEFS[key];
    if (!def)
        return;
    const viewer = getViewer();
    if (!viewer)
        return;
    // 开挖爆破：跳转孪生子模块
    if (key === 'blast') {
        router.push('/blast-twin');
        return;
    }
    activeScene.value = key;
    // 通风除尘场景：切换为风场模拟隧道模型
    if (key === 'vent') {
        layerState.showModel = false;
        setCenterLineVisible(false);
        setWorksiteVisible(false);
        setTunnelGlbVisible(false);
        loadWindTunnelGlb(viewer, true, true);
    }
    else {
        // 进入其他场景时恢复隧道模型
        removeWindTunnelGlb(viewer);
        removeVectorField(viewer);
        removeProceduralWind(viewer);
        layerState.showModel = true;
        setCenterLineVisible(true);
        setWorksiteVisible(true);
        setTunnelGlbVisible(layerState.showTunnel);
        setWindTunnelTranslucent(false);
    }
    setDesignRockGradeModelEnabled(key === 'workface', viewer).catch((error) => {
        console.error('[围岩分级] 设计版模型加载失败:', error);
    });
    // 关闭所有场景浮层
    showLining.value = false;
    showDispatchPersonnel.value = false;
    showDispatchEquipment.value = false;
    showDispatchGantt.value = false;
    viewer.scene.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(def.flyTo.lon, def.flyTo.lat, def.flyTo.height),
        orientation: {
            heading: Cesium.Math.toRadians(def.flyTo.heading),
            pitch: Cesium.Math.toRadians(def.flyTo.pitch),
            roll: 0,
        },
        duration: 2.2,
        easingFunction: Cesium.EasingFunction.QUINTIC_OUT,
    });
};
// ── 返回总览：关闭面板 + 相机飞回总览视角 ───────────────
const handleBackToOverview = () => {
    activeScene.value = null;
    // 关闭所有场景浮层
    showLining.value = false;
    showDispatchPersonnel.value = false;
    showDispatchEquipment.value = false;
    showDispatchGantt.value = false;
    const viewer = getViewer();
    if (!viewer)
        return;
    setDesignRockGradeModelEnabled(false, viewer);
    // 如果是从模型视图返回，需要清理状态
    if (isModelViewMode.value) {
        isModelViewMode.value = false;
        currentActiveKey.value = '';
        isBLDZ.value = false;
        showzzmsm.value = false;
        isRadar.value = false;
        isAHD.value = false;
        isDBH.value = false;
        isTSP.value = false;
        isTEM.value = false;
        isXray.value = false;
        isWindXray.value = false;
        setTunnelTranslucent(false);
        setWindTunnelTranslucent(false);
        deactivateGeoModel(viewer);
        // 如果是从工作流侧边栏返回，也要重置
        if (processingModelKey.value) {
            processingModelKey.value = null;
        }
    }
    // 清理支护场景的所有支护构件模型
    removeRebarMeshes(viewer);
    removeSecondRebarMeshes(viewer);
    removeSteelFrameMeshes(viewer);
    removePipeShedMeshes(viewer);
    removeAnchorMeshes(viewer);
    removeConduitMeshes(viewer);
    removeLockAnchorMeshes(viewer);
    // 清理风场隧道模型，恢复隧道模型
    removeWindTunnelGlb(viewer);
    removeVectorField(viewer);
    removeProceduralWind(viewer);
    setTunnelGlbVisible(layerState.showTunnel);
    setWindTunnelTranslucent(false);
    layerState.showModel = true;
    setCenterLineVisible(true);
    setWorksiteVisible(true);
    // 恢复地球模式
    restoreEarthMode(viewer);
    if (layerState.showMap) {
        loadTerrain(viewer);
        if (viewer.imageryLayers.length > 0)
            viewer.imageryLayers.get(0).show = true;
        enableTerrainTransparency(viewer);
    }
    viewer.scene.camera.flyTo({
        ...OVERVIEW_MODE_VIEW,
        duration: 2.0,
        easingFunction: Cesium.EasingFunction.QUINTIC_OUT,
        complete: () => {
            // 确保在总览模式下，图层可见性与勾选框一致
            setCenterLineVisible(layerState.showModel);
            setTunnelGlbVisible(layerState.showTunnel);
            setRockModelVisible(layerState.showRock);
            setWorksiteVisible(layerState.showModel);
        }
    });
};
async function loadApiData() {
    try {
        const sceneStore = useSceneStore();
        const tunnelStore = useTunnelStore();
        const modelStore = useModelStore();
        const monitorStore = useMonitorStore();
        await Promise.all([sceneStore.fetchScenes(), tunnelStore.fetchTunnels()]);
        if (tunnelStore.currentTunnelId) {
            await Promise.all([
                modelStore.fetchModels(tunnelStore.currentTunnelId),
                tunnelStore.fetchWorksites(tunnelStore.currentTunnelId),
                monitorStore.fetchOverviewMetrics(),
            ]);
            if (modelStore.models.length) {
                mergeModelConfigsFromApi(modelStore.models);
            }
            const vals = monitorStore.latestByMetricKey;
            overviewMetrics.advance = vals['daily_advance']?.toString() || '--';
            overviewMetrics.muck = vals['muck_volume']?.toString() || '--';
            overviewMetrics.personnel = vals['personnel_count']?.toString() || '--';
            console.log('[API] 数据加载完成');
        }
    }
    catch (e) {
        console.warn('[API] 后端不可用，使用本地硬编码数据:', e.message);
    }
}
onMounted(() => {
    updateTime();
    timer = setInterval(updateTime, 1000);
    // 延迟一点启动，给 Viewer 初始化留出缓冲时间
    setTimeout(initSceneData, 800);
    loadApiData();
});
onBeforeUnmount(() => {
    clearInterval(timer);
    if (worksiteClickHandler) {
        worksiteClickHandler.destroy();
        worksiteClickHandler = null;
    }
    removeTunnelEntities();
    setTunnelTranslucent(false);
    setWindTunnelTranslucent(false);
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['title-container']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-metrics-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-metrics-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-metrics-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-metrics-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-metrics-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-metrics-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-metrics-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-metrics-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-metrics-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-metrics-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-metrics-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['chip-val']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-metrics-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['chip-val']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-metrics-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['chip-val']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-metrics-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['chip-val']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-metrics-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-metrics-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-metrics-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-metrics-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-metrics-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['overview-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['copy-view-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['date-time-group']} */ ;
/** @type {__VLS_StyleScopedClasses['date-time-group']} */ ;
/** @type {__VLS_StyleScopedClasses['left-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['left-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['group-header']} */ ;
/** @type {__VLS_StyleScopedClasses['arrow']} */ ;
/** @type {__VLS_StyleScopedClasses['layer-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['layer-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['layer-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['layer-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['layer-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['selected']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-text']} */ ;
/** @type {__VLS_StyleScopedClasses['layer-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['layer-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['selected']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-arrow']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox-item']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox-item']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox-item']} */ ;
/** @type {__VLS_StyleScopedClasses['custom-check']} */ ;
/** @type {__VLS_StyleScopedClasses['xray-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['xray-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['item-arrow']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "dashboard-container" },
});
/** @type {__VLS_StyleScopedClasses['dashboard-container']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "globe-layer" },
});
/** @type {__VLS_StyleScopedClasses['globe-layer']} */ ;
const __VLS_0 = DTGlobe;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
    ...{ class: "tech-header" },
});
/** @type {__VLS_StyleScopedClasses['tech-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "header-left" },
});
/** @type {__VLS_StyleScopedClasses['header-left']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "title-container" },
});
/** @type {__VLS_StyleScopedClasses['title-container']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "logo-text" },
});
/** @type {__VLS_StyleScopedClasses['logo-text']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "header-center" },
});
/** @type {__VLS_StyleScopedClasses['header-center']} */ ;
const __VLS_5 = OverviewHUD;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    ...{ 'onSelectScene': {} },
    ...{ 'onBackToOverview': {} },
    activeScene: (__VLS_ctx.activeScene),
    scenes: (__VLS_ctx.SCENE_DEFS_LIST),
}));
const __VLS_7 = __VLS_6({
    ...{ 'onSelectScene': {} },
    ...{ 'onBackToOverview': {} },
    activeScene: (__VLS_ctx.activeScene),
    scenes: (__VLS_ctx.SCENE_DEFS_LIST),
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
let __VLS_10;
const __VLS_11 = ({ selectScene: {} },
    { onSelectScene: (__VLS_ctx.handleSelectScene) });
const __VLS_12 = ({ backToOverview: {} },
    { onBackToOverview: (__VLS_ctx.handleBackToOverview) });
var __VLS_8;
var __VLS_9;
const __VLS_13 = MileageSearchBar;
// @ts-ignore
const __VLS_14 = __VLS_asFunctionalComponent1(__VLS_13, new __VLS_13({}));
const __VLS_15 = __VLS_14({}, ...__VLS_functionalComponentArgsRest(__VLS_14));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "header-right" },
});
/** @type {__VLS_StyleScopedClasses['header-right']} */ ;
let __VLS_18;
/** @ts-ignore @type {typeof __VLS_components.routerLink | typeof __VLS_components.RouterLink | typeof __VLS_components.routerLink | typeof __VLS_components.RouterLink} */
routerLink;
// @ts-ignore
const __VLS_19 = __VLS_asFunctionalComponent1(__VLS_18, new __VLS_18({
    to: "/admin",
    ...{ class: "overview-btn admin-entry" },
    title: "管理后台",
}));
const __VLS_20 = __VLS_19({
    to: "/admin",
    ...{ class: "overview-btn admin-entry" },
    title: "管理后台",
}, ...__VLS_functionalComponentArgsRest(__VLS_19));
/** @type {__VLS_StyleScopedClasses['overview-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['admin-entry']} */ ;
const { default: __VLS_23 } = __VLS_21.slots;
// @ts-ignore
[activeScene, SCENE_DEFS_LIST, handleSelectScene, handleBackToOverview,];
var __VLS_21;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.flyToOverview) },
    ...{ class: "overview-btn" },
    title: "跳转至线路总览视角",
});
/** @type {__VLS_StyleScopedClasses['overview-btn']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.copyCurrentView) },
    ...{ class: "overview-btn" },
    title: "复制当前相机视角参数",
});
/** @type {__VLS_StyleScopedClasses['overview-btn']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "date-time-group" },
});
/** @type {__VLS_StyleScopedClasses['date-time-group']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "time" },
});
/** @type {__VLS_StyleScopedClasses['time']} */ ;
(__VLS_ctx.timeStr);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "date" },
});
/** @type {__VLS_StyleScopedClasses['date']} */ ;
(__VLS_ctx.dateStr);
const __VLS_24 = Toolbar;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent1(__VLS_24, new __VLS_24({
    ...{ 'onToggleTool': {} },
    ...{ 'onAction': {} },
    activeTool: (__VLS_ctx.activeTool),
}));
const __VLS_26 = __VLS_25({
    ...{ 'onToggleTool': {} },
    ...{ 'onAction': {} },
    activeTool: (__VLS_ctx.activeTool),
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
let __VLS_29;
const __VLS_30 = ({ toggleTool: {} },
    { onToggleTool: (__VLS_ctx.handleToggleTool) });
const __VLS_31 = ({ action: {} },
    { onAction: (__VLS_ctx.handleToolAction) });
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (!__VLS_ctx.activeScene && !__VLS_ctx.isModelViewMode) }, null, null);
var __VLS_27;
var __VLS_28;
const __VLS_32 = RoamingToolbar;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent1(__VLS_32, new __VLS_32({
    ...{ 'onClose': {} },
    visible: (__VLS_ctx.activeTool === 'roaming'),
}));
const __VLS_34 = __VLS_33({
    ...{ 'onClose': {} },
    visible: (__VLS_ctx.activeTool === 'roaming'),
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
let __VLS_37;
const __VLS_38 = ({ close: {} },
    { onClose: (...[$event]) => {
            __VLS_ctx.activeTool = null;
            // @ts-ignore
            [activeScene, flyToOverview, copyCurrentView, timeStr, dateStr, activeTool, activeTool, activeTool, handleToggleTool, handleToolAction, isModelViewMode,];
        } });
var __VLS_35;
var __VLS_36;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onMousedown: (__VLS_ctx.startDrag) },
    ...{ class: "floating-panel" },
    ...{ style: ({ left: __VLS_ctx.drag.left + 'px', top: __VLS_ctx.drag.top + 'px' }) },
});
/** @type {__VLS_StyleScopedClasses['floating-panel']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onMousedown: (__VLS_ctx.startDrag) },
    ...{ class: "drag-header" },
});
/** @type {__VLS_StyleScopedClasses['drag-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.panelCollapsed = !__VLS_ctx.panelCollapsed;
            // @ts-ignore
            [startDrag, startDrag, drag, drag, panelCollapsed, panelCollapsed,];
        } },
    ...{ class: "drag-collapse" },
});
/** @type {__VLS_StyleScopedClasses['drag-collapse']} */ ;
(__VLS_ctx.panelCollapsed ? '▸' : '▾');
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "drag-handle" },
});
/** @type {__VLS_StyleScopedClasses['drag-handle']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "drag-content" },
});
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (!__VLS_ctx.panelCollapsed) }, null, null);
/** @type {__VLS_StyleScopedClasses['drag-content']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "checkbox-item" },
});
/** @type {__VLS_StyleScopedClasses['checkbox-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: (__VLS_ctx.toggle3DModel) },
    type: "checkbox",
});
(__VLS_ctx.layerState.showModel);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "custom-check" },
});
/** @type {__VLS_StyleScopedClasses['custom-check']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "checkbox-item" },
});
/** @type {__VLS_StyleScopedClasses['checkbox-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: (__VLS_ctx.toggleImagery) },
    type: "checkbox",
});
(__VLS_ctx.layerState.showMap);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "custom-check" },
});
/** @type {__VLS_StyleScopedClasses['custom-check']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "checkbox-item" },
});
/** @type {__VLS_StyleScopedClasses['checkbox-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: (__VLS_ctx.toggleTunnelModel) },
    type: "checkbox",
});
(__VLS_ctx.layerState.showTunnel);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "custom-check" },
});
/** @type {__VLS_StyleScopedClasses['custom-check']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "xray-row" },
});
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.layerState.showTunnel) }, null, null);
/** @type {__VLS_StyleScopedClasses['xray-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.toggleXray) },
    ...{ class: "xray-btn" },
    ...{ class: ({ active: __VLS_ctx.isXray }) },
});
/** @type {__VLS_StyleScopedClasses['xray-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "checkbox-item" },
});
/** @type {__VLS_StyleScopedClasses['checkbox-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: (__VLS_ctx.toggleRockModel) },
    type: "checkbox",
});
(__VLS_ctx.layerState.showRock);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "custom-check" },
});
/** @type {__VLS_StyleScopedClasses['custom-check']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "checkbox-item" },
});
/** @type {__VLS_StyleScopedClasses['checkbox-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: (__VLS_ctx.toggleWindTunnelModel) },
    type: "checkbox",
});
(__VLS_ctx.layerState.showWindTunnel);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "custom-check" },
});
/** @type {__VLS_StyleScopedClasses['custom-check']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "xray-row" },
});
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.layerState.showWindTunnel) }, null, null);
/** @type {__VLS_StyleScopedClasses['xray-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.toggleWindXray) },
    ...{ class: "xray-btn" },
    ...{ class: ({ active: __VLS_ctx.isWindXray }) },
});
/** @type {__VLS_StyleScopedClasses['xray-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "checkbox-item" },
});
/** @type {__VLS_StyleScopedClasses['checkbox-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: (__VLS_ctx.toggleMileageRuler) },
    type: "checkbox",
});
(__VLS_ctx.layerState.showMileageRuler);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "custom-check" },
});
/** @type {__VLS_StyleScopedClasses['custom-check']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "terrain-alpha-row" },
});
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.layerState.showMap) }, null, null);
/** @type {__VLS_StyleScopedClasses['terrain-alpha-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "terrain-alpha-label" },
});
/** @type {__VLS_StyleScopedClasses['terrain-alpha-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onInput: (__VLS_ctx.onTerrainAlphaInput) },
    ...{ class: "terrain-alpha-slider" },
    type: "range",
    min: "0",
    max: "100",
    step: "1",
    value: (Math.round(__VLS_ctx.terrainAlpha * 100)),
});
/** @type {__VLS_StyleScopedClasses['terrain-alpha-slider']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "terrain-alpha-value" },
});
/** @type {__VLS_StyleScopedClasses['terrain-alpha-value']} */ ;
(Math.round(__VLS_ctx.terrainAlpha * 100));
const __VLS_39 = ProcessingWorkflowSidebar;
// @ts-ignore
const __VLS_40 = __VLS_asFunctionalComponent1(__VLS_39, new __VLS_39({
    ...{ 'onBack': {} },
    ...{ 'onProcessComplete': {} },
    show: (!!__VLS_ctx.processingModelKey),
    modelKey: (__VLS_ctx.processingModelKey),
}));
const __VLS_41 = __VLS_40({
    ...{ 'onBack': {} },
    ...{ 'onProcessComplete': {} },
    show: (!!__VLS_ctx.processingModelKey),
    modelKey: (__VLS_ctx.processingModelKey),
}, ...__VLS_functionalComponentArgsRest(__VLS_40));
let __VLS_44;
const __VLS_45 = ({ back: {} },
    { onBack: (__VLS_ctx.handleWorkflowBack) });
const __VLS_46 = ({ processComplete: {} },
    { onProcessComplete: (__VLS_ctx.handleProcessingComplete) });
var __VLS_42;
var __VLS_43;
const __VLS_47 = DTVolume;
// @ts-ignore
const __VLS_48 = __VLS_asFunctionalComponent1(__VLS_47, new __VLS_47({}));
const __VLS_49 = __VLS_48({}, ...__VLS_functionalComponentArgsRest(__VLS_48));
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.isModelViewMode) }, null, null);
if (__VLS_ctx.isBLDZ) {
    const __VLS_52 = BLDZ;
    // @ts-ignore
    const __VLS_53 = __VLS_asFunctionalComponent1(__VLS_52, new __VLS_52({
        value: (__VLS_ctx.selectedValue),
    }));
    const __VLS_54 = __VLS_53({
        value: (__VLS_ctx.selectedValue),
    }, ...__VLS_functionalComponentArgsRest(__VLS_53));
}
if (__VLS_ctx.showzzmsm) {
    const __VLS_57 = ZZMSM;
    // @ts-ignore
    const __VLS_58 = __VLS_asFunctionalComponent1(__VLS_57, new __VLS_57({}));
    const __VLS_59 = __VLS_58({}, ...__VLS_functionalComponentArgsRest(__VLS_58));
}
if (__VLS_ctx.isRadar) {
    const __VLS_62 = DZLD;
    // @ts-ignore
    const __VLS_63 = __VLS_asFunctionalComponent1(__VLS_62, new __VLS_62({}));
    const __VLS_64 = __VLS_63({}, ...__VLS_functionalComponentArgsRest(__VLS_63));
}
if (__VLS_ctx.isAHD) {
    const __VLS_67 = AHD;
    // @ts-ignore
    const __VLS_68 = __VLS_asFunctionalComponent1(__VLS_67, new __VLS_67({}));
    const __VLS_69 = __VLS_68({}, ...__VLS_functionalComponentArgsRest(__VLS_68));
}
if (__VLS_ctx.isDBH) {
    const __VLS_72 = DBH;
    // @ts-ignore
    const __VLS_73 = __VLS_asFunctionalComponent1(__VLS_72, new __VLS_72({}));
    const __VLS_74 = __VLS_73({}, ...__VLS_functionalComponentArgsRest(__VLS_73));
}
if (__VLS_ctx.isTSP) {
    const __VLS_77 = TSP;
    // @ts-ignore
    const __VLS_78 = __VLS_asFunctionalComponent1(__VLS_77, new __VLS_77({}));
    const __VLS_79 = __VLS_78({}, ...__VLS_functionalComponentArgsRest(__VLS_78));
}
if (__VLS_ctx.isTEM) {
    const __VLS_82 = TEM;
    // @ts-ignore
    const __VLS_83 = __VLS_asFunctionalComponent1(__VLS_82, new __VLS_82({}));
    const __VLS_84 = __VLS_83({}, ...__VLS_functionalComponentArgsRest(__VLS_83));
}
const __VLS_87 = WorkfaceInfoPanel;
// @ts-ignore
const __VLS_88 = __VLS_asFunctionalComponent1(__VLS_87, new __VLS_87({}));
const __VLS_89 = __VLS_88({}, ...__VLS_functionalComponentArgsRest(__VLS_88));
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (!__VLS_ctx.activeScene && !__VLS_ctx.isModelViewMode) }, null, null);
const __VLS_92 = SceneDataPanel;
// @ts-ignore
const __VLS_93 = __VLS_asFunctionalComponent1(__VLS_92, new __VLS_92({
    ...{ 'onSelectLayer': {} },
    show: (!!__VLS_ctx.activeScene && !__VLS_ctx.processingModelKey),
    sceneKey: (__VLS_ctx.activeScene),
    isModelViewMode: (__VLS_ctx.isModelViewMode),
}));
const __VLS_94 = __VLS_93({
    ...{ 'onSelectLayer': {} },
    show: (!!__VLS_ctx.activeScene && !__VLS_ctx.processingModelKey),
    sceneKey: (__VLS_ctx.activeScene),
    isModelViewMode: (__VLS_ctx.isModelViewMode),
}, ...__VLS_functionalComponentArgsRest(__VLS_93));
let __VLS_97;
const __VLS_98 = ({ selectLayer: {} },
    { onSelectLayer: (__VLS_ctx.handleLayerSelect) });
var __VLS_95;
var __VLS_96;
if (__VLS_ctx.activeScene === 'workface') {
    const __VLS_99 = PredictionCenter;
    // @ts-ignore
    const __VLS_100 = __VLS_asFunctionalComponent1(__VLS_99, new __VLS_99({
        ...{ 'onClose': {} },
        ...{ 'onAction': {} },
        ...{ 'onVersionChange': {} },
        ...{ 'onSegmentSelect': {} },
        show: (!!__VLS_ctx.activeScene),
        activeAction: (__VLS_ctx.activeAction),
    }));
    const __VLS_101 = __VLS_100({
        ...{ 'onClose': {} },
        ...{ 'onAction': {} },
        ...{ 'onVersionChange': {} },
        ...{ 'onSegmentSelect': {} },
        show: (!!__VLS_ctx.activeScene),
        activeAction: (__VLS_ctx.activeAction),
    }, ...__VLS_functionalComponentArgsRest(__VLS_100));
    let __VLS_104;
    const __VLS_105 = ({ close: {} },
        { onClose: (__VLS_ctx.handleBackToOverview) });
    const __VLS_106 = ({ action: {} },
        { onAction: (__VLS_ctx.handlePanelAction) });
    const __VLS_107 = ({ versionChange: {} },
        { onVersionChange: (__VLS_ctx.handleRockVersionChange) });
    const __VLS_108 = ({ segmentSelect: {} },
        { onSegmentSelect: (__VLS_ctx.handleRockSegmentSelect) });
    var __VLS_102;
    var __VLS_103;
}
else if (__VLS_ctx.activeScene) {
    const __VLS_109 = SceneControlPanel;
    // @ts-ignore
    const __VLS_110 = __VLS_asFunctionalComponent1(__VLS_109, new __VLS_109({
        ...{ 'onClose': {} },
        ...{ 'onAction': {} },
        ...{ 'onSelectLayer': {} },
        show: (!!__VLS_ctx.activeScene),
        sceneKey: (__VLS_ctx.activeScene),
        isModelViewMode: (__VLS_ctx.isModelViewMode),
    }));
    const __VLS_111 = __VLS_110({
        ...{ 'onClose': {} },
        ...{ 'onAction': {} },
        ...{ 'onSelectLayer': {} },
        show: (!!__VLS_ctx.activeScene),
        sceneKey: (__VLS_ctx.activeScene),
        isModelViewMode: (__VLS_ctx.isModelViewMode),
    }, ...__VLS_functionalComponentArgsRest(__VLS_110));
    let __VLS_114;
    const __VLS_115 = ({ close: {} },
        { onClose: (__VLS_ctx.handleBackToOverview) });
    const __VLS_116 = ({ action: {} },
        { onAction: (__VLS_ctx.handlePanelAction) });
    const __VLS_117 = ({ selectLayer: {} },
        { onSelectLayer: (__VLS_ctx.handleLayerSelect) });
    var __VLS_112;
    var __VLS_113;
}
if (__VLS_ctx.showLining) {
    const __VLS_118 = Lining;
    // @ts-ignore
    const __VLS_119 = __VLS_asFunctionalComponent1(__VLS_118, new __VLS_118({
        ...{ 'onClose': {} },
    }));
    const __VLS_120 = __VLS_119({
        ...{ 'onClose': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_119));
    let __VLS_123;
    const __VLS_124 = ({ close: {} },
        { onClose: (...[$event]) => {
                if (!(__VLS_ctx.showLining))
                    return;
                __VLS_ctx.showLining = false;
                // @ts-ignore
                [activeScene, activeScene, activeScene, activeScene, activeScene, activeScene, activeScene, activeScene, handleBackToOverview, handleBackToOverview, isModelViewMode, isModelViewMode, isModelViewMode, isModelViewMode, panelCollapsed, panelCollapsed, toggle3DModel, layerState, layerState, layerState, layerState, layerState, layerState, layerState, layerState, layerState, toggleImagery, toggleTunnelModel, toggleXray, isXray, toggleRockModel, toggleWindTunnelModel, toggleWindXray, isWindXray, toggleMileageRuler, onTerrainAlphaInput, terrainAlpha, terrainAlpha, processingModelKey, processingModelKey, processingModelKey, handleWorkflowBack, handleProcessingComplete, isBLDZ, selectedValue, showzzmsm, isRadar, isAHD, isDBH, isTSP, isTEM, handleLayerSelect, handleLayerSelect, activeAction, handlePanelAction, handlePanelAction, handleRockVersionChange, handleRockSegmentSelect, showLining, showLining,];
            } });
    var __VLS_121;
    var __VLS_122;
}
if (__VLS_ctx.showDispatchPersonnel) {
    const __VLS_125 = DispatchPersonnel;
    // @ts-ignore
    const __VLS_126 = __VLS_asFunctionalComponent1(__VLS_125, new __VLS_125({
        ...{ 'onClose': {} },
    }));
    const __VLS_127 = __VLS_126({
        ...{ 'onClose': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_126));
    let __VLS_130;
    const __VLS_131 = ({ close: {} },
        { onClose: (...[$event]) => {
                if (!(__VLS_ctx.showDispatchPersonnel))
                    return;
                __VLS_ctx.showDispatchPersonnel = false;
                // @ts-ignore
                [showDispatchPersonnel, showDispatchPersonnel,];
            } });
    var __VLS_128;
    var __VLS_129;
}
if (__VLS_ctx.showDispatchEquipment) {
    const __VLS_132 = DispatchEquipment;
    // @ts-ignore
    const __VLS_133 = __VLS_asFunctionalComponent1(__VLS_132, new __VLS_132({
        ...{ 'onClose': {} },
    }));
    const __VLS_134 = __VLS_133({
        ...{ 'onClose': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_133));
    let __VLS_137;
    const __VLS_138 = ({ close: {} },
        { onClose: (...[$event]) => {
                if (!(__VLS_ctx.showDispatchEquipment))
                    return;
                __VLS_ctx.showDispatchEquipment = false;
                // @ts-ignore
                [showDispatchEquipment, showDispatchEquipment,];
            } });
    var __VLS_135;
    var __VLS_136;
}
if (__VLS_ctx.showDispatchGantt) {
    const __VLS_139 = DispatchGantt;
    // @ts-ignore
    const __VLS_140 = __VLS_asFunctionalComponent1(__VLS_139, new __VLS_139({
        ...{ 'onClose': {} },
    }));
    const __VLS_141 = __VLS_140({
        ...{ 'onClose': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_140));
    let __VLS_144;
    const __VLS_145 = ({ close: {} },
        { onClose: (...[$event]) => {
                if (!(__VLS_ctx.showDispatchGantt))
                    return;
                __VLS_ctx.showDispatchGantt = false;
                // @ts-ignore
                [showDispatchGantt, showDispatchGantt,];
            } });
    var __VLS_142;
    var __VLS_143;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "bottom-metrics-bar" },
});
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (!__VLS_ctx.activeScene) }, null, null);
/** @type {__VLS_StyleScopedClasses['bottom-metrics-bar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mileage-progress-wrap" },
});
/** @type {__VLS_StyleScopedClasses['mileage-progress-wrap']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "mileage-start" },
});
/** @type {__VLS_StyleScopedClasses['mileage-start']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mileage-track" },
});
/** @type {__VLS_StyleScopedClasses['mileage-track']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mileage-filled" },
    ...{ style: ({ width: __VLS_ctx.mileageProgress + '%' }) },
});
/** @type {__VLS_StyleScopedClasses['mileage-filled']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mileage-cursor" },
    ...{ style: ({ left: __VLS_ctx.mileageProgress + '%' }) },
    title: "当前掌子面 DK281+500",
});
/** @type {__VLS_StyleScopedClasses['mileage-cursor']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "cursor-label" },
});
/** @type {__VLS_StyleScopedClasses['cursor-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "mileage-end" },
});
/** @type {__VLS_StyleScopedClasses['mileage-end']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "header-metrics" },
});
/** @type {__VLS_StyleScopedClasses['header-metrics']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "sys-status-group" },
});
/** @type {__VLS_StyleScopedClasses['sys-status-group']} */ ;
for (const [s] of __VLS_vFor((__VLS_ctx.sysStatus))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "sys-status-item" },
        key: (s.name),
    });
    /** @type {__VLS_StyleScopedClasses['sys-status-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "sys-dot" },
        ...{ class: (s.cls) },
    });
    /** @type {__VLS_StyleScopedClasses['sys-dot']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "sys-name" },
    });
    /** @type {__VLS_StyleScopedClasses['sys-name']} */ ;
    (s.name);
    // @ts-ignore
    [activeScene, mileageProgress, mileageProgress, sysStatus,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "metric-chip" },
});
/** @type {__VLS_StyleScopedClasses['metric-chip']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "chip-val cyan" },
});
/** @type {__VLS_StyleScopedClasses['chip-val']} */ ;
/** @type {__VLS_StyleScopedClasses['cyan']} */ ;
(__VLS_ctx.overviewMetrics.advance);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "chip-unit" },
});
/** @type {__VLS_StyleScopedClasses['chip-unit']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "chip-desc" },
});
/** @type {__VLS_StyleScopedClasses['chip-desc']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "metric-chip" },
});
/** @type {__VLS_StyleScopedClasses['metric-chip']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "chip-val orange" },
});
/** @type {__VLS_StyleScopedClasses['chip-val']} */ ;
/** @type {__VLS_StyleScopedClasses['orange']} */ ;
(__VLS_ctx.overviewMetrics.personnel);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "chip-unit" },
});
/** @type {__VLS_StyleScopedClasses['chip-unit']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "chip-desc" },
});
/** @type {__VLS_StyleScopedClasses['chip-desc']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "metric-chip" },
});
/** @type {__VLS_StyleScopedClasses['metric-chip']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "chip-val green" },
});
/** @type {__VLS_StyleScopedClasses['chip-val']} */ ;
/** @type {__VLS_StyleScopedClasses['green']} */ ;
(__VLS_ctx.overviewMetrics.muck);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "chip-unit" },
});
/** @type {__VLS_StyleScopedClasses['chip-unit']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "chip-desc" },
});
/** @type {__VLS_StyleScopedClasses['chip-desc']} */ ;
let __VLS_146;
/** @ts-ignore @type {typeof __VLS_components.AgentChat} */
AgentChat;
// @ts-ignore
const __VLS_147 = __VLS_asFunctionalComponent1(__VLS_146, new __VLS_146({
    ...{ 'onSceneOpen': {} },
    context: ({ scene: __VLS_ctx.activeScene || undefined }),
}));
const __VLS_148 = __VLS_147({
    ...{ 'onSceneOpen': {} },
    context: ({ scene: __VLS_ctx.activeScene || undefined }),
}, ...__VLS_functionalComponentArgsRest(__VLS_147));
let __VLS_151;
const __VLS_152 = ({ sceneOpen: {} },
    { onSceneOpen: (__VLS_ctx.handleAgentSceneOpen) });
var __VLS_149;
var __VLS_150;
// @ts-ignore
[activeScene, overviewMetrics, overviewMetrics, overviewMetrics, handleAgentSceneOpen,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
