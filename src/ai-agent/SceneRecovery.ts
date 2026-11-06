import type { AgentTaskWorkflowStatus } from '@/platform/tasks/TaskWorkflowBridge'

export function canRetrySceneLoad(status: AgentTaskWorkflowStatus): boolean {
  return status.status === 'failed' && status.completed === 0 && !!status.taskId &&
    !status.lastCompletedStage && /HTTP\s*(502|503|504)|Failed to fetch|NetworkError|fetch failed/i.test(status.notice?.message ?? '') &&
    !/回滚|rollback|清理失败/i.test(status.notice?.message ?? '')
}
