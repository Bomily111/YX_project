import * as C from 'cesium'
import { readTaskViewport, taskViewportOverlays, type ScreenRect } from './TaskViewport'

type LabelPosition = { x: number; y: number; origin: C.HorizontalOrigin }
type LabelEntry = { entity: C.Entity; preferred: LabelPosition; optional: boolean; leaderTarget?: C.Cartesian3 }
type Viewport = NonNullable<ReturnType<typeof readTaskViewport>>

function intersects(a: ScreenRect, b: ScreenRect) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}

function fits(rect: ScreenRect, viewport: Viewport, occupied: readonly ScreenRect[]) {
  return rect.left >= 4 && rect.top >= 4 && rect.right <= viewport.width - 4 && rect.bottom <= viewport.height - 4 &&
    !occupied.some(other => intersects(rect, other))
}

/** Place static review labels after the camera and visible overlays settle. */
export function installReviewLabelLayout(viewer: C.Viewer, initiallyEnabled: boolean) {
  const scene = viewer.scene
  const entries = new Map<C.Entity, LabelEntry>()
  const protectedTargets: C.Cartesian3[] = []
  const textCanvas = viewer.canvas.ownerDocument.createElement('canvas').getContext('2d')
  let enabled = initiallyEnabled
  let pending: (() => void) | undefined
  let leaderCanvas: HTMLCanvasElement | undefined
  let focusedLeader: C.Entity | undefined

  const clearLeaders = () => {
    leaderCanvas?.remove()
    leaderCanvas = undefined
  }

  const screenBox = (entity: C.Entity) => {
    const time = viewer.clock.currentTime
    const label = entity.label
    const anchor = entity.position?.getValue(time)
    if (!textCanvas || !entity.show || !label || !anchor) return undefined
    const { camera } = viewer
    const direction = C.Cartesian3.subtract(anchor, camera.positionWC, new C.Cartesian3())
    if (C.Cartesian3.dot(direction, camera.directionWC) <= 0) return undefined
    const pixel = C.SceneTransforms.worldToWindowCoordinates(scene, anchor)
    if (!pixel) return undefined
    textCanvas.font = label.font?.getValue(time) ?? '14px sans-serif'
    const measured = textCanvas.measureText(label.text?.getValue(time) ?? '')
    const padding = label.backgroundPadding?.getValue(time) ?? C.Cartesian2.ZERO
    const width = Math.ceil(measured.width) + 2 * padding.x + 4
    const ascent = (measured.fontBoundingBoxAscent || 14) + padding.y + 2
    const height = ascent + (measured.fontBoundingBoxDescent || 4) + padding.y + 2
    const vertical = label.verticalOrigin?.getValue(time) ?? C.VerticalOrigin.CENTER
    return ({ x, y, origin }: LabelPosition): ScreenRect => {
      const align = origin === C.HorizontalOrigin.LEFT ? 0 : origin === C.HorizontalOrigin.CENTER ? .5 : 1
      const left = pixel.x + x - width * align
      const top = pixel.y + y - (vertical === C.VerticalOrigin.BOTTOM ? height : vertical === C.VerticalOrigin.CENTER ? height / 2 : ascent)
      return { left, right: left + width, top, bottom: top + height }
    }
  }

  const labelPosition = (entity: C.Entity): LabelPosition => {
    const time = viewer.clock.currentTime
    const { x, y } = entity.label?.pixelOffset?.getValue(time) ?? C.Cartesian2.ZERO
    return { x, y, origin: entity.label?.horizontalOrigin?.getValue(time) ?? C.HorizontalOrigin.CENTER }
  }

  const apply = (entity: C.Entity, next: LabelPosition, show: boolean) => {
    const label = entity.label!
    const current = labelPosition(entity)
    let changed = false
    if (current.x !== next.x || current.y !== next.y) {
      label.pixelOffset = new C.ConstantProperty(new C.Cartesian2(next.x, next.y))
      changed = true
    }
    if (current.origin !== next.origin) {
      label.horizontalOrigin = new C.ConstantProperty(next.origin)
      changed = true
    }
    if ((label.show?.getValue(viewer.clock.currentTime) ?? true) !== show) {
      label.show = new C.ConstantProperty(show)
      changed = true
    }
    return changed
  }

  const drawLeaders = () => {
    const lines = []
    for (const { entity, preferred, leaderTarget } of entries.values()) {
      if (!enabled || !leaderTarget || !entity.show || entity.label?.show?.getValue(viewer.clock.currentTime) === false) continue
      if (focusedLeader && entity !== focusedLeader) continue
      const position = labelPosition(entity)
      if (!focusedLeader && position.x === preferred.x && position.y === preferred.y && position.origin === preferred.origin) continue
      const box = screenBox(entity)?.(position)
      const target = C.SceneTransforms.worldToWindowCoordinates(scene, leaderTarget)
      if (!box || !target || target.x < 0 || target.y < 0 || target.x > viewer.canvas.clientWidth || target.y > viewer.canvas.clientHeight) continue
      const edge = { x: Math.max(box.left, Math.min(target.x, box.right)), y: Math.max(box.top, Math.min(target.y, box.bottom)) }
      if (Math.hypot(edge.x - target.x, edge.y - target.y) >= 8) lines.push({ target, edge })
    }
    if (!lines.length) { clearLeaders(); return }
    const host = viewer.canvas.parentElement
    if (!host) return
    if (!leaderCanvas) {
      leaderCanvas = host.ownerDocument.createElement('canvas')
      leaderCanvas.dataset.reviewLabelLeaders = ''
      leaderCanvas.setAttribute('aria-hidden', 'true')
      Object.assign(leaderCanvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' })
      host.append(leaderCanvas)
    }
    const { clientWidth: width, clientHeight: height } = viewer.canvas
    const scale = host.ownerDocument.defaultView?.devicePixelRatio ?? 1
    const pixelWidth = Math.round(width * scale), pixelHeight = Math.round(height * scale)
    if (leaderCanvas.width !== pixelWidth) leaderCanvas.width = pixelWidth
    if (leaderCanvas.height !== pixelHeight) leaderCanvas.height = pixelHeight
    const context = leaderCanvas.getContext('2d')
    if (!context) return
    context.setTransform(scale, 0, 0, scale, 0, 0)
    context.clearRect(0, 0, width, height)
    context.lineWidth = focusedLeader ? 2.5 : 1.5
    context.strokeStyle = focusedLeader ? '#f2fcff' : '#8de6ec'
    for (const { target, edge } of lines) {
      context.beginPath()
      context.moveTo(target.x, target.y)
      context.lineTo(edge.x, edge.y)
      context.stroke()
    }
    // A leader passing another annotation must leave its text and background clear.
    for (const { entity } of entries.values()) {
      if (entity.label?.show?.getValue(viewer.clock.currentTime) === false) continue
      const box = screenBox(entity)?.(labelPosition(entity))
      if (box) context.clearRect(box.left, box.top, box.right - box.left, box.bottom - box.top)
    }
  }

  const layout = () => {
    observeOverlays()
    const viewport = readTaskViewport(viewer)
    if (!viewport || !textCanvas) return
    const occupied = [...viewport.obstacles]
    for (const target of protectedTargets) {
      const point = C.SceneTransforms.worldToWindowCoordinates(scene, target)
      if (!point) continue
      // Keep the pick area of compact task objects clear of nearby review labels.
      const radius = 10
      occupied.push({ left: point.x - radius, right: point.x + radius, top: point.y - radius, bottom: point.y + radius })
    }
    let changed = false
    for (const { entity, preferred, optional } of [...entries.values()].sort((a, b) => Number(a.optional) - Number(b.optional))) {
      const box = screenBox(entity)
      if (!box) continue
      const choices: LabelPosition[] = [preferred]
      for (const origin of [C.HorizontalOrigin.RIGHT, C.HorizontalOrigin.LEFT]) {
        if (origin !== preferred.origin) choices.push({ ...preferred, origin })
      }
      for (const offset of [-28, 28, -56, 56]) {
        choices.push({ ...preferred, y: preferred.y + offset })
        for (const origin of [C.HorizontalOrigin.RIGHT, C.HorizontalOrigin.LEFT]) {
          if (origin !== preferred.origin) choices.push({ ...preferred, y: preferred.y + offset, origin })
        }
      }
      for (const offset of [-24, 24, -48, 48]) choices.push({ ...preferred, x: preferred.x + offset })
      const choice = choices.find(candidate => fits(box(candidate), viewport, occupied))
      const next = choice ?? preferred
      const show = !!choice || !optional
      if (show) occupied.push(box(next))
      if (apply(entity, next, show)) changed = true
    }
    if (changed) scene.requestRender()
  }
  const schedule = () => {
    if (!enabled || pending || viewer.isDestroyed()) return
    pending = scene.postRender.addEventListener(() => {
      pending?.()
      pending = undefined
      layout()
    })
    scene.requestRender()
  }
  const stopCamera = viewer.camera.moveEnd.addEventListener(schedule)
  const stopLeaders = scene.postRender.addEventListener(drawLeaders)
  const resize = new ResizeObserver(schedule)
  const observed = new Set<Element>()
  function observeOverlays() {
    const next = new Set([viewer.canvas, ...taskViewportOverlays(viewer)])
    for (const target of observed) if (!next.has(target)) {
      resize.unobserve(target)
      observed.delete(target)
    }
    for (const target of next) if (!observed.has(target)) {
      resize.observe(target)
      observed.add(target)
    }
  }
  const chatRoot = viewer.canvas.ownerDocument.querySelector('.agent-root')
  const afterChatTransition = (event: Event) => {
    if (event.target instanceof Element && event.target.classList.contains('agent-window')) schedule()
  }
  if (chatRoot) resize.observe(chatRoot)
  chatRoot?.addEventListener('transitionend', afterChatTransition, true)
  observeOverlays()

  return {
    track(entity: C.Entity, optional = false, leaderTarget?: C.Cartesian3) {
      if (!entity.label) return
      entries.set(entity, { entity, preferred: labelPosition(entity), optional, leaderTarget })
      schedule()
    },
    untrack(entity: C.Entity) { entries.delete(entity); schedule() },
    protectTarget(position: C.Cartesian3) { protectedTargets.push(C.Cartesian3.clone(position)); schedule() },
    setLeaderFocus(entity?: C.Entity) {
      focusedLeader = entity && entries.get(entity)?.leaderTarget ? entity : undefined
      scene.requestRender()
    },
    setEnabled(next: boolean) {
      if (enabled === next || viewer.isDestroyed()) return
      enabled = next
      if (enabled) {
        schedule()
        return
      }
      pending?.()
      pending = undefined
      clearLeaders()
      for (const { entity, preferred } of entries.values()) apply(entity, preferred, true)
      scene.requestRender()
    },
    fitsViewport(entity: C.Entity, viewport: Viewport) {
      const box = screenBox(entity)
      if (!box) return false
      const rect = box(labelPosition(entity))
      if (!fits(rect, viewport, viewport.obstacles)) return false
      return [...entries.values()].every(({ entity: other, optional }) => {
        if (other === entity || optional || other.label?.show?.getValue(viewer.clock.currentTime) === false) return true
        const otherBox = screenBox(other)
        return !otherBox || !intersects(rect, otherBox(labelPosition(other)))
      })
    },
    schedule,
    dispose() {
      pending?.()
      stopCamera()
      stopLeaders()
      clearLeaders()
      resize.disconnect()
      chatRoot?.removeEventListener('transitionend', afterChatTransition, true)
      entries.clear()
    },
  }
}
