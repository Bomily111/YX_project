export const continuousSupportCatalog = [10, 20, 30, 50].map(length => ({ id: `support.modeler-continuous-zz-va-${length}m`, length }))
export function planContinuousSupport(start: number, length: number) {
  if (!Number.isFinite(start) || !continuousSupportCatalog.some(item => item.length === length) || start < 1116 || start + length > 9400) throw new Error('连续支护示意段需要有效起点及10、20、30或50米长度')
  if (Math.floor((start - 1116) / 500) !== Math.floor((start + length - 1116 - 1e-6) / 500)) throw new Error('当前连续支护示意段须位于同一500米隧道载体内，请调整起点或长度')
  return { start, end: start + length, length, units: Array.from({ length }, (_, index) => start + index) }
}
