import type { TaskContext } from '@/platform/context/TaskContext'
import type { ModuleCapability } from '@/platform/modules/types'
import type { BusinessSceneModule } from '@/platform/resources/types'
import { TASK_INPUT_KEYS, type TaskStep, type WorkflowPlan } from './TaskStep'

export type WorkflowValidationCode =
  | 'task-mismatch'
  | 'empty-plan'
  | 'duplicate-step'
  | 'invalid-step'
  | 'unknown-dependency'
  | 'dependency-order'
  | 'cyclic-dependency'
  | 'missing-input'
  | 'duplicate-output'
  | 'capability-mismatch'
  | 'invalid-current-step'

export interface WorkflowValidationIssue {
  path: string
  code: WorkflowValidationCode
  message: string
}

export interface WorkflowValidationResult {
  valid: boolean
  issues: readonly WorkflowValidationIssue[]
}

export type ModuleCapabilityCatalog = Readonly<
  Partial<Record<BusinessSceneModule, readonly ModuleCapability[]>>
>

export const DEFAULT_MODULE_CAPABILITIES: ModuleCapabilityCatalog = {
  rock: ['query', 'locate', 'visibility', 'opacity', 'highlight', 'section', 'standard-view', 'chart', 'pick'],
  blast: ['query', 'locate', 'visibility', 'opacity', 'standard-view', 'pick'],
  support: ['visibility', 'opacity', 'standard-view', 'pick'],
  dispatch: ['query', 'locate', 'visibility', 'chart', 'pick'],
  ventilation: ['query', 'locate', 'visibility', 'opacity', 'section', 'standard-view', 'chart', 'pick'],
}

const hasDuplicates = (items: readonly string[]): boolean => new Set(items).size !== items.length

const collectAncestors = (
  step: TaskStep,
  stepsById: ReadonlyMap<string, TaskStep>,
  collected = new Set<string>(),
): Set<string> => {
  for (const dependencyId of step.dependsOn) {
    if (collected.has(dependencyId)) continue
    collected.add(dependencyId)
    const dependency = stepsById.get(dependencyId)
    if (dependency) collectAncestors(dependency, stepsById, collected)
  }
  return collected
}

export class WorkflowValidator {
  constructor(private readonly capabilities: ModuleCapabilityCatalog = DEFAULT_MODULE_CAPABILITIES) {}

