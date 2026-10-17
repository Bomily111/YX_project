import type { SceneModule, SceneResource } from './types'

export class ResourceRegistry {
  private readonly resources = new Map<string, SceneResource>()

  register(resource: SceneResource): () => void {
    const existing = this.resources.get(resource.id)
    if (existing && existing !== resource) {
      throw new Error(`[ResourceRegistry] 资源 ID 重复：${resource.id}`)
    }
    this.resources.set(resource.id, resource)
    return () => {
      if (this.resources.get(resource.id) === resource) this.resources.delete(resource.id)
    }
  }

  registerAll(resources: readonly SceneResource[]): () => void {
    const ids = new Set<string>()
    for (const resource of resources) {
      if (ids.has(resource.id)) throw new Error(`[ResourceRegistry] 批次内资源 ID 重复：${resource.id}`)
      ids.add(resource.id)
      const existing = this.resources.get(resource.id)
      if (existing && existing !== resource) {
        throw new Error(`[ResourceRegistry] 资源 ID 重复：${resource.id}`)
      }
    }
    const unregister = resources.map((resource) => this.register(resource))
    return () => unregister.reverse().forEach((stop) => stop())
  }

  get(id: string): SceneResource | undefined {
    return this.resources.get(id)
  }

  require(id: string): SceneResource {
    const resource = this.get(id)
    if (!resource) throw new Error(`[ResourceRegistry] 未注册资源：${id}`)
    return resource
  }

  list(module?: SceneModule): readonly SceneResource[] {
    const resources = [...this.resources.values()]
    return module ? resources.filter((resource) => resource.module === module) : resources
  }

  /** 返回依赖优先的加载顺序，并检查缺失依赖和循环依赖。 */
  resolveLoadOrder(ids: readonly string[]): readonly SceneResource[] {
    const visited = new Set<string>()
    const visiting = new Set<string>()
    const result: SceneResource[] = []

    const visit = (id: string, path: readonly string[]) => {
      if (visited.has(id)) return
      if (visiting.has(id)) {
        throw new Error(`[ResourceRegistry] 资源依赖存在循环：${[...path, id].join(' -> ')}`)
      }
      const resource = this.require(id)
      visiting.add(id)
      for (const dependency of resource.dependencies ?? []) visit(dependency, [...path, id])
      visiting.delete(id)
      visited.add(id)
      result.push(resource)
    }

    for (const id of ids) visit(id, [])
    return result
  }

  /** 计算每个根资源对依赖项产生的引用次数。 */
  resolveReferenceCounts(ids: readonly string[]): ReadonlyMap<string, number> {
    const counts = new Map<string, number>()
    for (const rootId of new Set(ids)) {
      const perRoot = new Set(this.resolveLoadOrder([rootId]).map((resource) => resource.id))
      for (const id of perRoot) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return counts
  }
}

export const resourceRegistry = new ResourceRegistry()
