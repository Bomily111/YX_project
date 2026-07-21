/*
 * 地质模型控制器
 * 统一管理：体数据渲染（富水带/破碎带/TSP/TEM）+ 随道模型 + 相机视角
 * 坐标来源：Layue-master DataController.js
 */
import * as Cesium from 'cesium';
import { DTScopeEngine } from './Viewer';
// @ts-ignore
import { initVolume, clearVolume } from '@/utils/AllPrevious/All/ShareVolume01.js';
// @ts-ignore
import Previous from '@/utils/AllPrevious/index.js';

// ── 各模型配置 ────────────────────────────────────────────
interface ModelConfig {
  volumeUrl?: string;                   // 体数据 JSON 路径（public/ 根目录相对）
  cesiumConfig?: {                      // 体数据在 Cesium 场景中的变换（JSON 无 cesium 字段时使用）
    rotate: [number, number, number];
    translate: [number, number, number];
    scale: [number, number, number];
  };
  glbUrl?: string;                      // GLB 模型路径（单个）
  glbItems?: { url: string; mileage: number; heightOffset?: number }[]; // GLB 模型路径（多个，按里程定位）
  glbHeading?: number;                  // GLB 模型朝向（弧度，从正北顺时针）；不填则用 localFrame('up','east')
  glbRoll?: number;                     // GLB 模型绕自身X轴滚转（弧度）
  glbYRot?: number;                     // GLB 模型额外绕Y轴旋转（弧度）
  glbZRot?: number;                     // GLB 模型额外绕Z轴（上方）旋转（弧度）
  tunnelPos: [number, number, number];  // 模型锚点 [lon, lat, h]；glbItems 模式下作为参考里程的位置
  tunnelHeading: number;                // 随道参考模型朝向（弧度，与 Layue-master 原始值一致）
  referenceMileage?: number;            // glbItems 模式下的参考里程（DK 数字），其他里程相对此偏移
  flyDest: { x: number; y: number; z: number }; // 飞行目标（ECEF）
  flyOrientation: { heading: number; pitch: number };
  lookAtPos: [number, number, number];  // lookAt 目标点
  lookAtOffset: [number, number, number];
  skipLookAt?: boolean;                 // 设为 true 时跳过 flyTo 后的 lookAt，保留 flyTo 视角
}

