import { resourceManager } from '@/platform/resources/ResourceManager'
import { resourceRegistry } from '@/platform/resources/ResourceRegistry'
import type { BusinessSceneModule } from '@/platform/resources/types'
import type { SceneModuleManifest } from './types'

interface RegisteredModule {
  manifest: SceneModuleManifest
  unregisterResources: () => void
}

export class ModuleRegistry {
  private readonly modules = new Map<BusinessSceneModule, RegisteredModule>()

  register(manifest: SceneModuleManifest): () => void {
    if (this.modules.has(manifest.id)) {
      throw new Error(`[ModuleRegistry] 模块已注册：${manifest.id}`)
    }
    this.validate(manifest)
    const unregisterResources = resourceRegistry.registerAll(manifest.resources)
    this.modules.set(manifest.id, { manifest, unregisterResources })
    return () => this.unregister(manifest.id, manifest)
  }

  replace(manifest: SceneModuleManifest): void {
    const previous = this.modules.get(manifest.id)
    if (!previous) {
      this.register(manifest)
      return
    }

    this.assertIdle(previous.manifest)
    this.validate(manifest, previous.manifest)
    previous.unregisterResources()
    this.modules.delete(manifest.id)

    try {
      this.register(manifest)
    } catch (error) {
      const unregisterResources = resourceRegistry.registerAll(previous.manifest.resources)
      this.modules.set(previous.manifest.id, { manifest: previous.manifest, unregisterResources })
      throw error
    }
  }

  unregister(id: BusinessSceneModule, expected?: SceneModuleManifest): void {
    const current = this.modules.get(id)
    if (!current || (expected && current.manifest !== expected)) return
    this.assertIdle(current.manifest)
    current.unregisterResources()
    this.modules.delete(id)
  }

  get(id: BusinessSceneModule): SceneModuleManifest | undefined {
    return this.modules.get(id)?.manifest
  }

  require(id: BusinessSceneModule): SceneModuleManifest {
    const manifest = this.get(id)
    if (!manifest) throw new Error(`[ModuleRegistry] 模块未注册：${id}`)
    return manifest
  }

  list(): readonly SceneModuleManifest[] {
    return [...this.modules.values()].map(({ manifest }) => manifest)
  }

  private assertIdle(manifest: SceneModuleManifest): void {
    for (const resource of manifest.resources) {
      const state = resourceManager.getState(resource.id)
      if (state.status !== 'idle' || state.references > 0) {
        throw new Error(`[ModuleRegistry] 模块 ${manifest.id} 仍有活动资源：${resource.id}`)
      }
    }
  }

  private validate(manifest: SceneModuleManifest, replacing?: SceneModuleManifest): void {
    if (!manifest.version.trim()) throw new Error(`[ModuleRegistry] 模块 ${manifest.id} 缺少版本号`)
    if (manifest.resources.length === 0) throw new Error(`[ModuleRegistry] 模块 ${manifest.id} 未提供资源`)

    const ids = new Set<string>()
    const replacedIds = new Set(replacing?.resources.map((resource) => resource.id) ?? [])
    for (const resource of manifest.resources) {
      if (resource.module !== manifest.id) {
        throw new Error(`[ModuleRegistry] 资源 ${resource.id} 的 module 必须为 ${manifest.id}`)
      }
      if (!resource.id.startsWith(`${manifest.id}.`)) {
        throw new Error(`[ModuleRegistry] 资源 ID 必须以 ${manifest.id}. 开头：${resource.id}`)
      }
      if (ids.has(resource.id)) throw new Error(`[ModuleRegistry] 模块内资源 ID 重复：${resource.id}`)
      ids.add(resource.id)

      const existing = resourceRegistry.get(resource.id)
      if (existing && !replacedIds.has(resource.id)) {
        throw new Error(`[ModuleRegistry] 资源 ID 已被占用：${resource.id}`)
      }
    }

    for (const resource of manifest.resources) {
      for (const dependency of resource.dependencies ?? []) {
        if (ids.has(dependency)) continue
        const externalDependency = resourceRegistry.get(dependency)
        if (!externalDependency || replacedIds.has(dependency)) {
          throw new Error(`[ModuleRegistry] 资源 ${resource.id} 缺少依赖：${dependency}`)
        }
      }
    }
  }
}

export const moduleRegistry = new ModuleRegistry()
