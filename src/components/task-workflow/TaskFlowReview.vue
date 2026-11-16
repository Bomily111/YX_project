<template>
  <section v-if="taskFlowReview" class="flow-review" data-testid="task-flow-review">
    <strong>爆后轮廓与风向复核</strong>
    <p data-testid="flow-review-mode">{{ taskFlowReview.mode==='focus'?'重点表达：附近风向参照，弱化CFD点层':'全段表达：已恢复原风场显示' }}</p>
    <div class="actions">
      <button data-testid="flow-review-focus" :aria-pressed="taskFlowReview.mode==='focus'" @click="change('focus')">复核重点</button>
      <button data-testid="flow-review-context" :aria-pressed="taskFlowReview.mode==='context'" @click="change('context')">风场全段</button>
    </div>
    <small>重点半径约{{ taskFlowReview.radiusM.toFixed(1) }}m，关联{{ taskFlowReview.localSamples }}/{{ taskFlowReview.totalSamples }}个模拟采样点。局部取景不表示全场已评估。</small>
    <p>风速 / m·s⁻¹</p><div class="scale" :style="{background:gradient}"></div>
    <div class="ticks"><span>≤0.03</span><span>0.53</span><span>≥1.03</span></div>
    <small>颜色沿用模拟风速色标；仅降低不透明度。异工点数据为示意配准，未测真实遮挡，不作通风达标判断。</small>
    <button data-testid="flow-review-evaluate" @click="evaluate">检查当前画面</button>
    <section v-if="evaluation" data-testid="flow-review-evaluation">
      <p>{{ evaluation.status==='screen-criteria-met'?'当前屏幕采样条件满足':evaluation.status==='adjustment-available'?'可根据面板占用改善取景':'当前画面仍需人工复核' }}</p>
      <small v-if="feedback">投影采样：{{ feedback.inside }}/{{ feedback.sampled }}入镜，{{ feedback.panelCovered }}个被面板覆盖。仅测投影，不测深度遮挡。</small>
      <small>{{ evaluation.stopReason||'可执行一次取景调整，再读取反馈。' }} 剩余调整{{ evaluation.remainingAdjustments }}次。</small>
      <button v-if="evaluation.candidates.length" data-testid="flow-review-adjust" @click="adjust">改善取景并复查</button>
    </section>
    <p v-if="error" role="alert">{{ error }}</p>
  </section>
</template>
<script setup lang="ts">
import {ref,watch} from 'vue'
import {taskFlowReview,type FlowReviewMode} from '@/platform/tasks/TaskFlowReview'
import {velocityColor} from '@/views/ventilation-module/cesiumVentilation'
import {executeTool} from '@/ai-agent/ToolRegistry'
import {recordTaskEvent} from '@/platform/telemetry/TaskAuditClient'
import type {evaluateFlowReview,FlowScreenFeedback} from '@/platform/tasks/FlowReviewEvaluation'
const error=ref('')
const evaluation=ref<ReturnType<typeof evaluateFlowReview>>(),feedback=ref<FlowScreenFeedback>()
watch(taskFlowReview,()=>{evaluation.value=undefined;feedback.value=undefined})
async function evaluate(){
  try{
    const result=JSON.parse(await executeTool('evaluate_task_flow_review',{}))
    if(!result.ok)throw Error(result.reason??'画面评价失败')
    evaluation.value=result.evaluation
    const inspected=JSON.parse(await executeTool('inspect_task_flow_review',{}))
    feedback.value=inspected.feedback;error.value=''
  }catch(e){error.value=e instanceof Error?e.message:String(e)}
}
async function adjust(){
  try{
    const result=JSON.parse(await executeTool('adjust_task_flow_review',{}))
    if(!result.ok)throw Error(result.reason??'取景调整失败')
    evaluation.value=result.evaluation;feedback.value=result.after;error.value=''
    await recordTaskEvent({taskId:result.taskId,source:'panel',action:'adjust_task_flow_review',status:'completed',resultSummary:result})
  }catch(e){error.value=e instanceof Error?e.message:String(e)}
}
const gradient=`linear-gradient(to right,${Array.from({length:21},(_,i)=>velocityColor(.03+i/20).toCssColorString()).join(',')})`
async function change(mode:FlowReviewMode){
  try{
    const result=await executeTool('set_task_flow_review',{mode}),value=JSON.parse(result)
    if(!value.ok)throw Error(value.reason??result)
    error.value=''
    evaluation.value=undefined;feedback.value=undefined
    try{await recordTaskEvent({taskId:value.taskId,source:'panel',action:'set_task_flow_review',status:'completed',inputSummary:{mode},resultSummary:value})}
    catch{error.value='表达已切换，但本次操作记录未能保存。'}
  }catch(e){error.value=e instanceof Error?e.message:String(e)}
}
</script>
<style scoped>
.flow-review{margin-top:12px;padding-top:10px;border-top:1px solid #18435a;font-size:12px;line-height:1.5;color:#bddbe7}.actions{display:flex;gap:6px;margin:8px 0}button{border:1px solid #21617c;background:#0a2c40;color:#bde9fb;padding:5px 8px;cursor:pointer}button[aria-pressed=true]{border-color:#00d4ff;background:#12526c}.scale{height:8px;border-radius:3px}.ticks{display:flex;justify-content:space-between;font-size:10px}small{display:block;color:#91b4c7;margin-top:7px}p{margin:7px 0}
</style>
