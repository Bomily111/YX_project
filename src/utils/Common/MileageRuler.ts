/**
 * 隧道里程刻度尺 —— 在 Cesium 场景中隧道中线旁绘制平行刻度线
 * 数据源与 MileageSearchBar.vue 共用 centerline_mileage.json（YK 格式）
 */
import * as Cesium from 'cesium'
import mileageData from '@/assets/data/centerline_mileage.json'

interface MileageEntry {
  index: number
  mileage: string
  lng: number
  lat: number
  alt: number
}

const entries = mileageData as MileageEntry[]

/** 解析 YK 格式里程字符串为数值（米），如 "YK3+200" → 3200 */
function parseYK(m: string): number {
  const match = m.match(/^YK(\d+)\+(\d+(?:\.\d+)?)$/i)
  if (!match) return NaN
  return parseInt(match[1], 10) * 1000 + parseFloat(match[2])
}

/** 两点间的 ENU heading（弧度，从北顺时针） */
function computeHeading(a: MileageEntry, b: MileageEntry): number {
  const posA = Cesium.Cartesian3.fromDegrees(a.lng, a.lat, a.alt)
  const posB = Cesium.Cartesian3.fromDegrees(b.lng, b.lat, b.alt)
  const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(posA)
  const invEnu = Cesium.Matrix4.inverseTransformation(enuMatrix, new Cesium.Matrix4())
  const dir = Cesium.Cartesian3.subtract(posB, posA, new Cesium.Cartesian3())
  const localDir = Cesium.Matrix4.multiplyByPointAsVector(invEnu, dir, new Cesium.Cartesian3())
  return Math.atan2(localDir.x, localDir.y)
}

/**
 * 沿垂直方向偏移一个点
 * heading: 中线前进方向（弧度）
 * sideOffset: 右侧偏移距离（米），负值表示左侧
 */
function offsetPoint(
  entry: MileageEntry,
  heading: number,
  sideOffset: number,
): { lon: number; lat: number; alt: number } {
  const perpHeading = heading + Math.PI / 2 // 右侧垂直方向
  const metersPerDegLon = 111320 * Math.cos((entry.lat * Math.PI) / 180)
  const metersPerDegLat = 110940
  const dLon = (Math.sin(perpHeading) * sideOffset) / metersPerDegLon
  const dLat = (Math.cos(perpHeading) * sideOffset) / metersPerDegLat
  return {
    lon: entry.lng + dLon,
    lat: entry.lat + dLat,
    alt: entry.alt,
  }
}

export class MileageRuler {
  private viewer: Cesium.Viewer
  private offsetLine!: Cesium.PolylineCollection
  private tickLines!: Cesium.PolylineCollection
  private tickLabels!: Cesium.LabelCollection
  private _visible = true

