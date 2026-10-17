import type { Component } from 'vue'
import type { BusinessSceneModule, SceneResource } from '@/platform/resources/types'

export type ModuleCapability =
  | 'query'
  | 'locate'
  | 'visibility'
  | 'opacity'
  | 'highlight'
  | 'section'
  | 'standard-view'
  | 'chart'
  | 'pick'

export interface PlatformChainageFrame {
  kind: 'platform-chainage'
  prefix: string
  origin: number
  unit: 'm'
}

export interface LocalEngineeringFrame {
  kind: 'local-engineering'
  unit: 'm'
  description: string
  /** 说明局部坐标如何转换到平台世界坐标。 */
  transformId: string
}

export type ModuleCoordinateFrame = PlatformChainageFrame | LocalEngineeringFrame

export interface SceneModulePanel {
  load: () => Promise<{ default: Component }>
}

/** 业务模块交付给平台的唯一入口。 */
export interface SceneModuleManifest {
  id: BusinessSceneModule
  displayName: string
  version: string
  capabilities: readonly ModuleCapability[]
  coordinateFrame: ModuleCoordinateFrame
  resources: readonly SceneResource[]
  panel?: SceneModulePanel
}
