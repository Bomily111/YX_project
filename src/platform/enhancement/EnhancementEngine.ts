import type { EnhanceTarget } from '@/platform/resources/types'
import { ResourceRegistry } from '@/platform/resources/ResourceRegistry'
import type {
  EnhancementDecision,
  EnhancementDirective,
  EnhancementExecutionResult,
  EnhancementPlan,
  EnhancementStrategyKind,
  RgbaColor,
} from './types'
import { clearEnhancementActivity, setEnhancementActivity } from './EnhancementActivity'

export type EnhancementUndo = () => void | Promise<void>
export type EnhancementStrategyHandler = (
  directive: EnhancementDirective,
  target: EnhanceTarget,
) => EnhancementUndo | Promise<EnhancementUndo>

interface ResolvedPlan {
  winners: EnhancementDirective[]
  decisions: EnhancementDecision[]
}

const asObject = (target: EnhanceTarget): Record<string, unknown> | undefined => (
  target.object && typeof target.object === 'object'
    ? target.object as unknown as Record<string, unknown>
    : undefined
)

const numberParameter = (directive: EnhancementDirective, key: string): number => {
  const value = directive.parameters[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`[EnhancementEngine] ${directive.id} 的 ${key} 必须是有限数`)
  }
  return value
}

const visibilityHandler: EnhancementStrategyHandler = (directive, target) => {
  const object = asObject(target)
  if (!object || !('show' in object)) throw new Error(`增强目标不支持显隐：${target.id}`)
  const visible = directive.parameters.visible
  if (typeof visible !== 'boolean') throw new Error(`[EnhancementEngine] ${directive.id} 缺少 visible`)
  const previous = object.show
  object.show = visible
  return () => { object.show = previous }
}

const opacityHandler: EnhancementStrategyHandler = (directive, target) => {
  const object = asObject(target)
  if (!object) throw new Error(`增强目标不存在：${target.id}`)
  const value = numberParameter(directive, 'value')
  if (value < 0 || value > 1) throw new Error(`[EnhancementEngine] ${directive.id} 的透明度必须在 0–1 之间`)

  if ('opacity' in object && typeof object.opacity === 'number') {
    const previous = object.opacity
    object.opacity = value
    return () => { object.opacity = previous }
  }

  const color = object.color as Record<string, unknown> | undefined
  if (!color || typeof color.alpha !== 'number') throw new Error(`增强目标不支持透明度：${target.id}`)
  const previous = object.color
  const next = typeof color.clone === 'function'
    ? (color.clone as () => Record<string, unknown>)()
    : { ...color }
  next.alpha = value
  object.color = next
  return () => { object.color = previous }
}

const isRgbaColor = (value: unknown): value is RgbaColor => {
  if (!value || typeof value !== 'object') return false
  const color = value as Partial<RgbaColor>
  return [color.red, color.green, color.blue, color.alpha]
    .every((channel) => typeof channel === 'number' && Number.isFinite(channel))
}

const highlightHandler: EnhancementStrategyHandler = (directive, target) => {
  const object = asObject(target)
  if (!object || !('silhouetteColor' in object) || !('silhouetteSize' in object)) {
    throw new Error(`增强目标不支持轮廓高亮：${target.id}`)
  }
  const color = directive.parameters.color
  const width = numberParameter(directive, 'width')
  if (!isRgbaColor(color)) throw new Error(`[EnhancementEngine] ${directive.id} 缺少有效 color`)
  const previousColor = object.silhouetteColor
  const previousSize = object.silhouetteSize
  const currentColor = object.silhouetteColor as Record<string, unknown> | undefined
  const nextColor = currentColor && typeof currentColor.clone === 'function'
    ? (currentColor.clone as () => Record<string, unknown>)()
    : {}
  Object.assign(nextColor, color)
  object.silhouetteColor = nextColor
  object.silhouetteSize = width
  return () => {
    object.silhouetteColor = previousColor
    object.silhouetteSize = previousSize
  }
}

const delegatedHandler = (
  strategy: 'section' | 'label' | 'standard-view' | 'chart',
): EnhancementStrategyHandler => async (directive, target) => {
  const adapter = target.adapters?.[strategy]
  if (!adapter) throw new Error(`增强目标不支持${strategy}：${target.id}`)
  return adapter(directive.parameters)
}

export class EnhancementEngine {
  private readonly activityToken = Symbol('enhancement-engine')
  private readonly handlers = new Map<EnhancementStrategyKind, EnhancementStrategyHandler>()
  private activePlan?: EnhancementPlan
  private activeUndos: EnhancementUndo[] = []
  private operationQueue: Promise<void> = Promise.resolve()

  constructor(private readonly registry: ResourceRegistry) {
    this.registerStrategy('visibility', visibilityHandler)
    this.registerStrategy('opacity', opacityHandler)
    this.registerStrategy('highlight', highlightHandler)
    this.registerStrategy('risk-color', highlightHandler)
    this.registerStrategy('section', delegatedHandler('section'))
    this.registerStrategy('label', delegatedHandler('label'))
    this.registerStrategy('standard-view', delegatedHandler('standard-view'))
    this.registerStrategy('chart', delegatedHandler('chart'))
  }

