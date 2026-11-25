import { readonly, shallowRef } from 'vue'
import type { ReviewWorkfaceView, TaskView } from './TaskCameraView'
import { WORKFACE_SURFACE_ID } from '@/modules/rock/native-model-resources'

const blastReview = ['rock.design-grade', 'blast.effect', 'ventilation.ceiling-jet-fan', 'ventilation.co-analysis'] as const
const geologyReview = (support: string) => ['rock.three-bench', support, 'blast.design-data', 'rock.tsp-integrity']

export const constructionReviews = {
  'geology-change': {
    title: '地质揭示后的开挖与支护变更复核',
    mileage: 'YK2+244',
    source: '杉阳隧道案例',
    sourceUrl: 'https://www.tunnelling.cn/PLibrary/PLibraryTechnicalDetail.aspx?Tech=7058',
    limit: '岩面、解释体、开挖及初支为示意装配。影响范围以现场揭示编录和正式方案为据。',
    steps: [
      { key: 'workface', label: '观察掌子面岩面', detail: '用既有纹理网格观察岩面起伏和邻近岩壁。源工点和比例尚未核验，现场揭示须另查本循环编录。', ids: [WORKFACE_SURFACE_ID], view: 'face' },
      { key: 'reveal', label: '揭示与影响范围', detail: '以 TSP 完整性解释体和三台阶开挖基准观察空间关系。从循环设计图确认待比对字段，实际影响界线和分部范围待掌子面编录划定。', ids: geologyReview('support.test-section-zz-ivb'), view: 'overview' },
      { key: 'baseline', label: '复核原支护版本', detail: '在同一开挖基准后方展示原版 ZZ-IVb 支护单元排列。三台阶保留为比对基准，待核对原施工方案和循环记录。', ids: geologyReview('support.test-section-zz-ivb'), view: 'support' },
      { key: 'candidate', label: '复核拟变更版本', detail: '在同一展示区间换装 ZZ-Va，对照初支构造。开挖差异和审批状态待核验。', ids: geologyReview('support.test-section'), view: 'support' },
    ],
  },
  'blast-handoff': {
    title: '爆后排烟与出渣交接复盘',
    mileage: 'YK4+000',
    source: '四川凉山隧道现场研究',
    sourceUrl: 'https://www.tunnelling.cn/PLibrary/PLibraryTechnicalDetail.aspx?Tech=8095',
    limit: '点云、风机和 CO 曲线为独立来源的示意参照。',
    steps: [
      { key: 'blast', label: '爆后断面', detail: '定位爆后点云，以工段设计围岩分级作空间参照。起爆时刻及本循环断面编号待施工记录确认。', ids: blastReview, view: 'blast' },
      { key: 'ventilation', label: '排烟与监测', detail: '定位洞顶射流风机，并读取已有 CO 模拟曲线。现场启风时间、实测点位和时钟配准待补，模拟时轴保持独立。', ids: blastReview, view: 'fan' },
      { key: 'handoff', label: '出渣交接', detail: '回看断面与排烟布置，交接前待关联同循环通风记录、现场检测和班组签认。出渣安排和交接状态均待确认。', ids: blastReview, view: 'overview' },
    ],
  },
} as const satisfies Record<string, {
  title: string; mileage: string; source: string; sourceUrl: string; limit: string
  steps: readonly { key: string; label: string; detail: string; ids: readonly string[]; view: TaskView }[]
}>

