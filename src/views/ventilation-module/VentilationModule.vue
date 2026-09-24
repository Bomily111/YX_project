<template>
  <div class="vent-root">
    <header class="vent-header">
      <div class="vent-header-left"><div class="vent-title-container"><h1>钻爆法隧洞群施工数字孪生系统</h1></div></div>
      <div class="vent-header-center"><strong class="vent-scene-title">通风除尘</strong></div>
      <div class="vent-header-right">
        <button type="button" class="vent-header-icon disabled" disabled title="当前版块暂不支持里程搜索" aria-label="里程搜索不可用"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg></button>
        <router-link to="/admin" class="vent-header-icon" title="管理后台" aria-label="管理后台"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"></circle><path d="M5.5 20c.5-4 2.7-6 6.5-6s6 2 6.5 6"></path></svg></router-link>
      </div>
    </header>

    <div class="vent-layout">
      <aside class="vent-directory" aria-label="通风除尘目录">
        <button type="button" class="vent-dir-row vent-home" @click="router.push('/')"><span>⌂</span><b>首页</b></button>
        <button type="button" class="vent-dir-row vent-worksite" @click="openWorksiteOverview"><span>◎</span>工点概览</button>
        <button type="button" class="vent-module-link" @click="openPlatformModule('workface')"><span>⬡</span><b>隧洞围岩</b><em>›</em></button>
        <button type="button" class="vent-module-link" @click="openPlatformModule('blast')"><span>✹</span><b>开挖爆破</b><em>›</em></button>
        <button type="button" class="vent-module-link" @click="openPlatformModule('support')"><span>◈</span><b>围岩支护</b><em>›</em></button>
        <div class="vent-dir-head"><span>≋</span><b>通风除尘</b><em>⌄</em></div>
        <nav>
          <button :class="{ active: view === 'geometry' }" @click="selectView('geometry')"><i></i>通风设计</button>
          <button :class="{ active: view === 'flow' }" @click="selectView('flow')"><i></i>三维风流</button>
          <button :class="{ active: view === 'co' }" @click="selectView('co')"><i></i>CO 爆破扩散</button>
          <button :class="{ active: view === 'transient' }" @click="selectView('transient')"><i></i>瞬态通风</button>
          <button :class="{ active: view === 'thermal' }" @click="selectView('thermal')"><i></i>热瞬态分析</button>
        </nav>
        <button type="button" class="vent-module-link" @click="openPlatformModule('dispatch')"><span>◎</span><b>装备调度</b><em>›</em></button>
      </aside>
      <main class="workspace">
        <div class="stage">
          <TunnelGeometryView v-show="view === 'geometry'" :active-chainage="activeChainage"
            :active-tunnel="activeTunnel" @locate="locateFromPlan" />

          <section v-show="view === 'flow' || view === 'thermal'" class="cesium-section" :class="{ thermal: view === 'thermal' }">
            <div ref="cesiumHost" class="cesium-host"></div>
            <div v-if="view === 'flow'" class="flow-legend">
              <span><i style="background:#1565c0"></i>低速 &lt;1 m/s</span>
              <span><i style="background:#2e7d32"></i>中速 1–5 m/s</span>
              <span><i style="background:#f9a825"></i>高速 5–10 m/s</span>
              <span><i style="background:#e53935"></i>极速 &gt;10 m/s</span>
              <em>左键指向旋转 · 中键/右键平移 · 滚轮指向缩放 · Shift+左键平移</em>
            </div>
            <div v-if="view === 'flow'" class="vent-layer-panel"
              :class="{ collapsed: layerPanelCollapsed }"
              :style="{ left: `${layerPanelPosition.left}px`, top: `${layerPanelPosition.top}px` }">
              <div class="vent-layer-header" @mousedown="startLayerPanelDrag">
                <button class="vent-layer-collapse" type="button" title="展开或收起图层控制"
                  @mousedown.stop @click.stop="layerPanelCollapsed = !layerPanelCollapsed">
                  {{ layerPanelCollapsed ? '▸' : '▾' }}
                </button>
                <span>图层控制</span>
                <span class="vent-layer-drag">✥</span>
              </div>
              <div v-show="!layerPanelCollapsed" class="vent-layer-content">
                <label class="vent-checkbox-item">
                  <input type="checkbox" :checked="visibility.points" @change="toggleLayer('points')">
                  <span class="vent-custom-check"></span><span>CFD 点云</span>
                </label>
                <label class="vent-checkbox-item">
                  <input type="checkbox" :checked="visibility.arrows" @change="toggleLayer('arrows')">
                  <span class="vent-custom-check"></span><span>风向矢量</span>
                </label>
                <label class="vent-checkbox-item">
                  <input type="checkbox" :checked="visibility.streamlines" @change="toggleLayer('streamlines')">
                  <span class="vent-custom-check"></span><span>风场流线</span>
                </label>
                <label class="vent-checkbox-item">
                  <input type="checkbox" :checked="visibility.particles" @change="toggleLayer('particles')">
                  <span class="vent-custom-check"></span><span>动态粒子</span>
                </label>
              </div>
            </div>
            <div v-if="view === 'flow'" class="tool-dock">
              <div class="tool-row">
                <div class="tool-group">
                  <span class="tool-group-title">定位</span>
                  <button title="恢复完整隧道鸟瞰视角" @click="focusOverview">⌂ 全景</button>
                  <button title="快速定位到 K3+805～K4+005 风场区间" @click="focusCfd">◎ CFD 区间</button>
                </div>
                <div class="tool-group">
                  <span class="tool-group-title">视角</span>
                  <button title="正对双洞查看横断面" @click="focusStandard('section')">断面</button>
                  <button title="从隧道侧面查看纵断面" @click="focusStandard('side')">侧视</button>
                  <button title="从上方向下查看平面" @click="focusStandard('top')">俯视</button>
                </div>
              </div>
              <div class="tool-row">
                <VentilationMileageSearch :active-tunnel="activeTunnel" @locate="locateFromPlan" />
              </div>
            </div>
            <div v-if="view === 'flow'" class="display-controls">
              <label>透明度 <input type="range" min="0.15" max="1" step="0.05" v-model.number="modelOpacity" @input="changeOpacity"></label>
              <button @click="toggleColorMode">{{ colorMode === 'velocity' ? '风速着色' : '温度着色' }} ▾</button>
            </div>
            <div class="colorbar" :class="{ temperature: view === 'thermal' || colorMode === 'temperature' }">
              <b>{{ view === 'thermal' || colorMode === 'temperature' ? '温度 K' : '风速 m/s' }}</b>
              <div class="gradient"></div>
              <div><span>{{ view === 'thermal' || colorMode === 'temperature' ? '293' : '0.03' }}</span><span>{{ view === 'thermal' || colorMode === 'temperature' ? '318' : '1.03' }}</span></div>
            </div>
            <div v-if="loading3d" class="scene-loading">{{ loadingText }}</div>
            <div v-if="view === 'flow'" class="location-status">
              <span>{{ tunnelLabel(activeTunnel) }}</span><b>{{ formatMileage(activeChainage) }}</b>
              <small>双击模型聚焦 · 二维图可选里程</small>
            </div>

            <div v-if="view === 'thermal'" class="thermal-overlay charts-grid">
              <div class="control-line">
                <b>热瞬态</b><span>壁面 45°C · 入口 20°C · τ=220s</span>
                <label>时间 <input type="range" min="0" :max="thermalTimes.length - 1" v-model.number="thermalIndex" @input="changeThermalTime"></label>
                <strong>t={{ thermalTimes[thermalIndex] }}s</strong>
              </div>
              <div ref="thermalMonitorEl" class="chart"></div>
              <div ref="thermalProfileEl" class="chart"></div>
            </div>
          </section>

          <section v-show="view === 'co'" class="charts-page">
            <div class="control-line">
              <b>CO 爆破扩散</b>
              <label>工作面 <select v-model="coFace" @change="renderCoCharts"><option>Right</option><option>Left</option><option>DDK</option></select></label>
              <span>安全阈值 <strong class="danger">24 ppm</strong></span><span>50kg 炸药 · D=20m²/s</span>
            </div>
            <div class="chart-card"><h3>浓度—时间曲线</h3><div ref="coTimeEl" class="chart"></div></div>
            <div class="chart-card"><h3>浓度—里程剖面</h3><div class="inline-slider"><input type="range" min="0" :max="coSnapshotMax" v-model.number="coSnapshot" @input="renderCoProfile"><span>{{ coSnapshotTime }}</span></div><div ref="coProfileEl" class="chart"></div></div>
          </section>

          <section v-show="view === 'transient'" class="charts-page">
            <div class="control-line">
              <b>1D 瞬态通风</b>
              <label>场景 <select v-model="transientScenario" @change="loadTransient">
                <option value="fan_ramp_up">风机爬升 0→100%</option><option value="fan_oscillation">右线风机波动 60–100%</option>
                <option value="damper_close">关闭 K2+300 横通道</option><option value="fan_shutdown">右线风机故障停机</option>
                <option value="combined">组合场景</option>
              </select></label>
              <label>时间 <input type="range" min="0" :max="transientMax" v-model.number="transientIndex" @input="renderTransientCharts"></label>
              <strong>{{ transientTimeLabel }}</strong>
            </div>
            <div class="chart-card"><h3>风筒流量 Q(t)</h3><div ref="transientDuctEl" class="chart"></div></div>
            <div class="chart-card"><h3>横通道 / 竖井流量 Q(t)</h3><div ref="transientPassageEl" class="chart"></div></div>
          </section>
        </div>
      </main>

      <aside class="info-panel">
        <button v-if="view === 'flow'" class="design-preview" type="button" @click="selectView('geometry')">
          <span class="preview-heading"><b>二维通风设计图</b><em>点击展开 ↗</em></span>
          <TunnelGeometryView compact :active-chainage="activeChainage" :active-tunnel="activeTunnel" />
          <span class="preview-metrics">
            <span><small>标准断面</small><b>9m × 7.66m</b></span><span><small>主洞中心距</small><b>32m</b></span>
            <span><small>DDK 接入角</small><b>22.5°</b></span><span><small>横通道</small><b>4 处</b></span>
          </span>
        </button>
        <h2>{{ infoTitle }}</h2>
        <template v-if="view === 'geometry'">
          <article class="info-card geometry-info"><h3>隧道断面</h3>
            <p><span>截面形状</span><b>马蹄形</b></p><p><span>净宽 × 净高</span><b>9.0m × 7.66m</b></p>
            <p><span>截面积</span><b>58.5 m²</b></p><p><span>主洞中心距 / 净岩柱</span><b>32m / 约19.6m</b></p><p><span>DDK 接入角</span><b>22.5°</b></p>
          </article>
          <article class="info-card geometry-info"><h3>三管隧道</h3>
            <div class="geo-box"><h4>左主洞 (主洞)</h4>
              <p><span>已建长度</span><b>4000m</b></p><p><span>设计总长</span><b>6800m</b></p><p><span>工作面位置</span><b>K4+000</b></p>
              <p><span>设计段工法</span><b>K4~K6.8 TBM</b></p><p><span>风筒直径</span><b>Φ2.6m</b></p><p><span>风筒终点</span><b>K3.94+940 (距工作面60m)</b></p>
              <p><span>风机</span><b>JK-2: 4273 m³/min @ 2638 Pa</b></p><p><span>射流风机</span><b>1000型, ⌀1m, L=4.75m, 7台</b></p>
              <p><span>布置区间</span><b>K0-K3.5, 间距500m</b></p><p><span>单台推力</span><b>1100-1200 N</b></p>
            </div>
            <div class="geo-box"><h4>右主洞 (主洞)</h4>
              <p><span>已建长度</span><b>2300m</b></p><p><span>设计总长</span><b>7800m</b></p><p><span>工作面位置</span><b>K2.3+300</b></p>
              <p><span>设计段工法</span><b>K2.3~K6.8 钻爆, K6.8~K7.8 TBM</b></p><p><span>风筒直径</span><b>Φ2.4m</b></p>
              <p><span>风筒终点</span><b>K2.24+240 (距工作面60m)</b></p><p><span>风机</span><b>JK-3: 4631 m³/min @ 5434 Pa</b></p>
            </div>
            <div class="geo-box"><h4>DDK 探洞 (探洞)</h4>
              <p><span>已建长度</span><b>6800m</b></p><p><span>设计总长</span><b>6800m</b></p><p><span>工作面位置</span><b>K6.8+800</b></p>
              <p><span>设计段工法</span><b>无 (全部已建成)</b></p><p><span>风筒直径</span><b>Φ1.5m</b></p>
              <p><span>风筒终点</span><b>K6.77+770 (距工作面30m)</b></p><p><span>风机</span><b>JK-1: 1291 m³/min @ 4801 Pa</b></p>
              <p><span>汇入</span><b class="merge">K2.3+300 汇入 Right 主洞</b></p><p><span>DDK共用段</span><b class="shared">K2+300 ~ K6+800</b></p>
            </div>
          </article>
          <article class="info-card geometry-info"><h3>横通道 (Cross Passages)</h3>
            <p><span>K2.3+300</span><b>Left ⟷ Right — 4m×4m</b></p><p><span>K4+000</span><b>Left ⟷ Right — 4m×4m</b></p>
            <p><span>K5.4+400</span><b>Left ⟷ Right — 4m×4m</b></p><p><span>K6.8+800</span><b>Left ⟷ Right — 4m×4m</b></p>
          </article>
          <article class="info-card geometry-info"><h3>辅助通道</h3>
            <p><span>D线 (K4+000)</span><b>左主洞上方，垂直接入，钻爆施工</b></p><p><span>A线 (K4+000)</span><b>右主洞下方，垂直接入，钻爆施工</b></p>
          </article>
        </template>
        <template v-else-if="view === 'flow'">
          <article class="info-card model-composition"><h3>三维隧道装配</h3>
            <p><span>左主洞</span><b>TBM · 6,800m · 68段</b></p><p><span>右主洞</span><b>钻爆 · 7,800m · 78段</b></p>
            <p><span>横通道</span><b>4处 · 4m×4m</b></p><p><span>附属通道</span><b>DDK + A线 + D线</b></p>
          </article>
          <article class="info-card"><h3>稳态 CFD 风场</h3><p><span>计算点</span><b>{{ cfdCells?.meta.n || 0 }}</b></p><p><span>矢量样本</span><b>{{ cfdArrows?.meta.n || 0 }}</b></p><p><span>数据区间</span><b>K3+805～K4+005</b></p><p><span>当前着色</span><b>{{ colorMode === 'velocity' ? '风速' : '温度' }}</b></p></article>
          <article v-if="pickedInfo" class="info-card highlight"><h3>选中 CFD 采样点</h3><p><span>里程</span><b>{{ formatMileage(pickedInfo.chainage) }}</b></p><p><span>风速</span><b>{{ pickedInfo.velocity.toFixed(3) }} m/s</b></p><p><span>温度</span><b>{{ pickedInfo.temperature.toFixed(2) }} K / {{ (pickedInfo.temperature - 273.15).toFixed(1) }}°C</b></p></article>
          <article class="info-card gallery"><h3>CFD 分析图</h3><div v-for="img in analysisImages" :key="img.src"><img :src="img.src" :alt="img.label" @click="modalImage = img.src"><small>{{ img.label }}</small></div></article>
        </template>
        <template v-else-if="view === 'co'">
          <article v-for="name in ['Right','Left','DDK']" :key="name" class="info-card"><h3>{{ name }} 安全复归时间</h3><p v-for="label in coLabels" :key="label"><span>{{ label }}</span><b :class="safeClass(coData?.[name]?.t_safe?.[label])">{{ safeTime(coData?.[name]?.t_safe?.[label]) }}</b></p></article>
        </template>
        <template v-else-if="view === 'transient'">
          <article class="info-card"><h3>{{ transientName }}</h3><p><span>时间</span><b>{{ transientTimeLabel }}</b></p><p><span>仿真步长</span><b>{{ transientData?.dt || '-' }}s</b></p><p><span>持续时间</span><b>{{ transientData ? formatDuration(transientData.duration) : '-' }}</b></p></article>
          <article class="info-card"><h3>当前流量</h3><p v-for="edge in currentTransientValues" :key="edge.name"><span>{{ edge.label }}</span><b>{{ edge.value.toFixed(2) }} m³/s</b></p></article>
          <article class="info-card note">{{ transientData?.description }}</article>
        </template>
        <template v-else>
          <article class="info-card"><h3>3D CFD 热瞬态</h3><p><span>时间</span><b>{{ thermalTimes[thermalIndex] }}s</b></p><p><span>热平衡进度</span><b>{{ thermalProgress }}%</b></p><p><span>特征时间</span><b>τ = 220s</b></p><p><span>方法</span><b>稳态 CFD + 指数松弛</b></p></article>
          <article class="info-card"><h3>出口温度</h3><p><span>右管</span><b>{{ thermalOutlet('right') }}</b></p><p><span>左管</span><b>{{ thermalOutlet('left') }}</b></p><p><span>入口</span><b>293.15 K / 20°C</b></p><p><span>壁面</span><b>318.15 K / 45°C</b></p></article>
          <article class="info-card note">瞬态 CFD 能量方程未激活，当前使用稳态解与指数松弛模型近似；完整瞬态 CFD 待重跑。</article>
        </template>
      </aside>
    </div>

    <div v-if="modalImage" class="image-modal" @click="modalImage = ''"><button>×</button><img :src="modalImage" alt="CFD 分析大图"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import * as Cesium from 'cesium'
