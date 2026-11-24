import * as Cesium from 'cesium'
import * as echarts from 'echarts'
import {validateChartSeries,defaultTransientTraces,summarizeSeriesWindow,snapChartWindow} from './chart-series'
import type { SceneResource } from '@/platform/resources/types'
import type { TaskContext } from '@/platform/context/TaskContext'
import { taskManualControlsEnabled } from '@/platform/tasks/taskManualControls'
import type { SceneModuleManifest } from '@/platform/modules/types'
import { moduleRegistry } from '@/platform/modules/ModuleRegistry'
import {
  destroyVentilation,
  buildSteadyLayers,
  getTunnelModel,
  loadTunnelModel,
  removeFlowLayers,
  updateThermalPoints,
  layers,
  type CfdData,
} from '@/views/ventilation-module/cesiumVentilation'
import { isTunnelGlbVisible, setTunnelGlbVisible } from '@/utils/Common/DrawLine'
import { VENTILATION_COMBINATION_RANGE_YK, setVentilationCombinedPlacement } from '@/views/ventilation-module/spatialFrame'
import { STEADY_DATASET_FILES, validateSteadyDataset, type SteadyDatasetSummary } from './dataset-contract'
import { transientScenarioCatalog } from './transient-catalog'
import { thermalSnapshotCatalog } from './thermal-catalog'
import { axialFanDuctResource, axialFanResource, ceilingJetFanResource } from './axial-fan-resource'

let ventilationViewer: Cesium.Viewer | undefined
let previousPublicTunnelVisibility = true
let steadyData: { cells: CfdData; arrows: CfdData } | undefined
let steadySummary: SteadyDatasetSummary | undefined
export const getSteadyDatasetSummary = (): SteadyDatasetSummary | undefined => steadySummary
let coData: unknown
let transientData: unknown
let thermalData: { index: any; monitors: any } | undefined
let transientScenarioPath: string | undefined
let thermalSnapshotPath: string | undefined

