import { describe, expect, it, vi } from 'vitest'
import { TaskDataProvenance } from '@/platform/telemetry/TaskDataProvenance'
import { RockAssessmentService } from '@/platform/tasks/actions/RockAssessmentAction'
import { SupportAssessmentService } from '@/platform/tasks/actions/SupportAssessmentAction'
import { collectActiveAssetPaths, collectActiveDataVersions, resolveAssetVersions, type TaskAssetManifest } from '@/platform/telemetry/TaskAssetVersions'
import { fingerprintGeneratedAsset } from '@/platform/telemetry/GeneratedAssetVersions'
import { ResourceRegistry } from '@/platform/resources/ResourceRegistry'
import { ResourceManager } from '@/platform/resources/ResourceManager'

describe('task data provenance', () => {
  it('keeps generated models usable without Web Crypto and labels the fallback honestly', async () => {
    vi.stubGlobal('crypto', undefined)
    try {
      const versions = await fingerprintGeneratedAsset('support.arch', new Uint8Array([1, 2]).buffer, { profile: 'I16' })
      expect(versions).toHaveLength(2)
      expect(versions.every(version => version.algorithm === 'fnv1a64-json-v1')).toBe(true)
      expect(versions[0].digest).toMatch(/^[a-f0-9]{16}$/)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('distinguishes generated GLB bytes, parameters and placement without relying on Blob URLs', async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer
    const first = await fingerprintGeneratedAsset('support.arch', bytes, { profile: 'I16', position: [1, 2, 3] })
    const same = await fingerprintGeneratedAsset('support.arch', bytes, { position: [1, 2, 3], profile: 'I16' })
    expect(same.map(version => version.digest)).toEqual(first.map(version => version.digest))
    const changedBytes = await fingerprintGeneratedAsset('support.arch', new Uint8Array([1, 2, 4]).buffer, { profile: 'I16', position: [1, 2, 3] })
    expect(changedBytes[0].digest).not.toBe(first[0].digest)
    expect(changedBytes[1].digest).toBe(first[1].digest)
    const moved = await fingerprintGeneratedAsset('support.arch', bytes, { profile: 'I16', position: [2, 2, 3] })
    expect(moved[1].digest).not.toBe(first[1].digest)
    expect(first[0]).toMatchObject({ locator: 'generated://support.arch', algorithm: 'sha256-bytes-v1' })
    expect(first[0].digest).toMatch(/^[a-f0-9]{64}$/)
  })

  it('includes generated versions only while loaded, captures replacements and isolates snapshots', async () => {
    const registry = new ResourceRegistry()
    let versions = await fingerprintGeneratedAsset('support.arch', new Uint8Array([1]).buffer, { profile: 'I16' })
    registry.registerAll([{
      id: 'support.scene', module: 'support', type: 'support', processes: [], states: [],
      async load() {}, async unload() { versions = [] },
      getActiveDataVersions: () => versions,
    }])
    const manager = new ResourceManager(registry)
    const collect = () => collectActiveDataVersions(['support.scene', 'support.scene'], registry, manager)
    expect(collect()).toEqual([])
    await manager.load(['support.scene'], { viewer: {} as never })
    const snapshot = collect()
    expect(snapshot).toHaveLength(2)
    const originalDigest = snapshot[0].digest
    snapshot[0].digest = 'changed-copy'
    expect(collect()[0].digest).not.toBe('changed-copy')
    versions = await fingerprintGeneratedAsset('support.arch', new Uint8Array([2]).buffer, { profile: 'I20' })
    expect(collect()[0].digest).not.toBe(originalDigest)
    expect(collect()[1].digest).not.toBe(snapshot[1].digest)
    await manager.release(['support.scene'])
    expect(collect()).toEqual([])
  })

  it('fingerprints canonical JSON, notices changes and clears on reset', async () => {
    const provenance = new TaskDataProvenance()
    await provenance.capture('source', '/api/source', [{ a: 1, b: 2 }])
    const first = provenance.list()[0]
    await provenance.capture('source', '/api/source', [{ b: 2, a: 1 }])
    expect(provenance.list()[0].digest).toBe(first.digest)
    await provenance.capture('source', '/api/source', [{ a: 1, b: 3 }])
    expect(provenance.list()[0].digest).not.toBe(first.digest)
    expect(first.algorithm).toMatch(/^(sha256|fnv1a64)-json-v1$/)
    provenance.clear()
    expect(provenance.list()).toEqual([])
  })

  it('captures the exact data returned to quality-check actions', async () => {
    const provenance = new TaskDataProvenance()
    const rock = new RockAssessmentService({
      loadDesignSegments: async () => [{ startMileage: 'YK1+116', endMileage: 'YK1+616', grade: 'IV' }],
      loadFaceRecords: async () => [],
    }, provenance)
    const support = new SupportAssessmentService({ list: async () => [] }, provenance)
    await rock.assess({ start: 278330, end: 278340 })
    await support.assess('main', { start: 278330, end: 278340 }, 'IV')
    expect(provenance.list().map(item => item.sourceId).sort()).toEqual([
      'rock.design-grades', 'rock.face-sketch', 'support.components',
    ])
    expect(provenance.list().find(item => item.sourceId === 'support.components')?.locator)
      .toBe('/api/support?tunnel_id=main')
  })

  it('resolves only actually loaded model paths and rejects missing manifest entries', () => {
    const manifest: TaskAssetManifest = {
      schemaVersion: 1,
      assets: [
        { path: '/data/tunnel/tunnel000.glb', algorithm: 'sha256-bytes-v1', digest: 'a'.repeat(64) },
        { path: '/data/tunnel/tunnel001.glb', algorithm: 'sha256-bytes-v1', digest: 'b'.repeat(64) },
      ],
    }
    const versions = resolveAssetVersions(manifest, ['/data/tunnel/tunnel001.glb'], '2026-10-17T00:00:00.000Z')
    expect(versions).toEqual([{
      sourceId: 'asset:/data/tunnel/tunnel001.glb', locator: '/data/tunnel/tunnel001.glb',
      algorithm: 'sha256-bytes-v1', digest: 'b'.repeat(64), capturedAt: '2026-10-17T00:00:00.000Z',
    }])
    expect(() => resolveAssetVersions(manifest, ['/data/tunnel/tunnel999.glb']))
      .toThrow('任务资产清单缺少文件')
  })

  it('collects asset paths from loaded resources only and deduplicates dependencies', async () => {
    const registry = new ResourceRegistry()
    let loaded = false
    registry.registerAll([
      {
        id: 'common.tunnel', module: 'common', type: 'tunnel', processes: [], states: [],
        async load() { loaded = true }, async unload() { loaded = false },
        getActiveAssetPaths: () => loaded ? ['/data/tunnel/tunnel000.glb'] : [],
      },
      {
        id: 'blast.effect', module: 'blast', type: 'blast', processes: [], states: [],
        dependencies: ['common.tunnel'],
        async load() {}, async unload() {},
        getActiveAssetPaths: () => ['/data/tunnel/tunnel000.glb', '/data/blast/blast_effect.glb'],
      },
    ])
    const manager = new ResourceManager(registry)
    expect(collectActiveAssetPaths(['common.tunnel', 'blast.effect'], registry, manager)).toEqual([])
    await manager.load(['blast.effect'], { viewer: {} as never })
    expect(collectActiveAssetPaths(['common.tunnel', 'blast.effect'], registry, manager)).toEqual([
      '/data/tunnel/tunnel000.glb', '/data/blast/blast_effect.glb',
    ])
    await manager.release(['blast.effect'])
    expect(collectActiveAssetPaths(['common.tunnel', 'blast.effect'], registry, manager)).toEqual([])
  })
})
