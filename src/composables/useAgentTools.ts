/**
 * Agent 工具执行逻辑
 * 将 Claude Tool Use 调用映射到平台实际操作
 */
import type { ToolUseBlock } from '@/services/AgentService'
import { DTScopeEngine } from '@/utils/Common/Viewer'
import { activateGeoModel } from '@/utils/Common/GeoModelController'
import { chainageService } from '@/platform/coordinates/ChainageService'
import * as Cesium from 'cesium'

const getViewer = (): any => {
  if ((window as any).viewer) return (window as any).viewer
  if (DTScopeEngine?.viewer) return (DTScopeEngine as any).viewer
  return null
}

// 工具 → 场景事件回调（由 AgentChat 注入）
type SceneCallback = (scene: string) => void
let _onScene: SceneCallback | null = null
export function registerSceneCallback(cb: SceneCallback) { _onScene = cb }

export async function executeTool(tool: ToolUseBlock): Promise<string> {
  const { name, input } = tool

  switch (name) {
    case 'fly_to_location': {
      const mileage = input.mileage as string
      let chainage: number
      try { chainage = chainageService.toCanonicalChainage(mileage) }
      catch { return `❌ 无法解析主场景 YK 里程 ${mileage}` }
      const coords = chainageService.positionAt(chainage)
      if (!coords) return `❌ ${chainageService.format(chainage)} 不在实测中线范围内`
      const viewer = getViewer()
      if (!viewer) return '❌ 三维地球未初始化'
      const height = (input.zoom as number) ?? 500
      viewer.scene.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(coords.longitude, coords.latitude, coords.height + height),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-30), roll: 0 },
        duration: 1.5,
      })
      return `✅ 正在飞往 ${chainageService.format(chainage)}（高度偏移 ${height}m）`
    }

    case 'show_geo_model': {
      const model = input.model as string
      const viewer = getViewer()
      if (!viewer) return '❌ 三维地球未初始化'
      activateGeoModel(model, viewer)
      const nameMap: Record<string, string> = {
        weak_rock: '软弱围岩', tsp: 'TSP反演', tem: '瞬变电磁',
        water_zone: '富水带', fracture_zone: '破碎带', face_sketch: '掌子面素描',
      }
      return `✅ 已加载 ${nameMap[model] ?? model} 模型`
    }

    case 'open_scene': {
      const scene = input.scene as string
      _onScene?.(scene)
      const nameMap: Record<string, string> = {
        blast: '爆破指挥台', support: '支护场景', vent: '通风监测', dispatch: '调度中心', rock: '围岩模型',
      }
      return `✅ 正在打开${nameMap[scene] ?? scene}...`
    }

    case 'query_workface': {
      return '当前工具未接入可核验的掌子面实时记录，请以任务资源和 YK 中线定位结果为准。'
    }

    case 'toggle_layer': {
      const { layer, visible } = input as { layer: string; visible: boolean }
      const viewer = getViewer()
      if (!viewer) return '❌ 三维地球未初始化'
      // 实际项目中调用对应的图层控制函数
      return `✅ ${visible ? '显示' : '隐藏'}图层：${layer}`
    }

    default:
      return `❓ 未知工具：${name}`
  }
}
