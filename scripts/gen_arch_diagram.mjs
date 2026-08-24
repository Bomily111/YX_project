// 生成"钻爆隧洞群孪生建造与智能协同管控平台 · 技术总体架构图" draw.io 文件
// 样式参考《实施方案PPT-专题2》(横向流程 + 深蓝边框 + 浅蓝标题条 + 亮蓝箭头)
// 用法: node scripts/gen_arch_diagram.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(__dirname, '..', '技术总体架构图.drawio')

// ---- 样式（对齐 PPT 配色） ----
const C = {
  container: '#000099', // 大圆角容器边框（深蓝）
  stage: '#005E9B',     // 阶段方框边框（中蓝）
  titleFill: '#BDD7EE', // 标题条填充（浅蓝）
  titleLine: '#374979', // 标题条边框（深蓝灰）
  arrow: '#00B0F0',     // 箭头（亮蓝）
  text: '#1F3864',      // 标题文字深蓝
}
const TITLE_TEXT = `text;html=1;fontSize=20;fontStyle=1;align=center;verticalAlign=middle;fontColor=${C.text};`
const SUBTITLE = `rounded=1;html=1;fillColor=${C.titleFill};strokeColor=${C.titleLine};fontSize=12;align=center;verticalAlign=middle;`
const STAGE = `rounded=1;html=1;fillColor=#FFFFFF;strokeColor=${C.container};strokeWidth=1.5;verticalAlign=top;`
const TITLE_BAR = `rounded=1;html=1;fillColor=${C.titleFill};strokeColor=${C.titleLine};fontStyle=1;fontSize=13;align=center;verticalAlign=middle;`
const BOX = `rounded=1;html=1;whiteSpace=wrap;fillColor=#FFFFFF;strokeColor=${C.stage};fontSize=11;align=center;verticalAlign=middle;spacing=6;`
const BOX_EMPH = `rounded=1;html=1;whiteSpace=wrap;fillColor=${C.titleFill};strokeColor=${C.container};fontSize=11;align=center;verticalAlign=middle;spacing=6;`
const STRIP = `rounded=1;html=1;fillColor=#F2F7FC;strokeColor=${C.stage};verticalAlign=top;`
const EDGE = `html=1;endArrow=block;endFill=1;strokeColor=${C.arrow};strokeWidth=4;edgeStyle=orthogonalEdgeStyle;exitX=1;exitY=0.5;entryX=0;entryY=0.5;rounded=1;`
const EDGE_SM = `html=1;endArrow=block;endFill=1;strokeColor=${C.arrow};strokeWidth=2.5;edgeStyle=orthogonalEdgeStyle;exitX=1;exitY=0.5;entryX=0;entryY=0.5;rounded=1;`

// ---- 工具 ----
const v = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const br = (s) => s.replace(/\n/g, '<br>')
const cells = []
function cell({ id, value = '', style = '', x, y, w, h, source, target, edge = false }) {
  const geom = edge
    ? `<mxGeometry relative="1" as="geometry"/>`
    : `<mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/>`
  const attrs = edge
    ? `edge="1" parent="1" source="${source}" target="${target}"`
    : `vertex="1" parent="1"`
  cells.push(`<mxCell id="${id}" value="${v(value)}" style="${style}" ${attrs}>${geom}</mxCell>`)
  return id
}

// ---- 布局常量 ----
const PX = 20, PW = 1660          // 页宽内容区
const COL_W = 390, COL_GAP = 33   // 四列
const COL_X = [PX, PX + COL_W + COL_GAP, PX + 2 * (COL_W + COL_GAP), PX + 3 * (COL_W + COL_GAP)]

// ---- 标题 ----
cell({ id: 'title', value: '钻爆隧洞群孪生建造与智能协同管控平台 · 技术总体架构图', style: TITLE_TEXT, x: PX, y: 10, w: PW, h: 40 })
cell({ id: 'subtitle', value: '一条业务闭环 · 两类共性底座 · 五个专业模块　｜　数据从哪来 → 接入 → 映射 → 参数化建模 → 模块运转 → 孪生展现 → 动态更新 → 成果输出 → 引擎与资源', style: SUBTITLE, x: PX, y: 56, w: PW, h: 34 })