import * as echarts from 'echarts'
import { useRouter } from 'vue-router'
import TunnelGeometryView from './TunnelGeometryView.vue'
import VentilationMileageSearch from './VentilationMileageSearch.vue'
import { createVentilationViewer, flyToLocal, installModelControls, lookAtLocal } from './scene'
import { buildSteadyLayers, destroyVentilation, layers, loadTunnelModel, recolorSteady, setLayerVisible, setModelOpacity, setTunnelSectionView, updateThermalPoints, type CfdData, type ColorMode } from './cesiumVentilation'

type ViewKey = 'geometry' | 'flow' | 'co' | 'transient' | 'thermal'
const router = useRouter()
function openWorksiteOverview() {
  router.push({ path: '/', query: { view: 'line-overview' } })
}
const ASSET = '/data/ventilation/'
const view = ref<ViewKey>('flow')
const cesiumHost = ref<HTMLElement>()
const loading3d = ref(false)
const loadingText = ref('加载 Cesium 场景…')
const colorMode = ref<ColorMode>('velocity')
const modelOpacity = ref(0.82)
const visibility = ref({ points: true, arrows: true, streamlines: true, particles: true })
const layerPanelCollapsed = ref(false)
const layerPanelPosition = ref({ left: 14, top: 45 })
const renderedField = ref<'steady' | 'thermal' | null>(null)
const pickedInfo = ref<any>(null)
function openPlatformModule(key: 'workface' | 'blast' | 'support' | 'dispatch') {
  if (key === 'blast') {
    router.push('/blast-twin')
    return
  }
  router.push({ path: '/', query: { scene: key } })
}
type TunnelKey = 'left' | 'right' | 'ddk'
const activeChainage = ref(3905.151)
const activeTunnel = ref<TunnelKey>('left')
const modalImage = ref('')
const cfdCells = ref<CfdData>()
const cfdArrows = ref<CfdData>()
let viewer: Cesium.Viewer | undefined
let cameraControls: ReturnType<typeof installModelControls> | undefined
let pickHandler: Cesium.ScreenSpaceEventHandler | undefined
let mileageMarker: Cesium.Entity | undefined
let mileageMarkerTimer: ReturnType<typeof setTimeout> | undefined
let stopLayerPanelDrag: (() => void) | undefined
// CFD 数据包围盒中心：X[-5.4846,45.4880]、Y[0,7.5292]、Z[3805.1509,4005.1511]。
// 视角复位以该点（K3+905.151）为默认中心；交互时旋转中心随鼠标落点更新。
const CFD_FOCUS = new Cesium.Cartesian3(20.001704, 3.764577, 3905.151001)
const orbitFocus = Cesium.Cartesian3.clone(CFD_FOCUS)
let overviewRadius = 3650

