import type { ResourceLoadContext, SceneResource } from './types'
import type { TaskContext } from '@/platform/context/TaskContext'
import { ResourceRegistry, resourceRegistry } from './ResourceRegistry'

export type ResourceStatus = 'idle' | 'loading' | 'loaded' | 'unloading' | 'failed'

export interface ResourceRuntimeState {
  id: string
  status: ResourceStatus
  references: number
  error?: unknown
  loadDurationMs?: number
}

export interface ResourceOperationResult {
  id: string
  status: ResourceStatus
  durationMs: number
  error?: unknown
}

type StateListener = (state: Readonly<ResourceRuntimeState>) => void

export class ResourceManager {
  private readonly states = new Map<string, ResourceRuntimeState>()
  private readonly listeners = new Set<StateListener>()
  private operationQueue: Promise<void> = Promise.resolve()

  constructor(private readonly registry: ResourceRegistry) {}

  getState(id: string): Readonly<ResourceRuntimeState> {
    return { ...(this.states.get(id) ?? { id, status: 'idle', references: 0 }) }
  }

  listStates(): readonly Readonly<ResourceRuntimeState>[] {
    return this.registry.list().map((resource) => this.getState(resource.id))
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  load(ids: readonly string[], context: ResourceLoadContext): Promise<readonly ResourceOperationResult[]> {
    return this.enqueue(() => this.loadInternal(ids, context))
  }

  release(ids: readonly string[]): Promise<readonly ResourceOperationResult[]> {
    return this.enqueue(() => this.releaseInternal(ids))
  }

  async deactivate(ids: readonly string[]): Promise<void> {
    await this.enqueue(async () => {
      const order = [...this.registry.resolveLoadOrder(ids)].reverse()
      for (const resource of order) {
        if (this.getState(resource.id).status === 'loaded') await resource.deactivate?.()
      }
    })
  }

  async activate(ids: readonly string[], context: TaskContext): Promise<void> {
    await this.enqueue(async () => {
      const order = this.registry.resolveLoadOrder(ids)
      for (const resource of order) {
        if (this.getState(resource.id).status === 'loaded') await resource.activate?.(context)
      }
    })
  }

  async update(ids: readonly string[], context: TaskContext): Promise<void> {
    await this.enqueue(async () => {
      const order = this.registry.resolveLoadOrder(ids)
      for (const resource of order) {
        if (this.getState(resource.id).status !== 'loaded') continue
        if (resource.update) await resource.update(context)
        else await resource.activate?.(context)
      }
    })
  }

  async disposeAll(): Promise<readonly ResourceOperationResult[]> {
    return this.enqueue(async () => {
      const loadedIds = this.registry.list()
        .filter((resource) => this.getState(resource.id).status === 'loaded')
        .map((resource) => resource.id)
      const dependencyOrder = this.registry.resolveLoadOrder(loadedIds)
      return this.unloadResources([...dependencyOrder].reverse(), true)
    })
  }

  private async loadInternal(
    ids: readonly string[],
    context: ResourceLoadContext,
  ): Promise<readonly ResourceOperationResult[]> {
    if (context.signal?.aborted) throw new DOMException('资源加载已取消', 'AbortError')
    const order = this.registry.resolveLoadOrder(ids)
    const increments = this.registry.resolveReferenceCounts(ids)
    const newlyLoaded: SceneResource[] = []
    const results: ResourceOperationResult[] = []

    try {
      for (const resource of order) {
        if (context.signal?.aborted) throw new DOMException('资源加载已取消', 'AbortError')
        const current = this.getState(resource.id)
        if (current.status === 'loaded') continue

        const startedAt = performance.now()
        this.updateState(resource.id, { status: 'loading', error: undefined })
        try {
          await resource.load(context)
          const durationMs = performance.now() - startedAt
          newlyLoaded.push(resource)
          this.updateState(resource.id, { status: 'loaded', loadDurationMs: durationMs })
          results.push({ id: resource.id, status: 'loaded', durationMs })
        } catch (error) {
          const durationMs = performance.now() - startedAt
          this.updateState(resource.id, { status: 'failed', error })
          results.push({ id: resource.id, status: 'failed', durationMs, error })
          throw error
        }
      }

      for (const [id, increment] of increments) {
        const state = this.getState(id)
        this.updateState(id, { references: state.references + increment })
      }
      return results
    } catch (error) {
      await this.unloadResources([...newlyLoaded].reverse(), true)
      throw error
    }
  }

  private async releaseInternal(ids: readonly string[]): Promise<readonly ResourceOperationResult[]> {
    const decrements = this.registry.resolveReferenceCounts(ids)
    const order = [...this.registry.resolveLoadOrder(ids)].reverse()

    for (const [id, decrement] of decrements) {
      const state = this.getState(id)
      this.updateState(id, { references: Math.max(0, state.references - decrement) })
    }

    const releasable = order.filter((resource) => {
      const state = this.getState(resource.id)
      return state.status === 'loaded' && state.references === 0 && resource.lifetime !== 'application'
    })
    return this.unloadResources(releasable, false)
  }

  private async unloadResources(
    resources: readonly SceneResource[],
    force: boolean,
  ): Promise<readonly ResourceOperationResult[]> {
    const results: ResourceOperationResult[] = []
    for (const resource of resources) {
      const state = this.getState(resource.id)
      if (state.status !== 'loaded' && state.status !== 'failed') continue
      if (!force && state.references > 0) continue

      const startedAt = performance.now()
      this.updateState(resource.id, { status: 'unloading' })
      try {
        await resource.deactivate?.()
        await resource.unload()
        const durationMs = performance.now() - startedAt
        this.updateState(resource.id, { status: 'idle', references: 0, error: undefined })
        results.push({ id: resource.id, status: 'idle', durationMs })
      } catch (error) {
        const durationMs = performance.now() - startedAt
        this.updateState(resource.id, { status: 'failed', references: 0, error })
        results.push({ id: resource.id, status: 'failed', durationMs, error })
      }
    }
    return results
  }

  private updateState(id: string, patch: Partial<ResourceRuntimeState>): void {
    const next = { ...this.getState(id), ...patch, id }
    this.states.set(id, next)
    for (const listener of this.listeners) listener({ ...next })
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation, operation)
    this.operationQueue = result.then(() => undefined, () => undefined)
    return result
  }
}

export const resourceManager = new ResourceManager(resourceRegistry)
