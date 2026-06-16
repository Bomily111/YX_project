<template>
  <div class="dashboard-container">
    <div class="globe-layer">
      <DTGlobe />
    </div>

    <header class="tech-header">
      <div class="header-left">
        <div class="title-container">
          <div class="logo-text">钻爆法隧洞群施工数字孪生系统</div>
        </div>
      </div>

      <!-- 中部：主导航栏 -->
      <div class="header-center">
        <OverviewHUD
          :active-scene="activeScene"
          :scenes="SCENE_DEFS_LIST"
          @select-scene="handleSelectScene"
          @back-to-overview="handleBackToOverview"
        />
      </div>

      <div class="header-right">
        <button class="overview-btn" @click="flyToOverview" title="跳转至线路总览视角">
          ⊙ 线路总览
        </button>
        <button class="overview-btn" @click="copyCurrentView" title="复制当前相机视角参数">
          ⊕ 复制视角
        </button>
        <div class="date-time-group">
          <div class="time">{{ timeStr }}</div>
          <div class="date">{{ dateStr }}</div>
        </div>
      </div>
    </header>

    <!-- 左侧浮动工具栏（仅总览模式显示） -->
    <Toolbar
      v-show="!activeScene && !isModelViewMode"
      :active-tool="activeTool"
      @toggle-tool="handleToggleTool"
      @action="handleToolAction"
    />

    <!-- 漫游控制弹窗 -->
    <RoamingToolbar :visible="activeTool === 'roaming'" @close="activeTool = null" />

    <div class="floating-panel"
         :style="{ left: drag.left + 'px', top: drag.top + 'px' }"
         @mousedown="startDrag">
      <div class="drag-header">
        <span>图层控制</span>
        <span class="drag-handle">✥</span>
      </div>
      <div class="drag-content">
        <label class="checkbox-item">
          <input type="checkbox" v-model="layerState.showModel" @change="toggle3DModel">
          <span class="custom-check"></span>
          隧道中线
        </label>
        <label class="checkbox-item">
          <input type="checkbox" v-model="layerState.showMap" @change="toggleImagery">
          <span class="custom-check"></span>
          影像底图
        </label>
        <label class="checkbox-item">
          <input type="checkbox" v-model="layerState.showTunnel" @change="toggleTunnelModel">
          <span class="custom-check"></span>
          隧道模型
        </label>
        <label class="checkbox-item">
          <input type="checkbox" v-model="layerState.showRock" @change="toggleRockModel">
          <span class="custom-check"></span>
          围岩模型
        </label>

        <div v-show="layerState.showMap" class="terrain-alpha-row">
          <span class="terrain-alpha-label">地形透视</span>
          <input
            class="terrain-alpha-slider"
            type="range" min="0" max="100" step="1"
            :value="Math.round(terrainAlpha * 100)"
            @input="onTerrainAlphaInput"
          />
          <span class="terrain-alpha-value">{{ Math.round(terrainAlpha * 100) }}%</span>
        </div>

        </div>
    </div>

    <!-- 爆破设计界面（叠加在 Cesium 三维场景上） -->
    <BlastStation
      v-if="showBlastStation && selectedWorksite !== null"
      :worksite="selectedWorksite"
      @close="closeBlastStation"
    />

    <!-- 自动化处理流程侧边栏 -->
    <ProcessingWorkflowSidebar
      :show="!!processingModelKey"
      :model-key="processingModelKey"
      @back="handleWorkflowBack"
      @process-complete="handleProcessingComplete"
    />

    <!-- 体数据渲染覆盖层（进入模型视图后挂载，始终保持 DOM） -->
    <DTVolume v-show="isModelViewMode" />

    <!-- 不良地质 / 超前预报 功能面板 -->
    <BLDZ v-if="isBLDZ" :value="selectedValue" />
    <ZZMSM v-if="showzzmsm" />
    <DZLD v-if="isRadar" />
    <AHD v-if="isAHD" />
    <DBH v-if="isDBH" />
    <TSP v-if="isTSP" />
    <TEM v-if="isTEM" />



    <!-- 左侧掌子面信息面板（总览模式下显示，场景/模型视图模式下隐藏） -->
    <WorkfaceInfoPanel v-show="!activeScene && !isModelViewMode" />

    <!-- 场景左侧数据面板 -->
    <SceneDataPanel
      :show="!!activeScene && !processingModelKey"
      :scene-key="activeScene"
      :is-model-view-mode="isModelViewMode"
      @select-layer="handleLayerSelect"
    />

    <!-- 场景右侧操控面板 -->
    <SceneControlPanel
      :show="!!activeScene"
      :scene-key="activeScene"
      :is-model-view-mode="isModelViewMode"
      @close="handleBackToOverview"
      @action="handlePanelAction"
      @select-layer="handleLayerSelect"
    />

    <!-- 支护场景 -->
    <Lining v-if="showLining" @close="showLining = false" />

    <!-- 调度场景：可拖放面板 -->
    <DispatchPersonnel v-if="showDispatchPersonnel" @close="showDispatchPersonnel = false" />
    <DispatchEquipment v-if="showDispatchEquipment" @close="showDispatchEquipment = false" />
    <DispatchGantt v-if="showDispatchGantt" @close="showDispatchGantt = false" />

    <!-- AI 智能助手（暂时停用，功能齐全后启用） -->
    <!-- <AgentChat @scene-open="handleSceneNavClick" /> -->

    <!-- 底部状态与进度栏 -->
    <div class="bottom-metrics-bar">
      <div class="mileage-progress-wrap">
        <span class="mileage-start">DK278+100</span>
        <div class="mileage-track">
          <div class="mileage-filled" :style="{ width: mileageProgress + '%' }"></div>
          <div class="mileage-cursor" :style="{ left: mileageProgress + '%' }" title="当前掌子面 DK281+500">
            <span class="cursor-label">DK281+500</span>
          </div>
        </div>
        <span class="mileage-end">DK286+400</span>
      </div>
      <div class="header-metrics">
        <!-- 系统状态灯 -->
        <div class="sys-status-group">
          <div class="sys-status-item" v-for="s in sysStatus" :key="s.name">
            <span class="sys-dot" :class="s.cls"></span>
            <span class="sys-name">{{ s.name }}</span>
          </div>
        </div>
        <div class="metric-chip">
          <span class="chip-val cyan">3.5<span class="chip-unit">m</span></span>
          <span class="chip-desc">今日进尺</span>
        </div>
        <div class="metric-chip">
          <span class="chip-val orange">2<span class="chip-unit">次</span></span>
          <span class="chip-desc">当班爆破</span>
        </div>
        <div class="metric-chip">
          <span class="chip-val green">420<span class="chip-unit">m³</span></span>
          <span class="chip-desc">出渣量</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue';
