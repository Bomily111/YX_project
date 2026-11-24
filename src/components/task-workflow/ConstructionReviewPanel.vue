<template>
  <section class="review" :data-stage="step.key" data-testid="construction-review">
    <h3>{{ review.title }}</h3>
    <dl class="references" aria-label="展示里程">
      <div v-for="reference in selection.references" :key="reference.role" data-testid="construction-reference">
        <dt>{{ reference.label }}</dt>
        <dd>
          <button v-if="selectableRoles.has(reference.role)" :disabled="!referenceLinksActive"
            type="button" :aria-pressed="selectedRole === reference.role"
            :aria-label="`定位${reference.label} ${formatReviewReference(reference)}`" @click="selectReferenceInPanel(reference.role)">
            {{ formatReviewReference(reference) }}
          </button>
          <template v-else>{{ formatReviewReference(reference) }}</template>
        </dd>
      </div>
    </dl>
    <p v-if="locateIssue" class="locate-issue" role="status">{{ locateIssue }}</p>
    <p v-if="step.key === 'handoff' && stationGap !== undefined" class="station-gap" data-testid="review-station-gap">
      展示里程相差 {{ stationGap }} m
    </p>
    <div v-if="selection.kind === 'geology-change'" class="evidence">
      <p v-if="step.key === 'reveal'">二维循环设计图为异源参照。</p>
      <template v-else-if="step.key === 'workface'">
        <p>历史岩面网格 · YK 里程为展示站位</p>
        <p data-testid="review-workface-view" :data-view="selection.workfaceView">
          {{ selection.workfaceView === 'front' ? '正视纹理 · 可输入“斜视掌子面”' : '斜视起伏 · 可输入“正视掌子面”' }}
        </p>
      </template>
      <template v-else-if="selection.supportDisplay">
        <p class="focus-key"><span></span>暖色标记当前初支</p>
        <p data-testid="review-support-display" :data-display="selection.supportDisplay">
          {{ selection.supportDisplay === 'outline' ? '轮廓对照 · 锚杆暂收起。输入“查看初支锚杆”复原。' : '锚杆沿用原显示。输入“突出初支轮廓”切回。' }}
        </p>
      </template>
      <p>现场循环、影响区间及两版方案编号待登记。</p>
    </div>
    <div v-else class="evidence">
      <p>现场循环编号待登记</p>
      <dl v-if="step.key === 'handoff'" class="events" aria-label="同循环现场事件">
        <div v-for="event in blastHandoffEvents" :key="event.label" :class="{ 'related-event': event.reference === selectedRole }">
          <dt>{{ event.label }}</dt><dd>待补{{ event.required }}</dd>
        </div>
      </dl>
      <p v-if="selection.simulation && step.key !== 'blast'" data-testid="construction-simulation">CO 模拟相对时间 · {{ selection.simulation.range.join('–') }} {{ selection.simulation.unit.replace(/^时间\s*\/\s*/, '') }}</p>
    </div>
    <ol aria-label="复核流程">
      <li v-for="(item, index) in review.steps" :key="item.key" :aria-current="index === selection.stepIndex ? 'step' : undefined">
        <span>{{ item.label }}</span>
        <p v-if="index === selection.stepIndex" data-testid="construction-review-finding">{{ item.detail }}</p>
      </li>
    </ol>
    <table v-if="selection.supportDisplay && selection.supportEvidence" class="support-compare" data-testid="review-support-evidence">
      <caption>原始模型构件分组</caption>
      <thead><tr><th scope="col">构件</th><th scope="col">ZZ-IVb</th><th scope="col">ZZ-Va</th></tr></thead>
      <tbody>
        <tr v-for="component in reviewSupportComponents" :key="component.key">
          <th scope="row">{{ component.label }}</th>
          <td v-for="version in versions" :key="version" :data-version="version" :class="{ current: step.key === version }">
            <button v-if="step.key === version && selection.supportEvidence[version]?.includes(component.key)"
              type="button" :aria-pressed="selection.supportComponent === component.key && !componentIssue"
              :aria-label="`显露${component.label}`" @click="toggleSupportComponent(component.key)">有分组</button>
            <template v-else>{{ componentEvidence(version, component.key) }}</template>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="componentStatus" class="component-status" role="status" data-testid="review-component-status">
      {{ componentStatus }}
      <button type="button" :aria-pressed="!!selection.supportDetailView" @click="toggleReviewSupportDetailView(selection)">
        {{ selection.supportDetailView ? '返回整体' : '布置侧视' }}
      </button>
      <button v-if="componentUnavailable" type="button" @click="selectReviewSupportComponent(selection)">清除对照</button>
    </p>
    <p class="boundary"><a :href="review.sourceUrl" target="_blank" rel="noopener noreferrer">工序参考 · {{ review.source }}</a><br>{{ review.limit }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { blastHandoffEvents, constructionReviews, reviewStationGap, reviewSupportComponents, selectReviewSupportComponent, toggleReviewSupportDetailView, type ConstructionReviewSelection, type ReviewReferenceRole, type ReviewSupportComponent, type ReviewSupportVersion } from '@/platform/tasks/ConstructionReview'
import { formatReviewReference, installConstructionReviewPresentation } from '@/platform/tasks/ConstructionReviewScene'
import { viewerService } from '@/platform/viewer/ViewerService'

const props = defineProps<{ selection: ConstructionReviewSelection }>()
const review = computed(() => constructionReviews[props.selection.kind])
const step = computed(() => review.value.steps[props.selection.stepIndex]!)
const versions = ['baseline', 'candidate'] as const
const stationGap = computed(() => reviewStationGap(props.selection.references))
function componentEvidence(version: ReviewSupportVersion, component: string) {
  const components = props.selection.supportEvidence?.[version]
  return !components ? '待复核' : components.includes(component) ? '有分组' : '未见分组'
}
let presentation: ReturnType<typeof installConstructionReviewPresentation> | undefined
const selectableRoles = shallowRef<ReadonlySet<ReviewReferenceRole>>(new Set())
const selectedRole = ref<ReviewReferenceRole | null>(null)
const locateIssue = ref('')
const componentIssue = ref('')
const referenceLinksActive = computed(() => props.selection.sceneAnnotations !== false && props.selection.referenceLinks !== false)
const componentLabel = computed(() => reviewSupportComponents.find(component => component.key === props.selection.supportComponent)?.label)
const componentUnavailable = computed(() => {
  const version = step.value.key
  const component = props.selection.supportComponent
  return !!component && (version === 'baseline' || version === 'candidate') &&
    props.selection.supportEvidence?.[version]?.includes(component) === false
})
const componentStatus = computed(() => componentIssue.value || (componentLabel.value && (componentUnavailable.value
  ? `当前示例模型未见${componentLabel.value}分组，显示整体初支。`
  : `正在查看${componentLabel.value}。再次点击该分组可恢复。`)))
function toggleSupportComponent(key: ReviewSupportComponent) {
  if (presentation) selectReviewSupportComponent(props.selection, props.selection.supportComponent === key ? undefined : key)
}
function applySupportComponent() {
  componentIssue.value = ''
  try {
    presentation?.showSupportComponent(componentUnavailable.value ? null : props.selection.supportComponent ?? null)
  } catch {
    componentIssue.value = '当前初支构件无法显露。'
  }
}
function toggleReference(role: ReviewReferenceRole) {
  locateIssue.value = ''
  selectedRole.value = selectedRole.value === role ? null : role
  presentation?.setReferenceFocus(selectedRole.value)
}
function selectReferenceInPanel(role: ReviewReferenceRole) {
  toggleReference(role)
  if (selectedRole.value) {
    try { presentation?.ensureReferenceInView(role, props.selection) }
    catch { locateIssue.value = '未能恢复当前复盘视角。' }
  }
}
watch([() => props.selection.taskId, () => props.selection.stepIndex, () => props.selection.supportDisplay], ([task, step], [previousTask, previousStep], onCleanup) => {
  if (task !== previousTask || step !== previousStep) {
    selectedRole.value = null
    locateIssue.value = ''
  }
  const viewer = viewerService.current
  if (!viewer || viewer.isDestroyed()) return
  const installed = installConstructionReviewPresentation(viewer, props.selection, toggleReference)
  presentation = installed
  selectableRoles.value = installed.selectableRoles
  installed.setReferenceFocus(selectedRole.value)
  applySupportComponent()
  onCleanup(() => {
    presentation = undefined
    selectableRoles.value = new Set()
    installed.dispose()
  })
}, { immediate: true })
watch(() => props.selection.supportComponent, applySupportComponent)
watch(() => props.selection.sceneAnnotations, visible => presentation?.setAnnotations(visible !== false))
watch(referenceLinksActive, active => {
  if (!active) {
    selectedRole.value = null
    locateIssue.value = ''
  }
  presentation?.setReferenceLinksActive(active)
})
</script>

<style scoped>
.review { color: #e1edf4; }
.review p { font-size: 12px; line-height: 1.5; }
h3 { margin: 0 0 6px; font-size: 15px; line-height: 1.45; }
.references, .events { margin: 8px 0; font-size: 12px; line-height: 1.5; }
.references div, .events div { display: flex; justify-content: space-between; gap: 8px; padding: 2px 0; }
.references div { flex-wrap: wrap; align-items: center; row-gap: 2px; }
.references dt { color: #8de6ec; white-space: nowrap; }
.references dd { margin-left: auto; font-variant-numeric: tabular-nums; }
.references button { color: #c8efff; background: #173447; border: 1px solid #33596d; padding: 2px 6px; border-radius: 4px; font: inherit; white-space: nowrap; cursor: pointer; }
.references button:disabled { cursor: default; }
.references button:enabled:hover, .references button:focus-visible { border-color: #8de6ec; }
.references button[aria-pressed="true"] { color: #f2fcff; background: #105574; border-color: #9be2ff; }
.events .related-event { background: #105574; color: #f2fcff; }
.review .locate-issue { color: #f0ca9d; margin: 4px 0; }
.events dt { flex-shrink: 0; }
dd { margin: 0; text-align: right; }
.evidence { margin: 8px 0; color: #f0ca9d; font-size: 12px; }
.evidence p { margin: 4px 0; }
.focus-key span { display: inline-block; width: 8px; height: 8px; margin-right: 5px; border-radius: 2px; background: #ffdc9a; }
.review .station-gap { color: #8de6ec; margin: 4px 0; }
.support-compare { width: 100%; border-collapse: collapse; font-size: 11px; text-align: left; }
.support-compare caption { color: #8de6ec; text-align: left; padding: 0 0 6px; }
.support-compare th, .support-compare td { padding: 4px 5px; border-bottom: 1px solid #254055; font-weight: 400; }
.support-compare thead th { font-weight: 600; color: #b7d7e8; background: #112a3d; }
.support-compare .current { background: #1a3040; color: #ffdc9a; }
.support-compare button, .component-status button { color: inherit; background: #173447; border: 1px solid #33596d; border-radius: 4px; padding: 1px 4px; font: inherit; white-space: nowrap; cursor: pointer; }
.support-compare button[aria-pressed="true"] { background: #105574; border-color: #9be2ff; }
.review .component-status { color: #f0ca9d; }
ol { list-style: none; margin: 10px 0; padding: 0 0 0 11px; border-left: 1px solid #31516b; }
li { position: relative; margin: 0 0 8px; color: #9ab3c4; font-size: 13px; }
li:last-child { margin-bottom: 0; }
li::before { content: ''; position: absolute; left: -15px; top: 6px; width: 7px; height: 7px; border-radius: 50%; background: #668298; }
li[aria-current] { color: #e0faff; font-weight: 600; }
li[aria-current]::before { background: #54d6f2; box-shadow: 0 0 9px #54d6f277; }
li p { margin: 5px 0 0; font-weight: 400; }
.review .boundary { border-top: 1px solid #31516b; padding-top: 10px; color: #f0ca9d; }
a { color: #8dddff; font-size: 12px; }
</style>
