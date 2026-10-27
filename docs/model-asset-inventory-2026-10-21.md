# 模型与场景资源盘点（2026-10-21）

范围：`D:/project/public/data`、`D:/project/src/utils/AllPrevious/All/scene/data`，以及当前注册资源和智能体场景工作流。这里的“可用”分为：①文件存在；②页面/结构树可加载；③已注册为平台资源；④进入智能体场景资源白名单。**平台任务与资源覆盖范围统一采用工地真实中线 YK**；旧 DK 仅是兼容输入标签，通风局部 K 仅是原始数据坐标。文件存在不代表可在任意里程装配。

盘点结果：45 个 GLB、6 个 OBJ；OBJ 是原始/中间格式，页面优先加载对应 GLB。另有 JSON、PNG、DAT、CSV 等体数据、纹理和分析成果。`public/data/tem_output/latest` 与 `4ed28de3-301d-476a-9d61-30f5e7fbd2e6` 的 GLB/OBJ 内容相同，属于版本副本。

| 版块 | 文件/数据（相对 `D:/project`） | 当前用法 | 智能体自主装配 |
| --- | --- | --- | --- |
| 主场景/设计围岩 | `public/data/tunnel/tunnel000.glb`～`tunnel016.glb`（17 段）；`design-rock-grades.json`；`cross-section.json` | `common.tunnel` 是共享底座；`rock.design-grade` 按 YK 目标里程选择段并按设计等级着色，覆盖 YK1+116～YK9+400。 | 已接入 `rock.design-grade`；17 段不是 17 个独立任务资源。 |
| 围岩综合分级 | `public/data/geophysical_grade/fused_rock_grade_2345.json` + 同名 `_volume.png`；同目录还有 II～V 等 16 组筛选组合与总览数据 | 体素解释层 `rock.geophysical-grade`，示例锚点 YK2+244～YK2+344。 | 已接入；任务直接用 YK 覆盖范围调度，不能放到 YK1+346。 |
| 围岩坚硬度/完整度 | `public/data/tsp_actual/hardness.json`、`integrity.json` + 各自 `_volume.png`；同目录还有 `vs`、`vp`、`vp_vs_ratio`、`tsp_anomaly` 等解释/原始属性 | 体素解释层 `rock.tsp-hardness`、`rock.tsp-integrity`，YK2+244～YK2+344。 | 两个属性已接入，并支持中线等价的 DK 里程；其他 TSP 属性主要供原页面/分析使用。 |
| 瞬变电磁 | `public/data/geophysical_tem/resistivity_contrast.json` + `_volume.png`；同目录还有 `resistivity`、`water` 和扇形断面图；`public/data/TEM/1/线1～4.dat/.png` 是原始/二维成果 | 体素解释层 `rock.tem-resistivity`，YK2+244～YK2+303。 | 对比电阻率层已接入，并支持中线等价的 DK 里程；其余 TEM 数据未作为独立任务资源。 |
| 支护：固定构件 | `public/data/zhihu/Z-PM-23m/` 两层洞口钢筋网；`public/data/zhihu/ZZ-QJsx-44m/` 二衬钢筋两层、钢架、φ25 注浆锚杆、φ42 锁脚锚杆、φ42 注浆小导管、φ76 中管棚（合计 9 GLB） | 结构树/原界面可显示；平台有 7 个 `support.legacy-*` 子资源及 `support.legacy-assembly` 整体资源。历史资产目录仍带 DK 标签，任务覆盖范围为 YK1+116～183。 | 已接入固定构件演示；不可按任意里程拉伸或改参数，必须检查原始范围。 |
| 支护：当前生成示例 | 无固定模型文件；`src/modules/support/resources.ts` 调 `generateSteelArchGLB`、`generateWorkfaceGLB`，默认 I16、R1=6.08、R2=10.58、β=15.8797° | `support.scene` 在任务执行时生成钢拱架和掌子面，登记范围 YK1+116～YK1+616；实际模型矩阵目前取 `tunnel000` 的包围盒中心。 | 已有示例装配入口，但尚非师兄将交付的完整可调参支护模块；任务目标里程尚未驱动钢拱架定位或参数。 |
| 爆破 | `public/data/blast/blast_effect.glb`；`blast-design.json` | `blast.effect`，YK1+346～351。 | 已接入，可与设计围岩、当前支护场景在相容里程组合。 |
| 通风 | `public/data/ventilation/tunnel-assembled.glb` 为运行时场景；`tunnel-main.glb`、`source-models/left-tbm-100m.glb`、`right-drill-source.glb` 是备用/源模型；同目录稳态 CFD、瞬态网络、热场、CO 的 JSON 和图像 | `ventilation.scene` 依赖模型；局部源范围 K3+805.151～K4+005.151 示意投影到 YK1+246～YK1+446，中心 YK1+346。 | `ventilation.steady-cfd`、`ventilation.transient-network`、`ventilation.thermal-field` 已接入；`ventilation.co-analysis` 已注册但未进入当前智能体白名单。投影不是该 YK 工点实测风场。 |
| 旧风场 | `public/data/wind/suidao.glb` + `tunnel_vector`、`tunnel_streamlines.json` 等 | `DrawLine.ts` 旧风场展示。 | 未作为当前智能体任务资源。 |
| 探测：地质雷达 | `public/data/gpr/gpr1/1665832_1.glb`，同名 `.obj/.mtl`；`public/data/GPR_new/output/` 雷达剖面 JSON/BIN/PNG | `GeoModelController` 传统地质模型入口，雷达二维图另有页面。 | 尚未注册到场景任务白名单；需要明确里程和空间配准后接入。 |
| 探测：超前水平钻 | `public/data/ahd/ahd1/2320835.glb`、`ahd2/2336197.glb`，各有 `.obj/.mtl` | `GeoModelController` 传统模型入口。 | 尚未注册到场景任务白名单。 |
| 探测：掌子面 | `public/data/face_sketch/` 五处里程的原图、清理图、拟合图、遮罩图（20 张） | 运行时用图片生成掌子面照片平面，旧 TFS GLB 已停用。 | 尚未注册到场景任务白名单。 |
| 探测：TEM 异常体产物 | `public/data/tem_output/{latest,4ed28de3-...,1cf406b2-...}/anomaly_k570_4x.glb`（3 GLB）及各自 `anomaly_bodies.obj`（3 OBJ）、体素 RAW/CSV、切片图 | 传统 TEM 异常体入口默认读取 `latest`，历史任务目录可回放。 | 尚未注册到场景任务白名单；它与已接入的视电阻率体素层是两种不同成果。 |
| 施工设备 | `public/data/jumbo/jumbo_solid.glb`（约 60 MB） | 三臂凿岩台车，传统场景在 DK281+500 附近以 0.1 倍显示。 | 尚未注册到场景任务白名单；设备调度模块仍未接入。 |
| 历史遗留模型 | `src/utils/AllPrevious/All/scene/data/AHD/model.glb`、`DBH/model.glb`、`GPR/model.glb`、`GPR/model_b&w.glb`、`GPR/model_rgb.glb`、`TFS/model.glb`（6 GLB） | 源码目录中的旧资产；旧 `DataController.js` 仍留有历史路径，但当前主界面地质模型入口采用 `public/data` 下的文件/图片。 | 不在当前智能体任务资源中；不宜与公共资源重复计数为新能力。 |

