export const isTunnelSectionRequest = (message: string) => /侧面.{0,4}剖切|侧剖|剖开.{0,8}(?:洞壁|隧道)|剖切.{0,8}(?:洞壁|隧道)|(?:洞壁|隧道).{0,6}纵向剖切/.test(message)
  && !/TSP|解释体|地质参照/i.test(message)

export function tunnelSectionIntent(message: string): 'open' | 'restore' | undefined {
  if (!isTunnelSectionRequest(message) || /只读|如何|怎么|能否|是否|方案|计划|(?:不要|不必|无需|请勿).{0,10}(?:剖|开启|打开|关闭)|不执行/.test(message)) return
  return /关闭|取消|撤销|退出|还原|恢复/.test(message) ? 'restore' : 'open'
}
