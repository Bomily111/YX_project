import { describe, expect, it } from 'vitest'
import {
  validateTaskContext,
  type TaskContext,
} from '@/platform/context/TaskContext'
import type { TaskStep, WorkflowPlan } from '@/platform/tasks/TaskStep'
import { WorkflowPlanner, WorkflowPlanningError } from '@/platform/tasks/WorkflowPlanner'
import { WorkflowValidator } from '@/platform/tasks/WorkflowValidator'
import { readStepInputs, writeStepOutputs } from '@/platform/tasks/WorkflowContext'

const task = (overrides: Partial<TaskContext> = {}): TaskContext => ({
  taskId: 'task-001',
  taskType: 'quality-check',
  description: '检查 YK1+130 至 YK1+150 围岩变化后初期支护是否合理',
  tunnelId: 'tunnel-main',
  chainageRange: { start: 1130, end: 1150 },
  targetTypes: ['surrounding-rock', 'initial-support'],
  ...overrides,
})

const step = (overrides: Partial<TaskStep> = {}): TaskStep => ({
  stepId: 'step-a',
  name: '步骤 A',
  module: 'rock',
  dependsOn: [],
  inputKeys: ['task.chainageRange'],
  outputKeys: ['rock.grade'],
  action: 'rock.analyze',
  requiredCapabilities: ['query'],
  completionRule: { requiredOutputs: ['rock.grade'] },
  status: 'pending',
  ...overrides,
})

const plan = (steps: TaskStep[]): WorkflowPlan => ({
  taskId: 'task-001',
  steps,
  currentStepId: steps[0]?.stepId,
  sharedContext: {},
})

describe('TaskContext validation', () => {
  it('accepts a valid task and applies external business boundaries', () => {
    const result = validateTaskContext(task(), {
      chainageBounds: { start: 1116, end: 1250 },
      tunnelExists: (id) => id === 'tunnel-main',
      targetTypeExists: (type) => ['surrounding-rock', 'initial-support'].includes(type),
    })
    expect(result).toEqual({ valid: true, issues: [] })
  })

  it('rejects invalid range, duplicate targets, time and constraints together', () => {
    const result = validateTaskContext(task({
      chainageRange: { start: 1200, end: 1100 },
      targetTypes: ['rock', 'rock'],
      time: { start: '2026-10-11T10:00:00Z', end: '2026-10-10T10:00:00Z' },
      constraints: { maxLoadMb: 0, minFps: 300 },
    }))
    expect(result.valid).toBe(false)
    expect(result.issues.map(({ path }) => path)).toEqual(expect.arrayContaining([
      'chainageRange',
      'targetTypes',
      'time',
      'constraints.maxLoadMb',
      'constraints.minFps',
    ]))
  })
})

describe('WorkflowPlanner', () => {
  it.each([
    ['construction', ['rock', 'blast', 'dispatch']],
    ['quality-check', ['rock', 'support']],
    ['risk-response', ['ventilation', 'dispatch']],
  ] as const)('creates a deterministic %s workflow', (taskType, modules) => {
    const planner = new WorkflowPlanner()
    const first = planner.create(task({ taskType, taskId: `task-${taskType}` }))
    const second = planner.create(task({ taskType, taskId: `task-${taskType}` }))
    expect(first).toEqual(second)
    expect(first.steps.map(({ module }) => module)).toEqual(modules)
    expect(first.currentStepId).toBe(first.steps[0]?.stepId)
  })

  it('does not create scene workflow for an invalid task', () => {
    const planner = new WorkflowPlanner({ taskValidation: { chainageBounds: { start: 1116, end: 1200 } } })
    expect(() => planner.create(task({ chainageRange: { start: 1190, end: 1210 } })))
      .toThrow(WorkflowPlanningError)
  })
})

describe('WorkflowValidator', () => {
  const validator = new WorkflowValidator()

  it('accepts inputs produced by a transitive dependency', () => {
    const first = step()
    const second = step({
      stepId: 'step-b',
      dependsOn: ['step-a'],
      inputKeys: ['rock.grade'],
      outputKeys: ['blast.review'],
      module: 'blast',
      requiredCapabilities: ['query'],
      completionRule: { requiredOutputs: ['blast.review'] },
    })
    const third = step({
      stepId: 'step-c',
      dependsOn: ['step-b'],
      inputKeys: ['rock.grade', 'blast.review'],
      outputKeys: ['support.result'],
      module: 'support',
      requiredCapabilities: ['pick'],
      completionRule: { requiredOutputs: ['support.result'] },
    })
    expect(validator.validate(plan([first, second, third]), task()).valid).toBe(true)
  })

  it('rejects missing dependencies, unavailable inputs and duplicate outputs', () => {
    const result = validator.validate(plan([
      step(),
      step({
        stepId: 'step-b',
        dependsOn: ['missing-step'],
        inputKeys: ['rock.undeclared'],
        outputKeys: ['rock.grade'],
        completionRule: { requiredOutputs: ['rock.grade'] },
      }),
    ]), task())
    expect(result.valid).toBe(false)
    expect(result.issues.map(({ code }) => code)).toEqual(expect.arrayContaining([
      'unknown-dependency',
      'missing-input',
      'duplicate-output',
    ]))
  })

  it('rejects dependency cycles and forward dependency order', () => {
    const result = validator.validate(plan([
      step({ stepId: 'step-a', dependsOn: ['step-b'] }),
      step({
        stepId: 'step-b',
        dependsOn: ['step-a'],
        outputKeys: ['rock.other'],
        completionRule: { requiredOutputs: ['rock.other'] },
      }),
    ]), task())
    expect(result.issues.map(({ code }) => code)).toEqual(expect.arrayContaining([
      'cyclic-dependency',
      'dependency-order',
    ]))
  })

  it('rejects a module capability mismatch', () => {
    const result = new WorkflowValidator({ rock: ['locate'] }).validate(plan([step()]), task())
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'capability-mismatch' }))
  })
})

describe('WorkflowContext', () => {
  it('writes declared outputs with provenance and exposes only declared inputs', () => {
    const workflow = new WorkflowPlanner().create(task())
    const rockStep = workflow.steps[0]
    const supportStep = workflow.steps[1]
    writeStepOutputs(workflow, rockStep.stepId, {
      'rock.grade': 'IV',
      'rock.anomalies': ['局部破碎'],
      'rock.confidence': 0.91,
    }, { recordedAt: '2026-10-11T00:00:00.000Z', confidence: 0.9 })

    expect(workflow.sharedContext['rock.grade']).toEqual({
      value: 'IV',
      source: { kind: 'step', id: rockStep.stepId },
      recordedAt: '2026-10-11T00:00:00.000Z',
      confidence: 0.9,
    })
    expect(readStepInputs(workflow, supportStep, task())).toEqual({
      'task.chainageRange': { start: 1130, end: 1150 },
      'rock.grade': 'IV',
      'rock.anomalies': ['局部破碎'],
    })
  })

  it('rejects undeclared outputs and invalid confidence', () => {
    const workflow = plan([step()])
    expect(() => writeStepOutputs(workflow, 'step-a', { 'rock.secret': true })).toThrow('未声明输出')
    expect(() => writeStepOutputs(workflow, 'step-a', { 'rock.grade': 'IV' }, { confidence: 1.2 }))
      .toThrow('置信度')
    expect(workflow.sharedContext).toEqual({})
  })
})
