import { describe, expect, it } from 'vitest'
import { getStreamHandler } from '../../backend/src/ai-agent/engine/LLMFactory.js'
import { toLangChainMessages, toLangChainTools } from '../../backend/src/ai-agent/providers/langchain-deepseek.js'

describe('LangChain DeepSeek bridge', () => {
  it('is the active DeepSeek provider', async () => {
    const handler = await getStreamHandler({ provider: 'deepseek' })
    const provider = await import('../../backend/src/ai-agent/providers/langchain-deepseek.js')
    expect(handler.streamChat).toBe(provider.streamChat)
  })

  it('keeps browser tool results linked to the model call', () => {
    const messages = toLangChainMessages([
      { role: 'user', content: '装配围岩' },
      { role: 'assistant', content: '', tool_calls: [{ id: 'call-1', name: 'assemble_scene_at_mileage',
        input: { targetMileage: 'YK1+346' } }] },
      { role: 'tool', content: '{"ok":true}', tool_call_id: 'call-1', name: 'assemble_scene_at_mileage' },
    ])
    expect(messages.map(message => message._getType())).toEqual(['human', 'ai', 'tool'])
    expect((messages[1] as any).tool_calls[0].args.targetMileage).toBe('YK1+346')
    expect((messages[2] as any).tool_call_id).toBe('call-1')
  })

  it('passes the platform JSON schema to LangChain tool binding', () => {
    expect(toLangChainTools([{ name: 'assemble_scene_at_mileage', description: '装配',
      input_schema: { type: 'object', required: ['targetMileage'] } }])).toEqual([{
      type: 'function', function: { name: 'assemble_scene_at_mileage', description: '装配',
        parameters: { type: 'object', required: ['targetMileage'] } },
    }])
  })
})
