# 爆破专题页只保留承载隧道段

按用户要求，本轮优先处理围岩切爆破时的隧道加载范围，支护构件验收操作尚未开始修改。

`TunnelModule.vue` 挂载共享Viewer后、加载爆破资源前，通过现有 `focusTunnelSegmentAt` 限制到 `BLAST_SEGMENT_INDEX` 对应段。当前源爆破几何位于000段，使用该常量推导所在500米里程范围，不额外创建隧道。其余已加载段由既有管理器移除；已发出的异步加载在完成后检查焦点，不再添加非目标段。相机移动也继续遵循单段限制。

离开爆破页时取消焦点限制，返回围岩页面由既有逻辑恢复分级/全线加载。智能体在主页面按任务里程选择隧道段的逻辑保持原样。

真实页面验证 `scripts/verify-rock-blast-cleanup.mjs` 新增 `VERIFY_BLAST_SINGLE_SEGMENT=1` 检查。报告：`docs/verification/2026-11-12-blast-single-segment/report.json`。正常切换、资料请求未完成时切换、页面初始化前快速切换均通过，进入后实际ready隧道列表为 `[0]`、爆破ready，无分级残留和页面错误。正常用例返回围岩后焦点为null，实际重新加载多个分级隧道段。截图与报告同目录。

生产构建通过，日志 `docs/verification/2026-11-12-blast-single-segment-build.log`，原有大包提示保留。未测量FPS，不宣称固定帧率提升。既有未提交改动保留；5178验收服务运行中。
