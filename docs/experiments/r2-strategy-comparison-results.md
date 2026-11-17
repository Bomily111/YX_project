# 围岩与支护策略对照预实验结果

对应R2策略效果分析及R3可复现实验准备。按[预实验规程](r2-support-context-protocol.md)在两类任务、三种表达条件下完成真实页面对照。未增加产品功能、模型、工具或日志入口。原有未提交改动保留，5173/3000及5178服务未重启或停止。

## 本轮截图观察

以下为本轮截图观察，不是参与者评分或工程判断。

| 条件 | 坚硬度任务 YK1+346 | 完整度任务 YK2+244 | 取舍 |
|---|---|---|---|
| 完整范围及原整体相机 | [截图](../verification/2026-11-17-r2-strategy-comparison-final/hardness-support-combined-before.png) | [截图](../verification/2026-11-17-r2-strategy-comparison-final/integrity-support-combined-before.png) | 完整体盒范围较易观察，支护较小且被体渲染覆盖 |
| 仅支护近景，原完整范围不变 | [截图](../verification/2026-11-17-r2-strategy-comparison-final/hardness-support-support-only.png) | [截图](../verification/2026-11-17-r2-strategy-comparison-final/integrity-support-support-only.png) | 支护轮廓放大，但蓝/青色体渲染仍明显覆盖结构；拉近不能单独解决覆盖问题 |
| 近端剖切及局部参照组合 | [截图](../verification/2026-11-17-r2-strategy-comparison-final/hardness-support-combined-after.png) | [截图](../verification/2026-11-17-r2-strategy-comparison-final/integrity-support-combined-after.png) | 支护轮廓较清楚，邻近解释体保留，但远端/完整范围出画；不能据此判断整个预报区 |

支护包围球中心平面投影近似尺度在两任务中均约为120.5/514.6/319.1px。它只说明取景尺度，既不是支护可见像素，也不是识别正确率：仅近景的近似尺度更大，覆盖问题仍明显，不能按“越大越好”评价方法。

当前结果支持继续研究任务相关策略组合及重点/参照取舍，尚不能证明认知效果提升。体解释仍模糊，构件细部、地质异常与支护关系未得到工程核验；两类任务使用同一结构源及相近显示映射，不能把两例泛化为所有场景有效。

## 可复现步骤与资产控制

运行`node scripts/verify-r2-strategy-comparison.mjs`，通过VOLUME_REVIEW_CASES选择hardness-support,integrity-support，通过VOLUME_REVIEW_OUTPUT_DIR选择输出位置。使用1400×900、Edge D3D11、同一Viewer，每任务固定同一装配和支护对象矩阵。

仅支护近景后，脚本还原比较起点的相机、视角选择及取景目标，再执行组合；组合后核对原范围和相机恢复，最后复位释放。第一次运行已通过；随后补齐比较脚本对取景目标/视角选择的恢复，再次执行两任务，最终目录为`verification/2026-11-17-r2-strategy-comparison-final/`。

[真实页面报告](../verification/2026-11-17-r2-strategy-comparison-final/report.json)通过，两个任务各完成三个主要条件；另含既有固定相机三剖切条件及释放回归。页面错误0、模型请求0；本次策略效果对照不重复消耗模型余额，智能体选择沿用上一轮真实在线验证，不能把本轮写成新的模型自主实验。

运行`node scripts/capture-r2-comparison-versions.mjs`读取真实完成任务快照，输出[资产版本控制](../verification/2026-11-17-r2-strategy-comparison-final/asset-versions.json)，报告本身也取SHA-256。两个任务各4项实际快照版本：支护GLB、对应解释JSON/体纹理、对应隧道段，均保留原指纹算法与digest，不用当前文件哈希冒充历史快照。支护对象身份和矩阵在三个条件间一致。

本轮只改实验规程与脚本，未修改应用源码，因此不重复全量构建和单元测试；以实际执行脚本、页面状态/恢复和快照核验作为针对性验证。

## 尚需补齐的论文实验

本轮三条件是策略对照，不是开题的“人工操作/自主装配/自主装配并增强”三组人员实验。后续需明确参与者、任务判断答案依据、顺序控制、时间和识别/理解指标，按固定资产比较，再实施遮挡处理/重点标识消融。

下一步优先确定哪些局部参照是回答具体问题所必需，并在同一固定任务下验证。不能因本轮六组画面通过而增加无关策略或声称方法整体有效；源断面适用性、异工点数据、TSP源200m与显示100m等原问题保留。
