/*
 * 正洞爆破效果(炮孔设计 + 爆后点云) —— 自包含模块
 * GLB 已把"段内放置(桩号250, 弯道切线校正)"烘焙进几何(tunnel000 原始坐标空间),
 * 故用与承载隧道段完全相同的 modelMatrix 加载即精确对齐。
 * 断面统计(供信息面板):
 */
import * as Cesium from 'cesium';
import { segmentModelMatrix, BLAST_SEGMENT_INDEX, SEGMENT_CONFIGS } from './tunnel';
export const BLAST_INFO = {
    section: '正洞 Ⅳ级 全断面光面爆破',
    excavationWidthM: 12.40,
    crownHeightM: 9.03,
    advanceM: 2.2,
    holes: { perimeter: 49, cut: 11, auxiliary: 95, floor: 30, total: 185 },
    pointCount: 450000,
    source: '方案图4.4-5 + 3.las 爆后点云',
};
let blastModel = null;
export async function loadBlast(viewer) {
    if (blastModel) {
        blastModel.show = true;
        viewer.scene.requestRender();
        return blastModel;
    }
    const model = await Cesium.Model.fromGltfAsync({
        url: 'data/blast/blast_effect.glb',
        modelMatrix: segmentModelMatrix(BLAST_SEGMENT_INDEX),
        // 无光照渲染: 炮孔/点云直接显顶点本色, 不被场景光压暗 -> 颜色鲜亮
        customShader: new Cesium.CustomShader({ lightingModel: Cesium.LightingModel.UNLIT }),
    });
    viewer.scene.primitives.add(model);
    blastModel = model;
    model.readyEvent.addEventListener(() => viewer.scene.requestRender());
    viewer.scene.requestRender();
    return model;
}
export function setBlastVisible(viewer, show) {
    if (blastModel)
        blastModel.show = show;
    viewer.scene.requestRender();
}
export function getBlastModel() { return blastModel; }
/**
 * "带纹理整体隧道"总览视角 —— 与透视(persp)**同方位**, 只是拉远(range 110)。
 * 这样 透视<->退出 之间只是拉近/拉远, 不会绕圈转, 初始方向也一致。
 */
export function flyToTunnelOverview(viewer) {
    const bs = blastModel?.boundingSphere;
    if (!bs)
        return;
    const center = bs.center;
    const a = SEGMENT_CONFIGS[BLAST_SEGMENT_INDEX];
    const b = SEGMENT_CONFIGS[BLAST_SEGMENT_INDEX + 1] || a;
    const pa = Cesium.Cartesian3.fromDegrees(a.lon, a.lat, a.height);
    const pb = Cesium.Cartesian3.fromDegrees(b.lon, b.lat, b.height);
    const advanceRaw = Cesium.Cartesian3.normalize(Cesium.Cartesian3.subtract(pb, pa, new Cesium.Cartesian3()), new Cesium.Cartesian3());
    const up = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(center, new Cesium.Cartesian3());
    // 与 flyToBlast('persp') 完全相同的方向: advance=-advanceRaw, dir = -advance + lateral = advanceRaw + lateral
    const advance = Cesium.Cartesian3.negate(advanceRaw, new Cesium.Cartesian3());
    const lateral = Cesium.Cartesian3.normalize(Cesium.Cartesian3.cross(advance, up, new Cesium.Cartesian3()), new Cesium.Cartesian3());
    const dir = Cesium.Cartesian3.normalize(Cesium.Cartesian3.add(Cesium.Cartesian3.negate(advance, new Cesium.Cartesian3()), lateral, new Cesium.Cartesian3()), new Cesium.Cartesian3());
    viewer.camera.flyToBoundingSphere(bs, {
        duration: 1.0,
        offset: new Cesium.HeadingPitchRange(enuHeading(dir, center), Cesium.Math.toRadians(-16), 110),
    });
}
/** 某世界方向在断面中心处的 ENU 方位角(弧度) */
function enuHeading(worldDir, center) {
    const enu = Cesium.Transforms.eastNorthUpToFixedFrame(center);
    const inv = Cesium.Matrix4.inverseTransformation(enu, new Cesium.Matrix4());
    const l = Cesium.Matrix4.multiplyByPointAsVector(inv, worldDir, new Cesium.Cartesian3());
    return Math.atan2(l.x, l.y); // x=东, y=北
}
/**
 * 相机飞到爆破断面 —— 方位由真实隧道轴向推导, 保证:
 *  front 正视: 站在已开挖侧, 正对掌子面/点云正面(不再是背面)
 *  side  侧视: 沿隧道横向看进尺剖面
 *  persp 透视: 3/4 斜视
 */
export function flyToBlast(viewer, view = 'persp') {
    const bs = blastModel?.boundingSphere;
    if (!bs)
        return;
    const center = bs.center;
    const V = new Cesium.Cartesian3();
    // 隧道 +进尺 世界方向 = 相邻两段锚点之差(物理方向, 不受 glTF 轴校正影响)
    const a = SEGMENT_CONFIGS[BLAST_SEGMENT_INDEX];
    const b = SEGMENT_CONFIGS[BLAST_SEGMENT_INDEX + 1] || SEGMENT_CONFIGS[BLAST_SEGMENT_INDEX];
    const pa = Cesium.Cartesian3.fromDegrees(a.lon, a.lat, a.height);
    const pb = Cesium.Cartesian3.fromDegrees(b.lon, b.lat, b.height);
    const advanceRaw = Cesium.Cartesian3.normalize(Cesium.Cartesian3.subtract(pb, pa, new Cesium.Cartesian3()), new Cesium.Cartesian3());
    const up = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(center, new Cesium.Cartesian3());
    // 几何已沿隧道翻转180°(掌子面朝进山), 故正视/侧视/透视从翻转后的一侧看; 俯视往下看不受影响
    const advance = (view === 'top')
        ? advanceRaw
        : Cesium.Cartesian3.negate(advanceRaw, new Cesium.Cartesian3());
    const lateral = Cesium.Cartesian3.normalize(Cesium.Cartesian3.cross(advance, up, new Cesium.Cartesian3()), new Cesium.Cartesian3());
    const neg = (v) => Cesium.Cartesian3.negate(v, new Cesium.Cartesian3());
    // 掌子面正面朝向 -进尺(已开挖/扫描侧); 相机放在 -进尺侧回看即为正视
    let dirFromCenter, pitchDeg, range;
    let headingOverride = null;
    if (view === 'front') {
        dirFromCenter = neg(advance);
        pitchDeg = -3;
        range = 24; // 拉远一点
    }
    else if (view === 'side') {
        dirFromCenter = lateral;
        pitchDeg = -6;
        range = 24;
    }
    else if (view === 'top') {
        // 俯视: 相机正上方看下去, 让隧道走向(进尺)朝屏幕上方
        dirFromCenter = up;
        pitchDeg = -88;
        range = 30;
        headingOverride = enuHeading(advance, center);
    }
    else {
        // 3/4: -进尺 与 横向 的合方向
        dirFromCenter = Cesium.Cartesian3.normalize(Cesium.Cartesian3.add(neg(advance), lateral, new Cesium.Cartesian3()), V);
        pitchDeg = -16;
        range = 22;
    }
    const heading = headingOverride ?? enuHeading(dirFromCenter, center);
    viewer.camera.flyToBoundingSphere(bs, {
        duration: 1.0,
        offset: new Cesium.HeadingPitchRange(heading, Cesium.Math.toRadians(pitchDeg), range),
    });
}
