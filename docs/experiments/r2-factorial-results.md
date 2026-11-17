# 支护重点与剖切消融预实验结果

本轮对应任务自适应增强和案例实验准备，依据开题P0154—P0155、P0160及[规程](r2-factorial-protocol.md)。围绕既有坚硬度YK1+346、完整度YK2+244与ZZ-Va支护任务，检查重点显示能否独立改善覆盖问题，以及完整参照与局部参照的切换是否准确。未新增模型或工具。

## 同相机四条件观察

两任务均固定1400×900视口、局部相机、对象、变换、源数据和色标。下表链接固定中心区域；同目录保留完整页面。以下为截图定性观察，不是遮挡像素测量、人员评分或工程结论。

| 条件 | 坚硬度YK1+346 | 完整度YK2+244 | 观察及取舍 |
|---|---|---|---|
| 完整范围、原表达 | [截图](../verification/2026-11-17-r2-factorial-final/hardness-support-full-plain-center.png) | [截图](../verification/2026-11-17-r2-factorial-final/integrity-support-full-plain-center.png) | 支护仍被体渲染明显覆盖 |
| 完整范围、暖色重点 | [截图](../verification/2026-11-17-r2-factorial-final/hardness-support-full-focus-center.png) | [截图](../verification/2026-11-17-r2-factorial-final/integrity-support-full-focus-center.png) | 相比原表达变化不明显，单独着色不能消除前方覆盖 |
| 近端窗口、原表达 | [截图](../verification/2026-11-17-r2-factorial-final/hardness-support-cut-plain-center.png) | [截图](../verification/2026-11-17-r2-factorial-final/integrity-support-cut-plain-center.png) | 支护轮廓更易观察，但完整解释范围不再保留 |
| 近端窗口、暖色重点 | [截图](../verification/2026-11-17-r2-factorial-final/hardness-support-cut-focus-center.png) | [截图](../verification/2026-11-17-r2-factorial-final/integrity-support-cut-focus-center.png) | 暖色重点在剖切后更容易观察；仍需整体回看，不能据此判断地质与构件工程关系 |

这支持按任务在“局部构件辨识”和“完整范围关系”之间明确选择，而非机械叠加着色。未计算认知提升、识别正确率或统计显著性。

## 完整参照修复

复现发现，原overview只将当前显示范围整体取景；在已经剖切的任务里，显式referenceScope=full仍保留局部裁剪，不能称为完整范围。现在既有TSP任务显式full先恢复原显示范围再整体取景；未指定范围时保留当前裁剪。near-support仍为局部窗口，恢复操作还原首次分析前相机、显示范围与支护表达。每场景两次应用上限不变。

提示词更新为`2026-11-17-full-reference-v17`，明确完整/当前/局部范围及着色的覆盖限制；工具仍44项。[当前完整提示词](../agent-prompts-current-2026-11-17.md)。完整显示范围只表示当前登记显示映射，不表示源工程配准已经验证。

## 实际验证

- [最终页面报告](../verification/2026-11-17-r2-factorial-final/report.json)：两任务八条件通过，相机数值容差、支护对象身份/矩阵、图例、实际裁剪和样式不串用；消融后恢复、显式完整参照、最终复位均通过，模型请求0。
- [资产快照](../verification/2026-11-17-r2-factorial-final/asset-versions.json)：读取实际完成任务的版本快照，每任务四项源资产指纹，与报告SHA256关联；不是用事后当前文件哈希代替历史快照。
- [在线智能体报告](../verification/2026-11-17-r2-full-reference-online/report.json)：真实页面七流程通过，12次模型请求，包含装配、局部增强、本轮只读反馈、显式恢复完整范围、撤销增强及复位。[完整范围页面](../verification/2026-11-17-r2-full-reference-online/explicit-full-reference.png)已目视检查，完整解释盒回到画面，体渲染覆盖仍明确可见。
- [全量测试](../verification/2026-11-17-r2-full-reference-tests.log)：416通过、1跳过；[生产构建](../verification/2026-11-17-r2-full-reference-build.log)通过，保留既有大包提示。

初始预实验目录`2026-11-17-r2-factorial`保留，最终结论以上述final和online目录为准。验收5178在源码变更后核对归属并重启；原5173和3000服务未停止，全部未提交改动保留。

## 适用边界与后续

本轮完成有限策略语义修复、受控消融与真实页面功能验证；未完成开题的人工操作/自主装配/自主装配并增强三组人员实验。源支护适用性、TSP源200m与登记100m、异工点示意映射、三台阶交界和正式设计正文依据等原问题保留；全场景准确性、真实性、美观性基线不改为通过。

后续围绕固定任务的可回答问题、可靠答案依据与必要参照继续方法验证，再准备人员实验；不因八组截图通过而扩张无关策略或模型资源。
