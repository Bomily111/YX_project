import { describe, expect, it } from 'vitest'
import { buildSystemPrompt } from '@/ai-agent/knowledge/prompts/system'

describe('scene agent prompt contract', () => {
  const prompt = buildSystemPrompt()
  it('derives minimum resources from business needs without inventing worksite data', () => {
    expect(prompt).toContain('业务目标→资料需求→必要资源→展示方式')
    expect(prompt).toContain('不默认ZZ-Va、掌子面或TSP属性')
    expect(prompt).toContain('不能把“平台有某模型”当作“目标工段有该资料”')
  })
  it('treats the single face model as conditional on photo needs rather than a default task dependency', () => {
    expect(prompt).toContain('仅当任务需求需要掌子面照片时才选择 rock.face-photos')
    expect(prompt).toContain('不是每个任务都要装配掌子面模型')
    expect(prompt).toContain('单张限制只适用于已选中该资源的任务')
    expect(prompt).toContain('不默认增加rock.face-photos')
  })
  it('distinguishes design, post-blast scan, airflow and CO goals', () => {
    for (const id of ['blast.design-data', 'blast.effect', 'ventilation.steady-cfd', 'ventilation.co-analysis']) expect(prompt).toContain(id)
    expect(prompt).toContain('明确排除的资源不得添加')
    expect(prompt).not.toContain('关注“既有支护布置”可选结构树支护')
  })

  it('routes ordinary assembly through one validated platform entry', () => {
    expect(prompt).toContain('只调用一次 assemble_scene_at_mileage')
    expect(prompt).toContain('assembledResourceIds')
    expect(prompt).toContain('先问一个澄清问题')
    expect(prompt).toContain('用户可能只描述施工任务')
    expect(prompt).toContain('超前地质预报交底')
    expect(prompt).toContain('构建完成后统一增强')
  })

  it('preserves all essential rock interpretations and demonstration provenance', () => {
    for (const id of ['rock.design-grade', 'rock.geophysical-grade', 'rock.tsp-hardness',
      'rock.tsp-integrity', 'rock.tem-resistivity', 'support.modeler-zz-va']) {
      expect(prompt).toContain(id)
    }
    expect(prompt).toContain('示意重定位')
    expect(prompt).toContain('不能称为目标工点实测')
    expect(prompt).not.toContain('support.legacy-assembly')
    expect(prompt).not.toContain('场景同屏装配只允许平台已验证同址')
    expect(prompt).not.toContain('应一次提交 YK1+116～YK1+183 范围内')
  })
})
