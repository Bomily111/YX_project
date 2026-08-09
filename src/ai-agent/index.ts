// ── AI Agent 公共入口 ────────────────────────────────────
// 主平台和子模块只通过此文件与 AI Agent 交互
// 不直接依赖 ai-agent 内部实现

export { default as AgentChat } from './AgentChat.vue'
export { AgentEngine, createAgentEngine } from './AgentEngine'
export { registerTools, unregisterModule, getRegisteredModules } from './ToolRegistry'
export { aiEvents } from './events'
export { buildSystemPrompt } from './knowledge/prompts/system'
export { getAgentConfig, setAgentConfig } from './config'
export type { AgentContext, AgentTool, ToolRegistration, Message, LLMProviderType } from './types'
