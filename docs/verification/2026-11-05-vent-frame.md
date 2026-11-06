# 通风坐标与复用任务续开发

本轮保留全部既有未提交改动，修复：

- 组合风场 world→local 使用对应的组合逆矩阵，与 local→world 一致。
- 每次 buildSteadyLayers 捕获固定坐标变换，计算点、箭头、流线和粒子回调使用同一坐标架。全局模式变化不再令已创建的粒子脱离静态场。
- ventilation.scene 的 activate/update 校验组合任务范围，拒绝越界、反序和非有限里程。拒绝前不改变原风场，合法任务可恢复更新。

验证：22项针对性测试通过（包括ScenePlanExecutor现有12项）；TypeScript检查通过。真实Edge/软件WebGL/DeepSeek页面完成爆破+右洞稳态场任务，数据库回读2/2，页面errors为空。页面实际调用ResourceManager.update：4200被拒绝且原计算点集合未变，4000恢复成功；模式切换后等待真实postRender，检查180粒子横向位置与纵向范围通过。JSON及截图见同名前缀vent-frame文件。

生产构建通过（32.28秒），仍有既有Sass import弃用及大chunk提示。本次独立5178前端已关闭，原有服务保留。

这验证坐标变换一致性及本次任务范围保护，不等同于完整多Viewer隔离或工程精度验收。渲染layers本身仍是模块级单例；完整跨专题页共享资源的生命周期、支护/底板/拱顶独立控制点验收仍待继续。
