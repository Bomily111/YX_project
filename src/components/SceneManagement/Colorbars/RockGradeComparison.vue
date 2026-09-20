<template>
  <section class="grade-comparison" aria-label="设计、预测、实测围岩等级对比">
    <header class="comparison-header">
      <div>
        <b>围岩等级纵向对比</b>
        <span>{{ rangeLabel }}</span>
      </div>
      <small>同一里程基准 · 颜色对应综合围岩等级</small>
    </header>

    <div class="comparison-body">
      <div class="row-labels" aria-hidden="true">
        <span><i class="source-dot design"></i>设计</span>
        <span><i class="source-dot forecast"></i>预测</span>
        <span><i class="source-dot observed"></i>实测</span>
      </div>

      <div class="tracks">
        <div class="face-line"><span>掌子面</span></div>

        <div class="track" aria-label="设计围岩等级">
          <template v-if="designSegments.length">
            <div
              v-for="segment in designSegments"
              :key="`design-${segment.start}-${segment.end}`"
              class="grade-segment"
              :style="segmentStyle(segment)"
              :title="segmentTitle('设计', segment)"
            ><span>{{ gradeLabel(segment.grade) }}</span></div>
          </template>
          <span v-else class="track-empty">设计分级数据加载中</span>
        </div>

        <div class="track" aria-label="预测围岩等级">
          <template v-if="predictionSegments.length">
            <div
              v-for="segment in predictionSegments"
              :key="`prediction-${segment.start}-${segment.end}`"
              class="grade-segment"
              :class="{ unknown: !segment.grade }"
              :style="segmentStyle(segment)"
              :title="segmentTitle('预测', segment)"
            ><span>{{ segment.grade ? gradeLabel(segment.grade) : '无有效体素' }}</span></div>
          </template>
          <span v-else class="track-empty">预测剖面生成中</span>
        </div>

        <div class="track track--pending" aria-label="实测围岩等级">
          <span>待开挖揭露 · 暂无同里程实测分级</span>
        </div>

        <div class="mileage-axis" aria-hidden="true">
          <span v-for="tick in ticks" :key="tick.value" :style="{ left: `${tick.percent}%` }">
            <i></i>{{ tick.label }}
          </span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

type GradeSegment = { start: number; end: number; grade: string | null }
type DesignSourceSegment = { startMileage: string; endMileage: string; grade: string }
type GradeMetadata = {
  colours?: Record<string, string>
  axialProfile?: { mileageRange: [number, number]; segments: GradeSegment[] }
}

const DEFAULT_RANGE: [number, number] = [2244, 2344]
const range = ref<[number, number]>(DEFAULT_RANGE)
const colours = ref<Record<string, string>>({
  '2': '#5a9fc6',
  '3': '#244b78',
  '4': '#e8bd35',
  '5': '#8f3f20',
})
const designSegments = ref<GradeSegment[]>([])
const predictionSegments = ref<GradeSegment[]>([])

const romanToNumber: Record<string, string> = { II: '2', III: '3', IV: '4', V: '5' }
const numberToRoman: Record<string, string> = { '2': 'Ⅱ', '3': 'Ⅲ', '4': 'Ⅳ', '5': 'Ⅴ' }

function parseMileage(value: string): number {
  const match = value.match(/([A-Za-z]*)(\d+)\+(\d+(?:\.\d+)?)/)
  return match ? Number(match[2]) * 1000 + Number(match[3]) : Number.NaN
}

function formatMileage(value: number): string {
  const km = Math.floor(value / 1000)
  const metres = value - km * 1000
  const formatted = Number.isInteger(metres) ? String(metres).padStart(3, '0') : metres.toFixed(1).padStart(5, '0')
  return `YK${km}+${formatted}`
}

function normaliseGrade(grade: string | null): string | null {
  if (!grade) return null
  return romanToNumber[grade.toUpperCase()] ?? grade
}

function clipSegment(segment: GradeSegment): GradeSegment | null {
  const start = Math.max(segment.start, range.value[0])
  const end = Math.min(segment.end, range.value[1])
  return end > start ? { start, end, grade: normaliseGrade(segment.grade) } : null
}

function gradeLabel(grade: string | null): string {
  return grade ? `${numberToRoman[normaliseGrade(grade) ?? ''] ?? grade}级` : '未分类'
}

function segmentStyle(segment: GradeSegment) {
  const span = range.value[1] - range.value[0]
  return {
    left: `${((segment.start - range.value[0]) / span) * 100}%`,
    width: `${((segment.end - segment.start) / span) * 100}%`,
    background: segment.grade ? colours.value[normaliseGrade(segment.grade) ?? ''] : undefined,
  }
}

function segmentTitle(source: string, segment: GradeSegment): string {
  const grade = segment.grade ? gradeLabel(segment.grade) : '未分类'
  return `${source}：${grade}（${formatMileage(segment.start)} — ${formatMileage(segment.end)}）`
}

const rangeLabel = computed(() => `${formatMileage(range.value[0])} — ${formatMileage(range.value[1])}`)
const ticks = computed(() => Array.from({ length: 5 }, (_, index) => {
  const value = range.value[0] + ((range.value[1] - range.value[0]) * index) / 4
  return { value, label: formatMileage(value), percent: index * 25 }
}))