// ---- 四阶段容器 ----
const STAGE_Y = 102, STAGE_H = 470
const stageIds = []
const stages = [
  { id: 'S1', title: '① 感知体系与数据底板（专题6.1）', boxes: [
      { t: '<b>数据源（数据从哪来）</b><br>设计资料 · 监测传感器<br>超前地质预报 TSP/TEM/GPR/AHD<br>点云影像 · 装备人员<br>机理模型 · 上传数据', h: 130 },
      { t: '<b>接入通道（怎么进入平台）</b><br>REST API（HTTP/JSON）<br>文件上传 + 任务队列<br>模型转换链 OBJ/STEP/STL→GLB<br>清洗 · 质量评估 · 时空对齐', h: 130 },
      { t: '<b>统一底座（怎么映射）</b><br>PostgreSQL+PostGIS<br>（对象关联/事件/版本）<br>Neo4j（空间关系/风险链）<br>统一标识 · 版本/核验/发布/审计', h: 130 },
  ]},
  { id: 'S2', title: '② 参数化建模与空间映射（专题6.2）', boxes: [
      { t: '<b>空间映射</b><br>桩号/里程<br>→ 经纬度 WGS84', h: 90 },
      { t: '<b>体素化与围岩分级</b><br>256³ 体数据 + PNG 切片<br>RQD/抗压/地下水/地应力<br>→ Ⅱ-Ⅴ级着色', h: 120 },
      { t: '<b>参数化建模</b><br>支护（锚杆/管棚/钢架）<br>爆破（炮孔/药量/掏槽）<br>通风（1D Hardy-Cross+3D CFD）<br>路网拓扑 + 装备（调度）<br>点云配准（爆后轮廓）', h: 170 },
  ]},
  { id: 'S3', title: '③ 五大专业孪生模块（专题6.2）', note: '各模块四段闭环：以虚映实 → 以虚预实 → 以虚控实 → 动态更新', boxes: [
      { t: '<b>围岩</b><br>分级 · 前方预测 · 工法建议', h: 64, emph: true },
      { t: '<b>爆破</b><br>炮孔 · 爆后轮廓 · 效果指标', h: 64, emph: true },
      { t: '<b>支护</b><br>几何模型 · 变形预测 · 方案调整', h: 64, emph: true },
      { t: '<b>通风</b><br>风场重构 · 推演 · 调控建议', h: 64, emph: true },
      { t: '<b>调度</b><br>路网 · 装备 · 调度规划', h: 64, emph: true },
  ]},
  { id: 'S4', title: '④ 知识图谱 · 大模型 · 管控平台（专题6.3/6.4）', boxes: [
      { t: '<b>知识图谱 + 大模型</b><br>Neo4j 检索 · 场景注入<br>LLM deepseek/qwen/claude/ollama<br>五维评价 安全/质量/进度/成本/环保', h: 130 },
      { t: '<b>服务决策</b><br>预测推演（以虚预实）<br>调控决策（以虚控实）<br>告警', h: 100 },
      { t: '<b>孪生展现（怎么展现）</b><br>CesiumJS（地球+GLB）<br>WebGL 体渲染 ShareVolume<br>Three.js（子模块）<br>2D UI ECharts/Element Plus/大屏', h: 140 },
  ]},
]

stages.forEach((st, ci) => {
  const cx = COL_X[ci]
  const cid = cell({ id: st.id, value: '', style: STAGE, x: cx, y: STAGE_Y, w: COL_W, h: STAGE_H })
  stageIds.push(cid)
  cell({ id: `${st.id}_title`, value: st.title, style: TITLE_BAR, x: cx + 10, y: STAGE_Y + 10, w: COL_W - 20, h: 44 })
  let y = STAGE_Y + 64
  if (st.note) {
    cell({ id: `${st.id}_note`, value: st.note, style: BOX, x: cx + 12, y, w: COL_W - 24, h: 40 })
    y += 48
  }
  st.boxes.forEach((b, i) => {
    cell({ id: `${st.id}_b${i}`, value: br(b.t), style: b.emph ? BOX_EMPH : BOX, x: cx + 12, y, w: COL_W - 24, h: b.h })
    y += b.h + 10
  })
})

// 阶段间横向箭头
for (let i = 0; i < 3; i++) {
  cell({ id: `arrow_s${i}`, value: '', style: EDGE, edge: true, source: stageIds[i], target: stageIds[i + 1] })
}

