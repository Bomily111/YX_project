import type { SceneResource } from '@/platform/resources/types'
export const gprCatalog = [1, 2].map(line => ({ id: `rock.gpr-line${line}`, line, path: `/data/GPR_new/output/radargram_line${line}.json` }))
export interface GprSection { name: string; n_scans: number; n_samples: number; profile_length_m: number; depth_range_m: number; dielectric: number; ds_shape: number[]; data: number[] }
const active = new Map<string, GprSection>()
export const getActiveGprSection = (id: string) => active.get(id)
export function validateGprSection(value: GprSection): void {
  if (!value || !Array.isArray(value.ds_shape) || value.ds_shape.length !== 2 ||
      !value.ds_shape.every(size => Number.isInteger(size) && size > 0) ||
      !Array.isArray(value.data) || value.data.length !== value.ds_shape[0] * value.ds_shape[1] || !value.data.every(Number.isFinite) ||
      !Number.isFinite(value.profile_length_m) || value.profile_length_m <= 0 || !Number.isFinite(value.depth_range_m) || value.depth_range_m <= 0) throw new Error('GPR剖面尺寸或数值无效')
}
export const gprResources: SceneResource[] = gprCatalog.map(item => ({
  id: item.id, module: 'rock', type: 'gpr-section-information', chainageRange: { start: 1116, end: 9400 },
  processes: ['prediction', 'inspection'], states: ['reference'], dependencies: ['common.tunnel'], lifetime: 'task',
  async load(context) {
    const response = await fetch(item.path, { signal: context.signal })
    if (!response.ok) throw new Error(`GPR剖面加载失败：HTTP ${response.status}`)
    const document = await response.json()
    const section = document[`line${item.line}`] as GprSection
    validateGprSection(section)
    active.set(item.id, section)
  },
  async unload() { active.delete(item.id) },
  getActiveAssetPaths: () => active.has(item.id) ? [item.path] : [],
}))
