import * as C from 'cesium'
import { getActiveJetFan } from '@/modules/ventilation/axial-fan-resource'
import { blastLayerVisibility, getBlastModel, setBlastLayerVisible } from '@/views/tunnel-module/blast'
import { chainageService } from '@/platform/coordinates/ChainageService'
import { constructionReviews, reviewStationGap, type ConstructionReviewReference, type ConstructionReviewSelection, type ReviewReferenceRole } from './ConstructionReview'
import { focusReviewWorkface, focusSupportComparison, focusTaskCamera, restoreTaskCameraSelection, taskCameraSelection } from './TaskCameraView'
import { captureTaskViewportTarget, readTaskViewport } from './TaskViewport'
import { getActiveThreeBenchModel } from '@/modules/rock/three-bench-resource'
import { nativeRockModels } from '@/modules/rock/native-model-resources'
import { captureTaskSupportNodes, getTaskSupportLayers, getTestSectionSupportModels, revealTaskSupportComponent, setTaskSupportLayer } from '@/modules/support/test-section-resource'
import { captureSupportFocusStyle, tintSupportForFocus } from './SupportFocusStyle'
import { suspendTaskVolumeDomain } from './TaskVolumeDomain'
import { getFocusedTunnelSegment, getTunnelGlbSegment } from '@/utils/Common/DrawLine'
import { createScreenSpaceEventHandler } from '@/platform/input/ScreenSpaceEventRegistry'

export function formatReviewReference(reference: ConstructionReviewReference) {
  const start = chainageService.format(reference.start)
  return reference.end === undefined ? start : `${start}–${chainageService.format(reference.end)}`
}

export function focusConstructionReview(viewer: C.Viewer, selection: ConstructionReviewSelection) {
  const { ids, view } = constructionReviews[selection.kind].steps[selection.stepIndex]!
  const anchor = selection.references[0]!.start
  const span = selection.references.find(reference => reference.end !== undefined)
  if (selection.workfaceView) focusReviewWorkface(viewer, ids, anchor, selection.workfaceView)
  else if (view === 'support' && span?.end !== undefined) focusSupportComparison(viewer, span.start, span.end, anchor, selection.supportDetailView)
  else focusTaskCamera(viewer, ids, anchor, view)
}

export function captureReviewAssemblyView(viewer: C.Viewer, ids: readonly string[]) {
  const camera = viewer.camera
  const destination = C.Cartesian3.clone(camera.positionWC)
  const orientation = { direction: C.Cartesian3.clone(camera.directionWC), up: C.Cartesian3.clone(camera.upWC) }
  const view = taskCameraSelection.value
  const restoreViewport = captureTaskViewportTarget(viewer)
  const blast = ids.includes('blast.effect') ? { ...blastLayerVisibility } : undefined
  return () => {
    if (viewer.isDestroyed()) throw Error('原场景视窗已释放')
    camera.cancelFlight()
    camera.lookAtTransform(C.Matrix4.IDENTITY)
    camera.setView({ destination, orientation })
    restoreTaskCameraSelection(view)
    restoreViewport()
    if (blast) {
      setBlastLayerVisible('holes', blast.holes)
      setBlastLayerVisible('pointcloud', blast.pointcloud)
    }
    viewer.scene.requestRender()
  }
}

function temporarilyHideSupportAnchors(ids: readonly string[]) {
  const layers = getTaskSupportLayers(ids).filter(layer => ['system_anchor', 'lock_foot_anchor'].includes(layer.component))
  const resourceId = layers[0]?.resourceId
  if (!resourceId) return
  const restore = captureTaskSupportNodes(resourceId, layers.map(layer => layer.component))
  try {
    for (const layer of layers) setTaskSupportLayer(resourceId, layer.component, false)
  } catch (error) {
    restore()
    throw error
  }
  return restore
}

