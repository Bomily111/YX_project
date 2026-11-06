import { expect, it } from 'vitest'
import { changeSceneLayer, registerSceneLayerController } from '@/ai-agent/SceneLayerBridge'
it('reports unavailable pages and validates input before invoking the controller', async () => {
  await expect(changeSceneLayer('tunnel', false)).rejects.toThrow('未接入')
  let calls = 0
  const release = registerSceneLayerController((_layer, visible) => { calls++; return visible })
  try {
    await expect(changeSceneLayer('unknown', true)).rejects.toThrow('无效')
    await expect(changeSceneLayer('tunnel', 'false')).rejects.toThrow('无效')
    expect(calls).toBe(0)
    expect(await changeSceneLayer('tunnel', false)).toEqual({ layer: 'tunnel', visible: false })
  } finally { release() }
})
it('does not let an old page unregister the current controller', async () => {
  const old = registerSceneLayerController(() => true)
  const current = registerSceneLayerController(() => false)
  old()
  expect((await changeSceneLayer('imagery', true)).visible).toBe(false)
  current()
  await expect(changeSceneLayer('imagery', true)).rejects.toThrow('未接入')
})