const MODEL_CONFIGS: Record<string, ModelConfig> = {
  // 富水带
  water_zone: {
    volumeUrl: 'data/WATER/Water.json',
    tunnelPos: [94.9417636, 29.5114813, 2967.04],
    tunnelHeading: 128.80,
    flyDest: { x: -478759.0, y: 5537054.9, z: 3124823.9 },
    flyOrientation: { heading: 5.5, pitch: -0.55 },
    lookAtPos: [94.9417636, 29.5114813, 2967.04],
    lookAtOffset: [125, -150, 125],
  },
  // 破碎带
  fracture_zone: {
    volumeUrl: 'data/POSUI/posui.json',
    tunnelPos: [94.9417636, 29.5114813, 2967.04],
    tunnelHeading: 128.80,
    flyDest: { x: -478759.0, y: 5537054.9, z: 3124823.9 },
    flyOrientation: { heading: 5.5, pitch: -0.55 },
    lookAtPos: [94.9417636, 29.5114813, 2967.04],
    lookAtOffset: [125, -150, 125],
  },
  // TSP 反演（默认显示 VS，新数据由外部软件导出，cesium 配置在此维护）
  tsp: {
    volumeUrl: 'data/tsp_new/vs_3.json',
    cesiumConfig: {
      rotate: [0.0, -1.5, 168.5] as [number, number, number],
      translate: [25, 45, -50] as [number, number, number],
      // autoscale=true 已按 res=[241,162,162] 处理形状（x 方向偏长 1.488:1:1）
      // cesium scale 用均匀值，不叠加额外变形
      scale: [0.0065, 0.00921, 0.00921] as [number, number, number],
    },
    tunnelPos: [94.9056136, 29.5333802, 2945.51],
    tunnelHeading: 100.08,
    flyDest: { x: -475447.3, y: 5536370.3, z: 3126656.9 },
    flyOrientation: { heading: 5.6439, pitch: -0.1861 },
    lookAtPos: [94.9056136, 29.5333802, 2945.51],
    lookAtOffset: [265, -357, 84],
  },
  // 瞬变电磁 (TEM 处理管线生成，输出到 tem_output/latest/)
  tem: {
    tunnelPos: [94.9056136, 29.5333802, 2945.51],
    flyDest: { x: -475447.3, y: 5536370.3, z: 3126656.9 },
    flyOrientation: { heading: 5.6439, pitch: -0.1861 },
    lookAtPos: [94.9056136, 29.5333802, 2945.51],
    lookAtOffset: [265, -357, 84],
  },
  // 瞬变电磁（备选定位参数，同 tem 数据源）
  tem_new: {
    volumeUrl: 'data/tem_output/latest/tem_model.json',
    cesiumConfig: {
      rotate: [0.0, 1.5, -11.5],
      translate: [0, 0, -50] as [number, number, number],
      scale: [0.01567, 0.01567, 0.01567],
    },
    tunnelPos: [94.9056136, 29.5333802, 2945.51],
    tunnelHeading: 100.08,
    flyDest: { x: -475447.3, y: 5536370.3, z: 3126656.9 },
    flyOrientation: { heading: 5.6439, pitch: -0.1861 },
    lookAtPos: [94.9056136, 29.5333802, 2945.51],
    lookAtOffset: [265, -357, 84],
  },
  // 软弱围岩（OBJ 转换后的 GLB 模型）
  // ─────────────────────────────────────────────────────────
  // 【定位调参说明】
  //   tunnelPos[0]  经度 (°)  ← 模型锚点，对准隧道中线上的目标里程点
  //   tunnelPos[1]  纬度 (°)
  //   tunnelPos[2]  高程 (m)  ← 模型底面高程，通常取该里程处的中线高程
  //   glbHeading    朝向 (rad) ← 模型 +X 轴对应的地理方向，从正北顺时针
  //                             隧道走向约 80°→ 弧度 ≈ 1.396；如模型旋转 90° 则 ±π/2
  //   tunnelHeading 体数据配套随道模型的朝向（度），与 glbHeading 相同语义
  // 使用 npm run convert:obj <your.obj> 将 OBJ 转为 GLB 后放到 public/data/ROCK/model.glb
  // ─────────────────────────────────────────────────────────
  weak_rock: {
    glbUrl: 'data/weiyan/model.glb',
    // glbHeading: OBJ 局部坐标系方向未知，需要视觉调参。
    // 候选值：0（若 OBJ X = 地理东向）或 2.645（若 OBJ X = 隧道走向 NW 298.5°）
    // 使用图层控制面板的 ⚙ 按钮拖拽定位后复制配置。
    glbHeading: 1.5708,  // 90°
    tunnelPos: [94.9044380, 29.5323360, 2978.00],
    tunnelHeading: 128.80,
    flyDest: { x: -475111.5, y: 5536216.1, z: 3126872.5 },
    flyOrientation: { heading: 0.5322, pitch: -0.3723 },
    lookAtPos: [94.9044380, 29.5323360, 2978.00],
    lookAtOffset: [125, -150, 125],
    skipLookAt: true,
  },
  // 地质雷达（GPR GLB 模型）
  gpr: {
    glbItems: [
      { url: 'data/gpr/gpr1/1665832_1.glb', mileage: 0 },
    ],
    tunnelPos: [94.9056136, 29.5333802, 2945.51],
    referenceMileage: 0,
    glbHeading: 1.7467,
    glbYRot: -1.5708,
    tunnelHeading: 100.08,
    flyDest: { x: -475447.3, y: 5536370.3, z: 3126656.9 },
    flyOrientation: { heading: 5.6439, pitch: -0.1861 },
    lookAtPos: [94.9056136, 29.5333802, 2945.51],
    lookAtOffset: [265, -357, 84],
  },
  // 超前水平钻 + 掌子面素描（AHD + TFS 叠加显示）
  horiz_drill: {
    glbItems: [
      { url: 'data/ahd/ahd1/2320835.glb', mileage: 5, heightOffset: 5 },
      { url: 'data/ahd/ahd2/2336197.glb', mileage: 15, heightOffset: 5 },
      { url: 'data/tfs_new/tfs3/2322196.glb', mileage: 0 },
      { url: 'data/tfs_new/tfs1/2322509.glb', mileage: 10 },
      { url: 'data/tfs_new/tfs2/2322518.glb', mileage: 20 },
      { url: 'data/tfs_new/tfs4/2326775.glb', mileage: 25 },
    ],
    tunnelPos: [94.9056136, 29.5333802, 2945.51],
    referenceMileage: 0,
    glbHeading: 1.7467,
    glbYRot: -1.5708,
    tunnelHeading: 100.08,
    flyDest: { x: -475447.3, y: 5536370.3, z: 3126656.9 },
    flyOrientation: { heading: 5.6439, pitch: -0.1861 },
    lookAtPos: [94.9056136, 29.5333802, 2945.51],
    lookAtOffset: [265, -357, 84],
  },
  // 掌子面素描（TFS GLB 模型 - 4切片沿中线排列）
  face_sketch: {
    glbItems: [
      { url: 'data/tfs_new/tfs3/2322196.glb', mileage: 0 },
      { url: 'data/tfs_new/tfs1/2322509.glb', mileage: 10 },
      { url: 'data/tfs_new/tfs2/2322518.glb', mileage: 20 },
      { url: 'data/tfs_new/tfs4/2326775.glb', mileage: 30 },
    ],
    tunnelPos: [94.9056136, 29.5333802, 2945.51],
    referenceMileage: 0,
    glbHeading: 1.7467,
    glbYRot: -1.5708,
    tunnelHeading: 100.08,
    flyDest: { x: -475447.3, y: 5536370.3, z: 3126656.9 },
    flyOrientation: { heading: 5.6439, pitch: -0.1861 },
    lookAtPos: [94.9056136, 29.5333802, 2945.51],
    lookAtOffset: [265, -357, 84],
  },
};

