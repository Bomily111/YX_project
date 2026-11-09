import { expect, it, vi } from 'vitest'
import { applyTaskVolumeCut, registerTaskVolumeAccess, setTaskVolumeCut, taskVolumeCutDisplay, refreshTaskVolumeCutState } from '@/platform/tasks/TaskVolumeCut'
it('synchronizes presentation state after toggles and a volume replacement', () => {
  let volume: any = { properties: { xmax: 0.99, ymin: 0.01 }, draw: vi.fn() }
  registerTaskVolumeAccess(() => volume)
  expect(taskVolumeCutDisplay.value).toEqual({ available: true, enabled: false })
  setTaskVolumeCut(true)
  expect(taskVolumeCutDisplay.value.enabled).toBe(true)
  setTaskVolumeCut(false)
  expect(taskVolumeCutDisplay.value.enabled).toBe(false)
  volume = undefined
  refreshTaskVolumeCutState()
  expect(taskVolumeCutDisplay.value).toEqual({ available: false, enabled: false })
})
it('restores the original bounds after repeated manual cut toggles and final undo', () => {
  const volume = { properties: { xmax: 0.93, ymin: 0.03 }, draw: vi.fn() }
  registerTaskVolumeAccess(() => volume)
  const undo = applyTaskVolumeCut()
  expect(setTaskVolumeCut(false)).toEqual({ enabled: false, xmax: 0.93, ymin: 0.03 })
  setTaskVolumeCut(true)
  setTaskVolumeCut(false)
  undo()
  expect(volume.properties).toMatchObject({ xmax: 0.93, ymin: 0.03 })
})
it('restores current bounds if the renderer rejects an update', () => {
  const volume = { properties: { xmax: 0.9, ymin: 0.1 }, draw: () => { throw new Error('render failed') } }
  registerTaskVolumeAccess(() => volume)
  expect(() => setTaskVolumeCut(true)).toThrow('render failed')
  expect(volume.properties).toMatchObject({ xmax: 0.9, ymin: 0.1 })
})
it('clips the active volume without altering its original settings after undo', () => {
  const volume = { properties: { xmax: 0.99, ymin: 0.01, density: 5 }, draw: vi.fn() }
  registerTaskVolumeAccess(() => volume)
  const undo = applyTaskVolumeCut()
  expect(volume.properties).toMatchObject({ xmax: 0.5, ymin: 0.2, density: 5 })
  undo()
  expect(volume.properties).toMatchObject({ xmax: 0.99, ymin: 0.01, density: 5 })
  expect(volume.draw).toHaveBeenCalledTimes(2)
})
it('does not restore a cut onto a different task volume', () => {
  const first = { properties: { xmax: 1, ymin: 0 }, draw: vi.fn() }
  let current = first
  registerTaskVolumeAccess(() => current)
  const undo = applyTaskVolumeCut()
  current = { properties: { xmax: 0.8, ymin: 0.1 }, draw: vi.fn() }
  undo()
  expect(current.draw).not.toHaveBeenCalled()
  expect(current.properties.xmax).toBe(0.8)
})
