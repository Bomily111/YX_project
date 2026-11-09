from pathlib import Path
from copy import deepcopy
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.text import WD_ALIGN_PARAGRAPH
root=Path('D:/project/docs/weekly-1108')
d=Document(root/'reference.docx')
for node in d._element.xpath('//w:t'):
    if node.text: node.text=node.text.replace('20261025','20261108').replace('1025','1108')
for p in d.paragraphs:
    if '20261025' in p.text:
        p.text='编号：20261108'
        for r in p.runs:
            r.font.name='宋体'; r.font.size=Pt(12); r._element.get_or_add_rPr().rFonts.set(qn('w:eastAsia'),'宋体')
t=d.tables[0]
t.cell(1,3).text='2026年 11 月 8 日'
for p in t.cell(1,3).paragraphs:
    p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    for r in p.runs:
        r.font.name='宋体'; r.font.size=Pt(12); r._element.get_or_add_rPr().rFonts.set(qn('w:eastAsia'),'宋体')
c=t.cell(2,0)
preserved=[deepcopy(p._p) for p in c.paragraphs[:2]]
for child in list(c._tc):
    if child.tag!=qn('w:tcPr'): c._tc.remove(child)
for p in preserved: c._tc.append(p)
for h in t.rows[2]._tr.xpath('./w:trPr/w:trHeight'): h.getparent().remove(h)
def para(text='',bold=False,center=False,size=12,break_before=False):
    p=c.add_paragraph(); f=p.paragraph_format
    f.space_before=Pt(1); f.space_after=Pt(2); f.line_spacing=1.15
    f.keep_together=True
    f.keep_with_next=bold
    f.first_line_indent=Pt(24) if not bold and not center else Pt(0)
    f.page_break_before=break_before
    p.alignment=WD_ALIGN_PARAGRAPH.CENTER if center else WD_ALIGN_PARAGRAPH.JUSTIFY
    r=p.add_run(text); r.bold=bold; r.font.name='宋体'; r.font.size=Pt(size); r.font.color.rgb=RGBColor(0,0,0)
    r._element.get_or_add_rPr().rFonts.set(qn('w:eastAsia'),'宋体')
    return p
def fig(path,caption,width=5.8):
    p=para(center=True); p.paragraph_format.space_before=Pt(5); p.paragraph_format.keep_with_next=True
    p.add_run().add_picture(str(Path('D:/project/docs/verification')/path),width=Inches(width))
    r=p.add_run('\n'+caption); r.font.size=Pt(10.5); r.font.name='宋体'; r._element.get_or_add_rPr().rFonts.set(qn('w:eastAsia'),'宋体')