// ---- 底部横条 1：动态更新 ----
const U_Y = 586, U_H = 128
cell({ id: 'strip_update', value: '动态更新机制（低延时）', style: STRIP, x: PX, y: U_Y, w: PW, h: U_H })
const updItems = [
  { t: '参数分类<br>几何/物理/环境/行为' },
  { t: '变化检测<br>阈值判断' },
  { t: '无变化不更新<br>有变化局部更新<br>变化剧烈全局调' },
  { t: '时空一致性约束<br>时间误差 + 空间拓扑' },
  { t: '云端评估<br>→ 同步更新 → 闭环' },
  { t: '指标：映射精确度 ≥85%<br>更新时间 ≤1h', emph: true },
]
{
  const bw = 252, gap = 14, total = bw * 6 + gap * 5
  const sx = PX + (PW - total) / 2
  updItems.forEach((item, i) => {
    cell({ id: `upd_${i}`, value: br(item.t), style: item.emph ? BOX_EMPH : BOX, x: sx + i * (bw + gap), y: U_Y + 34, w: bw, h: 66 })
    if (i < 5) cell({ id: `upd_a${i}`, value: '', style: EDGE_SM, edge: true, source: `upd_${i}`, target: `upd_${i + 1}` })
  })
}
// 动态更新 与 模块层 的关联箭头（上指）
cell({ id: 'upd_link', value: '状态变化触发更新 / 参数回写', style: `html=1;endArrow=block;endFill=1;startArrow=block;startFill=1;strokeColor=${C.arrow};strokeWidth=2;edgeStyle=orthogonalEdgeStyle;exitX=0.5;exitY=0;entryX=0.5;entryY=1;rounded=1;`, edge: true, source: 'strip_update', target: stageIds[2] })

// ---- 底部横条 2：成果输出 ----
const O_Y = 726, O_H = 96
cell({ id: 'strip_out', value: '平台输出成果（终端交付）', style: STRIP, x: PX, y: O_Y, w: PW, h: O_H })
const outItems = ['三维围岩分级模型', '前方地质风险预测', '工法/爆破/支护建议', '爆后轮廓·爆破评价', '支护变形预测·方案优化', '三维风场·通风建议', '调度方案·装备态势', '告警·审计·AI决策']
{
  const count = outItems.length
  const bw = Math.floor((PW - 32 - 12 * (count - 1)) / count)
  const total = bw * count + 12 * (count - 1)
  const sx = PX + (PW - total) / 2
  outItems.forEach((t, i) => {
    cell({ id: `out_${i}`, value: t, style: BOX, x: sx + i * (bw + 12), y: O_Y + 32, w: bw, h: 50 })
  })
}

// ---- 底部横条 3：引擎与资源 ----
const R_Y = 834, R_H = 108
cell({ id: 'strip_res', value: '图形引擎与服务器资源', style: STRIP, x: PX, y: R_Y, w: PW, h: R_H })
const resItems = [
  '图形引擎<br>CesiumJS / WebGL / Three.js',
  '前端<br>Vue3 + Vite7（:5173）',
  '后端<br>Express5（:3000）+ Python 工人',
  '数据库<br>PostgreSQL+PostGIS / Neo4j / Redis',
  '地图服务<br>GeoServer / CDN / Cesium Ion / 天地图',
  '大模型<br>deepseek / qwen / claude / ollama',
]
{
  const count = resItems.length
  const bw = Math.floor((PW - 32 - 12 * (count - 1)) / count)
  const total = bw * count + 12 * (count - 1)
  const sx = PX + (PW - total) / 2
  resItems.forEach((t, i) => {
    cell({ id: `res_${i}`, value: br(t), style: BOX, x: sx + i * (bw + 12), y: R_Y + 32, w: bw, h: 62 })
  })
}

// ---- 组装 ----
const pageH = R_Y + R_H + 20
const xml = `<mxfile host="app.diagrams.net" modified="2026-08-24T00:00:00.000Z" agent="claude-code" version="24.0.0" type="device">
  <diagram id="arch" name="技术总体架构图">
    <mxGraphModel dx="1422" dy="794" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1700" pageHeight="${pageH}" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        ${cells.join('')}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
`
fs.writeFileSync(OUT, xml, 'utf-8')
console.log('已生成:', OUT)
