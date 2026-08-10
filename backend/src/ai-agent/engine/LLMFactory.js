// ── 模型工厂 ──────────────────────────────────────────────

import { getLLMConfig } from '../config.js'

/**
 * 根据 provider 加载对应的适配器模块
 */
async function loadProvider(providerOverride) {
  const config = getLLMConfig(providerOverride)
  switch (config.provider) {
    case 'claude':
      return import('../providers/claude.js')
    case 'ollama':
      return import('../providers/ollama.js')
    case 'deepseek':
    case 'qwen':
    default:
      return import('../providers/openai-compatible.js')
  }
}

/**
 * 获取流式聊天处理器
 * 所有 provider 统一导出 streamChat(params, onEvent) 函数
 */
export async function getStreamHandler(params) {
  const providerModule = await loadProvider(params.provider)
  return {
    streamChat: providerModule.streamChat,
  }
}