// ── 运行时状态 ────────────────────────────────────────────
let tunnelEntity: any = null;
let glbPrimitives: any[] = [];

/** 激活指定 key 的地质模型：加载体数据/GLB + 摆放随道参考 + 飞相机 */
export function activateGeoModel(key: string, customViewer?: any) {
  const cfg = MODEL_CONFIGS[key];
  if (!cfg) return;

  const doActivate = (viewer: any) => {
    // 清理上一个模型
    _cleanup(viewer);

    // ── 启动体数据渲染循环（Previous 构造器会重置 SVData 并 start drawVolume）──
    new (Previous as any)(viewer);
    Previous.SVData.showVolume = true;

    // ── 体数据渲染（shareVolume WebGL canvas 覆盖层）────────
    if (cfg.volumeUrl) {
      try { initVolume(cfg.volumeUrl, cfg.cesiumConfig); } catch (e) { console.warn('[GeoModelController] volume init failed:', e) }
    }

    // ── GLB 模型 ──────────────────────────────────────────────
    const glbHeading = cfg.glbHeading;
    const LocalFrameToFixedFrame = Cesium.Transforms.localFrameToFixedFrameGenerator('up', 'east');
    const loadGlb = (url: string, pos: [number, number, number]) => {
      const cartPos = Cesium.Cartesian3.fromDegrees(pos[0], pos[1], pos[2]);
      let modelMatrix: Cesium.Matrix4;
      if (glbHeading !== undefined) {
        const roll = cfg.glbRoll ?? 0;
        const hpr = new Cesium.HeadingPitchRoll(glbHeading, 0, roll);
        modelMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(cartPos, hpr);
        if (cfg.glbYRot) {
          const yRot = Cesium.Matrix4.fromRotationTranslation(
            Cesium.Matrix3.fromRotationY(cfg.glbYRot)
          );
          modelMatrix = Cesium.Matrix4.multiply(modelMatrix, yRot, new Cesium.Matrix4());
        }
        if (cfg.glbZRot) {
          const zRot = Cesium.Matrix4.fromRotationTranslation(
            Cesium.Matrix3.fromRotationZ(cfg.glbZRot)
          );
          modelMatrix = Cesium.Matrix4.multiply(modelMatrix, zRot, new Cesium.Matrix4());
        }
      } else {
        modelMatrix = LocalFrameToFixedFrame(cartPos);
      }
      console.log('[GeoModelController] 加载 GLB:', url, '位置:', pos);
      Cesium.Model.fromGltfAsync({ url, modelMatrix })
        .then((model) => {
          viewer.scene.primitives.add(model);
          glbPrimitives.push(model);
          console.log('[GeoModelController] GLB 加载成功:', url);
        })
        .catch((e) => {
          console.error('[GeoModelController] GLB 加载失败:', url, e);
        });
    };

    if (cfg.glbItems && cfg.glbItems.length > 0) {
      const refPos = cfg.tunnelPos;
      const refDk = cfg.referenceMileage ?? cfg.glbItems[0].mileage;
      const lat = refPos[1];
      const metersPerDegLon = 111320 * Math.cos(lat * Math.PI / 180);
      const metersPerDegLat = 110940;
      const headingRad = cfg.glbHeading ?? 1.396; // ~80° 隧道走向
      const sinH = Math.sin(headingRad);
      const cosH = Math.cos(headingRad);
      for (const item of cfg.glbItems) {
        const dkDiff = item.mileage - refDk;
        const lon = refPos[0] + (dkDiff * sinH) / metersPerDegLon;
        const lat2 = refPos[1] + (dkDiff * cosH) / metersPerDegLat;
        const pos: [number, number, number] = [lon, lat2, refPos[2] + (item.heightOffset ?? 0)];
        loadGlb(item.url, pos);
      }
    } else if (cfg.glbUrl) {
      loadGlb(cfg.glbUrl, cfg.tunnelPos);
    }

    // ── 随道参考模型（体数据类共用）──────────────────────────
    if (cfg.volumeUrl) {
      const pos = Cesium.Cartesian3.fromDegrees(cfg.tunnelPos[0], cfg.tunnelPos[1], cfg.tunnelPos[2]);
      const orientation = (Cesium as any).Transforms.headingPitchRollQuaternion(
        pos, new Cesium.HeadingPitchRoll(cfg.tunnelHeading, 0, 0)
      );
      tunnelEntity = viewer.entities.add({
        position: pos,
        orientation,
        model: {
          uri: 'data/finaltunnel1.glb',
          minimumPixelSize: 100,
          maximumScale: 10000,
          show: true,
        },
      });
    }

    // ── 相机飞行 ──────────────────────────────────────────────
    viewer.scene.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    const useLookAt = !cfg.skipLookAt;
    viewer.scene.camera.flyTo({
      destination: new Cesium.Cartesian3(cfg.flyDest.x, cfg.flyDest.y, cfg.flyDest.z),
      orientation: { heading: cfg.flyOrientation.heading, pitch: cfg.flyOrientation.pitch, roll: 0 },
      duration: 1,
      complete: useLookAt ? () => {
        viewer.camera.lookAt(
          Cesium.Cartesian3.fromDegrees(cfg.lookAtPos[0], cfg.lookAtPos[1], cfg.lookAtPos[2]),
          new Cesium.Cartesian3(cfg.lookAtOffset[0], cfg.lookAtOffset[1], cfg.lookAtOffset[2])
        );
      } : undefined,
    });
  };

  if (customViewer) {
    doActivate(customViewer);
  } else {
    DTScopeEngine.getViewer(() => {
      doActivate(DTScopeEngine.viewer);
    });
  }
}

