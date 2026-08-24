# -*- coding: utf-8 -*-
# 生成《技术总体架构图说明》Word 文档
# 用法: python scripts/gen_arch_desc_docx.py
import os
from docx import Document
from docx.shared import Pt, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '技术总体架构图说明.docx')

doc = Document()

# ---- 全局字体（中文宋体 + 西文 Times/Calibri） ----
def set_font(style, name_east='宋体', name_ascii='Calibri', size=None, bold=None, color=None):
    style.font.name = name_ascii
    if size is not None:
        style.font.size = Pt(size)
    if bold is not None:
        style.font.bold = bold
    if color is not None:
        style.font.color.rgb = color
    rpr = style.element.get_or_add_rPr()
    rfonts = rpr.get_or_add_rFonts()
    rfonts.set(qn('w:eastAsia'), name_east)

normal = doc.styles['Normal']
set_font(normal, size=11)
normal.paragraph_format.space_after = Pt(6)
normal.paragraph_format.line_spacing = 1.4

# ---- 帮助函数 ----
def add_title(text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(text)
    run.font.name = 'Calibri'
    run.font.size = Pt(20)
    run.font.bold = True
    run._element.get_or_add_rPr().get_or_add_rFonts().set(qn('w:eastAsia'), '黑体')
    p.paragraph_format.space_after = Pt(4)
    return p

def add_meta(text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(text)
    run.font.size = Pt(9)
    run.font.color.rgb = RGBColor(0x66, 0x66, 0x66)
    run._element.get_or_add_rPr().get_or_add_rFonts().set(qn('w:eastAsia'), '宋体')
    p.paragraph_format.space_after = Pt(12)
    return p

def add_heading(text):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.name = 'Calibri'
    run.font.size = Pt(14)
    run.font.bold = True
    run.font.color.rgb = RGBColor(0x1F, 0x4E, 0x79)
    run._element.get_or_add_rPr().get_or_add_rFonts().set(qn('w:eastAsia'), '黑体')
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(4)
    return p

def add_para(text, bold=False):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.bold = bold
    run.font.name = 'Calibri'
    run.font.size = Pt(11)
    run._element.get_or_add_rPr().get_or_add_rFonts().set(qn('w:eastAsia'), '宋体')
    return p

def add_items(items, numbered=True):
    for i, t in enumerate(items, 1):
        prefix = f'{i}. ' if numbered else '• '
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(0.6)
        p.paragraph_format.space_after = Pt(3)
        r1 = p.add_run(prefix)
        r1.font.name = 'Calibri'
        r1.font.size = Pt(11)
        r1._element.get_or_add_rPr().get_or_add_rFonts().set(qn('w:eastAsia'), '宋体')
        r2 = p.add_run(t)
        r2.font.name = 'Calibri'
        r2.font.size = Pt(11)
        r2._element.get_or_add_rPr().get_or_add_rFonts().set(qn('w:eastAsia'), '宋体')

def add_bold_key_para(key, rest):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(0.6)
    p.paragraph_format.space_after = Pt(3)
    r1 = p.add_run(key)
    r1.font.bold = True
    r1.font.name = 'Calibri'
    r1.font.size = Pt(11)
    r1._element.get_or_add_rPr().get_or_add_rFonts().set(qn('w:eastAsia'), '宋体')
    r2 = p.add_run(rest)
    r2.font.name = 'Calibri'
    r2.font.size = Pt(11)
    r2._element.get_or_add_rPr().get_or_add_rFonts().set(qn('w:eastAsia'), '宋体')

# ---- 标题与说明 ----
add_title('钻爆隧洞群孪生建造与智能协同管控平台 · 技术总体架构图说明')
add_meta('配套文件：《技术总体架构图.drawio》 ｜ 编制依据：《课题6实施方案》《YX项目数字孪生专项方案》《实施方案PPT-专题2》及当前平台代码')

# ---- 引言 ----
add_para('本图描绘"钻爆隧洞群孪生建造与智能协同管控平台"的技术总体架构，自下而上由 '
         '数据源 → 数据接入 → 统一底座 → 参数化建模与映射 → 五大孪生模块 → 服务决策 → 孪生展现 七层构成；'
         '右侧以"动态更新"与"版本管理"两条纵向主线贯穿，底部汇总平台输出成果，侧边标注图形引擎与服务器资源。'
         '全图对应课题6"感知数据底板 → 孪生模型构建 → 知识图谱与生成式评价 → 协同管控平台"四大专题技术路线，'
         '落实 YX 方案"一条业务闭环、两类共性底座、五个专业模块"的总体框架。')

# ---- (1) 数据从哪来 ----
add_heading('（1）数据从哪来（数据源层）')
add_items([
    '设计资料——隧洞轴线、断面、桩号、地质勘察报告（design-rock-grades.json）；',
    '现场监测传感器——风速、温度、气体、拱顶沉降、周边收敛；',
    '超前地质预报——TSP 反演、瞬变电磁 TEM、地质雷达 GPR、超前水平钻 AHD、加深炮孔；',
    '点云与影像——爆后点云、掌子面素描（TFS）、地质影像；',
    '装备与人员——凿岩台车 ZYS113 等设备状态/位置、人员定位；',
    '外部机理模型输出——CFD 风场、围岩-支护仿真、爆破仿真；',
    '原始上传数据——TEM 的 .dat、装备几何 OBJ/STEP。',
])

# ---- (2) 怎么进入平台 ----
add_heading('（2）怎么进入平台（数据接入层）')
add_para('按"钻-爆-装-运-支"全环节、"人-机-岩-环"多要素，经四条通道进入：')
add_items([
    'REST API 采集（HTTP/JSON，设备 ID+时间戳核心字段）；',
    '文件上传 + 任务队列（multer 上传 → processing_jobs 轮询进度）；',
    '模型格式转换链（OBJ/STEP/STL → GLB；STEP→STL）；',
    '静态资源入库（public/data 下 GLB、体数据 JSON+PNG）。',
])
add_para('进入后经清洗（规则引擎+流处理、SHA-256+布隆过滤器去重、卡尔曼滤波插补）与质量评估（分层抽样、AHP-熵权 MCDM），'
         '并做时间对齐（时间戳校准/插值/DTW）与空间对齐（GPS/北斗/SIFT）。')

# ---- (3) 怎么映射 ----
add_heading('（3）怎么映射（统一底座层）')
add_para('两类共性底座支撑映射：')
add_bold_key_para('统一数据底座——', 'PostgreSQL 16 + PostGIS：对象关联、事件交换、版本管理（20 张表）；')
add_bold_key_para('统一模型管理底座——', 'Neo4j 图库：地质特征空间相交 / 风险传播链，更新/核验/发布/回滚/审计。')
add_para('统一标识 = "共性字段（对象/时间/来源/质量/版本）+ 扩展字段（桩号/断面/开挖循环）"，以桩号-里程为空间基准映射到 WGS84 经纬度。')

# ---- (4) 怎么参数化建模 ----
add_heading('（4）怎么参数化建模（建模映射层）')
add_para('五种方法：')
add_items([
    '体素化表达——256³ 体数据 + PNG 切片栈；',
    '围岩分级建模——RQD/单轴抗压/地下水/地应力 → Ⅱ-Ⅴ级着色；',
    '参数化几何建模——支护锚杆/管棚/钢架、爆破炮孔/药量/掏槽；',
    '通风网络求解——1D Hardy-Cross + 3D CFD 局部风场重构；',
    '路网拓扑 + 装备对象建模——调度场景。',
])
add_para('辅以点云配准与空间对齐（爆后轮廓三维重建）。')

# ---- (5) 各模块怎么运转 ----
add_heading('（5）各模块怎么运转（五大孪生模块层）')
add_para('围岩、爆破、支护、通风、调度五个模块，各自沿"以虚映实（映射）→ 以虚预实（预测推演）→ 以虚控实（调控决策）→ 动态更新"四段闭环运转：')

table = doc.add_table(rows=1, cols=2)
table.style = 'Light Grid Accent 1'
hdr = table.rows[0].cells
hdr[0].text = '模块'
hdr[1].text = '关键产出'
rows = [
    ('围岩', '三维围岩分级、前方状态预测、工法/爆破/支护建议'),
    ('爆破', '炮孔参数映射、爆后轮廓三维重建、爆破效果指标'),
    ('支护', '参数化几何模型、变形预测、支护方案调整'),
    ('通风', '风场重构、多工况推演、通风调控建议'),
    ('调度', '路网-装备-任务、调度规划、位置上报'),
]
for name, out in rows:
    c = table.add_row().cells
    c[0].text = name
    c[1].text = out
# 表格字体
for row in table.rows:
    for cell in row.cells:
        for p in cell.paragraphs:
            for run in p.runs:
                run.font.name = 'Calibri'
                run.font.size = Pt(10.5)
                run._element.get_or_add_rPr().get_or_add_rFonts().set(qn('w:eastAsia'), '宋体')

add_para('')
add_para('模块间通过统一接口/事件消息交换状态（携带对象标识、时间、版本、质量、来源）。')

# ---- (6) 孪生怎么展现 ----
add_heading('（6）孪生怎么展现（展现层）')
add_para('三轨图形引擎：')
add_bold_key_para('CesiumJS 1.140——', '地球 + GLB 三角网格（主引擎）；')
add_bold_key_para('原生 WebGL 1.0 体渲染——', 'ShareVolume 光线投射（富水带/破碎带/TSP/TEM）；')
add_bold_key_para('Three.js 0.185——', '爆破等子模块独立场景。')
add_para('2D 侧：ECharts + Element Plus，含场景面板（SceneManagement）、管理后台（/admin）、数据大屏。')

# ---- (7) 怎么动态更新 ----
add_heading('（7）怎么动态更新（右侧纵向主线）')
add_para('按"几何结构 / 物理状态 / 环境参数 / 行为过程"四类参数分类，'
         '执行"变化检测 → 阈值判断 → 无变化不更新 / 有变化局部更新 / 变化剧烈全局调"的更新逻辑，'
         '受时空一致性约束（时间动态误差 + 空间拓扑继承），经云端一致性评估后孪生参数同步更新，形成现场↔云端闭环。')
p = doc.add_paragraph()
r = p.add_run('指标：映射精确度 ≥85%，更新时间 ≤1h。')
r.font.bold = True
r.font.name = 'Calibri'
r.font.size = Pt(11)
r._element.get_or_add_rPr().get_or_add_rFonts().set(qn('w:eastAsia'), '宋体')

# ---- (8) 输出什么结果 ----
add_heading('（8）输出什么结果（底部成果）')
add_items([
    '三维围岩分级模型、前方地质风险预测、工法/爆破/支护建议；',
    '爆破效果评价、爆后轮廓三维重建；',
    '支护变形预测、支护方案优化；',
    '三维风场、通风调控建议；',
    '调度方案、装备位置态势；',
    '告警 + 审计报表 + AI Agent 综合决策与智能服务。',
])

# ---- (9) 图形引擎与服务器资源 ----
add_heading('（9）图形引擎与服务器资源（侧边标注）')
add_bold_key_para('图形引擎：', 'CesiumJS / WebGL 体渲染 / Three.js 三轨；')
add_bold_key_para('服务端：', 'Express 5（:3000）+ Vite 7（:5173，/api 代理）+ Python 3.13 工人进程；')
add_bold_key_para('数据库：', 'PostgreSQL 16 + PostGIS（:5432）+ Neo4j（:7687）+ Redis；')
add_bold_key_para('空间/地图服务：', 'GeoServer / CDN / Cesium Ion / 天地图；')
add_bold_key_para('大模型接口：', 'deepseek / qwen / claude / ollama。')

doc.save(OUT)
print('已生成:', OUT)
