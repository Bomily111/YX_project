import { computed, ref } from 'vue'
interface CuttableVolume {
  properties: Record<string, any>
  draw: (interactive: boolean) => void
}
let activeVolume: (() => CuttableVolume | undefined) | undefined
const originals = new WeakMap<CuttableVolume, { xmax: any; ymin: any }>()
const revision = ref(0)
export function refreshTaskVolumeCutState() { revision.value++ }
export function registerTaskVolumeAccess(access: () => CuttableVolume | undefined): void { activeVolume = access; refreshTaskVolumeCutState() }
export const taskVolumeCutDisplay = computed(() => {
  void revision.value
  const volume = activeVolume?.()
  return { available: !!volume?.properties, enabled: !!volume && originals.has(volume) && volume.properties.xmax === 0.5 && volume.properties.ymin === 0.2 }
})
export function getTaskVolumeCutState() {
  const properties = activeVolume?.()?.properties
  return properties ? { xmax: properties.xmax, ymin: properties.ymin } : undefined
}
/** Presentation-only clipping; source voxels and placement are unchanged. */
export function setTaskVolumeCut(enabled: boolean) {
  if (typeof enabled !== 'boolean') throw new Error('剖切开关必须为布尔值')
  const volume = activeVolume?.()
  if (!volume?.properties || typeof volume.draw !== 'function') throw new Error('当前解释体尚未就绪，无法进行任务剖切')
  const previous = { xmax: volume.properties.xmax, ymin: volume.properties.ymin }
  const original = originals.get(volume) ?? previous
  Object.assign(volume.properties, enabled ? { xmax: 0.5, ymin: 0.2 } : original)
  volume.properties.firstLoop = true
  try { volume.draw(false) } catch (error) { Object.assign(volume.properties, previous); throw error }
  originals.set(volume, original)
  refreshTaskVolumeCutState()
  return { enabled, xmax: volume.properties.xmax, ymin: volume.properties.ymin }
}
export function applyTaskVolumeCut(): () => void {
  const volume = activeVolume?.()
  setTaskVolumeCut(true)
  return () => {
    if (!volume || activeVolume?.() !== volume) return
    setTaskVolumeCut(false)
    originals.delete(volume)
  }
}
