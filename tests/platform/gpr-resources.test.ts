import { readFileSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import { gprResources, gprCatalog, getActiveGprSection, validateGprSection } from '@/modules/rock/gpr-resources'
afterEach(async () => { await Promise.all(gprResources.map(resource => resource.unload())); vi.unstubAllGlobals() })
it('loads the delivered lines independently and records the correct files', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => JSON.parse(readFileSync(`public${url}`, 'utf8')) })))
  for (const resource of gprResources) await resource.load({ viewer: {} as any })
  for (const item of gprCatalog) {
    const data = getActiveGprSection(item.id)!
    expect(data.data.length).toBe(data.ds_shape[0] * data.ds_shape[1])
    expect(gprResources.find(resource => resource.id === item.id)!.getActiveAssetPaths!()).toEqual([item.path])
  }
  await gprResources[0].unload()
  expect(getActiveGprSection(gprResources[0].id)).toBeUndefined()
  expect(getActiveGprSection(gprResources[1].id)).toBeDefined()
})
it('rejects malformed amplitude grids', () => {
  const document = JSON.parse(readFileSync(`public${gprCatalog[0].path}`, 'utf8')).line1
  document.data.pop()
  expect(() => validateGprSection(document)).toThrow()
})
