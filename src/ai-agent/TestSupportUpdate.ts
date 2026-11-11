import type { AgentTaskWorkflowStatus } from '@/platform/tasks/TaskWorkflowBridge'
import { testSupportCatalog, isTestSupportId } from '@/modules/support/test-section-resource'
import { resolveTestSupportLength, supportOffsets } from '@/modules/support/test-section-layout'

/** Resolve against the live completed workflow, never a previous chat answer. */
export function resolveTestSupportUpdate(message: string, status: AgentTaskWorkflowStatus) {
  const stage = status.lastCompletedStage
  if (!status.prepared || status.status !== 'completed' || !status.taskId || !stage || stage.phase !== 'constructed-then-enhanced') throw new Error('当前没有已完成的测试支护任务，请先装配测试工段支护')
  const selected = stage.assembledResourceIds.filter(isTestSupportId)
  if (selected.length !== 1 || stage.chainageRange.start !== 2244 || !stage.assembledResourceIds.every(id => isTestSupportId(id) || id === 'rock.three-bench')) throw new Error('当前任务不是可承接的测试工段支护组合')
  if (/高度|厚度|直径|间距|几何|截面参数/.test(message)) throw new Error('后续调整仅支持已有模型类型和名义长度，不修改原始构件参数')
  const oldAsset = testSupportCatalog.find(asset => asset.id === selected[0])!
  const matches = [...message.matchAll(/\b(?:ZZ-[A-Za-z0-9]+|Z-PM[A-Za-z0-9]*)(?![A-Za-z0-9])/gi)].map(match=>match[0].toLowerCase())
  const types = [...new Set(matches)]
  if (types.length > 1) throw new Error('请明确本次要改成哪一种支护类型')
  const asset = types.length ? testSupportCatalog.find(asset=>asset.type.toLowerCase()===types[0]) : oldAsset
  if (!asset) throw new Error('所指定的支护类型不在已有14种模型目录内')
  const hasLength = /(?:\d|[零一二两三四五六七八九十百千万点半])\s*(?:米|m\b)/i.test(message)
  if (/长度/.test(message) && !hasLength) throw new Error('请明确支护长度及单位，例如长度改为15米')
  if (!types.length && !hasLength) throw new Error('请明确要修改的支护类型或长度')
  const previousLength = stage.supportLengthM ?? 10
  supportOffsets(previousLength)
  const length = hasLength ? resolveTestSupportLength(message) : previousLength
  const ids = stage.assembledResourceIds.map(id => isTestSupportId(id) ? asset.id : id)
  const request = `在论文测试工段YK2+244展示${ids.includes('rock.three-bench') ? '三台阶与后方' : '后方'}${length}米${asset.type}支护，直接调用已有原始模型。`
  return { request, resourceIds: ids, supportLengthM: length, previousLengthM: previousLength, previousType: oldAsset.type, supportType: asset.type, parentTaskId: status.taskId }
}