export type ConstructionReviewKind = keyof typeof constructionReviews
export type ReviewReferenceRole = 'workface' | 'excavation' | 'support-span' | 'blast-cloud' | 'jet-fan'
export type ConstructionReviewReference = {
  role: ReviewReferenceRole
  label: string
  start: number
  end?: number
}
type ConstructionReviewNode = { kind: ConstructionReviewKind; stepIndex: number; taskId: string }
export type ReviewSupportDisplay = 'outline' | 'assembled'
export const reviewSupportComponents = [
  { key: 'steel_arch', label: '钢架' },
  { key: 'system_anchor', label: '系统锚杆' },
  { key: 'lock_foot_anchor', label: '锁脚锚杆' },
] as const
export type ReviewSupportComponent = typeof reviewSupportComponents[number]['key']
export type ReviewSupportVersion = 'baseline' | 'candidate'
export type ReviewSupportEvidence = Partial<Record<ReviewSupportVersion, readonly string[]>>
export type ConstructionReviewSelection = ConstructionReviewNode & {
  references: readonly ConstructionReviewReference[]
  assemblyOnly?: boolean
  restoreAssemblyView?: () => void
  sceneAnnotations?: boolean
  fixedLabelLayout?: boolean
  referenceLinks?: boolean
  simulation?: { range: readonly [number, number]; unit: string }
  supportDisplay?: ReviewSupportDisplay
  supportEvidence?: ReviewSupportEvidence
  supportComponent?: ReviewSupportComponent
  supportDetailView?: boolean
  workfaceView?: ReviewWorkfaceView
}

export function reviewStationGap(references: readonly ConstructionReviewReference[]) {
  const cloud = references.find(reference => reference.role === 'blast-cloud')
  const fan = references.find(reference => reference.role === 'jet-fan')
  return cloud && fan ? Math.abs(cloud.start - fan.start) : undefined
}

export const blastHandoffEvents: readonly { label: string; required: string; reference?: ReviewReferenceRole }[] = [
  { label: '起爆', required: '起爆时刻、断面编号', reference: 'blast-cloud' },
  { label: '启风', required: '启风时刻、设备编号', reference: 'jet-fan' },
  { label: '现场采样', required: '采样时刻、测点里程与读数' },
  { label: '出渣交接', required: '签认时刻、接班记录' },
] as const

const selection = shallowRef<ConstructionReviewSelection>()
export const constructionReview = readonly(selection)
export function publishConstructionReview(value: ConstructionReviewSelection) { selection.value = value }

export function selectReviewSupportComponent(current: ConstructionReviewSelection, component?: ReviewSupportComponent) {
  const active = selection.value
  if (active?.taskId !== current.taskId || active.stepIndex !== current.stepIndex) return
  publishConstructionReview({ ...active, supportComponent: component, supportDetailView: component ? active.supportDetailView : undefined })
}

export function toggleReviewSupportDetailView(current: ConstructionReviewSelection) {
  const active = selection.value
  if (active?.taskId !== current.taskId || active.stepIndex !== current.stepIndex || !active.supportComponent) return
  publishConstructionReview({ ...active, supportDetailView: !active.supportDetailView })
}

type ConstructionReviewIntent = Pick<ConstructionReviewNode, 'kind' | 'stepIndex'> & {
  start: boolean
  experiment?: 'assemble' | 'enhance' | 'restore' | 'annotations' | 'reference-links' | 'label-layout'
  sceneAnnotations?: boolean
  fixedLabelLayout?: boolean
  referenceLinks?: boolean
  supportDisplay?: ReviewSupportDisplay
  workfaceView?: ReviewWorkfaceView
}

const nodeCommands = {
  'geology-change': [
    ['workface', /^(回看|查看|观察|切回|切到|复核)掌子面(岩面|近景)?$/],
    ['reveal', /^(回看|查看|切回|切到|复核)揭示(与影响范围)?$/],
    ['baseline', /^(回看|查看|切回|切到|复核)原支护(版本)?$/],
    ['candidate', /^(回看|查看|切到|复核)拟变更(支护)?(版本)?$/],
  ],
  'blast-handoff': [
    ['blast', /^(回看|查看|切回|切到|复核)爆后断面$/],
    ['ventilation', /^(回看|查看|切到|复核)排烟(与监测)?$/],
    ['handoff', /^(回看|查看|切到|复核)出渣交接$/],
  ],
} as const

