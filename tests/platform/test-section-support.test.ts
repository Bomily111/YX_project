import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolveAssemblyStages } from '@/platform/tasks/samples/SceneExplorationWorkflow'
import { threeBenchResource } from '@/modules/rock/three-bench-resource'
import { testSectionSupportResource, testSectionSupportResources, testSupportCatalog, validateTestSupportRequest, existingSupportOffsets, existingSupportPlacement, TEST_SUPPORT_PATH } from '@/modules/support/test-section-resource'
import { modelerSupportResources } from '@/modules/support/modeler-resources'
import * as C from 'cesium'
import { resolveClarifiedSceneRequest } from '@/ai-agent/AgentDispatchIntent'
it('exposes all 14 existing sources including Z-PM and permits a paired task', () => {
  expect(testSupportCatalog).toHaveLength(14)
  expect(new Set(testSupportCatalog.map(asset => asset.id)).size).toBe(14)
  for (const asset of testSupportCatalog) {
    expect(readFileSync(`public${asset.path}`).subarray(0,4).toString()).toBe('glTF')
    expect(() => validateTestSupportRequest([asset.id],`展示测试工段三台阶和${asset.type}支护`)).not.toThrow()
    const resource = testSectionSupportResources.find(resource => resource.id === asset.id)!
    expect(resolveAssemblyStages([threeBenchResource,resource],['replace','retain']).at(-1)).toHaveLength(2)
  }
})
it('uses the Z-PM design elevation without scaling or modifying the source geometry', () => {
  const asset = testSupportCatalog.find(asset => asset.type === 'Z-PM')!
  expect(asset.designElevationY).toBe(0)
  expect(asset.path).toContain('Z-PM_support_1m_partial.glb')
  const zpm = existingSupportPlacement(-5.5,asset.designElevationY)
  const zz = existingSupportPlacement(-5.5,-2.1)
  const point = new C.Cartesian3(0,0,0)
  const a = C.Matrix4.multiplyByPoint(zpm,point,new C.Cartesian3())
  const b = C.Matrix4.multiplyByPoint(zz,new C.Cartesian3(0,-2.1,0),new C.Cartesian3())
  expect(C.Cartesian3.distance(a,b)).toBeLessThan(1e-8)
  expect(() => validateTestSupportRequest([asset.id],'测试工段用Z-PM')).not.toThrow()
  expect(() => validateTestSupportRequest([asset.id],'测试工段用Z-PMx')).toThrow()
})
it('rejects missing, mismatched, multiple and suffix-confused support types', () => {
  const iii = testSupportCatalog.find(asset => asset.type === 'ZZ-III')!
  for (const request of ['展示三台阶和支护','支护用ZZ-IVb','支护用ZZ-IIIx','支护用ZZ-III和ZZ-II']) {
    expect(() => validateTestSupportRequest([iii.id],request)).toThrow()
  }
  expect(() => validateTestSupportRequest(testSupportCatalog.slice(0,2).map(asset => asset.id),'ZZ-II')).toThrow('一种')
})
it('retains the pending test-section goal when the user supplies the type', () => {
  const request = resolveClarifiedSceneRequest('支护类型用ZZ-IVb','在论文测试工段展示三台阶与后方支护')
  expect(request).toContain('测试工段')
  expect(request).toContain('ZZ-IVb')
})
it('retains the same-source excavation/support pair in either order', () => {
  for (const resources of [[threeBenchResource,testSectionSupportResource],[testSectionSupportResource,threeBenchResource]]) {
    expect(resolveAssemblyStages(resources,['auto','auto']).at(-1)).toHaveLength(2)
  }
})
it('rejects substituting an unrelated support section into the paired scene', () => {
  expect(() => resolveAssemblyStages([threeBenchResource,modelerSupportResources[0]],['replace','retain'])).toThrow('不允许同屏')
})
it('directly uses the original GLB with ten rigid placements and no scale or deformation', () => {
  expect(TEST_SUPPORT_PATH).toBe('/support-modeler/outputs/master_demo/ZZ-Va_support_1m_current.glb')
  expect(readFileSync(`public${TEST_SUPPORT_PATH}`).subarray(0,4).toString()).toBe('glTF')
  expect(existingSupportOffsets).toHaveLength(10)
  for (const offset of existingSupportOffsets) {
    const matrix=existingSupportPlacement(offset)
    const scale=C.Matrix4.getScale(matrix,new C.Cartesian3())
    for (const value of [scale.x,scale.y,scale.z]) expect(value).toBeCloseTo(1,12)
    const anchor=C.Matrix4.multiplyByPoint(matrix,new C.Cartesian3(0,0,1.226046),new C.Cartesian3())
    expect(-anchor.z).toBeLessThan(0)
  }
})
