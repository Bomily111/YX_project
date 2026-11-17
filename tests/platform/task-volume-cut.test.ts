import { expect, it, vi } from 'vitest'
import { applyTaskVolumeCut, registerTaskVolumeAccess, setTaskVolumeCut, taskVolumeCutDisplay, refreshTaskVolumeCutState,captureTaskVolumeCut } from '@/platform/tasks/TaskVolumeCut'
it('synchronizes presentation state after toggles and a volume replacement', () => {
  let volume: any = { properties: { xmax: 0.99, ymin: 0.01 }, draw: vi.fn() }
  registerTaskVolumeAccess(() => volume)
  expect(taskVolumeCutDisplay.value).toMatchObject({ available: true, enabled: false })
  setTaskVolumeCut(true)
  expect(taskVolumeCutDisplay.value.enabled).toBe(true)
  setTaskVolumeCut(false)
  expect(taskVolumeCutDisplay.value.enabled).toBe(false)
  volume = undefined
  refreshTaskVolumeCutState()
  expect(taskVolumeCutDisplay.value).toMatchObject({ available: false, enabled: false })
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

it('retains longitudinal context or opens the near-end according to the selected objective and restores exactly',()=>{
 const volume={properties:{xmax:.93,ymin:.03,density:5},draw:vi.fn()};registerTaskVolumeAccess(()=>volume)
 const undo=applyTaskVolumeCut()
 setTaskVolumeCut(true,'geology-section');expect(volume.properties).toMatchObject({xmax:.5,ymin:.03,density:5})
 setTaskVolumeCut(true,'structure-window');expect(volume.properties).toMatchObject({xmax:.5,ymin:.2})
 expect(()=>setTaskVolumeCut(true,'invented' as any)).toThrow('不支持')
 undo();expect(volume.properties).toMatchObject({xmax:.93,ymin:.03,density:5})
})

it('captures the current cut state for combined view rollback without changing source restoration baseline',()=>{
 const volume={properties:{xmax:.99,ymin:.01},draw:vi.fn()};registerTaskVolumeAccess(()=>volume)
 setTaskVolumeCut(true,'geology-section');const restore=captureTaskVolumeCut()
 setTaskVolumeCut(true,'structure-window');restore()
 expect(volume.properties).toMatchObject({xmax:.5,ymin:.01});expect(taskVolumeCutDisplay.value.preset).toBe('geology-section')
 setTaskVolumeCut(false);expect(volume.properties.xmax).toBe(.99)
})
