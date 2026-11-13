# Z-PM独立模型构件控制

直接读取已有 `public/support-modeler/outputs/master_demo/Z-PM_support_1m_partial.glb` 的JSON节点，确认 `ZPMSecondaryLiningConcrete` 和 `N1Group`～`N7Group` 存在。源模型标注混凝土CONFIRMED、配筋PARTIAL、适用性NEEDS_CONFIRMATION。本轮不改GLB、几何、参数或1米单元布置。

测试工段Z-PM加载完成后核查每个单元的8个既有节点，建立分组映射。`getTaskSupportLayers/setTaskSupportLayer` 扩展为读取/更新所有单元；修改前核查所有目标节点，避免只操作第一单元。恢复默认按原节点默认显示值处理。

左侧复选框、set_support_layers自然语言和inspect_current_support查询共同支持该映射。可说“隐藏二衬，显示二衬钢筋N1和N7”“只看二衬钢筋N7”“恢复支护默认显示”。当前模型没有钢架、锚杆、格栅时仍拒绝，不生成构件。

Z-PM仍是1064米示例该类型为空时的原模型回退；控制能力不表示它已有1064米区段布置。查询不猜测构件间距/站位，返回间距未核验并保留PARTIAL和适用性说明。

证据：`docs/verification/2026-11-12-zpm-component-controls/report.json`。真实聊天Va→8米Z-PM、逐个复选框、自然语言指定N1/N7和仅N7、恢复默认、错误格栅请求拒绝、查询、复位及无模型拒绝共4个流程用例通过。每个操作读取所有模型的每个分组节点，验证跨单元一致、模型对象未替换、任务数不增加；Z-PM返回8个可操作组。截图已查看。生产构建通过，日志同前缀 `-build.log`，原有大包提示保留。

此前“Z-PM没有分组控制”的记录属于旧状态，以本条为准。所有既有未提交改动保留，未接入新的长期记忆功能。
