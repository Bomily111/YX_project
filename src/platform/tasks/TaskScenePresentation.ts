import {clearTaskVisualReview} from './TaskVisualReview'
import * as C from 'cesium'
import { getActiveFaceSlices, isFacePhotoResource } from '@/modules/face-sketch/resources'
import { faceSliceSphere } from '@/modules/face-sketch/task-face-section'
import { getActiveDrillModels } from '@/modules/rock/drill-resource'
import { getActiveModelerSupportModels } from '@/modules/support/modeler-resources'
import { getBlastModel, blastViewOffset, blastLayerVisibility, setBlastLayerVisible } from '@/views/tunnel-module/blast'
import { getDesignRockGradeSegments, getTunnelGlbSegment } from '@/utils/Common/DrawLine'
import { chainageService } from '@/platform/coordinates/ChainageService'
import { applyTaskVolumeCut,getTaskVolumeDomain } from './TaskVolumeCut'
import {installTaskVolumeDomain} from './TaskVolumeDomain'
import {applyTaskChartLayout} from './TaskChartLayout'
import { isThreeBenchResourceId, getActiveThreeBenchModel } from '@/modules/rock/three-bench-resource'
import { isTestSupportId, getTestSectionSupportModels } from '@/modules/support/test-section-resource'
import {getFlowBoundingSphere} from '@/views/ventilation-module/cesiumVentilation'
import {installTaskFlowReview,flowReviewInitialMode} from './TaskFlowReview'
import {fitTaskCameraToViewport,clearTaskViewportTarget} from './TaskViewport'
import { installExcavationSupportContext } from './ExcavationSupportContext'
import { clearTaskTunnelSection, showTaskTunnelSection } from './TaskTunnelSection'
import { tunnelSectionIntent } from './TunnelSectionIntent'
import { alignJetFanToRenderedCrown, getActiveJetFan, JET_FAN_ID } from '@/modules/ventilation/axial-fan-resource'
import { focusAxialFanCamera, isFanViewResource } from './TaskCameraView'
import { isNativeRockModel, nativeRockModels, isWorkfaceResource, WORKFACE_BACKING_ID } from '@/modules/rock/native-model-resources'

