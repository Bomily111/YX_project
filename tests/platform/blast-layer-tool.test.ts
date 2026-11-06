import { beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ model: undefined as any, nodes: { holes: { show: true }, pointcloud: { show: true } } }))
vi.mock('@/views/tunnel-module/blast', () => ({
  getBlastModel: () => state.model,
  setBlastLayerVisible: (key: 'holes' | 'pointcloud', visible: boolean) => { state.nodes[key].show = visible },
}))
vi.mock('@/platform/tasks/TaskWorkflowBridge', () => ({ hasTaskWorkflowController: () => false }))
import { workflowTools } from '@/ai-agent/tools/workflow.tools'
const run = async (input: Record<string, unknown>) => JSON.parse(await workflowTools.find(item => item.tool.name === 'set_blast_layers')!.executor(input))
beforeEach(() => {
  state.nodes = { holes: { show: true }, pointcloud: { show: true } }
  state.model = { ready: true, show: true, getNode: (key: keyof typeof state.nodes) => state.nodes[key] }
})
it('reads actual node states and preserves the unspecified layer', async () => {
  expect((await run({ pointcloud: false })).layers).toEqual({ holes: true, pointcloud: false })
  expect((await run({ holes: false })).layers).toEqual({ holes: false, pointcloud: false })
})
it.each([{}, { holes: 'false' }, { holes: false, pointcloud: 1 }])('rejects invalid input before changing either layer: %j', async input => {
  expect((await run(input)).ok).toBe(false)
  expect(state.nodes.holes.show && state.nodes.pointcloud.show).toBe(true)
})
it.each(['absent', 'hidden', 'loading', 'missing-node'])('does not claim success for unavailable blast model: %s', async condition => {
  if (condition === 'absent') state.model = undefined
  if (condition === 'hidden') state.model.show = false
  if (condition === 'loading') state.model.ready = false
  if (condition === 'missing-node') state.model.getNode = () => undefined
  expect((await run({ holes: false })).ok).toBe(false)
  expect(state.nodes.holes.show).toBe(true)
})
