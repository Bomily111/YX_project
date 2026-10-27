import { describe, expect, it } from 'vitest'
import { chainageService } from '@/platform/coordinates/ChainageService'

describe('任务里程统一为真实 YK 中线', () => {
  it('只在入口将旧 DK 标签转换成对应 YK，中线位置一致', () => {
    expect(chainageService.toCanonicalChainage('YK2+244')).toBe(2244)
    expect(chainageService.toCanonicalChainage('DK279+228')).toBe(2244)
    expect(chainageService.toCanonicalChainage('DK278+330')).toBe(1346)
    expect(chainageService.format(chainageService.toCanonicalChainage('DK278+330'))).toBe('YK1+346')
    expect(chainageService.positionAt(2244)).toEqual(chainageService.positionAt(279228, chainageService.legacyDkReference))
    expect(() => chainageService.toCanonicalChainage('K3+905.151')).toThrow('YK')
  })
})
