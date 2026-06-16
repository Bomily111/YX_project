/*
 * @Description: 基础图形绘制工具 (整合版：AHD逻辑移入 + 场景环境控制)
 */
import * as Cesium from 'cesium';
import { DTScopeEngine } from './Viewer';
import centerLineData from '@/assets/data/centerLine.json';

// 全局变量存储实体引用
let allLineEntity: Cesium.Entity | null | undefined = null;
let tunnelGlbPrimitives: any[] = [];
let windTunnelGlbPrimitives: any[] = [];


// ── 隧道混凝土纹理 ─────────────────────────────────────────
let concreteTextureUrl: string | null = null;
let concreteImage: HTMLImageElement | null = null;

function buildConcreteShader(): Cesium.CustomShader | null {
  if (!concreteImage) return null;
  return new Cesium.CustomShader({
    uniforms: {
      u_concrete: {
        type: Cesium.UniformType.SAMPLER_2D,
        value: new Cesium.TextureUniform(concreteImage),
      },
    },
    fragmentShaderText: `
      void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
        vec3 pos = fsInput.attributes.positionMC;
        vec3 normal = fsInput.attributes.normalMC;
        float nlen = length(normal);
        vec3 N = nlen > 0.001 ? normal / nlen : vec3(0.0, 0.0, 1.0);

        float scale = 0.8;
        vec2 uvX = pos.yz * scale;
        vec2 uvY = pos.xz * scale;
        vec2 uvZ = pos.xy * scale;

        vec3 blend = abs(N);
        blend = pow(blend, vec3(3.0));
        float sum = blend.x + blend.y + blend.z;
        if (sum < 0.001) blend = vec3(0.333);
        else blend /= sum;

        vec4 cx = texture2D(u_concrete, uvX);
        vec4 cy = texture2D(u_concrete, uvY);
        vec4 cz = texture2D(u_concrete, uvZ);

        vec4 color = cx * blend.x + cy * blend.y + cz * blend.z;
        material.diffuse = color.rgb;
        material.specular = vec3(0.03);
        material.roughness = 0.9;
      }
    `,
  });
}

/** 预加载混凝土纹理，返回 Promise，完成后调用 loadTunnelGlb 即可自动应用 */
export function loadConcreteTexture(textureUrl: string): Promise<void> {
  concreteTextureUrl = textureUrl || null;
  if (!textureUrl) {
    concreteImage = null;
    for (const p of tunnelGlbPrimitives) p.customShader = undefined;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      concreteImage = img;
      console.log('[混凝土纹理] 加载成功:', textureUrl, img.width + 'x' + img.height);
      // 如果已有已加载的隧道节，立即应用
      const shader = buildConcreteShader();
      if (shader) {
        for (const p of tunnelGlbPrimitives) p.customShader = shader;
      }
      resolve();
    };
    img.onerror = () => {
      console.warn('[混凝土纹理] 加载失败，隧道将使用默认材质:', textureUrl);
      concreteImage = null;
      resolve(); // 不阻塞后续流程
    };
    img.src = textureUrl;
  });
}

/** 移除隧道混凝土纹理 */
export function removeTunnelConcreteTexture() {
  concreteTextureUrl = null;
  concreteImage = null;
  for (const p of tunnelGlbPrimitives) p.customShader = undefined;
}
// =========================================================
// 地形透视效果（globe.translucency 距离驱动）
// =========================================================

/**
 * 开启地形透视效果（基于 globe.translucency.frontFaceAlphaByDistance）：
 * - 距相机 400m 以内：地形完全透明（alpha=0），可看穿山体进入隧道
 * - 距相机 800m 以外：地形完全不透明（alpha=1），正常显示山体
 * - 中间区：平滑线性过渡
 *
 * @param nearDistance  近端距离（米），地形完全透明，默认 400
 * @param farDistance   远端距离（米），地形完全不透明，默认 800
 */
export function enableTerrainTransparency(
  customViewer?: any,
  nearDistance = 400.0,
  farDistance = 800.0,
) {
  const viewer = customViewer || DTScopeEngine.viewer;
  if (!viewer) return;

  const globe = viewer.scene.globe;

  // 关闭相机碰撞，允许飞入山体/隧道
  viewer.scene.screenSpaceCameraController.enableCollisionDetection = false;

  // 关闭地形深度测试，使隧道模型在地形内部正常渲染
  globe.depthTestAgainstTerrain = false;

  // 开启地形半透明，初始 near/far 均为 0（与滑条初始值一致，由滑条统一控制）
  globe.translucency.enabled = true;
  globe.translucency.frontFaceAlphaByDistance = new Cesium.NearFarScalar(
    nearDistance, 0.9,
    farDistance,  0.9,
  );

  console.log(`[DrawLine] 地形透视已启用（near=${nearDistance}m，far=${farDistance}m，α=0.9）`);
}

/**
 * 关闭地形透视效果，恢复地形完全不透明
 */
export function disableTerrainTransparency(customViewer?: any) {
  const viewer = customViewer || DTScopeEngine.viewer;
  if (!viewer) return;

  const globe = viewer.scene.globe;

  globe.translucency.enabled = false;
  globe.depthTestAgainstTerrain = true;
  viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;

  console.log('[DrawLine] 地形透视已关闭');
}

