import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const output='docs/agent-prompts-current-2026-11-13.md'
const read=file=>({file,text:fs.readFileSync(file,'utf8')})
const parse=file=>{const value=read(file);return {...value,ast:ts.createSourceFile(file,value.text,ts.ScriptTarget.Latest,true)}}
const sections=[]
const add=(title,body)=>sections.push(`## ${title}\n\n${body}\n`)
const sourceLink=(file,node,ast)=>`[${file}](D:/project/${file}:${ast.getLineAndCharacterOfPosition(node.getStart(ast)).line+1})`
const fence=(language,text)=>`\`\`\`${language}\n${text}\n\`\`\``
const walk=(node,visit)=>{visit(node);node.forEachChild(child=>walk(child,visit))}
const system=parse('src/ai-agent/knowledge/prompts/system.ts')
let base,version
walk(system.ast,node=>{
 if(ts.isVariableDeclaration(node)&&node.name.getText(system.ast)==='BASE_SYSTEM_PROMPT')base=node.initializer.text
 if(ts.isVariableDeclaration(node)&&node.name.getText(system.ast)==='AGENT_PROMPT_VERSION')version=node.initializer.text
})
if(!base||!version)throw Error('Missing system prompt/version')
add('1. 基础系统提示词全文',`版本：${version}。来自 [system.ts](D:/project/src/ai-agent/knowledge/prompts/system.ts)。以下保持原文。\n\n${base}`)
const builder=system.ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='buildSystemPrompt')
add('2. 页面上下文与检索资料的拼接逻辑',`以下保留原始模板和条件。页面场景、工点、里程以及检索主题随请求变化，并非每轮全部出现。\n\n${fence('typescript',builder.getText(system.ast))}`)
const engine=parse('src/ai-agent/AgentEngine.ts')
const runtime=[]
walk(engine.ast,node=>{
 if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.PlusEqualsToken&&node.left.getText(engine.ast)==='system')runtime.push(`${sourceLink(engine.file,node,engine.ast)}\n\n${fence('typescript',node.getText(engine.ast))}`)
})
add('3. 运行时追加提示词全文',`以下${runtime.length}项按实际条件追加；变量表示当前能力目录、失败任务或待执行步骤。\n\n${runtime.join('\n\n')}`)
let count=0
const tools=[]
for(const file of ['src/ai-agent/tools/common.ts','src/ai-agent/tools/workflow.tools.ts','src/ai-agent/tools/blast.tools.ts']){
 const source=parse(file)
 walk(source.ast,node=>{
  if(!ts.isObjectLiteralExpression(node))return
  const properties=new Map(node.properties.filter(ts.isPropertyAssignment).map(p=>[p.name.getText(source.ast),p.initializer]))
  if(!properties.has('name')||!properties.has('description')||!properties.has('input_schema'))return
  count++
  const name=properties.get('name')
  tools.push(`### ${count}. ${ts.isStringLiteral(name)?name.text:name.getText(source.ast)}\n\n来源：${sourceLink(file,node,source.ast)}\n\n${fence('typescript',node.getText(source.ast))}`)
 })
}
add('4. 工具说明与参数定义全文',`共${count}项源码工具定义。工具说明和参数描述也会提供给模型，影响它如何选择工具。这里列出全部已定义项；每轮实际发送的子集由当前模块、意图路由和任务状态决定。\n\n保留TypeScript原文，因此枚举及共享参数变量另见下一节；这里没有执行工具。\n\n${tools.join('\n\n')}`)
const shared=[]
const workflow=parse('src/ai-agent/tools/workflow.tools.ts')
walk(workflow.ast,node=>{
 if(ts.isVariableDeclaration(node)&&['enhancementModesSchema','assemblyModesSchema'].includes(node.name.getText(workflow.ast)))shared.push(fence('typescript',node.getText(workflow.ast)))
})
for(const file of ['src/platform/tasks/samples/SceneExplorationWorkflow.ts','src/platform/tasks/TaskCameraView.ts']){
 const source=parse(file)
 walk(source.ast,node=>{
  if(ts.isVariableDeclaration(node)&&['SCENE_EXPLORATION_RESOURCES','AGENT_SCENE_RESOURCES','SCENE_ENHANCEMENT_MODES','SCENE_ASSEMBLY_MODES','taskViews'].includes(node.name.getText(source.ast)))shared.push(`${sourceLink(file,node,source.ast)}\n\n${fence('typescript',node.getText(source.ast))}`)
 })
}
add('5. 工具定义引用的共享参数与枚举',shared.join('\n\n'))
const defaults=[]
for(const file of ['src/ai-agent/AgentEngine.ts','backend/src/ai-agent/routes/chat.js']){
 const source=parse(file)
 walk(source.ast,node=>{
  if(ts.isStringLiteral(node)&&node.text.startsWith('你是隧道施工数字孪生平台的智能助手'))defaults.push(`${sourceLink(file,node,source.ast)}\n\n${fence('text',node.text)}`)
 })
}
add('6. 默认提示词及生效边界',`${defaults.join('\n\n')}\n\n前端构造器保存的systemPrompt及setSystemPrompt当前没有被chat()用于实际请求；chat()每轮重新调用buildSystemPrompt。后端默认短提示仅在请求未提供system时兜底。当前DeepSeek适配器使用ChatPromptTemplate将前端system原文与conversation消息组合，没有另加领域系统提示词。`)
add('7. 如何理解实际请求',`本文件是源码静态快照，不代表每轮全部同时发送。实际请求包含：本轮拼接的system、当前可用工具子集以及对话消息。工具结果和工作流状态属于动态观测，内容取决于执行结果，无法用一份静态文本穷尽。\n\n内置爆破知识库正文已因虚构示例身份隔离，不进入提示词；仅相关主题元数据带fictional-example及referenceable=false标记。此导出没有读取环境文件或密钥，没有修改运行代码。`)
const legacy=parse('src/services/AgentService.ts')
const legacyParts=[]
walk(legacy.ast,node=>{
 if(ts.isVariableDeclaration(node)&&['SYSTEM_PROMPT','PLATFORM_TOOLS'].includes(node.name.getText(legacy.ast)))legacyParts.push(`${sourceLink(legacy.file,node,legacy.ast)}\n\n${fence('typescript',node.getText(legacy.ast))}`)
})
add('8. 旧版独立聊天实现中的提示词与5项工具',`src/views/AgentAssistant/AgentChat.vue仍引用此旧服务；它不同于当前主界面src/ai-agent/AgentChat.vue使用的DeepSeek工具链。以下完整保留，不能把其中能力说明当作当前主入口的实际能力。旧服务还含simulateResponse开发模拟回答，它不是模型提示词，也不是实际施工资料。\n\n${legacyParts.join('\n\n')}`)
fs.writeFileSync(output,`# 当前平台智能体提示词完整清单\n\n由scripts/export-agent-prompts.mjs从当前工作区自动提取；包含基础全文、动态模板、工具说明与兜底提示词。\n\n${sections.join('\n')}`)
console.log(JSON.stringify({output:path.resolve(output),version,tools:count,runtimeTemplates:runtime.length,characters:fs.readFileSync(output,'utf8').length}))
