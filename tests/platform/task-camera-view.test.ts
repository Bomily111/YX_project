import * as C from 'cesium'
import { expect, it, vi } from 'vitest'
vi.mock('@/modules/face-sketch/resources', () => ({ getActiveFaceSlices: () => [] }))
vi.mock('@/modules/rock/drill-resource', () => ({ getActiveDrillModels: () => [] }))
vi.mock('@/modules/support/modeler-resources', async importOriginal => ({ ...await importOriginal<typeof import('@/modules/support/modeler-resources')>(), getActiveModelerSupportModel: () => undefined }))
vi.mock('@/views/tunnel-module/blast', () => ({ getBlastModel: () => undefined, blastViewOffset: () => undefined }))
import { focusTaskCamera, taskCameraSelection, resetTaskCameraSelection, availableTaskCameraViews } from '@/platform/tasks/TaskCameraView'
it('offers support and excavation views for the actual test-section resource IDs',()=>{
 expect(availableTaskCameraViews(['rock.three-bench','support.test-section-z-pm'])).toEqual(['overview','support','excavation'])
 expect(availableTaskCameraViews(['support.test-section'])).toEqual(['overview','support'])
 expect(availableTaskCameraViews([])).toEqual(['overview'])
})
it('rejects a missing focus model before changing the camera', () => {
  resetTaskCameraSelection()
  const viewer = { camera: { viewBoundingSphere: vi.fn() } } as any
  expect(() => focusTaskCamera(viewer, ['support.modeler-zz-va'], 2244, 'face')).toThrow('没有可聚焦')
  expect(viewer.camera.viewBoundingSphere).not.toHaveBeenCalled()
  expect(taskCameraSelection.value).toBe('auto')
})
it('frames an airflow overview using both ends of the task segment', () => {
  const viewBoundingSphere = vi.fn()
  const viewer = { camera: { cancelFlight:vi.fn(),viewBoundingSphere, lookAtTransform: vi.fn() }, container: { closest: () => false }, scene: { requestRender: vi.fn() } } as any
  focusTaskCamera(viewer, ['ventilation.steady-cfd'], 4000, 'overview')
  const [sphere, offset] = viewBoundingSphere.mock.calls[0] as [C.BoundingSphere, C.HeadingPitchRange]
  expect(sphere.radius).toBeGreaterThan(100)
  expect(offset.range).toBeGreaterThan(sphere.radius * 2)
  expect(taskCameraSelection.value).toBe('overview')
  resetTaskCameraSelection()
  expect(taskCameraSelection.value).toBe('auto')
})
