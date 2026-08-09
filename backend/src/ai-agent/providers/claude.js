// ── Claude API 适配器 ─────────────────────────────────────

import { getLLMConfig } from '../config.js'

/**
 * 发送流式聊天请求到 Anthropic API
 * 需要安装 @anthropic-ai/sdk，此文件作为可选适配器
 */
export async function chatStream(params) {
  const llmConfig = getLLMConfig('claude')

  if (!llmConfig.apiKey) {
    throw new Error('Claude API Key 未配置')
  }

  const { messages, tools, system } = params

  // 将工具转换为 Anthropic 格式
  const anthropicTools = tools?.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  })) || undefined

  const body = {
    model: llmConfig.model,
    max_tokens: 2048,
    system,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
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

  return response
}

/**
 * 将 Anthropic SSE 格式转换为统一的 SSE 事件格式
 * Anthropic 本身的事件格式已经和我们定义的一致，直接透传
 */
export async function streamToSSE(response, onEvent) {
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
      if (data === '[DONE]') {
        onEvent({ type: 'message_stop' })
        continue
      }

      try {
        const event = JSON.parse(data)
        // Anthropic SSE 事件直接映射
        switch (event.type) {
          case 'content_block_start':
          case 'content_block_delta':
          case 'content_block_stop':
            onEvent(event)
            break
          case 'message_stop':
            onEvent({ type: 'message_stop' })
            break
          // 忽略其他事件类型（ping 等）
        }
      } catch {
        // 忽略解析错误
      }
    }
  }

  onEvent({ type: 'message_stop' })
}
