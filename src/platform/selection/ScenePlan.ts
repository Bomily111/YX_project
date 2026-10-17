import type { TaskRelevanceBreakdown, TaskRelevanceConfig, ResourceSceneRole } from './TaskRelevance'

export type SceneResourceRole = ResourceSceneRole | 'dependency'

export interface SceneResourceDecision {
  resourceId: string
  role: SceneResourceRole
  relevance: number
  breakdown?: TaskRelevanceBreakdown
  reasons: readonly string[]
  estimatedMemoryMb: number
}

export interface ScenePlan {
  taskId: string
  stepId: string
  /** 交给 ResourceManager.load/release 的根资源，依赖由注册表解析。 */
  rootResourceIds: readonly string[]
  loadOrder: readonly string[]
  releaseResourceIds: readonly string[]
  decisions: readonly SceneResourceDecision[]
  estimatedIncrementalMemoryMb: number
  relevanceConfig: Readonly<TaskRelevanceConfig>
  warnings: readonly string[]
}

export const SCENE_PLAN_SCHEMA = {
  $id: 'https://digital-twin.local/schema/scene-plan.json',
  type: 'object',
  additionalProperties: false,
  required: [
    'taskId', 'stepId', 'rootResourceIds', 'loadOrder', 'releaseResourceIds',
    'decisions', 'estimatedIncrementalMemoryMb', 'relevanceConfig', 'warnings',
  ],
  properties: {
    taskId: { type: 'string', minLength: 1 },
    stepId: { type: 'string', minLength: 1 },
    rootResourceIds: { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1 } },
    loadOrder: { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1 } },
    releaseResourceIds: { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1 } },
    decisions: { type: 'array', items: { type: 'object' } },
    estimatedIncrementalMemoryMb: { type: 'number', minimum: 0 },
    relevanceConfig: { type: 'object' },
    warnings: { type: 'array', items: { type: 'string' } },
  },
} as const
