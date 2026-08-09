// ── 工具聚合 + 执行分发 ──────────────────────────────────

import type { AgentTool, ToolRegistration } from '../types'
import { commonTools } from './common'
import { executeTool as registryExecute } from '../ToolRegistry'

// 聚合所有内置工具
export const builtinTools: ToolRegistration[] = [
  ...commonTools,
]

// 按模块过滤工具定义（发送给 LLM 的格式）
export function filterToolDefinitions(module?: string): AgentTool[] {
  if (!module) {
    return builtinTools.map(t => t.tool)
  }
  return builtinTools
    .filter(t => t.module === 'common' || t.module === module)
    .map(t => t.tool)
}

// 导出执行函数供 AgentEngine 使用
export { registryExecute as executeBuiltinTool }
