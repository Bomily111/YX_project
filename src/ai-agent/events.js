// ── AI Agent 与各子模块之间的事件总线 ────────────────────
// 子模块通过监听 aiEvents 响应 Agent 的操作指令
// AI Agent 不直接 import 子模块代码
import mitt from 'mitt';
export const aiEvents = mitt();
