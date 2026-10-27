import { describe, expect, it } from 'vitest'
import catalog from '../../src/modules/support/legacy-assets.json'
import { checkHistoricalSupportPreview } from '../../src/platform/telemetry/HistoricalSupportPreview'
import type { TaskAssetManifest } from '../../src/platform/telemetry/TaskAssetVersions'
import type { TaskResultSnapshot } from '../../src/platform/telemetry/TaskAuditClient'

const asset = catalog[0]
const manifest: TaskAssetManifest = {
  schemaVersion: 1,
  assets: asset.paths.map(path => ({ path, algorithm: 'sha256-bytes-v1', digest: 'a'.repeat(64) })),
}
const snapshot = (): TaskResultSnapshot => ({
  id: 1,
  created_at: '2026-10-19T00:00:00Z',
  task_id: 'test',
  event_type: 'step-completed',
  step_id: 'support',
  workflow_state: {} as TaskResultSnapshot['workflow_state'],
  scene_plan: { rootResourceIds: [asset.id], loadOrder: [asset.id] } as unknown as TaskResultSnapshot['scene_plan'],
  enhancement_plan: null,
  resources: [{ id: asset.id, status: 'loaded', references: 1 }],
  data_versions: asset.paths.map(path => ({ sourceId: `asset:${path}`, locator: path,
    algorithm: 'sha256-bytes-v1', digest: 'a'.repeat(64), capturedAt: '2026-10-19T00:00:00Z' })),
})

describe('historical fixed-support preview guard', () => {
  it('accepts a loaded fixed component with matching asset fingerprints', () => {
    expect(checkHistoricalSupportPreview(snapshot(), manifest)).toEqual({
      roots: [asset.id], loadOrder: [asset.id], assetPaths: asset.paths, partial: false,
    })
  })

  it('rejects a changed or missing fingerprint', () => {
    const changed = snapshot()
    changed.data_versions[0].digest = 'b'.repeat(64)
    expect(checkHistoricalSupportPreview(changed, manifest).reason).toContain('版本已变化')
    changed.data_versions = []
    expect(checkHistoricalSupportPreview(changed, manifest).reason).toContain('缺少支护资产指纹')
  })

  it('rejects unready and unsupported scenes', () => {
    const unready = snapshot()
    unready.resources[0].status = 'idle'
    expect(checkHistoricalSupportPreview(unready, manifest).reason).toContain('尚未全部加载')
    const unsupported = snapshot()
    unsupported.scene_plan!.rootResourceIds = ['ventilation.thermal-field']
    expect(checkHistoricalSupportPreview(unsupported, manifest).reason).toContain('没有既有静态支护')
  })

  it('previews only the fixed-support subset of a mixed historical scene', () => {
    const mixed = snapshot()
    mixed.scene_plan!.rootResourceIds = ['rock.design-grade', asset.id]
    mixed.scene_plan!.loadOrder = ['common.tunnel', 'rock.design-grade', asset.id]
    expect(checkHistoricalSupportPreview(mixed, manifest)).toEqual({
      roots: [asset.id], loadOrder: [asset.id], assetPaths: asset.paths, partial: true,
    })
  })
})