## 暂不可用的占位路径

- `GeoModelController.ts` 配有 `data/weiyan/model.glb`，但 `public/data/weiyan` 为空；软弱围岩 GLB 目前不能加载。
- 同一控制器中的 `data/WATER/Water.json` 和 `data/POSUI/posui.json` 在当前 `public/data` 下不存在；富水带、破碎带入口不能视为已有可用模型。

## 对自主装配的实际含义

当前智能体的可选资源以 `src/platform/tasks/samples/SceneExplorationWorkflow.ts` 的 `SCENE_EXPLORATION_RESOURCES` 为准。**任务、资源范围、相机目标及返回里程统一使用 YK**。旧 DK 文本仅在输入边界换算，不能继续作为任务内部数值。现有同屏规则允许设计围岩、`support.scene`、爆破在相容位置组合；固定支护按原始布置与设计围岩组合。综合围岩分级、坚硬度、完整度、TEM 电阻率原生位于 YK2+244 附近，可作为连续场景阶段切换，不会被强行同屏，也不能据此证明不同来源报告为同址实测。通风的局部 K 只用于原始数据，任务范围采用其示意投影的 YK 位置。

按当前论文目标，短期可验证：在 YK1+346 附近装配设计围岩 + 爆破效果；在 YK1+139～YK1+183 展示设计围岩 + 某一固定支护构件；在 YK2+244 附近按阶段调度综合分级、坚硬度、完整度、TEM 电阻率。`support.scene` 可用来演示“生成后加入场景”，但由于现在固定在 `tunnel000` 中心，**不能作为已实现按任务里程精确装配支护的证据**。后续接入完整参数化支护模块时，应让目标里程和参数真正进入生成与定位，再保留现有固定构件作为历史样本。
