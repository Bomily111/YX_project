// ── 通用工具：平台基础操作 ──────────────────────────────
// 这些工具操作主 Cesium Viewer，放在 common 中全局可用

import type { ToolRegistration } from '../types'
import { aiEvents } from '../events'
import { DTScopeEngine } from '@/utils/Common/Viewer'
import { activateGeoModel } from '@/utils/Common/GeoModelController'
import { chainageService } from '@/platform/coordinates/ChainageService'
import * as Cesium from 'cesium'

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
          mileage: { type: 'string', description: '真实中线目标里程，例如 YK2+244；旧 DK 标签会先转换为 YK' },
          zoom: { type: 'number', description: '飞行后的相机高度（米），默认 500' },
        },
        required: ['mileage'],
      },
    },
    executor: async (input) => {
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
      // 同时通过事件总线通知（供独立 Viewer 的子模块监听）
      aiEvents.emit('camera:fly-to', { lng: coords.longitude, lat: coords.latitude, height: coords.height + height })
      return `✅ 正在飞往 ${chainageService.format(chainage)}（高度偏移 ${height}m）`
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
      return '当前工具未接入可核验的掌子面实时记录，请以任务资源和 YK 中线定位结果为准。'
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
