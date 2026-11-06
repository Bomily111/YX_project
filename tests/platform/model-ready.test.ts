import { expect, it, vi } from 'vitest'
import { waitForModelReady, waitForSceneEntitiesReady } from '@/platform/tasks/samples/SceneExplorationWorkflow'
it('waits for entity material updates and stops its frame pump', async () => {
  vi.useFakeTimers()
  try {
    let listener = () => {}, frames = 0
    const remove = vi.fn()
    const viewer = { dataSourceDisplay: { ready: false }, scene: {
      postRender: { addEventListener: (callback: () => void) => { listener = callback; return remove } },
      requestRender: () => { if (++frames === 3) viewer.dataSourceDisplay.ready = true; listener() },
    } } as any
    const pending = waitForSceneEntitiesReady(viewer, 1000)
    await vi.advanceTimersByTimeAsync(400); await pending
    expect(frames).toBe(5); expect(remove).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1000); expect(frames).toBe(5)
  } finally { vi.useRealTimers() }
})
it('requests later frames for async uploads and stops requesting after ready', async () => {
  vi.useFakeTimers()
  try {
    let listener = () => {}, ready = false, frames = 0
    const remove = vi.fn()
    const model = { get ready() { return ready }, readyEvent: { addEventListener: (callback: () => void) => { listener = callback; return remove } } } as any
    const pending = waitForModelReady(model, () => { frames++; if (frames === 2) { ready = true; listener() } }, 1000)
    await vi.advanceTimersByTimeAsync(100); await pending
    expect(frames).toBe(2); expect(remove).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1000); expect(frames).toBe(2)
  } finally { vi.useRealTimers() }
})
it('cleans its event and frame pump after timeout', async () => {
  vi.useFakeTimers()
  try {
    const remove = vi.fn(), request = vi.fn()
    const pending = waitForModelReady({ ready: false, readyEvent: { addEventListener: () => remove } } as any, request, 1000).catch(error => error)
    await vi.advanceTimersByTimeAsync(1000)
    expect((await pending).message).toContain('就绪超时')
    const count = request.mock.calls.length
    await vi.advanceTimersByTimeAsync(1000)
    expect(request).toHaveBeenCalledTimes(count); expect(remove).toHaveBeenCalledOnce()
  } finally { vi.useRealTimers() }
})
