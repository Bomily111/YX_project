# 通风新数据交付与接入约定

当前智能体的稳态通风场复用通风版块的 `buildSteadyLayers`，由两份 JSON 同时生成 CFD 计算点、风向矢量、风场流线和动态粒子。更新数据时先保留原文件，提供新文件及以下信息，验证后再切换资源路径。

## 需要交付

1. CFD 计算点 JSON 和抽稀后的风向矢量 JSON。两份文件均包含 `meta`，以及等长的 `x`、`y`、`z`、`vx`、`vy`、`vz`、`temp`、`vel` 数值数组；`meta.x_gap` 用于区分左右主洞。`x/y/z` 的单位为米，`vx/vy/vz` 和 `vel` 为 m/s，`temp` 为 K。请注明单位如有变化。
2. 与数据对应的隧道 GLB、坐标轴定义、局部原点、左右主洞中心及纵向范围。如果继续沿用现有 `tunnel-assembled.glb`，也请明确说明。流线和动态粒子目前由上述样本在前端生成，若交付的是独立流线或粒子文件，需要另建资源适配器。
3. 工况名称、生成时间、文件版本、数据来源、适用工段及真实 YK 里程范围。若仍是异工点示例数据，说明原始里程与展示位置；不得把展示配准写成实测同址。
4. 若交付多个工况或时间片，请给每组文件一个稳定 ID，并列出它们与施工任务的对应关系。智能体只在这些受控选项中选择。

## 当前样本和接入位置

现有样本位于 `public/data/ventilation/`：`cfd_cell_data_lite.json` 有 6786 个计算点，`cfd_arrows.json` 有 208 条矢量。前者 `meta.n=6785` 与数组实际长度不符，校验只给提示，不删改原始采样。两份数据的原始纵向范围约 K3+805～K4+005，当前通过 `src/views/ventilation-module/spatialFrame.ts` 示意配准到 YK1+246～YK1+446，中心 YK1+346。

新文件接入时，在 `src/modules/ventilation/dataset-contract.ts` 的 `STEADY_DATASET_FILES` 选择文件，并在 `src/modules/ventilation/resources.ts` 注册实际使用的资产路径。若坐标系、模型或工段发生变化，同时更新 `spatialFrame.ts`、资源任务范围和来源提示；仅替换 JSON 不能保证 GLB 与流场重合。资产清单由 `scripts/generate-task-asset-manifest.mjs` 维护，以供任务快照记录文件版本。

接入验证按以下顺序执行：`validateSteadyDataset` 检查数组、数值、左右洞划分与两文件纵向范围；加载主场景确认点云、矢量、流线、粒子都生成；检查它们与隧道模型的空间关系；执行一次智能体任务并回读任务快照里的实际文件路径与指纹。现有校验不证明物理仿真正确性或同址工程意义。
