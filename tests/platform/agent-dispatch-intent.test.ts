import { describe, expect, it } from 'vitest'
import { routeWorkflowToolCall, wantsTaskExecution, wantsDirectSceneAssembly, wantsBlastLayerControl, mustReviseAssemblyBeforeAdvance, blocksUnrevisedSceneAdvance } from '@/ai-agent/AgentDispatchIntent'

describe('agent dispatch intent gate', () => {
  it.each(['只保留炮孔，隐藏爆后点云', '显示爆后点云', '关闭炮孔', '恢复炮孔和爆后点云显示'])('routes existing blast layer changes without reassembly: %s', message => {
    expect(wantsBlastLayerControl(message)).toBe(true)
    expect(wantsDirectSceneAssembly(message)).toBe(false)
  })
  it.each(['YK4+000只显示炮孔和点云', '查看炮孔二维设计图', '如何隐藏爆后点云', '只给隐藏炮孔的计划，不执行', '装配爆后点云', '隐藏CFD计算点云', '显示爆后点云和支护', '显示炮孔并查看GPR测线1'])('keeps non-display requests out of blast layer control: %s', message => {
    expect(wantsBlastLayerControl(message)).toBe(false)
  })
  it.each([
    'YK1+346 炮孔施工交底，调出二维设计图和循环进尺',
    'YK1+346 请展示扫描点云，不用设计图',
    'YK4+000 请调出右洞流线',
    'YK4+000 请查看模拟200秒的温度场',
  ])('recognizes construction objects without requiring the module name: %s', message => {
    expect(wantsDirectSceneAssembly(message)).toBe(true)
    expect(wantsDirectSceneAssembly(`先给计划，不执行。${message}`)).toBe(false)
  })
  it('uses the single assembly entry for ordinary scene requests, while preserving explicit debugging', () => {
    expect(wantsDirectSceneAssembly('在 DK278+330 主场景同屏装配设计围岩与支护钢架')).toBe(true)
    expect(wantsDirectSceneAssembly('请展示 YK2+244 的 TSP 模型')).toBe(true)
    expect(wantsDirectSceneAssembly('YK1+346 初期支护施工交底，把岩体坚硬程度和既有支护放到同一场景查看')).toBe(true)
    expect(wantsDirectSceneAssembly('YK2+244 掌子面超前地质预报交底，需要查看前方岩体完整性变化')).toBe(true)
    expect(wantsDirectSceneAssembly('YK2+244 掌子面疑似富水，调出电阻率异常分布')).toBe(true)
    expect(wantsDirectSceneAssembly('YK2+244 支护质量检查，需要查看现有支护')).toBe(false)
    expect(wantsDirectSceneAssembly('把 assemblyModes 设为 replace，再逐步修订装配计划')).toBe(false)
    expect(wantsDirectSceneAssembly('先给我场景计划，不执行')).toBe(false)
    expect(wantsDirectSceneAssembly('检查 DK278+330 初期支护质量')).toBe(false)
    expect(wantsDirectSceneAssembly('在 YK2+244 逐层展示四种物探解释模型')).toBe(false)
    expect(wantsDirectSceneAssembly('在 YK1+346 先展示围岩再展示支护')).toBe(false)
  })
  it('holds an explicitly requested scene revision before the next advance', () => {
    const message = '先执行围岩，之后调用 revise_next_scene_assembly 将第二阶段改为 retain，再继续执行'
    expect(mustReviseAssemblyBeforeAdvance(message)).toBe(true)
    expect(blocksUnrevisedSceneAdvance(message, 0, false, 'advance_platform_task')).toBe(false)
    expect(blocksUnrevisedSceneAdvance(message, 1, false, 'advance_platform_task')).toBe(true)
    expect(blocksUnrevisedSceneAdvance(message, 1, true, 'advance_platform_task')).toBe(false)
    expect(blocksUnrevisedSceneAdvance('正常连续展示', 1, false, 'advance_platform_task')).toBe(false)
  })
  it('routes a model-selected scene plan tool to validated preparation for an explicit goal', () => {
    const input = { description: '围岩与既有支护', resourceIds: ['rock.design-grade', 'support.legacy-assembly'] }
    expect(routeWorkflowToolCall('compose_scene_workflow', input,
      '自主构建并展示围岩与既有支护两阶段场景，请逐步执行')).toEqual({
      name: 'prepare_platform_task', input: { ...input, kind: 'scene-exploration' }, routed: true,
    })
  })

  it('keeps a plan-only request at the planning boundary', () => {
    expect(wantsTaskExecution('请先生成计划，等待我确认后再执行')).toBe(false)
    expect(routeWorkflowToolCall('compose_scene_workflow', { resourceIds: ['rock.design-grade'] },
      '只生成场景计划，不要执行').routed).toBe(false)
    expect(wantsTaskExecution('生成自主场景计划，但不要自动执行')).toBe(false)
  })

  it('routes quality-check creation only when completion is requested', () => {
    const routed = routeWorkflowToolCall('create_task', { start: 278330, end: 278340 }, '自动完成支护质量检查')
    expect(routed.name).toBe('prepare_platform_task')
    expect(routed.input.kind).toBe('quality-check')
    expect(routeWorkflowToolCall('get_task_status', {}, '自动完成支护质量检查').routed).toBe(false)
    expect(routeWorkflowToolCall('orchestrate_platform_task', { kind: 'scene-exploration' }, '自主展示').name).toBe('prepare_platform_task')
  })
})
