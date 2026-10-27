import * as Cesium from 'cesium'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { supportSceneResource } from '@/modules/support/resources'

vi.mock('@/modules/support/legacy-resources', () => ({
  legacySupportResources: [],
  legacySupportAssembly: { id: 'support.legacy-assembly' },
}))

vi.mock('@/utils/Common/DrawLine', () => ({
  isDesignRockGradeModelEnabled: () => false,
  isTunnelGlbVisible: () => true,
  setTunnelGlbVisible: vi.fn(),
}))
vi.mock('@/views/support-module/cesiumScene', () => ({
  getArchModelMatrix: () => Cesium.Matrix4.IDENTITY,
  loadTunnelModel: async () => ({ show: true, isDestroyed: () => false }),
}))
vi.mock('@/views/support-module/steelArch', () => ({
  generateSteelArchGLB: async () => new Uint8Array([1, 2, 3]).buffer,
  generateWorkfaceGLB: async () => new Uint8Array([4, 5, 6]).buffer,
}))

const context = () => ({
  viewer: {
    isDestroyed: () => false,
    scene: { primitives: { add: vi.fn(), remove: vi.fn() }, requestRender: vi.fn() },
  } as unknown as Cesium.Viewer,
  task: {
    taskId: 'support-version-check', taskType: 'scene-exploration' as const,
    description: 'YK1+346 支护钢架示例', tunnelId: 'main',
    chainageRange: { start: 1346, end: 1346 }, targetTypes: ['support'],
  },
})

afterEach(async () => {
  await supportSceneResource.unload()
  vi.restoreAllMocks()
})

describe('support generated versions lifecycle', () => {
  it('reports actual generated models and clears fingerprints on unload', async () => {
    vi.spyOn(Cesium.Model, 'fromGltfAsync').mockResolvedValue({} as Cesium.Model)
    expect(supportSceneResource.getActiveDataVersions?.()).toEqual([])
    await supportSceneResource.load(context())
    const versions = supportSceneResource.getActiveDataVersions!()
    expect(versions.map(version => version.sourceId)).toEqual([
      'support.arch', 'support.arch:parameters', 'support.workface', 'support.workface:parameters',
    ])
    expect(versions[0].digest).not.toBe(versions[2].digest)
    await supportSceneResource.unload()
    expect(supportSceneResource.getActiveDataVersions?.()).toEqual([])
    expect(versions).toHaveLength(4)
  })

  it('discards the first model fingerprint if the second model fails to load', async () => {
    vi.spyOn(Cesium.Model, 'fromGltfAsync')
      .mockResolvedValueOnce({} as Cesium.Model)
      .mockRejectedValueOnce(new Error('workface failed'))
    const loadContext = context()
    await expect(supportSceneResource.load(loadContext)).rejects.toThrow('workface failed')
    expect(supportSceneResource.getActiveDataVersions?.()).toEqual([])
    expect(loadContext.viewer.scene.primitives.remove).toHaveBeenCalledTimes(1)
  })
})
