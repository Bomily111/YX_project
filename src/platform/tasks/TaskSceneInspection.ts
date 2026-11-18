import {validGeneratedBounds,generatedBoundsWorldPoints} from '@/modules/support/generated-bounds'
import {inspectSupportContext} from './SupportContextFeedback'
import {assessTaskEvidence} from './TaskEvidenceAssessment'
import {inspectTaskEvidenceJournal,inspectTaskEvidenceProgress} from './TaskEvidenceJournal'
import * as C from 'cesium'
import type { AgentTaskWorkflowStatus } from './TaskWorkflowBridge'
import type { ResourceRegistry } from '@/platform/resources/ResourceRegistry'
import type { ResourceRuntimeState } from '@/platform/resources/ResourceManager'
import { inspectTaskSphereViewport } from './TaskViewport'

/** Snapshot only: no loads, renders, camera writes or geometry modifications. */
export function inspectTaskScene(status: AgentTaskWorkflowStatus, registry: ResourceRegistry,
  states: readonly Readonly<ResourceRuntimeState>[], viewer?: C.Viewer) {
  const stage = status.status === 'completed' ? status.lastCompletedStage : undefined
  const roots = stage?.assembledResourceIds ?? []
  const issues: Array<{ resourceId?: string; code: string; detail: string }> = []
  const limits = ['模型加载、显示及屏幕取景不代表工程适用性或质量验收', '未测模型间深度遮挡、净空侵限或现场配准误差', '模型显隐默认观察Cesium.Model.show；仅componentDisplay统计已声明且实际存在的构件节点，未覆盖其他内部节点或像素，ready不能证明画面可辨', '资产路径只是当前资源报告的来源，不代表已读取设计正文；缺少章节页码依据']
  if (!stage) issues.push({ code: 'no-completed-scene', detail: '当前没有已完成的场景；不使用前一阶段或历史聊天推断当前装配' })
  let selected = roots.map(id => registry.get(id)).filter(resource => !!resource)
  if (stage) {
    try { selected = [...registry.resolveLoadOrder(roots)] }
    catch (error) { issues.push({ code: 'dependency-unresolved', detail: String(error) }) }
  }
  const expected = new Set(selected.map(resource => resource.id))
  const supportModels:C.Model[]=[]
  const resources = selected.map(resource => {
    const state = states.find(item => item.id === resource.id)
    const loaded = state?.status === 'loaded'
    if (!loaded) issues.push({ resourceId: resource.id, code: 'not-loaded', detail: `任务声明资源的实际状态为${state?.status ?? 'idle'}` })
    const errors: string[] = []
    const read = <T>(fn: (() => T) | undefined, fallback: T): T => {
      try { return fn ? fn() : fallback } catch (error) { errors.push(String(error)); return fallback }
    }
    const paths = loaded ? [...read(resource.getActiveAssetPaths, [] as readonly string[])] : []
    const targets = loaded ? read(resource.getEnhanceTargets, []) : []
    const hints = [...new Set(targets.map(target => JSON.stringify(Object.fromEntries(
      ['displayName','note','placement','demonstration','componentScope','supportType','sourceStatus','sourceGeometryReused','originalGeometry']
        .filter(key => ['string','boolean','number'].includes(typeof target.metadata?.[key]))
        .map(key => [key,target.metadata![key]])
    ))).filter(value => value !== '{}'))]
    let unobserved = 0, ready = 0, hidden = 0, pending = 0
    const spheres: C.BoundingSphere[] = []
    const displayStyles:Array<{targetId:string;show:boolean;colorRgba:number[]|null;colorBlendMode:C.Model['colorBlendMode'];colorBlendAmount:number}>=[]
    const components=new Map<string,{component:string;visibleNodes:number;totalNodes:number;generatedGeometryAvailable:boolean}>()
    const componentSources=new Map<string,{spacings:Set<number>;offsets:Set<number>;segments:Set<number>}>()
    const componentPoints=new Map<string,C.Cartesian3[]>()
    for (const target of targets) {
      const object = target.object
      if (!(object instanceof C.Model)) { unobserved++; continue }
      if (object.isDestroyed()) { pending++; continue }
      if (object.show === false) hidden++
      if (!object.ready) { pending++; continue }
      ready++
      displayStyles.push({targetId:target.id,show:object.show,colorRgba:object.color?Array.from(C.Color.pack(object.color,[])):null,colorBlendMode:object.colorBlendMode,colorBlendAmount:object.colorBlendAmount})
      if(Array.isArray(target.metadata?.groups))for(const group of target.metadata.groups){
        if(typeof group?.component!=='string'||typeof group?.name!=='string')continue
        const node=read(()=>object.getNode(group.name),undefined)
        if(!node)continue
        const entry=components.get(group.component)??{component:group.component,visibleNodes:0,totalNodes:0,generatedGeometryAvailable:true}
        entry.generatedGeometryAvailable=entry.generatedGeometryAvailable&&target.metadata?.layout==='1064m-component-example'&&validGeneratedBounds(group.generatedBounds);entry.totalNodes++;if(object.show&&node.show)entry.visibleNodes++;components.set(group.component,entry)
        if(target.metadata?.layout==='1064m-component-example'&&validGeneratedBounds(group.generatedBounds)){
          const points=componentPoints.get(group.component)??[]
          points.push(...generatedBoundsWorldPoints(group.generatedBounds,object.modelMatrix));componentPoints.set(group.component,points)
        }
        const source=componentSources.get(group.component)??{spacings:new Set<number>(),offsets:new Set<number>(),segments:new Set<number>()}
        if(typeof group.spacingM==='number'&&Number.isFinite(group.spacingM)&&group.spacingM>0)source.spacings.add(group.spacingM)
        if(Array.isArray(group.stationOffsetsM))for(const offset of group.stationOffsetsM)if(typeof offset==='number'&&Number.isFinite(offset))source.offsets.add(offset)
        const segment=target.metadata?.sourceSegment
        if(typeof segment==='number'&&Number.isFinite(segment))source.segments.add(segment)
        componentSources.set(group.component,source)
      }
      if (object.show !== false) {spheres.push(object.boundingSphere);if(roots.includes(resource.id)&&resource.id.startsWith('support.modeler-'))supportModels.push(object)}
    }
    if (roots.includes(resource.id) && (!targets.length || unobserved)) issues.push({resourceId:resource.id,code:'observation-incomplete',detail:'当前资源未完整提供可观察的Cesium模型目标，模型就绪/显示范围只能部分核查，不能推断模型不存在'})
    if (pending) issues.push({ resourceId: resource.id, code: 'model-not-ready', detail: `${pending}个模型未就绪或已销毁` })
    if (hidden) issues.push({ resourceId: resource.id, code: 'model-hidden', detail: `${hidden}个模型当前隐藏；可能是用户选择，不自动恢复` })
    if (errors.length) issues.push({ resourceId: resource.id, code: 'inspection-error', detail: errors.join('; ') })
    const framing = viewer && !viewer.isDestroyed() && spheres.length
      ? read(() => inspectTaskSphereViewport(viewer, C.BoundingSphere.fromBoundingSpheres(spheres)), {available:false as const}) : {available:false as const}
    if (framing.available && framing.insideSafe < 26) issues.push({ resourceId: resource.id, code: 'framing-incomplete', detail: `${framing.insideSafe}/26包围球采样位于可用画面；不是可见像素或遮挡测量` })
    return { id:resource.id, role:roots.includes(resource.id) ? 'task-root' : 'dependency', module:resource.module,
      sourceHints:hints.slice(0,8).map(value => JSON.parse(value)), sourceHintsTruncated:hints.length > 8, runtimeState:state?.status ?? 'idle', references:state?.references ?? 0, assetPaths:paths,
      componentDisplay:[...components.values()].map(component=>{
        const source=componentSources.get(component.component)!,offsets=[...source.offsets].sort((a,b)=>a-b)
        const points=componentPoints.get(component.component)
        const framing=component.generatedGeometryAvailable&&points?.length&&viewer&&!viewer.isDestroyed()?read(()=>inspectTaskSphereViewport(viewer,C.BoundingSphere.fromPoints(points)),{available:false as const}):{available:false as const}
        return {...component,framing,sourceAssembly:{scope:'recorded-source-example-not-design-or-measurement',spacingM:[...source.spacings].sort((a,b)=>a-b),baseStationCount:offsets.length||null,offsetRangeM:offsets.length?[offsets[0]!,offsets.at(-1)!]:null,sourceSegments:[...source.segments].sort((a,b)=>a-b)}}
      }),
      observation: { targetCount:targets.length, readyModelCount:ready, hiddenModelCount:hidden, pendingModelCount:pending,
        unobservedTargetCount:unobserved, modelCoverage:targets.length && !unobserved ? 'declared-targets-only' : 'incomplete', framing, displayStyles },
      evidenceStatus:'runtime-only-not-engineering-acceptance' }
  })
  const outside = stage ? states.filter(item => item.status === 'loaded' && !expected.has(item.id)).map(item => item.id) : []
  if (outside.length) issues.push({ code:'loaded-outside-current-scene', detail:'存在当前任务依赖以外的已加载资源；可能由其他页面持有，不能直接认定泄漏或自动释放' })
  return { capturedAt:new Date().toISOString(), taskId:status.taskId ?? null, workflowStatus:status.status ?? 'unprepared',
    completedSceneAvailable:!!stage, chainageRange:stage?.chainageRange ?? null, phase:stage?.phase ?? null,
    resourceIds:[...roots], resources, evidenceAssessment:stage?assessTaskEvidence(status.taskId!,roots):null, locationEvidence:stage?inspectTaskEvidenceJournal(status.taskId):[], evidenceProgress:inspectTaskEvidenceProgress(stage?status.taskId:undefined), loadedOutsideCurrentScene:outside, taskSourceNote:stage?.note ?? null,
    supportContext:stage&&viewer&&!viewer.isDestroyed()?inspectSupportContext(viewer,roots,supportModels):{available:false as const,reason:'无已完成可观察场景'},
    issues, engineeringAcceptance:'not-verified', limitations:limits,
    nextChecks: [ ...(issues.some(item => item.code === 'not-loaded' || item.code === 'model-not-ready') ? ['先核对未加载/未就绪对象，再决定是否重试；本次未执行修复'] : []),
      ...(issues.some(item => item.code === 'framing-incomplete') ? ['取景不完整时可按用户目标选择已有视角工具；本次未移动相机'] : []),
      '工程结论须补充适用设计与实测资料；运行状态不能代替文字依据' ] }
}
