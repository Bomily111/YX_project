import { computed, ref } from 'vue'
import {volumeSamplingDomain} from './VolumeSamplingDomain'
interface CuttableVolume {
  modelMatrix?:ArrayLike<number>
  cesiumModelMatrix?:ArrayLike<number>
  properties: Record<string, any>
  draw: (interactive: boolean) => void
}
export function getTaskVolumeDomain(){
 const volume=activeVolume?.(),matrix=volume?.cesiumModelMatrix??volume?.modelMatrix
 if(!volume||!matrix)return undefined
 return volumeSamplingDomain(matrix,volume.properties)
}
let activeVolume: (() => CuttableVolume | undefined) | undefined
let activeKey:(()=>string|null)|undefined
export const getTaskVolumeKey=()=>activeKey?.()
export const volumeCutPresets=['structure-window','geology-section'] as const
export type VolumeCutPreset=typeof volumeCutPresets[number]
const modes=new WeakMap<CuttableVolume,VolumeCutPreset>()
const originals = new WeakMap<CuttableVolume, { xmax: any; ymin: any }>()
const revision = ref(0)
export function refreshTaskVolumeCutState() { revision.value++ }
export function registerTaskVolumeAccess(access: () => CuttableVolume | undefined,key?:()=>string|null): void { activeVolume = access;activeKey=key;refreshTaskVolumeCutState() }
export const taskVolumeCutDisplay = computed(() => {
  void revision.value
  const volume = activeVolume?.()
  return { available: !!volume?.properties, enabled: !!volume && modes.has(volume), preset:volume?modes.get(volume):undefined }
})
export function getTaskVolumeCutState() {
  const properties = activeVolume?.()?.properties
  return properties ? { xmax: properties.xmax, ymin: properties.ymin } : undefined
}
/** Presentation-only clipping; source voxels and placement are unchanged. */
export function setTaskVolumeCut(enabled: boolean,preset:VolumeCutPreset='structure-window') {
  if (typeof enabled !== 'boolean') throw new Error('剖切开关必须为布尔值')
  if(!volumeCutPresets.includes(preset))throw new Error('不支持的解释体表达策略')
  const volume = activeVolume?.()
  if (!volume?.properties || typeof volume.draw !== 'function') throw new Error('当前解释体尚未就绪，无法进行任务剖切')
  const previous = { xmax: volume.properties.xmax, ymin: volume.properties.ymin }
  const original = originals.get(volume) ?? previous
  Object.assign(volume.properties, enabled ? { xmax: Math.min(original.xmax,0.5), ymin:preset==='structure-window'?Math.max(original.ymin,0.2):original.ymin } : original)
  volume.properties.firstLoop = true
  try { volume.draw(false) } catch (error) { Object.assign(volume.properties, previous); throw error }
  originals.set(volume, original)
  if(enabled)modes.set(volume,preset);else modes.delete(volume)
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

export function captureTaskVolumeCut(){
 const volume=activeVolume?.();if(!volume)throw Error('当前解释体不可保存')
 const saved={xmax:volume.properties.xmax,ymin:volume.properties.ymin},mode=modes.get(volume)
 return ()=>{
  if(activeVolume?.()!==volume)return
  Object.assign(volume.properties,saved);volume.properties.firstLoop=true;volume.draw(false)
  if(mode)modes.set(volume,mode);else modes.delete(volume)
  refreshTaskVolumeCutState()
 }
}
