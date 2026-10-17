import type { TaskContext } from '@/platform/context/TaskContext'
import type { ModuleCapability } from '@/platform/modules/types'
import type { BusinessSceneModule } from '@/platform/resources/types'

export type TaskStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

export interface TaskStep {
  stepId: string
  name: string
  module: BusinessSceneModule
  dependsOn: string[]
  inputKeys: string[]
  outputKeys: string[]
  action: string
  requiredCapabilities?: ModuleCapability[]
  completionRule: Record<string, unknown>
  status: TaskStepStatus
}

export interface SharedContextValue {
  value: unknown
  source: { kind: 'task'; id: string } | { kind: 'step'; id: string }
  recordedAt: string
  confidence?: number
}

export interface WorkflowPlan {
  taskId: string
  steps: TaskStep[]
  currentStepId?: string
  sharedContext: Record<string, SharedContextValue>
}

export interface TaskTemplate {
  id: string
  taskType: TaskContext['taskType']
  displayName: string
  createSteps(task: TaskContext): TaskStep[]
}

export const TASK_STEP_SCHEMA = {
  $id: 'https://digital-twin.local/schema/task-step.json',
  type: 'object',
  additionalProperties: false,
  required: [
    'stepId', 'name', 'module', 'dependsOn', 'inputKeys', 'outputKeys',
    'action', 'completionRule', 'status',
  ],
  properties: {
    stepId: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
    module: { enum: ['rock', 'blast', 'support', 'dispatch', 'ventilation'] },
    dependsOn: { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1 } },
    inputKeys: { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1 } },
    outputKeys: { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1 } },
    action: { type: 'string', minLength: 1 },
    requiredCapabilities: {
      type: 'array',
      uniqueItems: true,
      items: { type: 'string', minLength: 1 },
    },
    completionRule: { type: 'object' },
    status: { enum: ['pending', 'running', 'completed', 'failed', 'skipped'] },
  },
} as const

export const WORKFLOW_PLAN_SCHEMA = {
  $id: 'https://digital-twin.local/schema/workflow-plan.json',
  type: 'object',
  additionalProperties: false,
  required: ['taskId', 'steps', 'sharedContext'],
  properties: {
    taskId: { type: 'string', minLength: 1 },
    steps: { type: 'array', minItems: 1, items: { $ref: TASK_STEP_SCHEMA.$id } },
    currentStepId: { type: 'string', minLength: 1 },
    sharedContext: { type: 'object' },
  },
} as const

export const TASK_INPUT_KEYS = new Set([
  'task.taskId',
  'task.taskType',
  'task.description',
  'task.tunnelId',
  'task.chainageRange',
  'task.process',
  'task.targetTypes',
  'task.targetState',
  'task.time',
  'task.constraints',
])
