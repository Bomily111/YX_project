import { afterEach, describe, expect, it, vi } from 'vitest'
import { workflowTools, resolveAssemblyMileage } from '@/ai-agent/tools/workflow.tools'
import { aiEvents } from '@/ai-agent/events'
import { viewerService } from '@/platform/viewer/ViewerService'
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
  vi.restoreAllMocks()
})

const tool = (name: string) => {
  const registration = workflowTools.find(({ tool }) => tool.name === name)
  if (!registration) throw new Error(`工具不存在：${name}`)
  return registration
}

describe('agent workflow tools', () => {
  it('anchors the assembly target to the user wording rather than a model-invented mileage', () => {
    expect(resolveAssemblyMileage(278330, '在 DK278+330 主场景装配围岩')).toBe('DK278+330')
    expect(() => resolveAssemblyMileage('DK278+330', '装配围岩')).toThrow('用户未明确')
    expect(() => resolveAssemblyMileage('DK278+330', '对比 DK278+330 和 DK278+400')).toThrow('多个里程')
  })

  it('assembles one validated main scene at the requested centerline position', async () => {
    const prepared: AgentTaskWorkflowStatus = {
      ...ready(), taskId: 'scene-one', status: 'ready', currentStepId: 'scene-1',
      completed: 0, total: 1,
      steps: [{ stepId: 'scene-1', name: '展示设计围岩', module: 'rock', status: 'pending' }],
      scenePlans: [{ stepId: 'scene-1', resources: ['rock.design-grade'], estimatedMemoryMb: 1101 }],
    }
    const completed: AgentTaskWorkflowStatus = {
      ...prepared, status: 'completed', currentStepId: undefined, completed: 1,
      lastCompletedStage: { stepId: 'scene-1', assembledResourceIds: ['rock.design-grade'], chainageRange: { start: 1346, end: 1346 } },
    }
    const prepareScene = vi.fn(async () => prepared)
    const executeNext = vi.fn(async () => completed)
    unregister = registerTaskWorkflowController({ prepareScene, executeNext } as unknown as TaskWorkflowController)
    const lookAt = vi.fn()
    vi.spyOn(viewerService, 'require').mockReturnValue({ camera: {
      lookAt, lookAtTransform: vi.fn(), moveRight: vi.fn(),
    }, scene: { requestRender: vi.fn() } } as never)

    const output = JSON.parse(await tool('assemble_scene_at_mileage').executor({
      description: '展示目标里程的设计围岩', targetMileage: 'DK278+330', resourceIds: ['rock.design-grade'],
    }))
    expect(prepareScene).toHaveBeenCalledWith(expect.objectContaining({
      targetMileage: 'YK1+346', resourceIds: ['rock.design-grade'], assemblyModes: ['replace'],
    }))
    expect(executeNext).toHaveBeenCalledOnce()
    expect(lookAt).toHaveBeenCalledTimes(2)
    expect(output).toMatchObject({ ok: true, targetMileage: 'YK1+346', requestedMileage: 'DK278+330', assembledResourceIds: ['rock.design-grade'] })
  })

  it('passes the model-selected enhancement modes into the validated scene task', async () => {
    const prepareScene = vi.fn(async () => ready())
    unregister = registerTaskWorkflowController({ prepareScene } as unknown as TaskWorkflowController)
    await tool('prepare_platform_task').executor({
      kind: 'scene-exploration', description: '先突出围岩，再看支护与背景关系',
      resourceIds: ['rock.design-grade', 'support.legacy-assembly'],
      enhancementModes: ['emphasis', 'context'], assemblyModes: ['replace', 'retain'],
    })
    expect(prepareScene).toHaveBeenCalledWith(expect.objectContaining({
      resourceIds: ['rock.design-grade', 'support.legacy-assembly'],
      enhancementModes: ['emphasis', 'context'],
      assemblyModes: ['replace', 'retain'],
    }))
    await expect(tool('prepare_platform_task').executor({
      kind: 'scene-exploration', description: '非法增强输入',
      resourceIds: ['rock.design-grade'], enhancementModes: 'emphasis',
    })).rejects.toThrow('字符串数组')
    await expect(tool('prepare_platform_task').executor({
      kind: 'scene-exploration', description: '不应调度参数化钢架试验',
      resourceIds: ['support.scene'],
    })).rejects.toThrow('当前不可调度资源')
  })

  it('routes a feedback-based assembly revision to the same task controller', async () => {
    const reviseSceneAssembly = vi.fn(async () => ready())
    unregister = registerTaskWorkflowController({ reviseSceneAssembly } as unknown as TaskWorkflowController)
    const output = JSON.parse(await tool('revise_next_scene_assembly').executor({
      taskId: 'scene-1', currentStepId: 'scene-2', mode: 'retain',
    }))
    expect(reviseSceneAssembly).toHaveBeenCalledWith({ taskId: 'scene-1', stepId: 'scene-2', mode: 'retain' })
    expect(output.action).toBe('revise_next_scene_assembly')
  })

  it('accepts the returned currentStepId as the next-step tool argument', async () => {
    const executeNext = vi.fn(async () => ({ ...ready(), completed: 1, currentStepId: 'support-check' }))
    unregister = registerTaskWorkflowController({
      getStatus: () => ready(), executeNext,
    } as unknown as TaskWorkflowController)
    const output = JSON.parse(await tool('advance_platform_task').executor({
      taskId: 'quality-agent-1', currentStepId: 'rock-assessment',
    }))
    expect(output).toMatchObject({ ok: true, completed: 1, currentStepId: 'support-check' })
    expect(executeNext).toHaveBeenCalledOnce()
  })
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
      description: '检查初期支护质量', start: 1346, end: 1356,
    }))

    expect(opened).not.toHaveBeenCalled()
    expect(prepare).toHaveBeenCalledWith({
      description: '检查初期支护质量', start: 1346, end: 1356,
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

    expect(prepare).toHaveBeenCalledWith(expect.objectContaining({ start: 1346, end: 1356 }))
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
