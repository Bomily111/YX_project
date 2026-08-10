// ── 爆破专项工具 ─────────────────────────────────────────
// 爆破孪生模块通过 BlastTwinPage 注册这些工具
// 视图操控通过 mitt 事件与 TunnelModule 通信，不直接 import

import type { ToolRegistration } from '../types'
import { aiEvents } from '../events'

// ── 工具定义 ──────────────────────────────────────────────

export const blastTools: ToolRegistration[] = [
  {
    module: 'blast',
    tool: {
      name: 'query_blast_design',
      description: '查询某个里程的爆破设计参数（炮孔数、药量、进尺等）',
      input_schema: {
        type: 'object',
        properties: {
          dk_number: { type: 'string', description: '里程号，如 DK289+450，不传则查全部' },
        },
        required: [],
      },
    },
    executor: async (input) => {
      try {
        const dk = input.dk_number as string | undefined
        const response = await fetch('/api/blast' + (dk ? `?worksite_id=${encodeURIComponent(dk)}` : ''))
        if (!response.ok) return '❌ 查询爆破设计数据失败'
        const designs = await response.json() as any[]
        if (!designs.length) return '📋 当前没有爆破设计数据'
        const d = designs[0]
        return [
          `**爆破设计参数**`,
          d.dk_number ? `- 里程：${d.dk_number}` : '',
          d.name ? `- 名称：${d.name}` : '',
          d.hole_depth_m ? `- 炮孔深度：${d.hole_depth_m} m` : '',
          d.hole_diameter_mm ? `- 孔径：${d.hole_diameter_mm} mm` : '',
          d.total_holes ? `- 总炮孔数：${d.total_holes} 个` : '',
          `- 周边眼：${d.perimeter_holes || '--'} / 掏槽眼：${d.cut_holes || '--'} / 辅助眼：${d.inner_holes || '--'}`,
          d.charge_weight_kg ? `- 总药量：${d.charge_weight_kg} kg` : '',
          d.specific_charge_kgm3 ? `- 炸药单耗：${d.specific_charge_kgm3} kg/m³` : '',
          d.risk_eval_score ? `- 风险评分：${d.risk_eval_score} 分` : '',
          d.status ? `- 状态：${d.status === 'approved' ? '已审批' : d.status === 'draft' ? '草稿' : d.status}` : '',
          `\n共 ${designs.length} 个爆破设计方案`,
        ].filter(Boolean).join('\n')
      } catch (e: any) {
        return `❌ 查询失败：${e.message}`
      }
    },
  },

  {
    module: 'blast',
    tool: {
      name: 'get_blast_stats',
      description: '获取爆破设计的统计汇总（平均孔深、平均药量、风险评分等）',
      input_schema: {
        type: 'object',
        properties: {
          tunnel_id: { type: 'string', description: '隧道 ID，不传则统计全部' },
        },
        required: [],
      },
    },
    executor: async (input) => {
      try {
        const tid = input.tunnel_id as string | undefined
        const url = '/api/blast/stats' + (tid ? `?tunnel_id=${encodeURIComponent(tid)}` : '')
        const response = await fetch(url)
        if (!response.ok) return '❌ 查询统计数据失败'
        const stats = await response.json()
        if (!stats || stats.design_count === 0) return '📋 暂无爆破设计统计数据'
        return [
          '**爆破设计统计汇总**',
          `- 方案总数：${stats.design_count} 个`,
          stats.avg_hole_depth ? `- 平均孔深：${stats.avg_hole_depth} m` : '',
          stats.avg_holes ? `- 平均炮孔数：${stats.avg_holes} 个` : '',
          stats.avg_charge ? `- 平均药量：${stats.avg_charge} kg` : '',
          stats.avg_specific_charge ? `- 平均炸药单耗：${stats.avg_specific_charge} kg/m³` : '',
          stats.avg_risk_score ? `- 平均风险评分：${stats.avg_risk_score} 分` : '',
        ].filter(Boolean).join('\n')
      } catch (e: any) {
        return `❌ 统计查询失败：${e.message}`
      }
    },
  },

  {
    module: 'blast',
    tool: {
      name: 'analyze_blast_risk',
      description: '分析爆破设计的风险等级并给出优化建议',
      input_schema: {
        type: 'object',
        properties: {
          dk_number: { type: 'string', description: '里程号，如 DK289+450' },
        },
        required: [],
      },
    },
    executor: async (input) => {
      try {
        const dk = input.dk_number as string | undefined
        const response = await fetch('/api/blast')
        if (!response.ok) return '❌ 查询数据失败'
        const designs = await response.json() as any[]

        if (!designs.length) return '📋 暂无数据可供分析'

        // 找到相关设计
        const relevant = dk ? designs.filter((d: any) => d.dk_number?.includes(dk)) : designs
        if (!relevant.length) return `📋 未找到 ${dk ? `里程 ${dk} 的` : ''}爆破设计数据`

        const d = relevant[0]
        const riskScore = d.risk_eval_score || 0
        let riskLevel: string
        let suggestions: string[]

        if (riskScore >= 8) {
          riskLevel = '🔴 高风险'
          suggestions = [
            '建议重新审查钻孔布置，尤其是掏槽眼角度',
            '检查装药结构是否合理，考虑减少单段最大药量',
            '加强爆破振动监测，必要时调整起爆顺序',
          ]
        } else if (riskScore >= 5) {
          riskLevel = '🟡 中等风险'
          suggestions = [
            '注意控制周边眼的装药量，防止超挖',
            '确认起爆网络的段间延迟时间',
            '建议做好支护跟进的准备',
          ]
        } else {
          riskLevel = '🟢 低风险'
          suggestions = [
            '当前设计参数较为合理',
            '继续按规程作业，保持质量控制',
          ]
        }

        return [
          `**爆破风险分析**`,
          `- 里程：${d.dk_number || '--'}`,
          `- 风险评分：${riskScore} 分（${riskLevel}）`,
          `- 总药量：${d.charge_weight_kg || '--'} kg`,
          `- 炸药单耗：${d.specific_charge_kgm3 || '--'} kg/m³`,
          '',
          '**优化建议：**',
          ...suggestions.map((s, i) => `${i + 1}. ${s}`),
        ].join('\n')
      } catch (e: any) {
        return `❌ 分析失败：${e.message}`
      }
    },
  },

  {
    module: 'blast',
    tool: {
      name: 'adjust_blast_view',
      description: '在爆破孪生场景中切换三维相机视角',
      input_schema: {
        type: 'object',
        properties: {
          view: {
            type: 'string',
            enum: ['persp', 'front', 'side', 'top', 'overview'],
            description: 'persp=透视(3/4斜视), front=正视掌子面, side=侧视, top=俯视, overview=总览',
          },
        },
        required: ['view'],
      },
    },
    executor: async (input) => {
      const view = input.view as string
      // 通过 mitt 事件通知独立 Cesium Viewer 的 TunnelModule
      aiEvents.emit('blast:adjust-view', view)
      const viewNames: Record<string, string> = {
        persp: '透视视角', front: '正视掌子面', side: '侧视', top: '俯视', overview: '总览视角',
      }
      return `✅ 已切换到${viewNames[view] || view}`
    },
  },

  {
    module: 'blast',
    tool: {
      name: 'toggle_blast_diagram',
      description: '显示或隐藏二维炮孔设计图',
      input_schema: {
        type: 'object',
        properties: {
          visible: { type: 'boolean', description: 'true=显示, false=隐藏' },
        },
        required: ['visible'],
      },
    },
    executor: async (input) => {
      const visible = input.visible as boolean
      aiEvents.emit('blast:toggle-diagram', visible)
      return visible ? '✅ 已显示二维炮孔设计图' : '✅ 已隐藏二维炮孔设计图'
    },
  },

  {
    module: 'blast',
    tool: {
      name: 'get_blast_section_info',
      description: '获取当前爆破断面的基本信息（围岩等级、开挖宽度、循环进尺、炮孔分类统计）',
      input_schema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    executor: async () => {
      return [
        '**当前爆破断面信息（DK289+450）**',
        '- 断面类型：正洞 Ⅳ级 全断面光面爆破',
        '- 开挖宽度：12.40 m',
        '- 拱顶高度：9.03 m',
        '- 循环进尺：2.2 m',
        '- 炮孔总数：185 个',
        '  · 掏槽眼：11 个',
        '  · 辅助眼：95 个',
        '  · 周边眼：49 个',
        '  · 底板眼：30 个',
        '- 爆后点云：45 万点',
        '- 围岩等级：Ⅳ级（软质岩）',
      ].join('\n')
    },
  },
]
