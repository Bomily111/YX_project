import { expect, it } from 'vitest'
import { canRetrySceneLoad } from '@/ai-agent/SceneRecovery'
const state = { available: true, prepared: true, taskId: 'failed-task', status: 'failed', completed: 0,
  total: 1, steps: [], contextKeys: [], scenePlans: [], notice: { type: 'error', title: '失败', message: '爆破设计加载失败：HTTP 503' } }
it('only permits transient first-stage load failures', () => {
  expect(canRetrySceneLoad(state)).toBe(true)
  for (const message of ['HTTP 404', '目标里程不在范围', '不允许同屏装配', 'HTTP 503；回滚失败']) {
    expect(canRetrySceneLoad({ ...state, notice: { ...state.notice, message } })).toBe(false)
  }
  expect(canRetrySceneLoad({ ...state, completed: 1 })).toBe(false)
  expect(canRetrySceneLoad({ ...state, status: 'completed' })).toBe(false)
})
