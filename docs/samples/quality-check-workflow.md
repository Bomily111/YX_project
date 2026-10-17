# 围岩变化与初期支护质量检查样例

更新日期：2026-10-12

## 任务示例

```text
检查 DK278+330 至 DK278+340 围岩变化后初期支护是否合理。
```

对应任务类型为 `quality-check`，推荐工序为 `support-design`，目标类型为 `initial-support`。

## 执行流程

1. `rock.assess-quality`
   - 根据任务里程选择 `rock.design-grade`，复用 `common.tunnel` 的对应精细分段并应用设计围岩着色、轮廓、任务标签和标准视点。
   - 读取设计围岩分级区段和任务范围内的掌子面素描。
   - 输出 `rock.grade`、`rock.anomalies` 和 `rock.confidence`。
2. `support.check-adaptation`
   - 从共享上下文读取围岩等级和异常。
   - 加载并增强 `support.scene`。
   - 查询任务隧洞的支护构件记录，输出 `support.deviation`、`support.assessment` 和 `task.summary`。

两个步骤由 `WorkflowExecutor` 串行推进，并共享同一个 `ScenePlanExecutor` 与 `EnhancementEngine`。进入第二步时先加载支护场景，再释放围岩任务资源；第二步失败时会恢复围岩场景，随后工作流事务统一回滚。任务复位会清空步骤输出并恢复执行前状态。

## 围岩证据规则

- 平台 `DK278+...` 里程先通过 `ChainageService` 转为设计模型的 `YK1+...` 里程，再与 `design-rock-grades.json` 比较。
- 局部 `X1DK2+...` 掌子面素描尚无正式平台变换，只在任务数值直接落入其原始范围时使用，禁止近似拼接到平台 DK 里程。
- 多项证据命中时取最不利围岩等级。
- 掌子面证据置信度暂定为 `0.92`，仅有设计分级时为 `0.75`，没有证据时明确输出 `unknown/0`，不虚构结果。
- 素描中的局部破碎、较大出水和松弛掉块会转换为结构化异常描述。

## 支护检查规则

第一版规则用于软件流程验证，不替代正式工程规范校核：

- III 级围岩要求存在喷射混凝土和锚杆记录。
- IV/V 级围岩还要求存在钢架记录。
- 构件完成率低于 100% 记为偏差，低于 80% 记为重大偏差。
- 已填写质量等级但不是合格、优良、A 或 pass 时记为重大偏差。
- 同时存在设计值和实测最小值时，低于设计值 90% 记为重大偏差。
- 没有任务范围内记录时输出 `insufficient-data`，不判定合格或不合格。

正式项目接入规范参数后，应把阈值迁移到有版本号的工程规则配置，并在任务日志中记录规则版本。

## 实现入口

- 围岩动作：`src/platform/tasks/actions/RockAssessmentAction.ts`
- 围岩场景资源：`src/modules/rock/resources.ts`
- 支护动作：`src/platform/tasks/actions/SupportAssessmentAction.ts`
- 样例组装：`src/platform/tasks/samples/QualityCheckWorkflow.ts`
- 自动化验证：`tests/platform/quality-check-workflow.test.ts`
