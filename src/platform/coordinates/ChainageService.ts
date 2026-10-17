import * as Cesium from 'cesium'
import mileageData from '@/assets/data/centerline_mileage.json'

export interface GeographicPosition {
  longitude: number
  latitude: number
  height: number
}

export interface CenterlinePosition extends GeographicPosition {
  heading: number
  metersPerDegreeLongitude: number
  metersPerDegreeLatitude: number
}

export interface ChainageReference {
  prefix: string
  /** 数据集首点在该里程体系中的数值（米）。 */
  origin: number
}

interface MileageEntry {
  mileage: string
  lng: number
  lat: number
  alt: number
}

const entries = mileageData as MileageEntry[]
const DATASET_REFERENCE: ChainageReference = Object.freeze({ prefix: 'YK', origin: 1116 })
const LEGACY_DK_REFERENCE: ChainageReference = Object.freeze({ prefix: 'DK', origin: 278100 })

const formatRemainder = (value: number): string => {
  const rounded = Math.round(value * 1000) / 1000
  const text = Number.isInteger(rounded)
    ? rounded.toFixed(0)
    : rounded.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  return text.padStart(3, '0')
}

/** 统一里程解析、格式化和中线坐标换算。 */
export class ChainageService {
  readonly datasetReference = DATASET_REFERENCE
  readonly legacyDkReference = LEGACY_DK_REFERENCE
  private readonly startOffset = 0
  private readonly endOffset = entries.length > 1
    ? this.parse(entries.at(-1)?.mileage ?? '') - DATASET_REFERENCE.origin
    : 0

  parse(value: string): number {
    const match = value.trim().match(/^(?:[A-Z0-9]*?(?:DK|YK|K))?(\d+)\s*\+\s*(\d+(?:\.\d+)?)$/i)
    if (!match) throw new Error(`无效里程格式：${value}`)
    return Number(match[1]) * 1000 + Number(match[2])
  }

  tryParse(value: string): number | undefined {
    try {
      return this.parse(value)
    } catch {
      return undefined
    }
  }

  format(value: number, prefix = DATASET_REFERENCE.prefix): string {
    if (!Number.isFinite(value) || value < 0) throw new Error(`无效里程数值：${value}`)
    const kilometre = Math.floor(value / 1000)
    return `${prefix}${kilometre}+${formatRemainder(value - kilometre * 1000)}`
  }

  /** 把某里程体系下的绝对里程换算成数据集中线起点后的距离。 */
  toOffset(chainage: number, reference = DATASET_REFERENCE): number {
    return chainage - reference.origin
  }

  fromOffset(offset: number, reference = DATASET_REFERENCE): number {
    return reference.origin + offset
  }

  getOffsetRange(): Readonly<{ start: number; end: number }> {
    return { start: this.startOffset, end: this.endOffset }
  }

  contains(chainage: number, reference = DATASET_REFERENCE): boolean {
    const offset = this.toOffset(chainage, reference)
    return offset >= this.startOffset && offset <= this.endOffset
  }

  positionAt(chainage: number, reference = DATASET_REFERENCE): GeographicPosition | undefined {
    const offset = this.toOffset(chainage, reference)
    if (offset < this.startOffset || offset > this.endOffset || entries.length === 0) return undefined

    const dataChainage = DATASET_REFERENCE.origin + offset
    let low = 0
    let high = entries.length - 1
    while (low < high - 1) {
      const middle = (low + high) >> 1
      if (this.parse(entries[middle].mileage) <= dataChainage) low = middle
      else high = middle
    }

    const a = entries[low]
    const b = entries[high]
    const aChainage = this.parse(a.mileage)
    const bChainage = this.parse(b.mileage)
    const ratio = bChainage === aChainage ? 0 : (dataChainage - aChainage) / (bChainage - aChainage)
    return {
      longitude: Cesium.Math.lerp(a.lng, b.lng, ratio),
      latitude: Cesium.Math.lerp(a.lat, b.lat, ratio),
      height: Cesium.Math.lerp(a.alt, b.alt, ratio),
    }
  }

  worldPositionAt(chainage: number, reference = DATASET_REFERENCE): Cesium.Cartesian3 | undefined {
    const position = this.positionAt(chainage, reference)
    return position
      ? Cesium.Cartesian3.fromDegrees(position.longitude, position.latitude, position.height)
      : undefined
  }

  positionWithHeadingAt(chainage: number, reference = DATASET_REFERENCE): CenterlinePosition | undefined {
    const position = this.positionAt(chainage, reference)
    if (!position) return undefined

    const offset = this.toOffset(chainage, reference)
    const dataChainage = DATASET_REFERENCE.origin + offset
    let low = 0
    let high = entries.length - 1
    while (low < high - 1) {
      const middle = (low + high) >> 1
      if (this.parse(entries[middle].mileage) <= dataChainage) low = middle
      else high = middle
    }

    const a = entries[low]
    const b = entries[high]
    const metersPerDegreeLongitude = 111320 * Math.cos(Cesium.Math.toRadians(position.latitude))
    const metersPerDegreeLatitude = 110940
    const east = (b.lng - a.lng) * metersPerDegreeLongitude
    const north = (b.lat - a.lat) * metersPerDegreeLatitude
    return {
      ...position,
      heading: Math.atan2(east, north),
      metersPerDegreeLongitude,
      metersPerDegreeLatitude,
    }
  }

  nearestPosition(longitude: number, latitude: number): {
    position: GeographicPosition
    distance: number
    offset: number
  } {
    if (entries.length === 0) throw new Error('中线数据为空')
    const query = Cesium.Cartesian3.fromDegrees(longitude, latitude)
    let nearestIndex = 0
    let nearestDistance = Number.POSITIVE_INFINITY

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index]
      const candidate = Cesium.Cartesian3.fromDegrees(entry.lng, entry.lat)
      const distance = Cesium.Cartesian3.distance(query, candidate)
      if (distance < nearestDistance) {
        nearestIndex = index
        nearestDistance = distance
      }
    }

    const entry = entries[nearestIndex]
    return {
      position: { longitude: entry.lng, latitude: entry.lat, height: entry.alt },
      distance: nearestDistance,
      offset: this.parse(entry.mileage) - DATASET_REFERENCE.origin,
    }
  }
}

export const chainageService = new ChainageService()
