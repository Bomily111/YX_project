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
  const fullwidth = '在 ＹＫ１＋３４６ 展示三台阶和后方5米初支'
  expect(resolveClarifiedSceneRequest('支护用ZZ-IVb', fullwidth)).toBe(`${fullwidth}\n用户补充：支护用ZZ-IVb`)
  expect(resolveClarifiedSceneRequest('ＹＫ４＋０００查看爆后点云', fullwidth)).toBe('ＹＫ４＋０００查看爆后点云')
  expect(resolveClarifiedSceneRequest('支护用ZZ-IVb', '准备来源 X1DK2+905 的模型和支护')).toBe('支护用ZZ-IVb')
})
it('binds a standalone mileage answer only to a pending request without a target', () => {
  const pending = '请同屏展示爆后点云和稳态风场，不用炮孔设计图'
  for (const message of ['YK4+000', '工点是 ＹＫ４＋０００。', '目标里程：DK280+984']) {
    expect(resolveClarifiedSceneRequest(message, pending)).toBe(`${pending}\n用户补充：${message}`)
  }
  for (const message of ['YK4+000 请改为展示风机', '不要用YK4+000', 'YK4+000还是YK2+244', '来源 X1DK2+905']) {
    expect(resolveClarifiedSceneRequest(message, pending)).toBe(message)
  }
  expect(resolveClarifiedSceneRequest('YK4+000', `YK2+244 ${pending}`)).toBe('YK4+000')
  expect(resolveClarifiedSceneRequest('YK4+000', `论文测试工段${pending}`)).toBe('YK4+000')
})
const clarificationCases = [
  { field: 'test-support-type', request: '准备ＹＫ１＋３４６初期支护交底场景', reply: '看完整性与支护关系，支护用ZZ-Va', question: '支护类型是什么？' },
  { field: 'target-mileage', request: '请同屏展示爆后点云和稳态风场，不用炮孔设计图', reply: '工点是 ＹＫ４＋０００。', question: '本次是哪个工点？' },
]
it.each([
  ['支护型号用ZZ-IVb。', '工点是 ＹＫ１＋３４６。'],
  ['工点是 ＹＫ１＋３４６。', '支护型号用ZZ-IVb。'],
])('retains both answers in order: %s then %s', (first, second) => {
  const request = '请同屏展示前方三台阶与后方5米初支，沿用已有模型'
  const partial = resolveClarifiedSceneRequest(first, request)
  expect(resolveClarifiedSceneRequest(second, partial)).toBe(`${request}\n用户补充：${first}\n用户补充：${second}`)
  expect(resolveClarifiedSceneRequest('当前支护改用ZZ-IVb', request)).toBe('当前支护改用ZZ-IVb')
})
it.each(clarificationCases.flatMap(test => ['model-question', 'platform-rejection'].map(mode => ({ ...test, mode }))))(
  'carries the original request after $mode for $field', async ({ field, request, reply, question, mode }) => {
  registerTools('common', [{ module: 'common', tool: { name: 'assemble_scene_at_mileage', description: 'assemble', input_schema: { type: 'object' } }, executor: async () => '{}' }])
  let turn = 0
  vi.stubGlobal('fetch', vi.fn(async () => {
    const events = ++turn === 1 && mode === 'model-question' ? [{ type: 'content_block_delta', delta: { type: 'text_delta', text: question } }] : [
      { type: 'content_block_start', content_block: { type: 'tool_use', id: 'assembly', name: 'assemble_scene_at_mileage' } },
      { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{"userRequest":"model-forged"}' } },
      { type: 'content_block_stop' },
    ]
    return new Response(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(''))
  }))
  const calls: any[] = []
  const callbacks = { onText: () => {}, onComplete: () => {}, onError: (error: Error) => { throw error }, onToolUse: async (tool: any) => {
    calls.push(tool)
    return turn === 1 ? JSON.stringify({ ok: false, clarification: field }) : '{}'
  } }
  const engine = new AgentEngine('test')
  await engine.chat(request, {}, callbacks)
  expect(calls).toHaveLength(mode === 'model-question' ? 0 : 1)
  await engine.chat(reply, {}, callbacks)
  const resolved = calls.at(-1).input.userRequest
  expect(calls).toHaveLength(mode === 'model-question' ? 1 : 2)
  expect(resolved).toBe(`${request}\n用户补充：${reply}`)
})