// 每块最多点数：使用 POSITION_NORMAL_AND_ST，保守取 300 保证不超 65535 索引上限
/**
 * 控制隧道中线实体显示/隐藏
 */
export function setCenterLineVisible(show: boolean) {
  const viewer = (DTScopeEngine as any).viewer;

  // 优先通过固定 id 查找（最可靠）
  if (viewer) {
    const entity = viewer.entities.getById('centerline-main');
    if (entity) {
      entity.show = show;
      return;
    }
  }

  // 兜底：直接引用
  if (allLineEntity) {
    allLineEntity.show = show;
  }
}

// =========================================================
// 新增：场景环境控制工具函数 (移植自 Previous 类)
// =========================================================

/**
 * 开启全黑模型模式 (隐藏地球、天空，设置特定模型光照)
 * @param customViewer 传入当前页面的 viewer (如果不传，默认用大屏的)
 */
export function enableBlackModelMode(customViewer?: any) {
  const viewer = customViewer || DTScopeEngine.viewer;
  if (!viewer) return;

  const sceneController = viewer.scene;
  
  // 1. 隐藏基础环境要素（隐藏地球和天空）
  sceneController.sun.show = false;
  sceneController.globe.show = false; // 直接隐藏地球
  sceneController.moon.show = false;
  sceneController.skyBox.show = false;

  // 2. 设置特定的方向光（移植过来的打光参数）
  sceneController.light = new Cesium.DirectionalLight({
    direction: new Cesium.Cartesian3(0.354925, -0.890918, -0.283358),
  });

  console.log('🌑 已切换至全黑模型模式');
}

/**
 * 恢复正常地球显示模式
 * @param customViewer 传入当前页面的 viewer
 */
export function restoreEarthMode(customViewer?: any) {
  const viewer = customViewer || DTScopeEngine.viewer;
  if (!viewer) return;

  const sceneController = viewer.scene;
  
  // 1. 恢复显示
  sceneController.sun.show = true;
  sceneController.globe.show = true;
  sceneController.moon.show = true;
  sceneController.skyBox.show = true;

  // 2. 恢复默认的太阳光照
  sceneController.light = new Cesium.SunLight();
  console.log('🌍 已恢复地球显示');
}


// =========================================================
// 图形绘制工具
// =========================================================

/**
 * 加载并显示隧道/道路中线 
 * @param customViewer 可以指定 viewer
 * @param isBlackStyle 是否需要同时将环境变黑（默认 true 兼容你以前的大屏）
 */
export function loadCenterLine(
  customViewer?: any,
  isBlackStyle: boolean = true,
  skipZoom: boolean = false
) {
  const viewer = customViewer || DTScopeEngine.viewer;
  if (!viewer) {
    console.warn('❌ Viewer 未初始化');
    return;
  }

  // 1. 强制开启渲染循环
  viewer.useDefaultRenderLoop = true;
  viewer.clock.shouldAnimate = true;

  // 2. 调用我们刚刚封装好的环境切换函数
  if (isBlackStyle) {
    enableBlackModelMode(viewer);
  }

  // 3. 清理旧数据
  if (allLineEntity) {
    viewer.entities.remove(allLineEntity);
    allLineEntity = null;
  }

  // 4. 解析数据
  // @ts-ignore
  const feature = centerLineData.features?.[0]; 
  if (!feature) {
    console.error('❌ 中线数据无效');
    return;
  }

  const coordinates = feature.geometry.coordinates;
  const positions: any[] = [];
  let lastPoint: any = null;

  coordinates.forEach((point: any[]) => {
    const lon = Number(point[0]);
    const lat = Number(point[1]);
    
    let height = Number(point[2]) || 0;

    // 1. 剔除解析出来是 NaN 的坏数据
    if (!isNaN(lon) && !isNaN(lat)) {
      const currentPoint = Cesium.Cartesian3.fromDegrees(lon, lat, height);
      if (!lastPoint || !Cesium.Cartesian3.equalsEpsilon(currentPoint, lastPoint, 1e-5)) {
        positions.push(currentPoint);
        lastPoint = currentPoint;
      }
    }
  });
  if (positions.length < 2) {
    console.warn('⚠️ 过滤后有效坐标不足2个，无法连成线！');
    return;
  }
  console.log(`📍 原始点位: ${coordinates.length} 个，过滤去重后: ${positions.length} 个`);
  
  // 5. 绘制【悬浮发光中线】
  allLineEntity = viewer.entities.add({
    id: 'centerline-main',
    name: '项目中线',
    polyline: {
      positions: positions,
      width: 5,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.2,
        color: Cesium.Color.YELLOW.withAlpha(0.8),
      }),
      // 如果在有地形的情况下 (isBlackStyle 为 false)，应该贴地 (clampToGround: true)。
      // 如果在黑底模式下 (isBlackStyle 为 true)，由于我们手动将高程置为了0，可以直接 false 并且能平贴在底面，或者 true 也可以，
      // 但保险起见，保持与原项目同样的逻辑： clampToGround: !isBlackStyle
      clampToGround: !isBlackStyle, 
    },
  });

  // 6. 视角定位
  if (!skipZoom) {
    console.log('📷 正在自动缩放到线路范围...');
    if (allLineEntity) {
      viewer.zoomTo(allLineEntity).then(() => {
        console.log('✅ 定位完成');
      });
    }
  }
}