para('◆ 本周任务简介',True)
para('1、围绕智能体驱动的隧道工程数字孪生场景自主构建，完善施工目标理解、资源选择及组合装配。')
para('2、开展任务相关增强可视化，实现解释体剖切、视角切换及页面交互控制，并进行平台测试与真实页面验证。')
para('◆ 本周工作成果',True)
para('一 施工目标驱动的场景自主构建',True)
para('在现有LangChain与DeepSeek框架基础上，按照“业务目标—资料需求—必要资源—展示方式”组织调度。用户可描述施工交底或复核目的，由智能体选择相关资源并说明选用依据；需求不明确时先澄清，补充后承接用户已明确的里程。')
para('整合支护、TSP/TEM解释体、爆破设计与点云、通风、GPR和水平钻等资源。掌子面模型不是默认资源，仅在任务需要照片信息时装配一张。完善按依赖装配、任务切换和复位流程。')
fig('acceptance-2026-11-05/workface-support-drill.png','图1 单掌子面 支护与水平钻的任务组合场景',4.8)
para('二 面向装配任务的增强可视化',True,break_before=True)
para('将展示增强安排在资源整体装配之后，根据观察尺度选择工段整体视图或构件近景，避免相机落入解释体内部。针对TSP解释体与支护组合，增加仅用于展示的剖切，并弱化隧道外壳，使支护断面更易辨认。裁剪不改变原始体数据或模型装配位置。')
fig('2026-11-07-cut-panel-preview/rock-support.png','图2 解释体剖切与支护组合展示及页面控制入口',5.4)
para('支持“开启解释体剖切”“恢复完整解释体”等后续指令。左侧任务栏显示剖切状态并提供手动按钮，聊天与页面操作同步；关闭时恢复该体原先的显示范围，旧任务撤销不会覆盖新体。')
para('完成爆后点云与炮孔的独立显示控制，主场景和爆破专题页均可操作，便于按任务减少遮挡。智能体可在已装配场景中聚焦掌子面、支护或水平钻，不必重新加载模型。')
fig('2026-11-07-view-panel/workface-support-drill.png','图3 聊天与任务视角按钮同步控制装配场景',3.8)
# Heading is grouped with the following text to prevent an orphan in a table.
p3=para('三 可视化交互与调度可靠性验证\n增加平台资源目录核查与只读装配预检。目录核查读取46项已注册能力；预检复用正式装配规则，反馈兼容性、依赖及限制，不创建任务或替换当前场景。明确区分“能力已接入”“装配规则通过”与“目标实测资料齐全”。')
head,body=p3.text.split('\n',1)
p3.clear(); p3.paragraph_format.first_line_indent=Pt(0)
for text,bold in [(head+'\n',True),(body,False)]:
    r=p3.add_run(text); r.bold=bold; r.font.name='宋体'; r.font.size=Pt(12); r._element.get_or_add_rPr().rFonts.set(qn('w:eastAsia'),'宋体')
para('截至本周最新验证，平台260项测试通过、1项在线专用测试默认跳过，生产构建与87项资产清单校验通过；21项在线资源选择检查通过。另对场景装配、澄清承接、视角与剖切联动、预检保留热场及复位进行了真实页面验证。在线选资源检查拦截工具执行，不等同于实际装配次数。')
para('存在问题：软件WebGL长时运行仍偶发输入、点击或截图超时；当前剖切只覆盖已验证组合，尚未解决通用深度遮挡。部分模型为历史示例的示意配准，热场为近似时间片，不能作为目标工段实测或工程质量结论。')
para('◆ 下周任务简介',True)
para('1、继续完善从施工目标到资料需求、最少资源及展示方案的推导，拓展典型施工任务测试。')
para('2、完善目标工段资料对应关系及来源核验，增强剖切与局部聚焦效果，排查长时渲染和交互超时。')
# Preserve template review/signature rows and their blank fields.
newrow=deepcopy(t.rows[2]._tr)
newcell=newrow.find(qn('w:tc'))
for child in list(newcell):
    if child.tag!=qn('w:tcPr'): newcell.remove(child)
moving=False
for child in list(c._tc):
    if child is p3._p: moving=True
    if moving: newcell.append(child)
pr=newrow.find(qn('w:trPr'))
if pr is None:
    pr=OxmlElement('w:trPr'); newrow.insert(0,pr)
pr.append(OxmlElement('w:cantSplit'))
t.rows[2]._tr.addnext(newrow)
if d.paragraphs[-1].text=='':
    p=d.paragraphs[-1]; p.paragraph_format.line_spacing=Pt(1); p.paragraph_format.space_before=Pt(0); p.paragraph_format.space_after=Pt(0)
    p.add_run().font.size=Pt(1)
out=Path('D:/研/周报/2026/周报_1108_敖圣博_智能体开发图文版.docx')
d.save(out)
(root/'artifact.md').write_text('Reference: D:/研/周报/2026/周报_1108 _敖圣博.doc converted read-only to reference.docx.\nA4 595.3x841.9pt; margins top/bottom72 left/right90pt. Preserve original title, table grid, header metadata, author red line, review and signature fields. Body row rewritten for November 8 progress, with three actual screenshots. Original retained unchanged. Body uses Song 12pt; captions10.5pt. Page breaks before result sections 2 and 3. Word export PDF used because bundled renderer requires unavailable LibreOffice on this Windows host.\n',encoding='utf-8')
print(str(out))
