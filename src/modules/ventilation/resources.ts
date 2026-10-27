import * as Cesium from 'cesium'
import * as echarts from 'echarts'
import type { SceneResource } from '@/platform/resources/types'
import type { SceneModuleManifest } from '@/platform/modules/types'
import { moduleRegistry } from '@/platform/modules/ModuleRegistry'
import {
  destroyVentilation,
  buildSteadyLayers,
  getTunnelModel,
  loadTunnelModel,
  removeFlowLayers,
  type CfdData,
} from '@/views/ventilation-module/cesiumVentilation'
import { isTunnelGlbVisible, setTunnelGlbVisible } from '@/utils/Common/DrawLine'
import { VENTILATION_DISPLAY_CHAINAGE_YK } from '@/views/ventilation-module/spatialFrame'

let ventilationViewer: Cesium.Viewer | undefined
let previousPublicTunnelVisibility = true
let steadyData: { cells: CfdData; arrows: CfdData } | undefined
let coData: unknown
let transientData: unknown
let thermalData: { index: any; monitors: any } | undefined
let transientScenarioPath: string | undefined
let thermalSnapshotPath: string | undefined

const ASSET = '/data/ventilation/'
// Local K3+805–K4+005 is projected onto the YK centerline only for display.
const DISPLAY_RANGE_YK = { start: VENTILATION_DISPLAY_CHAINAGE_YK - 100, end: VENTILATION_DISPLAY_CHAINAGE_YK + 100 }
const transientScenarioFiles = {
  fan_ramp_up: 'transient_fan_ramp_up.json',
  fan_oscillation: 'transient_fan_oscillation.json',
  damper_close: 'transient_damper_close.json',
  fan_shutdown: 'transient_fan_shutdown.json',
  combined: 'transient_combined.json',
} as const
export type VentilationTransientScenario = keyof typeof transientScenarioFiles

/** 页签确认使用某个工况后，更新资源的数据和资产来源。 */
export function useVentilationTransientScenario(scenario: VentilationTransientScenario, data: unknown): void {
  if (transientData === undefined) throw new Error('[VentilationResource] 瞬态通风资源尚未加载')
  transientData = data
  transientScenarioPath = `${ASSET}${transientScenarioFiles[scenario]}`
}

/** 任务面板切换工况时，重绘其独立图表覆盖层。 */
export function refreshVentilationTransientChart(): void {
  if (transientData === undefined) throw new Error('[VentilationResource] 瞬态通风资源尚未加载')
  disposeEnhancements('ventilation.transient-network')
  transientChartAdapter()
}

/** 只允许记录当前热场索引中存在、且已经显示的时间片。 */
export function useVentilationThermalSnapshot(file: string): void {
  if (!thermalData?.index?.snapshots?.some((snapshot: { file?: string }) => snapshot.file === file)) {
    throw new Error(`[VentilationResource] 热场时间片不属于当前索引：${file}`)
  }
  thermalSnapshotPath = `${ASSET}${file}`
}

type ChartSeries = { name: string; values: number[]; color: string }
type EnhancementDisposer = () => void

const chartColors = ['#00eaff', '#ff9e52', '#68e09b', '#c58af9', '#ef5350']
const enhancementDisposers = new Map<string, Set<EnhancementDisposer>>()

function trackEnhancement(owner: string, dispose: EnhancementDisposer): EnhancementDisposer {
  const owners = enhancementDisposers.get(owner) ?? new Set<EnhancementDisposer>()
  enhancementDisposers.set(owner, owners)
  let active = true
  const tracked = () => {
    if (!active) return
    active = false
    owners.delete(tracked)
    if (owners.size === 0) enhancementDisposers.delete(owner)
    dispose()
  }
  owners.add(tracked)
  return tracked
}

