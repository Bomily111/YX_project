import {supportContextSphere} from './SupportContextView'
import * as C from 'cesium'
import { readonly, ref } from 'vue'
import { chainageService } from '@/platform/coordinates/ChainageService'
import { getActiveFaceSlices, isFacePhotoResource } from '@/modules/face-sketch/resources'
import { faceSliceSphere } from '@/modules/face-sketch/task-face-section'
import { getActiveDrillModels } from '@/modules/rock/drill-resource'
import { getActiveModelerSupportModels } from '@/modules/support/modeler-resources'
import { getBlastModel, blastViewOffset } from '@/views/tunnel-module/blast'
import { isThreeBenchResourceId, getActiveThreeBenchModel } from '@/modules/rock/three-bench-resource'
import { getTestSectionSupportModels,getTestSupportComponentSphere } from '@/modules/support/test-section-resource'
import {getFlowBoundingSphere} from '@/views/ventilation-module/cesiumVentilation'
import {fitTaskCameraToViewport,clearTaskViewportTarget} from './TaskViewport'
import {getTaskVolumeDomain} from './TaskVolumeCut'
import {nativeRockModels, isWorkfaceResource} from '@/modules/rock/native-model-resources'
import { AXIAL_FAN_ID, AXIAL_FAN_DUCT_ID, JET_FAN_ID, getActiveAxialFan, getActiveAxialFanDuct, getAxialFanPlacement, getActiveJetFan, getJetFanPlacement } from '@/modules/ventilation/axial-fan-resource'
export const isFanViewResource = (id: string) => id === AXIAL_FAN_ID || id === AXIAL_FAN_DUCT_ID || id === JET_FAN_ID
export const taskViews = ['overview', 'geographic', 'support-context', 'face', 'support', 'excavation', 'drill', 'blast', 'fan'] as const
export type TaskView = typeof taskViews[number]
export function availableTaskCameraViews(ids:readonly string[]):TaskView[]{
 return ['overview',...(ids.length?['geographic' as const]:[]),...(ids.some(id=>['rock.tsp-hardness','rock.tsp-integrity'].includes(id))&&ids.some(id=>id.startsWith('support.modeler-'))?['support-context' as const]:[]),...(ids.some(isFacePhotoResource)||ids.some(isWorkfaceResource)?['face' as const]:[]),...(ids.some(id=>id.startsWith('support.modeler-')||id==='support.test-section'||id.startsWith('support.test-section-'))?['support' as const]:[]),...(ids.some(isThreeBenchResourceId)?['excavation' as const]:[]),...(ids.includes('rock.advance-drill')?['drill' as const]:[]),...(ids.includes('blast.effect')?['blast' as const]:[]),...(ids.some(isFanViewResource)?['fan' as const]:[])]
}
const selection = ref<TaskView | 'auto' | 'station'>('auto')
export const taskCameraSelection = readonly(selection)
export function restoreTaskCameraSelection(value:TaskView|'auto'|'station'){selection.value=value}
export function markTaskStationCamera(viewer:C.Viewer){clearTaskViewportTarget(viewer);selection.value='station'}
export function resetTaskCameraSelection() { selection.value = 'auto' }

export type ReviewWorkfaceView = 'oblique' | 'front'

export function focusReviewWorkface(viewer: C.Viewer, ids: readonly string[], chainage: number, view: ReviewWorkfaceView) {
  const station = chainageService.positionWithHeadingAt(chainage)
  const workface = nativeRockModels(ids.filter(isWorkfaceResource))[0]
  if (!station || !workface?.ready) throw Error('掌子面岩面尚未就绪')
  const sphere = workface.boundingSphere
  const front = view === 'front'
  // This legacy texture mesh projects well beyond its reported bounding sphere.
  // Keep the measured full-outline margin at the production display scale.
  const range = Math.max(front ? 20 : 24, sphere.radius * 3.5)
  viewer.camera.cancelFlight()
  viewer.camera.viewBoundingSphere(sphere, new C.HeadingPitchRange(
    station.heading + (front ? -.05 : .54), front ? -.08 : -.23, range,
  ))
  viewer.camera.lookAtTransform(C.Matrix4.IDENTITY)
  fitTaskCameraToViewport(viewer, sphere)
  viewer.scene.requestRender()
  selection.value = 'face'
}

