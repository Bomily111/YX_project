import * as C from 'cesium'
import { readonly, ref } from 'vue'
import { chainageService } from '@/platform/coordinates/ChainageService'
import { getActiveFaceSlices } from '@/modules/face-sketch/resources'
import { faceSliceSphere } from '@/modules/face-sketch/task-face-section'
import { getActiveDrillModels } from '@/modules/rock/drill-resource'
import { getActiveModelerSupportModel } from '@/modules/support/modeler-resources'
import { getBlastModel, blastViewOffset } from '@/views/tunnel-module/blast'
import { THREE_BENCH_ID, getActiveThreeBenchModel } from '@/modules/rock/three-bench-resource'
import { getTestSectionSupportModels } from '@/modules/support/test-section-resource'
import {getFlowBoundingSphere} from '@/views/ventilation-module/cesiumVentilation'
export const taskViews = ['overview', 'face', 'support', 'excavation', 'drill', 'blast'] as const
export type TaskView = typeof taskViews[number]
export function availableTaskCameraViews(ids:readonly string[]):TaskView[]{
 return ['overview',...(ids.includes('rock.face-photos')?['face' as const]:[]),...(ids.some(id=>id.startsWith('support.modeler-')||id==='support.test-section'||id.startsWith('support.test-section-'))?['support' as const]:[]),...(ids.includes(THREE_BENCH_ID)?['excavation' as const]:[]),...(ids.includes('rock.advance-drill')?['drill' as const]:[]),...(ids.includes('blast.effect')?['blast' as const]:[])]
}
const selection = ref<TaskView | 'auto'>('auto')
export const taskCameraSelection = readonly(selection)
export function resetTaskCameraSelection() { selection.value = 'auto' }
export function focusTaskCamera(viewer: C.Viewer, ids: readonly string[], chainage: number, view: TaskView): void {
  const station = chainageService.positionWithHeadingAt(chainage)
  if (!station) throw new Error('当前任务里程不在中线范围内')
  const spheres: C.BoundingSphere[] = []
  const face = ids.includes('rock.face-photos') ? getActiveFaceSlices()[0] : undefined
  const drills = ids.includes('rock.advance-drill') ? getActiveDrillModels().filter(model => model.ready) : []
  const supports = ids.map(getActiveModelerSupportModel).filter((model): model is C.Model => !!model?.ready)
  supports.push(...getTestSectionSupportModels(ids).filter(model => model.ready))
  const blast = ids.includes('blast.effect') ? getBlastModel() as C.Model | undefined : undefined
  const faceSphere = faceSliceSphere(face)
  if (view === 'face' && faceSphere) spheres.push(faceSphere)
  if (view === 'support') spheres.push(...supports.map(model => model.boundingSphere))
  if (view === 'drill') spheres.push(...drills.map(model => model.boundingSphere))
  if (view === 'blast' && blast?.ready) spheres.push(blast.boundingSphere)
  if(view==='excavation'){
    const solid=ids.includes(THREE_BENCH_ID)?getActiveThreeBenchModel():undefined
    if(solid?.ready)spheres.push(solid.boundingSphere)
  }
  if (view === 'overview') {
    const solid = ids.includes(THREE_BENCH_ID) ? getActiveThreeBenchModel() : undefined
    if (solid?.ready) spheres.push(solid.boundingSphere)
    const testSupports = getTestSectionSupportModels(ids)
    spheres.push(...testSupports.filter(model => model.ready).map(model => model.boundingSphere))
    if (faceSphere) spheres.push(faceSphere)
    spheres.push(...supports.map(model => model.boundingSphere), ...drills.map(model => model.boundingSphere))
    if (blast?.ready) spheres.push(blast.boundingSphere)
    const flow=ids.some(id=>id==='ventilation.steady-cfd'||/^ventilation\.thermal-t\d+s$/.test(id))?getFlowBoundingSphere():undefined
    if(flow)spheres.push(flow)
    const offsets = flow?[]:ids.includes('ventilation.steady-cfd') ? [-100, 100] : ids.some(id => /^rock\.(tsp-|tem-|geophysical-grade)/.test(id)) ? [0, 100] : [0]
    for (const offset of offsets) {
      const point = chainageService.positionWithHeadingAt(chainage + offset)
      if (point) spheres.push(new C.BoundingSphere(C.Cartesian3.fromDegrees(point.longitude, point.latitude, point.height + 3), offset ? 25 : 6))
    }
  }
  if (!spheres.length) throw new Error('当前任务没有可聚焦的该类模型；未修改视角')
  const sphere = C.BoundingSphere.fromBoundingSpheres(spheres)
  const offset = view === 'blast' ? blastViewOffset('persp') : new C.HeadingPitchRange(
    station.heading + (view === 'face' || view === 'drill' ? Math.PI - 0.3 : view==='excavation'?-.65:0.85), view==='excavation'?-.45:-0.3,
    Math.max(view === 'overview' ? 65 : view === 'face' ? 24 : 42, sphere.radius * 3))
  viewer.camera.cancelFlight()
  viewer.camera.viewBoundingSphere(sphere, offset)
  viewer.camera.lookAtTransform(C.Matrix4.IDENTITY)
  if (viewer.container.closest('.dashboard-container')) viewer.camera.moveRight(offset.range * 0.04)
  viewer.scene.requestRender()
  selection.value = view
}