function disposeEnhancements(owner?: string): void {
  const disposers = owner
    ? [...(enhancementDisposers.get(owner) ?? [])]
    : [...enhancementDisposers.values()].flatMap((entries) => [...entries])
  const errors: unknown[] = []
  for (const dispose of disposers.reverse()) {
    try { dispose() } catch (error) { errors.push(error) }
  }
  if (errors.length > 0) throw new AggregateError(errors, `通风增强资源释放失败：${owner ?? 'all'}`)
}

function finiteNumbers(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item))
    : []
}

function createChartOverlay(
  owner: string,
  title: string,
  x: number[],
  series: ChartSeries[],
  xName: string,
  yName: string,
) {
  const viewer = ventilationViewer
  if (!viewer || viewer.isDestroyed()) throw new Error('[VentilationResource] Cesium Viewer 尚未初始化')
  if (typeof document === 'undefined') throw new Error('[VentilationResource] 当前环境不支持图表增强')

  const host = document.createElement('section')
  host.dataset.ventilationEnhancement = 'chart'
  Object.assign(host.style, {
    position: 'absolute', right: '18px', bottom: '18px', zIndex: '30',
    width: 'min(480px, calc(100% - 36px))', height: '300px',
    padding: '12px', boxSizing: 'border-box', pointerEvents: 'none',
    border: '1px solid rgba(0,234,255,.42)', borderRadius: '6px',
    background: 'rgba(2,18,31,.94)', boxShadow: '0 8px 28px rgba(0,0,0,.38)',
  })
  const heading = document.createElement('div')
  heading.textContent = title
  Object.assign(heading.style, { height: '24px', color: '#9cecff', font: '600 13px Microsoft YaHei' })
  const canvas = document.createElement('div')
  Object.assign(canvas.style, { width: '100%', height: 'calc(100% - 24px)' })
  host.append(heading, canvas)
  viewer.container.appendChild(host)

  let chart: ReturnType<typeof echarts.init> | undefined
  let resize: (() => void) | undefined
  try {
    chart = echarts.init(canvas)
    chart.setOption({
      animation: false,
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: { top: 0, textStyle: { color: '#91aac0' } },
      grid: { left: 54, right: 20, top: 38, bottom: 42 },
      xAxis: {
        type: 'value', name: xName,
        nameTextStyle: { color: '#607f99' }, axisLabel: { color: '#607f99' },
        axisLine: { lineStyle: { color: '#29445a' } }, splitLine: { lineStyle: { color: '#162a3a' } },
      },
      yAxis: {
        type: 'value', name: yName,
        nameTextStyle: { color: '#607f99' }, axisLabel: { color: '#607f99' },
        axisLine: { lineStyle: { color: '#29445a' } }, splitLine: { lineStyle: { color: '#162a3a' } },
      },
      series: series.map((item) => ({
        name: item.name,
        type: 'line',
        showSymbol: false,
        data: x.map((value, index) => [value, item.values[index]]),
        lineStyle: { width: 2, color: item.color },
        itemStyle: { color: item.color },
      })),
    })
    resize = () => chart?.resize()
    window.addEventListener('resize', resize)
  } catch (error) {
    if (resize) window.removeEventListener('resize', resize)
    chart?.dispose()
    host.remove()
    throw error
  }
  return trackEnhancement(owner, () => {
    if (resize) window.removeEventListener('resize', resize)
    chart?.dispose()
    host.remove()
  })
}

function sectionAdapter(owner: string, parameters: Readonly<Record<string, unknown>>) {
  const viewer = ventilationViewer
  const model = getTunnelModel()
  if (!viewer || viewer.isDestroyed() || !model) {
    throw new Error('[VentilationResource] 通风模型尚未加载')
  }
  const requested = parameters.chainage
  const chainage = typeof requested === 'number' && Number.isFinite(requested) ? requested : 3905.151
  const previous = model.clippingPlanes as Cesium.ClippingPlaneCollection | undefined
  const clipping = new Cesium.ClippingPlaneCollection({
    planes: [new Cesium.ClippingPlane(new Cesium.Cartesian3(0, 0, -1), chainage)],
    edgeColor: Cesium.Color.fromCssColorString('#00eaff'),
    edgeWidth: 1.5,
  })
  model.clippingPlanes = clipping
  viewer.scene.requestRender()
  return trackEnhancement(owner, () => {
    if (model.clippingPlanes === clipping) model.clippingPlanes = previous
    if (!clipping.isDestroyed()) clipping.destroy()
    viewer.scene.requestRender()
  })
}