// =========================================================
// 地质模型加载工具
// =========================================================

// =========================================================
// 钢筋网支护模型（沿中线起点布置，两层交替间隔25cm，总长23m）
// =========================================================

const REBAR_SPACING = 0.25;   // 层间距 25cm
const REBAR_TOTAL_LENGTH = 23; // 总长 23m
let rebarPrimitives: any[] = [];
let secondRebarPrimitives: any[] = [];

// 中线采样工具（懒初始化，供各加载函数复用）
let _clinePositions: Cesium.Cartesian3[] | null = null;
let _clineCumLen: number[] | null = null;

function getCenterlineUtils(): {
  sampleAt: (t: number) => Cesium.Cartesian3;
  totalLen: number;
  makeModelMatrix: (pos: Cesium.Cartesian3, next: Cesium.Cartesian3) => Cesium.Matrix4;
} | null {
  if (_clinePositions && _clineCumLen) {
    const totalLen = _clineCumLen[_clineCumLen.length - 1];
    return { sampleAt: (t: number) => sampleAtImpl(t, _clinePositions!, _clineCumLen!, totalLen), totalLen, makeModelMatrix };
  }
  const feature = (centerLineData as any).features?.[0];
  if (!feature) return null;
  const raw: any[] = feature.geometry.coordinates;
  const positions: Cesium.Cartesian3[] = [];
  let lastPt: Cesium.Cartesian3 | null = null;
  for (const pt of raw) {
    const c = Cesium.Cartesian3.fromDegrees(Number(pt[0]), Number(pt[1]), Number(pt[2]) || 0);
    if (!lastPt || Cesium.Cartesian3.distance(c, lastPt) > 0.01) {
      positions.push(c);
      lastPt = c;
    }
  }
  if (positions.length < 2) return null;
  const cumLen: number[] = [0];
  for (let i = 1; i < positions.length; i++) {
    cumLen.push(cumLen[i - 1] + Cesium.Cartesian3.distance(positions[i], positions[i - 1]));
  }
  _clinePositions = positions;
  _clineCumLen = cumLen;
  const totalLen = cumLen[cumLen.length - 1];
  return { sampleAt: (t: number) => sampleAtImpl(t, positions, cumLen, totalLen), totalLen, makeModelMatrix };
}

function sampleAtImpl(t: number, positions: Cesium.Cartesian3[], cumLen: number[], totalLen: number): Cesium.Cartesian3 {
  t = Math.max(0, Math.min(totalLen, t));
  let lo = 0, hi = cumLen.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (cumLen[mid] <= t) lo = mid; else hi = mid;
  }
  const segLen = cumLen[hi] - cumLen[lo];
  const alpha = segLen < 1e-9 ? 0 : (t - cumLen[lo]) / segLen;
  return Cesium.Cartesian3.lerp(positions[lo], positions[hi], alpha, new Cesium.Cartesian3());
}

function makeModelMatrix(pos: Cesium.Cartesian3, next: Cesium.Cartesian3, downOffsetZ: number = -1.25): Cesium.Matrix4 {
  const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(pos);
  const invEnu = Cesium.Matrix4.inverseTransformation(enuMatrix, new Cesium.Matrix4());
  const dir = Cesium.Cartesian3.subtract(next, pos, new Cesium.Cartesian3());
  const localDir = Cesium.Matrix4.multiplyByPointAsVector(invEnu, dir, new Cesium.Cartesian3());
  const heading = Math.atan2(localDir.x, localDir.y) + Math.PI / 2;
  const hpr = new Cesium.HeadingPitchRoll(heading, 0, 0);
  let m = Cesium.Transforms.headingPitchRollToFixedFrame(pos, hpr);
  const downOffset = Cesium.Matrix4.fromTranslation(new Cesium.Cartesian3(0, 0, downOffsetZ));
  return Cesium.Matrix4.multiply(m, downOffset, new Cesium.Matrix4());
}

/** 加载洞口钢筋网（第一节 23m） */
export function loadRebarMeshes(customViewer?: any) {
  const viewer = customViewer || DTScopeEngine.viewer;
  if (!viewer) return;
  if (rebarPrimitives.length > 0) return;

  const utils = getCenterlineUtils();
  if (!utils) return;

  const mesh1Url = 'data/zhihu/Z-PM-23m/Z-PM-钢筋第一层.glb';
  const mesh2Url = 'data/zhihu/Z-PM-23m/Z-PM-钢筋第二层.glb';
  const count = Math.floor(REBAR_TOTAL_LENGTH / REBAR_SPACING) + 1;

  for (let i = 0; i < count; i++) {
    const dist = i * REBAR_SPACING;
    const pos = utils.sampleAt(dist);
    const next = utils.sampleAt(Math.min(dist + 0.01, utils.totalLen));
    const modelMatrix = makeModelMatrix(pos, next);
    const url = i % 2 === 0 ? mesh1Url : mesh2Url;
    Cesium.Model.fromGltfAsync({ url, modelMatrix })
      .then((model: any) => { rebarPrimitives.push(viewer.scene.primitives.add(model)); })
      .catch((e: any) => console.error(`[DrawLine] 洞口钢筋网加载失败:`, e));
  }
  console.log(`[DrawLine] 洞口钢筋网共 ${count} 层（间距${REBAR_SPACING}m，总长${REBAR_TOTAL_LENGTH}m）`);
}

