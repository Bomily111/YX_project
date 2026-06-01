/**
 * Agent 工具执行逻辑
 * 将 Claude Tool Use 调用映射到平台实际操作
 */
import type { ToolUseBlock } from '@/services/AgentService'
import { DTScopeEngine } from '@/utils/Common/Viewer'
import { activateGeoModel } from '@/utils/Common/GeoModelController'
import * as Cesium from 'cesium'

// 里程 → 大致经纬度映射（线性插值，实际项目应从后端获取）
const MILEAGE_COORDS: Record<string, [number, number, number]> = {
  'DK278+100': [101.942, 29.980, 3200],
  'DK280+000': [101.923, 29.985, 3250],
  'DK283+500': [101.892, 29.998, 3300],
  'DK285+000': [101.878, 30.008, 3350],
  'DK287+000': [101.860, 30.020, 3380],
  'DK289+450': [101.838, 30.033, 3400],
  'DK291+200': [101.820, 30.043, 3450],
  'DK293+800': [101.797, 30.056, 3500],
  'DK300+800': [101.730, 30.090, 3700],
}

function parseMileage(str: string): [number, number, number] | null {
  // 精确匹配
  if (MILEAGE_COORDS[str]) return MILEAGE_COORDS[str]
  // 模糊匹配：找最近的
  const num = parseFloat(str.replace(/DK|[+]/g, '').replace('+', '.'))
  if (isNaN(num)) return null
  let best: [number, number, number] = [101.84, 30.02, 3400]
  let bestDiff = Infinity
  for (const [k, v] of Object.entries(MILEAGE_COORDS)) {
    const kNum = parseFloat(k.replace('DK', '').replace('+', '.'))
    const diff = Math.abs(kNum - num)
    if (diff < bestDiff) { bestDiff = diff; best = v }
  }
  return best
}

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
      const coords = parseMileage(mileage)
      if (!coords) return `❌ 无法解析里程 ${mileage}`
      const viewer = getViewer()
      if (!viewer) return '❌ 三维地球未初始化'
      const height = (input.zoom as number) ?? 500
      viewer.scene.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(coords[0], coords[1], coords[2] + height),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-30), roll: 0 },
        duration: 1.5,
      })
      return `✅ 正在飞往 ${mileage}（高度偏移 ${height}m）`
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
      return [
        '**当前掌子面状态（DK289+450）**',
        '- 围岩等级：IV 级（软质岩，较破碎）',
        '- 循环进尺：3.5 m / 循环',
        '- 开挖方式：三台阶法，光面爆破',
        '- 当前工序：爆破作业中 🔴',
        '- 风险预警：前方 25m 富水断裂带 ⚠',
        '- TSP 结论：前方 30m 地质条件总体稳定，关注富水断裂',
      ].join('\n')
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