/** 切换 TSP 子类型（vp / vs / pr / rt / e） */
export function switchTSPLayer(subKey: 'vp' | 'vs' | 'pr' | 'rt' | 'e', customViewer?: any) {
  const urlMap: Record<string, string> = {
    vp:  'data/tsp_new/vp_2.json',
    vs:  'data/tsp_new/vs_3.json',
    pr:  'scene/data/TSP/Pr.raw.json',
    rt:  'scene/data/TSP/Rt.raw.json',
    e:   'data/tsp_new/depth_1.json',
  };
  // vp/vs/depth 使用新数据，需要传入 cesiumConfig；pr/rt 的 JSON 自带 cesium 字段
  const cesiumMap: Record<string, any> = {
    vp: MODEL_CONFIGS.tsp.cesiumConfig,
    vs: MODEL_CONFIGS.tsp.cesiumConfig,
    e:  MODEL_CONFIGS.tsp.cesiumConfig,
  };
  initVolume(urlMap[subKey], cesiumMap[subKey]);
}

/** 切换 TEM 子类型（tem / temrt / tem_new） */
export function switchTEMLayer(subKey: 'tem' | 'temrt' | 'tem_new', customViewer?: any) {
  const urlMap: Record<string, string> = {
    tem:     'data/tem_output/latest/tem_model.json',
    temrt:   'scene/data/TEM/TEMRt.raw.json',
    tem_new: 'data/tem_output/latest/tem_model.json',
  };
  const cesiumMap: Record<string, any> = {
    tem:     MODEL_CONFIGS.tem.cesiumConfig,
    tem_new: MODEL_CONFIGS.tem_new.cesiumConfig,
  };
  initVolume(urlMap[subKey], cesiumMap[subKey]);
}

