/**
 * 隧道风场流动线模拟
 * 加载 ANSYS CFD 导出的流线数据，沿隧道中线渲染射流风场
 */
import * as Cesium from 'cesium';
import { DTScopeEngine } from './Viewer';
import { setCameraViewPoint } from './CameraControl';

// ── 类型定义 ──────────────────────────────────────────────
type LngLatHeight = [number, number, number];

/** ANSYS 流线：每条为一组 [lon, lat, height] 点 */
interface AnysStreamline {
  streamlines: LngLatHeight[][];
  totalCurves: number;
  sampledCurves: number;
}

// ── ANSYS 流线数据缓存 ────────────────────────────────────
let ansysData: AnysStreamline | null = null;
let loading = false;
let loadPromise: Promise<AnysStreamline> | null = null;

/** 异步加载 ANSYS 导出的流线数据 */
async function loadAnsysData(): Promise<AnysStreamline> {
  if (ansysData) return ansysData;
  if (loadPromise) return loadPromise;

  loading = true;
  loadPromise = fetch('/data/wind/tunnel_streamlines.json')
    .then((r) => r.json() as Promise<AnysStreamline>)
    .then((data) => {
      ansysData = data;
      console.log(`[WindField] ANSYS 流线加载完成: ${data.sampledCurves} 条`);
      return data;
    })
    .catch((e) => {
      console.warn('[WindField] ANSYS 流线加载失败:', e);
      return { streamlines: [], totalCurves: 0, sampledCurves: 0 };
    })
    .finally(() => { loading = false; });

  return loadPromise;
}

// ── 渲染状态 ──────────────────────────────────────────────
const primitiveList: Cesium.Primitive[] = [];
let currentPower = 5; // 0-11

// 风力档位 → 线宽
const PWIDTH = [1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.0, 2.1, 2.2, 2.3, 2.4, 2.5];

// ANSYS 速度色带 (蓝→青→绿→黄→橙→红)
const VELOCITY_COLORS: [number, number, number][] = [
  [0.23, 0.30, 0.75], // 蓝 (低速)
  [0.31, 0.42, 0.77],
  [0.40, 0.53, 0.78],
  [0.49, 0.65, 0.80],
  [0.58, 0.76, 0.81],
  [0.67, 0.88, 0.83],
  [0.73, 0.94, 0.82],
  [0.78, 0.96, 0.71],
  [0.82, 0.94, 0.55],
  [0.83, 0.84, 0.41],
  [0.81, 0.69, 0.30],
  [0.75, 0.47, 0.22],
  [0.71, 0.29, 0.17], // 红 (高速)
];

// ── 自定义飞线材质 ────────────────────────────────────────
function getFlylineMaterial(r: number, g: number, b: number): Cesium.PolylineMaterialAppearance {
  const material = Cesium.Material.fromType('Color');
  material.uniforms.color = Cesium.Color.ORANGE;

  const fragmentShaderSource = `
    in vec2 v_st;
    in float v_width;
    in float v_polylineAngle;
    in vec4 v_positionEC;
    in vec3 v_normalEC;
    out vec4 fragColor;
    void main()
    {
        vec2 st = v_st;
        float xx = fract(st.s - czm_frameNumber / 60.0);
        if (xx > 0.8) { xx = 0.0; }
        float r = ${(r - 0.01).toFixed(4)};
        float g = ${(g - 0.01).toFixed(4)};
        float b = ${(b - 0.01).toFixed(4)};
        float a = xx;
        fragColor = vec4(r, g, b, a);
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
      out float v_width;
      out vec2 v_st;
      out float v_polylineAngle;
      out vec4 v_positionEC;
      out vec3 v_normalEC;
      void main()
      {
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
function lerpColor(t: number): [number, number, number] {
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

function renderStreamlines(viewer: Cesium.Viewer, streamlines: LngLatHeight[][]) {
  const size = PWIDTH[currentPower];

  streamlines.forEach((streamline, si) => {
    if (streamline.length < 2) return;

    const positions = streamline.map(
      ([lon, lat, h]) => Cesium.Cartesian3.fromDegrees(lon, lat, h),
    );

    // 按流线索引分布颜色（模拟速度从高到低）
    const t = si / (streamlines.length - 1 || 1);
    const [r, g, b] = lerpColor(1 - t); // 内圈高速=红, 外圈低速=蓝

    const pri = new Cesium.Primitive({
      geometryInstances: new Cesium.GeometryInstance({
        geometry: new Cesium.PolylineGeometry({ positions, width: size }),
      }),
      appearance: getFlylineMaterial(r, g, b),
      allowPicking: false,
    });
    primitiveList.push(pri);
    viewer.scene.primitives.add(pri);
  });
}

// ── 公共 API ──────────────────────────────────────────────

/** 射流观察视角 */
const WIND_VIEWPOINT = {
  Position: {
    longitude: 94.868546,
    latitude: 29.460784,
    height: 10402.4,
  },
  Orientation: {
    heading: Cesium.Math.toRadians(38.99),
    pitch:   Cesium.Math.toRadians(-36.85),
    roll: 0,
  },
};

/**
 * 开启射流风场模拟（基于 ANSYS CFD 导出的流线数据）
 * @param viewer Cesium Viewer 实例
 */
export async function startWind(viewer: Cesium.Viewer) {
  setCameraViewPoint(viewer, WIND_VIEWPOINT, 1);
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
export function changePower(power: number) {
  currentPower = Math.max(0, Math.min(11, Math.floor(power)));
}

/** 获取当前风力档位 */
export function getCurrentPower(): number {
  return currentPower;
}

/**
 * 清除所有风场流线
 */
export function removeFlowLine(viewer?: Cesium.Viewer) {
  const v = viewer ?? DTScopeEngine.viewer;
  if (!v) return;
  for (const p of primitiveList) {
    try { v.scene.primitives.remove(p); } catch (_) { /* ignore */ }
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
