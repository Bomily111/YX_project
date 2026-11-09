import { expect, it } from 'vitest'
import { wantsTaskViewControl, wantsDirectSceneAssembly, wantsTaskCutControl } from '@/ai-agent/AgentDispatchIntent'
it.each(['关闭剖切，恢复完整解释体', '开启解释体剖切', '取消剖切，恢复完整体数据'])('keeps cut control within the current task: %s', message => {
  expect(wantsTaskCutControl(message)).toBe(true)
  expect(wantsDirectSceneAssembly(message)).toBe(false)
})
it.each(['拉近掌子面，查看近景', '聚焦支护近景', '聚焦水平钻布置', '切换到整体布置视角'])('keeps %s within the existing assembly', message => {
  expect(wantsTaskViewControl(message)).toBe(true)
  expect(wantsDirectSceneAssembly(message)).toBe(false)
})
it.each(['YK2+244装配掌子面近景', '如何聚焦支护', '先给整体布置计划'])('does not treat %s as a camera command', message => {
  expect(wantsTaskViewControl(message)).toBe(false)
})
