/**
 * API 客户端 — 对接后端 REST API
 *
 * 所有后端 API 的统一封装，支持：
 *   - 自动处理 JSON 响应
 *   - 错误统一处理
 *   - Bearer token 认证
 */

const BASE = '/api'

let authToken: string | null = null

export function setAuthToken(token: string | null) {
  authToken = token
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`

  const res = await fetch(`${BASE}${path}`, { ...options, headers })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new ApiError(res.status, body.error || res.statusText)
  }

  return res.json()
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// ── GET /api/tunnels ─────────────────────────────────────
export interface TunnelSummary {
  id: string; project_id: string; name: string; code: string
  type: string; construction_method: string
  start_mileage: number; end_mileage: number; length_m: number
  cross_section_area_m2: number; status: string
  centerline_geojson: any
}

export interface ModelInstance {
  id: string; tunnel_id: string; model_type_code: string; model_type_name: string
  name: string; start_dk: number; end_dk: number
  glb_urls: { url: string; mileage: number; heightOffset?: number }[] | null
  volume_url: string | null
  anchor_lon: number; anchor_lat: number; anchor_height: number
  rotation_x: number; rotation_y: number; rotation_z: number
  translate_x: number; translate_y: number; translate_z: number
  scale_x: number; scale_y: number; scale_z: number
  heading_deg: number; glb_heading: number; glb_y_rot: number; glb_z_rot: number
  reference_mileage: number
  fly_dest_x: number; fly_dest_y: number; fly_dest_z: number
  fly_heading: number; fly_pitch: number
  look_at_lon: number; look_at_lat: number; look_at_height: number
  look_at_offset_x: number; look_at_offset_y: number; look_at_offset_z: number
  skip_look_at: boolean; sub_type: string
  data_type: string; render_method: string
}

export interface WorksiteSummary {
  id: string; name: string; code: string; dk_number: number
  lon: number; lat: number; height: number
  rock_classification: string; excavation_method: string
  risk_level: string; current_procedure: string
  cycle_advance_m: number; status: string
}

// ── API 函数 ─────────────────────────────────────────────

export const tunnelsApi = {
  list: () => request<TunnelSummary[]>('/tunnels'),

  get: (id: string) => request<TunnelSummary & { project_name: string }>(`/tunnels/${id}`),

  worksites: (tunnelId: string) => request<WorksiteSummary[]>(`/tunnels/${tunnelId}/worksites`),

  models: (tunnelId: string, nearDk?: number, radius?: number) => {
    const params = new URLSearchParams()
    if (nearDk) { params.set('near_dk', String(nearDk)); params.set('radius_m', String(radius || 50)) }
    const qs = params.toString()
    return request<ModelInstance[]>(`/tunnels/${tunnelId}/models${qs ? '?' + qs : ''}`)
  },

  modelsByType: (tunnelId: string, modelKey: string) =>
    request<ModelInstance[]>(`/tunnels/${tunnelId}/models/${modelKey}`),
}

export const monitoringApi = {
  readings: (configId: string, from?: string, to?: string) => {
    const params = new URLSearchParams({ config_id: configId })
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    return request<{ time: string; value: number }[]>(`/monitoring/readings?${params}`)
  },

  latest: (configIds: string[]) =>
    request<Record<string, { time: string; value: number }>>(`/monitoring/readings/latest?config_id=${configIds.join(',')}`),

  postReadings: (readings: { config_id: string; time?: string; value: number }[]) =>
    request<{ inserted: number }>('/monitoring/readings', {
      method: 'POST',
      body: JSON.stringify({ readings }),
    }),
}

export const personnelApi = {
  list: () => request<any[]>('/personnel'),
  currentStatus: () => request<any[]>('/personnel/status/current'),
  reportLocation: (id: string, data: any) =>
    request(`/personnel/${id}/location`, { method: 'POST', body: JSON.stringify(data) }),
}

export const equipmentApi = {
  list: () => request<any[]>('/equipment'),
  types: () => request<any[]>('/equipment/types'),
  currentStatus: () => request<any[]>('/equipment/status/current'),
  reportLocation: (id: string, data: any) =>
    request(`/equipment/${id}/location`, { method: 'POST', body: JSON.stringify(data) }),
}

export const blastApi = {
  list: (worksiteId?: string) => {
    const params = worksiteId ? `?worksite_id=${worksiteId}` : ''
    return request<any[]>(`/blast${params}`)
  },
  get: (id: string) => request<any>(`/blast/${id}`),
  create: (data: any) =>
    request<any>('/blast', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    request<any>(`/blast/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
}

export const supportApi = {
  list: (tunnelId?: string) => {
    const params = tunnelId ? `?tunnel_id=${tunnelId}` : ''
    return request<any[]>(`/support${params}`)
  },
  create: (data: any) =>
    request<any>('/support', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    request<any>(`/support/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
}

export const alertsApi = {
  list: (active?: boolean) =>
    request<any[]>(`/alerts${active ? '?active=true' : ''}`),
  create: (data: any) =>
    request<any>('/alerts', { method: 'POST', body: JSON.stringify(data) }),
  acknowledge: (id: string) =>
    request<any>(`/alerts/${id}/acknowledge`, { method: 'PUT', body: JSON.stringify({ user: 'system' }) }),
  resolve: (id: string, note?: string) =>
    request<any>(`/alerts/${id}/resolve`, { method: 'PUT', body: JSON.stringify({ note }) }),
}

export const jobsApi = {
  list: (status?: string) =>
    request<any[]>(`/jobs${status ? `?status=${status}` : ''}`),
  get: (id: string) => request<any>(`/jobs/${id}`),
  create: (data: any) =>
    request<any>('/jobs', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    request<any>(`/jobs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
}

export interface SceneConfig {
  scene_key: string; name_cn: string; icon: string; color: string
  metrics: { id: string; label: string; metric_key: string; unit: string }[]
  statusList: { id: string; label: string; val: string; pct: number; level: string }[]
}

export const scenesApi = {
  all: () => request<Record<string, SceneConfig>>('/scenes'),
  get: (sceneKey: string) => request<SceneConfig>(`/scenes/${sceneKey}`),
}

export const configApi = {
  get: () => request<Record<string, string>>('/config'),
}

export const authApi = {
  login: (username: string, password: string) =>
    request<{ token: string; user: any }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ username, password }),
    }),
  register: (username: string, password: string, displayName: string) =>
    request<any>('/auth/register', {
      method: 'POST', body: JSON.stringify({ username, password, display_name: displayName }),
    }),
}
