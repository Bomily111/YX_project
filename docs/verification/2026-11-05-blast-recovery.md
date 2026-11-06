# 爆破专题加载失败与加载中离开

保留既有未提交改动。本轮在爆破专题增加加载失败提示及重试按钮；卸载时标记disposed、移除ready监听并清除2.5秒按需渲染定时器；异步加载返回后检查disposed，避免旧页面安装交互、注册AI监听或调整新页面镜头。

真实Edge/软件WebGL页面故障注入（scripts/verify-blast-topic-recovery.mjs）：

- 首次blast_effect.glb返回503，页面出现错误提示；点击重试后第二次请求成功，模型ready，资源引用为1，错误提示清除。
- 另一新页面暂停GLB响应，加载中通过Vue路由返回首页，再放行请求；等待blast.effect变为idle、旧模型为空且common.tunnel加载完成。再等待3秒，页面无脚本错误。
- 结果见2026-11-05-blast-recovery.json，pageErrors=[]。

TypeScript检查、14项针对性测试及生产构建通过，构建仍有既有Sass弃用及大chunk提示。已关闭本轮独立5178实例，用户原有服务保留。

未覆盖所有Cesium首帧后GPU错误；通风专题快速连续切页、加载失败重试，以及独立空间控制点精度仍待继续。
