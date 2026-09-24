<template>
  <section class="rock-workspace-footer" :class="`mode-${displayMode}`" :aria-label="`${context.title}底部信息栏`">
    <header class="rwf-header">
      <div class="rwf-title">
        <i></i>
        <div>
          <strong>{{ context.title }}</strong>
          <span>{{ context.subtitle }}</span>
        </div>
      </div>
      <div class="rwf-badges">
        <span v-for="badge in context.badges" :key="badge" class="rwf-badge">{{ badge }}</span>
        <span class="rwf-live"><i></i>数据已同步</span>
      </div>
    </header>

    <div v-if="displayMode === 'grade'" class="rwf-grade-body">
      <div class="rwf-row-labels" aria-hidden="true">
        <span><i class="design"></i>设计</span>
        <span><i class="forecast"></i>预测</span>
        <span><i class="observed"></i>揭露</span>
      </div>
      <div class="rwf-grade-tracks">
        <div class="rwf-face-line"><span>掌子面</span></div>
        <div class="rwf-track">
          <div v-for="segment in designSegments" :key="`d-${segment.start}-${segment.end}`" class="rwf-grade-segment" :style="segmentStyle(segment)">
            <span>{{ gradeLabel(segment.grade) }}</span>
          </div>
        </div>
        <div class="rwf-track">
          <div v-for="segment in predictionSegments" :key="`p-${segment.start}-${segment.end}`" class="rwf-grade-segment" :class="{ unknown: !segment.grade }" :style="segmentStyle(segment)">
            <span>{{ segment.grade ? gradeLabel(segment.grade) : '待判定' }}</span>
          </div>
        </div>
        <div class="rwf-track rwf-track--pending"><span>随开挖进度持续回填实测分级</span></div>
        <div class="rwf-axis">
          <span v-for="tick in ticks" :key="tick.label" :style="{ left: `${tick.percent}%` }"><i></i>{{ tick.label }}</span>
        </div>
      </div>
    </div>

    <div v-else-if="displayMode === 'baseline'" class="rwf-baseline">
      <div class="rwf-baseline-legend">
        <div class="rwf-block-title"><span>设计成果图例</span><small>当前版本 V2.4</small></div>
        <span><i class="survey"></i>勘察控制</span>
        <span><i class="geology"></i>地质分区</span>
        <span><i class="support"></i>支护参数</span>
        <span><i class="approved"></i>已复核成果</span>
      </div>
      <div class="rwf-design-axis">
        <div class="rwf-design-axis-line"></div>
        <div v-for="(step, index) in designAxisSteps" :key="step.title" class="rwf-design-step" :class="step.tone">
          <i><b>{{ index + 1 }}</b></i>
          <span>{{ step.title }}</span>
          <strong>{{ step.value }}</strong>
          <small>{{ step.note }}</small>
        </div>
      </div>
      <div class="rwf-design-scale">
        <div class="rwf-scale-marker" style="left: 34%"><span>当前里程</span><b>YK2+244</b></div>
        <span>资料输入</span><span>地质判定</span><span>参数设计</span><span>成果复核</span>
      </div>
    </div>

    <div v-else-if="displayMode === 'correction'" class="rwf-correction">
      <div class="rwf-correction-legend">
        <span><i class="design"></i>设计</span><span><i class="forecast"></i>预测</span><span><i class="observed"></i>揭露</span>
        <small>颜色越暖表示与设计偏差越大</small>
      </div>
      <div class="rwf-correction-tracks">
        <div class="rwf-c-track"><label>设计</label><span class="stable" style="width:32%">Ⅲ级</span><span class="attention" style="width:39%">Ⅳ级</span><span class="risk" style="width:29%">Ⅴ级</span></div>
        <div class="rwf-c-track"><label>预测</label><span class="stable" style="width:28%">Ⅲ级</span><span class="attention" style="width:45%">Ⅳ级</span><span class="risk" style="width:27%">Ⅴ级</span></div>
        <div class="rwf-c-track"><label>揭露</label><span class="revealed" style="width:24%">已揭露</span><span class="current" style="width:16%">本循环</span><span class="pending" style="width:60%">待开挖校正</span></div>
        <i class="rwf-cursor" style="left:40%"><b>YK2+258</b></i>
        <div class="rwf-c-axis"><span>YK2+244</span><span>YK2+269</span><span>YK2+294</span><span>YK2+319</span><span>YK2+344</span></div>
      </div>
      <div class="rwf-correction-note">
        <strong>本循环修正</strong><span>异常边界前移 <b>6 m</b></span><span>置信度提升 <b>6%</b></span>
      </div>
    </div>

    <div v-else-if="displayMode === 'monitoring'" class="rwf-monitoring">
      <div class="rwf-monitor-cards">
        <div v-for="metric in context.metrics" :key="metric.label" :class="metric.tone">
          <span>{{ metric.label }}</span><strong>{{ metric.value }}<small>{{ metric.unit }}</small></strong><em>{{ metric.note }}</em>
        </div>
      </div>
      <div class="rwf-trend-chart">
        <div class="rwf-block-title"><span>近 24 h 变形趋势</span><small>单位：mm</small></div>
        <svg viewBox="0 0 420 72" preserveAspectRatio="none" aria-label="拱顶沉降与周边收敛趋势">
          <path class="grid" d="M0 18H420M0 36H420M0 54H420"></path>
          <path class="area" d="M0 58 L55 56 L110 53 L165 49 L220 47 L275 43 L330 41 L380 37 L420 35 L420 72 L0 72 Z"></path>
          <path class="settlement" d="M0 58 L55 56 L110 53 L165 49 L220 47 L275 43 L330 41 L380 37 L420 35"></path>
          <path class="convergence" d="M0 62 L55 61 L110 58 L165 57 L220 53 L275 51 L330 48 L380 46 L420 43"></path>
        </svg>
        <div class="rwf-trend-axis"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>当前</span></div>
        <div class="rwf-trend-legend"><span><i class="cyan"></i>拱顶沉降</span><span><i class="green"></i>周边收敛</span></div>
      </div>
      <div class="rwf-alert-queue">
        <div class="rwf-block-title"><span>预警队列</span><small>1 条待跟踪</small></div>
        <div class="rwf-alert-item"><i></i><div><b>周边收敛速率上升</b><span>12:40 · 黄色预警</span></div><em>已处置</em></div>
        <div class="rwf-alert-empty"><i></i>当前无新增红色预警</div>
      </div>
    </div>

    <div v-else-if="displayMode === 'face'" class="rwf-face-zones">
      <div class="rwf-face-legend">
        <strong>掌子面分区图例</strong>
        <span><i class="complete"></i>完整</span><span><i class="jointed"></i>节理发育</span><span><i class="broken"></i>局部破碎</span><span><i class="water"></i>渗水</span>
      </div>
      <div class="rwf-face-profile">
        <div class="rwf-face-arch">
          <span class="zone left"><b>左边墙</b><small>较完整</small></span>
          <span class="zone crown"><b>拱顶</b><small>破碎 · 滴水</small></span>
          <span class="zone right"><b>右边墙</b><small>节理发育</small></span>
          <span class="zone floor"><b>底板</b><small>完整</small></span>
        </div>
        <div class="rwf-face-baseline"><span>左拱脚</span><span>中线</span><span>右拱脚</span></div>
      </div>
      <div class="rwf-face-note"><span>里程</span><b>YK2+258.0</b><span>主要岩性</span><b>弱风化花岗岩</b></div>
    </div>

    <div v-else class="rwf-dashboard">
      <div class="rwf-metrics">
        <div v-for="metric in context.metrics" :key="metric.label" class="rwf-metric" :class="metric.tone">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}<small>{{ metric.unit }}</small></strong>
          <em>{{ metric.note }}</em>
        </div>
      </div>
      <div class="rwf-profile">
        <div class="rwf-profile-head">
          <span>{{ context.profileTitle }}</span>
          <small>{{ context.range }}</small>
        </div>
        <div class="rwf-profile-track">
          <span v-for="(band, index) in context.bands" :key="`${band.label}-${index}`" :style="{ width: `${band.width}%`, '--band': band.color }">
            <b>{{ band.label }}</b><small>{{ band.note }}</small>
          </span>
          <i class="rwf-current"><b>当前掌子面</b></i>
        </div>
        <div class="rwf-profile-axis"><span>YK2+244</span><span>YK2+269</span><span>YK2+294</span><span>YK2+319</span><span>YK2+344</span></div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