function coChartAdapter() {
  const document = coData as Record<string, any> | undefined
  const result = document?.Right ?? document?.[Object.keys(document ?? {})[0]]
  const x = finiteNumbers(result?.times).map((value) => value / 60)
  const history = result?.history as Record<string, unknown> | undefined
  const series = Object.entries(history ?? {}).slice(0, 5).map(([name, values], index) => ({
    name,
    values: finiteNumbers(values),
    color: chartColors[index % chartColors.length],
  }))
  return createChartOverlay('ventilation.co-analysis', 'CO 爆破扩散 · 浓度—时间', x, series, '时间 / min', 'CO / ppm')
}

function transientChartAdapter() {
  const document = transientData as Record<string, any> | undefined
  const x = finiteNumbers(document?.times)
  const history = document?.history as Record<string, { Q?: unknown }> | undefined
  const series = Object.entries(history ?? {}).slice(0, 5).map(([name, values], index) => ({
    name,
    values: finiteNumbers(values?.Q),
    color: chartColors[index % chartColors.length],
  }))
  return createChartOverlay('ventilation.transient-network', '瞬态通风 · 网络流量', x, series, '时间 / s', 'Q / m³·s⁻¹')
}

function thermalChartAdapter() {
  const monitors = thermalData?.monitors as Record<string, unknown> | undefined
  const x = finiteNumbers(monitors?.times_s)
  const fields = [
    ['右管出口', 'T_outlet_right_K'],
    ['左管出口', 'T_outlet_left_K'],
  ] as const
  const series = fields.map(([name, key], index) => ({
    name,
    values: finiteNumbers(monitors?.[key]),
    color: chartColors[index % chartColors.length],
  }))
  return createChartOverlay('ventilation.thermal-field', '热瞬态 · 出口温度', x, series, '时间 / s', '温度 / K')
}

async function fetchJson<T>(file: string): Promise<T> {
  const response = await fetch(`${ASSET}${file}`)
  if (!response.ok) throw new Error(`通风数据加载失败：${file} (HTTP ${response.status})`)
  return response.json() as Promise<T>
}

/**
 * 通风基础场景只拥有通风专用 GLB 和公共场景切换状态。
 * 各分析子资源分别持有自己的数据与图层，切换页签时可以独立装卸。
 */
export const ventilationSceneResource: SceneResource = {
  id: 'ventilation.scene',
  module: 'ventilation',
  type: 'ventilation-cfd-scene',
  chainageRange: DISPLAY_RANGE_YK,
  processes: ['ventilation', 'dust-control', 'gas-monitoring'],
  states: ['steady', 'transient', 'thermal'],
  estimatedMemoryMb: 12,
  lifetime: 'task',
  async load(context) {
    ventilationViewer = context.viewer
    previousPublicTunnelVisibility = isTunnelGlbVisible()
    setTunnelGlbVisible(false)
    context.reportProgress?.(0.1, '切换通风专用场景')
    try {
      await loadTunnelModel(context.viewer)
      context.reportProgress?.(1, '通风隧道模型加载完成')
    } catch (error) {
      destroyVentilation(context.viewer)
      ventilationViewer = undefined
      setTunnelGlbVisible(previousPublicTunnelVisibility)
      throw error
    }
  },
  async unload() {
    disposeEnhancements()
    if (ventilationViewer && !ventilationViewer.isDestroyed()) {
      destroyVentilation(ventilationViewer)
      ventilationViewer.scene.requestRender()
    }
    ventilationViewer = undefined
    setTunnelGlbVisible(previousPublicTunnelVisibility)
  },
  getEnhanceTargets() {
    return [{ id: 'ventilation.tunnel-model', type: 'ventilation-model' }]
  },
  getActiveAssetPaths() {
    return getTunnelModel() ? ['/data/ventilation/tunnel-assembled.glb'] : []
  },
}

