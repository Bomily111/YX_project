# 浏览器生命周期诊断（第一版）

更新日期：2026-10-12

## 采样内容

开发环境通过 `capturePlatformDiagnostics()` 生成统一快照：

- Viewer 是否存在、owner 和稳定实例编号。
- Viewer 容器内 Canvas 数量。
- Primitive、Entity、DataSource 和后处理阶段数量。
- 平台额外创建的输入处理器数量与 owner。
- 活动、已加载、失败资源数量以及总引用数。
- 浏览器支持 `performance.memory` 时的 JS Heap 使用量。

页面 `<head>` 中的 `meta[name="dt-platform-diagnostics"]` 始终保存最新 JSON，便于隔离上下文中的浏览器自动化读取；开发环境同时保留最近 120 个半秒采样，可通过只读历史函数检查切换过程。

## 基线比较

`compareLifecycleSnapshots()` 用同一路径切换前后的快照生成报告。默认情况下 Canvas、Primitive、Entity、DataSource、后处理、输入处理器、活动资源和资源引用都不允许正增长，并要求 Viewer 实例编号不变。

JS Heap 受垃圾回收时机影响，默认只记录、不作为失败条件。压力测试可显式传入字节容差；其他指标也可以对已知的异步懒加载设置小范围容差。

报告只把正增长视为残留，数量下降不判失败。模块加载期间的快照用于观察峰值，回到同一路径并稳定后取得的快照用于最终判定。

## 首次实测

一次“主页 → 通风稳态 → 主页”往返结果：

| 指标 | 主页基线 | 通风稳态 | 返回主页 |
|---|---:|---:|---:|
| Viewer 实例编号 | 1 | 1 | 1 |
| Canvas | 1 | 1 | 1 |
| Primitive | 8 | 8 | 8 |
| Entity | 3 | 0 | 3 |
| 输入处理器 | 3 | 2 | 3 |
| 活动资源 | 1 | 2 | 1 |
| 资源引用 | 1 | 3 | 1 |
| JS Heap | 约 408 MB | 约 478 MB | 约 402 MB |

通风阶段的两个处理器分别为 `ventilation.camera-controls` 和 `ventilation.pick`；返回后恢复为主页三个处理器。通风资源引用归零，公共隧道保持 `loaded / 1`，浏览器控制台无错误。