type RockStage = 'baseline' | 'prediction' | 'correction'
type DirectoryNode = RockStage | 'monitoring'
type Metric = { label: string; value: string; unit?: string; note: string; tone?: 'cyan' | 'green' | 'amber' | 'red' }
type Band = { label: string; note: string; width: number; color: string }
type FooterContext = {
  title: string
  subtitle: string
  badges: string[]
  metrics: Metric[]
  profileTitle: string
  range: string
  bands: Band[]
}
type GradeSegment = { start: number; end: number; grade: string | null }

const props = defineProps<{
  stage: RockStage
  directoryNode: DirectoryNode
  activeKey?: string
}>()

const contexts: Record<string, FooterContext> = {
  baseline: {
    title: '设计基准 · 工程地质设计总览', subtitle: '勘察资料、地质条件与支护设计统一关联', badges: ['设计版 V2.4', '资料已复核'],
    metrics: [
      { label: '主要岩性', value: '花岗岩', note: '弱—微风化', tone: 'cyan' },
      { label: '设计等级', value: 'Ⅳ', unit: '级', note: '当前里程区段', tone: 'amber' },
      { label: '设计支护', value: 'S4b', note: '复合式衬砌', tone: 'green' },
      { label: '基准区段', value: '17', unit: '段', note: '全线设计成果', tone: 'cyan' },
    ],
    profileTitle: '设计资料与工程措施分区', range: '当前设计里程 YK2+244 — YK2+344',
    bands: [
      { label: '勘察控制段', note: '钻孔 / 物探', width: 24, color: '#438eb5' },
      { label: '岩性变化段', note: '弱风化花岗岩', width: 28, color: '#49a89b' },
      { label: '构造影响段', note: '节理较发育', width: 22, color: '#c29a45' },
      { label: '支护衔接段', note: 'S4b 参数', width: 26, color: '#796eb5' },
    ],
  },
  prediction: {
    title: '超前预测 · 多源地质状态', subtitle: 'TSP、TEM 与钻探成果沿同一里程轴融合展示', badges: ['预测范围 100 m', '最近更新 14:32'],
    metrics: [
      { label: '综合风险', value: '中等', note: '较上一循环稳定', tone: 'amber' },
      { label: '完整性指数', value: '0.62', note: '较完整', tone: 'green' },
      { label: '低阻异常', value: '2', unit: '处', note: '前方 35–62 m', tone: 'cyan' },
      { label: '可信度', value: '86', unit: '%', note: '三源数据融合', tone: 'green' },
    ],
    profileTitle: '前方地质综合剖面', range: 'YK2+244 — YK2+344',
    bands: [
      { label: '稳定段', note: '完整', width: 25, color: '#2bbd8c' },
      { label: '渐变段', note: '较破碎', width: 28, color: '#d5b23d' },
      { label: '异常段', note: '富水风险', width: 22, color: '#26aee8' },
      { label: '稳定段', note: '较完整', width: 25, color: '#3b92bb' },
    ],
  },
  correction: {
    title: '揭露校正 · 实测反馈', subtitle: '掌子面揭露、素描与设计预测差异同步归档', badges: ['本循环 3.5 m', '待复核 1 项'],
    metrics: [
      { label: '实测等级', value: 'Ⅳ', unit: '级', note: '与预测一致', tone: 'amber' },
      { label: '节理组数', value: '3', unit: '组', note: '局部较发育', tone: 'cyan' },
      { label: '渗水状态', value: '滴水', note: '未触发预警', tone: 'green' },
      { label: '模型修正量', value: '+6', unit: '%', note: '置信度提升', tone: 'green' },
    ],
    profileTitle: '设计—预测—揭露差异带', range: '最近 4 个开挖循环',
    bands: [
      { label: '已校正', note: 'YK2+244', width: 23, color: '#2bbd8c' },
      { label: '已校正', note: 'YK2+251', width: 25, color: '#36a9cf' },
      { label: '本循环', note: 'YK2+258', width: 27, color: '#d5b23d' },
      { label: '待揭露', note: '前方', width: 25, color: '#526b7a' },
    ],
  },
  monitoring: {
    title: '监测预警 · 围岩响应', subtitle: '变形、应力与地下水实时监测', badges: ['在线测点 48/50', '无红色预警'],
    metrics: [
      { label: '拱顶沉降', value: '3.8', unit: 'mm', note: '24 h +0.3 mm', tone: 'green' },
      { label: '周边收敛', value: '5.2', unit: 'mm', note: '变化率平稳', tone: 'green' },
      { label: '围岩压力', value: '0.18', unit: 'MPa', note: '阈值 0.30 MPa', tone: 'cyan' },
      { label: '预警事件', value: '1', unit: '条', note: '黄色 · 已处置', tone: 'amber' },
    ],
    profileTitle: '近 24 小时稳定性趋势', range: '每 2 小时自动更新',
    bands: [
      { label: '稳定', note: '00:00–06:00', width: 25, color: '#2bbd8c' },
      { label: '稳定', note: '06:00–12:00', width: 25, color: '#32aebc' },
      { label: '关注', note: '12:00–18:00', width: 25, color: '#d5b23d' },
      { label: '已恢复', note: '18:00–当前', width: 25, color: '#2bbd8c' },
    ],
  },
  tsp: {
    title: 'TSP 反演 · 波速与异常响应', subtitle: 'P 波、S 波及波速比沿隧洞轴向解释', badges: ['探测距离 100 m', '有效道 24/24'],
    metrics: [
      { label: 'P 波速度', value: '4.72', unit: 'km/s', note: '中硬岩区间', tone: 'cyan' },
      { label: 'S 波速度', value: '2.46', unit: 'km/s', note: '变化平缓', tone: 'green' },
      { label: '完整性指数', value: '0.62', note: '较完整', tone: 'green' },
      { label: '显著反射面', value: '2', unit: '处', note: '前方 38 / 64 m', tone: 'amber' },
    ],
    profileTitle: 'TSP 轴向异常剖面', range: '掌子面前方 0–100 m',
    bands: [
      { label: '高波速', note: '完整', width: 28, color: '#3b82c4' },
      { label: '降速', note: '反射增强', width: 20, color: '#d5b23d' },
      { label: '异常', note: '破碎倾向', width: 22, color: '#dd6b45' },
      { label: '恢复', note: '较完整', width: 30, color: '#32a67b' },
    ],
  },
  tem: {
    title: '瞬变电磁 · 电阻率与富水异常', subtitle: '低阻体空间响应与风险区间', badges: ['探测距离 80 m', '反演完成'],
    metrics: [
      { label: '平均电阻率', value: '126', unit: 'Ω·m', note: '背景场稳定', tone: 'cyan' },
      { label: '最低电阻率', value: '38', unit: 'Ω·m', note: '前方 42 m', tone: 'amber' },
      { label: '富水异常', value: '2', unit: '处', note: '1 处需关注', tone: 'amber' },
      { label: '反演残差', value: '4.6', unit: '%', note: '结果可信', tone: 'green' },
    ],
    profileTitle: '视电阻率轴向剖面', range: '掌子面前方 0–80 m',
    bands: [
      { label: '中高阻', note: '> 120 Ω·m', width: 30, color: '#73c95b' },
      { label: '低阻异常', note: '38–65 Ω·m', width: 24, color: '#26aee8' },
      { label: '过渡区', note: '65–110 Ω·m', width: 21, color: '#d5b23d' },
      { label: '背景区', note: '> 110 Ω·m', width: 25, color: '#4bb66e' },
    ],
  },
  face_sketch: {
    title: '掌子面素描 · 揭露特征', subtitle: '地质照片、结构面与渗水特征关联', badges: ['YK2+258.0', '采集完整'],
    metrics: [
      { label: '岩性', value: '花岗岩', note: '弱风化', tone: 'cyan' },
      { label: '完整程度', value: '较完整', note: '局部破碎', tone: 'green' },
      { label: '主要产状', value: '68°', note: '倾角', tone: 'cyan' },
      { label: '地下水', value: '滴水', note: '拱顶局部', tone: 'amber' },
    ],
    profileTitle: '掌子面特征分区', range: '拱部 — 边墙 — 仰拱',
    bands: [
      { label: '左边墙', note: '较完整', width: 26, color: '#3b92bb' },
      { label: '拱顶', note: '局部破碎', width: 24, color: '#d5b23d' },
      { label: '右边墙', note: '节理发育', width: 25, color: '#be7844' },
      { label: '底板', note: '完整', width: 25, color: '#2bbd8c' },
    ],
  },
}

