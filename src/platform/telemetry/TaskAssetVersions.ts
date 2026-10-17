import type { DataVersion } from './TaskDataProvenance'
import type { ResourceManager } from '@/platform/resources/ResourceManager'
import type { ResourceRegistry } from '@/platform/resources/ResourceRegistry'

interface AssetManifestEntry {
  path: string
  algorithm: 'sha256-bytes-v1'
  digest: string
}

export interface TaskAssetManifest {
  schemaVersion: 1
  assets: AssetManifestEntry[]
}

const isEntry = (value: unknown): value is AssetManifestEntry => {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<AssetManifestEntry>
  return typeof entry.path === 'string' && entry.path.startsWith('/data/')
    && entry.algorithm === 'sha256-bytes-v1'
    && typeof entry.digest === 'string' && /^[a-f0-9]{64}$/.test(entry.digest)
}

export async function loadTaskAssetManifest(): Promise<TaskAssetManifest> {
  const response = await fetch('/data/task-asset-manifest.json', { cache: 'no-store' })
  if (!response.ok) throw new Error(`任务资产清单加载失败：HTTP ${response.status}`)
  const document = await response.json() as Partial<TaskAssetManifest>
  if (document.schemaVersion !== 1 || !Array.isArray(document.assets) || !document.assets.every(isEntry)) {
    throw new Error('任务资产清单格式无效')
  }
  return document as TaskAssetManifest
}

export function resolveAssetVersions(
  manifest: TaskAssetManifest,
  paths: readonly string[],
  capturedAt = new Date().toISOString(),
): DataVersion[] {
  const entries = new Map(manifest.assets.map(entry => [entry.path, entry]))
  return [...new Set(paths)].map(path => {
    const entry = entries.get(path)
    if (!entry) throw new Error(`任务资产清单缺少文件：${path}`)
    return {
      sourceId: `asset:${path}`,
      locator: path,
      algorithm: entry.algorithm,
      digest: entry.digest,
      capturedAt,
    }
  })
}

export async function readAssetVersions(paths: readonly string[]): Promise<DataVersion[]> {
  if (!paths.length) return []
  return resolveAssetVersions(await loadTaskAssetManifest(), paths)
}

/** 从活动场景资源读取实际占用的静态资产，不根据模块名称推测。 */
export function collectActiveAssetPaths(
  resourceIds: readonly string[],
  registry: ResourceRegistry,
  manager: ResourceManager,
): string[] {
  const paths = resourceIds.flatMap(id => {
    if (manager.getState(id).status !== 'loaded') return []
    return [...(registry.get(id)?.getActiveAssetPaths?.() ?? [])]
  })
  return [...new Set(paths)]
}

export function collectActiveDataVersions(
  resourceIds: readonly string[],
  registry: ResourceRegistry,
  manager: ResourceManager,
): DataVersion[] {
  const versions = new Map<string, DataVersion>()
  for (const id of resourceIds) {
    if (manager.getState(id).status !== 'loaded') continue
    for (const version of registry.get(id)?.getActiveDataVersions?.() ?? []) {
      versions.set(version.sourceId, { ...version })
    }
  }
  return [...versions.values()]
}
