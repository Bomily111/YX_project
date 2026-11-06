import { expect, it } from 'vitest'
import { requestedThermalTimes, thermalRequestIssue } from '@/modules/ventilation/thermal-catalog'
it('converts explicit minutes without rounding unsupported slice times', () => {
  expect(requestedThermalTimes('YK4+000 查看热场10分钟')).toEqual([600])
  expect(requestedThermalTimes('温度场 t=200s')).toEqual([200])
  expect(thermalRequestIssue('温度场模拟250秒')).toContain('没有模拟 250 秒')
  expect(thermalRequestIssue('温度场2.5分钟')).toContain('150')
  expect(thermalRequestIssue('温度场200秒')).toBeUndefined()
  expect(thermalRequestIssue('200秒时的风量曲线')).toBeUndefined()
})
