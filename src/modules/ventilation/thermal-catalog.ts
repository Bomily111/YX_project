export const thermalSnapshotCatalog = [0, 100, 200, 300, 400, 600, 800, 1000].map(time => ({
  id: `ventilation.thermal-t${time}s`, time, file: `cfd_transient_t${time}s.json`, label: `近似热场 · t=${time}s`,
}))

export function requestedThermalTimes(message: string): number[] {
  return [...new Set([...message.matchAll(/(\d+(?:\.\d+)?)\s*(分钟|min(?:utes?)?|秒|s(?:ec(?:onds?)?)?)/gi)].map(match =>
    Number(match[1]) * (/分钟|min/i.test(match[2]) ? 60 : 1)))]
}

export function thermalRequestIssue(message: string): string | undefined {
  if (!/热场|温度场|温度分布/.test(message)) return
  const missing = requestedThermalTimes(message).filter(time => !thermalSnapshotCatalog.some(snapshot => snapshot.time === time))
  if (missing.length) return `当前没有模拟 ${missing.join('、')} 秒的热场时间片。现有时间为 ${thermalSnapshotCatalog.map(snapshot => snapshot.time).join('、')} 秒，请指定一个现有时间；平台不会自动取最近值。`
}