const designAxisSteps = [
  { title: '勘察输入', value: '12 份资料', note: '钻孔、物探、测绘', tone: 'survey' },
  { title: '地质判定', value: '花岗岩', note: '弱风化 · 较完整', tone: 'geology' },
  { title: '参数设计', value: 'Ⅳ级 / S4b', note: '台阶法 · 3.5 m', tone: 'support' },
  { title: '成果复核', value: '已通过', note: '版本 V2.4', tone: 'approved' },
]

const fallbackKeys: Record<string, string> = {
  geophysical_grade: 'baseline', tsp_hardness: 'tsp', tsp_integrity: 'tsp',
  gpr: 'prediction', horiz_drill: 'prediction', deep_hole: 'prediction',
  weak_rock: 'prediction', high_stress: 'prediction', water_zone: 'tem', fracture_zone: 'prediction',
}

const displayMode = computed(() => {
  if (props.activeKey === 'geophysical_grade') return 'grade'
  if (props.directoryNode === 'monitoring') return 'monitoring'
  if (props.activeKey === 'face_sketch') return 'face'
  if (!props.activeKey && props.stage === 'baseline') return 'baseline'
  if (!props.activeKey && props.stage === 'correction') return 'correction'
  return 'dashboard'
})
const context = computed(() => {
  if (props.directoryNode === 'monitoring') return contexts.monitoring
  const key = props.activeKey ? (contexts[props.activeKey] ? props.activeKey : fallbackKeys[props.activeKey]) : props.stage
  return contexts[key || props.stage] || contexts.prediction
})

