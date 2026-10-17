export type EnhancementStrategyKind =
  | 'visibility'
  | 'opacity'
  | 'highlight'
  | 'risk-color'
  | 'section'
  | 'label'
  | 'standard-view'
  | 'chart'

export type EnhancementConflictGroup = 'visibility' | 'occlusion' | 'color' | 'label' | 'camera' | 'chart'

export interface RgbaColor {
  red: number
  green: number
  blue: number
  alpha: number
}

export interface EnhancementDirective {
  id: string
  resourceId: string
  targetId: string
  strategy: EnhancementStrategyKind
  conflictGroup: EnhancementConflictGroup
  priority: number
  parameters: Readonly<Record<string, unknown>>
}

export interface EnhancementPlan {
  taskId: string
  stepId: string
  directives: readonly EnhancementDirective[]
}

export interface EnhancementDecision {
  directiveId: string
  status: 'applied' | 'suppressed'
  suppressedBy?: string
}

export interface EnhancementExecutionResult {
  status: 'applied' | 'failed'
  plan: EnhancementPlan
  decisions: readonly EnhancementDecision[]
  durationMs: number
  error?: unknown
  rollbackErrors: readonly unknown[]
}

export const ENHANCEMENT_PLAN_SCHEMA = {
  $id: 'https://digital-twin.local/schema/enhancement-plan.json',
  type: 'object',
  additionalProperties: false,
  required: ['taskId', 'stepId', 'directives'],
  properties: {
    taskId: { type: 'string', minLength: 1 },
    stepId: { type: 'string', minLength: 1 },
    directives: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'id', 'resourceId', 'targetId', 'strategy',
          'conflictGroup', 'priority', 'parameters',
        ],
      },
    },
  },
} as const
