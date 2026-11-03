# TSP 深度渲染试验（已撤回生产接入）

2026-11-01 更正：后处理试验复用了原 PNG 图集文件，但重新实现了采样、透明度与配色，导致围岩模型外观改变。按用户要求，生产入口已恢复原 ShareVolume 渲染。本文件下方记录的是撤回前的试验结果，不代表当前生产效果。当前恢复结果见 [原渲染截图](./2026-11-01-tsp-original-restored.png)。

试验曾将 TSP 坚硬度、完整度的图集采样接入 Cesium `PostProcessStage`。射线与体数据包围盒求交后，使用场景深度限制采样终点。该方法未保持原渲染器的模型呈现，现仅保留为隔离实验。

验证：

- `npm run build` 通过，资源清单校验 61 个文件通过。
- `BROWSER_SCENARIO=hardness-support node scripts/verify-langchain-browser.mjs` 通过：YK1+346 新模块 ZZ-Va 支护和 TSP 坚硬度在主场景可见，后处理就绪，数据库回读到两个已加载资源及三个源文件指纹。[截图](./2026-11-01-tsp-support-depth.png)
- `BROWSER_SCENARIO=integrity node scripts/verify-langchain-browser.mjs` 通过：YK2+244 TSP 完整度可见，后处理就绪，数据库快照回读成功。[截图](./2026-11-01-tsp-integrity-depth.png)

为避免不透明参考隧道遮挡支护和围岩体数据，TSP 任务完成后隐藏参考隧道实体，保留 YK 中线。后续任务装配其他资源时恢复参考隧道。相机同时纳入目标断面和前方有效解释范围，并取消旧地质入口未结束的相机飞行。

范围：深度感知渲染目前只覆盖 TSP 坚硬度与完整度。TEM 和融合分级仍由独立 WebGL 画布绘制，遮挡关系仍需迁移验证。TSP 图集来自示例解释结果，重定位后不能作为目标里程实测结论。
