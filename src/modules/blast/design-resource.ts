import type { SceneResource } from '@/platform/resources/types'

export interface BlastDesignData {
  metadata: { name: string; source: string; coordinateFrame: string; empiricalNote: string;
    advanceM: number; totalCharged: number; sectionSpec: { excavationWidthM: number; crownHeightM: number } }
  contour: number[][]
  categories: Record<string, { label: string; color: string; count: number }>
  holes: Array<{ id: string; category: string; charged: boolean; color: string; collar: number[]; toe: number[] }>
}
let design: BlastDesignData | undefined
export const getBlastDesignData = () => design
export function validateBlastDesign(value: BlastDesignData): void {
  const vector = (p: number[]) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite)
  if (!value?.metadata?.source || !Array.isArray(value.holes) || !value.holes.length ||
      !Array.isArray(value.contour) || value.contour.length < 3 || !value.contour.every(vector) ||
      !value.categories || value.holes.some(h => !value.categories[h.category] || !vector(h.collar) || !vector(h.toe)) ||
      new Set(value.holes.map(h => h.id)).size !== value.holes.length ||
      value.holes.filter(h => h.charged).length !== value.metadata.totalCharged ||
      Object.entries(value.categories).some(([key, category]) => category.count !== value.holes.filter(h => h.category === key).length)) {
    throw new Error('爆破设计数据结构或炮孔数量不一致')
  }
}
export function getBlastDesignSummary() {
  return design ? { ...design.metadata, categories: design.categories, holeCount: design.holes.length,
    limitation: '现有方案示例参考，非目标工点实测或审批设计；逐孔姿态含经验值，不据此给出药量或安全结论' } : undefined
}
export const blastDesignResource: SceneResource = {
  id: 'blast.design-data', module: 'blast', type: 'blast-design-information',
  chainageRange: { start: 1116, end: 9400 }, processes: ['drilling', 'blasting', 'inspection'], states: ['designed'],
  dependencies: ['common.tunnel'], lifetime: 'task',
  async load() {
    const response = await fetch('/data/blast/blast-design.json')
    if (!response.ok) throw new Error(`爆破设计加载失败：HTTP ${response.status}`)
    const data = await response.json() as BlastDesignData
    validateBlastDesign(data)
    design = data
  },
  async unload() { design = undefined },
  getActiveAssetPaths: () => design ? ['/data/blast/blast-design.json'] : [],
}