import * as Cesium from 'cesium'; // 引入 Cesium
import { ScreenSpaceEventHandler, ScreenSpaceEventType } from 'cesium'; // 引入事件处理器
import DTGlobe from '@/components/DTGlobe/DTGlobe.vue';
import OverviewHUD from '@/views/Overview/OverviewHUD.vue';
import WorkfaceInfoPanel from '@/views/WorkfaceInfoPanel.vue';
import SceneDataPanel from '@/views/Overview/SceneDataPanel.vue';
import SceneControlPanel from '@/views/Overview/SceneControlPanel.vue';
import type { SceneDef } from '@/views/Overview/OverviewHUD.vue';
import BlastStation from '@/views/BlastStation/index.vue';
import Lining from '@/components/SceneManagement/LiningComponents/Lining.vue';
import DispatchPersonnel from '@/components/SceneManagement/DispatchComponents/DispatchPersonnel.vue';
import DispatchEquipment from '@/components/SceneManagement/DispatchComponents/DispatchEquipment.vue';
import DispatchGantt from '@/components/SceneManagement/DispatchComponents/DispatchGantt.vue';
// import AgentChat from '@/components/AgentAssistant/AgentChat.vue'; // 暂时停用
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
import { DTScopeEngine } from '@/utils/Common/Viewer';
import { loadCenterLine, enableBlackModelMode, restoreEarthMode, loadTunnelGlb, enableTerrainTransparency, setTunnelGlbVisible, setCenterLineVisible, removeRebarMeshes, loadWindTunnelGlb, removeWindTunnelGlb } from '@/utils/Common/DrawLine';
import { activateGeoModel, deactivateGeoModel, loadRockModel, setRockModelVisible } from '@/utils/Common/GeoModelController';
import { loadTerrain, unloadTerrain } from '@/utils/Maps/TerrainSource';
import { addTunnelEntities, removeTunnelEntities } from '@/utils/Common/TunnelEntities';

// ── 侧边栏 / 模型视图模式状态 ────────────────────────────
const isModelViewMode = ref(false);

// ── 总览/场景模式状态 ─────────────────────────────────────
const activeScene = ref<string | null>(null);

// ── 场景定义（供 OverviewHUD + fly-to 使用） ──────────────
const SCENE_DEFS: Record<string, {
  key: string; name: string; icon: string; color: string;
  status: string; statusCls: string; metricVal: string; metricUnit: string;
  flyTo: { lon: number; lat: number; height: number; heading: number; pitch: number };
}> = {
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
    flyTo: { lon: 94.893239, lat: 29.531875, height: 2965.2, heading: 54.69, pitch: -5.65 },
  },
  dispatch: {
    key: 'dispatch', name: '装备调度', icon: '◎',
    color: '#ffaa00', status: '运行', statusCls: 'dot-yellow',
    metricVal: '28', metricUnit: '人在岗',
    flyTo: { lon: 101.8200, lat: 30.0200, height: 3650, heading: 100, pitch: -25 },
  },
};
const SCENE_DEFS_LIST = computed((): SceneDef[] => Object.values(SCENE_DEFS));

