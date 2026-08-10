// ── OpenAI 兼容格式适配器（DeepSeek / Qwen / 通义千问）────

import { getLLMConfig } from '../config.js'

/**
 * 发送流式聊天到 OpenAI 兼容 API，通过回调输出标准化 SSE 事件
 */
export async function streamChat(params, onEvent) {
  const { messages, tools, system, provider: providerOverride } = params
  const llmConfig = getLLMConfig(providerOverride)

  if (!llmConfig.apiKey) {
    throw new Error(`LLM provider "${llmConfig.provider}" 未配置 API Key`)
  }

  const body = {
    model: llmConfig.model,
    messages: [
      { role: 'system', content: system },
      ...messages.map(m => ({ role: m.role, content: m.content })),
    ],
    stream: true,
    temperature: 0.3,
    max_tokens: 2048,
  }

  if (tools && tools.length > 0) {
    body.tools = tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }))
  }

  const response = await fetch(`${llmConfig.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${llmConfig.apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Unknown error')
    throw new Error(`LLM API error (${response.status}): ${errText}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let currentToolCall = null

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
      if (data === '[DONE]') {
        if (currentToolCall) {
          onEvent({ type: 'content_block_stop', index: currentToolCall.index })
          currentToolCall = null
        }
        onEvent({ type: 'message_stop' })
        return
      }

      try {
        const event = JSON.parse(data)
        const choice = event.choices?.[0]
        if (!choice) continue

        const delta = choice.delta

        if (delta?.content) {
          if (currentToolCall) {
            onEvent({ type: 'content_block_stop', index: currentToolCall.index })
            currentToolCall = null
          }
          onEvent({
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: delta.content },
          })
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (tc.id && tc.function?.name) {
              if (currentToolCall) {
                onEvent({ type: 'content_block_stop', index: currentToolCall.index })
              }
              currentToolCall = { id: tc.id, name: tc.function.name, index: tc.index ?? 0 }
              onEvent({
                type: 'content_block_start',
                index: currentToolCall.index,
                content_block: {
                  type: 'tool_use',
                  id: currentToolCall.id,
                  name: currentToolCall.name,
                },
              })
            }
            if (tc.function?.arguments) {
              onEvent({
                type: 'content_block_delta',
                index: currentToolCall?.index ?? 0,
                delta: {
                  type: 'input_json_delta',
                  partial_json: tc.function.arguments,
                },
              })
            }
          }
        }
      } catch { /* 忽略 JSON 解析错误 */ }
    }
  }

  if (currentToolCall) {
    onEvent({ type: 'content_block_stop', index: currentToolCall.index })
  }
  onEvent({ type: 'message_stop' })
}
