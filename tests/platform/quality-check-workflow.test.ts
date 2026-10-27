import { describe, expect, it, vi } from 'vitest'
import type { TaskContext } from '@/platform/context/TaskContext'
import { ResourceRegistry } from '@/platform/resources/ResourceRegistry'
import { ResourceManager } from '@/platform/resources/ResourceManager'
import type { SceneResource } from '@/platform/resources/types'
import { ResourceSelector } from '@/platform/selection/ResourceSelector'
import { ScenePlanExecutor } from '@/platform/selection/ScenePlanExecutor'
import { EnhancementPlanner } from '@/platform/enhancement/EnhancementPlanner'
import { EnhancementEngine } from '@/platform/enhancement/EnhancementEngine'
import {
  RockAssessmentService,
  type RockAssessmentDataSource,
} from '@/platform/tasks/actions/RockAssessmentAction'
import {
  SupportAssessmentService,
  type SupportAssessmentDataSource,
  type SupportComponentRecord,
} from '@/platform/tasks/actions/SupportAssessmentAction'
import { createQualityCheckExecutor } from '@/platform/tasks/samples/QualityCheckWorkflow'
import { FACE_SKETCH_RECORDS } from '@/modules/face-sketch/data'

const rockSource = (
  segments: Awaited<ReturnType<RockAssessmentDataSource['loadDesignSegments']>> = [],
  faces: Awaited<ReturnType<RockAssessmentDataSource['loadFaceRecords']>> = [],
): RockAssessmentDataSource => ({
  loadDesignSegments: async () => segments,
  loadFaceRecords: async () => faces,
})

const supportSource = (records: readonly SupportComponentRecord[]): SupportAssessmentDataSource => ({
  list: async () => records,
})

const component = (
  id: string,
  componentType: string,
  overrides: Partial<SupportComponentRecord> = {},
): SupportComponentRecord => ({
  id,
  componentType,
  startChainage: 1336,
  endChainage: 1366,
  completionPercent: 100,
  qualityGrade: '合格',
  designValue: 100,
  measuredMean: 100,
  measuredMin: 95,
  ...overrides,
})

describe('RockAssessmentService', () => {
  it('matches the platform YK design range', async () => {
    const service = new RockAssessmentService(rockSource([
      { startMileage: 'YK1+116', endMileage: 'YK1+616', grade: 'V' },
    ]))

    const result = await service.assess({ start: 1346, end: 1366 })

    expect(result).toEqual(expect.objectContaining({
      grade: 'V',
      confidence: 0.75,
      anomalies: ['V级软弱围岩风险'],
    }))
    expect(result.evidence[0]).toContain('YK1+116–YK1+616')
  })

  it('does not treat independent X1DK face observations as YK evidence', async () => {
    const service = new RockAssessmentService(rockSource([
      { startMileage: 'YK2+616', endMileage: 'YK3+116', grade: 'III' },
    ], FACE_SKETCH_RECORDS.slice(0, 2)))

    const result = await service.assess({ start: 2880, end: 2890 })

    expect(result.grade).toBe('III')
    expect(result.confidence).toBe(0.75)
    expect(result.evidence).toEqual(['设计分级 YK2+616–YK3+116: III'])
    expect(result.anomalies).toEqual([])
  })

  it('uses explicitly YK-labeled face observations as higher-confidence evidence', async () => {
    const faces = FACE_SKETCH_RECORDS.slice(0, 2).map((face, index) => ({
      ...face,
      mileage: `YK2+${880 + index * 5}`,
    }))
    const service = new RockAssessmentService(rockSource([], faces))

    const result = await service.assess({ start: 2880, end: 2890 })

    expect(result.grade).toBe('IV')
    expect(result.confidence).toBe(0.92)
    expect(result.anomalies).toEqual(expect.arrayContaining([
      '围岩局部破碎',
      '掌子面出水风险',
      '掌子面松弛掉块风险',
    ]))
  })

  it('returns an explicit unknown result instead of fabricating evidence', async () => {
    const result = await new RockAssessmentService(rockSource()).assess({ start: 50, end: 60 })
    expect(result).toEqual({
      grade: 'unknown',
      anomalies: ['任务里程范围内没有可用的围岩分级证据'],
      confidence: 0,
      evidence: [],
    })
  })
})

