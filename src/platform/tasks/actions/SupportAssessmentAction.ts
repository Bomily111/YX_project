import { supportApi } from '@/services/api/client'
import { chainageService } from '@/platform/coordinates/ChainageService'
import type { ChainageRange } from '@/platform/resources/types'
import type { StepActionHandler } from '@/platform/tasks/WorkflowExecutor'
import type { TaskDataProvenance } from '@/platform/telemetry/TaskDataProvenance'

export interface SupportComponentRecord {
  id: string
  componentType: string
  startChainage: number
  endChainage: number
  completionPercent: number
  qualityGrade?: string
  designValue?: number
  measuredMean?: number
  measuredMin?: number
}

export interface SupportAssessmentDataSource {
  list(tunnelId: string): Promise<readonly SupportComponentRecord[]>
}

interface SupportApiRecord {
  id?: unknown
  component_type?: unknown
  start_dk?: unknown
  end_dk?: unknown
  completion_pct?: unknown
  quality_grade?: unknown
  design_value?: unknown
  measured_mean?: unknown
  measured_min?: unknown
}

const optionalNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}
const apiChainageToYk = (value: number): number => value >= chainageService.legacyDkReference.origin
  ? chainageService.legacyDkToCanonical(value) : value

export class DefaultSupportAssessmentDataSource implements SupportAssessmentDataSource {
  async list(tunnelId: string): Promise<readonly SupportComponentRecord[]> {
    const records = await supportApi.list(tunnelId) as SupportApiRecord[]
    return records.flatMap((record) => {
      const start = optionalNumber(record.start_dk)
      const end = optionalNumber(record.end_dk)
      if (typeof record.id !== 'string' || typeof record.component_type !== 'string' || start === undefined) return []
      return [{
        id: record.id,
        componentType: record.component_type,
        startChainage: apiChainageToYk(start),
        endChainage: apiChainageToYk(end ?? start),
        completionPercent: optionalNumber(record.completion_pct) ?? 0,
        qualityGrade: typeof record.quality_grade === 'string' ? record.quality_grade : undefined,
        designValue: optionalNumber(record.design_value),
        measuredMean: optionalNumber(record.measured_mean),
        measuredMin: optionalNumber(record.measured_min),
      }]
    })
  }
}

export type SupportAssessment = 'pass' | 'conditional' | 'fail' | 'insufficient-data'
export type SupportDeviationSeverity = 'minor' | 'major'

export interface SupportDeviation {
  componentId?: string
  componentType: string
  severity: SupportDeviationSeverity
  rule: 'missing-component' | 'incomplete' | 'quality-grade' | 'measured-value'
  expected: string | number
  actual?: string | number
  message: string
}

export interface SupportAssessmentResult {
  assessment: SupportAssessment
  deviations: readonly SupportDeviation[]
  summary: string
}

const TYPE_ALIASES: Readonly<Record<string, readonly string[]>> = {
  shotcrete: ['shotcrete', '喷射混凝土', '初喷'],
  bolt: ['bolt', '锚杆'],
  'steel-arch': ['steel-arch', 'steel_arch', '钢架', '钢拱架'],
}

const normalizeType = (value: string): string => {
  const normalized = value.trim().toLowerCase()
  for (const [type, aliases] of Object.entries(TYPE_ALIASES)) {
    if (aliases.some((alias) => normalized.includes(alias))) return type
  }
  return normalized
}

const requiredTypes = (grade: string): readonly string[] => (
  grade === 'IV' || grade === 'V'
    ? ['shotcrete', 'bolt', 'steel-arch']
    : ['shotcrete', 'bolt']
)

const overlaps = (range: ChainageRange, component: SupportComponentRecord): boolean => (
  range.start <= component.endChainage && component.startChainage <= range.end
)

const qualityPassed = (value: string | undefined): boolean => {
  if (!value) return true
  return /^(a|pass|qualified|合格|优良)$/i.test(value.trim())
}

export class SupportAssessmentService {
  constructor(
    private readonly dataSource: SupportAssessmentDataSource = new DefaultSupportAssessmentDataSource(),
    private readonly provenance?: TaskDataProvenance,
  ) {}

  async assess(tunnelId: string, range: ChainageRange, rockGrade: string): Promise<SupportAssessmentResult> {
    const records = await this.dataSource.list(tunnelId)
    await this.provenance?.capture('support.components', `/api/support?tunnel_id=${encodeURIComponent(tunnelId)}`, records)
    const relevant = records.filter((component) => overlaps(range, component))
    if (relevant.length === 0) {
      return {
        assessment: 'insufficient-data',
        deviations: [],
        summary: '任务里程范围内没有支护构件或检测记录，无法判断初期支护适配性。',
      }
    }

    const deviations: SupportDeviation[] = []
    const grouped = new Map<string, SupportComponentRecord[]>()
    for (const component of relevant) {
      const type = normalizeType(component.componentType)
      grouped.set(type, [...(grouped.get(type) ?? []), component])
    }
    for (const type of requiredTypes(rockGrade)) {
      if (!grouped.has(type)) {
        deviations.push({
          componentType: type,
          severity: 'major',
          rule: 'missing-component',
          expected: '存在有效记录',
          message: `${rockGrade}级围岩缺少${type}支护记录`,
        })
      }
    }

    for (const component of relevant) {
      const type = normalizeType(component.componentType)
      if (component.completionPercent < 100) {
        deviations.push({
          componentId: component.id,
          componentType: type,
          severity: component.completionPercent < 80 ? 'major' : 'minor',
          rule: 'incomplete',
          expected: 100,
          actual: component.completionPercent,
          message: `${type}完成率为 ${component.completionPercent}%`,
        })
      }
      if (!qualityPassed(component.qualityGrade)) {
        deviations.push({
          componentId: component.id,
          componentType: type,
          severity: 'major',
          rule: 'quality-grade',
          expected: '合格或优良',
          actual: component.qualityGrade,
          message: `${type}质量等级不合格`,
        })
      }
      if (
        component.designValue !== undefined
        && component.measuredMin !== undefined
        && component.measuredMin < component.designValue * 0.9
      ) {
        deviations.push({
          componentId: component.id,
          componentType: type,
          severity: 'major',
          rule: 'measured-value',
          expected: component.designValue * 0.9,
          actual: component.measuredMin,
          message: `${type}实测最小值低于设计值的 90%`,
        })
      }
    }

    const assessment: SupportAssessment = deviations.some(({ severity }) => severity === 'major')
      ? 'fail'
      : deviations.length > 0 ? 'conditional' : 'pass'
    const summary = assessment === 'pass'
      ? `${rockGrade}级围岩范围内初期支护记录完整，完成率和检测值满足当前规则。`
      : assessment === 'conditional'
        ? `初期支护存在 ${deviations.length} 项一般偏差，建议复核后继续施工。`
        : `初期支护存在 ${deviations.length} 项偏差且包含重大项，不建议直接进入下一工序。`
    return { assessment, deviations, summary }
  }
}

export const createSupportAssessmentHandler = (
  service = new SupportAssessmentService(),
): StepActionHandler => async ({ task, inputs }) => {
  const grade = inputs['rock.grade']
  if (typeof grade !== 'string') throw new Error('[SupportAssessment] 缺少有效的 rock.grade')
  const result = await service.assess(task.tunnelId, task.chainageRange, grade)
  return {
    outputs: {
      'support.deviation': result.deviations,
      'support.assessment': result.assessment,
      'task.summary': result.summary,
    },
    metadata: { confidence: result.assessment === 'insufficient-data' ? 0.2 : 0.9 },
  }
}
