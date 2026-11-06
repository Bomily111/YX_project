interface CuttableVolume {
  properties: Record<string, any>
  draw: (interactive: boolean) => void
}
let activeVolume: (() => CuttableVolume | undefined) | undefined
export function registerTaskVolumeAccess(access: () => CuttableVolume | undefined): void { activeVolume = access }
/** Presentation-only clipping; source voxels and placement are unchanged. */
export function applyTaskVolumeCut(): () => void {
  const volume = activeVolume?.()
  if (!volume?.properties || typeof volume.draw !== 'function') throw new Error('当前解释体尚未就绪，无法进行任务剖切')
  const previous = { xmax: volume.properties.xmax, ymin: volume.properties.ymin }
  volume.properties.xmax = 0.5
  volume.properties.ymin = 0.2
  volume.properties.firstLoop = true
  try { volume.draw(false) } catch (error) { Object.assign(volume.properties, previous); throw error }
  return () => {
    if (activeVolume?.() !== volume) return
    Object.assign(volume.properties, previous, { firstLoop: true })
    volume.draw(false)
  }
}
