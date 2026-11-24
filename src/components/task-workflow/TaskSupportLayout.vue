<template>
  <details v-if="rows.length" class="support-layout" data-testid="support-layout" @toggle="toggle">
    <summary>纵向布置与来源 · 示意装配</summary>
    <label>定位对象<select v-model="rowId" data-testid="support-layout-component"><option v-for="r in rows" :key="r.id" :value="r.id">{{ label(r) }}</option></select></label>
    <template v-if="row">
      <button v-if="row.kind==='component-base'" data-testid="support-component-reveal" @click="revealComponent">显露当前构件</button>
      <button v-if="componentReviewActive" data-testid="support-component-restore" @click="restoreComponent">恢复原显隐</button>
      <small v-if="componentReviewActive" data-testid="support-component-review-note">已显示当前构件，并暂时隐藏其他初支/二衬外壳；其余结构保留原显隐。仅改变显示，不代表已解决全部遮挡或通过工程核验。</small>
      <small v-if="componentReviewNotice" data-testid="support-component-manual-notice">{{ componentReviewNotice }}</small>
      <nav class="review-steps" aria-label="支护核对步骤"><button v-for="(step,i) in steps" :key="step.id" :data-testid="`support-review-${step.id}`" :aria-pressed="stepIndex===i" @click="goStep(i)">{{ i+1 }} {{ step.title }}</button></nav>
      <section v-if="steps[stepIndex]" data-testid="support-review-question"><strong>{{ steps[stepIndex]!.question }}</strong><small>{{ steps[stepIndex]!.boundary }}</small></section>
      <small v-if="visited.length" data-testid="support-review-history">本任务已定位：{{ visited.map(v=>v.toFixed(2)+'m').join('、') }}（访问记录，非验收通过）</small>
      <section data-testid="support-review-progress">
        <strong>本行步骤访问 · 不代表问题已回答</strong>
        <ul><li v-for="item in stepProgress" :key="item.id">{{ item.title }}：{{ item.visited?'已记录访问，仍待核查':'未记录步骤点击' }}</li></ul>
        <small v-if="progress.stepRecords.omitted || progress.locationRecords.omitted">本任务历史已省略{{ progress.stepRecords.omitted }}条步骤、{{ progress.locationRecords.omitted }}条定位记录；当前显示不是完整历史。</small>
      </section>
      <button v-if="entryCamera" data-testid="support-review-restore" @click="restoreView">恢复进入时视角</button>
      <svg viewBox="0 0 240 90" aria-label="支护纵向基准站位图" data-testid="support-layout-svg">
        <text x="20" y="13">后方支护 → 测试断面</text>
        <rect x="20" y="26" :width="x(-.5)-20" height="18" fill="#164657" />
        <line x1="220" y1="20" x2="220" y2="63" stroke="#b4d3dd" stroke-dasharray="3 3" />
        <line v-for="interval in intervals" :key="interval.from" :x1="x(interval.from)" :x2="x(interval.to)" y1="49" y2="49" stroke="#fff1a8" stroke-width="2" />
        <circle v-for="(offset,i) in row.offsetsM" :key="offset" :cx="x(offset)" cy="35" :r="selected===offset?6:4" :fill="selected===offset?'#fff1a8':'#38cee6'"
          role="button" tabindex="0" :aria-pressed="selected===offset" :aria-label="`定位相对站位${offset.toFixed(2)}米`" :data-testid="`support-station-${i}`" :data-selected="selected===offset" @click="select(offset,'2d')" @keydown.enter.prevent="select(offset,'2d')" @keydown.space.prevent="select(offset,'2d')" />
        <text x="20" y="76">{{ (-row.lengthM-.5).toFixed(1) }}m</text><text x="212" y="76">0m</text>
      </svg>
      <p data-testid="support-station-selection">{{ selected===null?'选择图中站位，或点击三维青色定位标记':`已选相对站位 ${selected.toFixed(2)}m` }}</p>
      <button v-if="selected!==null" data-testid="support-station-clear" @click="clearSelection">清除定位</button>
      <small v-if="intervals.length" data-testid="support-station-intervals">
        {{ row.kind==='unit-base'?'相邻单元基准':'相邻构件基准' }}的记录间隔
        <span v-for="interval in intervals" :key="interval.from" class="station-interval">{{ interval.from.toFixed(2) }} 至 {{ interval.to.toFixed(2) }}m · {{ interval.distanceM.toFixed(2) }}m</span>
        {{ row.kind==='unit-base'?'此处间隔来自独立单元放置记录。':'此处间隔来自构件装配基准记录。' }}三维黄色辅助线连接定位标记。
      </small>
      <table><tbody>
        <tr><th>装配长度</th><td>{{ row.lengthM }}m</td></tr>
        <tr><th>{{ row.kind==='unit-base'?'独立单元数':'基准站位数' }}</th><td>{{ row.offsetsM.length }}</td></tr>
        <tr v-if="row.kind==='unit-base'"><th>配筋间距</th><td>未核验</td></tr>
        <tr v-else><th>示例基准间距</th><td>{{ row.spacingM===null?'未核验':`${row.spacingM}m` }}</td></tr>
        <tr><th>工段设计要求</th><td>未提供</td></tr><tr><th>工段实测</th><td>未提供</td></tr>
      </tbody></table>
      <section v-if="finding" data-testid="support-layout-finding" class="finding">
        <strong>本次核对</strong><p>{{ finding.observation }}</p><p>{{ finding.evidence }}</p><p>{{ finding.nextCheck }}</p>
        <small>工段设计与实测未提供，工程验收尚未核验。</small>
      </section>
      <small>0m为测试源断面；站位来自本次装配记录，不等同构件中心或实测里程。三维标记仅用于定位，不是新增支护构件。</small>
      <section data-testid="support-evidence-assessment">
        <strong>本行交互事实与待核查问题</strong>
        <small v-if="assessment.factWindow.omitted">任务摘要窗口另外省略{{ assessment.factWindow.omitted }}项事实；不代表这些交互未发生。</small>
        <p>{{ rowFacts.length?`已保留${rowFacts.length}项交互事实；不代表问题已回答。`:'本行尚无保留的交互事实。' }}</p>
        <ul><li v-for="fact in rowFacts.slice(-5)" :key="fact.id">{{ fact.text }}</li></ul>
        <small v-if="rowFacts.length>5">页面仅显示最近5项；任务记录保留范围见步骤历史说明。</small>
        <p v-for="gap in assessment.gaps" :key="gap.id">{{ gap.question }} {{ gap.nextCheck }}</p>
      </section>
      <section data-testid="support-evidence-gaps">
        <strong>证据缺口与后续核查</strong>
        <p v-for="gap in reviewEvidence.evidenceGaps" :key="gap.id">{{ gap.nextAction }}</p>
        <small>{{ reviewEvidence.stopReason }}</small>
      </section>
      <small v-if="row.kind==='unit-base'">此行显示原模型单元基准，不能据此推断配筋间距。</small>
      <details ref="sourceDetails"><summary>源元数据依据</summary><p>{{ row.sourceSegment===null?'支护版块原始单元；构件间距未核验':`1064米示例第${row.sourceSegment}段；保留源构件与布置基准` }}</p>
        <a v-for="source in sources" :key="source" :href="source" target="_blank" rel="noopener">{{ source.split('/').at(-1) }}</a>
        <small>以上是模型/元数据来源，未提供对应施工方案页码，不作为现场设计或质量验收依据。</small>
      </details>
    </template>
    <p v-if="error" role="alert">{{ error }}</p>
  </details>
