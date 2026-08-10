// ── AI Agent 聊天路由 ────────────────────────────────────
// POST /api/ai-agent/chat — 流式 SSE 响应

import { Router } from 'express'
import { getLLMConfig } from '../config.js'

const router = Router()

router.post('/chat', async (req, res) => {
  const { messages, tools, system, provider: providerOverride, model: modelOverride } = req.body

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: '缺少 messages 参数' })
  }

  const llmConfig = getLLMConfig(providerOverride)
  const provider = providerOverride || llmConfig.provider
  const model = modelOverride || llmConfig.model

  console.log(`[AI Agent] 请求: provider=${provider}, model=${model}, messages=${messages.length}`)

  // 设置 SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  try {
    const { getStreamHandler } = await import('../engine/LLMFactory.js')
    const { streamChat } = await getStreamHandler({ provider })

    await streamChat(
      {
        messages,
        tools,
        system: system || '你是隧道施工数字孪生平台的智能助手，使用中文回答。',
        provider,
        model,
      },
      (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`)
        if (event.type === 'message_stop') {
          res.write('data: [DONE]\n\n')
          res.end()
        }
      },
    )

    // 兜底：确保连接关闭
    if (!res.writableEnded) {
      res.write('data: [DONE]\n\n')
      res.end()
    }
  } catch (err) {
    console.error('[AI Agent] 错误:', err.message)
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message })
    }
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
    }
  }
})

router.get('/health', (req, res) => {
  const config = getLLMConfig()
  res.json({
    status: 'ok',
    provider: config.provider,
    model: config.model,
    hasApiKey: !!config.apiKey,
  })
})

export default router
