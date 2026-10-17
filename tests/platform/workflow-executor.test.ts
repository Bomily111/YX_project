import { describe, expect, it, vi } from 'vitest'
import type { TaskContext } from '@/platform/context/TaskContext'
import { WorkflowExecutor, WorkflowExecutionError, type StepActionHandler } from '@/platform/tasks/WorkflowExecutor'
import { WorkflowPlanner } from '@/platform/tasks/WorkflowPlanner'
import type { WorkflowPlan } from '@/platform/tasks/TaskStep'

const qualityTask = (): TaskContext => ({
  taskId: 'quality-001',
  taskType: 'quality-check',
  description: '检查围岩变化后初期支护是否合理',
  tunnelId: 'tunnel-main',
  chainageRange: { start: 1130, end: 1150 },
  targetTypes: ['surrounding-rock', 'initial-support'],
})

const createPlan = (): WorkflowPlan => new WorkflowPlanner().create(qualityTask())

const rockOutputs = {
  'rock.grade': 'IV',
  'rock.anomalies': ['局部破碎'],
  'rock.confidence': 0.91,
}

const supportOutputs = {
  'support.deviation': 0.08,
  'support.assessment': '适配',
  'task.summary': '初期支护参数与 IV 级围岩相匹配',
}

const executorWith = (
  handlers: Readonly<Record<string, StepActionHandler>>,
  plan = createPlan(),
): WorkflowExecutor => new WorkflowExecutor(qualityTask(), plan, (action) => handlers[action])

describe('WorkflowExecutor', () => {
  it('runs steps in order and passes controlled outputs to the next step', async () => {
    const supportHandler = vi.fn<StepActionHandler>(({ inputs }) => {
      expect(inputs).toEqual({
        'task.chainageRange': { start: 1130, end: 1150 },
        'rock.grade': 'IV',
        'rock.anomalies': ['局部破碎'],
      })
      return { outputs: supportOutputs }
    })
    const plan = createPlan()
    const executor = executorWith({
      'rock.assess-quality': () => ({ outputs: rockOutputs }),
      'support.check-adaptation': supportHandler,
    }, plan)

    const results = await executor.run()

    expect(results.map(({ status }) => status)).toEqual(['completed', 'completed'])
    expect(plan.steps.map(({ status }) => status)).toEqual(['completed', 'completed'])
    expect(plan.currentStepId).toBeUndefined()
    expect(plan.sharedContext['task.summary']?.value).toContain('IV 级围岩')
    expect(executor.getSnapshot()).toEqual(expect.objectContaining({ status: 'completed', completed: 2 }))
  })

  it('rejects missing required outputs and rolls back partial side effects', async () => {
    const rollback = vi.fn()
    const plan = createPlan()
    const executor = executorWith({
      'rock.assess-quality': () => ({
        outputs: { 'rock.grade': 'IV' },
        rollback,
      }),
    }, plan)

    const result = await executor.executeCurrent()

    expect(result.status).toBe('failed')
    expect(String(result.error)).toContain('rock.confidence')
    expect(rollback).toHaveBeenCalledOnce()
    expect(plan.sharedContext).toEqual({})
  })

  it('uses an early rollback registration when a handler throws midway', async () => {
    const calls: string[] = []
    const plan = createPlan()
    const executor = executorWith({
      'rock.assess-quality': () => ({
        outputs: rockOutputs,
        rollback: () => { calls.push('rock') },
      }),
      'support.check-adaptation': ({ onRollback }) => {
        onRollback(() => { calls.push('support') })
        throw new Error('支护资源加载失败')
      },
    }, plan)

    const results = await executor.run()

    expect(results.at(-1)?.status).toBe('failed')
    expect(calls).toEqual(['support', 'rock'])
    expect(plan.steps.map(({ status }) => status)).toEqual(['pending', 'failed'])
    expect(plan.sharedContext).toEqual({})
  })

  it('restarts from rolled-back dependencies when retrying a failed step', async () => {
    let shouldFail = true
    const plan = createPlan()
    const executor = executorWith({
      'rock.assess-quality': () => ({ outputs: rockOutputs }),
      'support.check-adaptation': () => {
        if (shouldFail) throw new Error('temporary failure')
        return { outputs: supportOutputs }
      },
    }, plan)

    await executor.run()
    shouldFail = false
    executor.retry(plan.steps[1].stepId)

    expect(plan.currentStepId).toBe(plan.steps[0].stepId)
    expect((await executor.run()).map(({ status }) => status)).toEqual(['completed', 'completed'])
  })

  it('cascades skip to dependent steps', () => {
    const plan = createPlan()
    const executor = executorWith({}, plan)

    executor.skip(plan.steps[0].stepId)

    expect(plan.steps.map(({ status }) => status)).toEqual(['skipped', 'skipped'])
    expect(executor.getSnapshot()).toEqual(expect.objectContaining({ status: 'completed', skipped: 2 }))
  })

  it('fails cleanly when an action has no registered handler', async () => {
    const plan = createPlan()
    const result = await executorWith({}, plan).executeCurrent()
    expect(result.status).toBe('failed')
    expect(String(result.error)).toContain('未注册动作处理器')
  })

  it('prevents concurrent execution of the same plan', async () => {
    let release: (() => void) | undefined
    const waiting = new Promise<void>((resolve) => { release = resolve })
    const executor = executorWith({
      'rock.assess-quality': async () => {
        await waiting
        return { outputs: rockOutputs }
      },
    })

    const first = executor.executeCurrent()
    await expect(executor.executeCurrent()).rejects.toThrow(WorkflowExecutionError)
    release?.()
    await first
  })

  it('resets outputs and invokes completed-step rollbacks in reverse order', async () => {
    const calls: string[] = []
    const plan = createPlan()
    const executor = executorWith({
      'rock.assess-quality': () => ({
        outputs: rockOutputs,
        rollback: () => { calls.push('rock') },
      }),
      'support.check-adaptation': () => ({
        outputs: supportOutputs,
        rollback: () => { calls.push('support') },
      }),
    }, plan)
    await executor.run()

    await executor.reset()

    expect(calls).toEqual(['support', 'rock'])
    expect(plan.steps.map(({ status }) => status)).toEqual(['pending', 'pending'])
    expect(plan.sharedContext).toEqual({})
    expect(plan.currentStepId).toBe(plan.steps[0].stepId)
  })
})
