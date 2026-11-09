import { expect, it } from 'vitest'
import { planContinuousSupport } from '@/modules/support/continuous-layout'
import * as T from 'three'
import { partitionSectionCaps } from '@/modules/support/continuous-resource'
it('separates boundary caps from side walls so only the two outer caps are retained', () => {
  const geometry = new T.BoxGeometry(2, 2, 1).translate(0, 0, .5)
  const [body, start, end] = partitionSectionCaps(geometry)
  expect(body.length).toBe(24)
  expect(start.length).toBe(6)
  expect(end.length).toBe(6)
  expect(body.length + start.length + end.length).toBe(geometry.index!.count)
})
it('plans one type over an exact requested interval without a centered or alternating default', () => {
  const plan = planContinuousSupport(2244, 20)
  expect(plan.end).toBe(2264)
  expect(plan.units).toHaveLength(20)
  expect(plan.units[0]).toBe(2244)
  expect(plan.units.at(-1)).toBe(2263)
})
it.each([[9400,20],[2606,20],[2244,25],[NaN,20]])('rejects an unsupported interval %s %s', (start,length) => {
  expect(() => planContinuousSupport(start,length)).toThrow()
})
