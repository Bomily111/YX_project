// ── AI Agent 后端配置 ────────────────────────────────────

const config = {
  provider: process.env.LLM_PROVIDER || 'deepseek',
  model: process.env.LLM_MODEL || 'deepseek-chat',
  apiKey: process.env.LLM_API_KEY || '',
  baseUrl: process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1',

  // 备用模型配置
  claudeApiKey: process.env.CLAUDE_API_KEY || '',
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
}

export function getLLMConfig(providerOverride) {
  const provider = providerOverride || config.provider

  switch (provider) {
    case 'deepseek':
      return {
        provider: 'deepseek',
        model: config.model,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
      }
    case 'qwen':
      return {
        provider: 'qwen',
        model: process.env.QWEN_MODEL || 'qwen-plus',
        apiKey: process.env.QWEN_API_KEY || config.apiKey,
        baseUrl: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      }
    case 'claude':
      return {
        provider: 'claude',
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        apiKey: config.claudeApiKey,
        baseUrl: 'https://api.anthropic.com/v1',
      }
    case 'ollama':
      return {
        provider: 'ollama',
        model: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
        apiKey: '',
        baseUrl: config.ollamaBaseUrl,
      }
    default:
      return {
        provider: 'deepseek',
        model: config.model,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
      }
  }
}

export default config
