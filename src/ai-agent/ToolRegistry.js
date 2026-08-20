// ── 工具注册中心 ─────────────────────────────────────────
// 子模块通过 registerTools() 注册自己的工具
// AI Agent 不直接依赖任何子模块代码
const registry = new Map();
export function registerTools(module, tools) {
    for (const t of tools) {
        const key = `${module}:${t.tool.name}`;
        registry.set(key, { ...t, module });
    }
    console.log(`[AI Agent] 模块 "${module}" 注册了 ${tools.length} 个工具`);
}
export function unregisterModule(module) {
    for (const [key, t] of registry) {
        if (t.module === module)
            registry.delete(key);
    }
}
export function getToolsForModule(module) {
    const tools = [];
    for (const t of registry.values()) {
        if (!module || t.module === module || t.module === 'common') {
            tools.push(t.tool);
        }
    }
    return tools;
}
export function getAllTools() {
    return Array.from(registry.values()).map(t => t.tool);
}
export async function executeTool(name, input) {
    for (const t of registry.values()) {
        if (t.tool.name === name) {
            console.log(`[AI Agent] 执行工具: ${name}`, input);
            try {
                return await t.executor(input);
            }
            catch (err) {
                console.error(`[AI Agent] 工具 ${name} 执行失败:`, err);
                return `❌ 工具 ${name} 执行失败：${err.message}`;
            }
        }
    }
    return `❓ 未找到工具：${name}`;
}
export function getRegisteredModules() {
    return [...new Set(Array.from(registry.values()).map(t => t.module))];
}
