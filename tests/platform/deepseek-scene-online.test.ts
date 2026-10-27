import { expect, it } from 'vitest'
import { buildSystemPrompt } from '@/ai-agent/knowledge/prompts/system'
import { workflowTools } from '@/ai-agent/tools/workflow.tools'

// Run explicitly with RUN_DEEPSEEK_EVAL=1 and a server-side LLM_API_KEY.
it.skipIf(process.env.RUN_DEEPSEEK_EVAL !== '1')('DeepSeek selects the intended scene resources and asks for missing mileage', async () => {
  const { streamChat } = await import('../../backend/src/ai-agent/providers/langchain-deepseek.js')
  const tool = workflowTools.find(item => item.tool.name === 'assemble_scene_at_mileage')?.tool
  if (!tool) throw new Error('missing assembly tool')

  async function decide(query: string) {
    let text = ''
    const calls: Array<{ name: string; arguments: string }> = []
    await streamChat({ system: buildSystemPrompt(), messages: [{ role: 'user', content: query }], tools: [tool] }, event => {
      if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
        calls.push({ name: event.content_block.name, arguments: '' })
      }
      if (event.type === 'content_block_delta' && event.delta?.type === 'input_json_delta') {
        calls.at(-1)!.arguments += event.delta.partial_json
      }
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') text += event.delta.text
    })
    return { text, calls }
  }

  const assemblyCases = [
    { query: '在 YK1+346 同屏展示 TSP 围岩坚硬度和结构树支护组合', mileage: 'YK1+346', resources: ['rock.tsp-hardness', 'support.legacy-assembly'] },
    { query: '在 YK2+244 展示瞬变电磁视电阻率模型', mileage: 'YK2+244', resources: ['rock.tem-resistivity'] },
    { query: '在 YK1+346 展示 TSP 围岩完整度', mileage: 'YK1+346', resources: ['rock.tsp-integrity'] },
    { query: '在 YK2+244 装配物探融合围岩分级场景', mileage: 'YK2+244', resources: ['rock.geophysical-grade'] },
    { query: '在 YK1+346 展示设计围岩分级模型', mileage: 'YK1+346', resources: ['rock.design-grade'] },
    { query: '在 YK1+346 只展示结构树的钢架构件', mileage: 'YK1+346', resources: ['support.legacy-steel-frame'] },
    { query: 'YK1+346 即将进行初期支护施工交底，请把岩体坚硬程度和现有支护布置放到同一场景查看', mileage: 'YK1+346', resources: ['rock.tsp-hardness', 'support.legacy-assembly'] },
    { query: 'YK2+244 掌子面超前地质预报交底，需要查看前方岩体完整性变化', mileage: 'YK2+244', resources: ['rock.tsp-integrity'] },
    { query: 'YK2+244 掌子面疑似富水，调出前方电阻率异常分布供施工研判', mileage: 'YK2+244', resources: ['rock.tem-resistivity'] },
  ]
  for (const task of assemblyCases) {
    const response = await decide(task.query)
    expect(response.calls, task.query).toHaveLength(1)
    expect(response.calls[0].name, task.query).toBe('assemble_scene_at_mileage')
    const input = JSON.parse(response.calls[0].arguments)
    expect(input.targetMileage, task.query).toBe(task.mileage)
    expect(input.resourceIds, task.query).toEqual(task.resources)
  }

  const missingMileage = await decide('展示围岩完整度模型')
  expect(missingMileage.calls).toHaveLength(0)
  expect(missingMileage.text).toMatch(/里程|YK/)

  const ambiguousMileage = await decide('在 YK1+346 或 YK2+244 展示围岩分级模型')
  expect(ambiguousMileage.calls).toHaveLength(0)
  expect(ambiguousMileage.text).toMatch(/里程|YK|位置/)

  const ambiguousTask = await decide('在 YK2+244 做掌子面施工风险研判，请把相关模型调出来')
  expect(ambiguousTask.calls).toHaveLength(0)
  expect(ambiguousTask.text).toMatch(/围岩|富水|支护|信息|关注|具体/)

  const planOnly = await decide('先给我 YK1+346 的结构树支护组合展示计划，不执行')
  expect(planOnly.calls).toHaveLength(0)
  expect(planOnly.text.length).toBeGreaterThan(0)
}, 180_000)
