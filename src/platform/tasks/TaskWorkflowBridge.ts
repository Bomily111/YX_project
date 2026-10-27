export interface AgentTaskWorkflowInput {
  description?: string
  tunnelId?: string
  start?: number
  end?: number
  maxLoadMb?: number
}

export interface AgentSceneWorkflowInput {
  description: string
  resourceIds: string[]
  /** Explicit target on the YK centerline; legacy DK input is normalized at the agent boundary. */
  targetMileage?: string
  enhancementModes?: string[]
  assemblyModes?: string[]
  tunnelId?: string
  maxLoadMb?: number
}

export interface AgentTaskWorkflowStatus {
  available: boolean
  prepared: boolean
  taskId?: string
  status?: string
  currentStepId?: string
  completed: number
  total: number
  steps: Array<{ stepId: string; name: string; module: string; status: string }>
  contextKeys: string[]
  scenePlans: Array<{ stepId: string; resources: string[]; estimatedMemoryMb: number; enhancementMode?: string; assemblyMode?: string }>
  lastCompletedStage?: { stepId: string; assembledResourceIds: string[]; chainageRange: { start: number; end: number }; note?: string }
  notice?: { type: string; title: string; message: string }
}

export interface TaskWorkflowController {
  prepare(input: AgentTaskWorkflowInput): Promise<AgentTaskWorkflowStatus>
  prepareScene(input: AgentSceneWorkflowInput): Promise<AgentTaskWorkflowStatus>
  reviseSceneAssembly(input: { taskId: string; stepId: string; mode: string }): Promise<AgentTaskWorkflowStatus>
  executeNext(): Promise<AgentTaskWorkflowStatus>
  runAll(): Promise<AgentTaskWorkflowStatus>
  retryFailed(): Promise<AgentTaskWorkflowStatus>
  reset(): Promise<AgentTaskWorkflowStatus>
  getStatus(): AgentTaskWorkflowStatus
}

let activeController: TaskWorkflowController | undefined

export function registerTaskWorkflowController(controller: TaskWorkflowController): () => void {
  activeController = controller
  return () => {
    if (activeController === controller) activeController = undefined
  }
}

export function getTaskWorkflowController(): TaskWorkflowController {
  if (!activeController) throw new Error('任务工作流面板尚未挂载')
  return activeController
}

export function hasTaskWorkflowController(): boolean {
  return Boolean(activeController)
}
