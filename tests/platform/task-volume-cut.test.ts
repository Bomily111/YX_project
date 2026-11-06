import { expect, it, vi } from 'vitest'
import { applyTaskVolumeCut, registerTaskVolumeAccess } from '@/platform/tasks/TaskVolumeCut'
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
