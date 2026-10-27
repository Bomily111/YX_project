import { describe, expect, it } from 'vitest'
import { buildSystemPrompt } from '@/ai-agent/knowledge/prompts/system'

describe('scene agent prompt contract', () => {
  const prompt = buildSystemPrompt()

  it('routes ordinary assembly through one validated platform entry', () => {
    expect(prompt).toContain('只调用一次 assemble_scene_at_mileage')
    expect(prompt).toContain('assembledResourceIds')
    expect(prompt).toContain('先问一个澄清问题')
    expect(prompt).toContain('用户可能只描述施工任务')
    expect(prompt).toContain('超前地质预报交底')
    expect(prompt).toContain('不要宣称已完成“整体场景构建后再增强”')
  })

  it('preserves all essential rock interpretations and demonstration provenance', () => {
    for (const id of ['rock.design-grade', 'rock.geophysical-grade', 'rock.tsp-hardness',
      'rock.tsp-integrity', 'rock.tem-resistivity', 'support.legacy-assembly']) {
      expect(prompt).toContain(id)
    }
    expect(prompt).toContain('示意重定位')
    expect(prompt).toContain('不能称为目标工点实测')
    expect(prompt).not.toContain('场景同屏装配只允许平台已验证同址')
    expect(prompt).not.toContain('应一次提交 YK1+116～YK1+183 范围内')
  })
})
