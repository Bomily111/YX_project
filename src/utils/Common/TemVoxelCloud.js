import * as Cesium from 'cesium';
import { DTScopeEngine } from './Viewer';
import { setTemGlbVisible } from './GeoModelController';
let voxelPrimitive = null;
function kColor(k) {
    if (k < 570)
        return Cesium.Color.fromCssColorString('#4488ff');
    if (k < 590)
        return Cesium.Color.fromCssColorString('#44ccff');
    if (k < 610)
        return Cesium.Color.fromCssColorString('#44dd66');
    return Cesium.Color.fromCssColorString('#ddaa00');
}
function buildModelMatrix() {
    const pos = Cesium.Cartesian3.fromDegrees(94.9056136, 29.5333802, 2945.51);
    const hpr = new Cesium.HeadingPitchRoll(1.7467, 0, 0);
    let mm = Cesium.Transforms.headingPitchRollToFixedFrame(pos, hpr);
    const yRot = Cesium.Matrix4.fromRotationTranslation(Cesium.Matrix3.fromRotationY(1.5708));
    return Cesium.Matrix4.multiply(mm, yRot, new Cesium.Matrix4());
}
export async function loadTemVoxelCloud(dataDir) {
    const viewer = DTScopeEngine.viewer;
    if (!viewer)
        return;
    unloadTemVoxelCloud();
    const base = dataDir || 'data/tem_output/latest';
    const url = `${base}/tem_voxel_full.csv`;
    let text;
    try {
        const r = await fetch(url);
        if (!r.ok)
            throw new Error(`HTTP ${r.status}`);
        text = await r.text();
    }
    catch (e) {
        console.warn('[TemVoxelCloud] CSV 加载失败:', e);
        return;
    }
    const lines = text.split('\n');
    if (lines.length < 2)
        return;
    const modelMatrix = buildModelMatrix();
    const points = new Cesium.PointPrimitiveCollection();
    const stride = 20;
    for (let i = 1; i < lines.length; i += stride) {
        const line = lines[i].trim();
        if (!line)
            continue;
        const parts = line.split(',');
        if (parts.length < 4)
            continue;
        const x = parseFloat(parts[0]);
        const y = parseFloat(parts[1]);
        const z = parseFloat(parts[2]);
        const k = parseFloat(parts[3]);
        if (isNaN(x) || isNaN(y) || isNaN(z) || isNaN(k))
            continue;
        const local = new Cesium.Cartesian3(x, y, z);
        const world = Cesium.Matrix4.multiplyByPoint(modelMatrix, local, new Cesium.Cartesian3());
        points.add({
            position: world,
            color: kColor(k),
            pixelSize: 3,
            disableDepthTestDistance: 1e9,
        });
    }
    voxelPrimitive = viewer.scene.primitives.add(points);
    setTemGlbVisible(false);
    viewer.scene.requestRender();
    console.log('[TemVoxelCloud] 加载完成:', url, points.length, '点');
}
export function unloadTemVoxelCloud() {
    const viewer = DTScopeEngine.viewer;
    if (voxelPrimitive && viewer) {
        try {
            viewer.scene.primitives.remove(voxelPrimitive);
        }
        catch { }
        voxelPrimitive = null;
    }
}