/** 加载二衬钢筋（第二节 44m，从 23m 处开始） */
export function loadSecondRebarMeshes(customViewer?: any) {
  const viewer = customViewer || DTScopeEngine.viewer;
  if (!viewer) return;
  if (secondRebarPrimitives.length > 0) return;

  const utils = getCenterlineUtils();
  if (!utils) return;

  const SECOND_START = 23;
  const SECOND_LENGTH = 44;
  const mesh1Url = 'data/zhihu/ZZ-QJsx-44m/ZZ-QJsx-二衬钢筋第一层.glb';
  const mesh2Url = 'data/zhihu/ZZ-QJsx-44m/ZZ-QJsx-二衬钢筋第二层.glb';
  const count = Math.floor(SECOND_LENGTH / REBAR_SPACING) + 1;

  for (let i = 0; i < count; i++) {
    const dist = SECOND_START + i * REBAR_SPACING;
    const pos = utils.sampleAt(dist);
    const next = utils.sampleAt(Math.min(dist + 0.01, utils.totalLen));
    const modelMatrix = makeModelMatrix(pos, next, 0);
    const url = i % 2 === 0 ? mesh1Url : mesh2Url;
    Cesium.Model.fromGltfAsync({ url, modelMatrix })
      .then((model: any) => { secondRebarPrimitives.push(viewer.scene.primitives.add(model)); })
      .catch((e: any) => console.error(`[DrawLine] 二衬钢筋加载失败:`, e));
  }
  console.log(`[DrawLine] 二衬钢筋共 ${count} 层（起始${SECOND_START}m，总长${SECOND_LENGTH}m）`);
}

/** 移除所有支护模型 */
export function removeRebarMeshes(customViewer?: any) {
  const viewer = customViewer || DTScopeEngine.viewer;
  if (!viewer) return;
  for (const p of rebarPrimitives) { try { viewer.scene.primitives.remove(p); } catch (_) {} }
  for (const p of secondRebarPrimitives) { try { viewer.scene.primitives.remove(p); } catch (_) {} }
  for (const p of steelFramePrimitives) { try { viewer.scene.primitives.remove(p); } catch (_) {} }
  for (const p of pipeShedPrimitives) { try { viewer.scene.primitives.remove(p.model); } catch (_) {} }
  for (const p of anchorPrimitives) { try { viewer.scene.primitives.remove(p.model); } catch (_) {} }
  rebarPrimitives = [];
  secondRebarPrimitives = [];
  steelFramePrimitives = [];
  pipeShedPrimitives = [];
  anchorPrimitives = [];
}

/** 控制洞口钢筋网（第一节 23m）显示/隐藏 */
export function setRebarMeshesVisible(show: boolean) {
  for (const p of rebarPrimitives) p.show = show;
}

/** 控制洞口钢筋网黄色高亮 */
export function setRebarHighlight(enabled: boolean) {
  for (const p of rebarPrimitives) {
    p.color = enabled ? Cesium.Color.YELLOW : Cesium.Color.WHITE;
  }
}

/** 控制二衬钢筋（第二节 44m）显示/隐藏 */
export function setSecondRebarVisible(show: boolean) {
  for (const p of secondRebarPrimitives) p.show = show;
}

/** 控制二衬钢筋黄色高亮 */
export function setSecondRebarHighlight(enabled: boolean) {
  for (const p of secondRebarPrimitives) {
    p.color = enabled ? Cesium.Color.YELLOW : Cesium.Color.WHITE;
  }
}

// ── 钢架模型 ────────────────────────────────────────────────
let steelFramePrimitives: any[] = [];

/** 加载钢架模型（从 23m 处开始，间隔 1m，总长 44m） */
export function loadSteelFrameMeshes(customViewer?: any) {
  const viewer = customViewer || DTScopeEngine.viewer;
  if (!viewer) return;
  if (steelFramePrimitives.length > 0) return;

  const utils = getCenterlineUtils();
  if (!utils) return;

  const STEEL_START = 23;
  const STEEL_LENGTH = 44;
  const STEEL_SPACING = 0.5;
  const url = 'data/zhihu/ZZ-QJsx-44m/ZZ-QJsx-钢架.glb';
  const count = Math.floor(STEEL_LENGTH / STEEL_SPACING) + 1;

  for (let i = 0; i < count; i++) {
    const dist = STEEL_START + i * STEEL_SPACING;
    const pos = utils.sampleAt(dist);
    const next = utils.sampleAt(Math.min(dist + 0.01, utils.totalLen));
    const modelMatrix = makeModelMatrix(pos, next, 0);
    Cesium.Model.fromGltfAsync({ url, modelMatrix })
      .then((model: any) => { steelFramePrimitives.push(viewer.scene.primitives.add(model)); })
      .catch((e: any) => console.error(`[DrawLine] 钢架加载失败:`, e));
  }
  console.log(`[DrawLine] 钢架共 ${count} 榀（起始${STEEL_START}m，间距${STEEL_SPACING}m，总长${STEEL_LENGTH}m）`);
}

