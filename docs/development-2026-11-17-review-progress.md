# 智能体核查步骤与未回答问题 · 2026-11-17

继续智能体主线，保留全部未提交改动，不创建提交或停止原5173/3000。本轮不补建模型。

## 行为变化

当前场景自检新增`evidenceProgress`：记录实际进入的支护核查步骤、步骤问题、边界、当前源路径、访问序号及时间。`visited-not-answered`只表示进入过步骤，`questionsStatus=unanswered-requires-task-evidence`保留，不能将打开来源、定位或回看作为设计正文已读、问题已回答或验收。

定位记录增加当时的`reviewStep`（ID、问题及边界）。从末站邻近区步骤触发定位时，显式传入该步骤，避免按钮状态更新之前把新定位错误记为旧步骤。记录复制上下文，不因后续切换或外部数组/对象改动重写。

位置与步骤历史各保留最近100条，并报告total/retained/omitted。智能体须说明截断范围，不把当前保留记录当作全部历史。任务切换与复位同时清理两类记录；非完成场景不返回旧进度。

提示词版本`2026-11-17-review-progress-v11`，完整清单`agent-prompts-current-2026-11-17.md`。

## 验证证据

- `verification/2026-11-17-review-progress-online/report.json`：真实Edge D3D11页面、在线模型与工具审计，装配/步骤交互、只读定位查询、复位3流程通过。实际二维-4.7m、三维-3.9m、末站约-0.7m三条记录，末站记录正确属于interface步骤；interface/components/evidence/conclusion四个实际步骤保留，均未标作回答完成。模型本轮解释了步骤访问与正文/验收之间的区别。
- `verification/2026-11-17-review-progress-audit.json`：独立核对三条记录与装配行、任务快照及四项源文件当前SHA-256，通过。不是历史文件内容证明或设计适用性核验。
- 全量400项通过、1跳过：`verification/2026-11-17-review-progress-tests.log`。新增历史截断统计、步骤上下文复制及不判回答完成的回归。
- 类型检查`review-progress-types.log`通过；构建`review-progress-build.log`通过。
- 原有视觉分析9流程全部通过、19次实际模型请求、页面错误0：`verification/2026-11-17-review-progress-visual-regression/report.json`。

## 限制与后续

当前记录是交互过程和待核查问题，不是自动工程判断。尚缺对应工段设计正文、页码与实测资料，因此不能把记录组织能力说成完整文字依据链。源支护适用性、Z-PM部分资料、TSP长度映射、模型深度遮挡和全平台美观基线均按原台账保留。下一步继续完善任务步骤、选中对象和真实资料的关联，再逐项验证具体分析问题是否可回答。
