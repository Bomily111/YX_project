import { describe, expect, it, vi } from 'vitest'
import type * as Cesium from 'cesium'
import { ScreenSpaceEventRegistry } from '@/platform/input/ScreenSpaceEventRegistry'

const fakeHandler = () => {
  let destroyed = false
  const destroy = vi.fn(() => { destroyed = true })
  const handler = {
    destroy,
    isDestroyed: vi.fn(() => destroyed),
    setInputAction: vi.fn(),
    removeInputAction: vi.fn(),
    getInputAction: vi.fn(),
  } as unknown as Cesium.ScreenSpaceEventHandler
  return { handler, destroy }
}

describe('ScreenSpaceEventRegistry', () => {
  it('tracks handlers and removes the record when callers destroy them directly', () => {
    const { handler, destroy } = fakeHandler()
    const registry = new ScreenSpaceEventRegistry(() => handler)
    const created = registry.create('ventilation.pick', {} as HTMLCanvasElement)

    expect(registry.list()).toHaveLength(1)
    created.destroy()
    created.destroy()

    expect(registry.list()).toHaveLength(0)
    expect(destroy).toHaveBeenCalledOnce()
  })

  it('replaces an existing handler owned by the same feature', () => {
    const first = fakeHandler()
    const second = fakeHandler()
    const factory = vi.fn()
      .mockReturnValueOnce(first.handler)
      .mockReturnValueOnce(second.handler)
    const registry = new ScreenSpaceEventRegistry(factory)

    registry.create('support.camera', {} as HTMLCanvasElement)
    registry.create('support.camera', {} as HTMLCanvasElement)

    expect(first.destroy).toHaveBeenCalledOnce()
    expect(registry.get('support.camera')?.handler).toBe(second.handler)
  })

  it('releases a module prefix without touching other modules', () => {
    const handlers = [fakeHandler(), fakeHandler(), fakeHandler()]
    const registry = new ScreenSpaceEventRegistry(vi.fn()
      .mockReturnValueOnce(handlers[0].handler)
      .mockReturnValueOnce(handlers[1].handler)
      .mockReturnValueOnce(handlers[2].handler))
    registry.create('ventilation.camera', {} as HTMLCanvasElement)
    registry.create('ventilation.pick', {} as HTMLCanvasElement)
    registry.create('blast.camera', {} as HTMLCanvasElement)

    registry.releasePrefix('ventilation.')

    expect(registry.list().map(({ owner }) => owner)).toEqual(['blast.camera'])
    expect(handlers[0].destroy).toHaveBeenCalledOnce()
    expect(handlers[1].destroy).toHaveBeenCalledOnce()
    expect(handlers[2].destroy).not.toHaveBeenCalled()
  })
})