/** 控制钢架显示/隐藏 */
export function setSteelFrameVisible(show: boolean) {
  for (const p of steelFramePrimitives) p.show = show;
}

/** 控制钢架黄色高亮 */
export function setSteelFrameHighlight(enabled: boolean) {
  for (const p of steelFramePrimitives) {
    p.color = enabled ? Cesium.Color.YELLOW : Cesium.Color.WHITE;
  }
}

// ── 中管棚模型 ──────────────────────────────────────────────
interface PipeShedEntry { model: any; theta: number }
let pipeShedPrimitives: PipeShedEntry[] = [];

const PIPESHED_START = 23;
const PIPESHED_LENGTH = 44;
const PIPESHED_LONG_SPACING = 5.5;
const PIPESHED_CIRC_SPACING = 0.4;
const PIPESHED_ARCH_ANGLE = 120;
const PIPESHED_TILT_DEG = 2;
const PIPESHED_RADIUS = 6.33;
const PIPESHED_CENTER_Y = 2.1;  // 拱圆心在中线上方 2.1m

/** 加载中管棚模型（搭在每榀钢架上） */
export function loadPipeShedMeshes(customViewer?: any) {
  const viewer = customViewer || DTScopeEngine.viewer;
  if (!viewer) return;
  if (pipeShedPrimitives.length > 0) return;

  const utils = getCenterlineUtils();
  if (!utils) return;

  const url = 'data/zhihu/ZZ-QJsx-44m/ZZ-QJsx-φ76中管棚.glb';
  const archHalf = PIPESHED_ARCH_ANGLE / 2 * Math.PI / 180;
  const sideArcLen = PIPESHED_RADIUS * archHalf;
  const sideCount = Math.floor(sideArcLen / PIPESHED_CIRC_SPACING);

  // 预计算环向角度列表
  const thetaList: number[] = [];
  for (let i = 0; i < sideCount; i++) {
    const arcDist = (i + 0.5) * PIPESHED_CIRC_SPACING;
    const theta = arcDist / PIPESHED_RADIUS;
    thetaList.push(theta);
    thetaList.push(-theta);
  }
  thetaList.sort((a, b) => a - b);

  const tiltRad = Cesium.Math.toRadians(PIPESHED_TILT_DEG);
  const ringCount = Math.floor(PIPESHED_LENGTH / PIPESHED_LONG_SPACING) + 1;

  for (let ri = 0; ri < ringCount; ri++) {
    const ringDist = PIPESHED_START + ri * PIPESHED_LONG_SPACING - 0.15;
    const pos = utils.sampleAt(ringDist);
    const next = utils.sampleAt(Math.min(ringDist + 0.1, utils.totalLen));
    const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(pos);
    const invEnu = Cesium.Matrix4.inverseTransformation(enuMatrix, new Cesium.Matrix4());
    const dir = Cesium.Cartesian3.subtract(next, pos, new Cesium.Cartesian3());
    const localDir = Cesium.Matrix4.multiplyByPointAsVector(invEnu, dir, new Cesium.Cartesian3());
    const tunnelHeading = Math.atan2(localDir.x, localDir.y);
    const cosH = Math.cos(tunnelHeading);
    const sinH = Math.sin(tunnelHeading);

    for (const theta of thetaList) {
      const sideDist = PIPESHED_RADIUS * Math.sin(theta);
      const upDist = PIPESHED_CENTER_Y + PIPESHED_RADIUS * Math.cos(theta);
      const localOffset = new Cesium.Cartesian3(sideDist * cosH, -sideDist * sinH, upDist);
      const worldOffset = Cesium.Matrix4.multiplyByPointAsVector(enuMatrix, localOffset, new Cesium.Cartesian3());
      const pipePos = Cesium.Cartesian3.add(pos, worldOffset, new Cesium.Cartesian3());
      const hpr = new Cesium.HeadingPitchRoll(tunnelHeading, 0, 0);
      let m = Cesium.Transforms.headingPitchRollToFixedFrame(pipePos, hpr);
      const tiltRot = Cesium.Matrix3.fromRotationX(tiltRad);
      const tiltM4 = Cesium.Matrix4.fromRotationTranslation(tiltRot);
      m = Cesium.Matrix4.multiply(m, tiltM4, new Cesium.Matrix4());
      Cesium.Model.fromGltfAsync({
        url,
        modelMatrix: m,
      })
        .then((model: any) => { pipeShedPrimitives.push({ model: viewer.scene.primitives.add(model), theta }); })
        .catch((e: any) => console.error(`[DrawLine] 中管棚加载失败:`, e));
    }
  }

  console.log(`[DrawLine] 中管棚共 ${ringCount} 环 × ${thetaList.length} 根，R=${PIPESHED_RADIUS}m`);
}