/** Compare replacement support units against a fixed frame on the task centerline. */
export function focusSupportComparison(viewer: C.Viewer, start: number, end: number, excavation: number, detail = false) {
  const station = chainageService.positionWithHeadingAt((start + end) / 2)
  if (!station) throw Error('支护对照区间不在中线范围内')
  const center = C.Cartesian3.fromDegrees(station.longitude, station.latitude, station.height + 3)
  const supportFrame = new C.BoundingSphere(center, Math.max(8, Math.abs(excavation - start)))
  const bench = getActiveThreeBenchModel()
  if (!bench?.ready) throw Error('三台阶参照尚未就绪')
  // The re-used source section has its own local placement inside the demonstration scene.
  // Use the common assembly frame so neither version biases the detail camera.
  const detailCenter = detail && C.Matrix4.multiplyByPoint(bench.modelMatrix,
    new C.Cartesian3(0, 2, excavation - (start + end) / 2), new C.Cartesian3())
  const sphere = detailCenter ? new C.BoundingSphere(detailCenter, supportFrame.radius)
    : C.BoundingSphere.union(supportFrame, bench.boundingSphere, new C.BoundingSphere())
  viewer.camera.cancelFlight()
  viewer.camera.viewBoundingSphere(sphere, new C.HeadingPitchRange(
    station.heading + (detail ? Math.PI / 2 : 1.20), detail ? -.12 : -.30, sphere.radius * 2.33,
  ))
  viewer.camera.lookAtTransform(C.Matrix4.IDENTITY)
  fitTaskCameraToViewport(viewer, sphere)
  viewer.scene.requestRender()
  selection.value = 'support'
}
export function focusAxialFanCamera(viewer: C.Viewer, ceiling = false) {
  if (ceiling) {
    const jet = getActiveJetFan(), placement = getJetFanPlacement()
    if (!jet?.ready || !placement) throw Error('当前洞顶射流风机尚未就绪')
    viewer.camera.cancelFlight()
    viewer.camera.viewBoundingSphere(jet.boundingSphere, new C.HeadingPitchRange(placement.heading + .60, .46, 5.8))
    viewer.camera.lookAtTransform(C.Matrix4.IDENTITY)
    fitTaskCameraToViewport(viewer, jet.boundingSphere)
    viewer.scene.requestRender()
    return
  }
  const fan = getActiveAxialFan(), placement = getAxialFanPlacement()
  if (!fan?.ready || !placement) throw Error('当前轴流风机尚未就绪')
  const duct = getActiveAxialFanDuct()
  const sphere = duct?.ready ? C.BoundingSphere.fromBoundingSpheres([fan.boundingSphere, duct.boundingSphere]) : C.BoundingSphere.clone(fan.boundingSphere)
  if (!duct?.ready) sphere.radius += .65 // Include the outlet marker beyond the casing.
  viewer.camera.cancelFlight()
  // The camera stays on the aisle side when the fan is turned around.
  const offset = duct?.ready ? .48 : .67
  const heading = placement.heading + (placement.descending ? offset : -offset)
  viewer.camera.viewBoundingSphere(sphere, new C.HeadingPitchRange(heading, -.29, Math.max(5.2, sphere.radius * 2.6)))
  viewer.camera.lookAtTransform(C.Matrix4.IDENTITY)
  fitTaskCameraToViewport(viewer, sphere)
  viewer.scene.requestRender()
}
export function focusTaskCamera(viewer: C.Viewer, ids: readonly string[], chainage: number, view: TaskView,componentFocus?:{resourceId:string;component:string}): void {
  const station = chainageService.positionWithHeadingAt(chainage)
  if (!station) throw new Error('当前任务里程不在中线范围内')
  if (view === 'fan') {
    if (!ids.some(isFanViewResource)) throw Error('当前任务未装配风机')
    focusAxialFanCamera(viewer, ids.includes(JET_FAN_ID))
    selection.value = view
    return
  }
  if(view==='geographic'){
    viewer.camera.cancelFlight();viewer.camera.lookAt(chainageService.worldPositionAt(chainage)!,new C.HeadingPitchRange(station.heading,-.85,2200));viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);clearTaskViewportTarget(viewer);selection.value=view;viewer.scene.requestRender();return
  }
  const spheres: C.BoundingSphere[] = []
  let componentSphere:C.BoundingSphere|undefined
  const face = ids.some(isFacePhotoResource) ? getActiveFaceSlices()[0] : undefined
  const drills = ids.includes('rock.advance-drill') ? getActiveDrillModels().filter(model => model.ready) : []
  const supports = getActiveModelerSupportModels(ids).filter((model): model is C.Model => !!model?.ready)
  supports.push(...getTestSectionSupportModels(ids).filter(model => model.ready))
  const blast = ids.includes('blast.effect') ? getBlastModel() as C.Model | undefined : undefined
  const faceSphere = faceSliceSphere(face)
  const workfaceSurface = nativeRockModels(ids.filter(isWorkfaceResource))[0]
  if (view === 'face' && faceSphere) spheres.push(faceSphere)
  if (view === 'face' && workfaceSurface?.ready) spheres.push(workfaceSurface.boundingSphere)
  if(view==='support-context'){
    const domain=getTaskVolumeDomain()
    if(!availableTaskCameraViews(ids).includes('support-context')||!domain||!supports.length)throw Error('当前没有可用的围岩与支护参照；未修改视角')
    spheres.push(supportContextSphere(C.BoundingSphere.fromBoundingSpheres(supports.map(model=>model.boundingSphere)),domain.corners))
  }
  if (view === 'support') {
    componentSphere=componentFocus&&ids.includes(componentFocus.resourceId)?getTestSupportComponentSphere(componentFocus.resourceId,componentFocus.component):undefined
    if(componentSphere)spheres.push(componentSphere)
    else spheres.push(...supports.map(model => model.boundingSphere))
  }
  if (view === 'drill') spheres.push(...drills.map(model => model.boundingSphere))
  if (view === 'blast' && blast?.ready) spheres.push(blast.boundingSphere)
  if(view==='excavation'){
    const solid=ids.some(isThreeBenchResourceId)?getActiveThreeBenchModel():undefined
    if(solid?.ready)spheres.push(solid.boundingSphere)
  }
  if (view === 'overview') {
    const jet = ids.includes(JET_FAN_ID) ? getActiveJetFan() : undefined
    if (jet?.ready) spheres.push(jet.boundingSphere)
    const fan = ids.some(id=>id===AXIAL_FAN_ID||id===AXIAL_FAN_DUCT_ID) ? getActiveAxialFan() : undefined
    if (fan?.ready) spheres.push(fan.boundingSphere)
    const duct = ids.includes(AXIAL_FAN_DUCT_ID) ? getActiveAxialFanDuct() : undefined
    if (duct?.ready) spheres.push(duct.boundingSphere)
    spheres.push(...nativeRockModels(ids).filter(model => model.ready).map(model => model.boundingSphere))
    const volumeDomain=ids.some(id=>/^rock\.(tsp-|tem-|geophysical-grade)/.test(id))?getTaskVolumeDomain():undefined
    if(volumeDomain)spheres.push(volumeDomain.sphere)
    const solid = ids.some(isThreeBenchResourceId) ? getActiveThreeBenchModel() : undefined
    if (solid?.ready) spheres.push(solid.boundingSphere)
    const testSupports = getTestSectionSupportModels(ids)
    spheres.push(...testSupports.filter(model => model.ready).map(model => model.boundingSphere))
    if (faceSphere) spheres.push(faceSphere)
    spheres.push(...supports.map(model => model.boundingSphere), ...drills.map(model => model.boundingSphere))
    if (blast?.ready) spheres.push(blast.boundingSphere)
    const flow=ids.some(id=>id==='ventilation.steady-cfd'||/^ventilation\.thermal-t\d+s$/.test(id))?getFlowBoundingSphere():undefined
    if(flow)spheres.push(flow)
    const offsets = flow||volumeDomain?[]:ids.includes('ventilation.steady-cfd') ? [-100, 100] : ids.some(id => /^rock\.(tsp-|tem-|geophysical-grade)/.test(id)) ? [0, 100] : [0]
    for (const offset of offsets) {
      const point = chainageService.positionWithHeadingAt(chainage + offset)
      if (point) spheres.push(new C.BoundingSphere(C.Cartesian3.fromDegrees(point.longitude, point.latitude, point.height + 3), offset ? 25 : 6))
    }
  }
  if (!spheres.length) throw new Error('当前任务没有可聚焦的该类模型；未修改视角')
  const sphere = C.BoundingSphere.fromBoundingSpheres(spheres)
  const handover = view === 'overview' && ids.some(isThreeBenchResourceId) && ids.some(id => id.startsWith('support.test-section'))
  const offset = view === 'blast' ? blastViewOffset('persp') : new C.HeadingPitchRange(
    station.heading + (handover ? 1.03 : view==='face'&&workfaceSurface ? -.2 : view === 'face' || view === 'drill' ? Math.PI - 0.3 : view==='excavation'?-.65:0.85), view==='excavation'?-.45:view==='face'&&workfaceSurface?-.1:-0.3,
    Math.max(handover ? 52 : view === 'overview' ? 65 : view === 'face' ? workfaceSurface ? 13 : 24 : componentSphere ? 18 : 42, sphere.radius * (handover ? 2.7 : view==='face'&&workfaceSurface ? 2.1 : 3)))
  viewer.camera.cancelFlight()
  viewer.camera.viewBoundingSphere(sphere, offset)
  viewer.camera.lookAtTransform(C.Matrix4.IDENTITY)
  if (viewer.container.closest('.dashboard-container')) viewer.camera.moveRight(offset.range * 0.04)
  fitTaskCameraToViewport(viewer,sphere)
  viewer.scene.requestRender()
  selection.value = view
}
