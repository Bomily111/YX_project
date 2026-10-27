import { afterEach, describe, expect, it, vi } from 'vitest'

describe('DeepSeek request adapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('uses the current model endpoint and non-thinking tool calling contract', async () => {
    vi.stubEnv('LLM_API_KEY', 'test-key')
    vi.stubEnv('LLM_PROVIDER', 'deepseek')
    vi.resetModules()
    const fetchMock = vi.fn(async () => new Response('data: [DONE]\n\n', {
      status: 200, headers: { 'Content-Type': 'text/event-stream' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const { streamChat } = await import('../../backend/src/ai-agent/providers/openai-compatible.js')
    const events: unknown[] = []
    await streamChat({ system: 'test', messages: [], tools: [{ name: 'assemble_scene_at_mileage',
      description: 'assemble', input_schema: { type: 'object', properties: {} } }] },
    event => events.push(event))

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(String(init.body))
    expect(url).toBe('https://api.deepseek.com/chat/completions')
    expect(body.model).toBe('deepseek-flash')
    expect(body.thinking).toEqual({ type: 'disabled' })
    expect(body.tools[0].function.name).toBe('assemble_scene_at_mileage')
    expect(events).toEqual([{ type: 'message_stop' }])
  })
})