/** 控制中管棚显示/隐藏 */
export function setPipeShedVisible(show: boolean) {
  for (const p of pipeShedPrimitives) p.model.show = show;
}

/** 控制中管棚黄色高亮 */
export function setPipeShedHighlight(enabled: boolean) {
  for (const p of pipeShedPrimitives) {
    p.model.color = enabled ? Cesium.Color.YELLOW : Cesium.Color.WHITE;
  }
}

// ── 锚杆模型 ────────────────────────────────────────────────
interface AnchorEntry { model: any; theta: number }
let anchorPrimitives: AnchorEntry[] = [];

const ANCHOR_START = 23;
const ANCHOR_LENGTH = 44;
const ANCHOR_LONG_SPACING = 0.5;
const ANCHOR_CIRC_SPACING = 2.4;
const ANCHOR_ARCH_ANGLE = 120;
const ANCHOR_TILT_DEG = 0;
const ANCHOR_RADIUS = 6.33;
const ANCHOR_CENTER_Y = 2.1;

/** 加载锚杆模型（梅花状铺设，垂直插入） */
export function loadAnchorMeshes(customViewer?: any) {
  const viewer = customViewer || DTScopeEngine.viewer;
  if (!viewer) return;
  if (anchorPrimitives.length > 0) return;

  const utils = getCenterlineUtils();
  if (!utils) return;

  const url = 'data/zhihu/ZZ-QJsx-44m/ZZ-QJsx-φ25自进式中空注浆锚杆.glb';
  const archHalf = ANCHOR_ARCH_ANGLE / 2 * Math.PI / 180;
  const sideArcLen = ANCHOR_RADIUS * archHalf;
  const sideCount = Math.floor(sideArcLen / ANCHOR_CIRC_SPACING);
  // 调试：2环梅花状
  const ringCount = 2;
  for (let ri = 0; ri < ringCount; ri++) {
    const ringDist = ANCHOR_START + ri * ANCHOR_LONG_SPACING;
    const pos = utils.sampleAt(ringDist);
    const next = utils.sampleAt(Math.min(ringDist + 0.1, utils.totalLen));
    const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(pos);
    const invEnu = Cesium.Matrix4.inverseTransformation(enuMatrix, new Cesium.Matrix4());
    const dir = Cesium.Cartesian3.subtract(next, pos, new Cesium.Cartesian3());
    const localDir = Cesium.Matrix4.multiplyByPointAsVector(invEnu, dir, new Cesium.Cartesian3());
    const tunnelHeading = Math.atan2(localDir.x, localDir.y);
    const cosH = Math.cos(tunnelHeading);
    const sinH = Math.sin(tunnelHeading);

    const place = (theta: number) => {
      const sideDist = ANCHOR_RADIUS * Math.sin(theta);
      const upDist = ANCHOR_CENTER_Y + ANCHOR_RADIUS * Math.cos(theta);
      const localOffset = new Cesium.Cartesian3(sideDist * cosH, -sideDist * sinH, upDist);
      const worldOffset = Cesium.Matrix4.multiplyByPointAsVector(enuMatrix, localOffset, new Cesium.Cartesian3());
      const anchorPos = Cesium.Cartesian3.add(pos, worldOffset, new Cesium.Cartesian3());
      const m = buildAnchorMatrix(anchorPos, tunnelHeading, theta);
      Cesium.Model.fromGltfAsync({ url, modelMatrix: m })
        .then((mdl: any) => { anchorPrimitives.push({ model: viewer.scene.primitives.add(mdl), theta }); })
        .catch((e: any) => console.error(`[DrawLine] 锚杆加载失败:`, e));
    };

    // 偶数环从拱顶开始(i=0→θ=0)，奇数环错开半间距
    const offset = ri % 2 === 0 ? 0 : ANCHOR_CIRC_SPACING / 2;
    const startI = ri % 2 === 0 ? 1 : 0; // 偶数环跳过i=0(已单独place拱顶)
    if (ri % 2 === 0) place(0);
    for (let i = startI; i <= sideCount + 1; i++) {
      const arcDist = offset + i * ANCHOR_CIRC_SPACING;
      if (arcDist > sideArcLen) break;
      const theta = arcDist / ANCHOR_RADIUS;
      place(theta);
      place(-theta);
    }
  }

  console.log(`[DrawLine] 锚杆调试：2环梅花状，R=${ANCHOR_RADIUS}m`);
}

/** 控制锚杆显示/隐藏 */
export function setAnchorVisible(show: boolean) {
  for (const p of anchorPrimitives) p.model.show = show;
}

/** 控制锚杆黄色高亮 */
export function setAnchorHighlight(enabled: boolean) {
  for (const p of anchorPrimitives) {
    p.model.color = enabled ? Cesium.Color.YELLOW : Cesium.Color.WHITE;
  }
}

