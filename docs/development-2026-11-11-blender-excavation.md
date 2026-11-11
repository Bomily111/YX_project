# Blender 三台阶开挖工段第一版

后续已统一命名为“三台阶”，迁入 `public/data/tunnel/` 并接入智能体调度；本记录描述建模阶段，最新状态见[调度接入记录](development-2026-11-11-three-bench-dispatch.md)。

使用本机 `D:/Blender 4.5.7/blender.exe` 后台建模，保留可编辑blend与GLB。用户明确要求断面贴合隧道，因此未使用先前提取的支护模板凸包建模。

## 断面依据与生成

从实际主隧道 `public/data/tunnel/tunnel002.glb` 原始三角网格取截面，截平面为源GLB局部X=128至150，每个源坐标米取一面，共23面。这是模型局部坐标，不是YK里程，也不等于已核定的沿中线22米工段。

求三角形与平面交线，按有向边追踪平面闭合区域；首面最大有界区域为约70.47平方米的洞内开口，后续按面积连续性跟踪同一开口，拒绝超过5%的突变。原模型存在约毫米级拼缝，提取时对小于1厘米的相邻开口端点连接，具体距离记录在提取JSON中。原始GLB不修改。

三份台阶实体沿各截面生成侧界，不以一张固定轮廓直线拉伸22米。每个台阶使用65个高度采样点求左右洞壁交点，按源断面变化放样。示意前缘在源X偏移0、6、12处，中间高程分界为源Y=0和2.8；这些是演示参数，不能当作工法设计。岩体模型未添加虚构实测起伏，也未贴照片。

## 产物

- [可编辑Blender文件](../public/data/tunnel/三台阶.blend)
- [平台GLB](../public/data/tunnel/三台阶.glb)
- [Blender预览](../public/data/tunnel/三台阶.png)
- [参数和坐标来源](../public/data/tunnel/三台阶.metadata.json)

可复现：先运行 `node scripts/extract-tunnel-excavation-profile.mjs`，再运行 Blender `--background --python scripts/build-three-bench.py`。

## 检查

`node scripts/verify-three-bench-model.mjs` 验证三份导出网格焊接坐标后均无非流形边。边界顶点相对于源采样轮廓的最大偏差约0.000165米，这是几何导出误差，不能当作现场配准精度；不覆盖采样点之间的误差。详见[几何记录](verification/2026-11-11-three-bench-geometry.json)。

`node scripts/verify-three-bench-browser.mjs` 在平台实际Cesium画布中独立加载GLB，并叠加源隧道的4条断面线，模型就绪及截图检查通过。截图明确标注独立预览，未伪装成智能体调度成功；测试仅在自己的浏览器页面临时隐藏其他模型及业务面板。见[页面记录](verification/2026-11-11-three-bench-browser/report.json)、[断面叠加截图](verification/2026-11-11-three-bench-browser/three-bench.png)。

## 后续接入边界

本版是特定源模型局部范围的开挖实体原型，尚未注册成智能体资源。不能任意平移到其他工段后继续宣称贴合。源截平面未必垂直于中线，还需校核源坐标至主页面实际模型变换、里程对应与中线法向，检验采样断面之间的曲线误差，再支持目标工段生成及任务装配。仍需改善岩面材质，并处理原隧道外壳遮挡、已开挖区裁切及初支/二衬的空间关系。掌子面照片只在任务需要且对应资料明确时绑定。

既有代码及未提交修改保留，未创建Git提交。
