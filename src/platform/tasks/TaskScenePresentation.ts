import * as C from 'cesium'
import { getActiveFaceSlices } from '@/modules/face-sketch/resources'
import { faceSliceSphere } from '@/modules/face-sketch/task-face-section'
import { getActiveDrillModels } from '@/modules/rock/drill-resource'
import { getActiveModelerSupportModel } from '@/modules/support/modeler-resources'
import { getBlastModel, blastViewOffset } from '@/views/tunnel-module/blast'
import { getTunnelGlbSegment } from '@/utils/Common/DrawLine'
import { chainageService } from '@/platform/coordinates/ChainageService'
import { applyTaskVolumeCut } from './TaskVolumeCut'
import { THREE_BENCH_ID, getActiveThreeBenchModel } from '@/modules/rock/three-bench-resource'
import { isTestSupportId, getTestSectionSupportModels } from '@/modules/support/test-section-resource'
import {applyTaskTerrainContext} from './TaskTerrainContext'
import {getFlowBoundingSphere} from '@/views/ventilation-module/cesiumVentilation'
import {installTaskFlowReview,flowReviewInitialMode} from './TaskFlowReview'

/** Final presentation transaction. All resources must already be assembled. */
export const taskPresentationProfile = (ids: readonly string[],goal='') => ({
  theme: 'task-focus',
  reviewStrategy:ids.includes('blast.effect')&&ids.includes('ventilation.steady-cfd')?'blast-airflow-local-review':undefined,
  reviewInitialMode:ids.includes('blast.effect')&&ids.includes('ventilation.steady-cfd')?flowReviewInitialMode(goal):undefined,
  volumeCut: ids.some(id => id === 'rock.tsp-hardness' || id === 'rock.tsp-integrity') && ids.some(id => id.startsWith('support.')) ? { xmax: 0.5, ymin: 0.2 } : undefined,
  view: ids.some(id => /^rock\.(tsp-|tem-|geophysical-grade)/.test(id)) ? 'geophysical-context' : ids.some(id=>id==='ventilation.steady-cfd'||/^ventilation\.thermal-t\d+s$/.test(id)) ? 'airflow-context' : 'component-detail',
  tunnelOpacity: ids.includes(THREE_BENCH_ID) || ids.some(isTestSupportId) ? 0.035 : ids.includes('support.modeler-z-pm') || ids.includes('rock.face-photos') || ids.some(id => id.startsWith('support.modeler-continuous-')) ? 0.06 : ids.includes('rock.advance-drill') || ids.includes('blast.effect') ||
    (ids.some(id => id === 'rock.tsp-hardness' || id === 'rock.tsp-integrity') && ids.some(id => id.startsWith('support.'))) ? 0.12 : undefined,
})
export function presentTaskScene(viewer: C.Viewer, ids: readonly string[], chainage: number,goal=''): () => void {
  const station = chainageService.positionWithHeadingAt(chainage)
  if (!station) throw new Error('最终场景目标不在YK中线内')
  const previous = { position: C.Cartesian3.clone(viewer.camera.positionWC), direction: C.Cartesian3.clone(viewer.camera.directionWC), up: C.Cartesian3.clone(viewer.camera.upWC) }
  const undo: Array<() => void> = []
  const restore = () => {
    if (viewer.isDestroyed()) return
    for (const action of undo.reverse()) action()
    viewer.camera.setView({ destination: previous.position, orientation: { direction: previous.direction, up: previous.up } })
    viewer.scene.requestRender()
  }
  try {
    const profile = taskPresentationProfile(ids,goal)
    undo.push(applyTaskTerrainContext(viewer,chainage))
    // Retain geographic context in the shared viewer, with reversible imagery
    // attenuation. Do not replace terrain, semantic model colors or the sky.
    const imagery = viewer.imageryLayers
    if(imagery) for(let i=0;i<imagery.length;i++) {
      const layer=imagery.get(i), brightness=layer.brightness, saturation=layer.saturation
      undo.push(()=>{layer.brightness=brightness;layer.saturation=saturation})
      layer.brightness=brightness*.22;layer.saturation=saturation*.18
    }
    if (profile.volumeCut) undo.push(applyTaskVolumeCut())
    // Task assembly uses the current platform viewer/environment. Only model
    // emphasis and camera framing belong to this transaction.
    const drills = ids.includes('rock.advance-drill') ? getActiveDrillModels() : []
    const face = ids.includes('rock.face-photos') ? getActiveFaceSlices()[0] : undefined
    const blast = ids.includes('blast.effect') ? getBlastModel() as C.Model | undefined : undefined
    if (profile.tunnelOpacity !== undefined) {
      for (let index = 0; index < 17; index++) {
        const tunnel = getTunnelGlbSegment(index)
        if (!tunnel) continue
        const color = C.Color.clone(tunnel.color), mode = tunnel.colorBlendMode, amount = tunnel.colorBlendAmount
        undo.push(() => { tunnel.color = color; tunnel.colorBlendMode = mode; tunnel.colorBlendAmount = amount })
        tunnel.color = C.Color.WHITE.withAlpha(profile.tunnelOpacity!)
        tunnel.colorBlendMode = C.ColorBlendMode.MIX
        tunnel.colorBlendAmount = 0.1
      }
    }
    const spheres: C.BoundingSphere[] = drills.map(model => model.boundingSphere)
    const excavation = ids.includes(THREE_BENCH_ID) ? getActiveThreeBenchModel() : undefined
    if (excavation?.ready) spheres.push(excavation.boundingSphere)
    const testSupports = getTestSectionSupportModels(ids)
    spheres.push(...testSupports.filter(model => model.ready).map(model => model.boundingSphere))
    const faceSphere=faceSliceSphere(face)
    if(faceSphere)spheres.push(faceSphere)
    for (const id of ids) {
      const support = getActiveModelerSupportModel(id)
      if (support?.ready) spheres.push(support.boundingSphere)
    }
    const geophysical = profile.view === 'geophysical-context'
    const airflow = profile.view==='airflow-context'
    const flowSphere=airflow?getFlowBoundingSphere():undefined
    if(flowSphere)spheres.push(flowSphere)
    if(airflow&&blast?.ready)spheres.push(blast.boundingSphere)
    const supportRange = spheres.length ? Math.max(42, C.BoundingSphere.fromBoundingSpheres(spheres).radius * 3) : 42
    const chartBesideFace=!!face&&ids.some(id=>id.startsWith('rock.gpr-'))
    const faceRange=chartBesideFace?Math.max(30,(faceSphere?.radius??6)*4):Math.max(24,(faceSphere?.radius??6)*3)
    const range = geophysical ? 160 : airflow ? 170 : drills.length ? 65 : face ? faceRange : blast ? 22 : spheres.length ? supportRange : 220
    if (excavation?.ready || testSupports.some(model => model.ready)) {
      const combined = C.BoundingSphere.fromBoundingSpheres(spheres)
      viewer.camera.viewBoundingSphere(combined, new C.HeadingPitchRange(station.heading - .65, -.45, Math.max(48, combined.radius * 3)))
      viewer.camera.lookAtTransform(C.Matrix4.IDENTITY)
      if(viewer.container.closest('.dashboard-container')) viewer.camera.moveRight(combined.radius * .35)
      viewer.scene.requestRender()
      return restore
    }
    if(airflow&&flowSphere){
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
    if(ids.includes('ventilation.steady-cfd')&&blast?.ready)undo.push(installTaskFlowReview(viewer,blast.boundingSphere,station.heading,profile.reviewInitialMode))
    viewer.scene.requestRender()
    return restore
  } catch (error) { restore(); throw error }
}
