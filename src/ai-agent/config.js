// ── AI Agent 客户端配置 ──────────────────────────────────
const DEFAULT_CONFIG = {
    provider: import.meta.env.VITE_LLM_PROVIDER || '',
    model: import.meta.env.VITE_LLM_MODEL || '',
    baseUrl: import.meta.env.VITE_LLM_BASE_URL || '',
};
let currentConfig = { ...DEFAULT_CONFIG };
export function getAgentConfig() {
    return { ...currentConfig };
}
export function setAgentConfig(patch) {
    currentConfig = { ...currentConfig, ...patch };
}
export function getApiBase() {
    return '/api/ai-agent';
}
