/**
 * 隧道风场流动线模拟
 * 加载 ANSYS CFD 导出的流线数据，沿隧道中线渲染射流风场
 */
import * as Cesium from 'cesium';
import { DTScopeEngine } from './Viewer';
// ── ANSYS 流线数据缓存 ────────────────────────────────────
let ansysData = null;
let loading = false;
let loadPromise = null;
/** 异步加载 ANSYS 导出的流线数据 */
async function loadAnsysData() {
    if (ansysData)
        return ansysData;
    if (loadPromise)
        return loadPromise;
    loading = true;
    loadPromise = fetch('/data/wind/tunnel_streamlines.json')
        .then((r) => r.json())
        .then((data) => {
        ansysData = data;
        console.log(`[WindField] ANSYS 流线加载完成: ${data.sampledCurves} 条`);
        return data;
    })
        .catch((e) => {
        console.warn('[WindField] ANSYS 流线加载失败:', e);
        return { streamlines: [], totalCurves: 0, sampledCurves: 0, xMin: 0, xMax: 0 };
    })
        .finally(() => { loading = false; });
    return loadPromise;
}
// ── 渲染状态 ──────────────────────────────────────────────
const primitiveList = [];
let currentPower = 5; // 0-11
// 风力档位 → 线宽
const PWIDTH = [1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.0, 2.1, 2.2, 2.3, 2.4, 2.5];
// jet 色带 (蓝→青→绿→黄→红)，低速蓝、高速红
export const VELOCITY_COLORS = [
    [0.00, 0.00, 0.56], // 深蓝 (低速)
    [0.00, 0.00, 0.80],
    [0.00, 0.40, 1.00],
    [0.00, 0.80, 1.00], // 青
    [0.00, 1.00, 0.80],
    [0.00, 1.00, 0.40],
    [0.00, 1.00, 0.00], // 绿
    [0.40, 1.00, 0.00],
    [0.80, 1.00, 0.00],
    [1.00, 1.00, 0.00], // 黄
    [1.00, 0.80, 0.00],
    [1.00, 0.40, 0.00],
    [1.00, 0.00, 0.00], // 红 (高速)
];
// ── 自定义飞线材质（逐顶点着色 + 单 Primitive 批次）───────
/** 飞线动画开关（预埋，关闭后流线完整显示为实线） */
let flylineAnimating = false;
export function setFlylineAnimating(on) {
    flylineAnimating = on;
}
export function getFlylineAnimating() {
    return flylineAnimating;
}
export function getFlylineMaterial(respectAlpha = false) {
    const material = Cesium.Material.fromType('Color');
    material.uniforms.color = Cesium.Color.ORANGE;
    const doAnim = flylineAnimating;
    const fragmentShaderSource = `
    in vec2 v_st;
    in float v_width;
    in float v_polylineAngle;
    in vec4 v_positionEC;
    in vec3 v_normalEC;
    in vec4 v_color;
    out vec4 fragColor;
    void main()
    {
        vec2 st = v_st;
        float a = 1.0;
        ${doAnim ? `
        float xx = fract(st.s - czm_frameNumber / 60.0);
        if (xx > 0.8) { a = 0.0; }
        else { a = xx; }
        ` : ''}
        fragColor = vec4(v_color.rgb, ${respectAlpha ? 'v_color.a' : 'a'});
    }`;
    return new Cesium.PolylineMaterialAppearance({
        material,
        translucent: true,
        vertexShaderSource: `
      #define CLIP_POLYLINE
      void clipLineSegmentToNearPlane(
          vec3 p0, vec3 p1,
          out vec4 positionWC, out bool clipped,
          out bool culledByNearPlane, out vec4 clippedPositionEC)
      {
          culledByNearPlane = false; clipped = false;
          vec3 p0ToP1 = p1 - p0;
          float magnitude = length(p0ToP1);
          vec3 direction = normalize(p0ToP1);
          float endPoint0Distance = czm_currentFrustum.x + p0.z;
          float denominator = -direction.z;
          if (endPoint0Distance > 0.0 && abs(denominator) < czm_epsilon7) {
              culledByNearPlane = true;
          } else if (endPoint0Distance > 0.0) {
              float t = endPoint0Distance / denominator;
              if (t < 0.0 || t > magnitude) {
                  culledByNearPlane = true;
              } else {
                  p0 = p0 + t * direction;
                  p0.z = min(p0.z, -czm_currentFrustum.x);
                  clipped = true;
              }
          }
          clippedPositionEC = vec4(p0, 1.0);
          positionWC = czm_eyeToWindowCoordinates(clippedPositionEC);
      }
      vec4 getPolylineWindowCoordinatesEC(vec4 positionEC, vec4 prevEC, vec4 nextEC, float expandDirection, float width, bool usePrevious, out float angle)
      {
          vec4 positionWindow = czm_eyeToWindowCoordinates(positionEC);
          vec4 previousWindow = czm_eyeToWindowCoordinates(prevEC);
          vec4 nextWindow = czm_eyeToWindowCoordinates(nextEC);
          vec2 lineDir;
          if (usePrevious) { lineDir = normalize(positionWindow.xy - previousWindow.xy); }
          else { lineDir = normalize(nextWindow.xy - positionWindow.xy); }
          angle = atan(lineDir.x, lineDir.y) - 1.570796327;
          angle = floor(angle / czm_piOverFour + 0.5) * czm_piOverFour;
          vec4 clippedPrevWC, clippedPrevEC;
          bool prevSegmentClipped, prevSegmentCulled;
          clipLineSegmentToNearPlane(prevEC.xyz, positionEC.xyz, clippedPrevWC, prevSegmentClipped, prevSegmentCulled, clippedPrevEC);
          vec4 clippedNextWC, clippedNextEC;
          bool nextSegmentClipped, nextSegmentCulled;
          clipLineSegmentToNearPlane(nextEC.xyz, positionEC.xyz, clippedNextWC, nextSegmentClipped, nextSegmentCulled, clippedNextEC);
          bool segmentClipped, segmentCulled;
          vec4 clippedPositionWC, clippedPositionEC;
          clipLineSegmentToNearPlane(positionEC.xyz, usePrevious ? prevEC.xyz : nextEC.xyz, clippedPositionWC, segmentClipped, segmentCulled, clippedPositionEC);
          if (segmentCulled) { return vec4(0.0, 0.0, 0.0, 1.0); }
          vec2 directionToPrevWC = normalize(clippedPrevWC.xy - clippedPositionWC.xy);
          vec2 directionToNextWC = normalize(clippedNextWC.xy - clippedPositionWC.xy);
          if (prevSegmentCulled) { directionToPrevWC = -directionToNextWC; }
          else if (nextSegmentCulled) { directionToNextWC = -directionToPrevWC; }
          vec2 thisSegmentForwardWC, otherSegmentForwardWC;
          if (usePrevious) {
              thisSegmentForwardWC = -directionToPrevWC;
              otherSegmentForwardWC = directionToNextWC;
          } else {
              thisSegmentForwardWC = directionToNextWC;
              otherSegmentForwardWC = -directionToPrevWC;
          }
          vec2 thisSegmentLeftWC = vec2(-thisSegmentForwardWC.y, thisSegmentForwardWC.x);
          vec2 leftWC = thisSegmentLeftWC;
          float expandWidth = width * 0.5;
          if (!czm_equalsEpsilon(prevEC.xyz - positionEC.xyz, vec3(0.0), czm_epsilon1) && !czm_equalsEpsilon(nextEC.xyz - positionEC.xyz, vec3(0.0), czm_epsilon1))
          {
              vec2 otherSegmentLeftWC = vec2(-otherSegmentForwardWC.y, otherSegmentForwardWC.x);
              vec2 leftSumWC = thisSegmentLeftWC + otherSegmentLeftWC;
              float leftSumLength = length(leftSumWC);
              leftWC = leftSumLength < czm_epsilon6 ? thisSegmentLeftWC : (leftSumWC / leftSumLength);
              vec2 u = -thisSegmentForwardWC;
              vec2 v = leftWC;
              float sinAngle = abs(u.x * v.y - u.y * v.x);
              expandWidth = clamp(expandWidth / sinAngle, 0.0, width * 2.0);
          }
          vec2 offset = leftWC * expandDirection * expandWidth * czm_pixelRatio;
          return vec4(clippedPositionWC.xy + offset, -clippedPositionWC.z, 1.0) * (czm_projection * clippedPositionEC).w;
      }
      vec4 getPolylineWindowCoordinates(vec4 position, vec4 previous, vec4 next, float expandDirection, float width, bool usePrevious, out float angle)
      {
          vec4 positionEC = czm_modelViewRelativeToEye * position;
          vec4 prevEC = czm_modelViewRelativeToEye * previous;
          vec4 nextEC = czm_modelViewRelativeToEye * next;
          return getPolylineWindowCoordinatesEC(positionEC, prevEC, nextEC, expandDirection, width, usePrevious, angle);
      }
      in vec3 position3DHigh;
      in vec3 position3DLow;
      in vec3 prevPosition3DHigh;
      in vec3 prevPosition3DLow;
      in vec3 nextPosition3DHigh;
      in vec3 nextPosition3DLow;
      in vec2 expandAndWidth;
      in vec2 st;
      in float batchId;
      in vec4 color;
      out float v_width;
      out vec2 v_st;
      out float v_polylineAngle;
      out vec4 v_positionEC;
      out vec3 v_normalEC;
      out vec4 v_color;
      void main()
      {
          v_color = color;
          float expandDir = expandAndWidth.x;
          float width = abs(expandAndWidth.y) + 0.5;
          bool usePrev = expandAndWidth.y < 0.0;
          vec4 p = czm_computePosition();
          vec4 prev = czm_computePrevPosition();
          vec4 next = czm_computeNextPosition();
          float angle;
          vec4 positionWC = getPolylineWindowCoordinates(p, prev, next, expandDir, width, usePrev, angle);
          gl_Position = czm_viewportOrthographic * positionWC;
          v_width = width;
          v_st.s = st.s;
          v_st.t = st.t;
          v_polylineAngle = angle;
          vec4 eyePosition = czm_modelViewRelativeToEye * p;
          v_positionEC = czm_inverseModelView * eyePosition;
      }`,
        fragmentShaderSource,
    });
}
// ── 渲染 ANSYS 流线 ──────────────────────────────────────
/** 颜色插值：在色带中按比例取色 */
export function lerpColor(t) {
    const idx = Math.max(0, Math.min(1, t)) * (VELOCITY_COLORS.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.min(lo + 1, VELOCITY_COLORS.length - 1);
    const alpha = idx - lo;
    const cl = VELOCITY_COLORS[lo];
    const ch = VELOCITY_COLORS[hi];
    return [
        cl[0] + (ch[0] - cl[0]) * alpha,
        cl[1] + (ch[1] - cl[1]) * alpha,
        cl[2] + (ch[2] - cl[2]) * alpha,
    ];
}
function renderStreamlines(viewer, streamlines) {
    const size = PWIDTH[currentPower];
    const instances = [];
    const total = streamlines.length || 1;
    streamlines.forEach((sl, si) => {
        if (sl.pts.length < 2)
            return;
        const positions = sl.pts.map(([lon, lat, h]) => Cesium.Cartesian3.fromDegrees(lon, lat, h));
        const t = si / total;
        const [r, g, b] = lerpColor(1 - t);
        const clr = new Cesium.Color(r, g, b);
        const colors = Array(positions.length).fill(clr);
        instances.push(new Cesium.GeometryInstance({
            geometry: new Cesium.PolylineGeometry({
                positions,
                colors,
                width: size,
                arcType: Cesium.ArcType.NONE,
            }),
        }));
    });
    if (instances.length === 0)
        return;
    const pri = new Cesium.Primitive({
        geometryInstances: instances,
        appearance: getFlylineMaterial(),
        allowPicking: false,
    });
    primitiveList.push(pri);
    viewer.scene.primitives.add(pri);
    console.log(`[WindField] ${instances.length} 条流线 → 1 次 draw call`);
}
// ── 公共 API ──────────────────────────────────────────────
/** 射流观察视角 */
/**
 * 开启射流风场模拟（基于 ANSYS CFD 导出的流线数据）
 * @param viewer Cesium Viewer 实例
 */
export async function startWind(viewer) {
    removeFlowLine(viewer);
    const data = await loadAnsysData();
    if (!data.streamlines.length) {
        console.warn('[WindField] 无可用流线数据');
        return;
    }
    console.log(`[WindField] 渲染 ${data.streamlines.length} 条流线 (共${data.totalCurves}条原始曲线)`);
    renderStreamlines(viewer, data.streamlines);
}
/**
 * 调节风力档位（0-11）
 * 只改变档位，不重绘；需配合 changeWind 重绘以生效
 */
export function changePower(power) {
    currentPower = Math.max(0, Math.min(11, Math.floor(power)));
}
/** 获取当前风力档位 */
export function getCurrentPower() {
    return currentPower;
}
/**
 * 清除所有风场流线
 */
export function removeFlowLine(viewer) {
    const v = viewer ?? DTScopeEngine.viewer;
    if (!v)
        return;
    for (const p of primitiveList) {
        try {
            v.scene.primitives.remove(p);
        }
        catch (_) { /* ignore */ }
    }
    primitiveList.length = 0;
}
/**
 * 重新加载 ANSYS 数据（数据更新后调用）
 */
export function resetWindPaths() {
    ansysData = null;
    loadPromise = null;
}
