import {wantsSupportLayerControl,wantsSupportInspection} from './SupportLayerIntent'
export interface RoutedToolCall {
  name: string
  input: Record<string, any>
  routed: boolean
}
export function wantsScenePreflight(message: string): boolean {
  return /装配预检|能否同屏|只.{0,6}预检|是否支持.*(?:同屏|组合)/.test(message)
}
export function wantsTestSupportUpdate(message: string): boolean {
  if (/[DY]K\s*\d|如何|怎么|能否|是否|预检|不执行|计划|新任务|复位|照片|通风|炮孔|雷达|水平钻|不要|去掉|移除|隐藏|取消/i.test(message)) return false
  return /改为|改成|换成|换为|改用|调整为|调整到|改到|设为|设置为|缩短到|延长到/.test(message)
    && /支护|长度|ZZ-|Z-PM|米|m\b/i.test(message)
}
export function resolveClarifiedSceneRequest(message: string, pending?: string): string {
  if (!pending || !/(?:[DY]K\s*\d+\s*\+|测试工段|论文测试)/i.test(pending) || /[DY]K\s*\d+\s*\+/i.test(message)) return message
  if (/准备|构建|装配|加载|换个任务|新任务|取消|复位|不执行/.test(message)) return message
  if (/通风|风向|流线|温度|热场/.test(message) && !/通风|风向|流线|温度|热场/.test(pending)) return message
  if (!/断面|围岩|完整|坚硬|ZZ-|支护|照片|测线|GPR|温度|秒|分钟|流线|风向|岩面|水平钻|钻孔|类型/i.test(message)) return message
  return `${pending}\n用户补充：${message}`
}
export function wantsTaskViewControl(message: string): boolean {
  return !/[DY]K\s*\d|构建|装配|加载|计划|如何|怎么/i.test(message)
    && /整体布置|整体视角|全景|近景|拉近|聚焦|放大.*(?:掌子面|支护|钻孔|爆破)|视角.*(?:掌子面|支护|钻孔|爆破)/.test(message)
}
export function wantsTaskCutControl(message: string): boolean {
  return !/[DY]K\s*\d|装配|加载|计划|如何|怎么|能否/i.test(message)
    && /剖切|裁剪|完整解释体|完整体数据/.test(message)
    && /开启|打开|关闭|取消|恢复|显示|切开/.test(message)
}

/** A follow-up display change uses the existing blast model, without guessing a new task location. */
export function wantsBlastLayerControl(message: string): boolean {
  if (/(?:[DY]K\s*\d|设计|二维|构建|装配|加载|计划|不执行|如何|怎么|能否|是否|CFD点云|计算点云|支护|围岩|掌子面|水平钻|温度场|热场|雷达|GPR)/i.test(message)) return false
  return /(?:爆后点云|炮孔)/.test(message)
    && /(?:显示|隐藏|关闭|打开|保留|取消|关掉|去掉|只看|恢复)/.test(message)
}

/** Ordinary scene requests use one platform assembly call; explicit step-debug tasks retain the older tools. */
export function wantsDirectSceneAssembly(message: string): boolean {
  if(wantsSupportLayerControl(message)||wantsSupportInspection(message))return false
  if (wantsTestSupportUpdate(message)) return false
  if (wantsScenePreflight(message)) return false
  if (/支持哪些|有哪些可用|资源目录|能力清单/.test(message)) return false
  if (wantsTaskCutControl(message)) return false
  if (wantsTaskViewControl(message)) return false
  if (wantsBlastLayerControl(message)) return false
  if (/如何|怎么|为什么|介绍|解释一下/.test(message)) return false
  if (/(?:质量检查|质量评估|只.{0,8}(?:计划|方案)|不执行|暂不执行|assemblyModes|revise_next_scene_assembly|修订.{0,8}装配计划|分阶段|逐层|依次|轮流|先.{0,24}再)/i.test(message)) return false
  return /(?:构建|装配|展示|加载|查看|调出|呈现|可视化|准备|搭建|看看|放到.{0,8}场景)/.test(message)
    && /(?:场景|围岩|岩体|支护|爆破|炮孔|点云|通风|风流|流线|热场|温度场|温度分布|掌子面|照片|雷达|GPR|水平钻|钻孔|模型|电阻率|物探)/i.test(message)
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
