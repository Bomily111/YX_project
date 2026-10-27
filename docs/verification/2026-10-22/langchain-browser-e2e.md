# LangChain / DeepSeek 自主装配页面回归

日期：2026-10-22。通过独立 Edge 浏览器进程访问本机 Vite 页面，将 `/api/` 转发到 3301 端口的 DeepSeek/LangChain 后端完成隔离回归。随后将主页面使用的 3000 端口后端重启为 DeepSeek；`/api/ai-agent/health` 返回 `provider=deepseek`、`model=deepseek-flash`、`hasApiKey=true`。复跑脚本为 `scripts/verify-langchain-browser.mjs`，默认使用 3000 端口；可设置 `BROWSER_API_PORT=3301` 指向隔离后端，并以 `BROWSER_SCENARIO=tem` 或 `missing-mileage` 切换任务。

| 用户任务 | 页面与模型结果 | 平台记录 |
|---|---|---|
| 在 YK1+346 同屏展示 TSP 围岩坚硬度和结构树支护组合 | 右侧对话返回 YK1+346；左侧列出两类资源，并分别标注示意重定位及 TSP 来源 | `scene-1792647581765-he6ya`，2/2 步完成；最终根资源为 `rock.tsp-hardness`、`support.legacy-assembly`，体纹理和支护组合依赖共 9 类资源为 `loaded` |
| 在 YK2+244 展示瞬变电磁视电阻率模型 | 右侧对话和左侧均显示 YK2+244、TEM 视电阻率；来源说明未误引 TSP 报告 | `scene-1792647556749-qdv67`，1/1 步完成；`rock.tem-resistivity` 为 `loaded` |
| 展示围岩完整度模型 | 模型追问目标 YK 里程，页面没有装配资源 | 页面未发起任务创建请求，左侧无任务场景 |

三条请求的 `/api/ai-agent/chat` 均返回 200；页面无脚本错误，Cesium Viewer 容器和画布存在。平台审计快照保留目标里程、步骤、实际加载资源与数据来源。

**验收边界：**无头浏览器的软件 WebGL 渲染在抓取 Cesium 画面时超时，因此上述证据确认的是模型决策、页面二维反馈、平台资源加载与任务完成状态；尚未完成逐像素的三维可见性检查。后续应在有硬件渲染的交互浏览器中查看相机位置、体纹理与支护构件的实际画面，并保存截图。

同日工具收口回归：普通同屏请求只提供 `assemble_scene_at_mileage`，同一模型响应的第二次装配调用被拒绝，明确逐层/分阶段请求仍保留阶段工具。新增用例后全量 166 项通过、1 项在线用例按默认配置跳过，资产清单 57 项和生产构建通过。主页面再次执行“YK1+346 的 TSP 坚硬度＋结构树支护组合”，只创建 1 条任务运行记录，左右面板显示 2 类目标资源，DeepSeek 接口返回 200，页面无脚本错误。三维像素验收边界同上。
