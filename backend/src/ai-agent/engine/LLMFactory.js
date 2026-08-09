// ── 模型工厂 ──────────────────────────────────────────────
// 根据配置创建对应的 LLM 适配器

import { getLLMConfig } from '../config.js'

export function createProvider(providerOverride) {
  const config = getLLMConfig(providerOverride)

  switch (config.provider) {
    case 'claude':
      return import('../providers/claude.js')
    case 'ollama':
      return import('../providers/ollama.js')
    case 'deepseek':
    case 'qwen':
    default:
      // OpenAI 兼容格式（DeepSeek、通义千问等）
      return import('../providers/openai-compatible.js')
  }
}

/**
 * 获取流式聊天响应
 */
export async function getChatStream(params) {
  const providerModule = await createProvider(params.provider)
  const response = await providerModule.chatStream(params)
  return {
    response,
    streamToSSE: providerModule.streamToSSE,
  }
}
