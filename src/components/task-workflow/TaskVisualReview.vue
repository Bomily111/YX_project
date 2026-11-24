<template>
 <details v-if="taskVisualReview" class="visual-review" data-testid="task-visual-review" :open="manualControls">
  <summary>{{ labels[taskVisualReview.plan.objective] }} · {{ phaseLabels[taskVisualReview.phase] }}</summary>
  <p data-testid="visual-review-phase">{{ taskVisualReview.phase==='failed'?(taskVisualReview.recoveryStatus==='restored'?'执行失败，已恢复本次操作前视角':'执行失败，恢复未完成，请核查实际显示'):phaseLabels[taskVisualReview.phase] }} · 剩余调整{{ taskVisualReview.remaining }}次</p>
  <small v-if="taskVisualReview.remaining===0" data-testid="visual-review-budget-exhausted">本场景两次增强已用尽。<template v-if="taskVisualReview.canRestore">可让智能体恢复原显示。</template></small>
  <small v-if="taskVisualReview.plan.emphasis==='material-focus'">暖色作用于当前支护模型的可见部分，仅表示重点，不表示风险或工程分级；恢复时还原原显示颜色。</small>
  <small>重点：{{ taskVisualReview.plan.focusResourceIds.map(id=>props.resourceLabels?.[id]??id).join('、') }}</small>
  <small v-if="taskVisualReview.plan.focusComponent">重点构件为{{ supportComponentLabel(taskVisualReview.plan.focusComponent) }}。{{ taskVisualReview.plan.objective==='component-detail'?'细部取景暂避其他构件组。':'整体取景暂避混凝土外壳。' }}</small>
  <small v-if="componentSourceStatuses.includes('PARTIAL')" data-testid="component-source-partial">源示例标记为PARTIAL（部分完整），模型就绪和构件入镜不代表资料完整或通过本工段工程核验。</small>
  <ul data-testid="visual-review-questions"><li v-for="question in taskVisualReview.plan.questions" :key="question">{{ question }}</li></ul>
  <details><summary>本次任务原话</summary><p>{{ taskVisualReview.plan.userRequest }}</p></details>
  <details v-if="componentFeedback" data-testid="component-review-basis">
   <summary>{{ supportComponentLabel(componentFeedback.component) }} · 示例装配依据</summary>
   <small v-if="componentSourceStatuses.length">源示例状态：{{ componentSourceStatuses.join('、') }}。仅转述源记录状态，不是本工段验收结论。</small>
   <small>构件几何范围：{{ componentFeedback.generatedGeometryAvailable ? '已从生成几何提取，可用于细部取景' : '未提供独立范围，细部按支护整体取景' }}。不是可见像素或工程边界测量。</small>
   <p>示例基准间距：{{ componentFeedback.sourceAssembly.spacingM.length ? componentFeedback.sourceAssembly.spacingM.map(formatRecord).join('、')+'m' : '未返回' }}；装配基准数量：{{ componentFeedback.sourceAssembly.baseStationCount ?? '未返回' }}。</p>
   <p>相对首末基准：{{ componentFeedback.sourceAssembly.offsetRangeM ? componentFeedback.sourceAssembly.offsetRangeM.map(formatRecord).join(' 至 ')+'m' : '未返回' }}；来源段号：{{ componentFeedback.sourceAssembly.sourceSegments.join('、') || '未返回' }}。</p>
   <small>仅为本次快照对应的源示例装配记录；基准数不是构件数量，不能替代本工段设计或实测，也不能从独立单元数推断配筋间距。</small>
  </details>
  <p v-if="componentFeedback?.framing.available" data-testid="component-framing-feedback">本次快照 · {{ supportComponentLabel(componentFeedback.component) }}范围取景：{{ componentFeedback.framing.insideSafe }}/26采样位于可用区。仅为生成范围投影，不代表可辨认或无遮挡；整体资源取景单独核查。</p>
  <p v-if="taskVisualReview.feedback" data-testid="visual-review-feedback">已记录执行前后运行快照与取景反馈；问题{{ taskVisualReview.feedback.before.issues.length }} → {{ taskVisualReview.feedback.after.issues.length }}项。问题数变化不代表工程质量改善。</p>
  <p v-if="taskVisualReview.phase==='restored'" data-testid="visual-review-restored">以下为恢复后快照；执行前后记录仅保留作历史对照。</p>
  <section v-if="context?.available" data-testid="support-context-feedback">
   <p>{{ taskVisualReview.phase==='restored'?'恢复后快照 · ': '执行后快照 · ' }}局部采样参照投影：{{ context.reference.insideSafe }}/{{ context.reference.total }}处在可用区。</p>
   <small>{{ context.nextCheck }}采样参照不等于地质特征，未测深度遮挡。</small>
  </section>
  <small>{{ taskVisualReview.phase==='restored'?'原计划策略（已撤销）':'本次计划策略' }}：{{ taskVisualReview.plan.candidate ? viewLabels[taskVisualReview.plan.candidate.view] : '只读来源核查' }}。待回答问题不是已证实结论；未测深度遮挡，不代表工程验收。</small>
 </details>
</template>
<script setup lang="ts">
import {taskVisualReview} from '@/platform/tasks/TaskVisualReview'
import {computed} from 'vue'
import {supportComponentLabel} from '@/modules/support/component-labels'
const props=defineProps<{resourceLabels?:Record<string,string>;manualControls?:boolean}>()
const context=computed(()=>{const r=taskVisualReview.value;return (r?.phase==='restored'?r.restoredFeedback:r?.phase==='applied'?r.feedback?.after:undefined)?.supportContext})
const componentResource=computed(()=>{const r=taskVisualReview.value;if(!r?.plan.focusComponent)return undefined;const snapshot=r.phase==='restored'?r.restoredFeedback:r.phase==='applied'?r.feedback?.after:r.phase==='planned'?r.plan.evidence:undefined;return snapshot?.resources.find(resource=>resource.id===r.plan.focusResourceIds[0])})
const componentFeedback=computed(()=>componentResource.value?.componentDisplay?.find(component=>component.component===taskVisualReview.value?.plan.focusComponent))
const componentSourceStatuses=computed(()=>[...new Set<string>(componentResource.value?.sourceHints.map(hint=>hint.sourceStatus).filter((status):status is string=>typeof status==='string')??[])])
const formatRecord=(value:number)=>Number(value.toFixed(4)).toString()
const labels={'spatial-relation':'空间关系','component-detail':'构件细部','source-review':'来源核查'}
const phaseLabels={planned:'已规划，未执行',applied:'增强已应用',restored:'已恢复分析前显示与视角',failed:'执行失败'}
const viewLabels={geographic:'中线与地形',overview:'整体空间参照','support-context':'支护与邻近围岩局部观察',face:'掌子面近景',support:'支护细部',excavation:'开挖阶段近景',drill:'水平钻布置',blast:'爆破断面'}
</script>
<style scoped>
.visual-review{border-top:1px solid #21546b;padding-top:10px;margin-top:10px;color:#a9c8d8;font-size:12px;line-height:1.5}.visual-review summary{cursor:pointer;color:#6ce4f6}.visual-review p{margin:6px 0}.visual-review ul{padding-left:17px}
</style>
