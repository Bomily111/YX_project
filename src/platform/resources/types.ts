import type * as Cesium from 'cesium'
import type { TaskContext } from '@/platform/context/TaskContext'
import type { DataVersion } from '@/platform/telemetry/TaskDataProvenance'

export type SceneModule = 'common' | 'rock' | 'blast' | 'support' | 'dispatch' | 'ventilation'
export type BusinessSceneModule = Exclude<SceneModule, 'common'>

export interface ChainageRange {
  start: number
  end: number
}

export type AdvancedEnhancementStrategy = 'section' | 'label' | 'standard-view' | 'chart'
export type EnhanceTargetUndo = () => void | Promise<void>
export type EnhanceTargetAdapter = (
  parameters: Readonly<Record<string, unknown>>,
) => EnhanceTargetUndo | Promise<EnhanceTargetUndo>

export interface EnhanceTarget {
  id: string
  type: string
  object?: Cesium.Entity | Cesium.Primitive | Cesium.Model
  metadata?: Readonly<Record<string, unknown>>
  /** 模块负责实现自身高级表达，平台只负责编排、冲突裁决和逆序撤销。 */
  adapters?: Partial<Record<AdvancedEnhancementStrategy, EnhanceTargetAdapter>>
  /** 仅推荐必要表达，避免平台把所有增强同时施加到同一目标。 */
  recommendedEnhancements?: readonly AdvancedEnhancementStrategy[]
  enhancementParameters?: Partial<
    Record<AdvancedEnhancementStrategy, Readonly<Record<string, unknown>>>
  >
}

export interface ResourceLoadContext {
  viewer: Cesium.Viewer
  task?: TaskContext
  signal?: AbortSignal
  reportProgress?: (progress: number, message?: string) => void
}

export interface SceneResource {
  id: string
  module: SceneModule
  type: string
  chainageRange?: ChainageRange
  processes: readonly string[]
  states: readonly string[]
  dependencies?: readonly string[]
  estimatedMemoryMb?: number
  /** application 资源在引用归零后保持常驻，仅由 disposeAll 强制释放。 */
  lifetime?: 'application' | 'task'
  load(context: ResourceLoadContext): Promise<void>
  activate?(context: TaskContext): Promise<void>
  update?(context: TaskContext): Promise<void>
  deactivate?(): Promise<void>
  unload(): Promise<void>
  getEnhanceTargets?(): readonly EnhanceTarget[]
  /** 仅报告此刻已加载/已使用的 public 资产路径，供结果快照关联构建时内容指纹。 */
  getActiveAssetPaths?(): readonly string[]
  /** 当前实际加载的动态资产指纹；卸载或替换模型时同步清理/更新。 */
  getActiveDataVersions?(): readonly DataVersion[]
}
