import { describe, expect, it } from 'vitest'
import { toOpenAIMessages } from '../../backend/src/ai-agent/providers/openai-compatible.js'
import { toClaudeMessages } from '../../backend/src/ai-agent/providers/claude.js'
import { toOllamaMessages } from '../../backend/src/ai-agent/providers/ollama.js'

const transcript = [
  { role: 'user', content: '创建质量检查任务' },
  {
    role: 'assistant', content: '',
    tool_calls: [{
      id: 'call-1', name: 'create_task',
      input: { description: '检查支护', start: 278330, end: 278340 },
    }],
  },
  { role: 'tool', content: '{"ok":true,"taskId":"quality-1"}', tool_call_id: 'call-1', name: 'create_task' },
]

describe('agent provider tool-result messages', () => {
  it('preserves OpenAI tool call ids and function arguments', () => {
    expect(toOpenAIMessages(transcript)).toEqual([
      { role: 'user', content: '创建质量检查任务' },
      {
        role: 'assistant', content: null,
        tool_calls: [{
          id: 'call-1', type: 'function',
          function: {
            name: 'create_task',
            arguments: '{"description":"检查支护","start":278330,"end":278340}',
          },
        }],
      },
      { role: 'tool', content: '{"ok":true,"taskId":"quality-1"}', tool_call_id: 'call-1' },
    ])
  })

  it('converts the same transcript to Claude tool_use/tool_result blocks', () => {
    const converted = toClaudeMessages(transcript)
    expect(converted[1].content[0]).toMatchObject({
      type: 'tool_use', id: 'call-1', name: 'create_task',
    })
    expect(converted[2]).toEqual({
      role: 'user',
      content: [{
        type: 'tool_result', tool_use_id: 'call-1',
        content: '{"ok":true,"taskId":"quality-1"}',
      }],
    })
  })

  it('converts tool calls and results to Ollama chat messages', () => {
    const converted = toOllamaMessages(transcript)
    expect(converted[1]).toMatchObject({
      role: 'assistant',
      tool_calls: [{ function: { name: 'create_task' } }],
    })
    expect(converted[2]).toEqual({
      role: 'tool', content: '{"ok":true,"taskId":"quality-1"}', tool_name: 'create_task',
    })
  })
})