export function installConstructionReviewPresentation(
  viewer: C.Viewer, selection: ConstructionReviewSelection, onReferencePick: (role: ReviewReferenceRole) => void,
) {
  const step = constructionReviews[selection.kind].steps[selection.stepIndex]!
  const comparison = step.view === 'support'
  const ids = step.ids
  const supportUnits = getTestSectionSupportModels(ids)
  const models = comparison ? supportUnits : []
  const supportId = comparison ? getTaskSupportLayers(ids)[0]?.resourceId : undefined
  let restoreComponent: (() => void) | undefined
  const showSupportComponent = (component: string | null) => {
    restoreComponent?.()
    restoreComponent = undefined
    if (!component) return
    if (!supportId) throw Error('当前初支构件未就绪')
    restoreComponent = revealTaskSupportComponent(supportId, component, true)
  }
  const restoreAnchors = selection.supportDisplay === 'outline' ? temporarilyHideSupportAnchors(ids) : undefined
  const restoreStyle = captureSupportFocusStyle(models)
  const restoreVolumeDomain = comparison ? suspendTaskVolumeDomain(viewer) : undefined
  models.forEach(tintSupportForFocus)
  const fanDetail = step.key === 'ventilation'
  const backgroundCloud = fanDetail ? getBlastModel() as C.Model | undefined : undefined
  const cloudWasVisible = backgroundCloud?.show
  if (backgroundCloud) backgroundCloud.show = false
  const gradeLabels = selection.kind === 'blast-handoff' && selection.stepIndex > 0
    ? viewer.entities.values.filter(entity => entity.properties?.taskBlastDesignGrade?.getValue())
    : []
  const visibleGradeLabels = gradeLabels.filter(entity => entity.show)
  visibleGradeLabels.forEach(entity => { entity.show = false })
  const displayedRole = step.key === 'blast' ? 'blast-cloud' : fanDetail ? 'jet-fan' : undefined
  const references = selection.references.filter(reference => !displayedRole || reference.role === displayedRole)
  const entities: C.Entity[] = []
  const entityRoles = new Map<C.Entity, ReviewReferenceRole>()
  const modelRoles = new Map<C.Model, ReviewReferenceRole>()
  const referenceLabels = new Map<ReviewReferenceRole, C.Entity>()
  const focusLocations = new Map<ReviewReferenceRole, { position: C.Cartesian3; text?: string }[]>()
  const focusPoints: C.Entity[] = []
  const cyan = C.Color.fromCssColorString('#8de6ec')
  const warm = C.Color.fromCssColorString('#ffdc9a')
  const labelBackground = C.Color.fromCssColorString('#142734').withAlpha(.94)
  const selectedBackground = C.Color.fromCssColorString('#105574')
  const line = (id: string, positions: C.Cartesian3[], color: C.Color, width = 3) => {
    const entity = viewer.entities.add({ id, polyline: {
      positions, arcType: C.ArcType.NONE, width, material: color, depthFailMaterial: color.withAlpha(.65),
    } })
    entities.push(entity)
    return entity
  }
  const label = (id: string, position: C.Cartesian3, text: string, fillColor: C.Color, offset: number) => {
    const entity = viewer.entities.add({ id, position, label: {
      text, font: '600 14px "Microsoft YaHei", sans-serif', fillColor,
      showBackground: true, backgroundColor: labelBackground,
      backgroundPadding: new C.Cartesian2(8, 5), pixelOffset: new C.Cartesian2(0, offset),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    } })
    entities.push(entity)
    return entity
  }
  const bench = comparison ? getActiveThreeBenchModel() : undefined
  const workface = step.key === 'workface' ? nativeRockModels(ids)[0] : undefined
  // The historical diffuse texture reads dark with the inherited underground light.
  const textureShader = workface?.ready && !workface.customShader ? new C.CustomShader({
    fragmentShaderText: `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
      material.diffuse = pow(max(material.diffuse, vec3(0.0)), vec3(0.78));
    }`,
  }) : undefined
  if (textureShader && workface) workface.customShader = textureShader
  const shellIndex = workface ? getFocusedTunnelSegment() : null
  const shell = shellIndex === null ? undefined : getTunnelGlbSegment(shellIndex)
  const shellColor = shell?.color && C.Color.clone(shell.color)
  const subduedShell = shellColor?.withAlpha(Math.min(shellColor.alpha, .025))
  if (shell && subduedShell) shell.color = subduedShell
  const positionAt = (chainage: number) => {
    if (bench?.ready) return C.Matrix4.multiplyByPoint(bench.modelMatrix,
      new C.Cartesian3(0, 0, selection.references[0]!.start - chainage), new C.Cartesian3())
    const point = chainageService.positionAt(chainage)
    return point && C.Cartesian3.fromDegrees(point.longitude, point.latitude, point.height + 2)
  }
  for (const reference of references) {
    let position: C.Cartesian3 | undefined
    const color = comparison && reference.end !== undefined ? warm : cyan
    if (reference.end !== undefined) {
      const first = supportUnits[0], last = supportUnits.at(-1)
      if (!first?.ready || !last?.ready) continue
      supportUnits.forEach(unit => modelRoles.set(unit, reference.role))
      // Native unit Z advances along the placement tangent. Y only sets the annotation height.
      const annotationHeight = -2.8
      const unitEdge = (model: C.Model, longitudinalOffset: number) => C.Matrix4.multiplyByPoint(model.modelMatrix,
        new C.Cartesian3(0, annotationHeight, longitudinalOffset), new C.Cartesian3())
      position = unitEdge(first, -.5)
      const end = unitEdge(last, .5)
      entityRoles.set(line('construction-review-span', [position, end], color), reference.role)
      const startText = chainageService.format(reference.start)
      const endText = chainageService.format(reference.end)
      const separator = startText.lastIndexOf('+')
      const commonPrefix = separator >= 0 && endText.slice(0, endText.lastIndexOf('+')) === startText.slice(0, separator)
      focusLocations.set(reference.role, [
        { position, text: commonPrefix ? startText.slice(separator) : startText },
        { position: end, text: commonPrefix ? endText.slice(endText.lastIndexOf('+')) : endText },
      ])
      position = C.Cartesian3.midpoint(position, end, new C.Cartesian3())
    } else if (selection.kind === 'blast-handoff') {
      const model = reference.role === 'blast-cloud' ? getBlastModel() : getActiveJetFan()
      if (!model?.ready) continue
      modelRoles.set(model, reference.role)
      position = model.boundingSphere.center
      focusLocations.set(reference.role, [{ position }])
    } else if (workface?.ready) {
      modelRoles.set(workface, reference.role)
      const sphere = workface.boundingSphere
      const up = C.Ellipsoid.WGS84.geodeticSurfaceNormal(sphere.center, new C.Cartesian3())
      position = C.Cartesian3.add(sphere.center, C.Cartesian3.multiplyByScalar(up, 4.9, up), new C.Cartesian3())
    } else {
      position = positionAt(reference.start)
      if (bench?.ready) modelRoles.set(bench, reference.role)
    }
    if (!position) continue
    const cloudLabel = reference.role === 'blast-cloud'
    if (cloudLabel) {
      const up = C.Ellipsoid.WGS84.geodeticSurfaceNormal(position, new C.Cartesian3())
      position = C.Cartesian3.add(position, C.Cartesian3.multiplyByScalar(up, 4.5, up), new C.Cartesian3())
    }
    const offset = reference.end !== undefined ? 34 : fanDetail ? -90 : -28
    const marker = label(`construction-review-reference-${reference.start}`, position,
      `${reference.label} · ${formatReviewReference(reference)}`, color, offset)
    entityRoles.set(marker, reference.role)
    referenceLabels.set(reference.role, marker)
  }
  if (bench?.ready) {
    const benchLabel = label('construction-review-bench', bench.boundingSphere.center, '三台阶开挖', cyan, -48)
    entityRoles.set(benchLabel, 'excavation')
  }
  if (selection.kind === 'blast-handoff' && selection.stepIndex === 2) {
    const gap = reviewStationGap(references)
    const surveyPoints = references.map(reference => chainageService.positionAt(reference.start))
    if (gap !== undefined && surveyPoints.length === 2 && surveyPoints.every(point => !!point)) {
      const endpoints = surveyPoints.map(point => C.Cartesian3.fromDegrees(point!.longitude, point!.latitude, point!.height + .5))
      line('construction-review-station-gap', endpoints, cyan)
      surveyPoints.forEach((point, index) => line(`construction-review-station-tick-${index}`, [endpoints[index]!,
        C.Cartesian3.fromDegrees(point!.longitude, point!.latitude, point!.height + 1.3)], cyan, 2))
      label('construction-review-station-gap-label', C.Cartesian3.midpoint(endpoints[0]!, endpoints[1]!, new C.Cartesian3()),
        `展示里程相差 ${gap} m`, cyan, 20)
    }
  }
  const setAnnotations = (visible: boolean) => {
    if (viewer.isDestroyed()) return
    entities.forEach(entity => { entity.show = visible })
    viewer.scene.requestRender()
  }
  const clearFocusPoints = () => {
    for (const point of focusPoints.splice(0)) {
      entityRoles.delete(point)
      if (!viewer.isDestroyed()) viewer.entities.remove(point)
    }
  }
  const setReferenceFocus = (role: ReviewReferenceRole | null) => {
    if (viewer.isDestroyed()) return
    clearFocusPoints()
    for (const [entity, candidate] of entityRoles) {
      const selected = candidate === role
      if (entity.label) entity.label.backgroundColor = new C.ConstantProperty(selected ? selectedBackground : labelBackground)
      if (entity.polyline) entity.polyline.width = new C.ConstantProperty(selected ? 6 : 3)
    }
    if (role) for (const [index, { position, text }] of (focusLocations.get(role) ?? []).entries()) {
      const point = viewer.entities.add({
        id: `construction-review-focus-${role}-${index}`, position,
        point: {
          pixelSize: 6, color: labelBackground, outlineColor: role === 'support-span' ? warm : cyan,
          outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: text ? {
          text, font: '600 12px "Microsoft YaHei", sans-serif', fillColor: warm,
          showBackground: true, backgroundColor: labelBackground, backgroundPadding: new C.Cartesian2(4, 2),
          horizontalOrigin: C.HorizontalOrigin.CENTER, verticalOrigin: C.VerticalOrigin.BOTTOM,
          pixelOffset: new C.Cartesian2(0, -10), disableDepthTestDistance: Number.POSITIVE_INFINITY,
        } : undefined,
      })
      focusPoints.push(point)
      entityRoles.set(point, role)
    }
    viewer.scene.requestRender()
  }
  const ensureReferenceInView = (role: ReviewReferenceRole, current: ConstructionReviewSelection) => {
    if (viewer.isDestroyed()) return
    const marker = referenceLabels.get(role)
    const time = viewer.clock.currentTime
    const position = marker?.position?.getValue(time)
    const viewport = readTaskViewport(viewer)
    if (!marker?.show || !position || !viewport?.safe) return
    const { camera, scene } = viewer
    const toPosition = C.Cartesian3.subtract(position, camera.positionWC, new C.Cartesian3())
    const projected = C.Cartesian3.dot(toPosition, camera.directionWC) > 0
      ? C.SceneTransforms.worldToWindowCoordinates(scene, position) : undefined
    const offset = marker.label?.pixelOffset?.getValue(time) ?? C.Cartesian2.ZERO
    if (projected) C.Cartesian2.add(projected, offset, projected)
    if (projected && projected.x >= 0 && projected.x < viewport.width && projected.y >= 0 && projected.y < viewport.height &&
        !viewport.obstacles.some(rect => projected.x >= rect.left && projected.x <= rect.right &&
          projected.y >= rect.top && projected.y <= rect.bottom)) return
    focusConstructionReview(viewer, current)
  }
  let cancelPick: (() => void) | undefined
  let referenceLinksActive = selection.sceneAnnotations !== false && selection.referenceLinks !== false
  const setReferenceLinksActive = (active: boolean) => {
    referenceLinksActive = active
    if (active) return
    cancelPick?.()
    cancelPick = undefined
    setReferenceFocus(null)
  }
  const handler = createScreenSpaceEventHandler('task.construction-review-reference-pick', viewer.canvas)
  handler.setInputAction(({ position }: { position: C.Cartesian2 }) => {
    if (!referenceLinksActive) return
    const target = C.Cartesian2.clone(position)
    cancelPick?.()
    // The navigation handler reads depth on pointer-down. Pick against the next rendered frame.
    const stop = viewer.scene.postRender.addEventListener(() => {
      stop()
      cancelPick = undefined
      const segmentIndex = getFocusedTunnelSegment()
      const shell = segmentIndex === null ? undefined : getTunnelGlbSegment(segmentIndex)
      for (const pick of viewer.scene.drillPick(target, 4)) {
        const role = entityRoles.get(pick.id) ?? modelRoles.get(pick.primitive)
        if (role) {
          onReferencePick(role)
          break
        }
        // The navigation pivot and a translucent tunnel shell can sit in front of a visible target.
        if (pick.primitive instanceof C.PointPrimitive && pick.id === undefined) continue
        if (shell && pick.primitive === shell && (shell.color?.alpha ?? 1) < 1) continue
        break
      }
    })
    cancelPick = stop
    viewer.scene.requestRender()
  }, C.ScreenSpaceEventType.LEFT_CLICK)
  setAnnotations(selection.sceneAnnotations !== false)
  const dispose = () => {
    cancelPick?.()
    handler.destroy()
    clearFocusPoints()
    if (textureShader) {
      if (workface && !workface.isDestroyed() && workface.customShader === textureShader) workface.customShader = undefined!
      if (!textureShader.isDestroyed()) textureShader.destroy()
    }
    if (shellColor && shell && !shell.isDestroyed() && C.Color.equals(shell.color, subduedShell)) shell.color = shellColor
    showSupportComponent(null)
    restoreAnchors?.()
    restoreStyle()
    restoreVolumeDomain?.()
    if (backgroundCloud && !backgroundCloud.isDestroyed() && cloudWasVisible !== undefined) backgroundCloud.show = cloudWasVisible
    visibleGradeLabels.forEach(entity => { entity.show = true })
    if (viewer.isDestroyed()) return
    entities.forEach(entity => viewer.entities.remove(entity))
    viewer.scene.requestRender()
  }
  return { selectableRoles: new Set(referenceLabels.keys()), setAnnotations, setReferenceFocus, showSupportComponent,
    setReferenceLinksActive, ensureReferenceInView, dispose }
}