const range = ref<[number, number]>([2244, 2344])
const colours = ref<Record<string, string>>({ '2': '#5a9fc6', '3': '#244b78', '4': '#e8bd35', '5': '#8f3f20' })
const designSegments = ref<GradeSegment[]>([
  { start: 2244, end: 2270, grade: '3' }, { start: 2270, end: 2304, grade: '4' }, { start: 2304, end: 2344, grade: '5' },
])
const predictionSegments = ref<GradeSegment[]>([
  { start: 2244, end: 2264, grade: '3' }, { start: 2264, end: 2296, grade: '4' }, { start: 2296, end: 2320, grade: '5' }, { start: 2320, end: 2344, grade: null },
])
const romanToNumber: Record<string, string> = { II: '2', III: '3', IV: '4', V: '5' }
const numberToRoman: Record<string, string> = { '2': 'Ⅱ', '3': 'Ⅲ', '4': 'Ⅳ', '5': 'Ⅴ' }
const normaliseGrade = (grade: string | null) => grade ? (romanToNumber[grade.toUpperCase()] || grade) : null
const gradeLabel = (grade: string | null) => grade ? `${numberToRoman[normaliseGrade(grade) || ''] || grade}级` : '待判定'
const parseMileage = (value: string) => {
  const match = value.match(/([A-Za-z]*)(\d+)\+(\d+(?:\.\d+)?)/)
  return match ? Number(match[2]) * 1000 + Number(match[3]) : Number.NaN
}
const formatMileage = (value: number) => `YK${Math.floor(value / 1000)}+${String(Math.round(value % 1000)).padStart(3, '0')}`
const ticks = computed(() => Array.from({ length: 5 }, (_, index) => {
  const value = range.value[0] + (range.value[1] - range.value[0]) * index / 4
  return { label: formatMileage(value), percent: index * 25 }
}))
const segmentStyle = (segment: GradeSegment) => ({
  left: `${((segment.start - range.value[0]) / (range.value[1] - range.value[0])) * 100}%`,
  width: `${((segment.end - segment.start) / (range.value[1] - range.value[0])) * 100}%`,
  background: segment.grade ? colours.value[normaliseGrade(segment.grade) || ''] : undefined,
})

onMounted(async () => {
  try {
    const [metadataResponse, designResponse] = await Promise.all([
      fetch('/data/geophysical_grade/metadata.json'),
      fetch('/data/tunnel/design-rock-grades.json'),
    ])
    if (metadataResponse.ok) {
      const metadata = await metadataResponse.json()
      if (metadata.colours) colours.value = metadata.colours
      if (metadata.axialProfile?.mileageRange?.length === 2) range.value = metadata.axialProfile.mileageRange
      if (metadata.axialProfile?.segments?.length) predictionSegments.value = metadata.axialProfile.segments
    }
    if (designResponse.ok) {
      const design = await designResponse.json()
      const clipped = (design.segments || []).map((segment: { startMileage: string; endMileage: string; grade: string }) => ({
        start: Math.max(parseMileage(segment.startMileage), range.value[0]),
        end: Math.min(parseMileage(segment.endMileage), range.value[1]),
        grade: normaliseGrade(segment.grade),
      })).filter((segment: GradeSegment) => Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.end > segment.start)
      if (clipped.length) designSegments.value = clipped
    }
  } catch (error) {
    console.warn('[RockWorkspaceFooter] 分级剖面数据加载失败', error)
  }
})
</script>