export const ventilationSteadyResource: SceneResource = {
  id: 'ventilation.steady-cfd',
  module: 'ventilation',
  type: 'steady-cfd-field',
  chainageRange: DISPLAY_RANGE_YK,
  processes: ['ventilation', 'dust-control'],
  states: ['steady'],
  dependencies: ['ventilation.scene'],
  estimatedMemoryMb: 1.2,
  lifetime: 'task',
  async load(context) {
    context.reportProgress?.(0.1, '加载稳态 CFD 数据')
    const [cells, arrows] = await Promise.all([
      fetchJson<CfdData>('cfd_cell_data_lite.json'),
      fetchJson<CfdData>('cfd_arrows.json'),
    ])
    steadyData = { cells, arrows }
    context.reportProgress?.(1, '稳态 CFD 数据已就绪')
  },
  async activate() {
    if (!ventilationViewer || ventilationViewer.isDestroyed() || !steadyData) {
      throw new Error('[VentilationResource] 稳态 CFD 场景尚未就绪')
    }
    buildSteadyLayers(ventilationViewer, steadyData.cells, steadyData.arrows, 'velocity')
  },
  async deactivate() {
    if (ventilationViewer && !ventilationViewer.isDestroyed()) removeFlowLayers(ventilationViewer)
  },
  async unload() {
    disposeEnhancements('ventilation.steady-cfd')
    if (ventilationViewer && !ventilationViewer.isDestroyed()) removeFlowLayers(ventilationViewer)
    steadyData = undefined
  },
  getEnhanceTargets() {
    const model = getTunnelModel()
    return model ? [{
      id: 'ventilation.steady-field',
      type: 'steady-cfd-field',
      object: model,
      recommendedEnhancements: ['section'] as const,
      enhancementParameters: { section: { chainage: 3905.151 } },
      adapters: { section: (parameters) => sectionAdapter('ventilation.steady-cfd', parameters) },
    }] : []
  },
  getActiveAssetPaths() {
    return steadyData
      ? ['/data/ventilation/cfd_cell_data_lite.json', '/data/ventilation/cfd_arrows.json']
      : []
  },
}

export const ventilationCoResource: SceneResource = {
  id: 'ventilation.co-analysis',
  module: 'ventilation',
  type: 'co-transport-analysis',
  processes: ['gas-monitoring', 'blast-clearance'],
  states: ['transient', 'risk'],
  dependencies: ['ventilation.scene'],
  estimatedMemoryMb: 6.3,
  lifetime: 'task',
  async load(context) {
    context.reportProgress?.(0.1, '加载 CO 扩散分析')
    coData = await fetchJson('co_transport_results.json')
    context.reportProgress?.(1, 'CO 扩散分析已就绪')
  },
  async unload() {
    disposeEnhancements('ventilation.co-analysis')
    coData = undefined
  },
  getEnhanceTargets() {
    return coData ? [{
      id: 'ventilation.co-chart',
      type: 'co-analysis-chart',
      recommendedEnhancements: ['chart'] as const,
      adapters: { chart: coChartAdapter },
    }] : []
  },
  getActiveAssetPaths() {
    return coData ? ['/data/ventilation/co_transport_results.json'] : []
  },
}

