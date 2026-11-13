<template>
  <details v-if="rows.length" class="support-layout" data-testid="support-layout" @toggle="toggle">
    <summary>纵向布置与来源 · 示意装配</summary>
    <label>定位对象<select v-model="rowId" data-testid="support-layout-component"><option v-for="r in rows" :key="r.id" :value="r.id">{{ label(r) }}</option></select></label>
    <template v-if="row">
      <svg viewBox="0 0 240 90" aria-label="支护纵向基准站位图" data-testid="support-layout-svg">
        <text x="20" y="13">后方支护 → 测试断面</text>
        <rect x="20" y="26" :width="x(-.5)-20" height="18" fill="#164657" />
        <line x1="220" y1="20" x2="220" y2="63" stroke="#b4d3dd" stroke-dasharray="3 3" />
        <circle v-for="(offset,i) in row.offsetsM" :key="offset" :cx="x(offset)" cy="35" :r="selected===offset?6:4" :fill="selected===offset?'#fff1a8':'#38cee6'"
          role="button" tabindex="0" :aria-pressed="selected===offset" :aria-label="`定位相对站位${offset.toFixed(2)}米`" :data-testid="`support-station-${i}`" :data-selected="selected===offset" @click="select(offset,'2d')" @keydown.enter.prevent="select(offset,'2d')" @keydown.space.prevent="select(offset,'2d')" />
        <text x="20" y="76">{{ (-row.lengthM-.5).toFixed(1) }}m</text><text x="212" y="76">0m</text>
      </svg>
      <p data-testid="support-station-selection">{{ selected===null?'选择图中站位，或点击三维青色定位标记':`已选相对站位 ${selected.toFixed(2)}m` }}</p>
      <button v-if="selected!==null" data-testid="support-station-clear" @click="clearSelection">清除定位</button>
      <table><tbody>
        <tr><th>装配长度</th><td>{{ row.lengthM }}m</td></tr>
        <tr><th>{{ row.kind==='unit-base'?'独立单元数':'基准站位数' }}</th><td>{{ row.offsetsM.length }}</td></tr>
        <tr><th>示例基准间距</th><td>{{ row.spacingM===null?'未核验':`${row.spacingM}m` }}</td></tr>
        <tr><th>工段设计要求</th><td>未提供</td></tr><tr><th>工段实测</th><td>未提供</td></tr>
      </tbody></table>
      <small>0m为测试源断面；站位来自本次装配记录，不等同构件中心或实测里程。三维标记仅用于定位，不是新增支护构件。</small>
      <small v-if="row.kind==='unit-base'">Z-PM仅显示已有单元基准，不能据此推断配筋间距。</small>
      <details><summary>源元数据依据</summary><p>{{ row.sourceSegment===null?'独立模型回退；配筋PARTIAL、间距未核验':`1064米示例第${row.sourceSegment}段；保留源构件与布置基准` }}</p>
        <a v-for="source in sources" :key="source" :href="source" target="_blank" rel="noopener">{{ source.split('/').at(-1) }}</a>
        <small>以上是模型/元数据来源，未提供对应施工方案页码，不作为现场设计或质量验收依据。</small>
      </details>
    </template>
    <p v-if="error" role="alert">{{ error }}</p>
  </details>
</template>
<script setup lang="ts">
import {computed,onBeforeUnmount,ref,watch} from 'vue'
import * as C from 'cesium'
import {getTestSectionSupportSummaries,testSupportStationWorld,testSectionSupportResources} from '@/modules/support/test-section-resource'
import {supportLongitudinalRows,type SupportLayoutRow} from '@/modules/support/longitudinal-layout'
import {supportComponentLabel} from '@/modules/support/component-labels'
import {viewerService} from '@/platform/viewer/ViewerService'
import {chainageService} from '@/platform/coordinates/ChainageService'
import {getTaskWorkflowController,hasTaskWorkflowController} from '@/platform/tasks/TaskWorkflowBridge'
const props=defineProps<{resourceIds:string[];taskId:string}>()
const rows=computed(()=>supportLongitudinalRows(getTestSectionSupportSummaries(props.resourceIds)))
const rowId=ref(''),selected=ref<number|null>(null),open=ref(false),error=ref('')
const row=computed(()=>rows.value.find(r=>r.id===rowId.value))
const sources=computed(()=>row.value?testSectionSupportResources.find(r=>r.id===row.value!.resourceId)?.getActiveAssetPaths?.()??[]:[])
const label=(r:SupportLayoutRow)=>r.kind==='unit-base'?'单元基准（非配筋间距）':supportComponentLabel(r.component)
const x=(offset:number)=>20+(offset+(row.value?.lengthM??0)+.5)/((row.value?.lengthM??0)+.5)*200
let entities:C.Entity[]=[],handler:C.ScreenSpaceEventHandler|undefined,owner:C.Viewer|undefined
function release(){
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
function select(offset:number,from:'2d'|'3d'){
  if(!row.value||!owner||owner.isDestroyed())return
  if(!hasTaskWorkflowController()||getTaskWorkflowController().getStatus().taskId!==props.taskId){error.value='任务已切换，请等待当前装配完成后重新定位。';return}
  selected.value=offset
  const time=C.JulianDate.now()
  entities.forEach((entity,i)=>{const chosen=row.value!.offsetsM[i]===offset;entity.point!.color=new C.ConstantProperty(chosen?C.Color.fromCssColorString('#fff1a8'):C.Color.CYAN);entity.point!.pixelSize=new C.ConstantProperty(chosen?12:8);entity.label!.show=new C.ConstantProperty(chosen)})
  if(from==='2d'){
    const entity=entities[row.value.offsetsM.indexOf(offset)]!,center=entity.position!.getValue(time)!,station=chainageService.positionWithHeadingAt(2244)!
    owner.camera.cancelFlight();owner.camera.viewBoundingSphere(new C.BoundingSphere(center,8),new C.HeadingPitchRange(station.heading+.85,-.3,36));owner.camera.lookAtTransform(C.Matrix4.IDENTITY)
  }
  owner.scene.requestRender()
}
function clearSelection(){rebuild()}
function toggle(event:Event){open.value=(event.target as HTMLDetailsElement).open;rebuild()}
watch(rows,values=>{rowId.value=values.find(r=>r.component==='steel_arch'||r.component==='lattice_arch')?.id??values[0]?.id??''},{immediate:true})
watch(rowId,rebuild)
onBeforeUnmount(release)
</script>
<style scoped>
.support-layout{margin-top:12px;padding-top:9px;border-top:1px solid #18435a;color:#bedbe6;font-size:12px;line-height:1.5}summary{cursor:pointer;color:#77d9e8}label{display:block;margin:8px 0}select{display:block;width:100%;margin-top:4px;background:#0a2c40;color:#cae6ed;border:1px solid #21617c;padding:4px}svg{display:block;width:100%;height:auto;background:#061f30;border-radius:4px}svg text{fill:#a7c6d2;font-size:10px}circle{cursor:pointer}circle:focus{stroke:white;stroke-width:2}table{width:100%;border-collapse:collapse;margin:8px 0}th,td{padding:3px;border-bottom:1px solid #18435a;text-align:left}th{font-weight:400;color:#91b4c7}small{display:block;color:#91b4c7;margin:8px 0}a{display:block;color:#6bd8ed;overflow-wrap:anywhere;font-size:10px;margin:4px 0}button{border:1px solid #21617c;background:#0a2c40;color:#bde9fb;padding:4px 8px;cursor:pointer}p{margin:8px 0}
</style>
