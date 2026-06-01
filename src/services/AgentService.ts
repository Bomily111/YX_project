/**
 * Claude API 调用封装
 * 使用 Anthropic Messages API（通过后端代理或直连）
 * 在浏览器中需通过 Vite 代理转发到后端，避免暴露 API Key
 */

export interface Message { role: 'user' | 'assistant'; content: string }

export interface AgentTool {
  name: string
  description: string
  input_schema: Record<string, any>
}

export interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, any>
}

export interface TextBlock {
  type: 'text'
  text: string
}

export type ContentBlock = TextBlock | ToolUseBlock

const PLATFORM_TOOLS: AgentTool[] = [
  {
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
  {
    name: 'show_geo_model',
    description: '加载或切换地质模型（围岩/TSP/TEM/富水带/破碎带）',
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
  {
    name: 'open_scene',
    description: '打开平台中某个施工场景面板（支护/通风/调度/爆破）',
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
  {
    name: 'query_workface',
    description: '查询当前掌子面的围岩等级、进尺、工序、风险等信息',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
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
]

const SYSTEM_PROMPT = `你是"隧道施工数字孪生平台"的智能助手，专注于辅助隧道钻爆法施工管理。
你可以：
- 控制三维地球相机飞向指定里程
- 加载/切换地质模型（围岩、TSP、TEM、富水带等）
- 打开各施工场景面板（爆破/支护/通风/调度）
- 查询掌子面参数、风险预警、施工进度
- 解读地质报告、TSP结论、围岩分级依据

回答要简洁专业，使用中文。执行操作时先简要说明你要做什么，然后调用工具。`

/**
 * 发送消息给 Claude，支持流式输出和 Tool Use
 * @param messages 对话历史
 * @param onText 流式文本回调
 * @param onToolUse 工具调用回调（返回工具结果字符串）
 */
export async function sendMessage(
  messages: Message[],
  onText: (delta: string) => void,
  onToolUse?: (tool: ToolUseBlock) => Promise<string>,
): Promise<string> {
  // 实际项目中，通过 Vite 代理 /api/claude → https://api.anthropic.com
  // 这里直接请求，需要在 vite.config.ts 配置代理并注入 API key
  const response = await fetch('/api/claude/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: PLATFORM_TOOLS,
      stream: true,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  })

  if (!response.ok) {
    // 降级：返回模拟响应（开发调试用）
    return simulateResponse(messages, onText)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let fullText = ''
  let toolUseBlock: Partial<ToolUseBlock> | null = null
  let inputJson = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') break
      try {
        const evt = JSON.parse(data)
        if (evt.type === 'content_block_start' && evt.content_block?.type === 'tool_use') {
          toolUseBlock = { type: 'tool_use', id: evt.content_block.id, name: evt.content_block.name, input: {} }
          inputJson = ''
        } else if (evt.type === 'content_block_delta') {
          if (evt.delta?.type === 'text_delta') {
            onText(evt.delta.text)
            fullText += evt.delta.text
          } else if (evt.delta?.type === 'input_json_delta') {
            inputJson += evt.delta.partial_json
          }
        } else if (evt.type === 'content_block_stop' && toolUseBlock) {
          try { toolUseBlock.input = JSON.parse(inputJson) } catch { /* ignore */ }
          if (onToolUse) {
            const result = await onToolUse(toolUseBlock as ToolUseBlock)
            onText('\n' + result)
            fullText += '\n' + result
          }
          toolUseBlock = null
        }
      } catch { /* ignore parse errors */ }
    }
  }

  return fullText
}

// ── 开发模拟响应（无 API Key 时使用） ────────────────────
async function simulateResponse(messages: Message[], onText: (d: string) => void): Promise<string> {
  const last = messages[messages.length - 1]?.content?.toLowerCase() ?? ''
  let reply = ''

  if (last.includes('围岩') || last.includes('rock')) {
    reply = '正在为你加载围岩模型，飞向 DK289+450 围岩段...\n\n**DK289+200 区域围岩概况：**\n- 围岩等级：IV 级，软质岩为主\n- 单轴抗压强度：约 25 MPa\n- TSP 探测：前方 30m 存在富水断裂带\n- 建议：加强超前地质预报，注意渗水风险'
  } else if (last.includes('爆破') || last.includes('blast')) {
    reply = '正在打开爆破指挥台...\n\n**DK289+450 爆破参数概览：**\n- 循环进尺：3.5m\n- 总炮孔数：58 孔\n- 总药量：14.0 kg\n- 起爆方式：非电毫秒雷管，4 段起爆'
  } else if (last.includes('通风') || last.includes('vent')) {
    reply = '正在打开通风监测面板...\n\n**当前通风状态：**\n- 掌子面风速：0.8 m/s（⚠ 低于 1.0 m/s 标准）\n- CO 浓度：18 ppm（接近 24 ppm 限值）\n- 建议：立即检查局部通风机运行状态，增大风量'
  } else if (last.includes('进度') || last.includes('今日')) {
    reply = '**今日施工进度（截至当前）：**\n- 循环进尺：3.5m / 计划 3.5m ✅\n- 完成工序：出渣→找顶→钻孔→装药→爆破\n- 当前工序：通风散烟（预计 13:30 完成）\n- 今日出渣量：420 m³'
  } else {
    reply = '你好！我是隧道施工数字孪生平台的智能助手。你可以问我：\n- 查看围岩/地质模型\n- 打开爆破指挥台\n- 查询通风/支护/调度状态\n- 当前施工进度\n- 飞往某个里程\n\n请告诉我你需要什么帮助？'
  }

  // 模拟流式输出
  for (const char of reply) {
    onText(char)
    await new Promise(r => setTimeout(r, 12))
  }
  return reply
}