function buildAnchorMatrix(anchorPos: Cesium.Cartesian3, tunnelHeading: number, theta: number): Cesium.Matrix4 {
  // 从钢架 GLB 精确法向 (glTF 空间): 圆心角 θ 处，外法向 = (sinθ, cosθ, 0)
  const nxGl = Math.sin(theta);
  const nyGl = Math.cos(theta);
  const nzGl = 0;
  // 锚杆 glTF+X → 目标方向 (nxGl, nyGl, 0)，绕 glTF+Z(=Cesium-Y) 旋转
  const rotAngle = Math.atan2(nyGl, nxGl);
  let m = Cesium.Transforms.headingPitchRollToFixedFrame(anchorPos, new Cesium.HeadingPitchRoll(tunnelHeading, 0, 0));
  const rY = Cesium.Matrix3.fromRotationY(-rotAngle);
  m = Cesium.Matrix4.multiply(m, Cesium.Matrix4.fromRotationTranslation(rY), new Cesium.Matrix4());
  return m;
}
let activeGeoModel: any = null;

/**
 * 在隧道中线指定位置加载 GLB 地质模型
 * @param url    模型路径，放在 public/ 下则填 '/models/xxx/model.glb'
 * @param lon    锚点经度
 * @param lat    锚点纬度
 * @param height 锚点高程（米）
 * @param customViewer
 */
export function loadGeoModel(
  url: string,
  lon: number,
  lat: number,
  height: number,
  customViewer?: any
): any {
  const viewer = customViewer || DTScopeEngine.viewer;
  if (!viewer) return null;

  // 移除上一个地质模型
  if (activeGeoModel) {
    try { viewer.scene.primitives.remove(activeGeoModel); } catch (_) {}
    activeGeoModel = null;
  }

  const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(
    Cesium.Cartesian3.fromDegrees(lon, lat, height)
  );

  Cesium.Model.fromGltfAsync({ url, modelMatrix })
    .then((model) => {
      activeGeoModel = viewer.scene.primitives.add(model);
      console.log(`📦 地质模型已加载：${url}`);
    })
    .catch((e) => {
      console.error('[DrawLine] 地质模型加载失败:', e);
    });
  return null;
}

/**
 * 移除当前地质模型
 */
export function removeGeoModel(customViewer?: any) {
  const viewer = customViewer || DTScopeEngine.viewer;
  if (!viewer || !activeGeoModel) return;
  try { viewer.scene.primitives.remove(activeGeoModel); } catch (_) {}
  activeGeoModel = null;
}

// =========================================================
// GLB 隧道模型沿中线拼接加载
// =========================================================

/**
 * 加载分段隧道模型（17段：tunnel000.glb ~ tunnel016.glb）
 * 使用手动调好的位置和朝向
 */
const SEGMENT_COUNT = 17;

// 手动调整的每段位置和朝向
const SEGMENT_CONFIGS: { lon: number; lat: number; height: number; headingDeg: number }[] = [
  { lon: 94.8943747778, lat: 29.5328943333, height: 2943.001, headingDeg: 90 },
  { lon: 94.8994591299, lat: 29.533666056799998, height: 2945.511, headingDeg: 90 },
  { lon: 94.9046167002, lat: 29.5335168988, height: 2948.021, headingDeg: 90 },
  { lon: 94.9096121866, lat: 29.5324591149, height: 2950.521, headingDeg: 90 },
  { lon: 94.9142762668, lat: 29.530528552299998, height: 2953.031, headingDeg: 90 },
  { lon: 94.9184237403, lat: 29.527863081299998, height: 2955.531, headingDeg: 90 },
  { lon: 94.9224308627, lat: 29.5250512374, height: 2958.021, headingDeg: 90 },
  { lon: 94.926453861, lat: 29.5222279812, height: 2960.521, headingDeg: 90 },
  { lon: 94.93047663509999, lat: 29.5194046043, height: 2963.021, headingDeg: 90 },
  { lon: 94.9344991851, lat: 29.516581097699998, height: 2965.521, headingDeg: 90 },
  { lon: 94.93850541569999, lat: 29.5137687733, height: 2968.011, headingDeg: 90 },
  { lon: 94.9425275186, lat: 29.510945035, height: 2970.511, headingDeg: 90 },
  { lon: 94.94654939739999, lat: 29.508121176099998, height: 2973.011, headingDeg: 90 },
  { lon: 94.9505549596, lat: 29.5053084919, height: 2975.501, headingDeg: 90 },
  { lon: 94.9545763914, lat: 29.5024843835, height: 2978.001, headingDeg: 90 },
  { lon: 94.95859759929999, lat: 29.499660163599998, height: 2977.566, headingDeg: 90 },
  { lon: 94.9626185833, lat: 29.496835823399998, height: 2965.48, headingDeg: 90 },
];

