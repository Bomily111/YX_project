import { describe, expect, it, vi } from 'vitest'
import { ResourceRegistry } from '@/platform/resources/ResourceRegistry'
import { ResourceManager } from '@/platform/resources/ResourceManager'
import type { SceneResource } from '@/platform/resources/types'

function resource(
  id: string,
  options: {
    dependencies?: string[]
    lifetime?: 'application' | 'task'
    load?: () => Promise<void>
    unload?: () => Promise<void>
  } = {},
): SceneResource {
  return {
    id,
    module: id.startsWith('common.') ? 'common' : 'blast',
    type: 'test',
    processes: [],
    states: [],
    dependencies: options.dependencies,
    lifetime: options.lifetime,
    load: options.load ?? (async () => undefined),
    unload: options.unload ?? (async () => undefined),
  }
}

const context = { viewer: {} as any }

describe('ResourceRegistry', () => {
  it('按依赖优先顺序解析，并对同一根资源去重引用', () => {
    const registry = new ResourceRegistry()
    registry.registerAll([
      resource('common.base'),
      resource('blast.overlay', { dependencies: ['common.base'] }),
    ])

    expect(registry.resolveLoadOrder(['blast.overlay']).map(({ id }) => id))
      .toEqual(['common.base', 'blast.overlay'])
    expect([...registry.resolveReferenceCounts(['blast.overlay', 'blast.overlay'])])
      .toEqual([['common.base', 1], ['blast.overlay', 1]])
  })

  it('拒绝缺失依赖和循环依赖', () => {
    const missing = new ResourceRegistry()
    missing.register(resource('blast.overlay', { dependencies: ['common.missing'] }))
    expect(() => missing.resolveLoadOrder(['blast.overlay'])).toThrow('未注册资源')

    const cyclic = new ResourceRegistry()
    cyclic.registerAll([
      resource('blast.a', { dependencies: ['blast.b'] }),
      resource('blast.b', { dependencies: ['blast.a'] }),
    ])
    expect(() => cyclic.resolveLoadOrder(['blast.a'])).toThrow('循环')
  })

  it('批量注册失败时不留下部分资源', () => {
    const registry = new ResourceRegistry()
    const occupied = resource('blast.occupied')
    registry.register(occupied)

    expect(() => registry.registerAll([
      resource('blast.new'),
      resource('blast.occupied'),
    ])).toThrow('重复')
    expect(registry.get('blast.new')).toBeUndefined()
    expect(registry.get('blast.occupied')).toBe(occupied)
  })
})

describe('ResourceManager', () => {
  it('只加载一次并按引用计数逆序释放', async () => {
    const events: string[] = []
    const registry = new ResourceRegistry()
    registry.registerAll([
      resource('common.base', {
        load: async () => { events.push('load:base') },
        unload: async () => { events.push('unload:base') },
      }),
      resource('blast.overlay', {
        dependencies: ['common.base'],
        load: async () => { events.push('load:overlay') },
        unload: async () => { events.push('unload:overlay') },
      }),
    ])
    const manager = new ResourceManager(registry)

    await manager.load(['blast.overlay'], context)
    await manager.load(['blast.overlay'], context)
    expect(events).toEqual(['load:base', 'load:overlay'])
    expect(manager.getState('common.base').references).toBe(2)

    await manager.release(['blast.overlay'])
    expect(events).toEqual(['load:base', 'load:overlay'])
    await manager.release(['blast.overlay'])
    expect(events).toEqual(['load:base', 'load:overlay', 'unload:overlay', 'unload:base'])
  })

  it('加载失败时回滚本次已经加载的依赖', async () => {
    const unloadDependency = vi.fn(async () => undefined)
    const registry = new ResourceRegistry()
    registry.registerAll([
      resource('common.base', { unload: unloadDependency }),
      resource('blast.failure', {
        dependencies: ['common.base'],
        load: async () => { throw new Error('boom') },
      }),
    ])
    const manager = new ResourceManager(registry)

    await expect(manager.load(['blast.failure'], context)).rejects.toThrow('boom')
    expect(unloadDependency).toHaveBeenCalledOnce()
    expect(manager.getState('common.base')).toMatchObject({ status: 'idle', references: 0 })
    expect(manager.getState('blast.failure').status).toBe('failed')
  })

  it('应用级资源在引用归零后常驻，仅由 disposeAll 释放', async () => {
    const unload = vi.fn(async () => undefined)
    const registry = new ResourceRegistry()
    registry.register(resource('common.base', { lifetime: 'application', unload }))
    const manager = new ResourceManager(registry)

    await manager.load(['common.base'], context)
    await manager.release(['common.base'])
    expect(manager.getState('common.base')).toMatchObject({ status: 'loaded', references: 0 })
    expect(unload).not.toHaveBeenCalled()

    await manager.disposeAll()
    expect(unload).toHaveBeenCalledOnce()
    expect(manager.getState('common.base').status).toBe('idle')
  })

  it('并发操作按提交顺序串行执行', async () => {
    const events: string[] = []
    let finishLoad!: () => void
    const registry = new ResourceRegistry()
    registry.register(resource('blast.slow', {
      load: () => new Promise<void>((resolve) => {
        events.push('load:start')
        finishLoad = () => { events.push('load:end'); resolve() }
      }),
      unload: async () => { events.push('unload') },
    }))
    const manager = new ResourceManager(registry)

    const loading = manager.load(['blast.slow'], context)
    const releasing = manager.release(['blast.slow'])
    await vi.waitFor(() => expect(events).toEqual(['load:start']))
    finishLoad()
    await Promise.all([loading, releasing])
    expect(events).toEqual(['load:start', 'load:end', 'unload'])
  })
})
