// ── Ollama 本地模型适配器 ─────────────────────────────────

import { getLLMConfig } from '../config.js'

/**
 * 发送流式聊天请求到 Ollama API
 */
export async function chatStream(params) {
  const llmConfig = getLLMConfig('ollama')
  const { messages, tools, system } = params

  // Ollama 格式
  const ollamaMessages = [
    { role: 'system', content: system },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ]

  const body = {
    model: llmConfig.model,
    messages: ollamaMessages,
    stream: true,
    options: {
      temperature: 0.3,
    },
  }

  // 如果有工具，添加到请求
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

  return response
}

/**
 * 将 Ollama SSE 格式转换为统一的 SSE 事件格式
 * Ollama 的流式输出是每行一个 JSON 对象
 */
export async function streamToSSE(response, onEvent) {
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
      } catch {
        // 忽略非 JSON 行
      }
    }
  }

  onEvent({ type: 'message_stop' })
}
