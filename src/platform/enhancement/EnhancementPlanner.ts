import { ResourceRegistry } from '@/platform/resources/ResourceRegistry'
import type { ScenePlan } from '@/platform/selection/ScenePlan'
import type { AdvancedEnhancementStrategy } from '@/platform/resources/types'
import type {
  EnhancementConflictGroup,
  EnhancementDirective,
  EnhancementPlan,
  RgbaColor,
} from './types'

export interface EnhancementPlannerOptions {
  focusColor?: RgbaColor
  focusOutlineWidth?: number
  referenceOpacity?: number
}

const DEFAULT_FOCUS_COLOR: RgbaColor = { red: 1, green: 0.65, blue: 0, alpha: 1 }
const ADVANCED_STRATEGY_DEFAULTS: Readonly<Record<
  AdvancedEnhancementStrategy,
  { conflictGroup: EnhancementConflictGroup; priority: number }
>> = {
  section: { conflictGroup: 'occlusion', priority: 80 },
  'standard-view': { conflictGroup: 'camera', priority: 70 },
  label: { conflictGroup: 'label', priority: 55 },
  chart: { conflictGroup: 'chart', priority: 50 },
}

export class EnhancementPlanner {
  constructor(private readonly registry: ResourceRegistry) {}

  create(scenePlan: ScenePlan, options: EnhancementPlannerOptions = {}): EnhancementPlan {
    const directives: EnhancementDirective[] = []
    const focusColor = options.focusColor ?? DEFAULT_FOCUS_COLOR
    const outlineWidth = options.focusOutlineWidth ?? 3
    const referenceOpacity = options.referenceOpacity ?? 0.35
    if (referenceOpacity < 0 || referenceOpacity > 1) {
      throw new Error('[EnhancementPlanner] 参照透明度必须在 0–1 之间')
    }
    if (!Number.isFinite(outlineWidth) || outlineWidth < 0) {
      throw new Error('[EnhancementPlanner] 轮廓宽度必须是非负有限数')
    }

    for (const decision of scenePlan.decisions) {
      if (decision.role === 'excluded') continue
      const resource = this.registry.require(decision.resourceId)
      const targets = resource.getEnhanceTargets?.() ?? []
      for (const target of targets) {
        if (target.object) {
          directives.push({
            id: `${scenePlan.stepId}:${target.id}:visibility`,
            resourceId: resource.id,
            targetId: target.id,
            strategy: 'visibility',
            conflictGroup: 'visibility',
            priority: 90,
            parameters: { visible: true },
          })
        }
        if (decision.role === 'focus') {
          if (target.object) {
            directives.push({
              id: `${scenePlan.stepId}:${target.id}:highlight`,
              resourceId: resource.id,
              targetId: target.id,
              strategy: 'highlight',
              conflictGroup: 'color',
              priority: 60,
              parameters: { color: { ...focusColor }, width: outlineWidth },
            })
          }
          for (const strategy of new Set(target.recommendedEnhancements ?? [])) {
            if (!target.adapters?.[strategy]) continue
            const defaults = ADVANCED_STRATEGY_DEFAULTS[strategy]
            directives.push({
              id: `${scenePlan.stepId}:${target.id}:${strategy}`,
              resourceId: resource.id,
              targetId: target.id,
              strategy,
              conflictGroup: defaults.conflictGroup,
              priority: defaults.priority,
              parameters: target.enhancementParameters?.[strategy] ?? {},
            })
          }
        } else if (target.object) {
          directives.push({
            id: `${scenePlan.stepId}:${target.id}:opacity`,
            resourceId: resource.id,
            targetId: target.id,
            strategy: 'opacity',
            conflictGroup: 'occlusion',
            priority: 40,
            parameters: { value: referenceOpacity },
          })
        }
      }
    }
    return { taskId: scenePlan.taskId, stepId: scenePlan.stepId, directives }
  }
}
