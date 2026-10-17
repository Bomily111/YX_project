/**
 * @deprecated 新代码请直接使用 platform/coordinates/ChainageService。
 * 本文件保留旧接口，所有计算统一委托给 ChainageService。
 */
import { chainageService, type ChainageReference } from '@/platform/coordinates/ChainageService'

type Coord3 = number[]

const referenceFor = (startDk: number): ChainageReference => ({ prefix: 'DK', origin: startDk })

export function getCenterlineLength(): number {
  const range = chainageService.getOffsetRange()
  return range.end - range.start
}

export function getCenterlineBounds(): { start: Coord3; end: Coord3 } {
  const range = chainageService.getOffsetRange()
  const start = chainageService.positionAt(chainageService.fromOffset(range.start))
  const end = chainageService.positionAt(chainageService.fromOffset(range.end))
  if (!start || !end) throw new Error('中线数据为空')
  return {
    start: [start.longitude, start.latitude, start.height],
    end: [end.longitude, end.latitude, end.height],
  }
}

export function getPositionOnCenterline(dkNumber: number, startDk = 278100): Coord3 | null {
  const position = chainageService.positionAt(dkNumber, referenceFor(startDk))
  return position ? [position.longitude, position.latitude, position.height] : null
}

export function snapToCenterline(
  lon: number,
  lat: number,
): { coord: Coord3; distance: number; dkOffset: number } {
  const nearest = chainageService.nearestPosition(lon, lat)
  return {
    coord: [nearest.position.longitude, nearest.position.latitude, nearest.position.height],
    distance: nearest.distance,
    dkOffset: nearest.offset,
  }
}

export function getPositionWithHeading(dkNumber: number, startDk = 278100): {
  lon: number
  lat: number
  elev: number
  heading: number
  metersPerDegLon: number
  metersPerDegLat: number
} | null {
  const position = chainageService.positionWithHeadingAt(dkNumber, referenceFor(startDk))
  if (!position) return null
  return {
    lon: position.longitude,
    lat: position.latitude,
    elev: position.height,
    heading: position.heading,
    metersPerDegLon: position.metersPerDegreeLongitude,
    metersPerDegLat: position.metersPerDegreeLatitude,
  }
}
