<template>
  <section v-if="layers.length" class="support-layers" aria-label="支护构件显隐">
    <strong>支护构件</strong>
    <div class="support-layer-list">
      <label v-for="layer in layers" :key="`${layer.resourceId}:${layer.component}`">
        <input type="checkbox" :checked="layer.visible" :data-testid="`support-layer-${layer.component}`" @change="toggle(layer, ($event.target as HTMLInputElement).checked)">
        {{ labels[layer.component] || layer.component.replace('secondary_rebar_', '二衬钢筋 ') }}
      </label>
    </div>
    <button type="button" data-testid="support-layers-reset" @click="reset">恢复示例显隐</button>
    <small>仅控制当前已有构件，隐藏外壳可查看内部布置。</small>
    <details v-if="baselines.length" class="source-baseline" data-testid="support-source-baseline">
      <summary>源断面核对 · 尚未通过工程适用性验收</summary>
      <div v-for="baseline in baselines" :key="baseline.id">
        <p>{{ baseline.supportType }}：隧道源断面宽约 {{ tunnelWidth.toFixed(2) }}m。</p>
        <table><thead><tr><th>源构件</th><th>宽 / 高（m）</th></tr></thead><tbody>
          <tr v-for="group in baseline.groups.filter((g:any)=>['primary_concrete','secondary_lining'].includes(g.component))" :key="group.name">
            <td>{{ labels[group.component] }}</td><td>{{ group.sourceWidthM.toFixed(2) }} / {{ group.sourceHeightM.toFixed(2) }}</td>
          </tr>
        </tbody></table>
        <small>轮廓来自不同源资产，宽度有差异；未自动缩放。包围盒尺寸不能证明断面贴合，仍需对应设计断面与标高核查。</small>
        <small>支护依据：1064米示例，第{{ baseline.sourceSegment }}段；隧道依据：tunnel002.glb提取法向断面。均非本工段实测资料。</small>
      </div>
    </details>
    <p v-if="error" role="alert">{{ error }}</p>
  </section>
</template>
<script setup lang="ts">
import {ref,watch} from 'vue'
import {getTaskSupportLayers,getTestSectionSupportSummaries,setTaskSupportLayer,supportLayerRevision} from '@/modules/support/test-section-resource'
import profile from '@/modules/face-sketch/tunnel-normal-sections.json'
const props=defineProps<{resourceIds:string[]}>()
const layers=ref<ReturnType<typeof getTaskSupportLayers>>([]),error=ref('')
const baselines=ref<ReturnType<typeof getTestSectionSupportSummaries>>([])
const tunnelWidth=Math.max(...profile.sections[0]!.outline.map(p=>p[0]!))-Math.min(...profile.sections[0]!.outline.map(p=>p[0]!))
const labels:Record<string,string>={primary_concrete:'初支混凝土',secondary_lining:'二次衬砌',steel_arch:'钢拱架',lattice_arch:'格栅拱架',primary_mesh:'初支钢筋网',system_anchor:'系统锚杆',lock_foot_anchor:'锁脚锚杆',advance_support:'超前支护'}
const refresh=()=>{layers.value=getTaskSupportLayers(props.resourceIds);baselines.value=getTestSectionSupportSummaries(props.resourceIds).filter(s=>s.layout==='1064m-component-example')}
watch(()=>props.resourceIds,()=>{error.value='';refresh()},{immediate:true})
watch(supportLayerRevision,refresh)
function toggle(layer:typeof layers.value[number],visible:boolean){
  try{setTaskSupportLayer(layer.resourceId,layer.component,visible);error.value=''}catch(e){error.value=e instanceof Error?e.message:String(e)}finally{refresh()}
}
function reset(){
  try{for(const layer of layers.value)setTaskSupportLayer(layer.resourceId,layer.component,'default');error.value=''}catch(e){error.value=e instanceof Error?e.message:String(e)}finally{refresh()}
}
</script>
<style scoped>
.support-layers{margin:12px 0;padding-top:10px;border-top:1px solid #18435a;color:#c0dfec;font-size:12px}
.support-layer-list{display:grid;grid-template-columns:1fr 1fr;gap:8px 5px;max-height:220px;overflow:auto;margin:10px 0}
label{display:flex;align-items:center;gap:4px}input{accent-color:#00c9ef}
button{border:1px solid #21617c;background:#0a2c40;color:#bde9fb;padding:5px 8px;cursor:pointer}
small{display:block;margin-top:8px;line-height:1.5;color:#91b4c7}p{color:#ffc399}
.source-baseline{margin-top:10px;border-top:1px solid #18435a;padding-top:8px;line-height:1.6}.source-baseline summary{cursor:pointer;color:#e4c18d}.source-baseline table{width:100%;border-collapse:collapse}.source-baseline th,.source-baseline td{text-align:left;padding:3px;border-bottom:1px solid #18435a}
</style>
