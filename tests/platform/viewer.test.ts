import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('cesium', () => {
  class Viewer {
    container: any
    scene = { requestRender: vi.fn() }
    resize = vi.fn()
    private destroyed = false

    constructor(container: any) {
      this.container = container
    }

    isDestroyed() { return this.destroyed }
    destroy() { this.destroyed = true }
  }
  return { Viewer }
})

import { ViewerService } from '@/platform/viewer/ViewerService'

function element() {
  const attributes = new Map<string, string>()
  return {
    parentElement: null as any,
    children: [] as any[],
    setAttribute(name: string, value: string) { attributes.set(name, value) },
    getAttribute(name: string) { return attributes.get(name) },
    appendChild(child: any) {
      child.parentElement = this
      this.children.push(child)
      return child
    },
  }
}

describe('ViewerService', () => {
  let service: ViewerService

  beforeEach(() => {
    service = new ViewerService()
  })

  it('只允许一个存活 Viewer，并分配稳定实例编号', () => {
    const viewer = service.create(element() as any, { owner: 'main-platform' }) as any
    expect(viewer.container.getAttribute('data-viewer-instance-id')).toBe('1')
    expect(service.currentOwner).toBe('main-platform')
    expect(() => service.create(element() as any, { owner: 'blast-module' })).toThrow('第二个')
  })

  it('移动 Viewer 容器并转移 owner，不重建实例', () => {
    const viewer = service.create(element() as any, { owner: 'main-platform' }) as any
    const nextHost = element()

    const attached = service.attachTo(nextHost as any, 'support-module')
    expect(attached).toBe(viewer)
    expect(viewer.container.parentElement).toBe(nextHost)
    expect(service.currentOwner).toBe('support-module')
    expect(viewer.resize).toHaveBeenCalledOnce()
    expect(viewer.scene.requestRender).toHaveBeenCalledOnce()
  })

  it('拒绝销毁非当前实例，并在正常销毁时通知订阅者', () => {
    const states: unknown[] = []
    service.subscribe((viewer) => states.push(viewer))
    const viewer = service.create(element() as any) as any

    expect(() => service.destroy({} as any)).toThrow('非当前')
    service.destroy(viewer)
    expect(viewer.isDestroyed()).toBe(true)
    expect(service.current).toBeUndefined()
    expect(states).toEqual([viewer, undefined])
  })

  it('能识别被旧代码直接销毁的失效 Viewer', () => {
    const viewer = service.create(element() as any) as any
    viewer.destroy()
    expect(service.current).toBeUndefined()
    expect(service.currentOwner).toBeUndefined()
  })

  it('wait 在 Viewer 创建后解析', async () => {
    const waiting = service.wait()
    const viewer = service.create(element() as any)
    await expect(waiting).resolves.toBe(viewer)
  })
})