onMounted(async () => {
  try {
    const metadataResponse = await fetch('/data/geophysical_grade/metadata.json')
    if (metadataResponse.ok) {
      const metadata = await metadataResponse.json() as GradeMetadata
      if (metadata.colours) colours.value = metadata.colours
      if (metadata.axialProfile) {
        range.value = metadata.axialProfile.mileageRange
        predictionSegments.value = metadata.axialProfile.segments
          .map(clipSegment)
          .filter((segment): segment is GradeSegment => Boolean(segment))
      }
    }

    const designResponse = await fetch('/data/tunnel/design-rock-grades.json')
    if (designResponse.ok) {
      const design = await designResponse.json() as { segments: DesignSourceSegment[] }
      designSegments.value = design.segments
        .map(segment => clipSegment({
          start: parseMileage(segment.startMileage),
          end: parseMileage(segment.endMileage),
          grade: segment.grade,
        }))
        .filter((segment): segment is GradeSegment => Boolean(segment))
    }
  } catch (error) {
    console.warn('[RockGradeComparison] 围岩等级对比数据加载失败', error)
  }
})
</script>

<style scoped lang="scss">
.grade-comparison {
  position: fixed;
  z-index: 18;
  right: 332px;
  bottom: 0;
  left: 216px;
  min-width: 520px;
  padding: 14px 18px 17px;
  box-sizing: border-box;
  border-top: 1px solid rgba(0, 170, 255, .24);
  border-right: 1px solid rgba(0, 170, 255, .2);
  border-bottom: 0;
  border-left: 1px solid rgba(0, 170, 255, .2);
  border-radius: 0;
  color: #c7d5ea;
  background: rgba(2, 10, 22, .94);
  box-shadow: 0 -4px 24px rgba(0, 0, 0, .5), inset 0 1px rgba(107, 224, 255, .04);
  backdrop-filter: blur(16px);
  font-family: system-ui, "Microsoft YaHei", sans-serif;
  pointer-events: auto;
}

.comparison-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 24px;
  margin-bottom: 12px;

  div { display: flex; align-items: baseline; gap: 12px; }
  b { color: #7dd3fc; font-size: 15px; font-weight: 700; letter-spacing: .6px; }
  span { color: #9bb4c8; font-size: 11px; }
  small { color: #66849b; font-size: 10px; }
}

.comparison-body { display: grid; grid-template-columns: 66px 1fr; gap: 12px; }
.row-labels {
  display: grid;
  grid-template-rows: repeat(3, 26px);
  gap: 8px;

  span { display: flex; align-items: center; gap: 7px; color: #c7d5ea; font-size: 12px; font-weight: 500; }
}
.source-dot { width: 7px; height: 7px; border-radius: 50%; box-shadow: 0 0 7px currentColor; }
.source-dot.design { color: #82cfff; background: currentColor; }
.source-dot.forecast { color: #20e6f2; background: currentColor; }
.source-dot.observed { color: #85e0ad; background: currentColor; }

.tracks { position: relative; display: grid; grid-template-rows: repeat(3, 26px) 22px; gap: 8px; }
.track {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(0, 170, 255, .2);
  border-radius: 2px;
  background: rgba(0, 35, 67, .32);
}
.grade-segment {
  position: absolute;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 1px;
  border-right: 1px solid rgba(255,255,255,.3);
  box-shadow: inset 0 0 10px rgba(255,255,255,.07);

  span { color: rgba(255,255,255,.94); font-size: 11px; font-weight: 600; text-shadow: 0 1px 3px #000; white-space: nowrap; }
}
.grade-segment.unknown,
.track--pending {
  background-color: rgba(19, 43, 57, .72);
  background-image: repeating-linear-gradient(135deg, transparent 0 7px, rgba(104,151,171,.13) 7px 9px);
}
.grade-segment.unknown span { font-size: 10px; color: #88a4b7; }
.track--pending { display: flex; align-items: center; justify-content: center; }
.track--pending span, .track-empty { color: #7899ad; font-size: 10px; letter-spacing: .3px; }
.track-empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }

.face-line {
  position: absolute;
  z-index: 4;
  top: -3px;
  bottom: 22px;
  left: 0;
  width: 1px;
  background: #21e8ff;
  box-shadow: 0 0 7px rgba(33, 232, 255, .8);
  pointer-events: none;

  &::after { content: ''; position: absolute; top: 0; left: -3px; border-right: 3px solid transparent; border-left: 3px solid transparent; border-top: 5px solid #21e8ff; }
  span { position: absolute; top: -14px; left: 6px; color: #69e9f7; font-size: 10px; white-space: nowrap; }
}

.mileage-axis {
  position: relative;
  border-top: 1px solid rgba(72, 133, 159, .32);

  span {
    position: absolute;
    top: 5px;
    transform: translateX(-50%);
    color: #58788a;
    font-size: 9px;
    white-space: nowrap;

    &:first-child { transform: none; }
    &:last-child { transform: translateX(-100%); }
  }
  i { position: absolute; top: -6px; left: 50%; width: 1px; height: 4px; background: #4d8ba6; }
}

@media (max-width: 1200px) {
  .grade-comparison { min-width: 420px; }
  .comparison-header small { display: none; }
}
</style>
