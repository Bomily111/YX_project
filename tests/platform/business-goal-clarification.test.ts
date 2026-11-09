import { afterEach, expect, it, vi } from 'vitest'
import { resolveClarifiedSceneRequest } from '@/ai-agent/AgentDispatchIntent'
import { AgentEngine } from '@/ai-agent/AgentEngine'
import { registerTools, unregisterModule } from '@/ai-agent/ToolRegistry'
afterEach(() => { vi.unstubAllGlobals(); unregisterModule('common') })
it('uses only an explicit pending location for a relevant clarification', () => {
  const pending = '准备YK2+244初期支护交底场景'
  expect(resolveClarifiedSceneRequest('看完整性与支护关系，支护用ZZ-Va', pending)).toContain('YK2+244')
  for (const message of ['准备另一个通风场景', '看看空气流动方向和流线', '你好', '取消', 'YK4+000查看流线']) expect(resolveClarifiedSceneRequest(message, pending)).toBe(message)
  expect(resolveClarifiedSceneRequest('看ZZ-Va支护', '准备支护场景')).toBe('看ZZ-Va支护')
})
it('carries a just-clarified user location into assembly validation rather than a model-provided request', async () => {
  registerTools('common', [{ module: 'common', tool: { name: 'assemble_scene_at_mileage', description: 'assemble', input_schema: { type: 'object' } }, executor: async () => '{}' }])
  let turn = 0
  vi.stubGlobal('fetch', vi.fn(async () => {
    const events = ++turn === 1 ? [{ type: 'content_block_delta', delta: { type: 'text_delta', text: '本次核对哪类围岩信息，支护类型是什么？' } }] : [
      { type: 'content_block_start', content_block: { type: 'tool_use', id: 'assembly', name: 'assemble_scene_at_mileage' } },
      { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{"userRequest":"model-forged"}' } },
      { type: 'content_block_stop' },
    ]
    return new Response(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(''))
  }))
  const calls: any[] = []
  const callbacks = { onText: () => {}, onComplete: () => {}, onError: (error: Error) => { throw error }, onToolUse: async (tool: any) => { calls.push(tool); return '{}' } }
  const engine = new AgentEngine('test')
  await engine.chat('准备YK2+244初期支护交底场景', {}, callbacks)
  expect(calls).toHaveLength(0)
  await engine.chat('看完整性与支护关系，支护用ZZ-Va', {}, callbacks)
  expect(calls).toHaveLength(1)
  expect(calls[0].input.userRequest).toContain('YK2+244')
  expect(calls[0].input.userRequest).toContain('支护用ZZ-Va')
  expect(calls[0].input.userRequest).not.toContain('model-forged')
})
