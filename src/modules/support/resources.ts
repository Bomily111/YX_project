import * as Cesium from 'cesium'
import { chainageService } from '@/platform/coordinates/ChainageService'
import type { SceneResource } from '@/platform/resources/types'
import type { SceneModuleManifest } from '@/platform/modules/types'
import { moduleRegistry } from '@/platform/modules/ModuleRegistry'
import { registerCommonResources } from '@/platform/resources/common'
import { isDesignRockGradeModelEnabled, isTunnelGlbVisible, setTunnelGlbVisible } from '@/utils/Common/DrawLine'
import { getArchModelMatrix, loadTunnelModel } from '@/views/support-module/cesiumScene'
import { generateSteelArchGLB, generateWorkfaceGLB } from '@/views/support-module/steelArch'
import { fingerprintGeneratedAsset } from '@/platform/telemetry/GeneratedAssetVersions'
import type { DataVersion } from '@/platform/telemetry/TaskDataProvenance'
import { modelerSupportResources } from './modeler-resources'

let supportViewer: Cesium.Viewer | undefined
let referenceTunnel: Cesium.Model | undefined
let archModel: Cesium.Model | undefined
let workfaceModel: Cesium.Model | undefined
let previousPublicTunnelVisibility = true
let changedPublicTunnelVisibility = false
let previousTunnelColor: Cesium.Color | undefined
let previousTunnelBlendMode: Cesium.Model['colorBlendMode'] | undefined
let generatedUrls: string[] = []
const generatedVersions = new Map<'arch' | 'workface', readonly DataVersion[]>()

async function loadDefaultSupportModels(viewer: Cesium.Viewer, tunnel: Cesium.Model): Promise<void> {
  const params = { R1: 6.08, R2: 10.58, betaDeg: 15.8797, profileKey: 'I16' }
  const matrix = getArchModelMatrix(tunnel)
  for (const [kind, glb] of [
    ['arch', await generateSteelArchGLB(params)],
    ['workface', await generateWorkfaceGLB(params)],
  ] as const) {
    const versions = await fingerprintGeneratedAsset(`support.${kind}`, glb, {
      ...params, modelMatrix: Array.from(Cesium.Matrix4.toArray(matrix)),
    })
    const url = URL.createObjectURL(new Blob([glb], { type: 'application/octet-stream' }))
    generatedUrls.push(url)
    const model = await Cesium.Model.fromGltfAsync({ url, modelMatrix: matrix })
    if (kind === 'arch') archModel = model
    else { workfaceModel = model; model.show = false }
    viewer.scene.primitives.add(model)
    generatedVersions.set(kind, versions)
  }
}

export const supportSceneResource: SceneResource = {
  id: 'support.scene',
  module: 'support',
  type: 'parametric-steel-arch-scene',
  chainageRange: { start: chainageService.legacyDkToCanonical(278100), end: chainageService.legacyDkToCanonical(278600) },
  processes: ['support-design', 'steel-arch-installation'],
  states: ['parameterized', 'preview'],
  dependencies: ['common.tunnel'],
  estimatedMemoryMb: 2,
  lifetime: 'task',
  async load(context) {
    supportViewer = context.viewer
    context.reportProgress?.(0.1, '获取公共隧道分段')
    const tunnel = await loadTunnelModel(context.viewer)
    referenceTunnel = tunnel
    previousPublicTunnelVisibility = isTunnelGlbVisible()
    previousTunnelColor = tunnel.color ? Cesium.Color.clone(tunnel.color) : undefined
    previousTunnelBlendMode = tunnel.colorBlendMode
    // 智能体“围岩→支护”同屏装配时保留公共隧道的围岩分级着色。
    changedPublicTunnelVisibility = !(context.task?.taskType === 'scene-exploration' && isDesignRockGradeModelEnabled())
    if (changedPublicTunnelVisibility) setTunnelGlbVisible(false)
    tunnel.show = true
    if (context.task?.taskType === 'scene-exploration') {
      try {
        await loadDefaultSupportModels(context.viewer, tunnel)
      } catch (error) {
        if (archModel) context.viewer.scene.primitives.remove(archModel)
        if (workfaceModel) context.viewer.scene.primitives.remove(workfaceModel)
        for (const url of generatedUrls) URL.revokeObjectURL(url)
        generatedUrls = []
        generatedVersions.clear()
        archModel = undefined
        workfaceModel = undefined
        if (changedPublicTunnelVisibility) setTunnelGlbVisible(previousPublicTunnelVisibility)
        changedPublicTunnelVisibility = false
        referenceTunnel = undefined
        supportViewer = undefined
        throw error
      }
    }
    context.reportProgress?.(1, '支护参考隧道已就绪')
  },
  async unload() {
    const viewer = supportViewer
    if (viewer && !viewer.isDestroyed()) {
      if (archModel) viewer.scene.primitives.remove(archModel)
      if (workfaceModel) viewer.scene.primitives.remove(workfaceModel)
      if (referenceTunnel && !referenceTunnel.isDestroyed()) {
        referenceTunnel.color = previousTunnelColor
        if (previousTunnelBlendMode !== undefined) referenceTunnel.colorBlendMode = previousTunnelBlendMode
      }
      if (changedPublicTunnelVisibility) setTunnelGlbVisible(previousPublicTunnelVisibility)
      viewer.scene.requestRender()
    }
    archModel = undefined
    workfaceModel = undefined
    for (const url of generatedUrls) URL.revokeObjectURL(url)
    generatedUrls = []
    generatedVersions.clear()
    referenceTunnel = undefined
    supportViewer = undefined
    previousTunnelColor = undefined
    previousTunnelBlendMode = undefined
    changedPublicTunnelVisibility = false
  },
  getEnhanceTargets() {
    return [
      referenceTunnel
        ? { id: 'support.reference-tunnel', type: 'shared-tunnel-segment', object: referenceTunnel }
        : undefined,
      archModel ? { id: 'support.steel-arch', type: 'steel-arch', object: archModel } : undefined,
      workfaceModel ? { id: 'support.workface', type: 'workface', object: workfaceModel } : undefined,
    ].filter((target) => target !== undefined)
  },
  getActiveDataVersions() {
    return [...generatedVersions.values()].flat().map(version => ({ ...version }))
  },
}

export const supportResources = [supportSceneResource, ...modelerSupportResources] as const

export const supportModuleManifest: SceneModuleManifest = {
  id: 'support',
  displayName: '围岩支护',
  version: 'legacy-adapter-1.1.0',
  capabilities: ['visibility', 'opacity', 'standard-view', 'pick'],
  coordinateFrame: { kind: 'platform-chainage', prefix: 'YK', origin: 1116, unit: 'm' },
  resources: supportResources,
}

export function registerSupportModule(): void {
  registerCommonResources()
  if (!moduleRegistry.get('support')) moduleRegistry.register(supportModuleManifest)
}

export function getSupportTunnelModel(): Cesium.Model | undefined {
  return referenceTunnel
}

export function trackSupportGeneratedModel(kind: 'arch' | 'workface', model: Cesium.Model, versions: readonly DataVersion[] = []): void {
  if (kind === 'arch') archModel = model
  else workfaceModel = model
  generatedVersions.set(kind, versions.map(version => ({ ...version })))
}
