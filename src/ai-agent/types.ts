// ── 共享类型定义 ──────────────────────────────────────────

export interface Message {
  role: 'user' | 'assistant' | 'tool'
  content: string
  tool_call_id?: string
}

export interface AgentTool {
  name: string
  description: string
  input_schema: Record<string, any>
}

export interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, any>
}

export interface TextBlock {
  type: 'text'
  text: string
}

export type ContentBlock = TextBlock | ToolUseBlock

export interface ToolRegistration {
  module: string
  tool: AgentTool
  executor: (input: Record<string, any>) => Promise<string>
}

export interface AgentContext {
  scene?: string
  worksiteId?: string
  tunnelId?: string
  dkNumber?: string
}

export interface ChatRequest {
  messages: Message[]
  tools: AgentTool[]
  system: string
  provider?: string
  model?: string
  stream?: boolean
}

export type LLMProviderType = 'deepseek' | 'claude' | 'qwen' | 'ollama'

export interface AgentConfig {
  provider: LLMProviderType
  model: string
  baseUrl?: string
}
