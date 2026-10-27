import { describe, expect, it, vi } from 'vitest'
import { advancePlatformTask, orchestratePlatformTask } from '@/ai-agent/TaskOrchestrator'
import type { AgentTaskWorkflowStatus, TaskWorkflowController } from '@/platform/tasks/TaskWorkflowBridge'

const status = (completed: number, state: string): AgentTaskWorkflowStatus => ({
  available: true, prepared: true, taskId: 'task-1', status: state,
  currentStepId: completed === 0 ? 'rock' : completed === 1 ? 'support' : undefined,
  completed, total: 2,
  steps: [
    { stepId: 'rock', name: '围岩', module: 'rock', status: completed > 0 ? 'completed' : 'pending' },
    { stepId: 'support', name: '支护', module: 'support', status: completed > 1 ? 'completed' : 'pending' },
  ],
  contextKeys: [],
  scenePlans: [
    { stepId: 'rock', resources: ['rock.design-grade'], estimatedMemoryMb: 1 },
    { stepId: 'support', resources: ['support.legacy-assembly'], estimatedMemoryMb: 2 },
  ],
})

describe('goal-driven platform dispatch', () => {
  it('requires a fresh task and current step before each model-directed advance', async () => {
    const executeNext = vi.fn(async () => status(1, 'ready'))
    const controller = { getStatus: () => status(0, 'ready'), executeNext } as unknown as TaskWorkflowController
    expect((await advancePlatformTask(controller, 'stale-task', 'rock')).reason).toContain('替换')
    expect((await advancePlatformTask(controller, 'task-1', 'support')).reason).toContain('不一致')
    expect(executeNext).not.toHaveBeenCalled()
    const result = await advancePlatformTask(controller, 'task-1', 'rock')
    expect(result.ok).toBe(true)
    expect(result.dispatchTrace).toMatchObject([{ stepId: 'rock', completed: 1 }])
    expect(executeNext).toHaveBeenCalledOnce()
  })

  it('stops model-directed advance on failure', async () => {
    const controller = {
      getStatus: () => status(0, 'ready'),
      executeNext: async () => ({ ...status(0, 'failed'), notice: { type: 'error', title: '失败', message: '体素加载超时' } }),
    } as unknown as TaskWorkflowController
    const result = await advancePlatformTask(controller, 'task-1', 'rock')
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('体素加载超时')
  })
  it('prepares, dispatches and observes each quality-check step', async () => {
    const prepare = vi.fn(async () => status(0, 'ready'))
    const executeNext = vi.fn()
      .mockResolvedValueOnce(status(1, 'ready'))
      .mockResolvedValueOnce(status(2, 'completed'))
    const outcome = await orchestratePlatformTask({ prepare, executeNext } as unknown as TaskWorkflowController,
      { kind: 'quality-check', input: { description: '检查支护', start: 278330, end: 278340 } })
    expect(outcome.ok).toBe(true)
    expect(outcome.dispatchTrace.map(item => [item.stepId, item.resources, item.completed])).toEqual([
      ['rock', ['rock.design-grade'], 1],
      ['support', ['support.legacy-assembly'], 2],
    ])
    expect(executeNext).toHaveBeenCalledTimes(2)
  })

  it('stops on failure without dispatching a later step', async () => {
    const executeNext = vi.fn(async () => ({ ...status(0, 'failed'), notice: { type: 'error', title: '失败', message: '模型加载失败' } }))
    const outcome = await orchestratePlatformTask({ prepareScene: async () => status(0, 'ready'), executeNext } as unknown as TaskWorkflowController,
      { kind: 'scene-exploration', input: { description: '展示', resourceIds: ['rock.design-grade', 'support.legacy-assembly'] } })
    expect(outcome.ok).toBe(false)
    expect(outcome.reason).toBe('模型加载失败')
    expect(outcome.dispatchTrace).toHaveLength(1)
    expect(executeNext).toHaveBeenCalledOnce()
  })

  it('does not execute an invalid plan or repeat a stalled step', async () => {
    const executeNext = vi.fn(async () => status(0, 'ready'))
    const invalid = await orchestratePlatformTask({ prepare: async () => ({ ...status(0, 'ready'), prepared: false }), executeNext } as unknown as TaskWorkflowController,
      { kind: 'quality-check', input: { description: '检查支护' } })
    expect(invalid.ok).toBe(false)
    expect(executeNext).not.toHaveBeenCalled()
    const stalled = await orchestratePlatformTask({ prepare: async () => status(0, 'ready'), executeNext } as unknown as TaskWorkflowController,
      { kind: 'quality-check', input: { description: '检查支护' } })
    expect(stalled.reason).toContain('没有推进')
    expect(executeNext).toHaveBeenCalledOnce()
  })
})
