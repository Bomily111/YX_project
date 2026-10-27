import { afterEach, expect, it, vi } from 'vitest'
import { AgentEngine } from '@/ai-agent/AgentEngine'
import { registerTools, unregisterModule } from '@/ai-agent/ToolRegistry'

afterEach(() => {
  vi.unstubAllGlobals()
  unregisterModule('common')
})

it('keeps multiple tool calls in one assistant turn with linked results', async () => {
  const events = [
    { type: 'content_block_start', content_block: { type: 'tool_use', id: 'call-1', name: 'first' } },
    { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{"a":1}' } },
    { type: 'content_block_stop' },
    { type: 'content_block_start', content_block: { type: 'tool_use', id: 'call-2', name: 'second' } },
    { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{"b":2}' } },
    { type: 'content_block_stop' },
    { type: 'message_stop' },
  ]
  vi.stubGlobal('fetch', vi.fn(async () => new Response(
    `${events.map(event => `data: ${JSON.stringify(event)}\n\n`).join('')}data: [DONE]\n\n`,
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  )))

  const engine = new AgentEngine('test')
  await engine.chat('run both', {}, {
    onText: () => {},
    onToolUse: async tool => JSON.stringify({ ok: true, name: tool.name }),
    onComplete: () => {},
    onError: error => { throw error },
  }, 1)

  const transcript = engine.getMessages()
  expect(transcript.map(message => message.role)).toEqual(['user', 'assistant', 'tool', 'tool'])
  expect(transcript[1].tool_calls?.map(call => call.id)).toEqual(['call-1', 'call-2'])
  expect(transcript.slice(2).map(message => message.tool_call_id)).toEqual(['call-1', 'call-2'])
})

it('exposes only the assembly tool and rejects a second assembly in one scene request', async () => {
  registerTools('common', [
    { module: 'common', tool: { name: 'assemble_scene_at_mileage', description: 'assemble', input_schema: { type: 'object' } }, executor: async () => '{}' },
    { module: 'common', tool: { name: 'fly_to_location', description: 'fly', input_schema: { type: 'object' } }, executor: async () => '{}' },
  ])
  const events = [
    { type: 'content_block_start', content_block: { type: 'tool_use', id: 'assembly-1', name: 'assemble_scene_at_mileage' } },
    { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{"targetMileage":"YK1+346"}' } },
    { type: 'content_block_stop' },
    { type: 'content_block_start', content_block: { type: 'tool_use', id: 'assembly-2', name: 'assemble_scene_at_mileage' } },
    { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{"targetMileage":"YK1+346"}' } },
    { type: 'content_block_stop' },
  ]
  let offeredTools: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
    offeredTools = JSON.parse(String(init?.body)).tools.map((tool: { name: string }) => tool.name)
    return new Response(`${events.map(event => `data: ${JSON.stringify(event)}\n\n`).join('')}data: [DONE]\n\n`,
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
  }))

  const executed: string[] = []
  const engine = new AgentEngine('test')
  await engine.chat('在 YK1+346 展示围岩模型', {}, {
    onText: () => {},
    onToolUse: async tool => {
      executed.push(tool.id)
      return JSON.stringify({ ok: true, action: tool.name })
    },
    onComplete: () => {},
    onError: error => { throw error },
  }, 1)

  expect(offeredTools).toEqual(['assemble_scene_at_mileage'])
  expect(executed).toEqual(['assembly-1'])
  const transcript = engine.getMessages()
  expect(transcript[1].tool_calls?.map(call => call.id)).toEqual(['assembly-1', 'assembly-2'])
  expect(JSON.parse(transcript[3].content)).toMatchObject({ ok: false,
    reason: '本轮场景工具调用已结束，后续调用已拒绝' })
})
