// ── Claude API 适配器 ─────────────────────────────────────

import { getLLMConfig } from '../config.js'

/**
 * 发送流式聊天到 Anthropic API，通过回调输出标准化 SSE 事件
 */
export async function streamChat(params, onEvent) {
  const llmConfig = getLLMConfig('claude')

  if (!llmConfig.apiKey) {
    throw new Error('Claude API Key 未配置')
  }

  const { messages, tools, system, model: modelOverride } = params

  const anthropicTools = tools?.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  })) || undefined

  const body = {
    model: modelOverride || llmConfig.model,
    max_tokens: 2048,
    system,
    messages: toClaudeMessages(messages),
    tools: anthropicTools,
    stream: true,
  }

  const response = await fetch(`${llmConfig.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': llmConfig.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Unknown error')
    throw new Error(`Claude API error (${response.status}): ${errText}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)
      if (data === '[DONE]') continue

      try {
        const event = JSON.parse(data)
        switch (event.type) {
          case 'content_block_start':
          case 'content_block_delta':
          case 'content_block_stop':
            onEvent(event)
            break
          case 'message_stop':
            onEvent({ type: 'message_stop' })
            return
        }
      } catch { /* 忽略解析错误 */ }
    }
  }

  onEvent({ type: 'message_stop' })
}

export function toClaudeMessages(messages) {
  return messages.map((message) => {
    if (message.role === 'assistant' && message.tool_calls?.length) {
      const content = []
      if (message.content) content.push({ type: 'text', text: message.content })
      content.push(...message.tool_calls.map((call) => ({
        type: 'tool_use', id: call.id, name: call.name, input: call.input ?? {},
      })))
      return { role: 'assistant', content }
    }
    if (message.role === 'tool') {
      return {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: message.tool_call_id,
          content: message.content,
        }],
      }
    }
    return { role: message.role, content: message.content }
  })
}
