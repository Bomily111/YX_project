import { describe, expect, it } from 'vitest'
import { planAlternatingSupportSections } from '@/modules/support/alternating-layout'
import { tunnelSegmentSpanAt, supportAssemblySpanAt, ALTERNATING_SUPPORT_ID } from '@/modules/support/alternating-resource'
import { AGENT_SCENE_RESOURCES, resolveAssemblyStages } from '@/platform/tasks/samples/SceneExplorationWorkflow'
import type { SceneResource } from '@/platform/resources/types'

describe('alternating 1 m support sections', () => {
  it('places local 0..1 m sections at contiguous YK chainages', () => {
    const placements = planAlternatingSupportSections(1346, 6, ['ZZ-Va', 'Z-PM'])
    expect(placements.map(item => [item.supportType, item.chainage, item.endChainage])).toEqual([
      ['ZZ-Va', 1346, 1347], ['Z-PM', 1347, 1348],
      ['ZZ-Va', 1348, 1349], ['Z-PM', 1349, 1350],
      ['ZZ-Va', 1350, 1351], ['Z-PM', 1351, 1352],
    ])
  })
  it('rejects fractional lengths and repeated section types', () => {
    expect(() => planAlternatingSupportSections(1346, 2.5, ['ZZ-Va', 'Z-PM'])).toThrow()
    expect(() => planAlternatingSupportSections(1346, 2, ['ZZ-Va', 'ZZ-Va'])).toThrow()
    expect(() => planAlternatingSupportSections(1346, 51, ['ZZ-Va', 'Z-PM'])).toThrow()
  })
  it('keeps the 50 m assembly around the target inside its tunnel segment', () => {
    expect(tunnelSegmentSpanAt(1346)).toEqual({ index: 0, start: 1116, end: 1616 })
    expect(tunnelSegmentSpanAt(1700)).toEqual({ index: 1, start: 1616, end: 2116 })
    expect(supportAssemblySpanAt(1346)).toEqual({ index: 0, start: 1321, end: 1371 })
    expect(supportAssemblySpanAt(1116)).toEqual({ index: 0, start: 1116, end: 1166 })
    expect(supportAssemblySpanAt(1615)).toEqual({ index: 0, start: 1566, end: 1616 })
    expect(supportAssemblySpanAt(9350)).toEqual({ index: 16, start: 9325, end: 9375 })
    expect(planAlternatingSupportSections(1321, 50, ['ZZ-Va', 'Z-PM'])).toHaveLength(50)
  })
  it('is selectable by the agent and can follow one rock layer', () => {
    expect(AGENT_SCENE_RESOURCES).toContain(ALTERNATING_SUPPORT_ID)
    const rock = { id: 'rock.tsp-hardness' } as SceneResource
    const support = { id: ALTERNATING_SUPPORT_ID } as SceneResource
    expect(resolveAssemblyStages([rock, support], ['replace', 'retain'])).toEqual([[rock], [rock, support]])
  })
})
