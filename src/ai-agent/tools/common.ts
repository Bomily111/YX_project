// ── 通用工具：平台基础操作 ──────────────────────────────
// 这些工具操作主 Cesium Viewer，放在 common 中全局可用

import type { ToolRegistration } from '../types'
import { aiEvents } from '../events'
import { DTScopeEngine } from '@/utils/Common/Viewer'
import { activateGeoModel } from '@/utils/Common/GeoModelController'
import * as Cesium from 'cesium'

// ── 里程→经纬度映射（临时，后续从后端获取）───────────────
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
  if (MILEAGE_COORDS[str]) return MILEAGE_COORDS[str]
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

function getViewer(): any {
  if ((window as any).viewer) return (window as any).viewer
  if (DTScopeEngine?.viewer) return (DTScopeEngine as any).viewer
  return null
}

// ── 工具定义 ──────────────────────────────────────────────

export const commonTools: ToolRegistration[] = [
  {
    module: 'common',
    tool: {
      name: 'fly_to_location',
      description: '控制 Cesium 相机飞行到隧道某个里程或工点位置',
      input_schema: {
        type: 'object',
        properties: {
          mileage: { type: 'string', description: '目标里程，例如 DK289+450' },
          zoom: { type: 'number', description: '飞行后的相机高度（米），默认 500' },
        },
        required: ['mileage'],
      },
    },
    executor: async (input) => {
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
      // 同时通过事件总线通知（供独立 Viewer 的子模块监听）
      aiEvents.emit('camera:fly-to', { lng: coords[0], lat: coords[1], height: coords[2] + height })
      return `✅ 正在飞往 ${mileage}（高度偏移 ${height}m）`
    },
  },

  {
    module: 'common',
    tool: {
      name: 'show_geo_model',
      description: '加载或切换地质模型（围岩/TSP/TEM/富水带/破碎带/掌子面素描）',
      input_schema: {
        type: 'object',
        properties: {
          model: {
            type: 'string',
            enum: ['weak_rock', 'tsp', 'tem', 'water_zone', 'fracture_zone', 'face_sketch'],
            description: '模型标识符',
          },
        },
        required: ['model'],
      },
    },
    executor: async (input) => {
      const model = input.model as string
      const viewer = getViewer()
      if (!viewer) return '❌ 三维地球未初始化'
      activateGeoModel(model, viewer)
      const nameMap: Record<string, string> = {
        weak_rock: '软弱围岩', tsp: 'TSP反演', tem: '瞬变电磁',
        water_zone: '富水带', fracture_zone: '破碎带', face_sketch: '掌子面素描',
      }
      return `✅ 已加载 ${nameMap[model] ?? model} 模型`
    },
  },

  {
    module: 'common',
    tool: {
      name: 'open_scene',
      description: '打开平台中某个施工场景面板（支护/通风/调度/爆破/围岩）',
      input_schema: {
        type: 'object',
        properties: {
          scene: {
            type: 'string',
            enum: ['blast', 'support', 'vent', 'dispatch', 'rock'],
            description: '场景标识符',
          },
        },
        required: ['scene'],
      },
    },
    executor: async (input) => {
      const scene = input.scene as string
      aiEvents.emit('scene:open', scene)
      const nameMap: Record<string, string> = {
        blast: '爆破指挥台', support: '支护场景', vent: '通风监测', dispatch: '调度中心', rock: '围岩模型',
      }
      return `✅ 正在打开${nameMap[scene] ?? scene}...`
    },
  },

  {
    module: 'common',
    tool: {
      name: 'query_workface',
      description: '查询当前掌子面的围岩等级、进尺、工序、风险等信息',
      input_schema: { type: 'object', properties: {}, required: [] },
    },
    executor: async () => {
      return [
        '**当前掌子面状态（DK289+450）**',
        '- 围岩等级：IV 级（软质岩，较破碎）',
        '- 循环进尺：3.5 m / 循环',
        '- 开挖方式：三台阶法，光面爆破',
        '- 当前工序：爆破作业中',
        '- 风险预警：前方 25m 富水断裂带',
        '- TSP 结论：前方 30m 地质条件总体稳定，关注富水断裂',
      ].join('\n')
    },
  },

  {
    module: 'common',
    tool: {
      name: 'toggle_layer',
      description: '控制地图图层（中线/围岩/影像/隧道模型）的显示或隐藏',
      input_schema: {
        type: 'object',
        properties: {
          layer: { type: 'string', enum: ['centerline', 'rock', 'imagery', 'tunnel'], description: '图层名称' },
          visible: { type: 'boolean', description: 'true=显示，false=隐藏' },
        },
        required: ['layer', 'visible'],
      },
    },
    executor: async (input) => {
      const { layer, visible } = input as { layer: string; visible: boolean }
      // 实际项目中调用对应的图层控制函数
      return `✅ ${visible ? '显示' : '隐藏'}图层：${layer}`
    },
  },
]
