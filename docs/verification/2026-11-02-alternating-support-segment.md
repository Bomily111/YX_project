# 单段隧道交替支护装配验证

- 目标任务示例：`在 YK1+346 所在隧道段交替装配 ZZ-Va 和 Z-PM，检查支护布置`。
- 调度资源：`support.alternating-zz-va-z-pm`。目标 YK1+346 落在首段，装配范围改为 YK1+321—YK1+371，共 50 个连续 1 m 位置，ZZ-Va 和 Z-PM 各 25 个。目标接近隧道模型段边界时，50 m 范围收束在该段内。
- ZZ-Va 使用支护模块现有 1 m GLB；Z-PM 使用同一支护编辑器的 `createZpmAssembly` 生成并导出 1 m GLB。Z-PM 目前仅含二衬及 N1–N7 钢筋，属于部分断面。
- 每个断面沿平台 YK 中线计算位置和朝向，Z-PM 的设计高程原点与 ZZ-Va 统一。生成结果使用 `EXT_mesh_gpu_instancing` 复用断面几何。
- 保留源网格索引后，`node scripts/verify-alternating-support.mjs` 测得 50 m 实例化 GLB 为 13,129,336 字节（原为 33,970,792 字节），77 个构件节点各 25 个实例。Cesium `Model.fromGltfAsync` 达到 ready 状态；按实际 YK 空间矩阵加载后，模型包围球中心距 YK1+346 中线点约 4.64 m。
- 相关 Vitest 测试 21 项通过；`npx vue-tsc -b --pretty false` 通过；`npm run assets:check` 通过。
- 主界面 DeepSeek/LangChain 端到端回归：请求 YK1+346 附近 50 m 交替支护后，智能体选择 `support.alternating-zz-va-z-pm`，任务 `completed 1/1`，仅聚焦并加载 `tunnel000`。支护与隧道 Cesium 模型均达到 ready；支护包围球半径约 28.36 m，隧道段包围球半径约 255.42 m，两中心相距约 26.71 m。数据库快照回读到两份支护 GLB 的 SHA-256 源文件指纹。无头软件 WebGL 的全页截图仍超时，故此处验证的是加载与空间包围关系，不作逐像素可见性结论。
- 智能体任务语义回归：输入“YK1+346 初期支护施工交底，需要核对前后 50 米连续作业段内两种已接入断面的衔接布置”，没有点名 ZZ-Va、Z-PM 或资源 ID；DeepSeek 仍选择交替支护资源并完成主场景装配，数据库回读 `completed 1/1` 和两份 GLB 指纹。系统提示词现区分单断面核对与连续段衔接任务。
- 场景二维反馈已从实际资源状态读取支护起止里程与断面数量：左侧显示 YK1+321—YK1+371、ZZ-Va 25 与 Z-PM 25，底部显示相同范围和总数。真实页面回归通过；支护与 tunnel000 均 ready。回归脚本通过资源注册表读取活动 Cesium 模型，避免热更新后直接导入模块副本造成的误判。
- 本次验证确认模型可加载及装配范围与数量；Z-PM 的钢筋图纸适用关系仍沿用支护模块的 `NEEDS_CONFIRMATION` 状态，场景仅用于装配演示。
