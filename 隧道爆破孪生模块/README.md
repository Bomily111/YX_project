# 隧道爆破孪生 · 调试模块

把 **YL 交通隧道正洞（Ⅳ级全断面）的爆破炮孔设计 + 爆后三维点云**，精确对齐嵌入到
**隧道三维模型**内的一个断面，做成一个**独立可运行、也可直接接入主平台**的轻量模块。

- 技术栈：**Vue 3 + Vite + CesiumJS**（与主平台一致）
- 断面：正洞 Ⅳ级全断面光面爆破，开挖宽 **12.40 m**，185 个装药孔
- 承载：隧道段 `tunnel000.glb`，桩号 250 m 处（弯道切线已校正）

---

## 一、独立测试运行

**方式 A（推荐）**：右键 `启动.ps1` → 使用 PowerShell 运行。
首次会自动 `npm install`，就绪后自动打开浏览器。关闭窗口即停止。

**方式 B（手动）**：
```bash
npm install
npm run dev        # 打开 http://localhost:5173/
```

> 需要 Node.js（含 npm）。不需要 Cesium ion Token、不需要后端、不联网也能跑
> （已关闭地球/地形/影像，只渲染隧道 + 爆破）。

### 功能一览
- **四个视角**：透视 / 正视掌子面 / 侧视 / 俯视（相机沿真实隧道轴向推导）
- **退出**：恢复带纹理的整体隧道 + 总览视角（与透视同方位，只拉远，不转圈）
- **图层控制**（左上）：隧道模型 / 爆破效果 / 二维设计图（勾选即在面板下方显示二维炮孔布置图 + 参数）
- **轨道控制器**：左键环绕 / 右键平移 / 滚轮缩放（绕断面中心，已修复无地球时的缩放/倾斜甩飞黑屏）
- **性能**：只加载 1 段隧道（68 MB）+ 按需渲染（空闲 0 GPU），拖拽流畅

---

## 二、接入主平台

模块核心就是 `src/tunnel-module/` 这 5 个文件，**自包含、只依赖 Vue + Cesium**：

| 文件 | 作用 |
| --- | --- |
| `scene.ts` | 极简 Cesium 场景 + 轨道控制器（可选，主平台已有 Viewer 时不用） |
| `tunnel.ts` | 隧道段加载 / 半透明；`segmentModelMatrix()` 段放置矩阵 |
| `blast.ts` | 爆破效果 GLB 加载 / 视角飞行 / 断面信息常量 |
| `TunnelModule.vue` | 整个 UI（图层、视角按钮、退出、二维设计图小窗）+ 编排 |
| `Design2DPanel.vue` | 二维炮孔布置图小窗（fetch 设计 JSON 渲染 SVG） |

### 接入步骤
1. 拷贝 `public/data/blast/`（`blast_effect.glb` + `blast-design.json`）到平台 `public/data/blast/`。
   （隧道段 `tunnel000.glb` 平台通常已有；本模块用的就是它。）
2. 二选一：
   - **整体挂载**：把 `src/tunnel-module/` 整个目录拷进平台，作一个路由/页面挂载 `TunnelModule.vue`。
   - **函数级接入**：只取 `blast.ts` 的 `loadBlast / flyToBlast / setBlastVisible`
     和 `tunnel.ts` 的 `segmentModelMatrix`，在平台已有的 Cesium `Viewer` 里调用。
     （主平台 `DrawLine.ts` 里已有对应的 `loadBlastEffect/...` 版本，可直接复用。）
3. **对齐原理（关键）**：GLB 几何已把「段内放置（桩号 250、弯道切线校正、沿隧道翻转）」
   **烘焙进坐标**，落在 `tunnel000.glb` 自身坐标空间。所以加载时用**与该隧道段完全相同的
   `modelMatrix`** 即精确对齐，无需再做任何变换：
   ```ts
   const M = Cesium.Transforms.headingPitchRollToFixedFrame(
     Cesium.Cartesian3.fromDegrees(94.8943747778, 29.5328943333, 2943.001),
     new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(90), 0, 0))
   Cesium.Model.fromGltfAsync({ url: 'data/blast/blast_effect.glb', modelMatrix: M })
   ```
4. 炮孔用 **无光照(UNLIT)** 渲染（`blast.ts` 里 `customShader`），保证颜色鲜亮不被压暗。

> 换断面位置：改承载段/桩号后需**重新生成 GLB**（见下）。

---

## 三、数据与重新生成（可选）

现成数据已在 `public/data/`，**开箱即用**。若要改设计/断面/点云，用 `数据生成脚本/`：

```
数据生成脚本/
├── build_design.py        # 由 图4.4-5 布置图 生成 正洞设计(轮廓+185孔+3D姿态/颜色) -> blast-design.json
├── process_pointcloud.py  # 爆后点云(3.las) -> 拉伸贴合 + 嵌入壳体 + 配色 -> pointcloud npy
├── compute_placement.py   # 由 tunnel000.glb 求桩号250处放置矩阵(弯道切线校正) -> placement.json
├── export_glb.py          # 打包 炮孔+点云 -> blast_effect.glb(段内放置已烘焙)
└── source/                # 方案 图4.4-5 正洞炮眼布置图(设计基准)
```

依赖：`python + numpy + laspy + PIL + scipy + trimesh`。
⚠️ **原始扫描 `3.las`（约 30 MB）未随包提供**（体积大且属现场数据）；重跑点云需自备。
只改设计/颜色/孔深不涉及点云时，改 `build_design.py` 后跑 `build_design.py → export_glb.py` 即可，
再把 `blast_effect.glb` 与 `blast-design.json` 拷回 `public/data/blast/`。

常用可调参数：
- 炮孔颜色/孔深/插角：`build_design.py` 顶部 `CATEGORY` 与 `HOLE_DEPTH_M`
- 点云配色：`process_pointcloud.py` 里 `cold/hot`
- 断面位置：`compute_placement.py` 里 `SEG_INDEX / STATION`（改后重跑全流程）

---

## 四、目录结构

```
隧道爆破孪生模块/
├── 启动.ps1                    一键启动(独立测试)
├── README.md
├── package.json / vite.config.ts / tsconfig.json / index.html
├── src/tunnel-module/          ★ 接入主平台就用这个目录
│   ├── scene.ts  tunnel.ts  blast.ts
│   ├── TunnelModule.vue  Design2DPanel.vue
│   ├── main.ts                 独立运行入口
│   └── env.d.ts
├── public/data/
│   ├── tunnel/tunnel000.glb    承载隧道段(66 MB)
│   └── blast/
│       ├── blast_effect.glb    爆破效果(炮孔+点云, 段内放置已烘焙)
│       └── blast-design.json   二维设计数据(轮廓/孔位/颜色/参数)
└── 数据生成脚本/                数据重生成(可选) + 设计基准图
```

---

## 五、断面信息

| 项 | 值 |
| --- | --- |
| 断面 | 正洞 Ⅳ级 全断面光面爆破 |
| 开挖宽 × 拱顶高 | 12.40 m × 9.03 m |
| 循环进尺 | 2.2 m |
| 炮孔总数 | 185（周边 49 / 掏槽 11 / 辅助 95 / 底板 30） |
| 孔径 | φ45 mm |
| 爆后点云 | 45 万点（3.las，拉伸贴合并嵌入壳体） |

> 三维孔深/插角为按类别经验值；点云为代表性爆后扫描（疑似他洞），如需真实对应，
> 换成本断面实测扫描后重跑 `process_pointcloud.py → export_glb.py` 即可。