export const ventilationTransientResource: SceneResource = {
  id: 'ventilation.transient-network',
  module: 'ventilation',
  type: 'transient-ventilation-network',
  chainageRange: DISPLAY_RANGE_YK,
  processes: ['ventilation', 'risk-response'],
  states: ['transient'],
  dependencies: ['ventilation.scene'],
  estimatedMemoryMb: 0.7,
  lifetime: 'task',
  async load(context) {
    context.reportProgress?.(0.1, '加载瞬态通风工况')
    transientData = await fetchJson('transient_fan_ramp_up.json')
    transientScenarioPath = `${ASSET}${transientScenarioFiles.fan_ramp_up}`
    context.reportProgress?.(1, '瞬态通风工况已就绪')
  },
  async unload() {
    disposeEnhancements('ventilation.transient-network')
    transientData = undefined
    transientScenarioPath = undefined
  },
  getEnhanceTargets() {
    return transientData ? [{
      id: 'ventilation.transient-chart',
      type: 'transient-network-chart',
      recommendedEnhancements: ['chart'] as const,
      adapters: { chart: transientChartAdapter },
    }] : []
  },
  getActiveAssetPaths() {
    return transientData && transientScenarioPath ? [transientScenarioPath] : []
  },
}

export const ventilationThermalResource: SceneResource = {
  id: 'ventilation.thermal-field',
  module: 'ventilation',
  type: 'transient-thermal-field',
  chainageRange: DISPLAY_RANGE_YK,
  processes: ['ventilation', 'thermal-risk'],
  states: ['thermal'],
  dependencies: ['ventilation.scene'],
  estimatedMemoryMb: 1.1,
  lifetime: 'task',
  async load(context) {
    context.reportProgress?.(0.1, '加载热场索引与监测数据')
    const [index, monitors] = await Promise.all([
      fetchJson('cfd_transient_index.json'),
      fetchJson('transient_thermal_monitors.json'),
    ])
    thermalData = { index, monitors }
    thermalSnapshotPath = undefined
    context.reportProgress?.(1, '热场索引与监测数据已就绪')
  },
  async unload() {
    disposeEnhancements('ventilation.thermal-field')
    if (ventilationViewer && !ventilationViewer.isDestroyed()) removeFlowLayers(ventilationViewer)
    thermalData = undefined
    thermalSnapshotPath = undefined
  },
  getEnhanceTargets() {
    const model = getTunnelModel()
    return thermalData ? [{
      id: 'ventilation.thermal-field',
      type: 'transient-thermal-field',
      object: model,
      recommendedEnhancements: model ? ['section', 'chart'] as const : ['chart'] as const,
      enhancementParameters: { section: { chainage: 3905.151 } },
      adapters: {
        section: (parameters) => sectionAdapter('ventilation.thermal-field', parameters),
        chart: thermalChartAdapter,
      },
    }] : []
  },
  getActiveAssetPaths() {
    return thermalData
      ? ['/data/ventilation/cfd_transient_index.json', '/data/ventilation/transient_thermal_monitors.json',
          ...(thermalSnapshotPath ? [thermalSnapshotPath] : [])]
      : []
  },
}

export const ventilationResources = [
  ventilationSceneResource,
  ventilationSteadyResource,
  ventilationCoResource,
  ventilationTransientResource,
  ventilationThermalResource,
] as const

export const ventilationModuleManifest: SceneModuleManifest = {
  id: 'ventilation',
  displayName: '通风除尘',
  version: 'legacy-adapter-1.0.0',
  capabilities: ['query', 'locate', 'visibility', 'opacity', 'section', 'standard-view', 'chart', 'pick'],
  coordinateFrame: {
    kind: 'local-engineering',
    unit: 'm',
    description: '通风 CFD 局部工程坐标（Y 为高程，Z 为隧道里程）',
    transformId: 'ventilation-local-to-ecef-v1',
  },
  resources: ventilationResources,
}

export function registerVentilationModule(): void {
  if (!moduleRegistry.get('ventilation')) moduleRegistry.register(ventilationModuleManifest)
}

export function getVentilationSteadyData() { return steadyData }
export function getVentilationCoData() { return coData }
export function getVentilationTransientData() { return transientData }
export function getVentilationThermalData() { return thermalData }
export function getVentilationEnhancementLeaseCount(owner?: string): number {
  if (owner) return enhancementDisposers.get(owner)?.size ?? 0
  return [...enhancementDisposers.values()].reduce((count, entries) => count + entries.size, 0)
}
