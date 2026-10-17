import type { EnhancementPlan, EnhancementStrategyKind } from './types'

export interface EnhancementActivitySnapshot {
  activePlans: number
  activeDirectives: number
  strategies: Partial<Record<EnhancementStrategyKind, number>>
}

interface ActiveEnhancement {
  plan: EnhancementPlan
  strategies: readonly EnhancementStrategyKind[]
}

const activeEnhancements = new Map<symbol, ActiveEnhancement>()

export function setEnhancementActivity(
  token: symbol,
  plan: EnhancementPlan,
  strategies: readonly EnhancementStrategyKind[],
): void {
  activeEnhancements.set(token, { plan, strategies: [...strategies] })
}

export function clearEnhancementActivity(token: symbol): void {
  activeEnhancements.delete(token)
}

export function getEnhancementActivitySnapshot(): EnhancementActivitySnapshot {
  const strategies: Partial<Record<EnhancementStrategyKind, number>> = {}
  let activeDirectives = 0
  for (const activity of activeEnhancements.values()) {
    activeDirectives += activity.strategies.length
    for (const strategy of activity.strategies) {
      strategies[strategy] = (strategies[strategy] ?? 0) + 1
    }
  }
  return {
    activePlans: activeEnhancements.size,
    activeDirectives,
    strategies,
  }
}
