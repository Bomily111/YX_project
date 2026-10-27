import * as Cesium from 'cesium'
import { chainageService } from '@/platform/coordinates/ChainageService'
import { demoReanchorTransform } from '@/platform/coordinates/DemoReanchor'
import type { TaskContext } from '@/platform/context/TaskContext'
import type { SceneModuleManifest } from '@/platform/modules/types'
import { moduleRegistry } from '@/platform/modules/ModuleRegistry'
import { registerCommonResources } from '@/platform/resources/common'
import type { ChainageRange, SceneResource } from '@/platform/resources/types'
import {
  getDesignRockGradeSegments,
  getDesignRockGradeLabel,
  getTunnelGlbSegment,
  isDesignRockGradeModelEnabled,
  setDesignRockGradeModelEnabled,
  waitForTunnelGlbSegment,
} from '@/utils/Common/DrawLine'
import { activateGeoModel, deactivateGeoModel, getActiveGeoModelKey, waitForGeoModelReady } from '@/utils/Common/GeoModelController'

let rockViewer: Cesium.Viewer | undefined
let selectedSegmentIndex: number | undefined
let previousDesignGradeEnabled = false

const overlaps = (left: ChainageRange, right: ChainageRange): boolean => (
  left.start <= right.end && right.start <= left.end
)

const toDesignRange = (range: ChainageRange): ChainageRange => {
  if (range.start < chainageService.legacyDkReference.origin) return range
  return {
    start: chainageService.fromOffset(
      chainageService.toOffset(range.start, chainageService.legacyDkReference),
      chainageService.datasetReference,
    ),
    end: chainageService.fromOffset(
      chainageService.toOffset(range.end, chainageService.legacyDkReference),
      chainageService.datasetReference,
    ),
  }
}

const selectSegment = async (task: TaskContext): Promise<void> => {
  const viewer = rockViewer
  if (!viewer || viewer.isDestroyed()) throw new Error('[RockResource] Cesium Viewer 尚未初始化')
  const range = toDesignRange(task.chainageRange)
  const matched = getDesignRockGradeSegments().find((segment) => {
    const start = chainageService.tryParse(segment.startMileage)
    const end = chainageService.tryParse(segment.endMileage)
    return start !== undefined && end !== undefined && overlaps(range, { start, end })
  })
  selectedSegmentIndex = matched?.modelIndex
  if (selectedSegmentIndex !== undefined) {
    await waitForTunnelGlbSegment(selectedSegmentIndex, viewer)
  }
  viewer.scene.requestRender()
}

export const rockDesignGradeResource: SceneResource = {
  id: 'rock.design-grade',
  module: 'rock',
  type: 'design-rock-grade',
  chainageRange: { start: 1116, end: 9400 },
  processes: ['rock-assessment', 'support-design'],
  states: ['baseline', 'preview'],
  dependencies: ['common.tunnel'],
  estimatedMemoryMb: 1,
  lifetime: 'task',
  async load(context) {
    rockViewer = context.viewer
    previousDesignGradeEnabled = isDesignRockGradeModelEnabled()
    context.reportProgress?.(0.2, '读取设计围岩分级')
    await setDesignRockGradeModelEnabled(true, context.viewer)
    context.reportProgress?.(1, '设计围岩分级已就绪')
  },
  async activate(task) {
    await selectSegment(task)
  },
  async update(task) {
    await selectSegment(task)
  },
  async unload() {
    const viewer = rockViewer
    selectedSegmentIndex = undefined
    if (viewer && !viewer.isDestroyed() && !previousDesignGradeEnabled) {
      await setDesignRockGradeModelEnabled(false, viewer)
    }
    viewer?.scene.requestRender()
    rockViewer = undefined
    previousDesignGradeEnabled = false
  },
  getEnhanceTargets() {
    const model = selectedSegmentIndex === undefined
      ? undefined
      : getTunnelGlbSegment(selectedSegmentIndex)
    return model && rockViewer
      ? [{
          id: `rock.design-segment-${selectedSegmentIndex}`,
          type: 'design-rock-grade-segment',
          object: model,
          metadata: { segmentIndex: selectedSegmentIndex },
          recommendedEnhancements: ['standard-view', 'label'],
          enhancementParameters: {
            'standard-view': { headingDegrees: 32, pitchDegrees: -18, rangeFactor: 2.8 },
            label: { visible: true },
          },
          adapters: {
            label: (parameters) => {
              const label = getDesignRockGradeLabel(selectedSegmentIndex!)
              if (!label) throw new Error(`[RockResource] 围岩分段标签不存在：${selectedSegmentIndex}`)
              const previous = label.show
              label.show = parameters.visible !== false
              rockViewer?.scene.requestRender()
              return () => {
                label.show = previous
                rockViewer?.scene.requestRender()
              }
            },
            'standard-view': (parameters) => {
              const viewer = rockViewer
              if (!viewer || viewer.isDestroyed()) throw new Error('[RockResource] Cesium Viewer 尚未初始化')
              const camera = viewer.camera
              const previous = {
                position: Cesium.Cartesian3.clone(camera.positionWC),
                direction: Cesium.Cartesian3.clone(camera.directionWC),
                up: Cesium.Cartesian3.clone(camera.upWC),
              }
              const numberOr = (value: unknown, fallback: number): number => (
                typeof value === 'number' && Number.isFinite(value) ? value : fallback
              )
              const heading = Cesium.Math.toRadians(numberOr(parameters.headingDegrees, 32))
              const pitch = Cesium.Math.toRadians(numberOr(parameters.pitchDegrees, -18))
              const range = Math.max(1, numberOr(parameters.rangeFactor, 2.8))
                * Math.max(model.boundingSphere.radius, 1)
              camera.cancelFlight()
              camera.flyToBoundingSphere(model.boundingSphere, {
                duration: 0,
                offset: new Cesium.HeadingPitchRange(heading, pitch, range),
              })
              return () => {
                camera.cancelFlight()
                camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
                camera.setView({
                  destination: previous.position,
                  orientation: { direction: previous.direction, up: previous.up },
                })
                viewer.scene.requestRender()
              }
            },
          },
        }]
      : []
  },
}