  registerStrategy(kind: EnhancementStrategyKind, handler: EnhancementStrategyHandler): () => void {
    if (this.handlers.has(kind)) throw new Error(`[EnhancementEngine] 策略已注册：${kind}`)
    this.handlers.set(kind, handler)
    return () => {
      if (this.handlers.get(kind) === handler) this.handlers.delete(kind)
    }
  }

  getActivePlan(): EnhancementPlan | undefined {
    return this.activePlan
  }

  apply(plan: EnhancementPlan): Promise<EnhancementExecutionResult> {
    return this.enqueue(() => this.applyInternal(plan))
  }

  reset(): Promise<readonly unknown[]> {
    return this.enqueue(async () => {
      const errors = await this.undoAll(this.activeUndos)
      this.activeUndos = []
      this.activePlan = undefined
      clearEnhancementActivity(this.activityToken)
      return errors
    })
  }

  private async applyInternal(plan: EnhancementPlan): Promise<EnhancementExecutionResult> {
    const startedAt = performance.now()
    const previousPlan = this.activePlan
    const previousUndos = this.activeUndos
    const previousResetErrors = await this.undoAll(previousUndos)
    this.activePlan = undefined
    this.activeUndos = []
    clearEnhancementActivity(this.activityToken)
    if (previousResetErrors.length > 0) {
      return {
        status: 'failed',
        plan,
        decisions: [],
        durationMs: performance.now() - startedAt,
        error: new AggregateError(previousResetErrors, '原增强计划复位失败'),
        rollbackErrors: previousResetErrors,
      }
    }

    let resolved: ResolvedPlan = { winners: [], decisions: [] }
    try {
      resolved = this.resolveConflicts(plan)
      const undos = await this.applyResolved(resolved.winners)
      this.activePlan = plan
      this.activeUndos = undos
      setEnhancementActivity(this.activityToken, plan, resolved.winners.map(({ strategy }) => strategy))
      return {
        status: 'applied',
        plan,
        decisions: resolved.decisions,
        durationMs: performance.now() - startedAt,
        rollbackErrors: [],
      }
    } catch (error) {
      const rollbackErrors: unknown[] = []
      if (previousPlan) {
        try {
          const previousResolved = this.resolveConflicts(previousPlan)
          this.activeUndos = await this.applyResolved(previousResolved.winners)
          this.activePlan = previousPlan
          setEnhancementActivity(
            this.activityToken,
            previousPlan,
            previousResolved.winners.map(({ strategy }) => strategy),
          )
        } catch (restoreError) {
          rollbackErrors.push(restoreError)
          this.activeUndos = []
          this.activePlan = undefined
          clearEnhancementActivity(this.activityToken)
        }
      }
      return {
        status: 'failed',
        plan,
        decisions: resolved.decisions,
        durationMs: performance.now() - startedAt,
        error,
        rollbackErrors,
      }
    }
  }

  private resolveConflicts(plan: EnhancementPlan): ResolvedPlan {
    const ids = new Set<string>()
    const groups = new Map<string, EnhancementDirective[]>()
    for (const directive of plan.directives) {
      if (ids.has(directive.id)) throw new Error(`[EnhancementEngine] 指令 ID 重复：${directive.id}`)
      ids.add(directive.id)
      if (!Number.isFinite(directive.priority)) throw new Error(`[EnhancementEngine] 优先级无效：${directive.id}`)
      const key = `${directive.resourceId}\u0000${directive.targetId}\u0000${directive.conflictGroup}`
      const group = groups.get(key) ?? []
      group.push(directive)
      groups.set(key, group)
    }

    const winners: EnhancementDirective[] = []
    const decisions: EnhancementDecision[] = []
    for (const group of groups.values()) {
      group.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
      const winner = group[0]
      winners.push(winner)
      decisions.push({ directiveId: winner.id, status: 'applied' })
      for (const suppressed of group.slice(1)) {
        decisions.push({ directiveId: suppressed.id, status: 'suppressed', suppressedBy: winner.id })
      }
    }
    winners.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
    return { winners, decisions }
  }

  private async applyResolved(directives: readonly EnhancementDirective[]): Promise<EnhancementUndo[]> {
    const undos: EnhancementUndo[] = []
    try {
      for (const directive of directives) {
        const handler = this.handlers.get(directive.strategy)
        if (!handler) throw new Error(`[EnhancementEngine] 未注册策略：${directive.strategy}`)
        const target = this.requireTarget(directive.resourceId, directive.targetId)
        undos.push(await handler(directive, target))
      }
      return undos
    } catch (error) {
      const rollbackErrors = await this.undoAll(undos)
      if (rollbackErrors.length > 0) {
        throw new AggregateError([error, ...rollbackErrors], '增强计划应用及回滚失败')
      }
      throw error
    }
  }

  private requireTarget(resourceId: string, targetId: string): EnhanceTarget {
    const target = this.registry.require(resourceId).getEnhanceTargets?.()
      .find((candidate) => candidate.id === targetId)
    if (!target) throw new Error(`[EnhancementEngine] 增强目标不存在：${resourceId}/${targetId}`)
    return target
  }

  private async undoAll(undos: readonly EnhancementUndo[]): Promise<unknown[]> {
    const errors: unknown[] = []
    for (const undo of [...undos].reverse()) {
      try {
        await undo()
      } catch (error) {
        errors.push(error)
      }
    }
    return errors
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation, operation)
    this.operationQueue = result.then(() => undefined, () => undefined)
    return result
  }
}
