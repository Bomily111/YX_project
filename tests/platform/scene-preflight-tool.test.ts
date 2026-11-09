import { expect, it, vi } from 'vitest'
const inspect = vi.hoisted(() => vi.fn())
vi.mock('@/platform/tasks/TaskWorkflowBridge', () => ({ getTaskWorkflowController: () => ({ inspectScene: inspect }) }))
import { workflowTools } from '@/ai-agent/tools/workflow.tools'
import { wantsDirectSceneAssembly } from '@/ai-agent/AgentDispatchIntent'
it('routes an explicit preflight away from assembly', () => {
  expect(wantsDirectSceneAssembly('YK1+346检查TSP与TEM能否同屏，不执行')).toBe(false)
})
it('returns an incompatibility report without preparing or running a task', async () => {
  inspect.mockReturnValue({ compatible: false, reason: '解释体不能同屏', resourceIds: ['rock.tsp-hardness', 'rock.tem-resistivity'], filesVerified: false, targetDataVerified: false })
  const output = JSON.parse(await workflowTools.find(item => item.tool.name === 'check_scene_assembly')!.executor({ targetMileage: 'YK1+346', resourceIds: ['rock.tsp-hardness', 'rock.tem-resistivity'] }))
  expect(output.ok).toBe(true)
  expect(output.compatible).toBe(false)
  expect(output.filesVerified).toBe(false)
  expect(inspect).toHaveBeenCalledWith(expect.objectContaining({ assemblyModes: ['replace', 'retain'], targetMileage: 'YK1+346' }))
})
