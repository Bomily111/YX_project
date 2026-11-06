export const transientScenarioCatalog = [
  { id: 'ventilation.transient-fan-oscillation', file: 'transient_fan_oscillation.json', label: '右线风机波动' },
  { id: 'ventilation.transient-damper-close', file: 'transient_damper_close.json', label: '关闭 K2+300 横通道' },
  { id: 'ventilation.transient-fan-shutdown', file: 'transient_fan_shutdown.json', label: '右线风机故障停机' },
  { id: 'ventilation.transient-combined', file: 'transient_combined.json', label: '组合瞬态工况' },
] as const
