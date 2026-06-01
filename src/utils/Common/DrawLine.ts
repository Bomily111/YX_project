/*
 * @Description: 基础图形绘制工具 (整合版：AHD逻辑移入 + 场景环境控制)
 */
import * as Cesium from 'cesium';
import { DTScopeEngine } from './Viewer';
import centerLineData from '@/assets/data/centerLine.json';

// 全局变量存储实体引用
let allLineEntity: Cesium.Entity | null | undefined = null;
let tunnelGlbPrimitives: any[] = [];

// ── 隧道混凝土纹理 ─────────────────────────────────────────
let concreteTextureUrl: string | null = null;
let concreteImage: HTMLImageElement | null = null;

function buildConcreteShader(): Cesium.CustomShader | null {
  if (!concreteImage) return null;
  return new Cesium.CustomShader({
    uniforms: {
      u_concrete: {
        type: Cesium.UniformType.SAMPLER_2D,
        value: new Cesium.TextureUniform({ image: concreteImage }),
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

/** 加载钢筋网支护模型：沿中线从起点开始，两层交替放置，间隔25cm，总长23m */
export function loadRebarMeshes(customViewer?: any) {
  const viewer = customViewer || DTScopeEngine.viewer;
  if (!viewer) return;
  if (rebarPrimitives.length > 0) return; // 已加载

  const mesh1Url = 'data/zhihu/1.glb';
  const mesh2Url = 'data/zhihu/2.glb';

  const feature = (centerLineData as any).features?.[0];
  if (!feature) return;

  const raw: any[] = feature.geometry.coordinates;

  // 转为 Cartesian3，过滤过近点
  const positions: Cesium.Cartesian3[] = [];
  let lastPt: Cesium.Cartesian3 | null = null;
  for (const pt of raw) {
    const c = Cesium.Cartesian3.fromDegrees(Number(pt[0]), Number(pt[1]), Number(pt[2]) || 0);
    if (!lastPt || Cesium.Cartesian3.distance(c, lastPt) > 0.01) {
      positions.push(c);
      lastPt = c;
    }
  }
  if (positions.length < 2) return;

  // 累计弧长
  const cumLen: number[] = [0];
  for (let i = 1; i < positions.length; i++) {
    cumLen.push(cumLen[i - 1] + Cesium.Cartesian3.distance(positions[i], positions[i - 1]));
  }
  const totalLen = cumLen[cumLen.length - 1];

  function sampleAt(t: number): Cesium.Cartesian3 {
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

  const count = Math.floor(REBAR_TOTAL_LENGTH / REBAR_SPACING) + 1;

  for (let i = 0; i < count; i++) {
    const dist = i * REBAR_SPACING;
    const pos = sampleAt(dist);
    const next = sampleAt(Math.min(dist + 0.01, totalLen));

    // 从 ENU 局部坐标系计算朝向
    const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(pos);
    const invEnu = Cesium.Matrix4.inverseTransformation(enuMatrix, new Cesium.Matrix4());
    const dir = Cesium.Cartesian3.subtract(next, pos, new Cesium.Cartesian3());
    const localDir = Cesium.Matrix4.multiplyByPointAsVector(invEnu, dir, new Cesium.Cartesian3());
    const heading = Math.atan2(localDir.x, localDir.y) + Math.PI / 2;

    const hpr = new Cesium.HeadingPitchRoll(heading, 0, 0);
    const modelMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(pos, hpr);

    const url = i % 2 === 0 ? mesh1Url : mesh2Url;

    Cesium.Model.fromGltfAsync({ url, modelMatrix })
      .then((model: any) => {
        rebarPrimitives.push(viewer.scene.primitives.add(model));
      })
      .catch((e: any) => console.error(`[DrawLine] 钢筋网加载失败:`, e));
  }

  console.log(`[DrawLine] 钢筋网支护模型共放置 ${count} 层（间距${REBAR_SPACING}m，总长${REBAR_TOTAL_LENGTH}m）`);
}

/** 移除钢筋网支护模型 */
export function removeRebarMeshes(customViewer?: any) {
  const viewer = customViewer || DTScopeEngine.viewer;
  if (!viewer) return;
  for (const p of rebarPrimitives) {
    try { viewer.scene.primitives.remove(p); } catch (_) {}
  }
  rebarPrimitives = [];
}

/** 控制钢筋网支护模型显示/隐藏 */
export function setRebarMeshesVisible(show: boolean) {
  for (const p of rebarPrimitives) p.show = show;
}

/** 控制钢筋网模型黄色高亮 */
export function setRebarHighlight(enabled: boolean) {
  for (const p of rebarPrimitives) {
    p.color = enabled ? Cesium.Color.YELLOW : Cesium.Color.WHITE;
  }
}

/** 当前已加载的地质模型（用于切换时清理） */
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

const TUNNEL_SEGMENT_LENGTH = 11.8; // 每节隧道长度（米）

/**
 * 沿中线每 11.8m 放置一个 tunnel.glb 实例，朝向与该段走向一致
 */
export function loadTunnelGlb(customViewer?: any) {
  const viewer = customViewer || DTScopeEngine.viewer;
  if (!viewer) return;

  removeTunnelGlb(viewer);

  const feature = (centerLineData as any).features?.[0];
  if (!feature) return;

  const raw: any[] = feature.geometry.coordinates;

  // 将原始坐标转为 Cartesian3，过滤重复点
  const positions: Cesium.Cartesian3[] = [];
  let lastPt: Cesium.Cartesian3 | null = null;
  for (const pt of raw) {
    const c = Cesium.Cartesian3.fromDegrees(Number(pt[0]), Number(pt[1]), Number(pt[2]) || 0);
    if (!lastPt || Cesium.Cartesian3.distance(c, lastPt) > 0.5) {
      positions.push(c);
      lastPt = c;
    }
  }
  if (positions.length < 2) return;

  // 沿折线累计弧长，每 TUNNEL_SEGMENT_LENGTH 米取一个锚点
  // 锚点记录精确的插值位置，确保相邻节段首尾严格相接，无缝隙
  const anchors: { pos: Cesium.Cartesian3; next: Cesium.Cartesian3 }[] = [];

  // 预先计算折线各段累计弧长，用于精确插值
  const cumLen: number[] = [0];
  for (let i = 1; i < positions.length; i++) {
    cumLen.push(cumLen[i - 1] + Cesium.Cartesian3.distance(positions[i], positions[i - 1]));
  }
  const totalLen = cumLen[cumLen.length - 1];

  // 在折线上按弧长 t 精确插值
  function sampleAt(t: number): Cesium.Cartesian3 {
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

  for (let t = 0; t + TUNNEL_SEGMENT_LENGTH <= totalLen + 1e-6; t += TUNNEL_SEGMENT_LENGTH) {
    const pos = sampleAt(t);
    const next = sampleAt(Math.min(t + TUNNEL_SEGMENT_LENGTH, totalLen));
    anchors.push({ pos, next });
  }

  const url = 'data/suidao/tunnel.glb';

  for (const { pos, next } of anchors) {
    // 在 pos 处建立 ENU 局部坐标系，把 pos→next 方向向量投影到 ENU
    // 再用 east/north 分量算 heading（相对正北顺时针，弧度）
    const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(pos);
    const invEnu = Cesium.Matrix4.inverseTransformation(enuMatrix, new Cesium.Matrix4());

    const dir = Cesium.Cartesian3.subtract(next, pos, new Cesium.Cartesian3());
    const localDir = Cesium.Matrix4.multiplyByPointAsVector(invEnu, dir, new Cesium.Cartesian3());
    // localDir.x = east 分量，localDir.y = north 分量
    const heading = Math.atan2(localDir.x, localDir.y) + Math.PI / 2; // 正北=0，顺时针为正，+90° 修正模型朝向

    const hpr = new Cesium.HeadingPitchRoll(heading, 0, 0);
    const modelMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(pos, hpr);

    Cesium.Model.fromGltfAsync({ url, modelMatrix })
      .then((model: any) => {
        tunnelGlbPrimitives.push(viewer.scene.primitives.add(model));
      })
      .catch((e: any) => console.error('[DrawLine] suidao.glb 加载失败:', e));
  }

  console.log(`[DrawLine] 隧道 GLB 共放置 ${anchors.length} 节`);
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