export function resolveConstructionReviewRequest(request: string, current: ConstructionReviewNode | null | undefined = selection.value): ConstructionReviewIntent | undefined {
  const text = request.trim().replace(/^(请|帮我)\s*/, '')
  if (/^(什么|为什么|如何|怎么|有没有|能不能|解释|介绍|只给.{0,12}计划)/.test(text) || /(?:不|不要|暂不)执行[。！]?$/.test(text)) return
  const kinds = (Object.keys(constructionReviews) as ConstructionReviewKind[]).filter(kind => {
    const review = constructionReviews[kind]
    return text.includes(review.title) || (kind === 'geology-change'
      ? /地质揭示|掌子面揭示/.test(text) && /开挖/.test(text) && /支护/.test(text) && /变更|复核/.test(text)
      : /爆后|起爆后/.test(text) && /排烟/.test(text) && /出渣/.test(text) && /交接|复盘/.test(text))
  })
  if (kinds.length === 1) {
    const kind = kinds[0]!
    if (/^仅装配整段复盘[。！\s]/.test(text)) return { kind, stepIndex: 0, start: true, experiment: 'assemble' }
    if (/^仅装配复盘场景[。！\s]/.test(text)) {
      const target = kind === 'geology-change' ? 'baseline' : 'handoff'
      return { kind, stepIndex: constructionReviews[kind].steps.findIndex(step => step.key === target), start: true, experiment: 'assemble' }
    }
    return { kind, stepIndex: 0, start: true }
  }
  if (kinds.length || !current) return
  const phrase = text.replace(/[。！]$/, '')
  if (phrase === '增强当前复盘') return { kind: current.kind, stepIndex: current.stepIndex, start: false, experiment: 'enhance' }
  if (phrase === '恢复复盘装配表达') return { kind: current.kind, stepIndex: current.stepIndex, start: false, experiment: 'restore' }
  if (/^(隐藏|显示)复盘三维标注$/.test(phrase)) {
    return { kind: current.kind, stepIndex: current.stepIndex, start: false, experiment: 'annotations',
      sceneAnnotations: phrase.startsWith('显示') }
  }
  if (phrase === '固定复盘标注布局' || phrase === '启用复盘标注避让') {
    return { kind: current.kind, stepIndex: current.stepIndex, start: false, experiment: 'label-layout',
      fixedLabelLayout: phrase === '固定复盘标注布局' }
  }
  if (/^(关闭|开启)复盘里程联动$/.test(phrase)) {
    return { kind: current.kind, stepIndex: current.stepIndex, start: false, experiment: 'reference-links',
      referenceLinks: phrase.startsWith('开启') }
  }
  const steps = constructionReviews[current.kind].steps
  if (current.kind === 'geology-change') {
    if (/^(正视|斜视)掌子面$/.test(phrase)) {
      const stepIndex = steps.findIndex(step => step.key === 'workface')
      return { kind: current.kind, stepIndex, start: false, workfaceView: phrase.startsWith('正视') ? 'front' : 'oblique' }
    }
    if (/^(恢复初支锚杆显示|查看初支锚杆|显示初支锚杆)$/.test(phrase)) {
      return { kind: current.kind, stepIndex: current.stepIndex, start: false, supportDisplay: 'assembled' }
    }
    if (/^(突出初支轮廓|查看初支轮廓)$/.test(phrase)) {
      return { kind: current.kind, stepIndex: current.stepIndex, start: false, supportDisplay: 'outline' }
    }
  }
  if (/^(继续复核|下一步复核|下一步|上一项|下一项)$/.test(phrase)) {
    return { kind: current.kind, stepIndex: current.stepIndex + (phrase.startsWith('上一') ? -1 : 1), start: false }
  }
  const key = nodeCommands[current.kind].find(([, rule]) => rule.test(phrase))?.[0]
  const stepIndex = steps.findIndex(step => step.key === key)
  if (stepIndex >= 0) return { kind: current.kind, stepIndex, start: false }
}
