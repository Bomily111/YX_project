import type { TaskContext } from '@/platform/context/TaskContext'
import type { StepActionHandler, StepActionResolver } from '@/platform/tasks/WorkflowExecutor'
import { WorkflowExecutor } from '@/platform/tasks/WorkflowExecutor'
import { WorkflowPlanner } from '@/platform/tasks/WorkflowPlanner'
import { withScenePlan, type ScenePlanWorkflowOptions } from '@/platform/selection/ScenePlanWorkflow'
import {
  createRockAssessmentHandler,
  RockAssessmentService,
} from '@/platform/tasks/actions/RockAssessmentAction'
import {
  createSupportAssessmentHandler,
  SupportAssessmentService,
} from '@/platform/tasks/actions/SupportAssessmentAction'

export interface QualityCheckWorkflowDependencies {
  rockService?: RockAssessmentService
  supportService?: SupportAssessmentService
  rockScene?: ScenePlanWorkflowOptions
  supportScene?: ScenePlanWorkflowOptions
}

export function createQualityCheckActionResolver(
  dependencies: QualityCheckWorkflowDependencies = {},
): StepActionResolver {
  const actions = new Map<string, StepActionHandler>()
  const rock = createRockAssessmentHandler(dependencies.rockService)
  actions.set(
    'rock.assess-quality',
    dependencies.rockScene ? withScenePlan(rock, dependencies.rockScene) : rock,
  )
  const support = createSupportAssessmentHandler(dependencies.supportService)
  actions.set(
    'support.check-adaptation',
    dependencies.supportScene ? withScenePlan(support, dependencies.supportScene) : support,
  )
  return (action) => actions.get(action)
}

export function createQualityCheckExecutor(
  task: TaskContext,
  dependencies: QualityCheckWorkflowDependencies = {},
): WorkflowExecutor {
  if (task.taskType !== 'quality-check') throw new Error('质量检查执行器只接受 quality-check 任务')
  const plan = new WorkflowPlanner().create(task, 'quality-check.support.v1')
  return new WorkflowExecutor(task, plan, createQualityCheckActionResolver(dependencies))
}
