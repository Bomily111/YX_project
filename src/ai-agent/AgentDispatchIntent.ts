export interface RoutedToolCall {
  name: string
  input: Record<string, any>
  routed: boolean
}

/** Ordinary scene requests use one platform assembly call; explicit step-debug tasks retain the older tools. */
export function wantsDirectSceneAssembly(message: string): boolean {
  if (/(?:质量检查|质量评估|只.{0,8}(?:计划|方案)|不执行|暂不执行|assemblyModes|revise_next_scene_assembly|修订.{0,8}装配计划|分阶段|逐层|依次|轮流|先.{0,24}再)/i.test(message)) return false
  return /(?:构建|装配|展示|加载|查看|调出|呈现|可视化|放到.{0,8}场景)/.test(message)
    && /(?:场景|围岩|岩体|支护|爆破|通风|模型|电阻率|物探)/.test(message)
}

/** Explicit user-requested plan revision must be observed before advancing the next scene step. */
export function mustReviseAssemblyBeforeAdvance(message: string): boolean {
  return /revise_next_scene_assembly|(?:执行|进行).{0,18}(?:前|之前).{0,18}(?:改为|调整为|修订为).{0,6}(?:retain|保留)/i.test(message)
}

export function blocksUnrevisedSceneAdvance(
  message: string, completed: number, revised: boolean, toolName: string,
): boolean {
  return mustReviseAssemblyBeforeAdvance(message)
    && completed > 0 && !revised && toolName === 'advance_platform_task'
}

/** Respect explicit plan-only requests while honoring explicit task completion requests. */
export function wantsTaskExecution(message: string): boolean {
  if (/只(?:生成|创建|给出|看|要).{0,8}(?:计划|方案)|(?:先|仅).{0,8}(?:计划|方案)|等待.{0,6}确认|(?:不要|暂不|不必|不用|无需|请勿|先别|稍后再).{0,6}执行|不执行/.test(message)) {
    return false
  }
  return /自主|自动|执行|完成任务|构建并展示|直接展示|逐步展示/.test(message)
}

export function routeWorkflowToolCall(
  name: string,
  input: Record<string, any>,
  userMessage: string,
): RoutedToolCall {
  if (!wantsTaskExecution(userMessage)) return { name, input, routed: false }
  if (name === 'orchestrate_platform_task') {
    return { name: 'prepare_platform_task', input, routed: true }
  }
  if (name === 'compose_scene_workflow') {
    return { name: 'prepare_platform_task', input: { ...input, kind: 'scene-exploration' }, routed: true }
  }
  if (name === 'create_task') {
    return { name: 'prepare_platform_task', input: { ...input, kind: 'quality-check' }, routed: true }
  }
  return { name, input, routed: false }
}
