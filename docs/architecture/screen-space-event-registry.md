# Cesium 输入事件生命周期（第一版）

更新日期：2026-10-12

## 目标

业务模块经常需要额外创建 `ScreenSpaceEventHandler` 实现拾取、轨道相机和调试操作。处理器若在页面重挂载或模型重载后残留，会重复响应同一输入并持续持有 Viewer、Primitive 和组件闭包。

平台通过 `ScreenSpaceEventRegistry` 统一管理这类额外处理器。Cesium Viewer 自带的 `viewer.screenSpaceEventHandler` 仍由 Viewer 自己管理，不重复登记。

## 所有权规则

每个处理器创建时必须提供稳定 owner，例如：

- `main.pointer-style`
- `main.worksite-pick`
- `blast.camera-controls`
- `support.camera-controls`
- `support.model-pick`
- `ventilation.camera-controls`
- `ventilation.pick`
- `rock.tem-model-pick`

同一 owner 再次创建时，注册器先销毁旧处理器，然后登记新处理器。这使组件重复挂载和数据集切换不会累积同一职责的事件监听。

## 销毁与诊断

注册器包装原生 `destroy()`：模块仍可按原方式直接销毁处理器，登记会同步删除；重复销毁保持幂等。也可以通过 owner、owner 前缀或 `disposeAll()` 集中释放。

`list()` 返回当前活动记录及创建时间，供后续浏览器压力测试核对模块往返前后的处理器数量。它只诊断平台额外创建的处理器，不计入 Viewer 内建处理器。
