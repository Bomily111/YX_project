# 围岩多源场景与智能体逐步调度验收

2026-10-19，本地页面 + Ollama/Qwen 2.5 7B：自然语言要求展示物探融合围岩等级和 TEM 视电阻率。模型选择 `rock.geophysical-grade → rock.tem-resistivity`，平台校验两阶段计划；模型先调用 `advance_platform_task` 完成 `scene-1`，读取 `1/2` 状态后再次调用该工具完成 `scene-2`，最终 `2/2 completed`。对话中的平台轨迹见 [model-stepwise.png](./model-stepwise.png)。

独立新页面以表单创建单阶段 `rock.tem-resistivity` 任务并执行，历史结果节点记录体素 JSON 和 PNG 两项 SHA-256 指纹。新资源清单包含设计分级、物探融合等级、TSP 坚硬度、TSP 完整度、TEM 视电阻率；后四项为示意锚定，不作 DK278 工点实测联合结论。旧页面热更新前注册的资源实例只能上报 JSON，整页重载后两项指纹均正常采集。

此前回归发现模型将平台返回的 `currentStepId` 直接传给下一步工具，而工具 Schema 曾要求 `stepId`，导致步骤被拒并反复建任务。字段已统一，工具仍在执行前校验任务 ID 与当前步骤；对应单测覆盖错误 ID、错误步骤、失败停止与正确推进。