export function loadTunnelGlb(customViewer?: any) {
  const viewer = customViewer || DTScopeEngine.viewer;
  if (!viewer) return;

  removeTunnelGlb(viewer);

  let loadedCount = 0;

  for (let i = 0; i < SEGMENT_COUNT; i++) {
    const cfg = SEGMENT_CONFIGS[i];
    const pos = Cesium.Cartesian3.fromDegrees(cfg.lon, cfg.lat, cfg.height);
    const hpr = new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(cfg.headingDeg), 0, 0);
    const modelMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(pos, hpr);

    const idx = String(i).padStart(3, '0');
    const url = `data/tunnel/tunnel${idx}.glb`;

    Cesium.Model.fromGltfAsync({ url, modelMatrix })
      .then((model: any) => {
        tunnelGlbPrimitives.push(viewer.scene.primitives.add(model));
        loadedCount++;
        if (loadedCount === SEGMENT_COUNT) {
          console.log(`[DrawLine] 分段隧道 GLB 全部 ${SEGMENT_COUNT} 段加载完成`);
        }
      })
      .catch((e: any) => console.error(`[DrawLine] tunnel${idx}.glb 加载失败:`, e));
  }

  console.log(`[DrawLine] 分段隧道 GLB 共 ${SEGMENT_COUNT} 段待加载`);
}

/**
 * 移除所有 GLB 隧道节
 */
export function removeTunnelGlb(customViewer?: any) {
  const viewer = customViewer || DTScopeEngine.viewer;
  if (!viewer) return;
  for (const p of tunnelGlbPrimitives) {
    try { viewer.scene.primitives.remove(p); } catch (_) {}
  }
  tunnelGlbPrimitives = [];
}

/**
 * 控制 GLB 隧道节显示/隐藏
 */
export function setTunnelGlbVisible(show: boolean) {
  for (const p of tunnelGlbPrimitives) p.show = show;
}

// =========================================================
// 风场模拟专用隧道模型（data/wind/suidao.glb）
// =========================================================

/**
 * 检测中线中最长的近乎直线段，并在此处加载风场模拟隧道完整模型
 * 模型是直的，需放在弯曲度最小的位置
 */
export function loadWindTunnelGlb(customViewer?: any) {
  const viewer = customViewer || DTScopeEngine.viewer;
  if (!viewer) return;

  removeWindTunnelGlb(viewer);

  const feature = (centerLineData as any).features?.[0];
  if (!feature) return;

  const raw: any[] = feature.geometry.coordinates;

  // 过滤过近点
  const pts: Cesium.Cartesian3[] = [];
  let last: Cesium.Cartesian3 | null = null;
  for (const p of raw) {
    const c = Cesium.Cartesian3.fromDegrees(Number(p[0]), Number(p[1]), Number(p[2]) || 0);
    if (!last || Cesium.Cartesian3.distance(c, last) > 0.5) {
      pts.push(c);
      last = c;
    }
  }
  if (pts.length < 2) return;

  // 计算每段方向（归一化向量）
  const dirs: Cesium.Cartesian3[] = [];
  for (let i = 1; i < pts.length; i++) {
    const d = Cesium.Cartesian3.subtract(pts[i], pts[i - 1], new Cesium.Cartesian3());
    Cesium.Cartesian3.normalize(d, d);
    dirs.push(d);
  }

  // 滑动扫描：找出方向变化 < 3° 的最长连续段
  const ANGLE_THRESHOLD = Math.cos(Cesium.Math.toRadians(3)); // cos(3°)
  let bestStart = 0;
  let bestEnd = 0;

  for (let i = 0; i < dirs.length; i++) {
    let j = i;
    while (j < dirs.length) {
      const dot = Cesium.Cartesian3.dot(dirs[i], dirs[j]);
      if (dot < ANGLE_THRESHOLD) break;
      j++;
    }
    if (j - i > bestEnd - bestStart) {
      bestStart = i;
      bestEnd = j;
    }
  }

  // 取直段末端作为模型放置位
  const posIdx = Math.min(bestEnd, pts.length - 1);
  const pos = pts[posIdx];

  // 用直段的平均方向计算 heading
  let avgDir = new Cesium.Cartesian3(0, 0, 0);
  for (let i = bestStart; i < bestEnd; i++) {
    avgDir = Cesium.Cartesian3.add(avgDir, dirs[i], avgDir);
  }
  Cesium.Cartesian3.normalize(avgDir, avgDir);

  const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(pos);
  const invEnu = Cesium.Matrix4.inverseTransformation(enuMatrix, new Cesium.Matrix4());
  const localDir = Cesium.Matrix4.multiplyByPointAsVector(invEnu, avgDir, new Cesium.Cartesian3());
  const heading = Math.atan2(localDir.x, localDir.y) + Math.PI / 2;

  const hpr = new Cesium.HeadingPitchRoll(heading, 0, 0);
  const modelMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(pos, hpr);

  const url = 'data/wind/suidao.glb';

  Cesium.Model.fromGltfAsync({ url, modelMatrix })
    .then((model: any) => {
      windTunnelGlbPrimitives.push(viewer.scene.primitives.add(model));
      console.log(`[DrawLine] 风场隧道模型已加载，放置于直段中点（索引 ${posIdx}，直段长 ${pts.length} 个点）`);
    })
    .catch((e: any) => console.error('[DrawLine] wind/suidao.glb 加载失败:', e));
}

/**
 * 移除风场模拟隧道模型
 */
export function removeWindTunnelGlb(customViewer?: any) {
  const viewer = customViewer || DTScopeEngine.viewer;
  if (!viewer) return;
  for (const p of windTunnelGlbPrimitives) {
    try { viewer.scene.primitives.remove(p); } catch (_) {}
  }
  windTunnelGlbPrimitives = [];
}


