import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getTaskWorkflowController,
  hasTaskWorkflowController,
  registerTaskWorkflowController,
  type AgentTaskWorkflowStatus,
  type TaskWorkflowController,
} from '@/platform/tasks/TaskWorkflowBridge'

const status = (overrides: Partial<AgentTaskWorkflowStatus> = {}): AgentTaskWorkflowStatus => ({
  available: true,
  prepared: true,
  taskId: 'quality-1',
  status: 'ready',
  completed: 0,
  total: 2,
  steps: [],
  contextKeys: [],
  scenePlans: [],
  ...overrides,
})

let unregister: (() => void) | undefined

afterEach(() => {
  unregister?.()
  unregister = undefined
})

describe('TaskWorkflowBridge', () => {
  it('shares one workflow controller between the task panel and agent tools', async () => {
    const controller: TaskWorkflowController = {
      prepare: vi.fn(async () => status()),
      executeNext: vi.fn(async () => status({ completed: 1, currentStepId: 'support-check' })),
      runAll: vi.fn(async () => status({ status: 'completed', completed: 2 })),
      retryFailed: vi.fn(async () => status({ completed: 1 })),
      reset: vi.fn(async () => status({ prepared: true })),
      getStatus: vi.fn(() => status()),
    }
    unregister = registerTaskWorkflowController(controller)

    expect(hasTaskWorkflowController()).toBe(true)
    const shared = getTaskWorkflowController()
    await shared.prepare({ description: '检查支护质量', start: 278330, end: 278340 })
    expect(controller.prepare).toHaveBeenCalledWith({
      description: '检查支护质量', start: 278330, end: 278340,
    })
    expect((await shared.executeNext()).completed).toBe(1)
    expect((await shared.runAll()).status).toBe('completed')
  })

  it('removes only the controller that owns the active registration', () => {
    const first = { getStatus: () => status() } as TaskWorkflowController
    const second = { getStatus: () => status({ taskId: 'quality-2' }) } as TaskWorkflowController
    const unregisterFirst = registerTaskWorkflowController(first)
    unregister = registerTaskWorkflowController(second)

    unregisterFirst()
    expect(getTaskWorkflowController()).toBe(second)
    unregister()
    unregister = undefined
    expect(hasTaskWorkflowController()).toBe(false)
    expect(() => getTaskWorkflowController()).toThrow('尚未挂载')
  })
})