// 总览模式相机视角（透视隧道整体）
const OVERVIEW_MODE_VIEW = {
  destination: Cesium.Cartesian3.fromDegrees(94.892033, 29.530969, 3066.1),
  orientation: {
    heading: Cesium.Math.toRadians(47.39),
    pitch:   Cesium.Math.toRadians(-21.34),
    roll:    0,
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

// ── 工具栏状态 ─────────────────────────────────────────
const activeTool = ref<string | null>(null);

function handleToggleTool(tool: string) {
  activeTool.value = activeTool.value === tool ? null : tool;
}

function handleToolAction(action: string) {
  if (action === 'fullscreen') {
    const el = document.documentElement;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen();
    }
  } else if (action === 'screenshot') {
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

// ── 爆破指挥台状态 ──────────────────────────────────────
const showBlastStation = ref(false);

const openBlastStation = (site: Worksite) => {
  selectedWorksite.value = site;
  showBlastStation.value = true;
};

const closeBlastStation = () => {
  showBlastStation.value = false;
};

// ── 支护 / 通风 / 调度场景状态 ────────────────────────────
const showLining            = ref(false);
const showDispatchPersonnel  = ref(false);
const showDispatchEquipment  = ref(false);
const showDispatchGantt      = ref(false);
const processingModelKey = ref<string | null>(null);

// ── 工点数据 ─────────────────────────────────────────────
const worksiteList = [
  {
    id: 'worksite_a',
    name: 'DK工点A',
    mileage: 'DK279+200',
    lon: 94.905619,
    lat: 29.533374,
    height: 2945.5,
    rockLevel: 'IV级',
    area: '76.5 m²',
    method: '台阶法',
    hardness: '较硬岩',
    riskLevel: '中风险',
  },
  {
    id: 'worksite_b',
    name: 'DK工点B',
    mileage: 'DK283+100',
    lon: 94.938499,
    lat: 29.513774,
    height: 2965.0,
    rockLevel: 'V级',
    area: '82.3 m²',
    method: '全断面法',
    hardness: '软岩',
    riskLevel: '高风险',
  },
] as const;

type Worksite = typeof worksiteList[number];

// ── 工点交互状态 ─────────────────────────────────────────
const selectedWorksite = ref<Worksite | null>(null);
let worksiteClickHandler: ScreenSpaceEventHandler | null = null;
// --- 时间日期逻辑 ---
const timeStr = ref('');
const dateStr = ref('');
let timer: any = null;

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
const keyNameMap: Record<string, string> = {
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
const getViewer = (): any => {
  if ((window as any).viewer) return (window as any).viewer;
  if (DTScopeEngine && (DTScopeEngine as any).viewer) return (DTScopeEngine as any).viewer;
  return null;
};

// ── 添加工点实体 ─────────────────────────────────────────
const addWorksiteEntities = (viewer: any) => {
  worksiteList.forEach(site => {
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
const setWorksiteVisible = (show: boolean) => {
  const viewer = getViewer();
  if (!viewer) return;
  worksiteList.forEach(site => {
    const entity = viewer.entities.getById(site.id);
    if (entity) entity.show = show;
  });
};

// ── 注册工点点击事件 ──────────────────────────────────────
const setupWorksiteClickHandler = (viewer: any) => {
  worksiteClickHandler = new ScreenSpaceEventHandler(viewer.canvas);
  worksiteClickHandler.setInputAction((click: any) => {
    const picked = viewer.scene.pick(click.position);
    if (Cesium.defined(picked) && picked.id) {
      const entityId = picked.id.id;
      const site = worksiteList.find(s => s.id === entityId);
      if (site) {
        openBlastStation(site);
      }
    }
  }, ScreenSpaceEventType.LEFT_CLICK);
};

// ── 相机视角常量 ──────────────────────────────────────────

const INITIAL_VIEW = {
  destination: Cesium.Cartesian3.fromDegrees(101.660451, 30.096231, 4909.6),
  orientation: {
    heading: Cesium.Math.toRadians(104.36),
    pitch:   Cesium.Math.toRadians(-11.49),
    roll:    0,
  },
};

// 线路总览视角：俯视整条中线
const OVERVIEW_VIEW = {
  destination: Cesium.Cartesian3.fromDegrees(94.868546, 29.460784, 10402.4),
  orientation: {
    heading: Cesium.Math.toRadians(38.99),
    pitch:   Cesium.Math.toRadians(-36.85),
    roll:    0,
  },
};

// ── 跳转线路总览 ──────────────────────────────────────────
const flyToOverview = () => {
  activeScene.value = null;
  const viewer = getViewer();
  if (!viewer) return;
  viewer.scene.camera.flyTo({ ...OVERVIEW_VIEW, duration: 2 });
};

// --- 悬浮拖拽逻辑与图层状态 ---
const drag = reactive({ left: window.innerWidth - 550, top: 100, isDragging: false, startX: 0, startY: 0 });
const layerState = reactive({ showModel: true, showMap: true, showTunnel: true, showRock: true });

// ── 核心逻辑：初始化场景数据 ─────────────────────────────
const initSceneData = () => {
  let retryCount = 0;

  const tryLoad = () => {
    const viewer = getViewer();

    if (!viewer) {
      if (retryCount < 20) {
        retryCount++;
        setTimeout(tryLoad, 100);
      } else {
        console.warn("⚠️ 等待 Viewer 初始化超时，中线可能未加载");
      }
      return;
    }

    console.log("✅ 地图引擎已就绪，加载中线与工点...");

    // skipZoom=true：跳过内部 zoomTo，避免其异步飞行覆盖初始视角
    loadCenterLine(undefined, true, true);
    try {
      loadTunnelGlb();
    } catch (e) {
      console.warn('⚠️ 隧道模型加载失败，跳过：', e);
    }

    // 默认进入总览视角
    viewer.camera.setView(OVERVIEW_MODE_VIEW);

    // 加载隧道动态实体（车辆、人员、热点标记）
    addTunnelEntities((hotspotKey: string) => {
      handleSelectScene(hotspotKey);
    });

    // 影像默认勾选：loadCenterLine 会调 enableBlackModelMode，在其之后恢复地球
    if (layerState.showMap) {
      restoreEarthMode(viewer);
      loadTerrain(viewer);
      if (viewer.imageryLayers.length > 0) viewer.imageryLayers.get(0).show = true;
      enableTerrainTransparency(viewer); // 开启透视效果：远看山体，近看透视隧道/中线
    }

    if (layerState.showRock) loadRockModel(viewer);

    addWorksiteEntities(viewer);
    setupWorksiteClickHandler(viewer);

  };

  tryLoad();
};

// --- 交互：点击左侧按钮 ---
const handleLayerSelect = (item: any) => {
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
  } else {
    // 切换到非体数据界面时清理体数据模型，防止 WebGL canvas 残留
    deactivateGeoModel();
  }

  if (name === '掌子面素描') {
    showzzmsm.value = true;
  } else if (name === '地质雷达') {
    isRadar.value = true;
  } else if (name === '超前水平钻') {
    isAHD.value = true;
  } else if (name === '加深炮孔') {
    isDBH.value = true;
  } else if (name === 'TSP反演') {
    isTSP.value = true;
  } else if (name === '瞬变电磁') {
    isTEM.value = true;
  } else {
    // 不良地质类型：软弱围岩、高地应力、富水带、破碎带
    isBLDZ.value = true;
    selectedValue.value = name;
  }
};

const handlePanelAction = (action: { key: string }, type: 'view' | 'process' = 'view') => {
  const isWorkflowAction = activeScene.value === 'workface';

  // 支护场景的"属性面板"按钮 → 切换可拖放支护参数面板
  if (activeScene.value === 'support' && action.key === 'monitor') {
    showLining.value = !showLining.value;
    return;
  }

  // 调度场景的各按钮 → 切换对应可拖放面板
  if (activeScene.value === 'dispatch') {
    if (action.key === 'track')  { showDispatchPersonnel.value = !showDispatchPersonnel.value; return; }
    if (action.key === 'equip')  { showDispatchEquipment.value = !showDispatchEquipment.value; return; }
    if (action.key === 'gantt')  { showDispatchGantt.value = !showDispatchGantt.value; return; }
  }

  if (isWorkflowAction && type === 'process') {
    // 点击了 '🛠️' 按钮，打开工作流侧边栏
    // 如果有其他模型视图开着，先关掉
    isModelViewMode.value = false;
    deactivateGeoModel();
    isBLDZ.value = false; showzzmsm.value = false; isRadar.value = false; isAHD.value = false; isDBH.value = false; isTSP.value = false; isTEM.value = false;

    // 打开工作流侧边栏
    processingModelKey.value = action.key;
  } else {
    // 对于所有 'view' 点击 (按钮主体), 或者非 workface 场景的点击
    handleLayerSelect({ key: action.key, name: keyNameMap[action.key] || '' });
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

const onTerrainAlphaInput = (e: Event) => {
  const val = Number((e.target as HTMLInputElement).value) / 100;
  terrainAlpha.value = val;
  const viewer = getViewer();
  if (!viewer) return;
  const globe = viewer.scene.globe;
  if (!globe.translucency.enabled) return;
  globe.translucency.frontFaceAlphaByDistance.nearValue = val;
  globe.translucency.frontFaceAlphaByDistance.farValue = val;
};

const startDrag = (e: MouseEvent) => {
  drag.isDragging = true;
  drag.startX = e.clientX - drag.left;
  drag.startY = e.clientY - drag.top;
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
};
const onDrag = (e: MouseEvent) => {
  if (!drag.isDragging) return;
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
};
const toggleTunnelModel = () => {
  setTunnelGlbVisible(layerState.showTunnel);
};
const toggleRockModel = () => {
  if (layerState.showRock) {
    loadRockModel(getViewer());
  }
  setRockModelVisible(layerState.showRock);
};

const toggleImagery = () => {
  const v = getViewer();
  if (!v) return;
  // 在模型视图模式下只切换影像图层，不恢复/切换黑底
  if (!isModelViewMode.value) {
    if (layerState.showMap) {
      restoreEarthMode(v);
      loadTerrain(v);
    } else {
      enableBlackModelMode(v);
      unloadTerrain(v);
    }
  }
  if (v.imageryLayers.length > 0) {
    v.imageryLayers.get(0).show = layerState.showMap;
  }
};

/** 复制当前相机视角到剪贴板 */
const copyCurrentView = () => {
  const viewer = getViewer();
  if (!viewer) return;
  const cam = viewer.scene.camera;
  const pos = cam.positionCartographic;
  console.log(
    `📷 当前视角:\ndestination: Cesium.Cartesian3.fromDegrees(${Cesium.Math.toDegrees(pos.longitude).toFixed(6)}, ${Cesium.Math.toDegrees(pos.latitude).toFixed(6)}, ${pos.height.toFixed(1)}),\norientation: {\n  heading: Cesium.Math.toRadians(${Cesium.Math.toDegrees(cam.heading).toFixed(2)}),\n  pitch:   Cesium.Math.toRadians(${Cesium.Math.toDegrees(cam.pitch).toFixed(2)}),\n  roll:    0,\n},`
  );
};

// ── 选择场景：相机飞向近景 + 打开双侧面板 ───────────────
const handleSelectScene = (key: string) => {
  const def = SCENE_DEFS[key];
  if (!def) return;
  const viewer = getViewer();
  if (!viewer) return;
  
  // 爆破设计：直接打开浮窗，不走场景面板
  if (key === 'blast') {
    selectedWorksite.value = worksiteList[0];
    showBlastStation.value = true;
    return;
  }

  activeScene.value = key;

  // 通风除尘场景：切换为风场模拟隧道模型
  if (key === 'vent') {
    setTunnelGlbVisible(false);
    loadWindTunnelGlb(viewer);
  } else {
    // 进入其他场景时恢复原始隧道
    removeWindTunnelGlb(viewer);
    setTunnelGlbVisible(layerState.showTunnel);
  }

  // 关闭所有场景浮层
  showLining.value = false;
  showDispatchPersonnel.value = false;
  showDispatchEquipment.value = false;
  showDispatchGantt.value = false;

  viewer.scene.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(def.flyTo.lon, def.flyTo.lat, def.flyTo.height),
    orientation: {
      heading: Cesium.Math.toRadians(def.flyTo.heading),
      pitch:   Cesium.Math.toRadians(def.flyTo.pitch),
      roll:    0,
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
  if (!viewer) return;

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
    deactivateGeoModel(viewer);

    // 如果是从工作流侧边栏返回，也要重置
    if (processingModelKey.value) {
      processingModelKey.value = null;
    }
  }

  // 清理支护场景的钢筋网模型
  removeRebarMeshes(viewer);

  // 清理风场隧道模型，恢复原始隧道
  removeWindTunnelGlb(viewer);
  setTunnelGlbVisible(layerState.showTunnel);

  // 恢复地球模式
  restoreEarthMode(viewer);
  if (layerState.showMap) {
    loadTerrain(viewer);
    if (viewer.imageryLayers.length > 0) viewer.imageryLayers.get(0).show = true;
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

onMounted(() => {
  updateTime();
  timer = setInterval(updateTime, 1000);

  // 延迟一点启动，给 Viewer 初始化留出缓冲时间
  setTimeout(initSceneData, 800);
});

onBeforeUnmount(() => {
  clearInterval(timer);
  if (worksiteClickHandler) {
    worksiteClickHandler.destroy();
    worksiteClickHandler = null;
  }
  removeTunnelEntities();
});

</script>

<style scoped lang="scss">
.dashboard-container {
  position: relative; width: 100%; height: 100%; overflow: hidden;
  background-color: #000; font-family: "Microsoft YaHei", sans-serif; user-select: none;
}
.globe-layer {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0;
}

/* Header */
.tech-header {
  position: absolute; top: 0; left: 0; width: 100%; height: 60px;
  min-width: 1200px; /* 设置最小宽度，防止缩小窗口时排版被挤压崩溃 */
  background: linear-gradient(to bottom, rgba(0, 20, 40, 0.95), rgba(0, 20, 40, 0.6));
  border-bottom: 1px solid rgba(0, 255, 255, 0.3);
  z-index: 10; display: flex; justify-content: space-between; align-items: center;
  box-shadow: 0 0 15px rgba(0, 255, 255, 0.2);
}
.header-left { display: flex; align-items: center; height: 100%; flex-shrink: 0; }

.title-container {
  position: relative;
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 40px 0 30px;
  background: linear-gradient(to right, rgba(0, 15, 30, 1), rgba(0, 50, 90, 1));
}

.title-container::after {
  content: '';
  position: absolute;
  right: -20px;
  top: 0;
  width: 40px;
  height: 100%;
  background: rgba(0, 50, 90, 1);
  transform: skewX(-25deg);
  border-right: 2px solid #00eaff;
  box-shadow: 2px 0 8px rgba(0, 234, 255, 0.4);
  z-index: 1;
}

.logo-text {
  position: relative;
  z-index: 2;
  font-size: 26px; font-weight: bold; color: #fff;
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.8); letter-spacing: 2px;
  background: linear-gradient(180deg, #fff, #87cefa);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
/* ── Header 占位区 ── */
.header-center {
  flex: 1;
  display: flex;
  justify-content: flex-start;
  padding-left: 20px; /* 减小左侧预留间距，使导航整体往左靠拢 */
  align-items: center;
  height: 100%;
}

/* ── 底部：里程进度条 + 关键指标 ── */
.bottom-metrics-bar {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 30px;
  padding: 10px 40px;
  background: rgba(0, 15, 30, 0.85);
  border: 1px solid rgba(0, 200, 255, 0.2);
  border-bottom: none;
  border-radius: 12px 12px 0 0;
  backdrop-filter: blur(12px);
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.5), 0 0 15px rgba(0, 255, 255, 0.1) inset;
  z-index: 10;
  min-width: 850px;
  pointer-events: all;
}

.bottom-metrics-bar .mileage-progress-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.bottom-metrics-bar .mileage-start, 
.bottom-metrics-bar .mileage-end {
  font-size: 11px;
  color: rgba(0, 200, 255, 0.6);
  font-family: 'Consolas', monospace;
  white-space: nowrap;
  flex-shrink: 0;
}

.bottom-metrics-bar .mileage-track {
  flex: 1;
  height: 6px;
  background: rgba(0, 100, 180, 0.25);
  border-radius: 3px;
  border: 1px solid rgba(0, 150, 255, 0.2);
  position: relative;
  overflow: visible;
}

.bottom-metrics-bar .mileage-filled {
  height: 100%;
  background: linear-gradient(to right, rgba(0, 150, 255, 0.5), #00eaff);
  border-radius: 3px;
  box-shadow: 0 0 8px rgba(0, 234, 255, 0.5);
  transition: width 0.5s ease;
}

.bottom-metrics-bar .mileage-cursor {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 10px;
  height: 10px;
  background: #fff;
  border: 3px solid #00eaff;
  border-radius: 50%;
  box-shadow: 0 0 10px rgba(0, 234, 255, 0.8);
  animation: cursor-pulse 2s ease-in-out infinite;
  cursor: default;
}

.bottom-metrics-bar .cursor-label {
  position: absolute;
  bottom: 14px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  color: #00eaff;
  white-space: nowrap;
  font-family: 'Consolas', monospace;
  background: rgba(0, 10, 24, 0.9);
  padding: 2px 4px;
  border-radius: 2px;
  border: 1px solid rgba(0, 200, 255, 0.4);
  pointer-events: none;
}

@keyframes cursor-pulse {
  0%, 100% { box-shadow: 0 0 6px rgba(0, 234, 255, 0.6); }
  50% { box-shadow: 0 0 14px rgba(0, 234, 255, 1); }
}

.bottom-metrics-bar .header-metrics {
  display: flex;
  gap: 24px;
  align-items: center;
  justify-content: flex-end;
  width: auto;
  padding-left: 24px;
  border-left: 1px dashed rgba(0, 200, 255, 0.15);
}

.bottom-metrics-bar .metric-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.bottom-metrics-bar .chip-val {
  font-size: 18px;
  font-weight: bold;
  font-family: 'Consolas', monospace;
  line-height: 1;
}

.bottom-metrics-bar .chip-val .chip-unit { font-size: 11px; margin-left: 2px; }
.bottom-metrics-bar .chip-val.cyan { color: #00eaff; text-shadow: 0 0 10px rgba(0, 234, 255, 0.6); }
.bottom-metrics-bar .chip-val.orange { color: #ffaa00; text-shadow: 0 0 10px rgba(255, 170, 0, 0.5); }
.bottom-metrics-bar .chip-val.green { color: #44ff88; text-shadow: 0 0 10px rgba(68, 255, 136, 0.5); }

.bottom-metrics-bar .chip-desc {
  font-size: 10px;
  color: rgba(180, 220, 255, 0.5);
  letter-spacing: 0.5px;
}

/* ── 系统状态灯 ── */
.bottom-metrics-bar .sys-status-group {
  display: flex;
  gap: 12px;
  align-items: center;
  padding-right: 24px;
  border-right: 1px solid rgba(0, 200, 255, 0.15);
}

.bottom-metrics-bar .sys-status-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.bottom-metrics-bar .sys-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  animation: sys-breathe 2.5s ease-in-out infinite;

  &.dot-green  { background: #44ff88; box-shadow: 0 0 6px #44ff88; }
  &.dot-yellow { background: #ffcc00; box-shadow: 0 0 6px #ffcc00; }
  &.dot-red    { background: #ff4444; box-shadow: 0 0 6px #ff4444; }
}

@keyframes sys-breathe {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}

.bottom-metrics-bar .sys-name {
  font-size: 11px;
  color: rgba(200, 240, 255, 0.6);
  letter-spacing: 0.5px;
}

.header-right { margin-right: 20px; display: flex; align-items: center; gap: 16px; flex-shrink: 0; }

.overview-btn {
  padding: 0 16px;
  height: 32px;
  background: linear-gradient(135deg, rgba(0, 80, 150, 0.45), rgba(0, 120, 200, 0.3));
  border: 1px solid rgba(0, 234, 255, 0.55);
  color: #00eaff;
  font-size: 13px;
  font-family: "Microsoft YaHei", sans-serif;
  letter-spacing: 1px;
  cursor: pointer;
  border-radius: 2px;
  white-space: nowrap;
  transition: background 0.15s, box-shadow 0.15s;
  box-shadow: 0 0 8px rgba(0, 234, 255, 0.15);
}
.overview-btn:hover {
  background: rgba(0, 234, 255, 0.18);
  box-shadow: 0 0 14px rgba(0, 234, 255, 0.35);
}
.copy-view-btn {
  width: 100%;
  margin-top: 10px;
  padding: 5px 0;
  background: transparent;
  border: 1px solid rgba(0, 234, 255, 0.3);
  color: rgba(0, 234, 255, 0.7);
  font-size: 12px;
  cursor: pointer;
  border-radius: 2px;
  transition: background 0.15s;
}
.copy-view-btn:hover {
  background: rgba(0, 234, 255, 0.1);
  color: #00eaff;
}
.date-time-group {
  display: flex; flex-direction: column; align-items: flex-end; justify-content: center;
  color: #00eaff; font-family: 'DIN', sans-serif; text-shadow: 0 0 5px rgba(0, 234, 255, 0.5);
}
.date-time-group .time { font-size: 24px; font-weight: bold; line-height: 1.1; }
.date-time-group .date { font-size: 14px; color: rgba(200, 240, 255, 0.8); letter-spacing: 1px; margin-top: 2px; }

/* Left Panel */
.left-panel {
  position: absolute; top: 80px; left: 20px; 
  max-height: calc(100% - 100px); width: 280px;
  background: rgba(0, 15, 30, 0.75); border: 1px solid rgba(0, 150, 255, 0.3);
  border-left: 4px solid #00aaff; backdrop-filter: blur(10px);
  z-index: 10; padding: 15px; overflow-y: auto;
  display: flex; flex-direction: column; gap: 15px;
  scrollbar-width: thin; scrollbar-color: #00aaff rgba(0,0,0,0.3);
}
.left-panel::-webkit-scrollbar { width: 4px; }
.left-panel::-webkit-scrollbar-thumb { background: #00aaff; border-radius: 2px; }

.panel-title {
  color: #fff; font-size: 18px; font-weight: bold;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 10px; margin-bottom: 5px; text-align: left; 
}
.group-box { border: 1px solid rgba(0, 255, 255, 0.1); background: rgba(0, 0, 0, 0.2); }
.group-header {
  padding: 10px; background: rgba(0, 100, 255, 0.15); color: #00eaff;
  cursor: pointer; display: flex; justify-content: space-between; align-items: center;
  font-weight: bold; transition: 0.3s;
}
.group-header:hover { background: rgba(0, 100, 255, 0.3); }
.group-content { padding: 5px; }
.arrow { transition: transform 0.3s; font-size: 12px; }
.arrow.open { transform: rotate(180deg); }

/* Buttons */
.layer-btn {
  display: flex; align-items: center; justify-content: space-between;
  margin: 5px 0; padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.05);
  cursor: pointer; transition: all 0.3s; border-radius: 4px;
}
.layer-btn:hover {
  background: rgba(0, 234, 255, 0.15); transform: translateX(5px);
  border-color: rgba(0, 234, 255, 0.3);
}
.layer-btn.selected {
  background: linear-gradient(90deg, rgba(0, 234, 255, 0.3), rgba(0, 234, 255, 0.05));
  border: 1px solid #00eaff; box-shadow: 0 0 10px rgba(0, 234, 255, 0.2);
}
.layer-btn .btn-icon { width: 24px; text-align: center; margin-right: 8px; font-size: 16px; }
.layer-btn .btn-text { flex: 1; color: rgba(255, 255, 255, 0.85); font-size: 15px; }
.layer-btn.selected .btn-text { color: #fff; font-weight: bold; }
.layer-btn .btn-arrow { font-size: 12px; color: #555; transition: 0.3s; }
.layer-btn.selected .btn-arrow { color: #00eaff; transform: translateX(3px); }

/* Floating Panel */
.floating-panel {
  position: absolute; width: 220px;
  background: rgba(0, 15, 30, 0.85); border: 1px solid #00eaff;
  box-shadow: 0 0 20px rgba(0, 200, 255, 0.2);
  z-index: 20; border-radius: 4px; overflow: hidden;
}
.drag-header {
  padding: 10px 15px; background: rgba(0, 100, 200, 0.6); color: #fff;
  font-size: 14px; font-weight: bold; cursor: move; display: flex; justify-content: space-between;
}
.drag-content { padding: 15px; }
.checkbox-item { display: flex; align-items: center; color: #ccc; margin-bottom: 10px; cursor: pointer; }
.checkbox-item:last-child { margin-bottom: 0; }
.checkbox-item input { display: none; }
.custom-check {
  width: 16px; height: 16px; border: 1px solid #00eaff; margin-right: 10px;
  display: flex; align-items: center; justify-content: center;
}
.checkbox-item input:checked + .custom-check::after {
  content: '✓'; color: #00eaff; font-size: 12px; font-weight: bold;
}
.tune-toggle {
  margin-left: auto; cursor: pointer; color: rgba(0,234,255,0.5); font-size: 13px;
  &:hover { color: #00eaff; }
}
.rock-tune {
  margin-top: 8px; padding: 8px; border-top: 1px solid rgba(0,234,255,0.15);
  display: flex; flex-direction: column; gap: 6px;
}
.tune-row { display: flex; align-items: center; gap: 6px; }
.tune-label { color: #aaa; font-size: 12px; width: 54px; flex-shrink: 0; }
.tune-input {
  flex: 1; background: rgba(0,20,40,0.8); border: 1px solid rgba(0,234,255,0.3);
  color: #00eaff; font-size: 12px; padding: 2px 4px; border-radius: 2px; width: 0;
  &:focus { outline: none; border-color: #00eaff; }
}
.tune-drag-btn {
  margin-top: 4px; padding: 4px 0; background: transparent;
  border: 1px solid rgba(255,200,0,0.45); color: rgba(255,200,0,0.8);
  font-size: 12px; cursor: pointer; border-radius: 2px; width: 100%;
  &:hover { background: rgba(255,200,0,0.1); }
  &.active { background: rgba(255,200,0,0.2); color: #ffcc00; border-color: #ffcc00; box-shadow: 0 0 8px rgba(255,200,0,0.3); }
}
.tune-drag-hint {
  font-size: 11px; color: rgba(255,200,0,0.7); text-align: center; padding: 2px 0;
}
.tune-copy-btn {
  margin-top: 4px; padding: 4px 0; background: transparent;
  border: 1px solid rgba(0,234,255,0.35); color: rgba(0,234,255,0.8);
  font-size: 12px; cursor: pointer; border-radius: 2px;
  &:hover { background: rgba(0,234,255,0.1); color: #00eaff; }
}
.terrain-alpha-row {
  display: flex; align-items: center; gap: 8px; margin-top: 10px;
  border-top: 1px solid rgba(0, 234, 255, 0.15); padding-top: 10px;
}
.terrain-alpha-label { color: #ccc; font-size: 13px; white-space: nowrap; }
.terrain-alpha-slider {
  flex: 1; height: 4px; cursor: pointer;
  accent-color: #00eaff;
}
.terrain-alpha-value { color: #00eaff; font-size: 12px; min-width: 32px; text-align: right; }

/* ── 快捷侧边栏（地图模式） ────────────────────────────── */
.quick-sidebar {
  position: absolute;
  top: 60px;
  left: 0;
  width: 200px;
  max-height: calc(100% - 80px);
  background: rgba(0, 12, 28, 0.88);
  border-right: 2px solid rgba(0, 170, 255, 0.35);
  border-top: 1px solid rgba(0, 170, 255, 0.2);
  backdrop-filter: blur(12px);
  z-index: 10;
  display: flex;
  flex-direction: row;
  overflow: hidden;
  transition: width 0.3s ease;

  &.collapsed {
    width: 40px;
  }
}

.sidebar-toggle-btn {
  flex-shrink: 0;
  width: 40px;
  height: 100%;
  min-height: 120px;
  background: rgba(0, 80, 160, 0.25);
  border: none;
  border-right: 1px solid rgba(0, 170, 255, 0.2);
  color: #00aaff;
  cursor: pointer;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 18px;
  transition: background 0.2s;

  &:hover { background: rgba(0, 120, 220, 0.4); }

  .toggle-icon { font-size: 13px; }
}

.sidebar-inner {
  flex: 1;
  overflow-y: auto;
  padding: 14px 12px;
  scrollbar-width: thin;
  scrollbar-color: #00aaff transparent;
}

.sidebar-title {
  color: #fff;
  font-size: 15px;
  font-weight: bold;
  letter-spacing: 1px;
  padding-bottom: 10px;
  margin-bottom: 12px;
  border-bottom: 1px solid rgba(0, 170, 255, 0.25);
  display: flex;
  align-items: center;
  gap: 6px;

  .title-deco {
    display: inline-block;
    width: 4px;
    height: 14px;
    background: linear-gradient(to bottom, #00eaff, #0066cc);
    border-radius: 2px;
  }
}

.sidebar-group {
  margin-bottom: 10px;
}

.sidebar-group-label {
  font-size: 11px;
  color: rgba(0, 200, 255, 0.6);
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 6px;
  padding-left: 4px;
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  margin-bottom: 4px;
  border: 1px solid rgba(0, 200, 255, 0.15);
  background: rgba(0, 100, 200, 0.1);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.25s;
  color: rgba(255, 255, 255, 0.85);
  font-size: 14px;

  &:hover {
    background: rgba(0, 200, 255, 0.2);
    border-color: rgba(0, 234, 255, 0.5);
    transform: translateX(4px);
    color: #fff;

    .item-arrow { color: #00eaff; transform: translateX(3px); }
  }

  .item-icon { font-size: 15px; color: #00aaff; }
  .item-text { flex: 1; }
  .item-arrow { font-size: 11px; color: #444; transition: all 0.2s; }
}

/* 侧边栏淡入淡出过渡 */
.sidebar-fade-enter-active,
.sidebar-fade-leave-active { transition: opacity 0.2s ease; }
.sidebar-fade-enter-from,
.sidebar-fade-leave-to   { opacity: 0; }

/* ── 返回地图按钮（模型视图模式） ───────────────────────── */
.back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 12px;
  margin-bottom: 12px;
  background: rgba(0, 60, 120, 0.4);
  border: 1px solid rgba(0, 170, 255, 0.4);
  border-radius: 4px;
  color: #00eaff;
  font-size: 13px;
  font-family: "Microsoft YaHei", sans-serif;
  cursor: pointer;
  transition: all 0.2s;
  letter-spacing: 1px;

  &:hover {
    background: rgba(0, 100, 200, 0.5);
    border-color: #00eaff;
    box-shadow: 0 0 10px rgba(0, 200, 255, 0.25);
  }

  .back-icon { font-size: 15px; }
}
</style>