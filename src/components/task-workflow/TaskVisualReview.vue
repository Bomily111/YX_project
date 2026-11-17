<template>
 <details v-if="taskVisualReview" class="visual-review" data-testid="task-visual-review" open>
  <summary>任务视觉分析 · {{ labels[taskVisualReview.plan.objective] }}</summary>
  <p>{{ taskVisualReview.plan.userRequest }}</p>
  <small v-if="taskVisualReview.plan.emphasis==='material-focus'">支护暖色仅表示当前重点，不表示风险或工程分级；恢复时还原原显示颜色。</small>
  <small>重点：{{ taskVisualReview.plan.focusResourceIds.join('、') }}</small>
  <ul><li v-for="question in taskVisualReview.plan.questions" :key="question">{{ question }}</li></ul>
  <p data-testid="visual-review-phase">{{ phaseLabels[taskVisualReview.phase] }} · 剩余调整{{ taskVisualReview.remaining }}次</p>
  <p v-if="taskVisualReview.feedback" data-testid="visual-review-feedback">已记录执行前后运行快照与取景反馈；问题{{ taskVisualReview.feedback.before.issues.length }} → {{ taskVisualReview.feedback.after.issues.length }}项。问题数变化不代表工程质量改善。</p>
  <section v-if="taskVisualReview.feedback?.after.supportContext.available" data-testid="support-context-feedback">
   <p>局部采样参照投影：{{ taskVisualReview.feedback.after.supportContext.reference.insideSafe }}/{{ taskVisualReview.feedback.after.supportContext.reference.total }}处在可用区。</p>
   <small>{{ taskVisualReview.feedback.after.supportContext.nextCheck }}采样参照不等于地质特征，未测深度遮挡。</small>
  </section>
  <small>候选：{{ taskVisualReview.plan.candidate?.view ?? '只读核查，无视角动作' }}。待回答问题不是已证实结论；未测深度遮挡，不代表工程验收。</small>
 </details>
</template>
<script setup lang="ts">
import {taskVisualReview} from '@/platform/tasks/TaskVisualReview'
const labels={'spatial-relation':'空间关系','component-detail':'构件细部','source-review':'来源核查'}
const phaseLabels={planned:'已规划，未执行',applied:'视角已应用',restored:'已恢复分析前视角',failed:'执行失败，已恢复本次操作前视角'}
</script>
<style scoped>
.visual-review{border-top:1px solid #21546b;padding-top:10px;margin-top:10px;color:#a9c8d8;font-size:12px;line-height:1.5}.visual-review summary{cursor:pointer;color:#6ce4f6}.visual-review p{margin:6px 0}.visual-review ul{padding-left:17px}
</style>
