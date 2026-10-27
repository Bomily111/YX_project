# 通风资产选择进入任务快照

任务面板新增“生成通风工况预览”“生成通风热场预览”。执行场景步骤后，可在同一任务中选瞬态工况或热场时间片；成功加载后追加 `asset-selection` 结果节点。历史回看仍只读，不重建旧三维场景。

2026-10-19 本地前后端真实页面验收：

| 任务 | 步骤完成节点 | 选择节点（数据库读回） |
| --- | --- | --- |
| `scene-1792385618142-hqojv` | `61`：默认 `transient_fan_ramp_up.json` | `62`：`transient_fan_shutdown.json`，SHA-256 `c680bc6abb223647…` |
| `scene-1792385665632-izc5j` | `65`：热场索引和监测数据 | `66`：增加 `cfd_transient_t200s.json`，SHA-256 `cef3b0b3280fd292…` |

完整路径、哈希和资源状态见 [数据库 API 读回](history-readback.json)。页面截图：[工况节点](transient-selection.png)、[热场节点](thermal-selection.png)。最终复位快照 `67` 的任务资源为空；诊断显示 `ventilation.scene`、`ventilation.transient-network`、`ventilation.thermal-field` 均为 idle/0 引用，增强计划和指令为 0，控制台错误为空。

`npm test -- --run`：22 文件、122 项通过；`npm run build` 与 49 文件资产哈希校验通过。构建仅保留既有 Sass 弃用和大 chunk 提示。通风数据原始区间 K3+805～K4+005，DK278+330 仍只是示意展示位置，不能用于同址工程判断。
