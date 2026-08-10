// ── 基础系统提示词 ───────────────────────────────────────

import type { AgentContext } from '../../types'
import { searchBlastKb, type KbChunk } from '../blast'

const BASE_SYSTEM_PROMPT = `你是"隧道施工数字孪生平台"的智能助手，专注于辅助隧道钻爆法施工管理。

## 你的能力
- 控制三维地球相机飞向指定里程位置
- 加载/切换地质模型（围岩、TSP、TEM、富水带、破碎带、掌子面素描）
- 打开各施工场景面板（爆破指挥台、支护场景、通风监测、调度中心）
- 查询掌子面参数、风险预警、施工进度
- 解读地质报告、TSP 结论、围岩分级依据
- 回答隧道施工领域的专业问题

## 回答要求
- 使用中文，简洁专业
- 执行操作前先简要说明你要做什么，然后调用工具
- 分析问题时结合数据给出具体建议
- 涉及风险时务必明确提示

## 隧道施工背景
- 本平台服务于成都西站至林芝段铁路隧道施工（钻爆法）
- 隧道群包含多段，里程范围约 DK278+000 ~ DK300+800
- 施工采用三台阶法，光面爆破开挖
- 围岩等级以 IV 级为主，部分 III 级和 V 级`

/**
 * 构建完整的 system prompt（基础 + 领域知识 + RAG 上下文）
 */
/**
 * 从知识库检索与用户问题相关的内容
 */
function searchKnowledge(query: string, scene?: string): KbChunk[] {
  if (scene === 'blast') {
    return searchBlastKb(query, 3)
  }
  // 后续其他模块的知识库在此扩展
  return []
}

export function buildSystemPrompt(context?: AgentContext, userQuery?: string): string {
  let prompt = BASE_SYSTEM_PROMPT

  if (context?.scene) {
    const sceneNames: Record<string, string> = {
      blast: '开挖爆破',
      support: '围岩支护',
      vent: '通风除尘',
      dispatch: '装备调度',
      rock: '隧道围岩',
    }
    prompt += `\n\n当前场景：${sceneNames[context.scene] || context.scene}`
  }

  if (context?.worksiteId) {
    prompt += `\n当前工点：${context.worksiteId}`
  }

  if (context?.dkNumber) {
    prompt += `\n当前里程：${context.dkNumber}`
  }

  // 注入 RAG 检索到的知识片段
  if (userQuery) {
    const ragResults = searchKnowledge(userQuery, context?.scene)
    if (ragResults.length > 0) {
      prompt += '\n\n## 参考知识库\n以下是从知识库中检索到的与当前问题相关的信息，请参考回答：\n\n'
      for (let i = 0; i < ragResults.length; i++) {
        prompt += `--- [${ragResults[i].title}] ---\n${ragResults[i].content}\n\n`
      }
    }
  }

  return prompt
}
