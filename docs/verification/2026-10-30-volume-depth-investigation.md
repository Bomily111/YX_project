# 体数据与支护遮挡验证（2026-10-30）

## 复现

`scripts/verify-cesium-voxel-depth.mjs` 在隔离的 Cesium 1.140 Viewer 中放置 YK1+346 的新支护 `ZZ-Va` GLB、黄色不透明盒和蓝色半透明体素。黄色盒位于体素中心后方 4 m，体素本应盖住其前部。脚本验证体素和 GLB 均进入 ready 状态，页面无控制台错误。

```
$env:SCREENSHOT_PATH='D:\project\docs\verification\2026-10-30-voxel-depth-behind.png'
node scripts/verify-cesium-voxel-depth.mjs
```

结果：黄色盒仍完整盖住体素。分别设置 `DEPTH_TEST=true` 和 `false`，两张后置黄色盒的截图像素相同（Pillow `ImageChops.difference(...).getbbox() == None`）。因此 `VoxelPrimitive.depthTest` 在此版本的渲染顺序下不足以完成体数据与普通 GLB 的双向遮挡。

原因可由本地 Cesium 源码确认：`node_modules/@cesium/engine/Source/Scene/Scene.js` 的 `executeCommands` 先调用 `performVoxelsPass`，随后才执行 `Pass.OPAQUE`。后绘制的不透明支护会覆盖前绘制的体素颜色，即使体素的采样点离相机更近。

## 可行入口

同一隔离场景增加 `PostProcessStage`，它在不透明模型绘制后读取 `colorTexture` 和 `depthTexture`。验证着色器只在无几何深度的位置叠加蓝色方框，黄色盒和支护拱架保持可见：[后处理深度探针截图](./2026-10-30-postprocess-depth-probe.png)。运行：

```
$env:POSTPROCESS_PROBE='true'
$env:SCREENSHOT_PATH='D:\project\docs\verification\2026-10-30-postprocess-depth-probe.png'
node scripts/verify-cesium-voxel-depth.mjs
```

下一步需将现有 TSP/TEM 图集纹理的射线采样移入 Cesium 后处理着色器，在每条射线上用场景深度截断采样，并保留 YK 中线的体数据变换及现有颜色映射。这个探针只证明可读取场景深度；它尚未渲染真实 TSP/TEM 数据，也不能作为生产遮挡修复。