  validate(plan: WorkflowPlan, task?: TaskContext): WorkflowValidationResult {
    const issues: WorkflowValidationIssue[] = []
    if (task && plan.taskId !== task.taskId) {
      issues.push({ path: 'taskId', code: 'task-mismatch', message: '流程 taskId 与任务不一致' })
    }
    if (!plan.taskId.trim()) {
      issues.push({ path: 'taskId', code: 'invalid-step', message: '流程 taskId 不能为空' })
    }
    if (plan.steps.length === 0) {
      issues.push({ path: 'steps', code: 'empty-plan', message: '流程至少需要一个步骤' })
      return { valid: false, issues }
    }

    const stepsById = new Map<string, TaskStep>()
    const stepIndexes = new Map<string, number>()
    for (const [index, step] of plan.steps.entries()) {
      const path = `steps[${index}]`
      if (!step.stepId.trim() || !step.name.trim() || !step.action.trim()) {
        issues.push({ path, code: 'invalid-step', message: '步骤 ID、名称和 action 不能为空' })
      }
      if (stepsById.has(step.stepId)) {
        issues.push({ path: `${path}.stepId`, code: 'duplicate-step', message: `步骤 ID 重复：${step.stepId}` })
      } else {
        stepsById.set(step.stepId, step)
        stepIndexes.set(step.stepId, index)
      }
      if (hasDuplicates(step.dependsOn) || hasDuplicates(step.inputKeys) || hasDuplicates(step.outputKeys)) {
        issues.push({ path, code: 'invalid-step', message: '依赖、输入和输出字段均不能重复' })
      }
      if (step.outputKeys.some((key) => !key.trim())) {
        issues.push({ path: `${path}.outputKeys`, code: 'invalid-step', message: '输出字段不能为空' })
      }
      const requiredOutputs = step.completionRule.requiredOutputs
      if (
        requiredOutputs !== undefined
        && (!Array.isArray(requiredOutputs)
          || requiredOutputs.some((key) => typeof key !== 'string' || !step.outputKeys.includes(key)))
      ) {
        issues.push({
          path: `${path}.completionRule.requiredOutputs`,
          code: 'invalid-step',
          message: '完成条件只能引用当前步骤声明的输出字段',
        })
      }

      const moduleCapabilities = this.capabilities[step.module]
      for (const capability of step.requiredCapabilities ?? []) {
        if (!moduleCapabilities?.includes(capability)) {
          issues.push({
            path: `${path}.requiredCapabilities`,
            code: 'capability-mismatch',
            message: `模块 ${step.module} 不支持能力 ${capability}`,
          })
        }
      }
    }

    const outputOwners = new Map<string, string>()
    for (const [index, step] of plan.steps.entries()) {
      for (const outputKey of step.outputKeys) {
        const owner = outputOwners.get(outputKey)
        if (owner) {
          issues.push({
            path: `steps[${index}].outputKeys`,
            code: 'duplicate-output',
            message: `输出字段 ${outputKey} 已由步骤 ${owner} 声明`,
          })
        } else {
          outputOwners.set(outputKey, step.stepId)
        }
      }
      for (const dependencyId of step.dependsOn) {
        const dependencyIndex = stepIndexes.get(dependencyId)
        if (dependencyIndex === undefined) {
          issues.push({
            path: `steps[${index}].dependsOn`,
            code: 'unknown-dependency',
            message: `依赖步骤不存在：${dependencyId}`,
          })
        } else if (dependencyIndex >= index) {
          issues.push({
            path: `steps[${index}].dependsOn`,
            code: 'dependency-order',
            message: `依赖步骤必须排在当前步骤之前：${dependencyId}`,
          })
        }
      }
    }

    const visiting = new Set<string>()
    const visited = new Set<string>()
    const visit = (stepId: string): boolean => {
      if (visiting.has(stepId)) return true
      if (visited.has(stepId)) return false
      visiting.add(stepId)
      const step = stepsById.get(stepId)
      const cyclic = step?.dependsOn.some((dependencyId) => stepsById.has(dependencyId) && visit(dependencyId)) ?? false
      visiting.delete(stepId)
      visited.add(stepId)
      return cyclic
    }
    if ([...stepsById.keys()].some(visit)) {
      issues.push({ path: 'steps', code: 'cyclic-dependency', message: '步骤依赖存在循环' })
    }

    const initialKeys = new Set([...TASK_INPUT_KEYS, ...Object.keys(plan.sharedContext)])
    for (const [index, step] of plan.steps.entries()) {
      const availableKeys = new Set(initialKeys)
      for (const ancestorId of collectAncestors(step, stepsById)) {
        for (const outputKey of stepsById.get(ancestorId)?.outputKeys ?? []) availableKeys.add(outputKey)
      }
      for (const inputKey of step.inputKeys) {
        if (!availableKeys.has(inputKey)) {
          issues.push({
            path: `steps[${index}].inputKeys`,
            code: 'missing-input',
            message: `输入 ${inputKey} 不来自任务、共享上下文或前置步骤`,
          })
        }
      }
    }

    if (plan.currentStepId && !stepsById.has(plan.currentStepId)) {
      issues.push({
        path: 'currentStepId',
        code: 'invalid-current-step',
        message: `当前步骤不存在：${plan.currentStepId}`,
      })
    }

    return { valid: issues.length === 0, issues }
  }
}

export const workflowValidator = new WorkflowValidator()