/** 控制隧道参考模型（finaltunnel1.glb）的显示/隐藏 */
export function setTunnelModelVisible(show: boolean) {
  if (tunnelEntity) {
    tunnelEntity.show = show;
  }
}

// ── 主界面围岩模型（直接叠加在地形上，不切黑底）────────────
let rockPrimitive: any = null;

/**
 * 在主界面中线上加载围岩 GLB 模型（不切换场景模式，不飞相机）
 */
export function loadRockModel(customViewer?: any) {
  const viewer = customViewer || DTScopeEngine.viewer;
  if (!viewer) return;

  const cfg = MODEL_CONFIGS.weak_rock;
  if (!cfg?.glbUrl) return;

  // 已加载则跳过
  if (rockPrimitive) return;

  const pos = Cesium.Cartesian3.fromDegrees(cfg.tunnelPos[0], cfg.tunnelPos[1], cfg.tunnelPos[2]);
  const hpr = new Cesium.HeadingPitchRoll(cfg.glbHeading ?? 0, 0, 0);
  let modelMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(pos, hpr);

  // 应用固定的最终偏移量：右移230米，下移50米
  const finalOffset = new Cesium.Cartesian3(230, 0, -50);
  const translationMatrix = Cesium.Matrix4.fromTranslation(finalOffset);
  modelMatrix = Cesium.Matrix4.multiply(modelMatrix, translationMatrix, new Cesium.Matrix4());

  Cesium.Model.fromGltfAsync({ url: cfg.glbUrl, modelMatrix })
    .then((model) => {
      rockPrimitive = viewer.scene.primitives.add(model);
      console.log('[GeoModel] 围岩模型已加载到主界面，并应用了最终位置偏移。');
    })
    .catch((e) => console.error('[GeoModel] 围岩模型加载失败:', e));
}

/**
 * 显示 / 隐藏主界面围岩模型
 */
export function setRockModelVisible(show: boolean) {
  if (rockPrimitive) rockPrimitive.show = show;
}

/**
 * 从场景中移除主界面围岩模型
 */
