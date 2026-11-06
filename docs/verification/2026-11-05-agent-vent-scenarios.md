# 智能体按施工语义选择瞬态风网工况

新增四个可调度资源：右线风机波动、关闭K2+300横通道、右线风机故障停机、既有组合工况；默认风机爬升仍沿用ventilation.transient-network。资源目录集中在transient-catalog.ts，智能体提示词、工具白名单和资源中文标签同步接入。没有修改原始工况文件或生成新仿真结果。

各新资源独立持有数据、图表清理函数和文件来源，避免ScenePlanExecutor先加载新资源再释放旧资源时清掉新数据。加载时检查有效时间/流量序列。按工况展示已有网络流量—时间曲线；主页面图表放在左下方，避开聊天栏。聊天与阶段记录明确说明一维网络分析，不宣称该工况三维CFD或目标工点实时监测。

真实Edge软件WebGL + DeepSeek验证：

- 风机突然停机请求选择ventilation.transient-fan-shutdown，图表标题含右线风机故障停机，数据库completed且记录transient_fan_shutdown.json，未记录默认爬升文件。
- 风机60%～100%波动请求选择ventilation.transient-fan-oscillation，图表及数据库记录transient_fan_oscillation.json，未替换为默认爬升。
- 两条任务页面errors=[]，图表canvas存在，图表右边界位于聊天区域之外。最终任务ID及证据见agent-vent-scenarios.json/png。

29项测试及类型检查通过，覆盖四份原始工况实际数据、独立释放及既有场景工作流。其余两工况尚未做完整在线模型页面任务，不能将数据加载测试当作页面验收。

生产构建通过（29.71秒），仍有既有Sass弃用和大chunk提示。关闭本轮5178实例，保留原有服务；只恢复检查生成的tsconfig.tsbuildinfo。

边界：本次是瞬态一维网络工况自主选择；热场时间片选择、瞬态三维CFD和工程空间精度验收仍待继续。保留全部既有未提交改动。
