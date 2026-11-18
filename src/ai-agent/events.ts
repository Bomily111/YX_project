// ── AI Agent 与各子模块之间的事件总线 ────────────────────
// 子模块通过监听 aiEvents 响应 Agent 的操作指令
// AI Agent 不直接 import 子模块代码

import mitt from 'mitt'
import type {AgentTaskWorkflowStatus} from '@/platform/tasks/TaskWorkflowBridge'

export const aiEvents = mitt<{
  'blast:adjust-view': string    // persp | front | side | top
  'blast:toggle-diagram': boolean
  'support:show-model': string
  'vent:show-wind-field': boolean
  'dispatch:show-gantt': boolean
  'scene:open': string           // scene key
  'task:open': undefined         // 打开统一任务流程面板
  'task:workflow-status': AgentTaskWorkflowStatus
  'camera:fly-to': { lng: number; lat: number; height: number }
}>()