export function removeRockModel(customViewer?: any) {
  const viewer = customViewer || DTScopeEngine.viewer;
  if (!viewer || !rockPrimitive) return;
  viewer.scene.primitives.remove(rockPrimitive);
  rockPrimitive = null;
}

/** 返回当前围岩模型 primitive（用于拖拽时直接更新 modelMatrix） */
export function getRockPrimitive() {
  return rockPrimitive;
}

/**
 * 直接更新围岩模型的 modelMatrix（拖拽时调用，不重建模型）
 */
export function updateRockMatrix(lon: number, lat: number, height: number, headingDeg: number, pitchDeg: number, rollDeg: number) {
  if (!rockPrimitive) return;
  const pos = Cesium.Cartesian3.fromDegrees(lon, lat, height);
  const hpr = new Cesium.HeadingPitchRoll(
    Cesium.Math.toRadians(headingDeg),
    Cesium.Math.toRadians(pitchDeg),
    Cesium.Math.toRadians(rollDeg),
  );
  Cesium.Matrix4.clone(
    Cesium.Transforms.headingPitchRollToFixedFrame(pos, hpr),
    rockPrimitive.modelMatrix,
  );
}

/** 退出模型视图时清理所有地质模型 */
export function deactivateGeoModel(customViewer?: any) {
  const viewer = customViewer || DTScopeEngine.viewer;
  if (!viewer) return;
  _cleanup(viewer);
  // 停止体数据渲染循环
  if (Previous.SVData) Previous.SVData.showVolume = false;
  // 移除 WebGL canvas 覆盖层（volume + slicer）
  clearVolume();
  // 释放相机 lookAt 锁定
  viewer.scene.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
}

function _cleanup(viewer: any) {
  if (tunnelEntity) {
    viewer.entities.remove(tunnelEntity);
    tunnelEntity = null;
  }
  for (const p of glbPrimitives) {
    viewer.scene.primitives.remove(p);
  }
  glbPrimitives = [];
  // 清除体数据 canvas（从体数据模型切换到纯 GLB 模型时需要）
  clearVolume();
}

// ── API 数据加载 ─────────────────────────────────────────
/**
 * 从后端 API 返回的模型实例数组合并到 MODEL_CONFIGS。
 * API 数据 > 本地硬编码默认值，实现热切换。
 *
 * 调用方式：应用启动时 fetch /api/tunnels/:id/models 后调用此函数。
 */
