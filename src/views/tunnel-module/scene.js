/*
 * 极简 Cesium 场景 —— 性能优先
 * 关键优化:
 *  - requestRenderMode: 只在交互/变化时渲染, 空闲时 0 GPU -> 拖拽旋转丝滑
 *  - 不加载地球/地形/影像, 纯黑底只放隧道 + 爆破模型
 *  - 相机控制器针对"洞内漫游"调参(关碰撞, 近距可缩放)
 */
import * as Cesium from 'cesium';
export function createViewer(container) {
    const viewer = new Cesium.Viewer(container, {
        baseLayer: false, baseLayerPicker: false, geocoder: false,
        timeline: false, animation: false, sceneModePicker: false,
        navigationHelpButton: false, homeButton: false, fullscreenButton: false,
        infoBox: false, selectionIndicator: false, scene3DOnly: true,
        // 加载阶段用连续渲染(保证模型被处理/显示), 载完再切按需渲染省资源
        requestRenderMode: false,
    });
    const s = viewer.scene;
    s.globe.show = false; // 不要地球
    s.skyBox.show = false;
    s.sun.show = false;
    s.moon.show = false;
    s.skyAtmosphere.show = false;
    s.fog.enabled = false;
    s.backgroundColor = Cesium.Color.fromCssColorString('#0a0e15');
    s.debugShowFramesPerSecond = false;
    // 关碰撞检测(允许贴近/进入模型)
    s.screenSpaceCameraController.enableCollisionDetection = false;
    // 打亮, 让炮孔管(三角面)不发黑
    s.light = new Cesium.DirectionalLight({
        direction: new Cesium.Cartesian3(0.35, -0.89, -0.28),
        intensity: 2.5,
    });
    // 隐藏 Cesium 版权角标
    const credit = viewer.cesiumWidget.creditContainer;
    if (credit)
        credit.style.display = 'none';
    return viewer;
}
/** 载入完成后切换为"按需渲染": 空闲 0 GPU, 交互时自动重绘(拖拽/旋转依旧丝滑) */
export function enableOnDemandRender(viewer) {
    viewer.scene.requestRenderMode = true;
    viewer.scene.maximumRenderTimeChange = Infinity;
    viewer.scene.requestRender();
}
/**
 * 标准"轨道控制器"(Orbit Controls) —— 绕固定焦点(爆破断面中心)导航, 不依赖地球:
 *   左键拖拽 = 环绕(orbit)   右键拖拽 = 平移(pan)   滚轮 = 缩放(dolly, 夹紧上下限)
 * 彻底关掉 Cesium 默认(含 Ctrl+左键倾斜)导航, 从根上消除"甩飞黑屏"。
 * @param getFocus 返回爆破断面中心世界坐标
 */
export function installOrbitControls(viewer, getFocus) {
    const scene = viewer.scene;
    const cam = viewer.camera;
    // 多重保险: 彻底关闭 Cesium 默认导航(含 Ctrl+左键倾斜)
    const ctrl = scene.screenSpaceCameraController;
    ctrl.enableInputs = false;
    ctrl.enableRotate = false;
    ctrl.enableTranslate = false;
    ctrl.enableZoom = false;
    ctrl.enableTilt = false;
    ctrl.enableLook = false;
    const MIN = 2.5, MAX = 600;
    const ORBIT_SPEED = 0.006;
    const panOffset = new Cesium.Cartesian3();
    const focusNow = () => {
        const f = getFocus();
        return f ? Cesium.Cartesian3.add(f, panOffset, new Cesium.Cartesian3()) : undefined;
    };
    const h = new Cesium.ScreenSpaceEventHandler(scene.canvas);
    let mode = null;
    const onLeftDown = () => { mode = 'orbit'; };
    const onRightDown = () => { mode = 'pan'; };
    const onEnd = () => { mode = null; };
    const onMove = (m) => {
        if (!mode)
            return;
        const focus = focusNow();
        if (!focus)
            return;
        const dx = m.endPosition.x - m.startPosition.x;
        const dy = m.endPosition.y - m.startPosition.y;
        if (mode === 'orbit') {
            const t = Cesium.Transforms.eastNorthUpToFixedFrame(focus);
            cam.lookAtTransform(t);
            cam.rotateLeft(dx * ORBIT_SPEED);
            cam.rotateUp(-dy * ORBIT_SPEED);
            cam.lookAtTransform(Cesium.Matrix4.IDENTITY);
        }
        else {
            const dist = Cesium.Cartesian3.distance(cam.position, focus);
            const s = dist * 0.0015;
            const rd = Cesium.Cartesian3.multiplyByScalar(cam.right, -dx * s, new Cesium.Cartesian3());
            const ud = Cesium.Cartesian3.multiplyByScalar(cam.up, dy * s, new Cesium.Cartesian3());
            const delta = Cesium.Cartesian3.add(rd, ud, new Cesium.Cartesian3());
            cam.move(delta, 1.0);
            Cesium.Cartesian3.add(panOffset, delta, panOffset);
        }
        scene.requestRender();
    };
    const onWheel = (delta) => {
        const focus = focusNow();
        if (!focus)
            return;
        const dist = Cesium.Cartesian3.distance(cam.position, focus);
        let step = Math.min(dist * 0.10, 20);
        if (delta > 0) {
            if (dist - step < MIN)
                step = Math.max(0, dist - MIN);
            cam.zoomIn(step);
        }
        else {
            if (dist + step > MAX)
                step = Math.max(0, MAX - dist);
            cam.zoomOut(step);
        }
        scene.requestRender();
    };
    // ★ 关键: 对"无修饰符 + Ctrl + Shift + Alt"都注册, 这样 Ctrl+左键等组合也走安全轨道逻辑,
    //   不会漏给默认控制器导致相机被甩飞黑屏。
    const T = Cesium.ScreenSpaceEventType;
    const K = Cesium.KeyboardEventModifier;
    const mods = [undefined, K.CTRL, K.SHIFT, K.ALT];
    for (const mod of mods) {
        h.setInputAction(onLeftDown, T.LEFT_DOWN, mod);
        h.setInputAction(onRightDown, T.RIGHT_DOWN, mod);
        h.setInputAction(onEnd, T.LEFT_UP, mod);
        h.setInputAction(onEnd, T.RIGHT_UP, mod);
        h.setInputAction(onMove, T.MOUSE_MOVE, mod);
        h.setInputAction(onWheel, T.WHEEL, mod);
    }
    const resetFocus = () => Cesium.Cartesian3.clone(Cesium.Cartesian3.ZERO, panOffset);
    return { handler: h, resetFocus };
}
