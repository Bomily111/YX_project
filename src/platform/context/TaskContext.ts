import type { ChainageRange } from '@/platform/resources/types'

export type TaskType = 'construction' | 'quality-check' | 'risk-response' | 'scene-exploration'

export interface TaskContext {
  taskId: string
  taskType: TaskType
  description: string
  tunnelId: string
  chainageRange: ChainageRange
  process?: string
  targetTypes: string[]
  targetState?: string
  time?: { start?: string; end?: string }
  constraints?: { maxLoadMb?: number; minFps?: number }
}

export const TASK_TYPES = ['construction', 'quality-check', 'risk-response', 'scene-exploration'] as const

/** 可交给表单、智能体和后端共同使用的任务结构约束。 */
export const TASK_CONTEXT_SCHEMA = {
  $id: 'https://digital-twin.local/schema/task-context.json',
  type: 'object',
  additionalProperties: false,
  required: ['taskId', 'taskType', 'description', 'tunnelId', 'chainageRange', 'targetTypes'],
  properties: {
    taskId: { type: 'string', minLength: 1 },
    taskType: { enum: TASK_TYPES },
    description: { type: 'string', minLength: 1 },
    tunnelId: { type: 'string', minLength: 1 },
    chainageRange: {
      type: 'object',
      additionalProperties: false,
      required: ['start', 'end'],
      properties: {
        start: { type: 'number', minimum: 0 },
        end: { type: 'number', minimum: 0 },
      },
    },
    process: { type: 'string', minLength: 1 },
    targetTypes: {
      type: 'array',
      minItems: 1,
      uniqueItems: true,
      items: { type: 'string', minLength: 1 },
    },
    targetState: { type: 'string', minLength: 1 },
    time: {
      type: 'object',
      additionalProperties: false,
      properties: {
        start: { type: 'string', format: 'date-time' },
        end: { type: 'string', format: 'date-time' },
      },
    },
    constraints: {
      type: 'object',
      additionalProperties: false,
      properties: {
        maxLoadMb: { type: 'number', exclusiveMinimum: 0 },
        minFps: { type: 'number', minimum: 1, maximum: 240 },
      },
    },
  },
} as const

export type TaskValidationCode =
  | 'required'
  | 'invalid-value'
  | 'out-of-range'
  | 'unknown-tunnel'
  | 'unknown-target'

export interface TaskValidationIssue {
  path: string
  code: TaskValidationCode
  message: string
}

export interface TaskValidationOptions {
  chainageBounds?: ChainageRange
  tunnelExists?: (tunnelId: string) => boolean
  targetTypeExists?: (targetType: string) => boolean
}

export interface TaskValidationResult {
  valid: boolean
  issues: readonly TaskValidationIssue[]
}

const isNonEmpty = (value: string | undefined): value is string => Boolean(value?.trim())
const isValidDateTime = (value: string | undefined): boolean => value === undefined || !Number.isNaN(Date.parse(value))

/**
 * JSON Schema 之外的确定性业务校验。调用方必须在校验通过后才能触发场景操作。
 */
export function validateTaskContext(
  task: TaskContext,
  options: TaskValidationOptions = {},
): TaskValidationResult {
  const issues: TaskValidationIssue[] = []
  const requiredStrings: Array<[keyof Pick<TaskContext, 'taskId' | 'description' | 'tunnelId'>, string]> = [
    ['taskId', task.taskId],
    ['description', task.description],
    ['tunnelId', task.tunnelId],
  ]
  for (const [key, value] of requiredStrings) {
    if (!isNonEmpty(value)) issues.push({ path: key, code: 'required', message: `${key} 不能为空` })
  }

  if (!TASK_TYPES.includes(task.taskType)) {
    issues.push({ path: 'taskType', code: 'invalid-value', message: `不支持的任务类型：${task.taskType}` })
  }

  const { start, end } = task.chainageRange
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) {
    issues.push({
      path: 'chainageRange',
      code: 'invalid-value',
      message: '里程范围必须是非负有限数，且起点不能大于终点',
    })
  } else if (
    options.chainageBounds
    && (start < options.chainageBounds.start || end > options.chainageBounds.end)
  ) {
    issues.push({
      path: 'chainageRange',
      code: 'out-of-range',
      message: `里程范围超出可用区间 ${options.chainageBounds.start}–${options.chainageBounds.end}`,
    })
  }

  const normalizedTargets = task.targetTypes.map((target) => target.trim()).filter(Boolean)
  if (normalizedTargets.length === 0) {
    issues.push({ path: 'targetTypes', code: 'required', message: '至少需要一个目标类型' })
  } else if (new Set(normalizedTargets).size !== normalizedTargets.length) {
    issues.push({ path: 'targetTypes', code: 'invalid-value', message: '目标类型不能重复' })
  }

  if (options.tunnelExists && isNonEmpty(task.tunnelId) && !options.tunnelExists(task.tunnelId)) {
    issues.push({ path: 'tunnelId', code: 'unknown-tunnel', message: `隧洞不存在：${task.tunnelId}` })
  }
  if (options.targetTypeExists) {
    for (const targetType of normalizedTargets) {
      if (!options.targetTypeExists(targetType)) {
        issues.push({ path: 'targetTypes', code: 'unknown-target', message: `目标类型不存在：${targetType}` })
      }
    }
  }

  if (!isValidDateTime(task.time?.start)) {
    issues.push({ path: 'time.start', code: 'invalid-value', message: '开始时间格式无效' })
  }
  if (!isValidDateTime(task.time?.end)) {
    issues.push({ path: 'time.end', code: 'invalid-value', message: '结束时间格式无效' })
  }
  if (
    task.time?.start
    && task.time.end
    && isValidDateTime(task.time.start)
    && isValidDateTime(task.time.end)
    && Date.parse(task.time.start) > Date.parse(task.time.end)
  ) {
    issues.push({ path: 'time', code: 'invalid-value', message: '开始时间不能晚于结束时间' })
  }

  if (task.constraints?.maxLoadMb !== undefined && task.constraints.maxLoadMb <= 0) {
    issues.push({ path: 'constraints.maxLoadMb', code: 'invalid-value', message: '最大加载量必须大于 0' })
  }
  if (
    task.constraints?.minFps !== undefined
    && (task.constraints.minFps < 1 || task.constraints.minFps > 240)
  ) {
    issues.push({ path: 'constraints.minFps', code: 'invalid-value', message: '最低帧率必须在 1–240 之间' })
  }

  return { valid: issues.length === 0, issues }
}