  /** 偏移距离（米） */
  private readonly sideOffset = 25

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer
    this.offsetLine = viewer.scene.primitives.add(new Cesium.PolylineCollection())
    this.tickLines = viewer.scene.primitives.add(new Cesium.PolylineCollection())
    this.tickLabels = viewer.scene.primitives.add(new Cesium.LabelCollection())
    this.build()
  }

  private build(): void {
    if (entries.length < 2) return

    const firstVal = parseYK(entries[0].mileage)
    const lastVal = parseYK(entries[entries.length - 1].mileage)
    if (isNaN(firstVal) || isNaN(lastVal)) return

    // ── 找出每个整刻度对应的数据索引 ──────────────────────
    const ticks1000m: number[] = []
    const ticks100m: number[] = []
    const ticks20m: number[] = []

    for (let v = Math.ceil(firstVal / 20) * 20; v <= lastVal; v += 20) {
      const dist = v - firstVal
      const idx = Math.round(dist / 2) // 数据间距 2m
      if (idx < 0 || idx >= entries.length) continue

      if (v % 1000 === 0) ticks1000m.push(idx)
      else if (v % 100 === 0) ticks100m.push(idx)
      else ticks20m.push(idx)
    }

    // ── 主偏移线 ──────────────────────────────────────────
    const mainLinePositions: Cesium.Cartesian3[] = []
    // 每隔 10 个数据点采样一次主偏移线（减少绘制量）
    for (let i = 0; i < entries.length; i += 10) {
      const e = entries[i]
      const next = entries[Math.min(i + 1, entries.length - 1)]
      const heading = computeHeading(e, next)
      const op = offsetPoint(e, heading, this.sideOffset)
      mainLinePositions.push(Cesium.Cartesian3.fromDegrees(op.lon, op.lat, op.alt))
    }
    this.offsetLine.add({
      positions: mainLinePositions,
      width: 3,
      material: new Cesium.Material({
        strict: false,
        fabric: {
          type: 'Color',
          uniforms: { color: Cesium.Color.YELLOW },
        },
      }),
    })

    // ── 刻度绘制辅助 ─────────────────────────────────────
    const addTicks = (indices: number[], tickLen: number, color: Cesium.Color, zIndex: number) => {
      for (const idx of indices) {
        const e = entries[idx]
        const next = entries[Math.min(idx + 1, entries.length - 1)]
        const heading = computeHeading(e, next)
        const base = offsetPoint(e, heading, this.sideOffset)
        const tip = offsetPoint(e, heading, this.sideOffset + tickLen)

        this.tickLines.add({
          positions: [
            Cesium.Cartesian3.fromDegrees(base.lon, base.lat, base.alt),
            Cesium.Cartesian3.fromDegrees(tip.lon, tip.lat, tip.alt),
          ],
          width: tickLen > 15 ? 4 : 2,
          material: new Cesium.Material({
            strict: false,
            fabric: { type: 'Color', uniforms: { color } },
          }),
          zIndex,
        })
      }
    }

    // ── 1000m 主刻度 + 标签 ──────────────────────────────
    addTicks(ticks1000m, 20, Cesium.Color.YELLOW, 100)
    for (const idx of ticks1000m) {
      const e = entries[idx]
      const next = entries[Math.min(idx + 1, entries.length - 1)]
      const heading = computeHeading(e, next)
      const labelPos = offsetPoint(e, heading, this.sideOffset + 30)
      this.tickLabels.add({
        position: Cesium.Cartesian3.fromDegrees(labelPos.lon, labelPos.lat, labelPos.alt),
        text: e.mileage,
        font: 'bold 20px Consolas, Microsoft YaHei, monospace',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 4,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        scale: 1.0,
        horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        pixelOffset: new Cesium.Cartesian2(6, 0),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 10000),
      })
    }

    // ── 100m 中刻度 + 近距标签 ───────────────────────────
    addTicks(ticks100m, 10, Cesium.Color.YELLOW, 50)
    for (const idx of ticks100m) {
      const e = entries[idx]
      const next = entries[Math.min(idx + 1, entries.length - 1)]
      const heading = computeHeading(e, next)
      const labelPos = offsetPoint(e, heading, this.sideOffset + 18)
      this.tickLabels.add({
        position: Cesium.Cartesian3.fromDegrees(labelPos.lon, labelPos.lat, labelPos.alt),
        text: e.mileage,
        font: 'bold 16px Consolas, Microsoft YaHei, monospace',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        scale: 0.8,
        horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        pixelOffset: new Cesium.Cartesian2(5, 0),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 3000),
      })
    }

    // ── 20m 细刻度（无标签） ─────────────────────────────
    addTicks(ticks20m, 5, Cesium.Color.YELLOW, 0)
  }

  get visible(): boolean {
    return this._visible
  }

  /** 判断刻度尺是否仍绑定当前 Cesium 场景。 */
  belongsTo(viewer: Cesium.Viewer): boolean {
    return this.viewer === viewer && !viewer.isDestroyed()
  }

  show(): void {
    this._visible = true
    this.offsetLine.show = true
    this.tickLines.show = true
    this.tickLabels.show = true
    this.viewer.scene.requestRender()
  }

  hide(): void {
    this._visible = false
    this.offsetLine.show = false
    this.tickLines.show = false
    this.tickLabels.show = false
    this.viewer.scene.requestRender()
  }

  destroy(): void {
    // 页面路由切换时 Viewer 可能已先销毁；此处必须允许重复、安全清理。
    try { this.offsetLine?.removeAll() } catch {}
    try { this.tickLines?.removeAll() } catch {}
    try { this.tickLabels?.removeAll() } catch {}
    if (!this.viewer.isDestroyed()) {
      try { this.viewer.scene.primitives.remove(this.offsetLine) } catch {}
      try { this.viewer.scene.primitives.remove(this.tickLines) } catch {}
      try { this.viewer.scene.primitives.remove(this.tickLabels) } catch {}
    }
  }
}

let _ruler: MileageRuler | null = null

/** 创建（或获取已有）里程刻度尺 */
export function createMileageRuler(viewer: Cesium.Viewer): MileageRuler {
  // 爆破/通风为独立页面，返回首页后会生成新的 Viewer。
  // 旧刻度尺不能跨 Viewer 复用，否则会保持“已显示”状态但实际不在新场景中。
  if (_ruler && !_ruler.belongsTo(viewer)) {
    _ruler.destroy()
    _ruler = null
  }
  if (_ruler) return _ruler
  _ruler = new MileageRuler(viewer)
  return _ruler
}

/** 获取当前里程刻度尺实例 */
export function getMileageRuler(): MileageRuler | null {
  return _ruler
}

/** 销毁里程刻度尺 */
export function destroyMileageRuler(): void {
  if (_ruler) {
    _ruler.destroy()
    _ruler = null
  }
}
