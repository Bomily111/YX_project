# 智能体支护与目标隧道段回归（2026-11-02）

问题：主场景按相机周围 1500 m 懒加载多个公共隧道段；智能体加载新支护 GLB 时缺少支护版块使用的 `upAxis: Z`、`forwardAxis: X`，造成同一模型在两处朝向不同。

修正：智能体装配时按 YK1+116 起、每 500 m 一段聚焦目标 GLB，卸载其他已加载段，跳过仍在异步加载但已不属于目标的段；退出任务场景后恢复常规懒加载。支护模型入口使用与支护版块相同的轴设置，并按该版块的中线局部坐标构造位置。

回归：`BROWSER_SCENARIO=modeler-support node scripts/verify-langchain-browser.mjs` 在 YK1+346 完成支护装配，Viewer 状态 `focused: 0, loaded: [0]`，对应唯一的 `tunnel000.glb`。数据库快照回读已加载的 `support.modeler-zz-va` 和源 GLB 指纹。`npx vue-tsc -b --pretty false` 通过。见[同屏截图](./2026-11-02-support-target-segment.png)。截图中隧道外壳为不透明状态，遮挡部分支护；这是当前主界面图层透明度设置，支护几何已按支护版块的坐标轴装配。
