# 支护任务构件显隐

在主页面当前任务信息栏加入“支护构件”，按已加载的1064米示例装配节点列出开关：初支混凝土、二衬、钢架/格栅、钢筋网、系统/锁脚锚杆、超前支护以及实际存在的二衬钢筋编号。未加载或不存在的类别不提供开关。

开关直接修改当前Cesium模型节点show；同类多个节点一起改变，不重载、不改几何、位置、间距或源文件。“恢复示例显隐”读取原始分组默认值，不覆盖它们。切换任务以任务ID重建面板，复位时随场景信息销毁。Z-PM目前走独立模型回退，没有本轮分组信息，因此不显示该面板，不宣称已有分构件控制。

实现：`TaskSupportLayers.vue` 与 `test-section-resource.ts` 的 `getTaskSupportLayers/setTaskSupportLayer`。自然语言构件控制工具本轮未接入，当前通过任务信息栏操作。

真实页面回归在 `scripts/verify-agent-acceptance.mjs` 中以 `VERIFY_SUPPORT_LAYERS=1` 开启。报告 `docs/verification/2026-11-12-support-layers/report.json`：ZZ-Va、切换ZZ-IVb、切换Z-PM、复位4项通过。逐个点击全部构件开关并读取原模型节点状态，核对模型对象未替换、任务数量未增加、恢复默认值成功，Z-PM和复位无控件残留。截图已查看。该测试不代表构件工程质量或现场适用性验收。

生产构建通过：`docs/verification/2026-11-12-support-layers-build.log`。既有大包提示保留。所有既有未提交改动保留，5178提供验收；上下文和长期历史记录仍按用户决定暂缓。
