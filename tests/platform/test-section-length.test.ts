import { expect, it } from 'vitest'
import { supportOffsets, resolveTestSupportLength } from '@/modules/support/test-section-layout'
import { validateTaskContext } from '@/platform/context/TaskContext'
it('plans exact counts behind the lower face without stretching source units', () => {
  expect(supportOffsets(5)).toEqual([-5.5,-4.5,-3.5,-2.5,-1.5])
  expect(supportOffsets(20)).toHaveLength(20)
  expect(supportOffsets(20)[0]).toBe(-20.5)
})
it.each([
  ['测试工段展示后方5米ZZ-IVb支护',5],
  ['展示后方20m Z-PM支护，使用1米单元',20],
  ['使用10个已有1米单元',10],
  ['展示ZZ-II支护模型',10],
  ['后方五米支护',5],
  ['后方二十米支护',20],
  ['五个一米单元',5],
])('reads protected user length %s', (request,length) => expect(resolveTestSupportLength(request)).toBe(length))
it.each(['后方2.5米支护','后方21米支护','后方-5米支护','后方0米支护','5米支护和20米支护','20米支护用10个1米单元','二十一米支护','二点五米支护','半米支护'])('rejects unsupported or ambiguous lengths %s', request => expect(() => resolveTestSupportLength(request)).toThrow())
it('validates persisted task length before scene preparation', () => {
  const task = { taskId:'test', taskType:'scene-exploration' as const, description:'test', tunnelId:'test', chainageRange:{start:2244,end:2244}, targetTypes:['scene'], supportLengthM:20 }
  expect(validateTaskContext(task).valid).toBe(true)
  expect(validateTaskContext({...task,supportLengthM:21}).issues.some(issue=>issue.path==='supportLengthM')).toBe(true)
})