/** Final presentation transaction. All resources must already be assembled. */
export const taskPresentationProfile = (ids: readonly string[],goal='') => ({
  theme: 'task-focus',
  focusFan: ids.some(isFanViewResource) && !ids.includes('blast.effect') && !ids.some(isThreeBenchResourceId) && !/全段|完整风场|风场全景/.test(goal) ? true : undefined,
  tunnelSideSection: ids.some(isThreeBenchResourceId) && ids.some(isTestSupportId) && tunnelSectionIntent(goal) === 'open' ? true : undefined,
  reviewStrategy:ids.includes('blast.effect')&&ids.includes('ventilation.steady-cfd')?'blast-airflow-local-review':undefined,
  reviewInitialMode:ids.includes('blast.effect')&&ids.includes('ventilation.steady-cfd')?flowReviewInitialMode(goal):undefined,
  volumeCut: ids.some(id => id === 'rock.tsp-hardness' || id === 'rock.tsp-integrity') && ids.some(id => id.startsWith('support.')) ? { xmax: 0.5, ymin: 0.2 } : undefined,
  view: ids.some(id => !isNativeRockModel(id) && /^rock\.(tsp-|tem-|geophysical-grade)/.test(id)) ? 'geophysical-context' : ids.some(id=>id==='ventilation.steady-cfd'||/^ventilation\.thermal-t\d+s$/.test(id)) ? 'airflow-context' : 'component-detail',
  tunnelOpacity: ids.some(isThreeBenchResourceId) || ids.some(isTestSupportId) ? 0.035 : ids.includes('support.modeler-z-pm') || ids.some(isFacePhotoResource) || ids.some(isNativeRockModel) || ids.some(id => id.startsWith('support.modeler-continuous-')) ? 0.06 : ids.includes('rock.advance-drill') || ids.includes('blast.effect') ||
    (ids.some(id => id === 'rock.tsp-hardness' || id === 'rock.tsp-integrity') && ids.some(id => id.startsWith('support.'))) ? 0.12 : ids.some(id=>/^rock\.(tsp-|tem-|geophysical-grade)/.test(id)) ? 0.08 : undefined,
})
export function presentTaskScene(viewer: C.Viewer, ids: readonly string[], chainage: number,goal=''): () => void {
  clearTaskVisualReview()
  clearTaskViewportTarget(viewer)
  const station = chainageService.positionWithHeadingAt(chainage)
  if (!station) throw new Error('最终场景目标不在YK中线内')
  const previous = { position: C.Cartesian3.clone(viewer.camera.positionWC), direction: C.Cartesian3.clone(viewer.camera.directionWC), up: C.Cartesian3.clone(viewer.camera.upWC) }
  const undo: Array<() => void> = []
  const restore = () => {
    clearTaskVisualReview()
    clearTaskViewportTarget(viewer)
    if (viewer.isDestroyed()) return
    clearTaskTunnelSection(viewer)
    for (const action of undo.reverse()) action()
    viewer.camera.setView({ destination: previous.position, orientation: { direction: previous.direction, up: previous.up } })
    viewer.scene.requestRender()
  }
  try {
    const profile = taskPresentationProfile(ids,goal)
    const gradedBlast = ids.includes('rock.design-grade') && ids.includes('blast.effect') &&
      (ids.includes('ventilation.steady-cfd') || ids.includes('ventilation.co-analysis'))
    if (gradedBlast) {
      const before = blastLayerVisibility.holes
      if (/只看爆后点云|隐藏炮孔|不用炮孔|不显示炮孔/.test(goal)) {
        setBlastLayerVisible('holes', false)
        undo.push(()=>setBlastLayerVisible('holes',before))
      }
      const grade = getDesignRockGradeSegments().find(segment => {
        const start=chainageService.tryParse(segment.startMileage), end=chainageService.tryParse(segment.endMileage)
        return start!==undefined && end!==undefined && start<=chainage && end>=chainage
      })
      if (grade) {
        const label=viewer.entities.add({position:C.Cartesian3.fromDegrees(station.longitude,station.latitude,station.height+10),
          properties:{taskBlastDesignGrade:true},
          label:{text:`设计围岩 ${grade.grade} · ${grade.startMileage}—${grade.endMileage}`,font:'600 14px Microsoft YaHei',
            showBackground:true,backgroundColor:C.Color.fromCssColorString('#142734'),disableDepthTestDistance:Number.POSITIVE_INFINITY}})
        undo.push(()=>viewer.entities.remove(label))
      }
    }
    undo.push(applyTaskChartLayout(viewer,ids))
    // Keep the main viewer terrain, imagery brightness and saturation unchanged.
    if (profile.volumeCut) undo.push(applyTaskVolumeCut())
    // Task assembly uses the current platform viewer/environment. Only model
    // emphasis and camera framing belong to this transaction.
    const drills = ids.includes('rock.advance-drill') ? getActiveDrillModels() : []
    const face = ids.some(isFacePhotoResource) ? getActiveFaceSlices()[0] : undefined
    const blast = ids.includes('blast.effect') ? getBlastModel() as C.Model | undefined : undefined
    if (profile.tunnelOpacity !== undefined) {
      for (let index = 0; index < 17; index++) {
        const tunnel = getTunnelGlbSegment(index)
        if (!tunnel) continue
        const color = C.Color.clone(tunnel.color), mode = tunnel.colorBlendMode, amount = tunnel.colorBlendAmount
        undo.push(() => { tunnel.color = color; tunnel.colorBlendMode = mode; tunnel.colorBlendAmount = amount })
        tunnel.color = (gradedBlast && color ? color : C.Color.WHITE).withAlpha(profile.tunnelOpacity!)
        tunnel.colorBlendMode = C.ColorBlendMode.MIX
        tunnel.colorBlendAmount = 0.1
      }
    }
    const spheres: C.BoundingSphere[] = drills.map(model => model.boundingSphere)
    spheres.push(...nativeRockModels(ids).filter(model => model.ready).map(model => model.boundingSphere))
    const workfaceSurface = nativeRockModels(ids.filter(isWorkfaceResource))[0]
    const excavation = ids.some(isThreeBenchResourceId) ? getActiveThreeBenchModel() : undefined
    if (excavation?.ready) spheres.push(excavation.boundingSphere)
    const testSupports = getTestSectionSupportModels(ids)
    spheres.push(...testSupports.filter(model => model.ready).map(model => model.boundingSphere))
    const faceSphere=faceSliceSphere(face)
    if(faceSphere)spheres.push(faceSphere)
    spheres.push(...getActiveModelerSupportModels(ids).filter(model => model.ready).map(model => model.boundingSphere))
    const geophysical = profile.view === 'geophysical-context'
    const volumeDomain=geophysical?getTaskVolumeDomain():undefined
    if(volumeDomain){spheres.push(volumeDomain.sphere);undo.push(installTaskVolumeDomain(viewer))}
    const airflow = profile.view==='airflow-context'
    const flowSphere=airflow?getFlowBoundingSphere():undefined
    if(flowSphere)spheres.push(flowSphere)
    if(airflow&&blast?.ready)spheres.push(blast.boundingSphere)
    const supportRange = spheres.length ? Math.max(42, C.BoundingSphere.fromBoundingSpheres(spheres).radius * 3) : 42
    const chartBesideFace=!!face&&ids.some(id=>id.startsWith('rock.gpr-'))
    const faceRange=chartBesideFace?Math.max(30,(faceSphere?.radius??6)*4):Math.max(24,(faceSphere?.radius??6)*3)
    const range = geophysical ? 160 : airflow ? 170 : drills.length ? 65 : face ? faceRange : blast ? 22 : spheres.length ? supportRange : 220
    if (ids.includes(JET_FAN_ID)) alignJetFanToRenderedCrown(viewer)
    const jet = ids.includes(JET_FAN_ID) ? getActiveJetFan() : undefined
    if (jet?.ready) spheres.push(jet.boundingSphere)
    if (profile.focusFan) {
      focusAxialFanCamera(viewer, ids.includes(JET_FAN_ID))
      return restore
    }
    if (excavation?.ready || testSupports.some(model => model.ready)) {
      const combined = C.BoundingSphere.fromBoundingSpheres(spheres)
      const handover = excavation?.ready && testSupports.length > 0
      viewer.camera.viewBoundingSphere(combined, new C.HeadingPitchRange(station.heading + (handover ? 1.03 : -.65), handover ? -.30 : -.45, Math.max(48, combined.radius * 3)))
      viewer.camera.lookAtTransform(C.Matrix4.IDENTITY)
      if(viewer.container.closest('.dashboard-container')) viewer.camera.moveRight(combined.radius * .35)
      fitTaskCameraToViewport(viewer,combined)
      if (handover) undo.push(installExcavationSupportContext(viewer, ids, chainage, excavation))
      if (profile.tunnelSideSection) showTaskTunnelSection(viewer, ids, chainage)
      viewer.scene.requestRender()
      return restore
    }
    if(geophysical&&volumeDomain){
      const combined=C.BoundingSphere.fromBoundingSpheres(spheres)
      viewer.camera.viewBoundingSphere(combined,new C.HeadingPitchRange(station.heading+.85,-.45,Math.max(65,combined.radius*3.2)))
    }
    else if(airflow&&flowSphere){
      const combined=C.BoundingSphere.fromBoundingSpheres(spheres)
      viewer.camera.viewBoundingSphere(combined,new C.HeadingPitchRange(station.heading+.85,-.45,Math.max(65,combined.radius*3.5)))
    }
    else if (geophysical || airflow) {
      // The interpreted volume extends ahead of the task section; a support
      // detail camera would otherwise sit inside it and hide the assembly.
      const center = geophysical ? chainageService.positionWithHeadingAt(chainage + 50) ?? station : station
      viewer.camera.lookAt(C.Cartesian3.fromDegrees(center.longitude, center.latitude, center.height + 3),
        new C.HeadingPitchRange(station.heading + 0.85, -0.45, range))
    }
    else if (drills.length) viewer.camera.viewBoundingSphere(C.BoundingSphere.fromBoundingSpheres(spheres), new C.HeadingPitchRange(station.heading + Math.PI - 0.7, -0.3, 65))
    else if (workfaceSurface?.ready) {
      const combined = C.BoundingSphere.fromBoundingSpheres(spheres)
      viewer.camera.viewBoundingSphere(combined, new C.HeadingPitchRange(station.heading + (ids.includes(WORKFACE_BACKING_ID) ? .98 : .45), -.28, Math.max(21, combined.radius * 3.2)))
      const { scene } = viewer
      const globe = scene.globe
      if (globe) {
        const originalColor = C.Color.clone(globe.undergroundColor)
        const originalBlend = C.NearFarScalar.clone(globe.undergroundColorAlphaByDistance)
        const neutral = C.Color.fromCssColorString('#233540')
        const fullBlend = new C.NearFarScalar(0, 1, 400, 1)
        let near: boolean | undefined
        const update = () => {
          const next = C.Cartesian3.distance(viewer.camera.positionWC, combined.center) < 150
          if (near === next) return
          near = next
          globe.undergroundColor = near ? neutral : originalColor
          globe.undergroundColorAlphaByDistance = near ? fullBlend : originalBlend
          scene.requestRender()
        }
        update()
        const stop = scene.preUpdate.addEventListener(update)
        undo.push(() => {
          stop()
          globe.undergroundColor = originalColor
          globe.undergroundColorAlphaByDistance = originalBlend
        })
      }
    }
    else if (faceSphere) viewer.camera.viewBoundingSphere(faceSphere, new C.HeadingPitchRange(station.heading + Math.PI, -0.1, faceRange))
    else if (blast?.ready) viewer.camera.viewBoundingSphere(blast.boundingSphere, blastViewOffset('persp'))
    else if (spheres.length) viewer.camera.viewBoundingSphere(C.BoundingSphere.fromBoundingSpheres(spheres), new C.HeadingPitchRange(station.heading + (ids.some(id => id.startsWith('support.modeler-continuous-')) ? 1.1 : 0.4), -0.28, supportRange))
    else viewer.camera.lookAt(C.Cartesian3.fromDegrees(station.longitude, station.latitude, station.height + 3), new C.HeadingPitchRange(station.heading + 0.4, -0.55, ids.includes('ventilation.steady-cfd') ? 220 : 160))
    viewer.camera.lookAtTransform(C.Matrix4.IDENTITY)
    if (viewer.container.closest('.dashboard-container')) {
      // Reserve the chat rail. With a large 2D chart on the left, leave the
      // photo near the center of the remaining 3D area rather than panning out.
      viewer.camera.moveRight((flowSphere?flowSphere.radius*3.5:range) * (chartBesideFace ? 0 : airflow ? .04 : 0.2))
    }
    if(ids.includes('ventilation.steady-cfd')&&blast?.ready)undo.push(installTaskFlowReview(viewer,blast.boundingSphere,station.heading,profile.reviewInitialMode,jet?.ready?jet.boundingSphere:undefined))
    else if(spheres.length&&(!geophysical||volumeDomain))fitTaskCameraToViewport(viewer,C.BoundingSphere.fromBoundingSpheres(spheres))
    viewer.scene.requestRender()
    return restore
  } catch (error) { restore(); throw error }
}