const ASSET = '/data/ventilation/'
// Local K3+805–K4+005 is projected onto the YK centerline only for display.
const DISPLAY_RANGE_YK = VENTILATION_COMBINATION_RANGE_YK
function validateCombinedTask(task: TaskContext): void {
  const { start, end } = task.chainageRange
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end ||
      start < DISPLAY_RANGE_YK.start || end > DISPLAY_RANGE_YK.end) {
    throw new Error('通风与主隧道组合仅支持 YK3+900～YK4+100 的示意工段')
  }
}
let combinedScene = false
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
const activeCharts=new Set<{owner:string;title:string;host:HTMLElement;chart:ReturnType<typeof echarts.init>;x:number[];xName:string;yName:string;sourceNote:string;refreshSummary:()=>void}>()
export function inspectVentilationCharts(includeSamples=false){
 return [...activeCharts].map(item=>{
   const option=item.chart.getOption() as any,selected=option.legend?.[0]?.selected??{}
   const zoom={start:option.dataZoom?.[0]?.start??0,end:option.dataZoom?.[0]?.end??100},span=item.x.at(-1)!-item.x[0]!
   const visibleTimeRange=snapChartWindow([item.x[0]!+span*zoom.start/100,item.x[0]!+span*zoom.end/100],item.x)
   return {owner:item.owner,title:item.title,timeUnit:item.xName,valueUnit:item.yName,timeRange:[item.x[0]!,item.x.at(-1)!],
     visibleTimeRange,series:(option.series??[]).map((s:any)=>({name:s.name,visible:selected[s.name]!==false,sampleCount:s.data.length,windowSummary:summarizeSeriesWindow(s.data,visibleTimeRange),...(includeSamples?{samples:s.data.map((p:number[])=>[...p])}:{})})),
     zoom,
     width:item.chart.getWidth(),height:item.chart.getHeight(),sourceNote:item.sourceNote,engineeringAcceptance:'not-verified'}
 })
}
export function setVentilationChartReview(owner:string,input:{visibleSeries?:string[];timeRange?:number[]}){
 const item=[...activeCharts].find(c=>c.owner===owner);if(!item)throw Error('当前任务图表已释放或不存在')
 const before=inspectVentilationCharts().find(c=>c.owner===owner)!,option=item.chart.getOption() as any
 const names=before.series.map((s:any)=>s.name)
 if(input.visibleSeries!==undefined&&(!Array.isArray(input.visibleSeries)||input.visibleSeries.some(n=>!names.includes(n))))throw Error('请求包含当前图表不存在的支路或测点')
 const range=input.timeRange
 if(range!==undefined&&(!Array.isArray(range)||range.length!==2||!range.every(Number.isFinite)||range[0]!<item.x[0]!||range[1]!>item.x.at(-1)!||range[0]!>=range[1]!))throw Error('图表时间范围无效或超出源数据范围；请按图表时间单位提供')
 const patch:any={}
 if(input.visibleSeries!==undefined)patch.legend={selected:Object.fromEntries(names.map((n:string)=>[n,input.visibleSeries!.includes(n)]))}
 if(range){const length=item.x.at(-1)!-item.x[0]!,start=(range[0]!-item.x[0]!)/length*100,end=(range[1]!-item.x[0]!)/length*100;patch.dataZoom=[{start,end},{start,end}]}
 try{item.chart.setOption(patch);item.refreshSummary()}catch(error){item.chart.setOption({legend:option.legend,dataZoom:option.dataZoom});item.refreshSummary();throw error}
 return {before,after:inspectVentilationCharts().find(c=>c.owner===owner)!}
}

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
  options:{note?:string;selected?:string[]}={},
) {
  const checked=validateChartSeries(x,series)
  x=checked.times;series=checked.series
  const viewer = ventilationViewer
  if (!viewer || viewer.isDestroyed()) throw new Error('[VentilationResource] Cesium Viewer 尚未初始化')
  if (typeof document === 'undefined') throw new Error('[VentilationResource] 当前环境不支持图表增强')

  const host = document.createElement('section')
  host.dataset.ventilationEnhancement = 'chart'
  host.dataset.ventilationOwner=owner
  const mainScene = !!viewer.container.closest?.('.dashboard-container')
  const manualControls = !mainScene || taskManualControlsEnabled()
  Object.assign(host.style, {
    position: 'absolute', right: '18px', bottom: '18px', zIndex: '30',
    width: 'min(480px, calc(100% - 36px))', height: '340px',
    padding: '12px', boxSizing: 'border-box', pointerEvents: 'auto',display:'flex',flexDirection:'column',
    border: '1px solid rgba(0,234,255,.42)', borderRadius: '6px',
    background: 'rgba(2,18,31,.94)', boxShadow: '0 8px 28px rgba(0,0,0,.38)',
    ...(mainScene ? { left: '20px', right: 'auto', bottom: '64px', width: 'min(480px, calc(100% - 420px))' } : {}),
  })
  const heading = document.createElement('div')
  heading.textContent = title
  Object.assign(heading.style, { height: '24px', color: '#9cecff', font: '600 13px Microsoft YaHei' })
  const canvas = document.createElement('div')
  canvas.dataset.ventilationChartCanvas='true'
  Object.assign(canvas.style, { width: '100%', flex:'1',minHeight:'0' })
  const note=document.createElement('small')
  note.textContent=options.note??'现有分析数据，非目标工点实时监测。'
  Object.assign(note.style,{color:'#91aac0',font:'11px Microsoft YaHei',lineHeight:'1.5',paddingTop:'6px',maxHeight:'64px',overflow:'auto'})
  const evidence=document.createElement('details'),evidenceHeading=document.createElement('summary'),evidenceBody=document.createElement('div')
  evidence.dataset.chartEvidence=owner;evidenceHeading.textContent='当前窗口的源采样说明'
  Object.assign(evidence.style,{color:'#a7bfd0',font:'11px Microsoft YaHei',lineHeight:'1.6',maxHeight:'130px',overflow:'auto',paddingTop:'6px'})
  evidenceHeading.style.cursor='pointer';evidence.append(evidenceHeading,evidenceBody)
  host.append(heading, canvas,evidence,note)
  viewer.container.appendChild(host)

  let chart: ReturnType<typeof echarts.init> | undefined
  let resize: (() => void) | undefined
  let observer:ResizeObserver|undefined
  let record:Parameters<typeof activeCharts.add>[0]|undefined
  const compactLegend = owner === 'ventilation.co-analysis' && mainScene
  try {
    chart = echarts.init(canvas)
    chart.setOption({
      animation: false,
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: {
        type:'scroll', top:0, selectedMode:manualControls,
        ...(compactLegend ? { itemWidth:16, itemHeight:8, itemGap:8, padding:0 } : {}),
        textStyle:{color:'#a7bfd0', ...(compactLegend ? {fontSize:11} : {})}, pageTextStyle:{color:'#a7bfd0'},
        selected:Object.fromEntries(series.map((s,i)=>[s.name,options.selected?options.selected.includes(s.name):i<5])),
      },
      grid: { left: 64, right: 40, top: 38, bottom: manualControls ? 72 : 44 },
      dataZoom:[{type:'inside',disabled:!manualControls,xAxisIndex:0,filterMode:'none'},{type:'slider',show:manualControls,xAxisIndex:0,height:16,bottom:12,filterMode:'none',textStyle:{color:'#a7bfd0'}}],
      xAxis: {
        type: 'value', name: xName,min:x[0],max:x.at(-1),
        nameTextStyle: { color: '#b6d0df' }, axisLabel: { color: '#9bb6c7',fontSize:11 },
        axisLine: { lineStyle: { color: '#29445a' } }, splitLine: { lineStyle: { color: '#162a3a' } },
      },
      yAxis: {
        type: 'value', name: yName,nameLocation:'middle',nameGap:48,nameRotate:90,
        nameTextStyle: { color: '#b6d0df' }, axisLabel: { color: '#9bb6c7',fontSize:11 },
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
    if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(()=>chart?.resize());observer.observe(host)}
    const refreshSummary=()=>{
      const current=inspectVentilationCharts().find(c=>c.owner===owner);if(!current)return
      const format=(v:number)=>Number(v.toPrecision(5)).toString()
      const visible=current.series.filter((s:any)=>s.visible)
      const lines=[`显示窗口 ${current.visibleTimeRange.map(format).join('～')}（${xName}）；数值单位：${yName}。`]
      for(const series of visible.slice(0,3)){
        const s=series.windowSummary
        lines.push(!s?`${series.name}：窗口内无源采样，不补值。`:s.sampleCount===1?`${series.name}：仅1个源采样，不能判断窗口内变化。`:`${series.name}：${s.sampleCount}个源采样；首值${format(s.first.value)}（t=${format(s.first.time)}），末值${format(s.last.value)}（t=${format(s.last.time)}），采样差${format(s.change)}。`)
      }
      if(!visible.length)lines.push('当前未选择显示序列。')
      if(visible.length>3)lines.push(`另有${visible.length-3}条已选序列，可缩小选择范围后查看。`)
      lines.push('仅汇总窗口内离散源采样，不插值、不推算阈值穿越时刻，不作现场验收结论。')
      evidenceBody.textContent=lines.join('\n');evidenceBody.style.whiteSpace='pre-line'
    }
    record={owner,title,host,chart,x:[...x],xName,yName,sourceNote:note.textContent,refreshSummary};activeCharts.add(record)
    chart.on('datazoom',refreshSummary);chart.on('legendselectchanged',refreshSummary);refreshSummary()
  } catch (error) {
    observer?.disconnect()
    if (resize) window.removeEventListener('resize', resize)
    chart?.dispose()
    host.remove()
    throw error
  }
  return trackEnhancement(owner, () => {
    if(record)activeCharts.delete(record)
    observer?.disconnect()
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
  const x = Array.isArray(result?.times)?result.times.map((value:unknown)=>typeof value==='number'?value/60:NaN):[]
  const history = result?.history as Record<string, unknown> | undefined
  const series = Object.entries(history ?? {}).map(([name, values], index) => ({
    name,
    values: Array.isArray(values)?values:[],
    color: chartColors[index % chartColors.length],
  }))
  return createChartOverlay('ventilation.co-analysis', 'CO 爆破扩散 · 浓度—时间', x, series, '时间 / min', 'CO / ppm',{note:'已有爆后扩散模拟工况，非本工点实时监测；曲线不能单独证明通风达标。'})
}

function transientChartAdapterFor(owner: string, document: Record<string, any> | undefined, title: string) {
  const x = Array.isArray(document?.times)?document.times:[]
  const history = document?.history as Record<string, { Q?: unknown }> | undefined
  const series = Object.entries(history ?? {}).map(([name, values], index) => ({
    name,
    values: Array.isArray(values?.Q)?values.Q:[],
    color: chartColors[index % chartColors.length],
  }))
  const selected=defaultTransientTraces(owner,series.map(s=>s.name)),rank=new Map(selected.map((name,i)=>[name,i]))
  series.sort((a,b)=>(rank.get(a.name)??99)-(rank.get(b.name)??99))
  return createChartOverlay(owner, title, x, series, '时间 / s', 'Q / m³·s⁻¹',{selected,note:`${String(document?.description??'已有瞬态工况')}。一维风网模拟，保留${series.length}条源支路。`})
}
function transientChartAdapter() {
  return transientChartAdapterFor('ventilation.transient-network', transientData as Record<string, any> | undefined, '瞬态通风 · 网络流量')
}

function thermalChartAdapterFor(owner: string, monitors: Record<string, unknown> | undefined, title: string) {
  const x = Array.isArray(monitors?.times_s)?monitors.times_s as number[]:[]
  const fields = [
    ['右管出口', 'T_outlet_right_K'],
    ['左管出口', 'T_outlet_left_K'],
  ] as const
  const series = fields.map(([name, key], index) => ({
    name,
    values: Array.isArray(monitors?.[key])?monitors[key] as number[]:[],
    color: chartColors[index % chartColors.length],
  }))
  return createChartOverlay(owner, title, x, series, '时间 / s', '温度 / K',{note:'已有热场近似工况的出口温度历程，非本工点温度实测；时间片与曲线来源一致。'})
}
function thermalChartAdapter() {
  return thermalChartAdapterFor('ventilation.thermal-field', thermalData?.monitors, '热瞬态 · 出口温度')
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
    combinedScene = context.task?.taskType === 'scene-exploration'
    if (combinedScene) {
      try {
        validateCombinedTask(context.task!)
      } catch (error) {
        combinedScene = false
        ventilationViewer = undefined
        throw error
      }
      setVentilationCombinedPlacement(true)
      context.reportProgress?.(1, '使用主隧道承载通风风场')
      return
    }
    setVentilationCombinedPlacement(false)
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
  async activate(task) {
    if (combinedScene) validateCombinedTask(task)
  },
  async update(task) {
    if (combinedScene) validateCombinedTask(task)
  },
  async unload() {
    disposeEnhancements()
    if (combinedScene) {
      ventilationViewer = undefined
      combinedScene = false
      setVentilationCombinedPlacement(false)
      return
    }
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
    return combinedScene ? [] : getTunnelModel() ? ['/data/ventilation/tunnel-assembled.glb'] : []
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
      fetchJson<CfdData>(STEADY_DATASET_FILES.cells),
      fetchJson<CfdData>(STEADY_DATASET_FILES.vectors),
    ])
    steadySummary = validateSteadyDataset(cells, arrows)
    steadyData = { cells, arrows }
    const warnings = steadySummary.warnings.length ? `；${steadySummary.warnings.join('；')}` : ''
    context.reportProgress?.(1, `稳态 CFD 数据已就绪：${steadySummary.cellCount} 个点、${steadySummary.vectorCount} 条矢量${warnings}`)
  },
  async activate() {
    if (!ventilationViewer || ventilationViewer.isDestroyed() || !steadyData) {
      throw new Error('[VentilationResource] 稳态 CFD 场景尚未就绪')
    }
    buildSteadyLayers(ventilationViewer, steadyData.cells, steadyData.arrows, 'velocity', combinedScene ? 'right' : 'both')
  },
  async deactivate() {
    if (ventilationViewer && !ventilationViewer.isDestroyed()) removeFlowLayers(ventilationViewer)
  },
  async unload() {
    disposeEnhancements('ventilation.steady-cfd')
    if (ventilationViewer && !ventilationViewer.isDestroyed()) removeFlowLayers(ventilationViewer)
    steadyData = undefined
    steadySummary = undefined
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
      ? [STEADY_DATASET_FILES.cells, STEADY_DATASET_FILES.vectors].map(file => `${ASSET}${file}`)
      : []
  },
}

export const ventilationCoResource: SceneResource = {
  id: 'ventilation.co-analysis',
  module: 'ventilation',
  type: 'co-transport-analysis',
  chainageRange: DISPLAY_RANGE_YK,
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

export const ventilationScenarioResources: SceneResource[] = transientScenarioCatalog.map(scenario => {
  let data: Record<string, any> | undefined
  return {
    id: scenario.id, module: 'ventilation', type: 'transient-ventilation-network',
    chainageRange: DISPLAY_RANGE_YK, processes: ['ventilation', 'risk-response'], states: ['transient'],
    dependencies: ['ventilation.scene'], lifetime: 'task',
    async load() {
      const value = await fetchJson<Record<string, any>>(scenario.file)
      if (!Array.isArray(value.times) || !value.times.length || !value.times.every(Number.isFinite) ||
          !value.history || !Object.values(value.history).some((edge: any) => Array.isArray(edge.Q) && edge.Q.length === value.times.length && edge.Q.every(Number.isFinite))) {
        throw new Error(`瞬态工况数据无有效流量序列：${scenario.label}`)
      }
      data = value
    },
    async unload() { disposeEnhancements(scenario.id); data = undefined },
    getActiveAssetPaths: () => data ? [`${ASSET}${scenario.file}`] : [],
    getEnhanceTargets: () => data ? [{ id: `${scenario.id}.chart`, type: 'transient-network-chart',
      recommendedEnhancements: ['chart'],
      adapters: { chart: () => transientChartAdapterFor(scenario.id, data, `瞬态通风 · ${scenario.label}`) },
    }] : [],
  }
})

export const ventilationSnapshotResources: SceneResource[] = thermalSnapshotCatalog.map(snapshot => {
  let data: CfdData | undefined
  let monitors: Record<string, unknown> | undefined
  let viewer: Cesium.Viewer | undefined
  let ownedPoints: Cesium.PointPrimitiveCollection | undefined
  return {
    id: snapshot.id, module: 'ventilation', type: 'thermal-snapshot', chainageRange: DISPLAY_RANGE_YK,
    processes: ['ventilation', 'thermal-risk'], states: ['thermal'], dependencies: ['ventilation.scene'], lifetime: 'task',
    async load(context) {
      const index = await fetchJson<any>('cfd_transient_index.json')
      if (!index.snapshots?.some((entry: any) => entry.t === snapshot.time && entry.file === snapshot.file)) throw new Error('热场时间片不属于当前索引')
      const [field, history] = await Promise.all([fetchJson<CfdData>(snapshot.file), fetchJson<Record<string, unknown>>('transient_thermal_monitors.json')])
      if (!field.x?.length || ![field.x, field.y, field.z, field.temp, field.vel].every(values => Array.isArray(values) && values.length === field.x.length && values.every(Number.isFinite))) throw new Error('热场时间片数组无效')
      data = field; monitors = history; viewer = context.viewer
    },
    async activate() {
      if (!viewer || !data) throw new Error('热场时间片尚未就绪')
      ownedPoints = updateThermalPoints(viewer, data, combinedScene ? 'right' : 'both')
    },
    async unload() {
      disposeEnhancements(snapshot.id)
      if (ownedPoints && viewer && !viewer.isDestroyed() && layers.points === ownedPoints) {
        viewer.scene.primitives.remove(ownedPoints); layers.points = undefined
      }
      ownedPoints = undefined; data = undefined; monitors = undefined; viewer = undefined
    },
    getActiveAssetPaths: () => data ? [`${ASSET}cfd_transient_index.json`, `${ASSET}transient_thermal_monitors.json`, `${ASSET}${snapshot.file}`] : [],
    getEnhanceTargets: () => data ? [{ id: `${snapshot.id}.chart`, type: 'thermal-snapshot', recommendedEnhancements: ['chart'],
      adapters: { chart: () => thermalChartAdapterFor(snapshot.id, monitors, `近似热场 t=${snapshot.time}s · 出口温度历程`) } }] : [],
  }
})

export const ventilationResources = [
  ventilationSceneResource,
  axialFanResource,
  axialFanDuctResource,
  ceilingJetFanResource,
  ventilationSteadyResource,
  ventilationCoResource,
  ventilationTransientResource,
  ventilationThermalResource,
  ...ventilationScenarioResources,
  ...ventilationSnapshotResources,
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
