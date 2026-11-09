import * as C from 'cesium'
import { getActiveFaceSlices } from '@/modules/face-sketch/resources'
import { getActiveDrillModels } from '@/modules/rock/drill-resource'
import { getActiveModelerSupportModel } from '@/modules/support/modeler-resources'
import { getBlastModel, blastViewOffset } from '@/views/tunnel-module/blast'
import { getTunnelGlbSegment } from '@/utils/Common/DrawLine'
import { chainageService } from '@/platform/coordinates/ChainageService'
import { applyTaskVolumeCut } from './TaskVolumeCut'

/** Final presentation transaction. All resources must already be assembled. */
export const taskPresentationProfile = (ids: readonly string[]) => ({
  theme: 'task-focus',
  volumeCut: ids.some(id => id === 'rock.tsp-hardness' || id === 'rock.tsp-integrity') && ids.some(id => id.startsWith('support.')) ? { xmax: 0.5, ymin: 0.2 } : undefined,
  view: ids.some(id => /^rock\.(tsp-|tem-|geophysical-grade)/.test(id)) ? 'geophysical-context' : ids.includes('ventilation.steady-cfd') ? 'airflow-context' : 'component-detail',
  tunnelOpacity: ids.includes('rock.face-photos') || ids.some(id => id.startsWith('support.modeler-continuous-')) ? 0.06 : ids.includes('rock.advance-drill') || ids.includes('blast.effect') ||
    (ids.some(id => id === 'rock.tsp-hardness' || id === 'rock.tsp-integrity') && ids.some(id => id.startsWith('support.'))) ? 0.12 : undefined,
})
export function presentTaskScene(viewer: C.Viewer, ids: readonly string[], chainage: number): () => void {
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
    const profile = taskPresentationProfile(ids)
    if (profile.volumeCut) undo.push(applyTaskVolumeCut())
    const background = C.Color.clone(viewer.scene.backgroundColor)
    undo.push(() => { viewer.scene.backgroundColor = background })
    viewer.scene.backgroundColor = C.Color.fromCssColorString('#07121e')
    for (const layer of [viewer.scene.globe, viewer.scene.skyBox, viewer.scene.skyAtmosphere, viewer.scene.sun, viewer.scene.moon]) {
      if (!layer) continue
      const visibility = layer as unknown as { show?: boolean }
      const show = visibility.show
      if (typeof show !== 'boolean') continue
      undo.push(() => { visibility.show = show })
      visibility.show = false
    }
    if (viewer.scene.fog) {
      const enabled = viewer.scene.fog.enabled
      undo.push(() => { viewer.scene.fog.enabled = enabled })
      viewer.scene.fog.enabled = false
    }
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
    if (face?.position) spheres.push(new C.BoundingSphere(face.position.getValue(C.JulianDate.now()), 6))
    for (const id of ids) {
      const support = getActiveModelerSupportModel(id)
      if (support?.ready) spheres.push(support.boundingSphere)
    }
    const geophysical = profile.view === 'geophysical-context'
    const airflow = ids.includes('ventilation.steady-cfd')
    const supportRange = spheres.length ? Math.max(42, C.BoundingSphere.fromBoundingSpheres(spheres).radius * 3) : 42
    const range = geophysical ? 160 : airflow ? 170 : drills.length ? 65 : face ? 24 : blast ? 22 : spheres.length ? supportRange : 220
    if (geophysical || airflow) {
      // The interpreted volume extends ahead of the task section; a support
      // detail camera would otherwise sit inside it and hide the assembly.
      const center = geophysical ? chainageService.positionWithHeadingAt(chainage + 50) ?? station : station
      viewer.camera.lookAt(C.Cartesian3.fromDegrees(center.longitude, center.latitude, center.height + 3),
        new C.HeadingPitchRange(station.heading + 0.85, -0.45, range))
    }
    else if (drills.length) viewer.camera.viewBoundingSphere(C.BoundingSphere.fromBoundingSpheres(spheres), new C.HeadingPitchRange(station.heading + Math.PI - 0.7, -0.3, 65))
    else if (face?.position) viewer.camera.viewBoundingSphere(new C.BoundingSphere(face.position.getValue(C.JulianDate.now()), 6), new C.HeadingPitchRange(station.heading + Math.PI, -0.1, 24))
    else if (blast?.ready) viewer.camera.viewBoundingSphere(blast.boundingSphere, blastViewOffset('persp'))
    else if (spheres.length) viewer.camera.viewBoundingSphere(C.BoundingSphere.fromBoundingSpheres(spheres), new C.HeadingPitchRange(station.heading + (ids.some(id => id.startsWith('support.modeler-continuous-')) ? 1.1 : 0.4), -0.28, supportRange))
    else viewer.camera.lookAt(C.Cartesian3.fromDegrees(station.longitude, station.latitude, station.height + 3), new C.HeadingPitchRange(station.heading + 0.4, -0.55, ids.includes('ventilation.steady-cfd') ? 220 : 160))
    viewer.camera.lookAtTransform(C.Matrix4.IDENTITY)
    if (viewer.container.closest('.dashboard-container')) {
      const chartBesideFace = face && ids.some(id => id.startsWith('rock.gpr-'))
      viewer.camera.moveRight(range * (chartBesideFace ? -0.09 : 0.2))
    }
    viewer.scene.requestRender()
    return restore
  } catch (error) { restore(); throw error }
}
