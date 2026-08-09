// ── AI Agent 客户端配置 ──────────────────────────────────

import type { AgentConfig, LLMProviderType } from './types'

const DEFAULT_CONFIG: AgentConfig = {
  provider: (import.meta.env.VITE_LLM_PROVIDER as LLMProviderType) || 'deepseek',
  model: import.meta.env.VITE_LLM_MODEL || 'deepseek-chat',
  baseUrl: import.meta.env.VITE_LLM_BASE_URL || '',
}

let currentConfig: AgentConfig = { ...DEFAULT_CONFIG }

export function getAgentConfig(): AgentConfig {
  return { ...currentConfig }
}

export function setAgentConfig(patch: Partial<AgentConfig>): void {
  currentConfig = { ...currentConfig, ...patch }
}

export function getApiBase(): string {
  return '/api/ai-agent'
}
