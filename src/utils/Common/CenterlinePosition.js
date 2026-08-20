/**
 * 隧道中线位置查询工具
 * 根据 DK 里程数值，在中心线数据上插值计算 [lon, lat, elev]
 * 数据源：src/assets/data/centerLine.json
 */
import centerlineData from '@/assets/data/centerLine.json';
const coords = centerlineData.features[0].geometry.coordinates;
// ── 缓存的累积距离 ──────────────────────────────────────────
let _cache = null;
function haversineMeters(a, b) {
    const R = 6371000;
    const dLat = ((b[1] - a[1]) * Math.PI) / 180;
    const dLon = ((b[0] - a[0]) * Math.PI) / 180;
    const lat1 = (a[1] * Math.PI) / 180;
    const lat2 = (b[1] * Math.PI) / 180;
    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const aVal = sinDLat * sinDLat +
        Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
    return R * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
}
function getCache() {
    if (_cache)
        return _cache;
    const distances = [0];
    for (let i = 1; i < coords.length; i++) {
        const d = haversineMeters([coords[i - 1][0], coords[i - 1][1]], [coords[i][0], coords[i][1]]);
        distances.push(distances[i - 1] + d);
    }
    _cache = { distances, totalLength: distances[distances.length - 1] };
    return _cache;
}
/** 中线总长度（米） */
export function getCenterlineLength() {
    return getCache().totalLength;
}
/** 中线起止范围 */
export function getCenterlineBounds() {
    return { start: coords[0], end: coords[coords.length - 1] };
}
/**
 * 根据 DK 里程数值获取中线上的 [lon, lat, elev]
 * dkNumber: 数值里程，如 283500 表示 DK283+500
 * startDk:  中线起点对应的 DK 数值，默认 278100 (DK278+100)
 * 返回 null 表示里程超出中线范围
 */
export function getPositionOnCenterline(dkNumber, startDk = 278100) {
    const { distances } = getCache();
    const targetDist = dkNumber - startDk;
    if (targetDist < 0 || targetDist > distances[distances.length - 1]) {
        return null;
    }
    return interpolateOnLine(coords, distances, targetDist);
}
/**
 * 查找中线上离给定坐标最近的点
 */
export function snapToCenterline(lon, lat) {
    let minDist = Infinity;
    let bestIdx = 0;
    for (let i = 0; i < coords.length; i++) {
        const c = coords[i];
        const d = (c[0] - lon) ** 2 + (c[1] - lat) ** 2;
        if (d < minDist) {
            minDist = d;
            bestIdx = i;
        }
    }
    const { distances } = getCache();
    return {
        coord: coords[bestIdx],
        distance: Math.sqrt(minDist) * 111320,
        dkOffset: distances[bestIdx],
    };
}
/**
 * 根据 DK 里程获取中线位置 + heading（弧度，从北顺时针）
 * 用于需要横向偏移的坐标映射（如 ANSYS X → 垂直于中线的偏移）
 */
export function getPositionWithHeading(dkNumber, startDk = 278100) {
    const { distances } = getCache();
    const targetDist = dkNumber - startDk;
    if (targetDist < 0 || targetDist > distances[distances.length - 1]) {
        return null;
    }
    return interpolateOnLineWithHeading(coords, distances, targetDist);
}
// ── 内部 ────────────────────────────────────────────────────
function interpolateOnLineWithHeading(pts, distances, targetDist) {
    let lo = 0;
    let hi = distances.length - 1;
    while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (distances[mid] < targetDist)
            lo = mid;
        else
            hi = mid;
    }
    const segLen = distances[hi] - distances[lo];
    const t = segLen > 0 ? (targetDist - distances[lo]) / segLen : 0;
    const a = pts[lo];
    const b = pts[hi];
    const lon = a[0] + (b[0] - a[0]) * t;
    const lat = a[1] + (b[1] - a[1]) * t;
    const elev = a[2] + (b[2] - a[2]) * t;
    // heading: radians from north, clockwise
    const metersPerDegLon = 111320 * Math.cos((lat * Math.PI) / 180);
    const metersPerDegLat = 110940;
    const dLonM = (b[0] - a[0]) * metersPerDegLon;
    const dLatM = (b[1] - a[1]) * metersPerDegLat;
    const heading = Math.atan2(dLonM, dLatM);
    return { lon, lat, elev, heading, metersPerDegLon, metersPerDegLat };
}
function interpolateOnLine(pts, distances, targetDist) {
    let lo = 0;
    let hi = distances.length - 1;
    while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (distances[mid] < targetDist)
            lo = mid;
        else
            hi = mid;
    }
    const segLen = distances[hi] - distances[lo];
    const t = segLen > 0 ? (targetDist - distances[lo]) / segLen : 0;
    const a = pts[lo];
    const b = pts[hi];
    return [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
    ];
}