<style scoped lang="scss">
.rock-workspace-footer {
  position: absolute; z-index: 19; right: var(--rock-right-rail, 380px); bottom: 0; left: 216px; height: 210px;
  box-sizing: border-box; overflow: hidden; color: #c7d5ea;
  border: 1px solid rgba(0, 188, 238, .28); border-bottom: 0; border-radius: 12px 12px 0 0;
  background: linear-gradient(180deg, rgba(6, 23, 39, .97), rgba(2, 10, 22, .98));
  box-shadow: 0 -5px 24px rgba(0, 0, 0, .48), inset 0 1px rgba(119, 226, 255, .06);
  backdrop-filter: blur(16px); font-family: system-ui, "Microsoft YaHei", sans-serif;
}
.rwf-header { height: 46px; padding: 0 18px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid rgba(41,174,211,.15); background:rgba(0,79,109,.07); }
.rwf-title { display:flex;align-items:center;gap:9px;min-width:0; > i{width:3px;height:24px;border-radius:2px;background:linear-gradient(#62efff,#0a759b);box-shadow:0 0 8px rgba(39,220,246,.55)} div{display:flex;align-items:baseline;gap:11px;min-width:0} strong{color:#9cecf5;font-size:14px;letter-spacing:.5px;white-space:nowrap} span{color:#5f8195;font-size:10px;white-space:nowrap} }
.rwf-badges { display:flex;align-items:center;gap:7px; }
.rwf-badge { padding:3px 7px;border:1px solid rgba(64,169,198,.2);border-radius:3px;color:#7398aa;background:rgba(15,93,119,.1);font-size:9px; }
.rwf-live { display:flex;align-items:center;gap:5px;margin-left:4px;color:#6f9689;font-size:9px; i{width:5px;height:5px;border-radius:50%;background:#48df9d;box-shadow:0 0 6px #48df9d} }
.rwf-dashboard { height:163px;display:grid;grid-template-columns:minmax(390px,42%) 1fr;gap:18px;padding:15px 18px 13px;box-sizing:border-box; }
.rwf-metrics { display:grid;grid-template-columns:repeat(4,minmax(74px,1fr));gap:8px; }
.rwf-metric { min-width:0;padding:9px 10px;border:1px solid rgba(65,145,175,.14);border-radius:6px;background:rgba(10,43,61,.26);box-sizing:border-box; span,em{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap} span{color:#66879a;font-size:9px} strong{display:block;margin:5px 0 3px;color:#8eddec;font:600 17px Consolas,"Microsoft YaHei",sans-serif;white-space:nowrap} small{margin-left:3px;color:#7899aa;font-size:9px;font-weight:400} em{color:#516f80;font-size:8px;font-style:normal} &.green strong{color:#65d8a3}&.amber strong{color:#e5c45a}&.red strong{color:#f18176} }
.rwf-profile { min-width:0;padding:1px 2px 0; }
.rwf-profile-head { display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;span{color:#86a8ba;font-size:10px}small{color:#567487;font:9px Consolas,monospace} }
.rwf-profile-track { position:relative;height:58px;display:flex;overflow:visible;border:1px solid rgba(52,151,183,.23);border-radius:5px;background:#071724; > span{position:relative;display:flex;min-width:0;flex-direction:column;align-items:center;justify-content:center;border-right:1px solid rgba(255,255,255,.14);background:linear-gradient(180deg,color-mix(in srgb,var(--band) 34%,transparent),color-mix(in srgb,var(--band) 12%,transparent));box-shadow:inset 0 3px var(--band);b{color:#c3d9e2;font-size:10px;font-weight:600}small{margin-top:3px;color:#6d8998;font-size:8px}} }
.rwf-current { position:absolute;z-index:3;top:-5px;bottom:-5px;left:7%;width:1px;background:#35e7fa;box-shadow:0 0 8px rgba(53,231,250,.9); b{position:absolute;top:-13px;left:5px;color:#59dceb;font-size:8px;font-style:normal;white-space:nowrap} }
.rwf-profile-axis { display:flex;justify-content:space-between;margin-top:7px;color:#4f7184;font:8px Consolas,monospace; }
.rwf-grade-body { height:163px;display:grid;grid-template-columns:68px 1fr;gap:12px;padding:13px 18px 11px;box-sizing:border-box; }
.rwf-row-labels { display:grid;grid-template-rows:repeat(3,25px);gap:6px;padding-top:1px;span{display:flex;align-items:center;gap:6px;color:#9bb4c5;font-size:10px}i{width:6px;height:6px;border-radius:50%;background:#58c9ef;box-shadow:0 0 6px currentColor}i.forecast{background:#36dfca}i.observed{background:#79d99b} }
.rwf-grade-tracks { position:relative;display:grid;grid-template-rows:repeat(3,25px) 18px;gap:6px; }
.rwf-track { position:relative;overflow:hidden;border:1px solid rgba(0,170,255,.18);border-radius:3px;background:rgba(0,35,67,.3); }
.rwf-grade-segment { position:absolute;inset-block:0;display:flex;align-items:center;justify-content:center;border-right:1px solid rgba(255,255,255,.2);box-shadow:inset 0 0 10px rgba(255,255,255,.05);span{color:rgba(255,255,255,.9);font-size:9px;text-shadow:0 1px 2px #000;white-space:nowrap}&.unknown{background:repeating-linear-gradient(135deg,rgba(81,112,128,.16) 0 7px,rgba(81,112,128,.28) 7px 9px)} }
.rwf-track--pending { display:flex;align-items:center;justify-content:center;background:repeating-linear-gradient(135deg,rgba(35,61,75,.5) 0 8px,rgba(50,78,91,.5) 8px 10px);span{color:#668798;font-size:9px} }
.rwf-axis { position:relative;border-top:1px solid rgba(72,133,159,.27);span{position:absolute;top:4px;transform:translateX(-50%);color:#527386;font:8px Consolas,monospace;white-space:nowrap;&:first-child{transform:none}&:last-child{transform:translateX(-100%)}}i{position:absolute;top:-5px;left:50%;width:1px;height:4px;background:#4d8ba6} }
.rwf-face-line { position:absolute;z-index:4;top:-2px;bottom:18px;left:7%;width:1px;background:#32e8fa;box-shadow:0 0 7px rgba(50,232,250,.8);pointer-events:none;span{position:absolute;top:-12px;left:5px;color:#56ddea;font-size:8px;white-space:nowrap} }

/* 设计基准：资料清单 + 设计参数 + 当前方案，不使用轴向图。 */
.rwf-baseline { height:163px;display:grid;grid-template-columns:1.05fr 1.5fr .95fr;gap:12px;padding:12px 18px 13px;box-sizing:border-box; }
.rwf-block-title { display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;color:#8fb3c5;font-size:10px;small{color:#526f80;font-size:8px;font-weight:400} }
.rwf-source-stack,.rwf-scheme-summary { padding:8px 10px;border:1px solid rgba(64,147,177,.14);border-radius:6px;background:rgba(8,37,53,.24); }
.rwf-source-list { display:grid;gap:5px;span{display:grid;grid-template-columns:20px 1fr auto;align-items:center;gap:6px;min-width:0}i{display:grid;width:18px;height:18px;place-items:center;border-radius:3px;color:#7ed7e7;background:rgba(34,151,182,.14);font-size:8px;font-style:normal}b{overflow:hidden;color:#9eb7c6;font-size:9px;font-weight:500;text-overflow:ellipsis;white-space:nowrap}em{color:#5f9a89;font-size:8px;font-style:normal} }
.rwf-design-cards { display:grid;grid-template-columns:repeat(2,1fr);gap:7px;div{display:grid;grid-template-columns:1fr auto;align-items:center;padding:8px 10px;border:1px solid rgba(60,143,174,.14);border-radius:5px;background:linear-gradient(135deg,rgba(12,52,71,.34),rgba(7,27,42,.18))}span{color:#5e8092;font-size:8px}strong{color:#a7dae3;font-size:12px;font-weight:600}.amber{color:#dfc35e}.green{color:#68d2a1}small{grid-column:1/-1;margin-top:3px;color:#4e6e7e;font-size:8px} }
.rwf-scheme-line { display:grid;grid-template-columns:66px 1fr;gap:7px;padding:5px 0;border-bottom:1px solid rgba(67,136,160,.09);font-size:9px;&:last-child{border-bottom:0}span{color:#5d7d8e}b{color:#a5bdca;font-weight:500;text-align:right} }

/* 揭露校正：三阶段对照 + 修正结论 + 入模日志。 */
.rwf-correction { height:163px;display:grid;grid-template-columns:1.5fr .9fr .8fr;gap:12px;padding:12px 18px 13px;box-sizing:border-box; }
.rwf-compare-grid { display:grid;grid-template-columns:1fr 18px 1fr 18px 1fr;align-items:stretch;gap:3px; }
.rwf-compare-card { display:flex;min-width:0;flex-direction:column;justify-content:center;padding:8px 9px;border:1px solid rgba(68,146,174,.18);border-radius:6px;background:rgba(10,40,57,.28);span{color:#66899a;font-size:8px}strong{margin:5px 0 3px;color:#8eddec;font-size:18px}small{overflow:hidden;color:#587687;font-size:8px;text-overflow:ellipsis;white-space:nowrap}&.forecast{border-color:rgba(67,207,197,.22)}&.observed{border-color:rgba(102,211,153,.22)} }
.rwf-compare-arrow { display:grid;place-items:center;color:#426a7c;font-size:14px; }
.rwf-correction-result,.rwf-update-log { padding:8px 10px;border:1px solid rgba(64,147,177,.14);border-radius:6px;background:rgba(8,37,53,.24); }
.rwf-correction-result p { display:flex;gap:6px;margin:0 0 8px;color:#8ea8b5;font-size:8px;line-height:1.4;i{width:5px;height:5px;margin-top:3px;flex:none;border-radius:50%;background:#e3bd4b;box-shadow:0 0 5px #e3bd4b} }
.rwf-delta-row { display:grid;grid-template-columns:repeat(3,1fr);gap:4px;span{padding:5px 3px;border-radius:3px;color:#526f80;background:rgba(18,64,82,.28);font-size:7px;text-align:center}b{display:block;margin-top:2px;color:#73d6bb;font-size:10px} }
.rwf-update-log { display:flex;flex-direction:column;span{display:grid;grid-template-columns:5px 31px 1fr;align-items:center;gap:5px;padding:4px 0;color:#6f8997;font-size:8px}span i{width:4px;height:4px;border-radius:50%;background:#42c9df}span b{color:#557c8e;font-weight:500} }

/* 监测预警：指标、实时趋势、告警队列三段式。 */
.rwf-monitoring { height:163px;display:grid;grid-template-columns:1.1fr 1.35fr .8fr;gap:12px;padding:12px 18px 13px;box-sizing:border-box; }
.rwf-monitor-cards { display:grid;grid-template-columns:repeat(2,1fr);gap:6px;div{padding:7px 9px;border:1px solid rgba(62,145,174,.14);border-radius:5px;background:rgba(8,38,55,.25)}span,em{display:block;color:#5c7d8e;font-size:8px}strong{display:block;margin:3px 0;color:#8ddce9;font:600 14px Consolas,sans-serif}strong small{margin-left:2px;color:#66899a;font-size:8px}.green strong{color:#67d4a2}.amber strong{color:#dfbf54}em{font-style:normal} }
.rwf-trend-chart { position:relative;min-width:0;padding:6px 9px 4px;border:1px solid rgba(62,145,174,.14);border-radius:6px;background:rgba(7,31,46,.25);svg{display:block;width:100%;height:65px;overflow:visible}.grid{fill:none;stroke:rgba(83,140,161,.13);stroke-width:1}.area{fill:rgba(38,190,218,.07)}.settlement,.convergence{fill:none;stroke-width:2;vector-effect:non-scaling-stroke}.settlement{stroke:#43d8eb}.convergence{stroke:#61d39f} }
.rwf-trend-axis { display:flex;justify-content:space-between;color:#486b7c;font:7px Consolas,monospace; }
.rwf-trend-legend { position:absolute;right:9px;top:7px;display:flex;gap:8px;color:#638394;font-size:7px;span{display:flex;align-items:center;gap:3px}i{width:8px;height:2px}.cyan{background:#43d8eb}.green{background:#61d39f} }
.rwf-alert-queue { padding:7px 9px;border:1px solid rgba(62,145,174,.14);border-radius:6px;background:rgba(7,31,46,.25); }
.rwf-alert-item { display:grid;grid-template-columns:6px 1fr auto;align-items:center;gap:7px;padding:7px;border:1px solid rgba(213,177,62,.18);border-radius:4px;background:rgba(160,112,19,.08);>i{width:5px;height:5px;border-radius:50%;background:#e3bd4b;box-shadow:0 0 6px #e3bd4b}div{display:flex;min-width:0;flex-direction:column;gap:2px}b{color:#bcae7d;font-size:8px}span{color:#6f735e;font-size:7px}em{color:#64b99a;font-size:7px;font-style:normal} }
.rwf-alert-empty { display:flex;align-items:center;gap:5px;margin-top:8px;color:#567b70;font-size:8px;i{width:5px;height:5px;border-radius:50%;background:#56cf98} }

/* 掌子面素描：按空间部位展示，不使用里程轴。 */
.rwf-face-zones { height:163px;display:grid;grid-template-columns:1.2fr repeat(4,1fr);gap:9px;padding:13px 18px;box-sizing:border-box; }
.rwf-face-summary,.rwf-zone-card { display:flex;min-width:0;flex-direction:column;justify-content:center;padding:10px 12px;border:1px solid rgba(62,145,174,.15);border-radius:7px;background:rgba(8,38,55,.26); }
.rwf-face-summary { background:linear-gradient(135deg,rgba(14,75,95,.36),rgba(7,28,42,.22));span{color:#65aabb;font-size:8px}strong{margin:7px 0 5px;color:#9cdae3;font-size:12px}small{color:#5d7e8d;font-size:8px;line-height:1.4} }
.rwf-zone-card { position:relative;overflow:hidden;i{position:absolute;top:0;right:0;width:34px;height:4px;background:#3b9fbd}span{color:#638596;font-size:8px}b{margin:7px 0 4px;color:#9fc5d2;font-size:12px}small{color:#536f7e;font-size:8px}.crown{background:#d5ad3e}.floor{background:#4fc08c}&.warning{border-color:rgba(213,173,62,.22)}&.stable{border-color:rgba(79,192,140,.2)} }

/* 图形化底栏变体：以轴线、轨道和图例为主体。 */
.rwf-baseline { grid-template-columns:150px 1fr;grid-template-rows:1fr 20px;column-gap:18px;row-gap:4px;padding-block:10px; }
.rwf-baseline-legend { grid-row:1/-1;padding:8px 10px;border:1px solid rgba(64,147,177,.14);border-radius:6px;background:rgba(8,37,53,.24);>span{display:flex;align-items:center;gap:7px;margin:7px 0;color:#7592a1;font-size:8px}>span i{width:14px;height:3px;border-radius:2px;background:#3e9dc0}.geology{background:#42b39e}.support{background:#8b78c8}.approved{background:#62cf92} }
.rwf-design-axis { position:relative;display:grid;grid-template-columns:repeat(4,1fr);align-items:center;gap:10px;padding:0 24px; }
.rwf-design-axis-line { position:absolute;top:42px;right:8%;left:8%;height:2px;background:linear-gradient(90deg,#3e9dc0,#42b39e,#8b78c8,#62cf92);box-shadow:0 0 8px rgba(63,191,203,.3); }
.rwf-design-step { position:relative;z-index:1;display:grid;grid-template-columns:32px 1fr;grid-template-rows:auto auto auto;align-items:center;column-gap:8px;i{grid-row:1/-1;display:grid;width:28px;height:28px;place-items:center;border:2px solid #3e9dc0;border-radius:50%;background:#071926;box-shadow:0 0 0 4px #091b28;color:#75cee5;font-style:normal}i b{font-size:9px}span{color:#618394;font-size:8px}strong{color:#a2c9d6;font-size:11px}small{color:#4f7081;font-size:7px}&.geology i{border-color:#42b39e;color:#70d6bd}&.support i{border-color:#8b78c8;color:#b4a8e2}&.approved i{border-color:#62cf92;color:#8ee0ae} }
.rwf-design-scale { position:relative;grid-column:2;display:flex;align-items:flex-end;justify-content:space-between;margin:0 24px;border-top:1px solid rgba(69,135,158,.26);color:#486b7d;font-size:7px; }
.rwf-scale-marker { position:absolute;bottom:8px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;color:#56cde1;font-size:7px;&::after{content:'';width:1px;height:10px;margin-top:2px;background:#36dcef;box-shadow:0 0 5px #36dcef}b{font:8px Consolas,monospace} }

.rwf-correction { grid-template-columns:92px 1fr 130px;gap:12px;padding:10px 16px 12px; }
.rwf-correction-legend { display:flex;flex-direction:column;justify-content:center;gap:8px;padding:7px 9px;border:1px solid rgba(64,147,177,.14);border-radius:6px;background:rgba(8,37,53,.24);span{display:flex;align-items:center;gap:6px;color:#7996a5;font-size:8px}i{width:13px;height:4px;border-radius:2px;background:#5a9fc6}.forecast{background:#31c9bb}.observed{background:#63d395}small{margin-top:2px;color:#4c6b7b;font-size:7px;line-height:1.35} }
.rwf-correction-tracks { position:relative;display:grid;grid-template-rows:repeat(3,23px) 18px;gap:6px;padding-top:2px; }
.rwf-c-track { display:flex;margin-left:42px;overflow:hidden;border:1px solid rgba(59,142,173,.18);border-radius:3px;background:rgba(5,28,43,.4);label{position:absolute;left:0;width:35px;color:#648597;font-size:8px;line-height:23px}span{display:flex;align-items:center;justify-content:center;border-right:1px solid rgba(255,255,255,.12);color:#d4e2e7;font-size:8px;text-shadow:0 1px 2px #000}.stable{background:rgba(53,131,170,.62)}.attention{background:rgba(201,166,53,.62)}.risk{background:rgba(173,74,43,.62)}.revealed{background:rgba(62,181,140,.58)}.current{background:rgba(47,207,219,.68)}.pending{background:repeating-linear-gradient(135deg,rgba(48,76,89,.5) 0 6px,rgba(66,94,107,.5) 6px 8px);color:#708f9e} }
.rwf-cursor { position:absolute;z-index:3;top:-2px;bottom:18px;width:1px;background:#43e4f1;box-shadow:0 0 6px #43e4f1;b{position:absolute;top:-8px;left:4px;color:#5edcea;font:7px Consolas,monospace;white-space:nowrap} }
.rwf-c-axis { position:relative;margin-left:42px;border-top:1px solid rgba(67,127,150,.25);span{position:absolute;top:4px;color:#486a7b;font:7px Consolas,monospace;transform:translateX(-50%);&:nth-child(1){left:0;transform:none}&:nth-child(2){left:25%}&:nth-child(3){left:50%}&:nth-child(4){left:75%}&:nth-child(5){right:0;transform:none}} }
.rwf-correction-note { display:flex;flex-direction:column;justify-content:center;gap:9px;padding:8px 10px;border:1px solid rgba(64,147,177,.14);border-radius:6px;background:rgba(8,37,53,.24);strong{color:#8eb4c5;font-size:9px}span{display:flex;justify-content:space-between;color:#5e7d8d;font-size:8px}b{color:#67d2aa;font-size:10px} }

.rwf-face-zones { grid-template-columns:145px 1fr 125px;gap:14px;padding:10px 16px 11px; }
.rwf-face-legend,.rwf-face-note { display:flex;flex-direction:column;justify-content:center;padding:8px 10px;border:1px solid rgba(62,145,174,.15);border-radius:6px;background:rgba(8,38,55,.26); }
.rwf-face-legend { strong{margin-bottom:7px;color:#8eafbe;font-size:9px}span{display:flex;align-items:center;gap:7px;margin:4px 0;color:#668696;font-size:8px}i{width:13px;height:4px;border-radius:2px;background:#4da77f}.jointed{background:#c5a13d}.broken{background:#c66043}.water{background:#31a9df} }
.rwf-face-profile { position:relative;min-width:0;padding:3px 14px 0; }
.rwf-face-arch { height:81px;display:grid;grid-template-columns:1fr 1.25fr 1fr;grid-template-rows:1fr 24px;overflow:hidden;border:1px solid rgba(76,157,185,.25);border-radius:54px 54px 5px 5px;background:#071a27;box-shadow:inset 0 0 18px rgba(27,121,151,.08); }
.rwf-face-arch .zone { display:flex;flex-direction:column;align-items:center;justify-content:center;border-right:1px solid rgba(255,255,255,.09);background:rgba(66,143,171,.18);b{color:#9fc3cf;font-size:9px}small{margin-top:3px;color:#607f8e;font-size:7px}&.crown{background:linear-gradient(180deg,rgba(190,83,54,.43),rgba(186,154,50,.23))}&.right{background:rgba(184,145,48,.2)}&.floor{grid-column:1/-1;border-top:1px solid rgba(255,255,255,.1);border-right:0;background:rgba(55,160,119,.19)} }
.rwf-face-baseline { display:flex;justify-content:space-between;margin-top:7px;border-top:1px solid rgba(68,131,153,.25);color:#486b7b;font-size:7px; }
.rwf-face-note { gap:5px;span{color:#587989;font-size:7px}b{color:#9ab9c5;font:9px Consolas,"Microsoft YaHei",sans-serif;font-weight:500} }

/* 可读性：底栏增高后统一抬升字号，并为密集标签保留独立行高。 */
.rwf-title { strong{font-size:15px}span{font-size:11px} }
.rwf-badge,.rwf-live { font-size:10px; }
.rwf-block-title { margin-bottom:9px;font-size:11px;small{font-size:9px} }
.rwf-metric { padding:11px 10px;span{font-size:10px}strong{font-size:18px}small,em{font-size:9px;line-height:1.35} }
.rwf-profile-head { margin-bottom:10px;span{font-size:11px}small{font-size:10px} }
.rwf-profile-track { height:72px;>span b{font-size:11px}>span small{font-size:9px} }
.rwf-profile-axis { margin-top:9px;font-size:9px; }
.rwf-row-labels { grid-template-rows:repeat(3,29px);gap:7px;span{font-size:11px} }
.rwf-grade-tracks { grid-template-rows:repeat(3,29px) 22px;gap:7px; }
.rwf-grade-segment span,.rwf-track--pending span { font-size:10px; }
.rwf-axis span { top:5px;font-size:9px; }

.rwf-baseline { grid-template-columns:165px 1fr;grid-template-rows:1fr 22px;column-gap:22px;padding-top:12px;padding-bottom:12px; }
.rwf-baseline-legend { padding:10px 12px;>span{margin:8px 0;font-size:10px}>span i{width:17px;height:4px} }
.rwf-design-axis { gap:14px;padding:0 28px; }
.rwf-design-axis-line { top:51px; }
.rwf-design-step { grid-template-columns:38px 1fr;column-gap:9px;i{width:32px;height:32px}i b{font-size:10px}span{font-size:10px;line-height:1.25}strong{font-size:12px;line-height:1.35}small{font-size:9px;line-height:1.3;white-space:normal} }
.rwf-design-scale { margin-inline:28px;font-size:9px; }
.rwf-scale-marker { bottom:11px;font-size:9px;b{font-size:9px} }

.rwf-correction { grid-template-columns:106px 1fr 150px;gap:14px;padding:12px 18px 13px; }
.rwf-correction-legend { gap:10px;padding:9px 11px;span{font-size:10px}i{width:16px;height:5px}small{font-size:9px;line-height:1.45} }
.rwf-correction-tracks { grid-template-rows:repeat(3,27px) 20px;gap:7px;padding-top:3px; }
.rwf-c-track { margin-left:48px;label{width:40px;font-size:10px;line-height:27px}span{font-size:10px;line-height:1;white-space:nowrap} }
.rwf-c-axis { margin-left:48px;span{top:5px;font-size:9px} }
.rwf-cursor b { top:-10px;font-size:9px; }
.rwf-correction-note { gap:12px;padding:10px 12px;strong{font-size:11px}span{font-size:10px}b{font-size:12px} }

.rwf-monitor-cards { gap:8px;div{padding:9px 10px}span,em{font-size:9px;line-height:1.3}strong{margin:4px 0;font-size:16px}strong small{font-size:9px} }
.rwf-trend-chart { padding:8px 11px 6px;svg{height:82px} }
.rwf-trend-axis { font-size:9px; }
.rwf-trend-legend { right:11px;top:9px;gap:10px;font-size:9px; }
.rwf-alert-queue { padding:9px 11px; }
.rwf-alert-item { padding:9px;gap:8px;b{font-size:10px;line-height:1.3}span,em{font-size:9px} }
.rwf-alert-empty { margin-top:10px;font-size:9px; }

.rwf-face-zones { grid-template-columns:165px 1fr 145px;gap:18px;padding:12px 18px 13px; }
.rwf-face-legend,.rwf-face-note { padding:10px 12px; }
.rwf-face-legend { strong{margin-bottom:9px;font-size:11px}span{gap:8px;margin:5px 0;font-size:10px}i{width:16px;height:5px} }
.rwf-face-profile { padding-inline:18px; }
.rwf-face-arch { height:104px;border-radius:62px 62px 5px 5px; }
.rwf-face-arch .zone { b{font-size:11px}small{margin-top:4px;font-size:9px;line-height:1.2;text-align:center} }
.rwf-face-baseline { margin-top:8px;font-size:9px; }
.rwf-face-note { gap:8px;span{font-size:9px}b{font-size:11px;line-height:1.25;white-space:normal} }
@media (max-width: 1250px) { .rwf-title span,.rwf-badge{display:none}.rwf-dashboard{grid-template-columns:45% 1fr}.rwf-metric{padding-inline:6px}.rwf-metric strong{font-size:14px} }
</style>