</template>
<script setup lang="ts">
import {recordTaskLocationEvidence,recordTaskReviewStep,taskEvidenceRevision,inspectTaskEvidenceProgress,taskEvidenceScopeMatches} from '@/platform/tasks/TaskEvidenceJournal'
import {assessTaskEvidence} from '@/platform/tasks/TaskEvidenceAssessment'
import {taskVisualReview} from '@/platform/tasks/TaskVisualReview'
import {computed,onBeforeUnmount,ref,watch} from 'vue'
import * as C from 'cesium'
import {getTestSectionSupportSummaries,testSupportStationWorld,testSectionSupportResources,revealTaskSupportComponent,supportLayerRevision} from '@/modules/support/test-section-resource'
import {adjacentSupportIntervals,supportLongitudinalRows,supportLayoutFinding,supportReviewSteps,type SupportLayoutRow} from '@/modules/support/longitudinal-layout'
import {supportComponentLabel} from '@/modules/support/component-labels'
import {supportReviewEvidence} from '@/modules/support/review-evidence'
import {viewerService} from '@/platform/viewer/ViewerService'
import {chainageService} from '@/platform/coordinates/ChainageService'
import {getTaskWorkflowController,hasTaskWorkflowController} from '@/platform/tasks/TaskWorkflowBridge'
import {focusTaskCamera,taskCameraSelection,restoreTaskCameraSelection,markTaskStationCamera} from '@/platform/tasks/TaskCameraView'
import {captureTaskViewportTarget} from '@/platform/tasks/TaskViewport'
const props=defineProps<{resourceIds:string[];taskId:string}>()
const rows=computed(()=>supportLongitudinalRows(getTestSectionSupportSummaries(props.resourceIds)))
const rowId=ref(''),selected=ref<number|null>(null),open=ref(false),error=ref('')
const row=computed(()=>rows.value.find(r=>r.id===rowId.value))
const intervals=computed(()=>adjacentSupportIntervals(row.value?.offsetsM??[],selected.value))
const reviewEvidence=computed(()=>supportReviewEvidence(rows.value))
const steps=computed(()=>row.value?supportReviewSteps(row.value):[]),stepIndex=ref(0),visited=ref<number[]>([]),sourceDetails=ref<HTMLDetailsElement>()
const progress=computed(()=>{void taskEvidenceRevision.value;return inspectTaskEvidenceProgress(props.taskId)})
const stepProgress=computed(()=>steps.value.map(step=>({id:step.id,title:step.title,visited:progress.value.steps.some(entry=>entry.rowId===rowId.value&&entry.resourceId===row.value?.resourceId&&entry.stepId===step.id)})))
const assessment=computed(()=>{void taskEvidenceRevision.value;return assessTaskEvidence(props.taskId,props.resourceIds)})
const rowFacts=computed(()=>assessment.value.facts.filter(fact=>fact.rowId===rowId.value&&fact.resourceId===row.value?.resourceId))
const entryCamera=ref<{position:C.Cartesian3;direction:C.Cartesian3;up:C.Cartesian3}>()
let restoreEntryContext:(()=>void)|undefined
let restoreComponentState:ReturnType<typeof revealTaskSupportComponent>|undefined
const componentReviewActive=ref(false)
const componentReviewNotice=ref('')
watch(supportLayerRevision,()=>{
  if(componentReviewActive.value&&restoreComponentState&&!restoreComponentState.isCurrent()){
    restoreComponentState=undefined;componentReviewActive.value=false
    componentReviewNotice.value='后续显隐设置已接管，临时显露已结束；切换构件不会自动覆盖你的新设置。'
  }
})
function restoreComponent(){restoreComponentState?.();restoreComponentState=undefined;componentReviewActive.value=false}
function revealComponent(){
  if(!currentTask()||!row.value)return
  try{restoreComponent();restoreComponentState=revealTaskSupportComponent(row.value.resourceId,row.value.component);componentReviewActive.value=true;componentReviewNotice.value='';error.value=''}
  catch(e){error.value=e instanceof Error?e.message:String(e)}
}
const finding=computed(()=>row.value?supportLayoutFinding(row.value):undefined)
const sources=computed(()=>row.value?testSectionSupportResources.find(r=>r.id===row.value!.resourceId)?.getActiveAssetPaths?.()??[]:[])
const label=(r:SupportLayoutRow)=>r.kind==='unit-base'?'单元基准（非配筋间距）':supportComponentLabel(r.component)
const x=(offset:number)=>20+(offset+(row.value?.lengthM??0)+.5)/((row.value?.lengthM??0)+.5)*200
let entities:C.Entity[]=[],handler:C.ScreenSpaceEventHandler|undefined,owner:C.Viewer|undefined
let intervalEntities: C.Entity[] = []
function clearIntervalGuides() {
  if (owner && !owner.isDestroyed()) for (const entity of intervalEntities) owner.entities.remove(entity)
  intervalEntities = []
}
function release(){
  restoreComponent()
  clearIntervalGuides()
  componentReviewNotice.value=''
  handler?.destroy();handler=undefined
  if(owner&&!owner.isDestroyed()){
    if(entities.includes(owner.selectedEntity!))owner.selectedEntity=undefined
    for(const entity of entities)owner.entities.remove(entity);owner.scene.requestRender()
  }
  entities=[];owner=undefined
}
function rebuild(){
  release();selected.value=null;error.value=''
  if(!open.value||!row.value)return
  const viewer=viewerService.current
  if(!viewer||viewer.isDestroyed())return
  owner=viewer
  try{
    for(const [i,offset] of row.value.offsetsM.entries())entities.push(viewer.entities.add({
      id:`task-support-locator:${props.taskId}:${i}`,name:'装配基准站位定位标记（非构件）',position:testSupportStationWorld(row.value.resourceId,offset),
      properties:{taskSupportStation:true,resourceId:row.value.resourceId,offsetM:offset},
      point:{pixelSize:8,color:C.Color.CYAN,outlineColor:C.Color.fromCssColorString('#063044'),outlineWidth:2,disableDepthTestDistance:Number.POSITIVE_INFINITY},
      label:{text:`基准 ${offset.toFixed(2)}m`,show:false,font:'12px sans-serif',fillColor:C.Color.WHITE,showBackground:true,backgroundColor:C.Color.fromCssColorString('#082d40'),pixelOffset:new C.Cartesian2(0,-20),disableDepthTestDistance:Number.POSITIVE_INFINITY},
    }))
    handler=new C.ScreenSpaceEventHandler(viewer.canvas)
    handler.setInputAction((click:{position:C.Cartesian2})=>{
      const picks=viewer.scene.drillPick(click.position,16)
      const picked=picks.find(p=>entities.includes(p.id))
      const index=entities.findIndex(e=>e===picked?.id)
      if(index>=0)select(row.value!.offsetsM[index]!,'3d')
    },C.ScreenSpaceEventType.LEFT_CLICK)
    viewer.scene.requestRender()
  }catch(e){release();error.value=e instanceof Error?e.message:String(e)}
}
function select(offset:number,from:'2d'|'3d',reviewStep=steps.value[stepIndex.value]){
  if(!row.value||!owner||owner.isDestroyed())return
  if(!currentTask()||!row.value.offsetsM.includes(offset)){error.value='任务已切换，请等待当前装配完成后重新定位。';return}
  const review=taskVisualReview.value
  const plan = review?.plan
  const matchesPlan = plan?.taskId === props.taskId
    && plan.focusResourceIds.includes(row.value.resourceId)
    && (plan.focusComponent === undefined || plan.focusComponent === row.value.component)
  recordTaskLocationEvidence({taskId:props.taskId,resourceId:row.value.resourceId,rowId:row.value.id,component:row.value.component,offsetM:offset,source:from,reviewStep:reviewStep?{id:reviewStep.id,question:reviewStep.question,boundary:reviewStep.boundary}:undefined,assetPaths:[...sources.value],
    ...(matchesPlan ? {visualObjective:plan.objective,questions:[...plan.questions]} : {})})
  selected.value=offset
  if(!visited.value.includes(offset))visited.value.push(offset)
  const time=C.JulianDate.now()
  paintSelection()
  if(from==='2d'){
    const entity=entities[row.value.offsetsM.indexOf(offset)]!,center=entity.position!.getValue(time)!,station=chainageService.positionWithHeadingAt(2244)!
    owner.camera.cancelFlight();owner.camera.viewBoundingSphere(new C.BoundingSphere(center,8),new C.HeadingPitchRange(station.heading+.85,-.3,36));owner.camera.lookAtTransform(C.Matrix4.IDENTITY)
    markTaskStationCamera(owner)
  }
  owner.scene.requestRender()
}
function paintSelection(){
  entities.forEach((entity,i)=>{const chosen=selected.value!==null&&row.value?.offsetsM[i]===selected.value;entity.point!.color=new C.ConstantProperty(chosen?C.Color.fromCssColorString('#fff1a8'):C.Color.CYAN);entity.point!.pixelSize=new C.ConstantProperty(chosen?12:8);entity.label!.show=new C.ConstantProperty(chosen)})
  clearIntervalGuides()
  if (!owner || !row.value) return
  const time = C.JulianDate.now()
  for (const interval of intervals.value) {
    const positions = [interval.from, interval.to].map(offset =>
      entities[row.value!.offsetsM.indexOf(offset)]?.position?.getValue(time))
    if (!positions[0] || !positions[1]) continue
    const color = C.Color.fromCssColorString('#fff1a8')
    intervalEntities.push(owner.entities.add({
      name: '相邻装配基准辅助线',
      properties: {taskSupportInterval: true, fromM: interval.from, toM: interval.to},
      polyline: {positions: [positions[0], positions[1]], width: 3, arcType: C.ArcType.NONE, material: color, depthFailMaterial: color},
    }))
  }
}
function clearSelection(){
  if(!owner||owner.isDestroyed()||!currentTask())return
  selected.value=null
  if(entities.includes(owner.selectedEntity!))owner.selectedEntity=undefined
  paintSelection();owner.scene.requestRender()
}
function currentTask(){return !!row.value&&hasTaskWorkflowController()&&taskEvidenceScopeMatches(getTaskWorkflowController().getStatus(),props.taskId,row.value.resourceId)}
function goStep(index:number){
  if(!row.value||!owner||!currentTask())return
  try{
    const step=steps.value[index];if(!step)return
    if(step.id==='overview'||step.id==='conclusion')focusTaskCamera(owner,props.resourceIds,2244,'overview')
    if(step.id==='interface'&&row.value.offsetsM.length)select(row.value.offsetsM.at(-1)!,'2d',step)
    if(step.id==='components'&&selected.value===null&&row.value.offsetsM.length)select(row.value.offsetsM[0]!,'2d',step)
    if(step.id==='evidence'&&sourceDetails.value)sourceDetails.value.open=true
    recordTaskReviewStep({taskId:props.taskId,resourceId:row.value.resourceId,rowId:row.value.id,stepId:step.id,question:step.question,boundary:step.boundary,assetPaths:[...sources.value]})
    stepIndex.value=index;error.value=''
  }catch(e){error.value=e instanceof Error?e.message:String(e)}
}
function restoreView(){
  if(!owner||!entryCamera.value||!currentTask())return
  const saved=entryCamera.value;owner.camera.cancelFlight();owner.camera.setView({destination:saved.position,orientation:{direction:saved.direction,up:saved.up}});restoreEntryContext?.();owner.scene.requestRender()
}
function toggle(event:Event){
  if(event.target!==event.currentTarget)return
  open.value=(event.target as HTMLDetailsElement).open
  if(open.value){const viewer=viewerService.current,camera=viewer?.camera;if(viewer&&camera){entryCamera.value={position:C.Cartesian3.clone(camera.positionWC),direction:C.Cartesian3.clone(camera.directionWC),up:C.Cartesian3.clone(camera.upWC)};const selection=taskCameraSelection.value,restoreTarget=captureTaskViewportTarget(viewer);restoreEntryContext=()=>{restoreTarget();restoreTaskCameraSelection(selection)}}}
  else {entryCamera.value=undefined;restoreEntryContext=undefined}
  rebuild()
}
watch(rows,values=>{rowId.value=values.find(r=>r.component==='steel_arch'||r.component==='lattice_arch')?.id??values[0]?.id??''},{immediate:true})
watch(rowId,()=>{stepIndex.value=0;visited.value=[];rebuild()})
onBeforeUnmount(release)
</script>
<style scoped>
.station-interval{display:block;color:#fff1a8}
.review-steps{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:9px 0}.review-steps button[aria-pressed=true]{border-color:#00d4ff;background:#12526c}
.support-layout{margin-top:12px;padding-top:9px;border-top:1px solid #18435a;color:#bedbe6;font-size:12px;line-height:1.5}summary{cursor:pointer;color:#77d9e8}label{display:block;margin:8px 0}select{display:block;width:100%;margin-top:4px;background:#0a2c40;color:#cae6ed;border:1px solid #21617c;padding:4px}svg{display:block;width:100%;height:auto;background:#061f30;border-radius:4px}svg text{fill:#a7c6d2;font-size:10px}circle{cursor:pointer}circle:focus{stroke:white;stroke-width:2}table{width:100%;border-collapse:collapse;margin:8px 0}th,td{padding:3px;border-bottom:1px solid #18435a;text-align:left}th{font-weight:400;color:#91b4c7}small{display:block;color:#91b4c7;margin:8px 0}a{display:block;color:#6bd8ed;overflow-wrap:anywhere;font-size:10px;margin:4px 0}button{border:1px solid #21617c;background:#0a2c40;color:#bde9fb;padding:4px 8px;cursor:pointer}p{margin:8px 0}
</style>
