# 智能体体数据显示修复

用户现象：对话调用 TEM、TSP 等体数据后，任务侧栏和数据库显示装配完成，主界面却看不到体数据。

根因：首页的 `DTVolume` 仅由 `isModelViewMode` 控制显隐。智能体在首页装配时不进入专题模型视图，故体数据 JSON、纹理和 WebGL 渲染器加载成功后，`#volume-container` 仍被 `v-show` 设置为 `display: none`。之前的浏览器回归只检查侧栏、Cesium 画布和数据库，没有断言体数据覆盖层是否可见。

修复：首页从智能体实际装配的资源 ID 识别四种体数据，在主场景显示 `DTVolume`；融合等级和 TSP 的图例同步显示。覆盖层由隐藏转为显示后主动重绘一次，以免静止相机下复用已清空的 WebGL 缓冲。浏览器回归新增覆盖层尺寸与显示状态断言，并可用 `CHECK_VOLUME_PIXELS=1` 强制重绘后读取 WebGL 像素。

真实 DeepSeek 页面复验：TEM 在 YK2+244 装配 `completed 1/1`，640×480 画布可见，非空像素 27,796（9.05%），WebGL 错误码 0。TSP 完整度在 YK2+244 装配 `completed 1/1`，非空像素 19,184（6.24%），WebGL 错误码 0。两例数据库均保存了对应 JSON 与体纹理路径。像素检查证明覆盖层不再是隐藏或空白画布；具体地质形态与硬件浏览器画面仍需人工核对。

运行示例：`$env:BROWSER_SCENARIO='tem'; $env:CHECK_VOLUME_PIXELS='1'; node scripts/verify-langchain-browser.mjs`。该脚本需要本地前端与 DeepSeek 后端已启动。
