import {
  validateTaskContext,
  type TaskContext,
  type TaskValidationOptions,
} from '@/platform/context/TaskContext'
import { DEFAULT_TASK_TEMPLATES } from './TaskTemplate'
import type { TaskTemplate, WorkflowPlan } from './TaskStep'
import { WorkflowValidator, type ModuleCapabilityCatalog } from './WorkflowValidator'

export class WorkflowPlanningError extends Error {
  constructor(
    message: string,
    readonly issues: readonly { path: string; code: string; message: string }[],
  ) {
    super(message)
    this.name = 'WorkflowPlanningError'
  }
}

export interface WorkflowPlannerOptions {
  templates?: readonly TaskTemplate[]
  capabilities?: ModuleCapabilityCatalog
  taskValidation?: TaskValidationOptions
}

/** 根据已校验的任务生成确定性的模板流程。智能体计划也应再交给 WorkflowValidator。 */
export class WorkflowPlanner {
  private readonly templates: readonly TaskTemplate[]
  private readonly validator: WorkflowValidator
  private readonly taskValidation: TaskValidationOptions

  constructor(options: WorkflowPlannerOptions = {}) {
    this.templates = options.templates ?? DEFAULT_TASK_TEMPLATES
    this.validator = new WorkflowValidator(options.capabilities)
    this.taskValidation = options.taskValidation ?? {}
  }

  create(task: TaskContext, templateId?: string): WorkflowPlan {
    const taskValidation = validateTaskContext(task, this.taskValidation)
    if (!taskValidation.valid) {
      throw new WorkflowPlanningError('任务上下文校验失败', taskValidation.issues)
    }

    const template = templateId
      ? this.templates.find((candidate) => candidate.id === templateId)
      : this.templates.find((candidate) => candidate.taskType === task.taskType)
    if (!template) {
      throw new WorkflowPlanningError('没有匹配的任务模板', [{
        path: 'taskType',
        code: 'missing-template',
        message: templateId ? `任务模板不存在：${templateId}` : `任务类型没有模板：${task.taskType}`,
      }])
    }
    if (template.taskType !== task.taskType) {
      throw new WorkflowPlanningError('任务模板类型不匹配', [{
        path: 'taskType',
        code: 'template-mismatch',
        message: `模板 ${template.id} 不适用于 ${task.taskType}`,
      }])
    }

    const steps = template.createSteps(task)
    const plan: WorkflowPlan = {
      taskId: task.taskId,
      steps,
      currentStepId: steps[0]?.stepId,
      sharedContext: {},
    }
    const validation = this.validator.validate(plan, task)
    if (!validation.valid) throw new WorkflowPlanningError('工作流计划校验失败', validation.issues)
    return plan
  }
}

export const workflowPlanner = new WorkflowPlanner()
