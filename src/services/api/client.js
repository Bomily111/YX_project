/**
 * API 客户端 — 对接后端 REST API
 *
 * 所有后端 API 的统一封装，支持：
 *   - 自动处理 JSON 响应
 *   - 错误统一处理
 *   - Bearer token 认证
 */
const BASE = '/api';
let authToken = null;
export function setAuthToken(token) {
    authToken = token;
}
async function request(path, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    };
    if (authToken)
        headers['Authorization'] = `Bearer ${authToken}`;
    const res = await fetch(`${BASE}${path}`, { ...options, headers });
    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new ApiError(res.status, body.error || res.statusText);
    }
    return res.json();
}
export class ApiError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
// ── API 函数 ─────────────────────────────────────────────
export const tunnelsApi = {
    list: () => request('/tunnels'),
    get: (id) => request(`/tunnels/${id}`),
    worksites: (tunnelId) => request(`/tunnels/${tunnelId}/worksites`),
    models: (tunnelId, nearDk, radius) => {
        const params = new URLSearchParams();
        if (nearDk) {
            params.set('near_dk', String(nearDk));
            params.set('radius_m', String(radius || 50));
        }
        const qs = params.toString();
        return request(`/tunnels/${tunnelId}/models${qs ? '?' + qs : ''}`);
    },
    modelsByType: (tunnelId, modelKey) => request(`/tunnels/${tunnelId}/models/${modelKey}`),
};
export const monitoringApi = {
    readings: (configId, from, to) => {
        const params = new URLSearchParams({ config_id: configId });
        if (from)
            params.set('from', from);
        if (to)
            params.set('to', to);
        return request(`/monitoring/readings?${params}`);
    },
    latest: (configIds) => request(`/monitoring/readings/latest?config_id=${configIds.join(',')}`),
    postReadings: (readings) => request('/monitoring/readings', {
        method: 'POST',
        body: JSON.stringify({ readings }),
    }),
};
export const personnelApi = {
    list: () => request('/personnel'),
    currentStatus: () => request('/personnel/status/current'),
    reportLocation: (id, data) => request(`/personnel/${id}/location`, { method: 'POST', body: JSON.stringify(data) }),
};
export const equipmentApi = {
    list: () => request('/equipment'),
    types: () => request('/equipment/types'),
    currentStatus: () => request('/equipment/status/current'),
    reportLocation: (id, data) => request(`/equipment/${id}/location`, { method: 'POST', body: JSON.stringify(data) }),
};
export const blastApi = {
    list: (worksiteId) => {
        const params = worksiteId ? `?worksite_id=${worksiteId}` : '';
        return request(`/blast${params}`);
    },
    get: (id) => request(`/blast/${id}`),
    create: (data) => request('/blast', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/blast/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};
export const supportApi = {
    list: (tunnelId) => {
        const params = tunnelId ? `?tunnel_id=${tunnelId}` : '';
        return request(`/support${params}`);
    },
    create: (data) => request('/support', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/support/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};
export const alertsApi = {
    list: (active, tunnelId, level, sceneKey) => {
        const p = new URLSearchParams();
        if (active)
            p.set('active', 'true');
        if (tunnelId)
            p.set('tunnel_id', tunnelId);
        if (level)
            p.set('level', level);
        if (sceneKey)
            p.set('scene_key', sceneKey);
        const qs = p.toString();
        return request(`/alerts${qs ? '?' + qs : ''}`);
    },
    create: (data) => request('/alerts', { method: 'POST', body: JSON.stringify(data) }),
    acknowledge: (id) => request(`/alerts/${id}/acknowledge`, { method: 'PUT', body: JSON.stringify({ user: 'system' }) }),
    resolve: (id, note) => request(`/alerts/${id}/resolve`, { method: 'PUT', body: JSON.stringify({ note }) }),
};
export const jobsApi = {
    list: (status) => request(`/jobs${status ? `?status=${status}` : ''}`),
    get: (id) => request(`/jobs/${id}`),
    create: (data) => request('/jobs', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/jobs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};
export const scenesApi = {
    all: () => request('/scenes'),
    get: (sceneKey) => request(`/scenes/${sceneKey}`),
};
export const configApi = {
    get: () => request('/config'),
};
export const authApi = {
    login: (username, password) => request('/auth/login', {
        method: 'POST', body: JSON.stringify({ username, password }),
    }),
    register: (username, password, displayName) => request('/auth/register', {
        method: 'POST', body: JSON.stringify({ username, password, display_name: displayName }),
    }),
};
