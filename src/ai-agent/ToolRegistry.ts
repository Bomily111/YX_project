// ── 工具注册中心 ─────────────────────────────────────────
// 子模块通过 registerTools() 注册自己的工具
// AI Agent 不直接依赖任何子模块代码

import type { AgentTool, ToolRegistration } from './types'

const registry = new Map<string, ToolRegistration>()

export function registerTools(module: string, tools: ToolRegistration[]): void {
  for (const t of tools) {
    const key = `${module}:${t.tool.name}`
    registry.set(key, { ...t, module })
  }
  console.log(`[AI Agent] 模块 "${module}" 注册了 ${tools.length} 个工具`)
}

export function unregisterModule(module: string): void {
  for (const [key, t] of registry) {
    if (t.module === module) registry.delete(key)
  }
}

export function getToolsForModule(module?: string): AgentTool[] {
  const tools: AgentTool[] = []
  for (const t of registry.values()) {
    if (!module || t.module === module || t.module === 'common') {
      tools.push(t.tool)
    }
  }
  return tools
}

export function getAllTools(): AgentTool[] {
  return Array.from(registry.values()).map(t => t.tool)
}

export async function executeTool(name: string, input: Record<string, any>): Promise<string> {
  for (const t of registry.values()) {
    if (t.tool.name === name) {
      console.log(`[AI Agent] 执行工具: ${name}`, input)
      try {
        return await t.executor(input)
      } catch (err: any) {
        console.error(`[AI Agent] 工具 ${name} 执行失败:`, err)
        return `❌ 工具 ${name} 执行失败：${err.message}`
      }
    }
  }
  return `❓ 未找到工具：${name}`
}

export function getRegisteredModules(): string[] {
  return [...new Set(Array.from(registry.values()).map(t => t.module))]
}