const analysisImages = [
  { src: ASSET + 'mid_tunnel_contour.png', label: '隧道中部温度云图' },
  { src: ASSET + 'axial_temperature_profile.png', label: '轴向温度剖面' },
  { src: ASSET + 'cross_section_contours.png', label: '典型横断面云图' },
]
const infoTitle = computed(() => ({
  geometry: '隧道几何参数总览',
  flow: '3D 隧道风流 — 点击模型查看详情',
  co: 'CO 爆破预测 — 安全复归时间',
  transient: '1D 瞬态通风 — 风机/风门时间推进',
  thermal: '3D 热瞬态 — 温度场时间演化 (τ=220s)',
}[view.value]))

async function ensureScene() {
  if (viewer || !cesiumHost.value) return
  loading3d.value = true
  viewer = createVentilationViewer(cesiumHost.value)
  cameraControls = installModelControls(viewer, () => orbitFocus, updateActiveFocus)
  loadingText.value = '加载隧道 GLB 模型…'
  const model = await loadTunnelModel(viewer)
  overviewRadius = model.boundingSphere.radius
  // 首次进入直接观察 CFD 计算区间，不再从完整隧道远景开始。
  focusCfd()
  pickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
  pickHandler.setInputAction((event: any) => {
    if (cameraControls?.isInteracting()) return
    const picked = viewer?.scene.pick(event.position)
    if (picked?.id?.kind) {
      pickedInfo.value = picked.id
      activeChainage.value = picked.id.chainage
      activeTunnel.value = picked.id.tunnel || activeTunnel.value
      if (viewer?.scene.pickPositionSupported) {
        try {
          const position = viewer.scene.pickPosition(event.position)
          if (Cesium.defined(position)) placeMileageMarker(position, activeTunnel.value, activeChainage.value)
        } catch { /* 深度拾取未就绪时保留信息卡反馈。 */ }
      }
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
  pickHandler.setInputAction((event: any) => {
    if (!viewer || cameraControls?.isInteracting()) return
    const picked = viewer.scene.pick(event.endPosition)
    viewer.scene.canvas.style.cursor = Cesium.defined(picked) ? 'pointer' : 'grab'
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)
  loading3d.value = false
}

async function ensureSteadyData() {
  await ensureScene()
  if (!cfdCells.value || !cfdArrows.value) {
    loading3d.value = true; loadingText.value = '加载 CFD 点云与矢量场…'
    const [cells, arrows] = await Promise.all([
      fetch(ASSET + 'cfd_cell_data_lite.json').then(r => r.json()),
      fetch(ASSET + 'cfd_arrows.json').then(r => r.json()),
    ])
    cfdCells.value = cells; cfdArrows.value = arrows
    loading3d.value = false
  }
  if (renderedField.value !== 'steady') {
    buildSteadyLayers(viewer!, cfdCells.value!, cfdArrows.value!, colorMode.value)
    renderedField.value = 'steady'
  }
}

async function selectView(key: ViewKey) {
  view.value = key
  await nextTick()
  if (key === 'flow') { await ensureSteadyData(); showSteadyLayers(true); viewer?.resize() }
  else if (key === 'co') await loadCo()
  else if (key === 'transient') await loadTransient()
  else if (key === 'thermal') { showSteadyLayers(false); await initThermal(); viewer?.resize() }
}
function showSteadyLayers(show: boolean) {
  for (const key of ['points','arrows','streamlines','particles'] as const) setLayerVisible(key, show && visibility.value[key])
}
function toggleLayer(key: keyof typeof visibility.value) {
  visibility.value[key] = !visibility.value[key]
  setLayerVisible(key, visibility.value[key])
  viewer?.scene.requestRender()
}
function toggleColorMode() {
  colorMode.value = colorMode.value === 'velocity' ? 'temperature' : 'velocity'
  if (cfdCells.value) recolorSteady(cfdCells.value, colorMode.value)
  viewer?.scene.requestRender()
}
function changeOpacity() { if (viewer) setModelOpacity(viewer, modelOpacity.value) }
function showTunnelLabels(show: boolean) {
  if (layers.tunnelLabels) layers.tunnelLabels.show = show
}
function usePerspectiveProjection() {
  viewer?.camera.switchToPerspectiveFrustum()
}
function startLayerPanelDrag(event: MouseEvent) {
  if (event.button !== 0) return
  const panel = (event.currentTarget as HTMLElement).closest('.vent-layer-panel') as HTMLElement | null
  const stage = panel?.parentElement
  if (!panel || !stage) return
  event.preventDefault()
  const startX = event.clientX
  const startY = event.clientY
  const origin = { ...layerPanelPosition.value }
  const move = (moveEvent: MouseEvent) => {
    const maxLeft = Math.max(6, stage.clientWidth - panel.offsetWidth - 6)
    const maxTop = Math.max(38, stage.clientHeight - panel.offsetHeight - 6)
    layerPanelPosition.value = {
      left: Cesium.Math.clamp(origin.left + moveEvent.clientX - startX, 6, maxLeft),
      top: Cesium.Math.clamp(origin.top + moveEvent.clientY - startY, 38, maxTop),
    }
  }
  const stop = () => {
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mouseup', stop)
    stopLayerPanelDrag = undefined
  }
  stopLayerPanelDrag?.()
  stopLayerPanelDrag = stop
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', stop)
}
function focusOverview() {
  if (!viewer) return
  usePerspectiveProjection()
  setTunnelSectionView(viewer)
  showSteadyLayers(true)
  showTunnelLabels(true)
  Cesium.Cartesian3.clone(CFD_FOCUS, orbitFocus)
  cameraControls?.reset()
  updateActiveFocus(orbitFocus)
  // The GLB is assembled in plan order (left/TBM on positive local X). This
  // camera keeps that alignment above the right/drill tunnel, matching the 2D plan.
  lookAtLocal(viewer, orbitFocus, new Cesium.Cartesian3(overviewRadius * -1.18, overviewRadius * 0.83, overviewRadius * 0.71))
}
function focusCfd() {
  if (!viewer) return
  usePerspectiveProjection()
  setTunnelSectionView(viewer)
  showSteadyLayers(true)
  showTunnelLabels(true)
  Cesium.Cartesian3.clone(CFD_FOCUS, orbitFocus)
  cameraControls?.reset()
  updateActiveFocus(orbitFocus)
  // 以 CFD 包围盒中心为观察中心，完整容纳双洞和 200m 计算区间。
  cameraControls?.setFocus(orbitFocus)
  flyToLocal(viewer, orbitFocus, new Cesium.Cartesian3(-155, 105, 255), 0.95)
}
function updateActiveFocus(focus: Cesium.Cartesian3) {
  Cesium.Cartesian3.clone(focus, orbitFocus)
  activeChainage.value = Cesium.Math.clamp(focus.z, 0, 8200)
  activeTunnel.value = focus.x >= 16 ? 'left' : 'right'
}
function tunnelLabel(tunnel: TunnelKey) { return ({ left: '左主洞', right: '右主洞', ddk: 'DDK 探洞' })[tunnel] }
function formatMileage(z: number) { const n = Math.abs(Math.round(z)); return `K${Math.floor(n/1000)}+${String(n%1000).padStart(3,'0')}` }
function placeMileageMarker(position: Cesium.Cartesian3, tunnel: TunnelKey, chainage: number) {
  if (!viewer) return
  if (mileageMarker) viewer.entities.remove(mileageMarker)
  if (mileageMarkerTimer) clearTimeout(mileageMarkerTimer)
  mileageMarker = viewer.entities.add({
    position,
    point: {
      pixelSize: 13,
      color: Cesium.Color.YELLOW,
      outlineColor: Cesium.Color.fromCssColorString('#ff5722'),
      outlineWidth: 2,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    label: {
      text: `${tunnelLabel(tunnel)}  ${formatMileage(chainage)}`,
      font: '600 13px Microsoft YaHei',
      fillColor: Cesium.Color.YELLOW,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -18),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  })
  mileageMarkerTimer = setTimeout(() => {
    if (viewer && mileageMarker) viewer.entities.remove(mileageMarker)
    mileageMarker = undefined
    viewer?.scene.requestRender()
  }, 10000)
}
function focusStandard(kind: 'section' | 'side' | 'top') {
  if (!viewer) return
  const selectedTunnel = activeTunnel.value
  const chainage = activeChainage.value
  // 标准视图统一以两条主洞的中线为中心，使用固定取景距离，避免受当前缩放影响。
  const target = new Cesium.Cartesian3(16, 3.5, chainage)
  const offsets = {
    // 位于当前切面的大里程侧近距离回望，形成参考图中的双洞汇聚效果。
    section: new Cesium.Cartesian3(0, 0, 48),
    // 保留侧向关系并加入少量轴向夹角，使两条平行主洞不再完全重合。
    side: new Cesium.Cartesian3(-115, 35, -70),
    top: new Cesium.Cartesian3(0, 245, 0.001),
  }
  Cesium.Cartesian3.clone(target, orbitFocus)
  usePerspectiveProjection()
  if (kind !== 'section') {
    setTunnelSectionView(viewer)
    showSteadyLayers(true)
    showTunnelLabels(kind !== 'side')
  }
  cameraControls?.reset()
  cameraControls?.setFocus(target)
  activeTunnel.value = selectedTunnel
  activeChainage.value = chainage
  flyToLocal(viewer, target, offsets[kind], 0.85)
}
async function locateFromPlan(payload: { tunnel: TunnelKey; chainage: number }) {
  activeTunnel.value = payload.tunnel
  activeChainage.value = payload.chainage
  view.value = 'flow'
  await nextTick()
  await ensureSteadyData()
  if (!viewer) return
  usePerspectiveProjection()
  setTunnelSectionView(viewer)
  showSteadyLayers(true)
  showTunnelLabels(true)
  // 与组装模型的 DDK 接入端点一致（进入右主洞衬砌 0.35m）。
  const ddkEndX = -5.700000266269564
  const x = payload.tunnel === 'left' ? 32 : payload.tunnel === 'right' ? 0
    : ddkEndX - Math.tan(Cesium.Math.toRadians(22.5)) * (2370 - payload.chainage)
  const focus = new Cesium.Cartesian3(x, 3.8, payload.chainage)
  Cesium.Cartesian3.clone(focus, orbitFocus)
  cameraControls?.setFocus(focus)
  placeMileageMarker(focus, payload.tunnel, payload.chainage)
  flyToLocal(viewer, focus, new Cesium.Cartesian3(-105, 62, 138))
  viewer.resize()
}

const coFace = ref('Right'); const coSnapshot = ref(0); const coData = ref<any>()
const coTimeEl = ref<HTMLElement>(); const coProfileEl = ref<HTMLElement>()
let coTimeChart: echarts.ECharts | undefined; let coProfileChart: echarts.ECharts | undefined
const coLabels = ['掌子面','200m','500m','1000m','洞口']
const coSnapshotMax = computed(() => Math.max(0, (coData.value?.[coFace.value]?.snapshots?.length || 1) - 1))
const coSnapshotTime = computed(() => { const t=coData.value?.[coFace.value]?.snapshots?.[coSnapshot.value]?.t || 0; return `t=${(t/60).toFixed(0)}min` })
async function loadCo() {
  if (!coData.value) coData.value = await fetch(ASSET + 'co_transport_results.json').then(r => r.json())
  coSnapshot.value = 0; await nextTick(); renderCoCharts()
}
function renderCoCharts() {
  const data=coData.value?.[coFace.value]; if (!data || !coTimeEl.value) return
  coTimeChart ||= echarts.init(coTimeEl.value); coProfileChart ||= echarts.init(coProfileEl.value!)
  const colors=['#ef5350','#ff8c42','#f9a825','#4caf50','#64b5f6']
  coTimeChart.setOption(darkLineOption(data.times.map((v:number)=>v/60), coLabels.map((name,i)=>({name,data:data.history[name],color:colors[i]})), '时间 / min', 'CO / ppm', 24), true)
  renderCoProfile()
}
function renderCoProfile() {
  const snap=coData.value?.[coFace.value]?.snapshots?.[coSnapshot.value]; if(!snap || !coProfileEl.value) return
  coProfileChart ||= echarts.init(coProfileEl.value)
  coProfileChart.setOption(darkLineOption(snap.x.map((v:number)=>v/1000), [{name:'CO浓度',data:snap.c_ppm,color:'#ff8c42'}], '里程 / km', 'CO / ppm', 24), true)
}
function safeTime(v: number | null | undefined) { return v == null ? '>60 min' : `${(v/60).toFixed(1)} min` }
function safeClass(v: number | null | undefined) { return v == null ? 'unsafe' : v < 1800 ? 'safe' : 'warning' }

const transientScenario=ref('fan_ramp_up'); const transientData=ref<any>(); const transientIndex=ref(0)
const transientDuctEl=ref<HTMLElement>(); const transientPassageEl=ref<HTMLElement>()
let transientDuctChart:echarts.ECharts|undefined; let transientPassageChart:echarts.ECharts|undefined
const transientMax=computed(()=>Math.max(0,(transientData.value?.times?.length||1)-1))
const transientTimeLabel=computed(()=>{const t=transientData.value?.times?.[transientIndex.value]||0;return t>=600?`${(t/60).toFixed(1)}min`:`${t}s`})
const transientName=computed(()=>({fan_ramp_up:'风机爬升',fan_oscillation:'右线风机波动',damper_close:'关闭横通道',fan_shutdown:'风机故障停机',combined:'组合场景'} as any)[transientScenario.value])
const transientEdges=[['Duct_DDK','DDK风筒'],['Duct_Left','左线风筒'],['Duct_Right','右线风筒'],['CP_2300_Left_Right','CP左-右'],['CP_2300_DDK_Left','CP DDK-左'],['CP_4000_DDK_Left','CP DDK-左2'],['Shaft','竖井']]
const currentTransientValues=computed(()=>transientEdges.map(([name,label])=>({name,label,value:transientData.value?.history?.[name]?.Q?.[transientIndex.value]||0})))
async function loadTransient() {
  transientData.value=await fetch(`${ASSET}transient_${transientScenario.value}.json`).then(r=>r.json()); transientIndex.value=0; await nextTick(); renderTransientCharts()
}
function renderTransientCharts(){
  const d=transientData.value;if(!d||!transientDuctEl.value)return
  transientDuctChart ||= echarts.init(transientDuctEl.value);transientPassageChart ||=echarts.init(transientPassageEl.value!)
  const cursor=d.times[transientIndex.value]||0;const mark={xAxis:cursor,lineStyle:{color:'#ff8c42',type:'dashed'},label:{show:false}}
  const duct=[['Duct_DDK','#c58af9'],['Duct_Left','#4caf50'],['Duct_Right','#64b5f6']].map(([name,color])=>({name,data:d.history[name]?.Q||[],color}))
  const pass=[['CP_2300_Left_Right','#ff8c42'],['CP_2300_DDK_Left','#c58af9'],['CP_4000_DDK_Left','#ffab40'],['Shaft','#4fc3f7']].map(([name,color])=>({name,data:d.history[name]?.Q||[],color}))
  transientDuctChart.setOption(darkLineOption(d.times,duct,'时间 / s','Q / m³·s⁻¹',undefined,mark),true)
  transientPassageChart.setOption(darkLineOption(d.times,pass,'时间 / s','Q / m³·s⁻¹',undefined,mark),true)
}
function formatDuration(s:number){return s>=600?`${(s/60).toFixed(1)}min`:`${s}s`}

const thermalTimes=[0,100,200,300,400,600,800,1000]; const thermalIndex=ref(0)
const thermalMeta=ref<any>(); const thermalMonitors=ref<any>(); const thermalSnapshot=ref<CfdData>()
const thermalMonitorEl=ref<HTMLElement>(); const thermalProfileEl=ref<HTMLElement>()
let thermalMonitorChart:echarts.ECharts|undefined;let thermalProfileChart:echarts.ECharts|undefined
const thermalProgress=computed(()=>(100*(1-Math.exp(-thermalTimes[thermalIndex.value]/220))).toFixed(1))
async function initThermal(){
  await ensureScene(); focusCfd(); if(!thermalMeta.value){[thermalMeta.value,thermalMonitors.value]=await Promise.all([fetch(ASSET+'cfd_transient_index.json').then(r=>r.json()),fetch(ASSET+'transient_thermal_monitors.json').then(r=>r.json())])}
  await changeThermalTime()
}
async function changeThermalTime(){
  const snap=thermalMeta.value?.snapshots?.[thermalIndex.value];if(!snap||!viewer)return
  loading3d.value=true;loadingText.value=`加载 t=${snap.t}s 热场…`;thermalSnapshot.value=await fetch(ASSET+snap.file).then(r=>r.json());updateThermalPoints(viewer,thermalSnapshot.value!);renderedField.value='thermal';loading3d.value=false;await nextTick();renderThermalCharts()
}
function renderThermalCharts(){
  if(!thermalMonitors.value||!thermalSnapshot.value||!thermalMonitorEl.value)return
  thermalMonitorChart ||=echarts.init(thermalMonitorEl.value);thermalProfileChart ||=echarts.init(thermalProfileEl.value!)
  const m=thermalMonitors.value
  thermalMonitorChart.setOption(darkLineOption(m.times_s,[{name:'右管出口',data:m.T_outlet_right_K,color:'#ef5350'},{name:'左管出口',data:m.T_outlet_left_K,color:'#4caf50'}],'时间 / s','温度 / K',undefined,{xAxis:thermalTimes[thermalIndex.value],lineStyle:{color:'#ff8c42',type:'dashed'},label:{show:false}}),true)
  const d=thermalSnapshot.value;const bins=80,z0=Math.min(...d.z),z1=Math.max(...d.z),sum=Array(bins).fill(0),count=Array(bins).fill(0)
  d.z.forEach((z,i)=>{const b=Math.min(bins-1,Math.floor((z-z0)/(z1-z0)*bins));sum[b]+=d.temp[i];count[b]++})
  const xs:number[]=[];const ys:number[]=[];for(let i=0;i<bins;i++)if(count[i]){xs.push((z0+(i+.5)*(z1-z0)/bins)/1000);ys.push(sum[i]/count[i])}
  thermalProfileChart.setOption(darkLineOption(xs,[{name:`T(z) t=${thermalTimes[thermalIndex.value]}s`,data:ys,color:'#ff8c42'}],'里程 / km','温度 / K'),true)
}
function thermalOutlet(side:'right'|'left'){const key=`T_outlet_${side}_K`;const v=thermalMonitors.value?.[key]?.[thermalIndex.value];return v?`${v.toFixed(1)} K / ${(v-273.15).toFixed(1)}°C`:'-'}

function darkLineOption(x:number[],series:Array<{name:string;data:number[];color:string}>,xName:string,yName:string,threshold?:number,markLine?:any):echarts.EChartsOption{
  const allSeries:any[]=series.map(s=>({name:s.name,type:'line',data:x.map((v,i)=>[v,s.data[i]]),showSymbol:false,sampling:'lttb',lineStyle:{width:1.8,color:s.color},itemStyle:{color:s.color},markLine:markLine?{silent:true,symbol:'none',data:[markLine]}:undefined}))
  if(threshold!=null)allSeries[0].markLine={silent:true,symbol:'none',data:[{yAxis:threshold,lineStyle:{color:'#ef5350',type:'dashed'},label:{formatter:`安全阈值 ${threshold} ppm`,color:'#ef5350'}}]}
  return{backgroundColor:'transparent',animation:false,tooltip:{trigger:'axis'},legend:{textStyle:{color:'#91aac0'},top:0},grid:{left:52,right:22,top:34,bottom:38},xAxis:{type:'value',name:xName,nameTextStyle:{color:'#607f99'},axisLabel:{color:'#607f99'},axisLine:{lineStyle:{color:'#29445a'}},splitLine:{lineStyle:{color:'#162a3a'}}},yAxis:{type:'value',name:yName,nameTextStyle:{color:'#607f99'},axisLabel:{color:'#607f99'},axisLine:{lineStyle:{color:'#29445a'}},splitLine:{lineStyle:{color:'#162a3a'}}},series:allSeries}
}

function resizeAll(){viewer?.resize();[coTimeChart,coProfileChart,transientDuctChart,transientPassageChart,thermalMonitorChart,thermalProfileChart].forEach(c=>c?.resize())}
onMounted(()=>{if(window.innerWidth<=900)layerPanelCollapsed.value=true;window.addEventListener('resize',resizeAll);selectView('flow')})
onBeforeUnmount(()=>{window.removeEventListener('resize',resizeAll);stopLayerPanelDrag?.();if(mileageMarkerTimer)clearTimeout(mileageMarkerTimer);if(viewer&&mileageMarker)viewer.entities.remove(mileageMarker);pickHandler?.destroy();cameraControls?.destroy();if(viewer){destroyVentilation(viewer);viewer.destroy()}[coTimeChart,coProfileChart,transientDuctChart,transientPassageChart,thermalMonitorChart,thermalProfileChart].forEach(c=>c?.dispose())})
</script>

<style scoped lang="scss">
.vent-root{position:fixed;inset:0;background:#07131f;color:#c8d8e8;font-family:system-ui,"Microsoft YaHei",sans-serif;overflow:hidden}.vent-header{height:64px;padding:9px 28px 9px 160px;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(135deg,#13283a,#07131f);border-bottom:1px solid #1e4058}.vent-header h1{font-size:20px;color:#e2f4ff;margin:0 0 4px;letter-spacing:1px}.badges{display:flex;gap:7px}.badges span{font-size:10px;padding:2px 8px;border-radius:10px;background:#173247;color:#65c8ff}.badges span:nth-child(2){color:#6ee7a7}.badges span:nth-child(3){color:#ffad66}.meta{text-align:right;font-size:11px;line-height:1.5;color:#66859d}.vent-layout{height:calc(100% - 64px);display:grid;grid-template-columns:minmax(0,1fr) 360px}.workspace{min-width:0;display:flex;flex-direction:column}.tabs{height:45px;display:flex;background:#0b1a27;border-bottom:1px solid #18364a}.tabs button{flex:1;border:0;border-bottom:2px solid transparent;background:transparent;color:#6f8ca3;cursor:pointer}.tabs button:hover{background:#102536;color:#b7d8ec}.tabs button.active{background:#102536;color:#7dd3fc;border-color:#38bdf8}.stage{position:relative;flex:1;min-height:0}.geometry-view,.charts-page,.cesium-section{position:absolute;inset:0}.legend-row{height:42px;display:flex;align-items:center;gap:18px;padding:0 22px;border-bottom:1px solid #193347;font-size:11px;color:#7895ab}.legend-row i{display:inline-block;width:10px;height:10px;margin-right:5px;border-radius:2px}.legend-row .duct{background:#4da6ff}.legend-row .built{background:#31536a}.legend-row .drill{background:#8b4c3e}.legend-row .tbm{background:#317245}.legend-row .face{background:#e53935}.legend-row .passage{background:#c58af9}.geometry-canvas{position:relative;height:calc(100% - 42px);padding:74px 20px 30px 120px;background:radial-gradient(circle at 50% 30%,#10283a,#07131f 75%)}.scale{position:absolute;left:120px;right:20px;top:34px;height:24px;border-top:1px solid #28495f}.scale span{position:absolute;top:-20px;font:10px Consolas;color:#55748b;transform:translateX(-50%)}.tunnel-row{height:130px;position:relative}.tunnel-name{position:absolute;right:calc(100% + 15px);top:18px;width:90px;text-align:right}.tunnel-name b{display:block;color:#aad5ed;font-size:13px}.tunnel-name small{color:#55748b}.tunnel-track{position:relative;height:66px;background:#0b1b27;border:1px solid #25485c;border-radius:5px;overflow:visible}.built-segment,.design-segment{position:absolute;inset:0 auto 0 0;background:#1b3b4e}.design-segment{display:flex;align-items:center;justify-content:center;font-size:10px;color:#d5dfdf}.design-segment.tbm{background:#1e4a2e}.design-segment.钻爆{background:#57362f}.duct-line{position:absolute;left:0;top:12px;height:5px;background:#4da6ff;box-shadow:0 0 7px #4da6ff}.fan-mark{position:absolute;left:5px;top:4px;background:#ffa726;color:#1a1a1a;font:bold 9px Consolas;padding:2px 3px;border-radius:2px}.face-mark{position:absolute;top:-5px;width:5px;height:76px;background:#ef4444;box-shadow:0 0 9px #ef4444;z-index:2}.jet{position:absolute;bottom:5px;color:#65c8ff;font-size:10px;transform:translateX(-50%)}.cross-passage{position:absolute;top:145px;height:130px;width:5px;background:#c58af9;box-shadow:0 0 7px #c58af9}.cross-passage span{position:absolute;top:132px;left:50%;font-size:9px;color:#b88bdb;transform:translateX(-50%)}.shaft{position:absolute;top:75px;border-left:4px solid #ffad42;height:65px;color:#ffad42;font-size:10px;padding-left:6px;white-space:nowrap}.cesium-section{background:#06101a}.cesium-host{position:absolute;inset:0}.cesium-section.thermal .cesium-host{bottom:44%;}.flow-toolbar,.display-controls{position:absolute;z-index:5;display:flex;gap:6px;background:rgba(4,13,22,.84);border:1px solid #244257;border-radius:8px;padding:6px;backdrop-filter:blur(6px)}.flow-toolbar{top:12px;left:14px}.display-controls{top:12px;right:14px;align-items:center}.flow-toolbar button,.display-controls button{border:1px solid #294b61;background:#102638;color:#6f8da3;border-radius:5px;padding:6px 9px;cursor:pointer}.flow-toolbar button.on,.flow-toolbar button:hover,.display-controls button:hover{color:#8edaff;border-color:#3d83a8;background:#143950}.display-controls label{font-size:11px;color:#829db0;display:flex;align-items:center;gap:5px}.display-controls input{width:75px}.colorbar{position:absolute;right:15px;bottom:15px;z-index:5;width:170px;padding:8px 10px;border:1px solid #28495f;border-radius:7px;background:rgba(3,10,17,.82);font-size:10px}.thermal .colorbar{bottom:calc(44% + 14px)}.colorbar b{display:block;margin-bottom:5px}.colorbar .gradient{height:9px;background:linear-gradient(90deg,#18377f,#00ffff,#00ff33,#ffff00,#ff0000)}.colorbar.temperature .gradient{background:linear-gradient(90deg,#193b99,#00ffff,#ffff00,#ff6500,#8c0000)}.colorbar>div:last-child{display:flex;justify-content:space-between;color:#7591a5}.scene-loading{position:absolute;z-index:8;left:50%;top:50%;transform:translate(-50%,-50%);padding:12px 18px;border:1px solid #28536c;border-radius:8px;background:rgba(4,14,23,.9);color:#7dd3fc}.charts-page{display:grid;grid-template-rows:46px 1fr 1fr;gap:9px;padding:10px;background:#091722}.control-line{display:flex;align-items:center;gap:15px;color:#7895ab;font-size:12px}.control-line b{color:#7dd3fc}.control-line label{display:flex;align-items:center;gap:6px}.control-line select{background:#102638;border:1px solid #294b61;color:#c8d8e8;padding:4px 7px;border-radius:4px}.control-line input{vertical-align:middle}.control-line strong{color:#ff9e52}.control-line .danger{color:#ef5350}.chart-card{position:relative;min-height:0;border:1px solid #1e3a4d;background:#0c1c29;border-radius:7px;padding:8px}.chart-card h3{height:20px;font-size:12px;color:#6ab4e6;font-weight:500}.chart{width:100%;height:calc(100% - 20px);min-height:100px}.inline-slider{position:absolute;right:12px;top:7px;z-index:2;display:flex;align-items:center;gap:7px;font-size:10px;color:#ff9e52}.thermal-overlay{position:absolute;left:0;right:0;bottom:0;height:44%;z-index:6;background:rgba(7,19,31,.96);border-top:1px solid #28536c;padding:7px 12px;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:34px 1fr;gap:6px}.thermal-overlay .control-line{grid-column:1/-1}.thermal-overlay .chart{height:100%;border:1px solid #1c374a;border-radius:5px;background:#0a1925}.info-panel{overflow-y:auto;padding:18px;background:#0b1925;border-left:1px solid #1e4058}.info-panel h2{font-size:14px;color:#7dd3fc;font-weight:500;padding-bottom:10px;margin:0 0 12px;border-bottom:1px solid #29485c}.info-card{padding:11px 13px;margin-bottom:10px;border:1px solid #223f53;border-radius:7px;background:#102332;font-size:11px}.info-card h3{font-size:12px;color:#65c8ff;margin:0 0 7px}.info-card h3 small{float:right;color:#607f94;font-weight:400}.info-card p{display:flex;justify-content:space-between;gap:10px;margin:4px 0;border-bottom:1px solid rgba(42,70,88,.35);color:#7895aa}.info-card p b{color:#b8cedd;text-align:right;font-family:Consolas,monospace}.info-card.highlight{border-color:#3c7698}.info-card.note{color:#a89068;line-height:1.5}.info-card .safe{color:#4caf50}.info-card .warning{color:#ffa726}.info-card .unsafe{color:#ef5350}.gallery img{width:100%;border:1px solid #29485c;border-radius:4px;margin-top:7px;cursor:zoom-in}.gallery small{display:block;color:#66859b;margin-bottom:5px}.image-modal{position:fixed;inset:0;z-index:999;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center}.image-modal img{max-width:94vw;max-height:92vh}.image-modal button{position:absolute;right:25px;top:15px;border:0;background:none;color:#fff;font-size:36px;cursor:pointer}@media(max-width:1100px){.vent-layout{grid-template-columns:minmax(0,1fr) 300px}.meta{display:none}}

/* 与原迁移包一致：两级页签、1fr/400px 主布局、3D 页内图例。 */
.vent-header{height:60px;background:linear-gradient(135deg,#152535,#0a1520)}
.vent-header h1{font-size:19px;font-weight:600}
.vent-layout{height:calc(100% - 60px);grid-template-columns:minmax(0,1fr) 400px}
.tabs{height:43px}
.subtabs{position:absolute;top:0;left:0;right:0;height:34px;z-index:20;display:flex;align-items:center;padding:4px 10px;background:#0f1a26;border-bottom:1px solid #1e3040}
.subtabs button{padding:4px 12px;border:1px solid #2a3a4a;border-right:0;background:transparent;color:#6a8a9a;font-size:11px;cursor:pointer}
.subtabs button:first-child{border-radius:3px 0 0 3px}.subtabs button:last-child{border-right:1px solid #2a3a4a;border-radius:0 3px 3px 0}
.subtabs button.active{color:#ff8c42;border-color:#ff8c42;background:#1a2028}.subtabs button.active+button{border-left-color:#ff8c42}
.stage.has-subtabs>.cesium-section,.stage.has-subtabs>.charts-page{top:34px}
.flow-legend{position:absolute;top:0;left:0;right:0;height:35px;z-index:4;display:flex;align-items:center;gap:14px;padding:0 20px;background:rgba(15,26,38,.9);border-bottom:1px solid #1a2a3a;color:#6a8aaa;font-size:10px}
.flow-legend span{white-space:nowrap}.flow-legend i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:4px}.flow-legend em{margin-left:auto;color:#5a7a9a;font-style:normal}
.flow-toolbar,.display-controls{top:45px}
.info-panel{background:#111d28;border-left-color:#1e3850}
.geometry-info h3{font-size:12px}.geometry-info .geo-box{margin:7px 0;padding:9px 10px;background:#0d1722;border:1px solid #1a2a3a;border-radius:6px}
.geometry-info .geo-box h4{margin:0 0 5px;color:#6ab4e6;font-size:11px}.geometry-info p{margin:2px 0;border-bottom:0}
.geometry-info p b{max-width:68%;font-size:10px;font-weight:500}.geometry-info .merge{color:#ff6d00}.geometry-info .shared{color:#ff8f00}
.design-preview{display:block;width:100%;margin:0 0 12px;padding:0;overflow:hidden;border:1px solid #2b526b;border-radius:8px;background:#091722;color:inherit;text-align:left;cursor:pointer;transition:border-color .2s,transform .2s,box-shadow .2s}
.design-preview:hover{border-color:#55bce8;transform:translateY(-1px);box-shadow:0 8px 24px rgba(0,0,0,.24)}
.preview-heading{height:34px;padding:0 11px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #1d394c;background:#102738}
.preview-heading b{color:#79cdf2;font-size:12px}.preview-heading em{color:#668da5;font-size:10px;font-style:normal}
.preview-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;border-top:1px solid #1d394c;background:#1d394c}.preview-metrics>span{padding:7px 5px;background:#0e202e;text-align:center}
.preview-metrics small,.preview-metrics b{display:block}.preview-metrics small{margin-bottom:2px;color:#5f8198;font-size:8px}.preview-metrics b{color:#b7d6e7;font:500 9px Consolas,monospace}
.charts-page{grid-template-columns:1fr;grid-template-rows:46px minmax(0,1fr) minmax(0,1fr)}
.charts-page>.control-line{grid-column:1}.charts-page>.chart-card{min-width:0}
@media(max-width:1100px){.meta{display:none}}
@media(max-width:900px){
  .vent-header{padding-left:150px;padding-right:14px}.vent-header h1{font-size:16px}.badges{gap:3px}.badges span{padding:2px 5px}
  .vent-layout{grid-template-columns:1fr;grid-template-rows:minmax(350px,60%) minmax(220px,40%);overflow:hidden}
  .info-panel{border-left:0;border-top:1px solid #1e3850;padding:12px 16px}
  .flow-toolbar{left:10px;right:10px;flex-wrap:wrap}.display-controls{top:94px;left:10px;right:auto}
  .flow-toolbar button,.display-controls button{padding:5px 7px}.flow-legend{padding:0 10px;gap:8px}.flow-legend em{display:none}
  .charts-page{padding:7px;gap:6px}.control-line{gap:8px;flex-wrap:wrap}
}

/* 主界面视觉体系：仅覆盖外观，不改变模块结构、尺寸计算和交互逻辑。 */
.vent-root{
  --vent-cyan:#00eaff;
  --vent-blue:#1e90ff;
  --vent-text:#d7efff;
  --vent-muted:#72a2bc;
  --vent-line:rgba(0,234,255,.28);
  --vent-panel:rgba(0,15,30,.82);
  --vent-panel-strong:rgba(0,20,40,.94);
  background:
    radial-gradient(circle at 48% 18%,rgba(0,102,153,.16),transparent 38%),
    linear-gradient(145deg,#000b16 0%,#001326 48%,#000912 100%);
  color:var(--vent-text);
  font-family:"Microsoft YaHei",system-ui,sans-serif;
}
.vent-header{
  position:relative;
  padding-left:160px;
  background:linear-gradient(to bottom,rgba(0,20,40,.98),rgba(0,20,40,.72));
  border-bottom:1px solid var(--vent-line);
  box-shadow:0 0 18px rgba(0,234,255,.18);
}
.vent-header::after{
  content:"";
  position:absolute;
  left:160px;
  bottom:-1px;
  width:230px;
  height:2px;
  background:linear-gradient(90deg,var(--vent-cyan),rgba(0,234,255,0));
  box-shadow:0 0 8px var(--vent-cyan);
  pointer-events:none;
}
.vent-header h1{
  margin-bottom:5px;
  color:#fff;
  font-size:20px;
  font-weight:600;
  letter-spacing:2px;
  background:linear-gradient(180deg,#fff 12%,#87cefa 92%);
  -webkit-background-clip:text;
  background-clip:text;
  -webkit-text-fill-color:transparent;
  filter:drop-shadow(0 0 6px rgba(0,234,255,.42));
}
.badges{gap:6px}
.badges span{
  padding:2px 8px;
  border:1px solid rgba(0,234,255,.3);
  border-radius:2px;
  background:rgba(0,86,130,.2);
  color:#69dcff;
  letter-spacing:.4px;
  box-shadow:inset 0 0 7px rgba(0,234,255,.08);
}
.badges span:nth-child(2){border-color:rgba(55,224,157,.3);background:rgba(27,116,80,.16);color:#6ee7a7}
.badges span:nth-child(3){border-color:rgba(255,166,64,.34);background:rgba(135,75,18,.17);color:#ffb768}
.meta{color:#6d9ab4;letter-spacing:.25px;text-shadow:0 0 7px rgba(0,174,255,.2)}
.tabs{
  background:linear-gradient(90deg,rgba(0,25,48,.96),rgba(0,14,28,.92));
  border-bottom:1px solid rgba(0,234,255,.2);
  box-shadow:0 3px 12px rgba(0,0,0,.24);
}
.tabs button{
  position:relative;
  color:#79a7be;
  font-weight:500;
  letter-spacing:1px;
  transition:color .2s,background .2s,text-shadow .2s;
}
.tabs button:hover{background:rgba(0,174,255,.08);color:#c9f5ff}
.tabs button.active{
  color:var(--vent-cyan);
  border-color:var(--vent-cyan);
  background:linear-gradient(180deg,rgba(0,234,255,.13),rgba(0,234,255,.025));
  text-shadow:0 0 8px rgba(0,234,255,.55);
}
.subtabs{
  background:rgba(0,15,30,.9);
  border-bottom:1px solid rgba(0,234,255,.22);
  box-shadow:0 4px 14px rgba(0,0,0,.25);
  backdrop-filter:blur(10px);
}
.subtabs button{
  border-color:rgba(0,234,255,.2);
  background:rgba(0,40,70,.18);
  color:#719db6;
  transition:all .2s ease;
}
.subtabs button:first-child{border-radius:2px 0 0 2px}
.subtabs button:last-child{border-right-color:rgba(0,234,255,.2);border-radius:0 2px 2px 0}
.subtabs button:hover{color:#d5f8ff;background:rgba(0,174,255,.1)}
.subtabs button.active{
  color:var(--vent-cyan);
  border-color:var(--vent-cyan);
  background:linear-gradient(180deg,rgba(0,234,255,.2),rgba(0,102,153,.12));
  box-shadow:inset 0 0 10px rgba(0,234,255,.12),0 0 8px rgba(0,234,255,.14);
  text-shadow:0 0 7px rgba(0,234,255,.55);
}
.subtabs button.active+button{border-left-color:var(--vent-cyan)}
.stage,.cesium-section{background:#000914}
.flow-legend{
  background:rgba(0,15,30,.86);
  border-bottom:1px solid rgba(0,234,255,.2);
  color:#87aec3;
  box-shadow:0 4px 14px rgba(0,0,0,.22);
  backdrop-filter:blur(10px);
}
.flow-legend i{box-shadow:0 0 7px currentColor}
.flow-legend em{color:#6594af}
.flow-toolbar,.display-controls{
  border:1px solid rgba(0,234,255,.32);
  border-radius:3px;
  background:rgba(0,15,30,.84);
  box-shadow:0 0 18px rgba(0,174,255,.15),inset 0 0 12px rgba(0,102,153,.08);
  backdrop-filter:blur(12px);
}
.flow-toolbar button,.display-controls button{
  border:1px solid rgba(0,174,255,.3);
  border-radius:2px;
  background:rgba(0,46,79,.5);
  color:#83aec4;
  transition:all .2s ease;
}
.flow-toolbar button.on,.flow-toolbar button:hover,.display-controls button:hover{
  color:var(--vent-cyan);
  border-color:var(--vent-cyan);
  background:linear-gradient(180deg,rgba(0,234,255,.22),rgba(0,91,145,.28));
  box-shadow:0 0 10px rgba(0,234,255,.22),inset 0 0 8px rgba(0,234,255,.1);
  text-shadow:0 0 6px rgba(0,234,255,.5);
}
.flow-toolbar button:active,.display-controls button:active{transform:translateY(1px)}
.display-controls label{color:#8bb6ca}
.display-controls input,.control-line input,.inline-slider input{accent-color:var(--vent-cyan)}
.colorbar{
  border:1px solid rgba(0,234,255,.32);
  border-radius:3px;
  background:rgba(0,15,30,.86);
  box-shadow:0 0 16px rgba(0,174,255,.15);
  backdrop-filter:blur(10px);
}
.colorbar b{color:#bcefff;font-weight:500;letter-spacing:.4px}
.colorbar .gradient{box-shadow:0 0 7px rgba(0,234,255,.3)}
.colorbar>div:last-child{color:#72a6bf}
.scene-loading{
  border:1px solid var(--vent-cyan);
  border-radius:2px;
  background:rgba(0,15,30,.94);
  color:var(--vent-cyan);
  box-shadow:0 0 20px rgba(0,234,255,.24),inset 0 0 12px rgba(0,234,255,.08);
  text-shadow:0 0 7px rgba(0,234,255,.6);
}
.charts-page{
  background:
    linear-gradient(rgba(0,234,255,.018) 1px,transparent 1px),
    linear-gradient(90deg,rgba(0,234,255,.018) 1px,transparent 1px),
    #000e1c;
  background-size:28px 28px;
}
.control-line{
  padding:0 12px;
  border:1px solid rgba(0,234,255,.2);
  border-radius:2px;
  background:rgba(0,22,42,.7);
  color:#7da8bd;
}
.control-line b{color:var(--vent-cyan);text-shadow:0 0 6px rgba(0,234,255,.38)}
.control-line select{
  border:1px solid rgba(0,234,255,.32);
  border-radius:2px;
  background:#00213a;
  color:#ccefff;
  outline:none;
}
.control-line select:focus{border-color:var(--vent-cyan);box-shadow:0 0 8px rgba(0,234,255,.22)}
.chart-card{
  border:1px solid rgba(0,234,255,.22);
  border-radius:2px;
  background:rgba(0,15,30,.78);
  box-shadow:inset 0 0 18px rgba(0,102,153,.08),0 5px 16px rgba(0,0,0,.2);
}
.chart-card h3{color:#7de5ff;letter-spacing:.5px;text-shadow:0 0 6px rgba(0,234,255,.28)}
.thermal-overlay{
  background:rgba(0,14,28,.96);
  border-top:1px solid rgba(0,234,255,.32);
  box-shadow:0 -5px 18px rgba(0,174,255,.12);
}
.thermal-overlay .chart{border-color:rgba(0,234,255,.2);border-radius:2px;background:rgba(0,18,35,.8)}
.info-panel{
  padding:16px;
  background:linear-gradient(180deg,rgba(0,20,40,.95),rgba(0,12,25,.96));
  border-left:1px solid rgba(0,234,255,.26);
  box-shadow:inset 5px 0 18px rgba(0,174,255,.05);
  scrollbar-width:thin;
  scrollbar-color:rgba(0,234,255,.48) rgba(0,20,38,.8);
}
.info-panel::-webkit-scrollbar{width:5px}
.info-panel::-webkit-scrollbar-track{background:rgba(0,20,38,.8)}
.info-panel::-webkit-scrollbar-thumb{background:rgba(0,234,255,.48);border-radius:3px}
.info-panel h2{
  position:relative;
  padding:0 0 10px 12px;
  border-bottom:1px solid rgba(0,234,255,.24);
  color:#b8f2ff;
  font-weight:500;
  letter-spacing:.5px;
  text-shadow:0 0 7px rgba(0,234,255,.38);
}
.info-panel h2::before{
  content:"";
  position:absolute;
  left:0;
  top:2px;
  width:3px;
  height:14px;
  background:var(--vent-cyan);
  box-shadow:0 0 8px var(--vent-cyan);
}
.info-card{
  position:relative;
  border:1px solid rgba(0,174,255,.22);
  border-left:2px solid rgba(0,234,255,.65);
  border-radius:2px;
  background:linear-gradient(135deg,rgba(0,33,58,.78),rgba(0,18,34,.82));
  box-shadow:inset 0 0 16px rgba(0,102,153,.06),0 5px 14px rgba(0,0,0,.13);
  transition:border-color .2s,box-shadow .2s,background .2s;
}
.info-card:hover{
  border-color:rgba(0,234,255,.42);
  border-left-color:var(--vent-cyan);
  background:linear-gradient(135deg,rgba(0,43,72,.82),rgba(0,20,38,.86));
  box-shadow:0 0 13px rgba(0,174,255,.1),inset 0 0 15px rgba(0,102,153,.08);
}
.info-card h3{color:#72ddff;font-weight:500;letter-spacing:.35px;text-shadow:0 0 6px rgba(0,234,255,.25)}
.info-card h3 small{color:#6e9bb3}
.info-card p{border-bottom-color:rgba(0,174,255,.1);color:#78a3ba}
.info-card p b{color:#d2eaf6;font-weight:500}
.info-card.highlight{border-color:var(--vent-cyan);box-shadow:0 0 15px rgba(0,234,255,.18),inset 0 0 12px rgba(0,234,255,.07)}
.info-card.note{border-left-color:#ff9f43;color:#d0a76f;background:linear-gradient(135deg,rgba(75,47,15,.3),rgba(0,18,34,.82))}
.geometry-info .geo-box{
  border-color:rgba(0,174,255,.18);
  border-radius:2px;
  background:rgba(0,13,27,.62);
}
.geometry-info .geo-box h4{color:#77dcf8}
.design-preview{
  border:1px solid rgba(0,234,255,.34);
  border-radius:2px;
  background:rgba(0,15,30,.78);
  box-shadow:0 0 14px rgba(0,174,255,.1);
}
.design-preview:hover{
  border-color:var(--vent-cyan);
  box-shadow:0 0 20px rgba(0,234,255,.2),inset 0 0 12px rgba(0,234,255,.06);
}
.preview-heading{
  border-bottom:1px solid rgba(0,234,255,.2);
  background:linear-gradient(90deg,rgba(0,86,130,.35),rgba(0,28,52,.76));
}
.preview-heading b{color:#9aeaff;text-shadow:0 0 6px rgba(0,234,255,.35)}
.preview-heading em{color:#6fa8c0}
.preview-metrics{border-top-color:rgba(0,234,255,.18);background:rgba(0,234,255,.18)}
.preview-metrics>span{background:rgba(0,25,47,.96)}
.preview-metrics small{color:#6798b1}.preview-metrics b{color:#c9efff}
.gallery img{border-color:rgba(0,234,255,.25);border-radius:2px;transition:border-color .2s,box-shadow .2s}
.gallery img:hover{border-color:var(--vent-cyan);box-shadow:0 0 12px rgba(0,234,255,.2)}
.image-modal{background:rgba(0,7,15,.94);backdrop-filter:blur(8px)}
.image-modal img{border:1px solid rgba(0,234,255,.4);box-shadow:0 0 30px rgba(0,234,255,.2)}
.image-modal button{color:var(--vent-cyan);text-shadow:0 0 10px rgba(0,234,255,.65)}
button:focus-visible,select:focus-visible,input:focus-visible{outline:1px solid var(--vent-cyan);outline-offset:2px}
.view-toolbar{
  position:absolute;
  top:88px;
  left:14px;
  z-index:5;
  display:flex;
  align-items:center;
  gap:5px;
  padding:5px 6px;
  border:1px solid rgba(0,234,255,.28);
  border-radius:3px;
  background:rgba(0,15,30,.82);
  box-shadow:0 0 15px rgba(0,174,255,.12);
  backdrop-filter:blur(10px);
}
.view-toolbar span{padding:0 5px;color:#659bb4;font-size:10px;letter-spacing:.5px}
.view-toolbar button{
  padding:5px 9px;
  border:1px solid rgba(0,174,255,.28);
  border-radius:2px;
  background:rgba(0,46,79,.48);
  color:#83aec4;
  font-size:11px;
  cursor:pointer;
  transition:all .2s ease;
}
.view-toolbar button:hover{
  color:var(--vent-cyan);
  border-color:var(--vent-cyan);
  background:rgba(0,174,255,.18);
  box-shadow:0 0 9px rgba(0,234,255,.2);
}
.tool-dock{
  position:absolute;
  top:45px;
  left:246px;
  z-index:5;
  display:flex;
  max-width:calc(100% - 500px);
  flex-direction:column;
  align-items:flex-start;
  gap:6px;
}
.vent-layer-panel{
  position:absolute;
  z-index:7;
  width:220px;
  overflow:hidden;
  border:1px solid var(--vent-cyan);
  border-radius:4px;
  background:rgba(0,15,30,.88);
  box-shadow:0 0 20px rgba(0,200,255,.2);
  backdrop-filter:blur(10px);
  user-select:none;
}
.vent-layer-panel.collapsed{width:142px}
.vent-layer-header{
  min-height:36px;
  padding:0 12px;
  display:flex;
  align-items:center;
  gap:8px;
  color:#fff;
  background:rgba(0,100,200,.6);
  font-size:14px;
  font-weight:600;
  letter-spacing:.4px;
  cursor:move;
}
.vent-layer-collapse{
  width:18px;
  height:24px;
  padding:0;
  border:0;
  color:#d8f8ff;
  background:transparent;
  font-size:13px;
  cursor:pointer;
}
.vent-layer-collapse:hover{color:var(--vent-cyan);text-shadow:0 0 7px rgba(0,234,255,.65)}
.vent-layer-drag{margin-left:auto;color:rgba(210,247,255,.72);font-size:13px}
.vent-layer-content{padding:14px 15px 12px}
.vent-checkbox-item{
  display:flex;
  align-items:center;
  margin-bottom:11px;
  color:#bdd3df;
  font-size:12px;
  cursor:pointer;
}
.vent-checkbox-item:last-child{margin-bottom:0}
.vent-checkbox-item input{display:none}
.vent-custom-check{
  width:16px;
  height:16px;
  margin-right:10px;
  display:flex;
  flex:0 0 auto;
  align-items:center;
  justify-content:center;
  border:1px solid var(--vent-cyan);
  background:rgba(0,46,79,.42);
  box-shadow:inset 0 0 6px rgba(0,234,255,.08);
}
.vent-checkbox-item input:checked + .vent-custom-check::after{
  content:'✓';
  color:var(--vent-cyan);
  font-size:12px;
  font-weight:700;
  text-shadow:0 0 6px rgba(0,234,255,.65);
}
.vent-checkbox-item:hover{color:#fff}
.vent-checkbox-item:hover .vent-custom-check{box-shadow:0 0 8px rgba(0,234,255,.3)}
.tool-row{display:flex;align-items:center;gap:6px;max-width:100%}
.tool-group{
  display:flex;
  align-items:center;
  gap:5px;
  padding:5px 6px;
  border:1px solid rgba(0,234,255,.28);
  border-radius:3px;
  background:rgba(0,15,30,.84);
  box-shadow:0 0 15px rgba(0,174,255,.12),inset 0 0 10px rgba(0,102,153,.06);
  backdrop-filter:blur(10px);
}
.tool-group-title{padding:0 4px;color:#659bb4;font-size:10px;letter-spacing:.5px;white-space:nowrap}
.tool-group button{
  height:27px;
  padding:0 9px;
  border:1px solid rgba(0,174,255,.3);
  border-radius:2px;
  background:rgba(0,46,79,.5);
  color:#83aec4;
  font-size:11px;
  cursor:pointer;
  transition:all .2s ease;
}
.tool-group button.on,.tool-group button:hover{
  color:var(--vent-cyan);
  border-color:var(--vent-cyan);
  background:linear-gradient(180deg,rgba(0,234,255,.22),rgba(0,91,145,.28));
  box-shadow:0 0 9px rgba(0,234,255,.2),inset 0 0 7px rgba(0,234,255,.08);
  text-shadow:0 0 6px rgba(0,234,255,.45);
}
.location-status{
  position:absolute;
  left:158px;
  bottom:14px;
  z-index:5;
  display:flex;
  align-items:center;
  gap:8px;
  padding:7px 10px;
  border:1px solid rgba(0,234,255,.3);
  border-radius:2px;
  background:rgba(0,15,30,.84);
  box-shadow:0 0 15px rgba(0,174,255,.12);
  backdrop-filter:blur(10px);
  color:#80aec4;
  font-size:10px;
  pointer-events:none;
}
.location-status span{color:#a5dced}.location-status b{color:var(--vent-cyan);font:500 12px Consolas,monospace;text-shadow:0 0 6px rgba(0,234,255,.45)}
.location-status small{padding-left:8px;border-left:1px solid rgba(0,234,255,.22);color:#618da4;font-size:9px}
@media(max-width:900px){
  .vent-header{padding-left:150px}
  .vent-header::after{left:150px}
  .info-panel{border-top-color:rgba(0,234,255,.26)}
  .view-toolbar{top:137px;left:10px}
  .tool-dock{top:45px;left:246px;right:10px;max-width:none;overflow:visible;padding-bottom:4px}
  .display-controls{top:129px;left:246px;right:auto}
  .tool-row{width:max-content}
  .location-status{left:10px;bottom:10px}.location-status small{display:none}
}

/* 统一平台框架：顶栏 + 左侧目录 + 中央业务区 + 右侧功能栏 */
.vent-header {
  z-index: 30;
  height: 60px;
  min-width: 1200px;
  padding: 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(to bottom, rgba(0,20,40,.95), rgba(0,20,40,.6));
  border-bottom: 1px solid rgba(0,255,255,.3);
  box-shadow: 0 0 15px rgba(0,255,255,.2);
}
.vent-header::after { display:none; }
.vent-header-left{display:flex;align-items:center;height:100%;flex-shrink:0}
.vent-title-container{position:relative;display:flex;align-items:center;height:100%;padding:0 40px 0 30px;background:linear-gradient(to right,rgba(0,15,30,1),rgba(0,50,90,1))}
.vent-title-container::after{content:'';position:absolute;right:-20px;top:0;width:40px;height:100%;background:rgba(0,50,90,1);transform:skewX(-25deg);border-right:2px solid #00eaff;box-shadow:2px 0 8px rgba(0,234,255,.4);z-index:1}
.vent-header h1{position:relative;z-index:2;margin:0;color:#fff;font-size:26px;font-weight:bold;letter-spacing:2px;text-shadow:0 0 10px rgba(0,255,255,.8);background:linear-gradient(180deg,#fff,#87cefa);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.vent-header-center{flex:1;display:flex;align-items:center;padding-left:40px}
.vent-scene-title{position:relative;padding:0 24px;color:var(--vent-cyan);font-size:15px;font-weight:bold;letter-spacing:1px;text-shadow:0 0 8px #00eaff}
.vent-header-right{height:100%;padding:0 24px;display:flex;align-items:center;justify-content:flex-end;gap:14px}
.meta{font-size:10px;white-space:nowrap}
.vent-header-icon{width:34px;height:34px;padding:0;display:grid;place-items:center;color:#c8e5f4;background:rgba(0,70,120,.18);border:1px solid rgba(0,170,255,.22);border-radius:50%;cursor:pointer;text-decoration:none;transition:.18s ease}.vent-header-icon svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.vent-header-icon:hover{color:#00eaff;background:rgba(0,180,255,.14);border-color:rgba(0,220,255,.42)}.vent-header-icon.disabled{opacity:.3;cursor:not-allowed}
.vent-layout { height: calc(100% - 60px); grid-template-columns: 216px minmax(0,1fr) 332px; }
.vent-directory {
  position: relative;
  z-index: 24;
  color: #c7d5ea;
  background: rgba(2,10,22,.94);
  border-right: 1px solid rgba(0,170,255,.24);
  box-shadow: 4px 0 24px rgba(0,0,0,.5);
  backdrop-filter: blur(16px);
}
.vent-dir-row { display:flex;align-items:center;gap:11px;width:100%;min-height:44px;padding:0 18px;box-sizing:border-box;color:#7892aa;font-family:inherit;font-size:12px;text-align:left;border:0;border-bottom:1px solid rgba(0,150,220,.07);background:transparent; }
.vent-dir-row span { width:18px;color:#4e85aa;text-align:center; }
.vent-home { cursor:pointer;transition:.18s ease; }.vent-home b{color:#b9cee0}.vent-home:hover{background:rgba(0,170,235,.08)}.vent-home:hover b{color:#69dff2}
.vent-worksite{cursor:pointer;transition:.18s ease}.vent-worksite:hover{color:#c9edfa;background:rgba(0,170,235,.06)}
.vent-dir-head { display:flex;align-items:center;gap:9px;min-height:47px;padding:0 15px;color:#fff;background:linear-gradient(90deg,rgba(0,116,218,.92),rgba(0,174,235,.72));border-block:1px solid rgba(64,207,255,.35);box-shadow:inset 3px 0 0 #7de9ff; }
.vent-dir-head b{font-size:14px;letter-spacing:1px}.vent-dir-head em{margin-left:auto;font-style:normal}
.vent-directory nav{padding:5px 0 7px;background:rgba(0,35,67,.25)}
.vent-directory nav button{display:grid;grid-template-columns:18px 1fr;align-items:center;width:100%;min-height:40px;padding:0 14px 0 25px;color:#829bb4;text-align:left;font-family:inherit;font-size:12px;border:0;background:transparent;cursor:pointer;transition:.18s ease}
.vent-directory nav button i{width:10px;height:1px;background:rgba(80,155,200,.4)}
.vent-directory nav button:hover{color:#c9edfa;background:rgba(0,170,235,.06)}
.vent-directory nav button.active{color:#e6fbff;background:linear-gradient(90deg,rgba(0,135,230,.28),rgba(0,105,175,.1));box-shadow:inset 3px 0 0 #37dfff}
.vent-module-link{display:grid;grid-template-columns:22px 1fr auto;align-items:center;gap:8px;width:100%;min-height:43px;padding:0 16px;color:#7892aa;text-align:left;font-family:inherit;border:0;border-bottom:1px solid rgba(0,150,220,.07);background:transparent;cursor:pointer;transition:.18s ease}.vent-module-link span{color:#4e85aa;text-align:center}.vent-module-link b{font-size:12px;font-weight:500}.vent-module-link em{color:#456b87;font-size:16px;font-style:normal}.vent-module-link:hover{color:#dffaff;background:rgba(0,170,235,.07)}.vent-module-link:hover span,.vent-module-link:hover em{color:#69dff2}
.info-panel { width: 332px; box-sizing: border-box; background: rgba(2,10,22,.94); border-left:1px solid rgba(0,170,255,.2); box-shadow:-4px 0 24px rgba(0,0,0,.5); backdrop-filter:blur(16px); }
@media(max-width:1100px){.vent-layout{grid-template-columns:190px minmax(0,1fr) 300px}.vent-directory{width:190px}.info-panel{width:300px}.vent-header .meta{display:none}}

/* 与其他业务版块一致的四周栏、圆角视窗和大字号侧栏。 */
.vent-root { --rock-right-rail: 380px; }
.vent-layout { grid-template-columns:216px minmax(0,1fr) var(--rock-right-rail); }
.workspace { box-sizing:border-box; }
.stage { overflow:hidden; border-radius:14px; box-shadow:0 0 0 1px rgba(51,205,239,.3); }
.info-panel { width:var(--rock-right-rail); padding:20px; }
.vent-dir-row { font-size:14px; }
.vent-dir-head b { font-size:16px; }
.vent-directory nav button { font-size:14px; }
.vent-module-link span { font-size:15px; }
.vent-module-link b { font-size:14px; }
.vent-module-link em { font-size:18px; }
.info-panel h2 { font-size:18px; }
.info-card { padding:13px 15px; font-size:13px; }
.info-card h3 { font-size:14px; }
.geometry-info .geo-box h4 { font-size:12px; }
.geometry-info p b { font-size:12px; }
</style>
