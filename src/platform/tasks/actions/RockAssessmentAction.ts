import { chainageService } from '@/platform/coordinates/ChainageService'
import type { ChainageRange } from '@/platform/resources/types'
import type { StepActionHandler } from '@/platform/tasks/WorkflowExecutor'
import { FACE_SKETCH_RECORDS, type FaceSketchRecord } from '@/modules/face-sketch/data'
import type { TaskDataProvenance } from '@/platform/telemetry/TaskDataProvenance'

export interface DesignRockGradeSegment {
  startMileage: string
  endMileage: string
  grade: string
}

export interface RockAssessmentDataSource {
  loadDesignSegments(): Promise<readonly DesignRockGradeSegment[]>
  loadFaceRecords(): Promise<readonly FaceSketchRecord[]>
}

export interface RockAssessmentResult {
  grade: 'II' | 'III' | 'IV' | 'V' | 'unknown'
  anomalies: readonly string[]
  confidence: number
  evidence: readonly string[]
}

interface DesignGradeDocument {
  segments?: DesignRockGradeSegment[]
}

export class DefaultRockAssessmentDataSource implements RockAssessmentDataSource {
  async loadDesignSegments(): Promise<readonly DesignRockGradeSegment[]> {
    const response = await fetch('/data/tunnel/design-rock-grades.json')
    if (!response.ok) throw new Error(`围岩设计数据加载失败：HTTP ${response.status}`)
    const document = await response.json() as DesignGradeDocument
    return document.segments ?? []
  }

  async loadFaceRecords(): Promise<readonly FaceSketchRecord[]> {
    return FACE_SKETCH_RECORDS
  }
}

const GRADE_ORDER = { II: 2, III: 3, IV: 4, V: 5 } as const
type KnownGrade = keyof typeof GRADE_ORDER

const normalizeGrade = (grade: string): KnownGrade | undefined => {
  const normalized = grade.toUpperCase()
    .replace(/级/g, '')
    .replace(/Ⅱ/g, 'II')
    .replace(/Ⅲ/g, 'III')
    .replace(/Ⅳ/g, 'IV')
    .replace(/Ⅴ/g, 'V')
    .trim()
  return normalized in GRADE_ORDER ? normalized as KnownGrade : undefined
}

const overlaps = (a: ChainageRange, b: ChainageRange): boolean => a.start <= b.end && b.start <= a.end

const toDesignRange = (range: ChainageRange): ChainageRange => {
  if (range.start < chainageService.legacyDkReference.origin) return range
  return {
    start: chainageService.fromOffset(
      chainageService.toOffset(range.start, chainageService.legacyDkReference),
      chainageService.datasetReference,
    ),
    end: chainageService.fromOffset(
      chainageService.toOffset(range.end, chainageService.legacyDkReference),
      chainageService.datasetReference,
    ),
  }
}

const worstGrade = (grades: readonly KnownGrade[]): KnownGrade | undefined => (
  [...grades].sort((a, b) => GRADE_ORDER[b] - GRADE_ORDER[a])[0]
)

export class RockAssessmentService {
  constructor(
    private readonly dataSource: RockAssessmentDataSource = new DefaultRockAssessmentDataSource(),
    private readonly provenance?: TaskDataProvenance,
  ) {}

  async assess(range: ChainageRange): Promise<RockAssessmentResult> {
    const [segments, faces] = await Promise.all([
      this.dataSource.loadDesignSegments(),
      this.dataSource.loadFaceRecords(),
    ])
    if (this.provenance) {
      await Promise.all([
        this.provenance.capture('rock.design-grades', '/data/tunnel/design-rock-grades.json', segments),
        this.provenance.capture('rock.face-sketch', 'bundled:face-sketch/data.ts', faces),
      ])
    }
    const designRange = toDesignRange(range)
    const designMatches = segments.flatMap((segment) => {
      const start = chainageService.tryParse(segment.startMileage)
      const end = chainageService.tryParse(segment.endMileage)
      const grade = normalizeGrade(segment.grade)
      return start !== undefined && end !== undefined && grade && overlaps(designRange, { start, end })
        ? [{ grade, segment }]
        : []
    })
    const faceMatches = faces.filter((face) => (
      face.mileageValue >= range.start && face.mileageValue <= range.end
    ))
    const faceGrades = faceMatches
      .map((face) => normalizeGrade(face.correctedGrade))
      .filter((grade): grade is KnownGrade => grade !== undefined)
    const grade = worstGrade([
      ...designMatches.map(({ grade: matched }) => matched),
      ...faceGrades,
    ])

    if (!grade) {
      return {
        grade: 'unknown',
        anomalies: ['任务里程范围内没有可用的围岩分级证据'],
        confidence: 0,
        evidence: [],
      }
    }

    const anomalies = new Set<string>()
    for (const face of faceMatches) {
      if (face.integrity.includes('破碎')) anomalies.add('围岩局部破碎')
      if (face.waterInflow >= 30 || face.waterState.includes('流')) anomalies.add('掌子面出水风险')
      if (face.faceState.includes('掉块') || face.faceState.includes('松弛')) anomalies.add('掌子面松弛掉块风险')
    }
    if (faceMatches.length === 0 && grade === 'V') anomalies.add('V级软弱围岩风险')
    if (faceMatches.length === 0 && grade === 'IV') anomalies.add('IV级围岩局部稳定性风险')

    const evidence = [
      ...designMatches.map(({ segment }) => `设计分级 ${segment.startMileage}–${segment.endMileage}: ${segment.grade}`),
      ...faceMatches.map((face) => `掌子面素描 ${face.mileage}: ${face.correctedGrade}`),
    ]
    const confidence = faceMatches.length > 0 ? 0.92 : 0.75
    return { grade, anomalies: [...anomalies], confidence, evidence }
  }
}

export const createRockAssessmentHandler = (
  service = new RockAssessmentService(),
): StepActionHandler => async ({ task }) => {
  const result = await service.assess(task.chainageRange)
  return {
    outputs: {
      'rock.grade': result.grade,
      'rock.anomalies': result.anomalies,
      'rock.confidence': result.confidence,
    },
    metadata: {
      confidence: {
        'rock.grade': result.confidence,
        'rock.anomalies': result.confidence,
        'rock.confidence': 1,
      },
    },
  }
}
