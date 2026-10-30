# 围岩支护参数化模块接入

平台“围岩支护”入口现打开 `/support-modeler`，原 `/support-experiment` 路由重定向至此。页面上方可切换原交付概览、单断面编辑器和 1064 m 线路展示；页面的原有链接仍可直接互相跳转。Three.js 页面放在同源 iframe 中，原有构件树、类型切换、参数编辑、空间检查、Variant 本地库及 JSON 导入导出、GLB/metadata 导出均由交付代码运行。

支护页现与围岩、爆破、通风版块采用同样的 60 px 顶栏、216 px 左目录和蓝黑色右侧信息栏。左目录可切换模块概览、单断面编辑、1064 m 支护区段，也可进入其他平台版块。编辑器和沿线页面原有的参数、Variant、构件和导出控件仍保留在右栏；iframe 内容宽度窄于 900 px 时，右栏改由“参数与构件”按钮展开。该适配仅修改平台公开副本的布局，不修改便携服务的独立页面。

静态前端位于 `public/support-modeler/`，对应交付包 `runtime_package/app_data/` 的 `index.html`、`demo/`、`outputs/`、`database/`。同包的 Windows 便携服务位于 `backend/support-modeler-runtime/`，保留其原有 Python 源码、配置和 OCR 依赖。平台后端首次访问 `/api/support-modeler/health`、`/api/support-modeler/master/drawing` 或 `/api/support-modeler/master/demo-cache` 时启动本地便携服务，并代理图纸 API。端口默认 18080，可用 `SUPPORT_MODELER_PORT` 调整。部署时需一起保留该目录并在 Windows 上启动平台后端。

前端公开副本仅将图纸 API 地址从 `/api/master/` 改为平台代理地址；便携服务自身文件保持原样。图纸原件、PDF 密码和历史 OCR 缓存不在交付包内，因此“真实缓存演示”在没有缓存时会显示不可用，上传识别仍可使用原有链路。

本次浏览器验证：单断面 ZZ-Va 页面及 1064 m 页面均无失败资源或脚本错误；1064 m 显示 21/23 段装配、Z-PM 和 TZ-III 两段仅范围。交付包引用的 `centerLine.json` SHA256 与平台 `src/assets/data/centerLine.json` 一致，但交付包把首点定义为 `YK1+098`，平台 `ChainageService` 把同一点定义为 `YK1+116`，相差 18 m。用户已确定**以平台里程为准**：交付包沿中线距离 0～1064 m 在平台解释为 YK1+116～YK2+180；交付包标注的里程只保留为来源字段，不作为任务或场景里程。平台 Cesium 页现已用 `1116 + centerline_distance_m` 定位区段，并在嵌入页显示平台里程。交付 GLB 仍保留原始几何与来源文件名；高程与网格配准还需独立校验，不能据此宣称 Cesium 坐标验收完成。

## 智能体装配接入状态

智能体场景资源已注册新模块交付的 13 类 1 m 断面 GLB（`outputs/multi_support/` 中的 12 类，以及 `outputs/master_demo/` 中的 ZZ-Va），资源 ID 为 `support.modeler-zz-*`，默认组合为 `support.modeler-zz-va`。模型以目标平台 YK 中线点为断面设计高程点；交付断面局部坐标 `(0,-2.1,0)` 映射到该点，局部 z 轴沿里程增大方向。场景任务实际使用的 GLB 路径进入资产指纹清单。旧结构树资源已从智能体白名单和模块注册表移除；旧历史记录只保留查看用途。

智能体目前调度的是**已导出的断面模板**。支护编辑页参数更改后的新 GLB 尚未作为任务输入由智能体生成和装配，不能把这一步称为“按任务参数动态生成”。1064 m 沿线 GLB也仍由支护专页展示，不作为任意里程的 1 m 断面资源。

后续若要按对话参数重新生成支护，应将编辑器或服务的参数输入、生成 GLB 与元数据输出接到任务执行和快照，并增加参数边界、模型版本与几何检查。当前交付模型的局部原点映射已在 YK1+116、YK1+346、YK2+170 做数值回归；真实图纸高程与隧道/围岩网格的视觉配准仍需页面联测。

旧结构树的加载实现、旧资源回归脚本和当前界面入口已删除；智能体白名单、模块注册表及新任务资产清单也不再包含旧支护。历史快照及来源 GLB 目录暂留供追溯，新任务不会加载这些文件。

回归记录：`tests/platform/modeler-support-resources.test.ts` 验证 13 类资源及设计高程点定位；结构树支护与场景工作流测试保持通过。浏览器以“在 YK1+346 主场景展示新支护模块的 ZZ-Va 支护组合”发起真实对话，任务 `scene-1793331470561-3uzwb` 完成，数据库快照读回 `support.modeler-zz-va` 和 `/support-modeler/outputs/master_demo/ZZ-Va_support_1m_current.glb` 的内容指纹，页面无脚本错误。此验证确认资源调度和模型加载，不等于图纸高程的现场测量验收。
