import type { TaskContext } from '@/platform/context/TaskContext'
import type { WorkflowPlan } from '@/platform/tasks/TaskStep'
import type { ScenePlan } from '@/platform/selection/ScenePlan'
import type { EnhancementPlan } from '@/platform/enhancement/types'
import type { WorkflowExecutionSnapshot } from '@/platform/tasks/WorkflowExecutor'
import type { ResourceRuntimeState } from '@/platform/resources/ResourceManager'
import type { DataVersion } from '@/platform/telemetry/TaskDataProvenance'

export interface TaskAuditEvent {
  taskId?: string
  source: 'agent' | 'panel' | 'system'
  action: string
  callId?: string
  stepId?: string
  status: string
  durationMs?: number
  inputSummary?: Record<string, unknown>
  resultSummary?: Record<string, unknown>
  rollbackStatus?: 'not-needed' | 'completed' | 'failed'
}

export interface TaskResultSnapshotInput {
  taskId: string
  eventType: 'prepared' | 'step-completed' | 'step-failed' | 'retry' | 'reset' | 'asset-selection'
  stepId?: string
  workflowState: WorkflowExecutionSnapshot & Pick<WorkflowPlan, 'steps' | 'sharedContext'>
  scenePlan: ScenePlan | null
  enhancementPlan: EnhancementPlan | null
  resources: Pick<ResourceRuntimeState, 'id' | 'status' | 'references'>[]
  dataVersions: DataVersion[]
}

export interface TaskResultSnapshot {
  id: string | number
  created_at: string
  task_id: string
  event_type: TaskResultSnapshotInput['eventType']
  step_id: string | null
  workflow_state: TaskResultSnapshotInput['workflowState']
  scene_plan: ScenePlan | null
  enhancement_plan: EnhancementPlan | null
  resources: TaskResultSnapshotInput['resources']
  data_versions: DataVersion[]
}

export interface TaskRunSummary {
  task_id: string
  description: string
  tunnel_id: string
  status: string
  created_at: string
}

async function post(path: string, body: unknown): Promise<void> {
  const response = await fetch(`/api/ai-agent/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const message = await response.json().catch(() => ({}))
    throw new Error(message.error || `任务审计写入失败 (HTTP ${response.status})`)
  }
}

/** 写入经过校验的任务和初始计划，不保存模型对话或页面临时对象。 */
export function recordTaskRun(task: TaskContext, workflowPlan: WorkflowPlan, scenePlans: readonly ScenePlan[]): Promise<void> {
  return post('task-runs', { task, workflowPlan, scenePlans })
}

export function recordTaskEvent(event: TaskAuditEvent): Promise<void> {
  return post('task-events', event)
}

export function recordTaskSnapshot(snapshot: TaskResultSnapshotInput): Promise<void> {
  return post('task-snapshots', snapshot)
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`/api/ai-agent/${path}`)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `任务历史读取失败 (HTTP ${response.status})`)
  }
  return response.json() as Promise<T>
}

export function listTaskRuns(limit = 20): Promise<TaskRunSummary[]> {
  return get(`task-runs?limit=${limit}`)
}

export function listTaskSnapshots(taskId: string): Promise<TaskResultSnapshot[]> {
  return get(`task-runs/${encodeURIComponent(taskId)}/snapshots`)
}

/** 审计参数只保留可复现实验所需的有限 JSON 摘要，过滤凭据与大对象。 */
export function summarizeAuditValue(value: unknown, depth = 0): unknown {
  if (depth > 3) return '[nested]'
  if (typeof value === 'string') return value.slice(0, 300)
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => summarizeAuditValue(item, depth + 1))
  if (!value || typeof value !== 'object') return String(value)
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 30).map(([key, item]) => [
    key,
    /password|secret|token|api.?key|authorization/i.test(key) ? '[redacted]' : summarizeAuditValue(item, depth + 1),
  ]))
}