export function mergeModelConfigsFromApi(instances: Array<{
  model_type_code: string; name: string; start_dk: number; end_dk: number;
  glb_urls?: { url: string; mileage: number; heightOffset?: number }[] | null;
  volume_url?: string | null;
  anchor_lon?: number; anchor_lat?: number; anchor_height?: number;
  rotation_x?: number; rotation_y?: number; rotation_z?: number;
  translate_x?: number; translate_y?: number; translate_z?: number;
  scale_x?: number; scale_y?: number; scale_z?: number;
  heading_deg?: number; glb_heading?: number; glb_y_rot?: number; glb_z_rot?: number;
  reference_mileage?: number;
  fly_dest_x?: number; fly_dest_y?: number; fly_dest_z?: number;
  fly_heading?: number; fly_pitch?: number;
  look_at_lon?: number; look_at_lat?: number; look_at_height?: number;
  look_at_offset_x?: number; look_at_offset_y?: number; look_at_offset_z?: number;
  skip_look_at?: boolean;
  sub_type?: string;
}>) {
  for (const inst of instances) {
    const key = inst.sub_type && inst.model_type_code === 'tsp'
      ? `tsp_${inst.sub_type}` as string
      : inst.model_type_code;

    const config: ModelConfig = {
      tunnelPos: [
        inst.anchor_lon ?? 0,
        inst.anchor_lat ?? 0,
        inst.anchor_height ?? 0,
      ],
      tunnelHeading: inst.heading_deg ?? 0,
      flyDest: {
        x: inst.fly_dest_x ?? 0,
        y: inst.fly_dest_y ?? 0,
        z: inst.fly_dest_z ?? 0,
      },
      flyOrientation: {
        heading: inst.fly_heading ?? 0,
        pitch: inst.fly_pitch ?? 0,
      },
      lookAtPos: [
        inst.look_at_lon ?? 0,
        inst.look_at_lat ?? 0,
        inst.look_at_height ?? 0,
      ],
      lookAtOffset: [
        inst.look_at_offset_x ?? 0,
        inst.look_at_offset_y ?? 0,
        inst.look_at_offset_z ?? 0,
      ],
      skipLookAt: inst.skip_look_at ?? undefined,
    };

    if (inst.volume_url) config.volumeUrl = inst.volume_url;
    if (inst.glb_urls?.length) config.glbItems = inst.glb_urls;
    if (inst.glb_heading != null) config.glbHeading = inst.glb_heading;
    if (inst.glb_y_rot != null) config.glbYRot = inst.glb_y_rot;
    if (inst.glb_z_rot != null) config.glbZRot = inst.glb_z_rot;
    if (inst.reference_mileage != null) config.referenceMileage = inst.reference_mileage;

    if (inst.rotation_x != null || inst.translate_x != null || inst.scale_x != null) {
      config.cesiumConfig = {
        rotate: [inst.rotation_x ?? 0, inst.rotation_y ?? 0, inst.rotation_z ?? 0],
        translate: [inst.translate_x ?? 0, inst.translate_y ?? 0, inst.translate_z ?? 0],
        scale: [inst.scale_x ?? 1, inst.scale_y ?? 1, inst.scale_z ?? 1],
      };
    }

    (MODEL_CONFIGS as Record<string, ModelConfig>)[key] = config;
  }
}

/** 获取当前所有模型配置的 key 列表 */
export function getModelConfigKeys(): string[] {
  return Object.keys(MODEL_CONFIGS);
}

/** 获取单个模型配置 */
export function getModelConfig(key: string): ModelConfig | undefined {
  return MODEL_CONFIGS[key];
}

/** 加载 TEM 异常体 GLB 到 Cesium 场景（独立于体渲染） */
let temGlbPrimitive: any = null

export function loadTemAnomalyGlb(customViewer?: any) {
  const viewer = customViewer || DTScopeEngine.viewer
  if (!viewer) return

  if (temGlbPrimitive) {
    temGlbPrimitive.show = true
    viewer.scene.requestRender()
    return
  }

  const pos = Cesium.Cartesian3.fromDegrees(94.9056136, 29.5333802, 2945.51)
  const hpr = new Cesium.HeadingPitchRoll(1.7467, 0, 0)
  let modelMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(pos, hpr)
  const yRot = Cesium.Matrix4.fromRotationTranslation(Cesium.Matrix3.fromRotationY(1.5708))
  modelMatrix = Cesium.Matrix4.multiply(modelMatrix, yRot, new Cesium.Matrix4())

  const url = 'data/tem_output/latest/anomaly_k570_4x.glb'
  console.log('[TemGlb] 加载:', url)
  Cesium.Model.fromGltfAsync({
    url,
    modelMatrix,
    customShader: new Cesium.CustomShader({ lightingModel: Cesium.LightingModel.UNLIT }),
  }).then(model => {
    temGlbPrimitive = viewer.scene.primitives.add(model)
    viewer.camera.flyToBoundingSphere(model.boundingSphere, {
      duration: 1.0,
      offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-15), 80),
    })
    console.log('[TemGlb] 加载成功')
  }).catch(e => console.warn('[TemGlb] 加载失败:', e))
}

export function unloadTemAnomalyGlb(customViewer?: any) {
  const viewer = customViewer || DTScopeEngine.viewer
  if (temGlbPrimitive && viewer) {
    try { viewer.scene.primitives.remove(temGlbPrimitive) } catch {}
    temGlbPrimitive = null
  }
}
