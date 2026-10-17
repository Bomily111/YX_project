// ── Ollama 本地模型适配器 ─────────────────────────────────

import { getLLMConfig } from '../config.js'

/**
 * 发送流式聊天到 Ollama，通过回调输出标准化 SSE 事件
 */
export async function streamChat(params, onEvent) {
  const llmConfig = getLLMConfig('ollama')
  const { messages, tools, system, model: modelOverride } = params

  const body = {
    model: modelOverride || llmConfig.model,
    messages: [
      { role: 'system', content: system },
      ...toOllamaMessages(messages),
    ],
    stream: true,
    options: { temperature: 0.3 },
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

  const response = await fetch(`${llmConfig.baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Unknown error')
    throw new Error(`Ollama API error (${response.status}): ${errText}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let toolSequence = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      try {
        const event = JSON.parse(trimmed)

        if (event.message?.content) {
          onEvent({
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: event.message.content },
          })
        }

        for (const call of event.message?.tool_calls ?? []) {
          const id = call.id || `ollama-tool-${Date.now()}-${toolSequence++}`
          const name = call.function?.name
          if (!name) continue
          const input = call.function?.arguments ?? {}
          onEvent({
            type: 'content_block_start',
            index: toolSequence,
            content_block: { type: 'tool_use', id, name },
          })
          onEvent({
            type: 'content_block_delta',
            index: toolSequence,
            delta: {
              type: 'input_json_delta',
              partial_json: typeof input === 'string' ? input : JSON.stringify(input),
            },
          })
          onEvent({ type: 'content_block_stop', index: toolSequence })
        }

        if (event.done) {
          onEvent({ type: 'message_stop' })
          return
        }
      } catch { /* 跳过非 JSON 行 */ }
    }
  }

  onEvent({ type: 'message_stop' })
}

export function toOllamaMessages(messages) {
  return messages.map((message) => {
    if (message.role === 'assistant' && message.tool_calls?.length) {
      return {
        role: 'assistant',
        content: message.content || '',
        tool_calls: message.tool_calls.map((call) => ({
          function: { name: call.name, arguments: call.input ?? {} },
        })),
      }
    }
    if (message.role === 'tool') {
      return { role: 'tool', content: message.content, tool_name: message.name }
    }
    return { role: message.role, content: message.content }
  })
}
