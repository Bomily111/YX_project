# 装配前只读预检 · 2026-11-07

入口：http://localhost:5178/。新增预检与执行边界，保留工作区既有未提交修改，未创建Git提交。

可直接输入：

- “YK1+346只做装配预检：TSP坚硬度与TEM视电阻率能否同屏？不要执行。”
- “YK1+346只做装配预检：岩体完整性与ZZ-Va支护能否同屏？不要执行。”

前者应返回不兼容及原因，后者应通过装配规则预检。反馈列出检查的资源、警告和未核验事项。不创建任务，不加载或释放模型，不替换当前场景。

## 实现与边界

`check_scene_assembly`复用正式装配的资源选择、依赖、兼容性及里程规则。明确的预检请求只开放此工具，并限制单次只读调用；即使模型额外提出装配调用，平台也拦截。

结果分开表示`compatible`、`filesVerified=false`和`targetDataVerified=false`。通过只说明所选组合满足当前声明规则，不证明文件可以读取、目标工段实测资料齐全或业务任务已完成。实际加载仍在正式执行时进行。

修复无效替换请求过早清空热场文件及瞬态工况选择的问题：先通过预检，才重置新任务的图表选择。预检失败保留原场景。

## 验证

- 260项平台测试通过、1项在线专用测试默认跳过，含模型请求只读检查后偷偷装配时被拦截的测试：[日志](verification/2026-11-07-preflight-final-unit.log)。
- 真实页面先装配200秒热场，再分别执行不兼容及兼容的预检，核对结果、任务数和原热场时间片保留，最后复位，全部通过：[报告](verification/2026-11-07-preflight-final/report.json)。该轮关闭逐项截图，不宣称解决长时软件WebGL截图问题。
- 生产构建和87项资产清单：[日志](verification/2026-11-07-preflight-final-build.log)。

复现环境变量：`VERIFY_PREFLIGHT=1`、`ACCEPTANCE_CASE_IDS=thermal-200,reset-scene`、`ACCEPTANCE_NO_SCREENSHOTS=1`；执行`node scripts/verify-agent-acceptance.mjs`。
