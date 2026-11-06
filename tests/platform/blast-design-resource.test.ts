import { readFileSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import { blastDesignResource, getBlastDesignSummary, validateBlastDesign } from '@/modules/blast/design-resource'
const source = JSON.parse(readFileSync('public/data/blast/blast-design.json', 'utf8'))
afterEach(async () => { await blastDesignResource.unload(); vi.unstubAllGlobals() })
it('loads actual design parameters and releases their provenance', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => source })))
  await blastDesignResource.load({ viewer: {} as any })
  expect(getBlastDesignSummary()).toMatchObject({ holeCount: 185, advanceM: 2.2,
    sectionSpec: { crownHeightM: 8.877 }, categories: { perimeter: { count: 49 }, cut: { count: 11 } } })
  expect(blastDesignResource.getActiveAssetPaths!()).toEqual(['/data/blast/blast-design.json'])
  await blastDesignResource.unload()
  expect(getBlastDesignSummary()).toBeUndefined()
  expect(blastDesignResource.getActiveAssetPaths!()).toEqual([])
})
it('rejects inconsistent hole counts and invalid geometry', () => {
  const invalid = structuredClone(source)
  invalid.holes.pop()
  expect(() => validateBlastDesign(invalid)).toThrow('数量不一致')
  const badPoint = structuredClone(source)
  badPoint.holes[0].collar[0] = NaN
  expect(() => validateBlastDesign(badPoint)).toThrow()
})
