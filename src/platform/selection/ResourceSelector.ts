import type { TaskContext } from '@/platform/context/TaskContext'
import { ResourceRegistry } from '@/platform/resources/ResourceRegistry'
import type { SceneResource } from '@/platform/resources/types'
import type { TaskStep } from '@/platform/tasks/TaskStep'
import type { ScenePlan, SceneResourceDecision } from './ScenePlan'
import {
  calculateTaskRelevance,
  DEFAULT_TASK_RELEVANCE_CONFIG,
  type TaskRelevanceConfig,
  type TaskRelevanceResult,
} from './TaskRelevance'

export interface ResourceSelectorOptions {
  relevanceConfig?: TaskRelevanceConfig
  previousPlan?: ScenePlan
  loadedResourceIds?: ReadonlySet<string>
  /** 默认只检索当前步骤所属模块；显式传入后可支持跨模块参照资源。 */
  candidateResourceIds?: readonly string[]
}

interface ScoredResource {
  resource: SceneResource
  relevance: TaskRelevanceResult
}

const cloneConfig = (config: TaskRelevanceConfig): TaskRelevanceConfig => ({
  weights: { ...config.weights },
  thresholds: { ...config.thresholds },
})

const byPriority = (a: ScoredResource, b: ScoredResource): number => (
  b.relevance.score - a.relevance.score || a.resource.id.localeCompare(b.resource.id)
)

export class ResourceSelector {
  constructor(private readonly registry: ResourceRegistry) {}

  createScenePlan(
    task: TaskContext,
    step: TaskStep,
    options: ResourceSelectorOptions = {},
  ): ScenePlan {
    const config = options.relevanceConfig ?? DEFAULT_TASK_RELEVANCE_CONFIG
    const loaded = options.loadedResourceIds ?? new Set<string>()
    const explicitCandidates = options.candidateResourceIds
    const candidates = explicitCandidates
      ? [...new Set(explicitCandidates)].map((id) => this.registry.require(id))
      : this.registry.list(step.module)

    const scored = candidates
      .filter((resource) => resource.module !== 'common')
      .map((resource) => ({
        resource,
        relevance: calculateTaskRelevance(task, step, resource, config),
      }))
      .sort(byPriority)

    const selected: ScoredResource[] = []
    const excluded: SceneResourceDecision[] = []
    const selectedClosure = new Set<string>()
    let estimatedIncrementalMemoryMb = 0
    const maxLoadMb = task.constraints?.maxLoadMb ?? Number.POSITIVE_INFINITY
    const warnings: string[] = []

    for (const candidate of scored) {
      if (candidate.relevance.role === 'excluded') {
        excluded.push(this.toDecision(candidate, '相关度低于参照阈值'))
        continue
      }
      const closure = this.registry.resolveLoadOrder([candidate.resource.id])
      const incremental = closure.filter((resource) => (
        !loaded.has(resource.id) && !selectedClosure.has(resource.id)
      ))
      const incrementalMemory = incremental.reduce(
        (total, resource) => total + (resource.estimatedMemoryMb ?? 0),
        0,
      )
      if (estimatedIncrementalMemoryMb + incrementalMemory > maxLoadMb) {
        const message = `资源 ${candidate.resource.id} 超出加载预算 ${maxLoadMb} MB`
        excluded.push(this.toDecision(candidate, message))
        warnings.push(message)
        continue
      }
      selected.push(candidate)
      for (const resource of closure) selectedClosure.add(resource.id)
      estimatedIncrementalMemoryMb += incrementalMemory
    }

    const rootResourceIds = selected.map(({ resource }) => resource.id)
    const loadResources = this.registry.resolveLoadOrder(rootResourceIds)
    const selectedIds = new Set(rootResourceIds)
    const rootDecisions = selected.map((candidate) => this.toDecision(candidate))
    const dependencyDecisions = loadResources
      .filter((resource) => !selectedIds.has(resource.id))
      .map<SceneResourceDecision>((resource) => ({
        resourceId: resource.id,
        role: 'dependency',
        relevance: 1,
        reasons: ['由已选根资源依赖'],
        estimatedMemoryMb: resource.estimatedMemoryMb ?? 0,
      }))
    const releaseResourceIds = (options.previousPlan?.rootResourceIds ?? [])
      .filter((id) => !selectedIds.has(id))

    if (rootResourceIds.length === 0) warnings.push(`步骤 ${step.stepId} 没有可加载的业务资源`)
    return {
      taskId: task.taskId,
      stepId: step.stepId,
      rootResourceIds,
      loadOrder: loadResources.map(({ id }) => id),
      releaseResourceIds,
      decisions: [...rootDecisions, ...dependencyDecisions, ...excluded],
      estimatedIncrementalMemoryMb,
      relevanceConfig: cloneConfig(config),
      warnings,
    }
  }

  private toDecision(candidate: ScoredResource, extraReason?: string): SceneResourceDecision {
    return {
      resourceId: candidate.resource.id,
      role: extraReason ? 'excluded' : candidate.relevance.role,
      relevance: candidate.relevance.score,
      breakdown: candidate.relevance.breakdown,
      reasons: extraReason
        ? [...candidate.relevance.reasons, extraReason]
        : candidate.relevance.reasons,
      estimatedMemoryMb: candidate.resource.estimatedMemoryMb ?? 0,
    }
  }
}
