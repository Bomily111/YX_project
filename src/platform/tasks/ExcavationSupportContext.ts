import * as C from 'cesium'
import { chainageService } from '@/platform/coordinates/ChainageService'
import { getTestSectionSupportSummaries } from '@/modules/support/test-section-resource'
import { taskCameraSelection } from './TaskCameraView'
import { getJetFanPlacement, JET_FAN_ID } from '@/modules/ventilation/axial-fan-resource'

/** Read-only spatial annotations for the excavation/initial-support handover. */
export function installExcavationSupportContext(viewer: C.Viewer, ids: readonly string[], chainage: number, excavation: C.Model) {
  const support = getTestSectionSupportSummaries(ids)[0]
  const anchor = chainageService.worldPositionAt(chainage)
  if (!support || !anchor) return () => {}
  const { scene, entities } = viewer
  const globe = scene.globe
  const background = C.Color.clone(scene.backgroundColor)
  const underground = globe?.undergroundColor && C.Color.clone(globe.undergroundColor)
  const undergroundBlend = globe?.undergroundColorAlphaByDistance && C.NearFarScalar.clone(globe.undergroundColorAlphaByDistance)
  const neutral = C.Color.fromCssColorString('#182a39')
  const localBlend = new C.NearFarScalar(0, 1, 400, 1)
  const teal = C.Color.fromCssColorString('#81e6ea')
  const amber = C.Color.fromCssColorString('#ffc680')
  const annotations: C.Entity[] = []
  // The original bench coordinates are lateral, up and negative advance.
  const position = (offset: number, height: number, lateral = 0) => C.Matrix4.multiplyByPoint(
    excavation.modelMatrix, new C.Cartesian3(lateral, height, -offset), new C.Cartesian3(),
  )
  const line = (points: C.Cartesian3[], color: C.Color, width: number, arrow = false) => {
    annotations.push(entities.add({ polyline: {
      positions: points, width, arcType: C.ArcType.NONE,
      material: arrow ? new C.PolylineArrowMaterialProperty(color) : color,
    } }))
  }
  const label = (point: C.Cartesian3, text: string, color: C.Color) => {
    annotations.push(entities.add({ position: point, label: {
      text, font: '600 14px "Microsoft YaHei", sans-serif', fillColor: color,
      horizontalOrigin: C.HorizontalOrigin.CENTER, verticalOrigin: C.VerticalOrigin.BOTTOM,
      showBackground: true, backgroundColor: C.Color.fromCssColorString('#142734').withAlpha(.94),
      backgroundPadding: new C.Cartesian2(9, 6), disableDepthTestDistance: Number.POSITIVE_INFINITY,
    } }))
  }
  try {
    const start = support.unitOffsetsM[0] - .5
    const end = support.unitOffsetsM.at(-1) + .5
    const supportMid = (start + end) / 2

    const rulerLateral = -6.5
    line([position(start, -3.6, rulerLateral), position(end, -3.6, rulerLateral)], amber, 4)
    for (const offset of [start, end]) line([position(offset, -4, rulerLateral), position(offset, -3.2, rulerLateral)], amber, 2)
    line([position(1, -3.6, rulerLateral), position(18, -3.6, rulerLateral)], teal, 7, true)
    line([position(supportMid, 9), position(supportMid, 6.7)], amber, 1.5)
    line([position(15, 8.8), position(15, 5.7)], teal, 1.5)
    label(position(supportMid, 9), `后方初支  ${support.supportType} · ${support.lengthM} m`, amber)
    label(position(15, 8.8), '前方  三台阶开挖', teal)
    const jet = ids.includes(JET_FAN_ID) ? getJetFanPlacement() : undefined
    if (jet) {
      label(position(jet.chainage-chainage,9.4),'后方  洞顶射流风机',teal)
      line([position(jet.chainage-chainage,9.4),position(jet.chainage-chainage,7)],teal,1.5)
    }

    let previousMode: 'detail' | 'overview' | 'geographic' | undefined
    const update = () => {
      const close = C.Cartesian3.distance(viewer.camera.positionWC, anchor) < 155
      const mode = !close ? 'geographic' : taskCameraSelection.value === 'support' ? 'detail' : 'overview'
      if (mode === previousMode) return
      previousMode = mode
      annotations.forEach(entity => { entity.show = mode === 'overview' })
      scene.backgroundColor = close ? neutral : background
      if (globe) {
        globe.undergroundColor = close ? neutral : underground!
        globe.undergroundColorAlphaByDistance = close ? localBlend : undergroundBlend!
      }
      scene.requestRender()
    }
    update()
    const stop = scene.preUpdate.addEventListener(update)
    return () => {
      stop()
      annotations.forEach(entity => entities.remove(entity))
      scene.backgroundColor = background
      if (globe) {
        globe.undergroundColor = underground!
        globe.undergroundColorAlphaByDistance = undergroundBlend!
      }
    }
  } catch (error) {
    annotations.forEach(entity => entities.remove(entity))
    scene.backgroundColor = background
    if (globe) {
      globe.undergroundColor = underground!
      globe.undergroundColorAlphaByDistance = undergroundBlend!
    }
    throw error
  }
}
