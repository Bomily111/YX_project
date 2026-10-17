import type * as Cesium from 'cesium'
import { Color, Model } from 'cesium'

export type LegacySupportKind = 'rebar' | 'lining_rebar' | 'steel_frame' | 'pipe_shed' | 'anchor' | 'conduit' | 'lock_anchor'

interface Batch {
  generation: number
  pending: Promise<void>[]
  models: Cesium.Model[]
}
const batches = new Map<LegacySupportKind, Batch>()
const batchFor = (kind: LegacySupportKind): Batch => {
  if (!batches.has(kind)) batches.set(kind, { generation: 0, pending: [], models: [] })
  return batches.get(kind)!
}

/** 保留原结构树几何排布，给异步 GLB 加载增加可等待批次和失效保护。 */
export function queueLegacySupportModel(
  kind: LegacySupportKind,
  viewer: Cesium.Viewer,
  options: Parameters<typeof Model.fromGltfAsync>[0],
  attach: (model: Cesium.Model) => void,
): void {
  const batch = batchFor(kind)
  const generation = batch.generation
  const pending = Model.fromGltfAsync(options).then(model => {
    if (generation !== batch.generation || viewer.isDestroyed()) {
      model.destroy()
      throw new DOMException('支护构件加载已取消', 'AbortError')
    }
    // 旧 GLB 默认 color 可能为 undefined；统一增强需要可快照、可恢复的颜色。
    model.color ??= Color.clone(Color.WHITE)
    attach(model)
    batch.models.push(model)
  })
  // 由资源边界统一报告错误；同步旧入口可能还未开始等待。
  void pending.catch(() => {})
  batch.pending.push(pending)
}

export async function waitForLegacySupportModels(kind: LegacySupportKind): Promise<void> {
  const batch = batchFor(kind)
  const generation = batch.generation
  const pending = batch.pending
  await Promise.all(pending)
  if (generation !== batch.generation) throw new DOMException('支护构件加载已取消', 'AbortError')
  batch.pending = []
  if (!batch.models.length) throw new Error(`支护构件未加载：${kind}`)
}

export function invalidateLegacySupportModels(...kinds: LegacySupportKind[]): void {
  for (const kind of kinds) {
    const batch = batchFor(kind)
    batch.generation++
    batch.pending = []
    batch.models = []
  }
}

export function getLegacySupportModels(kind: LegacySupportKind): readonly Cesium.Model[] {
  return [...batchFor(kind).models]
}
