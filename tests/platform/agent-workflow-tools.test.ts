import { afterEach, describe, expect, it, vi } from 'vitest'
import { workflowTools } from '@/ai-agent/tools/workflow.tools'
import { aiEvents } from '@/ai-agent/events'
import {
  registerTaskWorkflowController,
  type AgentTaskWorkflowStatus,
  type TaskWorkflowController,
} from '@/platform/tasks/TaskWorkflowBridge'

const ready = (): AgentTaskWorkflowStatus => ({
  available: true,
  prepared: true,
  taskId: 'quality-agent-1',
  status: 'ready',
  currentStepId: 'rock-assessment',
  completed: 0,
  total: 2,
  steps: [
    { stepId: 'rock-assessment', name: '评估围岩', module: 'rock', status: 'pending' },
    { stepId: 'support-check', name: '检查支护', module: 'support', status: 'pending' },
  ],
  contextKeys: [],
  scenePlans: [{ stepId: 'rock-assessment', resources: ['rock.design-grade'], estimatedMemoryMb: 1 }],
})

let unregister: (() => void) | undefined

afterEach(() => {
  unregister?.()
  unregister = undefined
  aiEvents.all.clear()
})

const tool = (name: string) => {
  const registration = workflowTools.find(({ tool }) => tool.name === name)
  if (!registration) throw new Error(`工具不存在：${name}`)
  return registration
}

describe('agent workflow tools', () => {
  it('creates a task through the shared controller and returns structured status', async () => {
    const prepare = vi.fn(async () => ready())
    const controller = {
      prepare,
      getStatus: () => ready(),
    } as TaskWorkflowController
    unregister = registerTaskWorkflowController(controller)
    const opened = vi.fn()
    aiEvents.on('task:open', opened)

    const output = JSON.parse(await tool('create_task').executor({
      description: '检查初期支护质量', start: 278330, end: 278340,
    }))

    expect(opened).toHaveBeenCalledOnce()
    expect(prepare).toHaveBeenCalledWith({
      description: '检查初期支护质量', start: 278330, end: 278340,
      tunnelId: undefined, maxLoadMb: undefined,
    })
    expect(output).toMatchObject({ ok: true, action: 'create_task', taskId: 'quality-agent-1', total: 2 })
  })

  it('normalizes DK chainages from the description when a model returns only offsets', async () => {
    const prepare = vi.fn(async () => ready())
    unregister = registerTaskWorkflowController({
      prepare,
      getStatus: () => ready(),
    } as TaskWorkflowController)

    await tool('create_task').executor({
      description: '检查 DK278+330 至 DK278+340 初期支护质量',
      start: 330,
      end: 340,
    })

    expect(prepare).toHaveBeenCalledWith(expect.objectContaining({ start: 278330, end: 278340 }))
  })

  it('uses the same session for plan inspection, step execution and reset', async () => {
    const executeNext = vi.fn(async () => ({ ...ready(), completed: 1, currentStepId: 'support-check' }))
    const reset = vi.fn(async () => ready())
    unregister = registerTaskWorkflowController({
      prepare: async () => ready(),
      executeNext,
      runAll: async () => ({ ...ready(), completed: 2, status: 'completed' }),
      retryFailed: async () => ready(),
      reset,
      getStatus: () => ready(),
    })

    const workflow = JSON.parse(await tool('create_workflow').executor({}))
    const step = JSON.parse(await tool('execute_task_step').executor({}))
    const cleared = JSON.parse(await tool('reset_task_scene').executor({}))

    expect(workflow.steps).toHaveLength(2)
    expect(step.completed).toBe(1)
    expect(executeNext).toHaveBeenCalledOnce()
    expect(cleared.completed).toBe(0)
    expect(reset).toHaveBeenCalledOnce()
  })
})
