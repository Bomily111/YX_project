import fs from 'node:fs/promises';
import {Presentation,PresentationFile} from '@oai/artifact-tool';
import {pathToFileURL} from 'node:url';
const root='D:/project/ppt_rebuild',skill='C:/Users/25603/.codex/plugins/cache/openai-primary-runtime/presentations/26.1026.10807/skills/presentations';
const p=Presentation.create({slideSize:{width:1350,height:630}}),s=p.slides.add();s.background.fill='#FFFFFF';
const z=1.5;
function shape(g,x,y,w,h,fill='none',stroke='#222222',dash=false,name='图形'){return s.shapes.add({geometry:g,name,position:{left:x*z,top:y*z,width:w*z,height:h*z},fill,line:{fill:stroke,width:stroke==='none'?0:0.75*z,style:dash?'dashed':'solid'}})}
function txt(t,x,y,w,h,sz=14,bold=false,color='#111111'){const a=shape('textbox',x,y,w,h,'none','none',false,t.replaceAll('\n',''));a.text=t;a.text.style={typeface:'Microsoft YaHei',fontSize:sz*z,bold,color,alignment:'center',verticalAlignment:'middle',insets:0,wrap:'none',autoFit:'none'};return a}
function box(t,x,y,w,h,sz=14,bold=false,round=false,color='#111111'){const a=shape(round?'roundRect':'rect',x,y,w,h,'#F5F5F5','#333333',false,t.replaceAll('\n',''));a.text=t;a.text.style={typeface:'Microsoft YaHei',fontSize:sz*z,bold,color,alignment:'center',verticalAlignment:'middle',insets:1,wrap:'none',autoFit:'none'};return a}
function arrow(x,y,w,h,dir='right',color='#333333'){shape(dir==='right'?'rightArrow':'downArrow',x,y,w,h,color,'none',false,'流程箭头')}
shape('rect',39,22,377,245,'#F3F3F3','#666666');shape('rect',488,22,368,245,'#F3F3F3','#666666');shape('rect',39,303,817,87,'#F3F3F3','#666666');
txt('研究内容1：',50,32,355,21,16,true);txt('智能体驱动的装配式隧道工程数字孪生场景自主构建',46,64,363,26,14.5,true);
txt('研究内容2：',498,32,348,21,16,true);txt('智能体驱动的隧道工程数字孪生场景增强可视化方法',495,64,352,26,14.5,true);
shape('rect',48,98,359,87,'none','#AAAAAA',true);shape('rect',498,98,350,87,'none','#AAAAAA',true);
box('任务与资源\n组织',56,108,84,64,13.5);box('智能体\n选择资源',184,108,104,64,13.5);box('平台校验\n与装配',329,108,69,64,13.5);
arrow(140,138,44,5);arrow(288,138,41,5);
box('视觉目标\n识别',506,108,84,64,13.5);box('智能体选择\n视觉增强策略',634,108,103,64,12.5);box('可视化增强\n与评价',779,108,62,64,12.5);
arrow(590,138,44,5);arrow(737,138,42,5);
txt('装配状态\n与反馈',418,102,66,36,11.5);arrow(419,145,64,10,'right','#7F9DB8');
arrow(213,187,28,29,'down','#4B4B4B');arrow(659,187,28,29,'down','#4B4B4B');
box('场景资源自主装配',63,216,328,41,15,true,true,'#4B27E5');box('任务场景增强可视化',503,216,328,41,15,true,true,'#4B27E5');
arrow(214,268,12,31,'down','#8CA6C3');txt('装配方法支撑',232,269,105,20,11);
arrow(666,268,12,31,'down','#8CA6C3');txt('可视化增强策略与评价',679,269,160,20,10.5);
txt('研究内容3：原型系统研发与案例实验',245,311,405,21,15.5,true);
box('案例区域选取',93,340,133,41,13.5,true,true,'#4B27E5');box('三维场景构建',279,340,132,41,13.5,true,true,'#4B27E5');box('智能体构建',467,340,149,41,13.5,true,true,'#4B27E5');box('自主装配与可视化',671,340,149,41,13.5,true,true,'#4B27E5');
s.speakerNotes.text='依据用户提供的截图重建。保持原图的研究内容1、研究内容2和研究内容3布局与文字。所有方框、标题和箭头为可编辑PowerPoint对象。';
await fs.writeFile(`${root}/.build/image-to-ppt-1102.png`,new Uint8Array(await(await p.export({slide:s,format:'png',scale:1})).arrayBuffer()));
const candidate=`${root}/.build/image-to-ppt-1102-candidate.pptx`;await(await PresentationFile.exportPptx(p)).save(candidate);
const {finalizePresentation}=await import(pathToFileURL(`${skill}/container_tools/artifact_tool_utils.mjs`).href);
const local=`${root}/output/研究内容关系图_可编辑_1102.pptx`;
await finalizePresentation({workspaceDir:'D:/project',candidatePath:candidate,finalPath:local,pythonExecutable:'C:/Users/25603/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',integrityValidatorPath:`${skill}/container_tools/inspect_presentation_package_integrity.py`,layoutValidatorPath:`${skill}/container_tools/inspect_presentation_layout_geometry.py`,layoutArgs:['--expected-slide-size-emu','12858750,6000750'],explicitTotalSlideCount:1,fontPolicy:{basis:'design',families:['Microsoft YaHei']},verifyArtifactToolImport:true,receiptPath:`${root}/.build/image-to-ppt-1102-validation.json`});
await fs.copyFile(local,'D:/研究内容关系图_可编辑.pptx');console.log('D:/研究内容关系图_可编辑.pptx');