describe('SupportAssessmentService', () => {
  it('passes complete and qualified support records required by IV/V rock', async () => {
    const service = new SupportAssessmentService(supportSource([
      component('shotcrete', '喷射混凝土'),
      component('bolt', '系统锚杆'),
      component('arch', '钢拱架'),
    ]))

    const result = await service.assess('main', { start: 1346, end: 1356 }, 'IV')

    expect(result.assessment).toBe('pass')
    expect(result.deviations).toEqual([])
    expect(result.summary).toContain('记录完整')
  })

  it('reports missing components, incomplete work and deficient measurements', async () => {
    const service = new SupportAssessmentService(supportSource([
      component('shotcrete', 'shotcrete', { completionPercent: 70, measuredMin: 80 }),
      component('bolt', 'bolt'),
    ]))

    const result = await service.assess('main', { start: 1346, end: 1356 }, 'V')

    expect(result.assessment).toBe('fail')
    expect(result.deviations.map(({ rule }) => rule)).toEqual(expect.arrayContaining([
      'missing-component',
      'incomplete',
      'measured-value',
    ]))
  })

  it('reports insufficient data without claiming pass or fail', async () => {
    const result = await new SupportAssessmentService(supportSource([]))
      .assess('main', { start: 1346, end: 1356 }, 'IV')
    expect(result.assessment).toBe('insufficient-data')
    expect(result.summary).toContain('无法判断')
  })
})

describe('quality-check workflow sample', () => {
  it('connects rock evidence, support records, scene resources and enhancement', async () => {
    const rockModel = {
      show: false,
      silhouetteColor: { red: 1, green: 1, blue: 1, alpha: 1 },
      silhouetteSize: 0,
    }
    const model = {
      show: false,
      silhouetteColor: { red: 1, green: 1, blue: 1, alpha: 1 },
      silhouetteSize: 0,
    }
    const load = vi.fn(async () => undefined)
    const unload = vi.fn(async () => undefined)
    const rockLoad = vi.fn(async () => undefined)
    const rockUnload = vi.fn(async () => undefined)
    const rockResource: SceneResource = {
      id: 'rock.design-grade',
      module: 'rock',
      type: 'design-rock-grade',
      chainageRange: { start: 1116, end: 1616 },
      processes: ['support-design'],
      states: ['installed'],
      estimatedMemoryMb: 1,
      load: rockLoad,
      unload: rockUnload,
      getEnhanceTargets: () => [{ id: 'rock.segment', type: 'rock-segment', object: rockModel as any }],
    }
    const supportResource: SceneResource = {
      id: 'support.scene',
      module: 'support',
      type: 'initial-support',
      chainageRange: { start: 1116, end: 1616 },
      processes: ['support-design'],
      states: ['installed'],
      estimatedMemoryMb: 2,
      load,
      unload,
      getEnhanceTargets: () => [{ id: 'support.model', type: 'steel-arch', object: model as any }],
    }
    const registry = new ResourceRegistry()
    registry.registerAll([rockResource, supportResource])
    const manager = new ResourceManager(registry)
    const sceneExecutor = new ScenePlanExecutor(registry, manager)
    const selector = new ResourceSelector(registry)
    const enhancementPlanner = new EnhancementPlanner(registry)
    const enhancementEngine = new EnhancementEngine(registry)
    const task: TaskContext = {
      taskId: 'quality-real-001',
      taskType: 'quality-check',
      description: '检查 YK1+346 至 YK1+356 围岩变化后初期支护是否合理',
      tunnelId: 'main',
      chainageRange: { start: 1346, end: 1356 },
      process: 'support-design',
      targetTypes: ['initial-support'],
      targetState: 'installed',
    }
    const executor = createQualityCheckExecutor(task, {
      rockService: new RockAssessmentService(rockSource([
        { startMileage: 'YK1+116', endMileage: 'YK1+616', grade: 'V' },
      ])),
      supportService: new SupportAssessmentService(supportSource([
        component('shotcrete', '喷射混凝土'),
        component('bolt', '锚杆'),
        component('arch', '钢架'),
      ])),
      rockScene: {
        selector,
        executor: sceneExecutor,
        loadContext: { viewer: {} as any },
        selectorOptions: () => ({ candidateResourceIds: ['rock.design-grade'] }),
        enhancement: { planner: enhancementPlanner, engine: enhancementEngine },
      },
      supportScene: {
        selector,
        executor: sceneExecutor,
        loadContext: { viewer: {} as any },
        selectorOptions: () => ({ candidateResourceIds: ['support.scene'] }),
        enhancement: { planner: enhancementPlanner, engine: enhancementEngine },
      },
    })

    const results = await executor.run()

    expect(results.map(({ status }) => status)).toEqual(['completed', 'completed'])
    expect(executor.plan.sharedContext['rock.grade']?.value).toBe('V')
    expect(executor.plan.sharedContext['support.assessment']?.value).toBe('pass')
    expect(executor.plan.sharedContext['task.summary']?.value).toContain('V级围岩')
    expect(rockLoad).toHaveBeenCalledOnce()
    expect(rockUnload).toHaveBeenCalledOnce()
    expect(rockModel.show).toBe(false)
    expect(rockModel.silhouetteSize).toBe(0)
    expect(load).toHaveBeenCalledOnce()
    expect(model.show).toBe(true)
    expect(model.silhouetteSize).toBe(3)

    await executor.reset()
    expect(unload).toHaveBeenCalledOnce()
    expect(model.show).toBe(false)
    expect(model.silhouetteSize).toBe(0)
    expect(executor.plan.sharedContext).toEqual({})
  })
})
