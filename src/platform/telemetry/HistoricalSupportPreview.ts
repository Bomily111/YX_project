import catalog from '@/modules/support/legacy-assets.json'
import type { TaskResultSnapshot } from './TaskAuditClient'
import type { TaskAssetManifest } from './TaskAssetVersions'

const assets = catalog as Array<{ id: string; paths: string[] }>
const byId = new Map(assets.map(asset => [asset.id, asset]))
const assemblyId = 'support.legacy-assembly'

export interface HistoricalSupportPreviewCheck {
  roots: string[]
  loadOrder: string[]
  assetPaths: string[]
  partial: boolean
  reason?: string
}

/** Only replay the fixed structure-tree models whose recorded byte fingerprints still match. */
export function checkHistoricalSupportPreview(
  snapshot: TaskResultSnapshot,
  manifest: TaskAssetManifest,
): HistoricalSupportPreviewCheck {
  const unavailable = (reason: string): HistoricalSupportPreviewCheck => ({ roots: [], loadOrder: [], assetPaths: [], partial: false, reason })
  const plan = snapshot.scene_plan
  if (!plan?.rootResourceIds.length) return unavailable('此节点没有可回看的场景。')
  const roots = plan.rootResourceIds.filter(id => id === assemblyId || byId.has(id))
  if (!roots.length) return unavailable('此节点没有既有静态支护构件；动态或参数化场景暂不可重建。')
  const loadOrder = roots.includes(assemblyId)
    ? [...assets.map(asset => asset.id), assemblyId]
    : roots
  if (new Set(roots).size !== roots.length || loadOrder.some(id => !plan.loadOrder.includes(id))) {
    return unavailable('历史场景的资源依赖与当前版本不一致。')
  }
  if (loadOrder.some(id => !snapshot.resources.some(item => item.id === id && item.status === 'loaded'))) {
    return unavailable('此节点的支护资源尚未全部加载。')
  }
  const current = new Map(manifest.assets.map(entry => [entry.path, entry]))
  const recorded = new Map((snapshot.data_versions ?? [])
    .filter(version => version.sourceId.startsWith('asset:'))
    .map(version => [version.locator, version]))
  const paths = [...new Set(loadOrder.flatMap(id => byId.get(id)?.paths ?? []))]
  for (const path of paths) {
    const expected = recorded.get(path)
    const actual = current.get(path)
    if (!expected || !actual) return unavailable(`缺少支护资产指纹：${path}`)
    if (expected.algorithm !== actual.algorithm || expected.digest !== actual.digest) {
      return unavailable(`支护资产版本已变化：${path}`)
    }
  }
  return { roots, loadOrder, assetPaths: paths, partial: roots.length !== plan.rootResourceIds.length }
}
