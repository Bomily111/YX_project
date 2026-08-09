// ── OpenAI 兼容格式适配器（DeepSeek / Qwen / 通义千问）────
// 标准 /v1/chat/completions SSE 格式

import { getLLMConfig } from '../config.js'

/**
 * 发送流式聊天请求到 OpenAI 兼容 API
 */
export async function chatStream(params) {
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

  // 如果提供了工具定义，添加到请求中
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

  return response
}

/**
 * 将 OpenAI SSE 格式转换为统一的 SSE 事件格式
 * 通过回调函数输出标准化事件
 */
export async function streamToSSE(response, onEvent) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let currentToolCall = null
  let toolIndexCounter = 0

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
        // 结束当前工具调用块
        if (currentToolCall) {
          onEvent({
            type: 'content_block_stop',
            index: currentToolCall.index,
          })
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

        // 处理文本内容
        if (delta?.content) {
          // 如果之前有工具调用，先结束它
          if (currentToolCall) {
            onEvent({
              type: 'content_block_stop',
              index: currentToolCall.index,
            })
            currentToolCall = null
          }

          onEvent({
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: delta.content },
          })
        }

        // 处理工具调用
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            // 新的工具调用开始
            if (tc.id && tc.function?.name) {
              if (currentToolCall) {
                onEvent({
                  type: 'content_block_stop',
                  index: currentToolCall.index,
                })
              }
              currentToolCall = {
                id: tc.id,
                name: tc.function.name,
                index: tc.index ?? toolIndexCounter++,
              }
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

            // 工具参数流式增量
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
      } catch {
        // 忽略 JSON 解析错误
      }
    }
  }

  // 流结束，收尾
  if (currentToolCall) {
    onEvent({
      type: 'content_block_stop',
      index: currentToolCall.index,
    })
  }
  onEvent({ type: 'message_stop' })
}