const interpretedRockLayers = [
  { id: 'rock.geophysical-grade', key: 'geophysical_grade', type: 'fused-geophysical-grade',
    range: { start: 2244, end: 2344 }, asset: '/data/geophysical_grade/fused_rock_grade_2345.json', texture: '/data/geophysical_grade/fused_rock_grade_2345_volume.png' },
  { id: 'rock.tsp-hardness', key: 'tsp_hardness', type: 'tsp-interpreted-hardness',
    range: { start: 2244, end: 2344 }, asset: '/data/tsp_actual/hardness.json', texture: '/data/tsp_actual/hardness_volume.png' },
  { id: 'rock.tsp-integrity', key: 'tsp_integrity', type: 'tsp-interpreted-integrity',
    range: { start: 2244, end: 2344 }, asset: '/data/tsp_actual/integrity.json', texture: '/data/tsp_actual/integrity_volume.png' },
  { id: 'rock.tem-resistivity', key: 'tem', type: 'tem-apparent-resistivity',
    range: { start: 2244, end: 2303 }, asset: '/data/geophysical_tem/resistivity_contrast.json', texture: '/data/geophysical_tem/resistivity_contrast_volume.png' },
] as const

/** These legacy ShareVolume layers are mutually exclusive and anchored to the YK2+244 demo scene. */
export const rockInterpretationResources: SceneResource[] = interpretedRockLayers.map(layer => ({
  id: layer.id, module: 'rock', type: layer.type,
  chainageRange: layer.range, processes: ['scene-exploration'], states: ['preview'],
  estimatedMemoryMb: 80, lifetime: 'task',
  async load(context) {
    if (context.viewer.isDestroyed()) throw new Error('Cesium Viewer 已销毁')
    const response = await fetch(layer.asset, { method: 'HEAD', signal: context.signal })
    if (!response.ok) throw new Error(`围岩解释层数据不可用：${layer.asset} (${response.status})`)
    const previousKey = getActiveGeoModelKey()
    try {
      const target = context.task?.chainageRange.start
      const demoTransform = target !== undefined && (target < layer.range.start || target > layer.range.end)
        ? demoReanchorTransform(2244, target) : undefined
      activateGeoModel(layer.key, context.viewer, undefined, demoTransform)
      await waitForGeoModelReady(layer.key)
    } catch (error) {
      if (getActiveGeoModelKey() === layer.key) {
        if (previousKey && previousKey !== layer.key) activateGeoModel(previousKey, context.viewer)
        else deactivateGeoModel(context.viewer)
      }
      throw error
    }
    context.reportProgress?.(1, `${layer.type} 已显示`)
  },
  async unload() {
    if (getActiveGeoModelKey() === layer.key) deactivateGeoModel()
  },
  getActiveAssetPaths() { return getActiveGeoModelKey() === layer.key ? [layer.asset, layer.texture] : [] },
}))

export const rockResources = [rockDesignGradeResource, ...rockInterpretationResources] as const

export const rockModuleManifest: SceneModuleManifest = {
  id: 'rock',
  displayName: '隧洞围岩',
  version: 'legacy-adapter-1.0.0',
  capabilities: ['query', 'locate', 'visibility', 'highlight', 'standard-view'],
  coordinateFrame: { kind: 'platform-chainage', prefix: 'YK', origin: 1116, unit: 'm' },
  resources: rockResources,
}

export function registerRockModule(): void {
  registerCommonResources()
  if (!moduleRegistry.get('rock')) moduleRegistry.register(rockModuleManifest)
}
