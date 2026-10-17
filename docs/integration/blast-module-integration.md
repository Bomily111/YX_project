# 新爆破版块接入规范

## 结论

新爆破版块可以独立开发并在交付后替换当前实现。平台接入点是一个 `SceneModuleManifest`，而不是新的 Cesium 页面。交付方不应创建、销毁或长期保存自己的 `Cesium.Viewer`；平台会在资源加载时通过 `ResourceLoadContext.viewer` 传入当前 Viewer。

## 建议交付目录

```text
src/modules/blast-v2/
  manifest.ts          # 必需：模块唯一入口
  resources/
    blastModel.ts      # 必需：爆破三维资源
    holes.ts           # 可选：炮孔、装药、连线等独立资源
    resultCloud.ts     # 可选：爆后点云
  BlastPanel.vue       # 可选：业务面板，不包含 Cesium 容器
  api.ts               # 可选：后端查询适配
  README.md            # 数据来源、坐标、单位和资源大小
```

## 最小模块清单

```ts
import type { SceneModuleManifest } from '@/platform/modules/types'
import type { SceneResource } from '@/platform/resources/types'

let model: Cesium.Model | undefined
let viewer: Cesium.Viewer | undefined

const blastModel: SceneResource = {
  id: 'blast.model',
  module: 'blast',
  type: 'blast-model',
  processes: ['drilling', 'charging', 'blasting'],
  states: ['designed', 'charged', 'blasted'],
  dependencies: ['common.tunnel'],
  async load(ctx) {
    viewer = ctx.viewer
    model = await Cesium.Model.fromGltfAsync({
      url: '/data/blast-v2/model.glb',
      modelMatrix: platformModelMatrix,
    })
    viewer.scene.primitives.add(model)
  },
  async deactivate() {
    if (model) model.show = false
  },
  async unload() {
    if (viewer && model && !viewer.isDestroyed()) viewer.scene.primitives.remove(model)
    model = undefined
    viewer = undefined
  },
}

export const blastV2Manifest: SceneModuleManifest = {
  id: 'blast',
  displayName: '开挖爆破',
  version: '2.0.0',
  capabilities: ['query', 'locate', 'visibility', 'standard-view', 'pick'],
  coordinateFrame: {
    kind: 'platform-chainage',
    prefix: 'DK',
    origin: 278100,
    unit: 'm',
  },
  resources: [blastModel],
  panel: { load: () => import('./BlastPanel.vue') },
}
```

## 强制约束

1. 不得调用 `new Cesium.Viewer()`，也不得在卸载时调用 `viewer.destroy()`。
2. 公共隧道、中线、里程刻度、地形和影像只能作为依赖使用，不得随爆破资源重复加载或删除。
3. 所有资源 ID 必须以 `blast.` 开头，且在版本间保持稳定。
4. `load()` 和 `unload()` 必须可重复调用，并完整清理 Primitive、Entity、DataSource、事件、定时器、后处理、Blob URL 和网络请求。
5. 模型必须提供坐标系、原点、轴向、单位、里程范围和变换矩阵来源。局部坐标必须通过明确的转换函数进入世界坐标。
6. 面板组件只能负责交互和业务信息，不得拥有 Viewer 生命周期。
7. 大文件加载必须响应 `AbortSignal`，并通过 `reportProgress` 返回进度。

## 交付资料

- 模块目录或独立 Git 提交。
- `SceneModuleManifest` 导出路径。
- 模型和数据文件清单、大小及来源。
- 坐标说明和至少三个已知对齐控制点。
- 每项资源的加载、显隐、释放操作说明。
- 标准视点参数和预期截图。
- 后端接口、模拟数据与实测数据的区分。
- “加载 → 切换 → 卸载”重复 20 次的资源计数结果。

## 平台侧替换方式

确认旧爆破资源已释放后执行：

```ts
moduleRegistry.replace(blastV2Manifest)
```

注册器会校验模块 ID、资源前缀、重复 ID、依赖和活动资源。如果旧版仍在运行，替换会被拒绝，不会造成半替换状态；注册失败时会恢复旧模块。

## 当前平台状态

公共隧道已经注册为应用级 `common.tunnel`，首页和爆破之间切换时保持加载；爆破资源引用归零时只卸载爆破效果，不卸载公共隧道。新模块应直接声明 `dependencies: ['common.tunnel']`。
