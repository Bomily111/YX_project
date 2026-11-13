export const wantsSupportLayerControl=(s:string)=>!/YK\s*\d|DK\s*\d|装配|加载|新任务|如何|怎么|是否|能否/.test(s)&&/支护|二衬|衬砌|钢架|钢拱架|格栅|锚杆|钢筋|混凝土/.test(s)&&/显示|隐藏|关闭|打开|保留|恢复|只看/.test(s)
export const wantsSupportInspection=(s:string)=>!/装配|加载|新任务|隐藏|关闭|只看|只保留/.test(s)&&/当前|现在|目前|这段|已装配/.test(s)&&/支护|构件|钢架|锚杆|钢筋/.test(s)&&/哪些|什么|多少|间距|长度|来源|类型|数量|状态|显示/.test(s)
export function resolveSupportLayers(text:string,available:string[]):Map<string,boolean|'default'>{
 if(!available.length)throw Error('当前任务没有可分组控制的支护构件')
 if(/恢复/.test(text)&&/默认|示例/.test(text)){
  if(/隐藏|关闭|只看|只保留/.test(text))throw Error('恢复默认与局部显隐要求冲突')
  return new Map(available.map(k=>[k,'default']))
 }
 const ops=[...text.matchAll(/(只保留|只看|显示|打开|保留|隐藏|关闭)([^，,。；;]*)(?:[，,。；;]|$)/g)],changes=new Map<string,boolean|'default'>()
 if(!ops.length)throw Error('请明确要显示或隐藏的构件')
 for(const [,action,clause] of ops){
  const unknown=clause.replace(/初支混凝土|喷射混凝土|混凝土|二衬钢筋|二次衬砌|二衬|钢拱架|钢架|格栅|初支钢筋网|钢筋网|系统锚杆|锁脚锚杆|锚杆|超前支护|钢筋|N\d+/gi,'').replace(/当前|已有|支护|模型|构件|的|和|与|以及|及|全部|所有|[\s、]/g,'')
  if(unknown)throw Error(`存在未识别的构件要求：${unknown}`)
  const keys=new Set<string>(),add=(candidates:string[])=>{const found=candidates.filter(k=>available.includes(k));if(!found.length)throw Error(`当前模型没有所需构件：${clause}`);found.forEach(k=>keys.add(k))}
  if(/混凝土/.test(clause))add(['primary_concrete'])
  if(/二衬(?!钢筋)|二次衬砌/.test(clause))add(['secondary_lining'])
  if(/钢拱架|钢架/.test(clause))add(['steel_arch','lattice_arch'])
  if(/格栅/.test(clause))add(['lattice_arch'])
  if(/钢筋网/.test(clause))add(['primary_mesh'])
  if(/锚杆/.test(clause))add(/系统/.test(clause)&&!/锁脚/.test(clause)?['system_anchor']:/锁脚/.test(clause)&&!/系统/.test(clause)?['lock_foot_anchor']:['system_anchor','lock_foot_anchor'])
  if(/超前支护/.test(clause))add(['advance_support'])
  if(/钢筋/.test(clause)&&!/钢筋网/.test(clause)){
   const numbered=[...clause.matchAll(/N(\d+)/gi)].map(m=>`secondary_rebar_N${m[1]}`),selected=numbered.length?numbered:available.filter(k=>k.startsWith('secondary_rebar_'))
   if(selected.some(k=>!available.includes(k)))throw Error('当前模型没有所要求的钢筋编号')
   add(selected)
  }
  if(!keys.size)throw Error(`未识别的支护构件：${clause}`)
  if(/只看|只保留/.test(action)){if(ops.length!==1)throw Error('只保留与其他操作请分开执行');available.forEach(k=>changes.set(k,keys.has(k)))}
  else for(const k of keys){const show=!/隐藏|关闭/.test(action);if(changes.has(k)&&changes.get(k)!==show)throw Error('同一构件显隐要求冲突');changes.set(k,show)}
 }
 return changes
}
