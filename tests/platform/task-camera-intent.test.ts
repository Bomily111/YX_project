import { expect, it } from 'vitest'
import { wantsTaskViewControl, wantsDirectSceneAssembly, wantsTaskCutControl } from '@/ai-agent/AgentDispatchIntent'
it.each(['切换到当前任务的中线与地形视角','查看当前任务的地理位置'])('routes current geographic view without reassembly: %s',message=>{
 expect(wantsTaskViewControl(message)).toBe(true)
 expect(wantsDirectSceneAssembly(message)).toBe(false)
})
it.each(['只读查询当前任务的地理位置，不切换视角','不要切换中线与地形视角','如何查看地理位置'])('does not execute geographic queries: %s',message=>{
 expect(wantsTaskViewControl(message)).toBe(false)
})
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
