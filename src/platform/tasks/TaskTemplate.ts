import type { TaskContext } from '@/platform/context/TaskContext'
import type { TaskStep, TaskTemplate } from './TaskStep'

const pendingStep = (
  task: TaskContext,
  suffix: string,
  step: Omit<TaskStep, 'stepId' | 'status'>,
): TaskStep => ({
  ...step,
  stepId: `${task.taskId}:${suffix}`,
  status: 'pending',
})

export const constructionTemplate: TaskTemplate = {
  id: 'construction.standard.v1',
  taskType: 'construction',
  displayName: '施工组织标准流程',
  createSteps: (task) => {
    const rock = pendingStep(task, 'rock-state', {
      name: '识别掌子面与围岩状态',
      module: 'rock',
      dependsOn: [],
      inputKeys: ['task.chainageRange', 'task.targetTypes'],
      outputKeys: ['rock.grade', 'rock.anomalies'],
      action: 'rock.analyze-state',
      requiredCapabilities: ['query', 'locate'],
      completionRule: { requiredOutputs: ['rock.grade'] },
    })
    const blast = pendingStep(task, 'blast-review', {
      name: '复核爆破参数',
      module: 'blast',
      dependsOn: [rock.stepId],
      inputKeys: ['task.chainageRange', 'rock.grade'],
      outputKeys: ['blast.parameterReview'],
      action: 'blast.review-parameters',
      requiredCapabilities: ['query', 'standard-view'],
      completionRule: { requiredOutputs: ['blast.parameterReview'] },
    })
    const dispatch = pendingStep(task, 'dispatch-plan', {
      name: '编制人员设备组织方案',
      module: 'dispatch',
      dependsOn: [blast.stepId],
      inputKeys: ['task.chainageRange', 'blast.parameterReview'],
      outputKeys: ['dispatch.resourcePlan', 'task.summary'],
      action: 'dispatch.plan-resources',
      requiredCapabilities: ['query', 'chart'],
      completionRule: { requiredOutputs: ['dispatch.resourcePlan', 'task.summary'] },
    })
    return [rock, blast, dispatch]
  },
}

export const qualityCheckTemplate: TaskTemplate = {
  id: 'quality-check.support.v1',
  taskType: 'quality-check',
  displayName: '围岩与初期支护质量检查流程',
  createSteps: (task) => {
    const rock = pendingStep(task, 'rock-assessment', {
      name: '评估围岩等级与异常',
      module: 'rock',
      dependsOn: [],
      inputKeys: ['task.chainageRange', 'task.targetTypes'],
      outputKeys: ['rock.grade', 'rock.anomalies', 'rock.confidence'],
      action: 'rock.assess-quality',
      requiredCapabilities: ['query', 'locate'],
      completionRule: { requiredOutputs: ['rock.grade', 'rock.confidence'] },
    })
    const support = pendingStep(task, 'support-check', {
      name: '检查初期支护适配性',
      module: 'support',
      dependsOn: [rock.stepId],
      inputKeys: ['task.chainageRange', 'rock.grade', 'rock.anomalies'],
      outputKeys: ['support.deviation', 'support.assessment', 'task.summary'],
      action: 'support.check-adaptation',
      requiredCapabilities: ['standard-view', 'pick'],
      completionRule: { requiredOutputs: ['support.assessment', 'task.summary'] },
    })
    return [rock, support]
  },
}

export const riskResponseTemplate: TaskTemplate = {
  id: 'risk-response.ventilation.v1',
  taskType: 'risk-response',
  displayName: '通风异常风险处置流程',
  createSteps: (task) => {
    const ventilation = pendingStep(task, 'ventilation-assessment', {
      name: '分析通风异常范围与趋势',
      module: 'ventilation',
      dependsOn: [],
      inputKeys: ['task.chainageRange', 'task.targetState'],
      outputKeys: ['ventilation.riskLevel', 'ventilation.affectedRange'],
      action: 'ventilation.assess-risk',
      requiredCapabilities: ['query', 'chart', 'section'],
      completionRule: { requiredOutputs: ['ventilation.riskLevel', 'ventilation.affectedRange'] },
    })
    const dispatch = pendingStep(task, 'dispatch-response', {
      name: '制定人员设备处置方案',
      module: 'dispatch',
      dependsOn: [ventilation.stepId],
      inputKeys: ['ventilation.riskLevel', 'ventilation.affectedRange'],
      outputKeys: ['dispatch.responsePlan', 'task.summary'],
      action: 'dispatch.plan-response',
      requiredCapabilities: ['query', 'locate'],
      completionRule: { requiredOutputs: ['dispatch.responsePlan', 'task.summary'] },
    })
    return [ventilation, dispatch]
  },
}

export const DEFAULT_TASK_TEMPLATES: readonly TaskTemplate[] = [
  constructionTemplate,
  qualityCheckTemplate,
  riskResponseTemplate,
]
