# 隧道数字孪生系统 — 后续开发方向

## 当前已完成

| 模块 | 状态 |
|------|------|
| PostgreSQL 16 + PostGIS 3.4 | 运行中，20 张表 |
| 后端 REST API | Express，12 组接口，localhost:3000 |
| 数据迁移脚本 | 中心线/工点/地质模型/支护已入库 |
| 模拟监测数据 | 7 天传感器数据（3,192 条） |
| 前端 Pinia Stores | 4 个 store（tunnel/model/monitor/scene） |
| GeoModelController | 支持从 API 动态加载模型配置 |
| SceneDataPanel | 图标/名称/颜色从 API 合并 |
| AppConfig | API 优先，本地 JSON fallback |
| 管理后台 | /admin 三页面（工点/模型/告警） |
| 主界面↔管理后台 | 双向跳通 |

## 高优先级

### 1. 监测数据可视化
把 SceneDataPanel 面板里的指标值「风速 3.2 m/s、温度 18.5°C、拱顶沉降 12.4mm」从硬编码改成 API 实时数据。
- 涉及：[SceneDataPanel.vue](src/views/Overview/SceneDataPanel.vue)、[monitorStore.ts](src/stores/monitorStore.ts)
- API 已有：`GET /api/monitoring/readings/latest?config_id=...`

### 2. 底部指标栏实时化
底部"今日进尺 3.5m / 当班爆破 2 次 / 出渣量 420m³"改成 API 数据。
- 涉及：[index.vue](src/views/index.vue)

### 3. 工点标记从数据库加载
当前工点硬编码在 index.vue 的 `worksiteList` 数组里，改成从 `GET /api/tunnels/:id/worksites` 动态加载。
- 涉及：[index.vue](src/views/index.vue)

### 4. 告警触发联动
当监测读数超出阈值时自动创建告警，ScenedDataPanel 底部告警列表实时显示。
- 涉及：后端监测写入逻辑、[alerts.js](backend/src/routes/alerts.js)

## 中优先级

### 5. Neo4j 图数据库
装 Neo4j 5.x，建以下图关系：
- 地质特征空间相交（含水带 INTERSECTS 破碎带）
- 风险传播链（含水带 → 突涌水风险 → 掌子面）
- 掌子面前方风险查询
- 配置里已预留 `neo4jServer` 字段

### 6. 监测数据可视化增强
SceneDataPanel 的折线图目前是硬编码 chartValues，改成从 `GET /api/monitoring/readings` 加载近 7 天实际数据。
- 涉及：[SceneDataPanel.vue](src/views/Overview/SceneDataPanel.vue)

### 7. 支护结构树对接 API
支护场景的结构树（管棚/锚杆/钢架可见性）当前硬编码，改成从 `GET /api/support?tunnel_id=...` 加载。
- 涉及：[SceneDataPanel.vue](src/views/Overview/SceneDataPanel.vue)

## 低优先级

### 8. 人员/设备调度 API 化
DispatchPersonnel / DispatchEquipment 组件从 API 加载数据，并支持位置上报。
- 涉及：[DispatchPersonnel.vue](src/components/SceneManagement/DispatchComponents/)、[personnel.js](backend/src/routes/personnel.js)

### 9. 用户认证启用
当前 auth 模块已写但未启用。启用 JWT 中间件保护 API，加上登录页面。
- 涉及：[auth.js](backend/src/middleware/auth.js)、[auth.js routes](backend/src/routes/auth.js)

### 10. 数据大屏
独立页面展示隧道全局态势：里程进度、围岩分布、风险热力图、设备状态、今日统计。

### 11. 部署上生产
- 生产构建 `npm run build`
- 迁移到远程 PostgreSQL
- Nginx 反向代理
- Docker 容器化

---

## 技术栈速查

| 层 | 技术 | 路径 |
|----|------|------|
| 数据库 | PostgreSQL 16 + PostGIS | `127.0.0.1:5432`，库名 `tunnel_dt`，用户 `postgres` |
| 后端 | Express 5 + pg | [backend/src/](backend/src/) |
| 前端 | Vue 3 + CesiumJS + Pinia | [src/](src/) |
| 管理后台 | /admin | [admin/](src/views/admin/) |
| 启动后端 | `cd backend && npm run dev` | :3000 |
| 启动前端 | `npm run dev` | :5173 → /api 代理到 :3000 |
