import type { TaskContext } from '@/platform/context/TaskContext'
import type { TaskStep } from '@/platform/tasks/TaskStep'
import type { ChainageRange, SceneResource } from '@/platform/resources/types'

export interface TaskRelevanceWeights {
  type: number
  mileage: number
  process: number
  state: number
}

export interface TaskRelevanceThresholds {
  focus: number
  reference: number
}

export interface TaskRelevanceConfig {
  weights: TaskRelevanceWeights
  thresholds: TaskRelevanceThresholds
}

export type ResourceSceneRole = 'focus' | 'reference' | 'excluded'

export interface TaskRelevanceBreakdown {
  typeMatch: number
  mileageMatch: number
  processMatch: number
  stateMatch: number
}

export interface TaskRelevanceResult {
  score: number
  role: ResourceSceneRole
  breakdown: TaskRelevanceBreakdown
  reasons: readonly string[]
}

export const DEFAULT_TASK_RELEVANCE_CONFIG: Readonly<TaskRelevanceConfig> = Object.freeze({
  weights: Object.freeze({ type: 0.35, mileage: 0.3, process: 0.2, state: 0.15 }),
  thresholds: Object.freeze({ focus: 0.7, reference: 0.35 }),
})

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))
const normalize = (value: string): string => value.trim().toLowerCase().replace(/[\s_]+/g, '-')

const validateConfig = (config: TaskRelevanceConfig): void => {
  const weights = Object.values(config.weights)
  const sum = weights.reduce((total, weight) => total + weight, 0)
  if (weights.some((weight) => !Number.isFinite(weight) || weight < 0) || Math.abs(sum - 1) > 1e-9) {
    throw new Error('[TaskRelevance] 权重必须是非负有限数且总和为 1')
  }
  if (
    config.thresholds.focus < config.thresholds.reference
    || config.thresholds.focus > 1
    || config.thresholds.reference < 0
  ) {
    throw new Error('[TaskRelevance] 阈值必须满足 0 <= reference <= focus <= 1')
  }
}

const rangeMatch = (taskRange: ChainageRange, resourceRange?: ChainageRange): number => {
  if (!resourceRange) return 1
  const intersection = Math.max(
    0,
    Math.min(taskRange.end, resourceRange.end) - Math.max(taskRange.start, resourceRange.start),
  )
  const taskLength = taskRange.end - taskRange.start
  if (taskLength === 0) {
    return taskRange.start >= resourceRange.start && taskRange.start <= resourceRange.end ? 1 : 0
  }
  return clamp01(intersection / taskLength)
}

const listMatch = (query: string | undefined, candidates: readonly string[]): number => {
  if (!query) return 1
  if (candidates.length === 0) return 0.5
  const normalizedQuery = normalize(query)
  return candidates.some((candidate) => normalize(candidate) === normalizedQuery) ? 1 : 0
}

const typeMatch = (task: TaskContext, step: TaskStep, resource: SceneResource): number => {
  const targets = new Set(task.targetTypes.map(normalize))
  const resourceType = normalize(resource.type)
  const module = normalize(resource.module)
  if (targets.has(resourceType) || targets.has(module)) return 1

  for (const target of targets) {
    if (resourceType.includes(target) || target.includes(resourceType)) return 0.9
  }
  return resource.module === step.module ? 0.7 : 0
}

/** 固定权重、无大模型参与的可解释相关度计算。 */
export function calculateTaskRelevance(
  task: TaskContext,
  step: TaskStep,
  resource: SceneResource,
  config: TaskRelevanceConfig = DEFAULT_TASK_RELEVANCE_CONFIG,
): TaskRelevanceResult {
  validateConfig(config)
  const breakdown: TaskRelevanceBreakdown = {
    typeMatch: typeMatch(task, step, resource),
    mileageMatch: rangeMatch(task.chainageRange, resource.chainageRange),
    processMatch: listMatch(task.process, resource.processes),
    stateMatch: listMatch(task.targetState, resource.states),
  }
  const weightedScore = (
    config.weights.type * breakdown.typeMatch
    + config.weights.mileage * breakdown.mileageMatch
    + config.weights.process * breakdown.processMatch
    + config.weights.state * breakdown.stateMatch
  )
  const score = clamp01(Number(weightedScore.toFixed(6)))
  const role: ResourceSceneRole = score >= config.thresholds.focus
    ? 'focus'
    : score >= config.thresholds.reference
      ? 'reference'
      : 'excluded'
  const reasons = [
    `类型匹配 ${breakdown.typeMatch.toFixed(2)}`,
    `里程匹配 ${breakdown.mileageMatch.toFixed(2)}`,
    `工序匹配 ${breakdown.processMatch.toFixed(2)}`,
    `状态匹配 ${breakdown.stateMatch.toFixed(2)}`,
  ]
  return { score, role, breakdown, reasons }
}
