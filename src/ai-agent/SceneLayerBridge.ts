export const sceneLayers = ['centerline', 'rock', 'imagery', 'tunnel'] as const
export type SceneLayer = typeof sceneLayers[number]
type Controller = (layer: SceneLayer, visible: boolean) => Promise<boolean> | boolean
let controller: Controller | undefined
export function registerSceneLayerController(value: Controller): () => void {
  controller = value
  return () => { if (controller === value) controller = undefined }
}
export async function changeSceneLayer(layer: unknown, visible: unknown) {
  if (!sceneLayers.includes(layer as SceneLayer) || typeof visible !== 'boolean') throw new Error('图层名称或显示参数无效')
  if (!controller) throw new Error('当前页面未接入主场景图层控制')
  return { layer, visible: await controller(layer as SceneLayer, visible) }
}
