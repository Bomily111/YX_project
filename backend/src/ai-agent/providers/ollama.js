// ── Ollama 本地模型适配器 ─────────────────────────────────

import { getLLMConfig } from '../config.js'

/**
 * 发送流式聊天到 Ollama，通过回调输出标准化 SSE 事件
 */
export async function streamChat(params, onEvent) {
  const llmConfig = getLLMConfig('ollama')
  const { messages, tools, system } = params

  const body = {
    model: llmConfig.model,
    messages: [
      { role: 'system', content: system },
      ...messages.map(m => ({ role: m.role, content: m.content })),
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

        if (event.done) {
          onEvent({ type: 'message_stop' })
          return
        }
      } catch { /* 跳过非 JSON 行 */ }
    }
  }

  onEvent({ type: 'message_stop' })
}
