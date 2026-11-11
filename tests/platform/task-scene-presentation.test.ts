import { afterEach, expect, it, vi } from 'vitest'
import * as C from 'cesium'
const state = vi.hoisted(() => ({ faces: [] as any[], drills: [] as any[], tunnel: undefined as any }))
vi.mock('@/modules/face-sketch/resources', () => ({ getActiveFaceSlices: () => state.faces }))
vi.mock('@/modules/rock/drill-resource', () => ({ getActiveDrillModels: () => state.drills }))
vi.mock('@/modules/support/modeler-resources', async importOriginal => ({ ...await importOriginal<typeof import('@/modules/support/modeler-resources')>(), getActiveModelerSupportModel: () => undefined }))
vi.mock('@/views/tunnel-module/blast', () => ({ getBlastModel: () => undefined, blastViewOffset: () => undefined }))
vi.mock('@/utils/Common/DrawLine', () => ({ getTunnelGlbSegment: (index: number) => index === 0 ? state.tunnel : undefined }))
import { presentTaskScene, taskPresentationProfile } from '@/platform/tasks/TaskScenePresentation'

it('chooses a section-wide view for interpreted volumes and airflow instead of component detail', () => {
  expect(taskPresentationProfile(['rock.tsp-hardness', 'support.modeler-zz-va']).view).toBe('geophysical-context')
  expect(taskPresentationProfile(['blast.effect', 'ventilation.steady-cfd']).view).toBe('airflow-context')
  expect(taskPresentationProfile(['rock.face-photos', 'support.modeler-zz-va']).view).toBe('component-detail')
})
afterEach(() => { state.faces = []; state.drills = []; state.tunnel = undefined })
it.each([false, true])('restores task-specific transparency on undo or presentation failure=%s', fail => {
  const position = C.Cartesian3.fromDegrees(94.9, 29.5, 3000)
  const face = new C.Entity({ position, wall: { positions: [position, position], material: new C.ImageMaterialProperty({ image: 'test.png', color: C.Color.WHITE }) } })
  state.faces = [face]; state.drills = [{ boundingSphere: new C.BoundingSphere(position, 15) }]
  state.tunnel = { color: C.Color.WHITE.clone(), colorBlendMode: C.ColorBlendMode.HIGHLIGHT, colorBlendAmount: 0.5 }
  const viewer = { camera: { positionWC: position, directionWC: C.Cartesian3.UNIT_X, upWC: C.Cartesian3.UNIT_Z,
    viewBoundingSphere: vi.fn(() => { if (fail) throw new Error('camera failure') }), lookAtTransform: vi.fn(), moveRight: vi.fn(), setView: vi.fn() },
    scene: { requestRender: vi.fn(), backgroundColor: C.Color.CORNFLOWERBLUE.clone(), globe: { show: true }, skyBox: { show: true }, skyAtmosphere: { show: true }, sun: { show: true }, moon: { show: true }, fog: { enabled: true } }, container: { closest: () => true }, isDestroyed: () => false } as any
  const environment=()=>JSON.stringify({background:viewer.scene.backgroundColor,globe:viewer.scene.globe,skyBox:viewer.scene.skyBox,skyAtmosphere:viewer.scene.skyAtmosphere,sun:viewer.scene.sun,moon:viewer.scene.moon,fog:viewer.scene.fog})
  const beforeEnvironment=environment()
  if (fail) expect(() => presentTaskScene(viewer, ['rock.face-photos', 'rock.advance-drill'], 2244)).toThrow('camera failure')
  else {
    const undo = presentTaskScene(viewer, ['rock.face-photos', 'rock.advance-drill'], 2244)
    expect(state.tunnel.color.alpha).toBe(0.06)
    expect(environment()).toBe(beforeEnvironment)
    expect((face.wall!.material as C.ImageMaterialProperty).color!.getValue(C.JulianDate.now()).alpha).toBe(1)
    undo()
  }
  expect(state.tunnel.color.alpha).toBe(1)
  expect(environment()).toBe(beforeEnvironment)
  expect((face.wall!.material as C.ImageMaterialProperty).color!.getValue(C.JulianDate.now()).alpha).toBe(1)
})
