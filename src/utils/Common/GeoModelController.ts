/*
 * 地质模型控制器
 * 统一管理：体数据渲染（富水带/破碎带/TSP/TEM）+ 随道模型 + 相机视角
 * 坐标来源：Layue-master DataController.js
 */
import * as Cesium from 'cesium';
import { DTScopeEngine } from './Viewer';
import { unloadTemVoxelCloud } from './TemVoxelCloud';
import { FACE_SKETCH_RECORDS, FACE_SKETCH_REFERENCE } from '@/modules/face-sketch/data';
// @ts-ignore
import { initVolume, clearVolume } from '@/utils/AllPrevious/All/ShareVolume01.js';
// @ts-ignore
import Previous from '@/utils/AllPrevious/index.js';

// ── 各模型配置 ────────────────────────────────────────────
interface ModelConfig {
  volumeUrl?: string;                   // 体数据 JSON 路径（public/ 根目录相对）
  cesiumConfig?: {                      // 体数据在 Cesium 场景中的变换（JSON 无 cesium 字段时使用）
    rotate?: [number, number, number];
    translate?: [number, number, number];
    scale?: [number, number, number];
    matrix?: number[];                  // 完整 ECEF 模型矩阵，优先级高于欧拉角/平移/缩放
  };
  glbUrl?: string;                      // GLB 模型路径（单个）
  envelopeUrl?: string;                  // 包络 GLB 模型路径（与 glbUrl 共用锚点/朝向，默认隐藏，供开关控制）
  glbItems?: { url: string; mileage: number; heightOffset?: number }[]; // GLB 模型路径（多个，按里程定位）
  glbHeading?: number;                  // GLB 模型朝向（弧度，从正北顺时针）；不填则用 localFrame('up','east')
  glbRoll?: number;                     // GLB 模型绕自身X轴滚转（弧度）
  glbYRot?: number;                     // GLB 模型额外绕Y轴旋转（弧度）
  glbZRot?: number;                     // GLB 模型额外绕Z轴（上方）旋转（弧度）
  glbScale?: number;                    // GLB 模型统一缩放（默认 1）
  tunnelPos: [number, number, number];  // 模型锚点 [lon, lat, h]；glbItems 模式下作为参考里程的位置
  tunnelHeading?: number;               // 隧道参考模型朝向（度，从正北顺时针）
  tunnelPitch?: number;                 // 隧道纵坡角（度）
  referenceMileage?: number;            // glbItems 模式下的参考里程（DK 数字），其他里程相对此偏移
  flyDest: { x: number; y: number; z: number }; // 飞行目标（ECEF）
  flyOrientation: { heading: number; pitch: number };
  lookAtPos: [number, number, number];  // lookAt 目标点
  lookAtOffset: [number, number, number];
  skipLookAt?: boolean;                 // 设为 true 时跳过 flyTo 后的 lookAt，保留 flyTo 视角
}

/**
 * 将 TSP 局部坐标体映射到隧道中心线。
 * 数据轴定义：x=横向、y=里程前进方向、z=高程；range 单位均为米。
 */
function buildTunnelAlignedVolumeMatrix(
  anchor: [number, number, number],
  headingDeg: number,
  pitchDeg: number,
  range: { x: [number, number]; y: [number, number]; z: [number, number] },
): number[] {
  const heading = Cesium.Math.toRadians(headingDeg);
  const pitch = Cesium.Math.toRadians(pitchDeg);
  const sinH = Math.sin(heading);
  const cosH = Math.cos(heading);
  const sinP = Math.sin(pitch);
  const cosP = Math.cos(pitch);

  // ENU 局部坐标中的三个正交轴：横向、里程方向、隧道法向。
  const lateral = new Cesium.Cartesian3(cosH, -sinH, 0);
  const forward = new Cesium.Cartesian3(sinH * cosP, cosH * cosP, sinP);
  const vertical = new Cesium.Cartesian3(-sinH * sinP, -cosH * sinP, cosP);
  const xLength = range.x[1] - range.x[0];
  const yLength = range.y[1] - range.y[0];
  const zLength = range.z[1] - range.z[0];

  const localOrigin = new Cesium.Cartesian3();
  Cesium.Cartesian3.multiplyByScalar(lateral, range.x[0], localOrigin);
  Cesium.Cartesian3.add(
    localOrigin,
    Cesium.Cartesian3.multiplyByScalar(forward, range.y[0], new Cesium.Cartesian3()),
    localOrigin,
  );
  Cesium.Cartesian3.add(
    localOrigin,
    Cesium.Cartesian3.multiplyByScalar(vertical, range.z[0], new Cesium.Cartesian3()),
    localOrigin,
  );

  // ShareVolume 的采样立方体是 [0,1]^3，因此三列分别直接写入三个物理边向量。
  const localMatrix = Cesium.Matrix4.fromArray([
    lateral.x * xLength, lateral.y * xLength, lateral.z * xLength, 0,
    forward.x * yLength, forward.y * yLength, forward.z * yLength, 0,
    vertical.x * zLength, vertical.y * zLength, vertical.z * zLength, 0,
    localOrigin.x, localOrigin.y, localOrigin.z, 1,
  ]);
  const anchorMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(
    Cesium.Cartesian3.fromDegrees(anchor[0], anchor[1], anchor[2]),
  );
  const worldMatrix = Cesium.Matrix4.multiply(anchorMatrix, localMatrix, new Cesium.Matrix4());
  return Array.from(worldMatrix);
}

/** TEM 局部坐标为 X=前向、Y=横向、Z=高程，轴序与 TSP 不同。 */
function buildTemAlignedVolumeMatrix(
  anchor: [number, number, number],
  headingDeg: number,
  pitchDeg: number,
  range: { x: [number, number]; y: [number, number]; z: [number, number] },
  reverseHorizontal = false,
): number[] {
  const heading = Cesium.Math.toRadians(headingDeg);
  const pitch = Cesium.Math.toRadians(pitchDeg);
  const sinH = Math.sin(heading);
  const cosH = Math.cos(heading);
  const sinP = Math.sin(pitch);
  const cosP = Math.cos(pitch);
  // ShareVolume 的射线盒求交要求右手坐标；TEM 的 X=前向，
  // 因此 Y 轴取隧道左向，避免生成镜像（负行列式）矩阵。
  const lateral = new Cesium.Cartesian3(-cosH, sinH, 0);
  const forward = new Cesium.Cartesian3(sinH * cosP, cosH * cosP, sinP);
  const vertical = new Cesium.Cartesian3(-sinH * sinP, -cosH * sinP, cosP);
  // TEM 成果纹理的水平朝向与场景里程方向相反时，将 X/Y 两轴同时
  // 翻转，相当于绕体数据中心旋转 180°，且不改变模型中心与包围范围。
  const xAxis = reverseHorizontal
    ? Cesium.Cartesian3.negate(forward, new Cesium.Cartesian3())
    : forward;
  const yAxis = reverseHorizontal
    ? Cesium.Cartesian3.negate(lateral, new Cesium.Cartesian3())
    : lateral;
  const xLength = range.x[1] - range.x[0];
  const yLength = range.y[1] - range.y[0];
  const zLength = range.z[1] - range.z[0];
  const xOrigin = reverseHorizontal ? range.x[1] : range.x[0];
  const yOrigin = reverseHorizontal ? range.y[1] : range.y[0];
  const localOrigin = Cesium.Cartesian3.multiplyByScalar(forward, xOrigin, new Cesium.Cartesian3());
  Cesium.Cartesian3.add(localOrigin, Cesium.Cartesian3.multiplyByScalar(lateral, yOrigin, new Cesium.Cartesian3()), localOrigin);
  Cesium.Cartesian3.add(localOrigin, Cesium.Cartesian3.multiplyByScalar(vertical, range.z[0], new Cesium.Cartesian3()), localOrigin);
  const localMatrix = Cesium.Matrix4.fromArray([
    xAxis.x * xLength, xAxis.y * xLength, xAxis.z * xLength, 0,
    yAxis.x * yLength, yAxis.y * yLength, yAxis.z * yLength, 0,
    vertical.x * zLength, vertical.y * zLength, vertical.z * zLength, 0,
    localOrigin.x, localOrigin.y, localOrigin.z, 1,
  ]);
  const anchorMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromDegrees(anchor[0], anchor[1], anchor[2]));
  return Array.from(Cesium.Matrix4.multiply(anchorMatrix, localMatrix, new Cesium.Matrix4()));
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
  // 地震波反射 / TSP 三维体素场（默认显示本项目实测 VS 数据）
  tsp: {
    volumeUrl: 'data/tsp_actual/vs.json',
    cesiumConfig: {
      // 将源数据 y=26 的首个断面对准 YK2+244，并按报告的 100m 有效预报长度
      // 沿 YK2+244～YK2+344 的中心线弦向展开。
      matrix: buildTunnelAlignedVolumeMatrix(
        [94.9058769996, 29.533338106, 2945.641],
        101.833672597,
        0.286420559,
        { x: [-25, 25], y: [0, 100], z: [-25, 25] },
      ),
    },
    tunnelPos: [94.9056136, 29.5333802, 2945.51],
    tunnelHeading: 100.066437959,
    tunnelPitch: 0.287239726,
    flyDest: { x: -475447.3, y: 5536370.3, z: 3126656.9 },
    flyOrientation: { heading: 5.6439, pitch: -0.1861 },
    lookAtPos: [94.9056136, 29.5333802, 2945.51],
    lookAtOffset: [265, -357, 84],
  },
  // 瞬变电磁：综合物探视电阻率成果及其富水阈值结果。
  tem: {
    volumeUrl: 'data/geophysical_tem/resistivity_contrast.json',
    cesiumConfig: {
      // 掌子面锚点与 TSP 一致；TEM X 前向、Y 横向、Z 高程。
      matrix: buildTemAlignedVolumeMatrix(
        [94.9058769996, 29.533338106, 2945.641],
        101.833672597,
        0.286420559,
        { x: [-2.797, 58.545], y: [-50.913, 50.913], z: [-17.064, 30.467] },
        true,
      ),
    },
    tunnelPos: [94.9056136, 29.5333802, 2945.51],
    flyDest: { x: -475447.3, y: 5536370.3, z: 3126656.9 },
    flyOrientation: { heading: 5.6439, pitch: -0.1861 },
    lookAtPos: [94.9056136, 29.5333802, 2945.51],
    lookAtOffset: [265, -357, 84],
  },
  // 综合物探融合围岩分级：与 TEM 共用体素网格及隧道空间锚点。
  geophysical_grade: {
    volumeUrl: 'data/geophysical_grade/fused_rock_grade_2345.json',
    cesiumConfig: {
      matrix: buildTemAlignedVolumeMatrix(
        [94.9058769996, 29.533338106, 2945.641],
        101.833672597,
        0.286420559,
        { x: [-2.797, 58.545], y: [-50.913, 50.913], z: [-17.064, 30.467] },
      ),
    },
    tunnelPos: [94.9056136, 29.5333802, 2945.51],
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
  // 超前水平钻（保留 AHD 模型；掌子面照片由 face_sketch 独立生成）
  horiz_drill: {
    glbItems: [
      { url: 'data/ahd/ahd1/2320835.glb', mileage: 5, heightOffset: 5 },
      { url: 'data/ahd/ahd2/2336197.glb', mileage: 15, heightOffset: 5 },
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
  // 掌子面照片与素描：照片平面由新里程数据直接生成，不再使用旧 TFS GLB。
  face_sketch: {
    tunnelPos: FACE_SKETCH_REFERENCE.anchor,
    tunnelHeading: FACE_SKETCH_REFERENCE.headingDeg,
    tunnelPitch: FACE_SKETCH_REFERENCE.pitchDeg,
    flyDest: { x: -475447.3, y: 5536370.3, z: 3126656.9 },
    flyOrientation: { heading: 5.6439, pitch: -0.1861 },
    lookAtPos: [94.9056136, 29.5333802, 2945.51],
    lookAtOffset: [265, -357, 84],
  },
  // 凿岩台车（三臂凿岩台车 ZYS113，Creo → GLB；实体 + 半透明工作包络）
  // 凿岩台车（三臂凿岩台车 ZYS113）—— 主页面施工面 DK281+500
  jumbo_rig: {
    glbUrl: 'data/jumbo/jumbo_solid.glb',
    glbHeading: 2.248,   // 128.8°（台车长轴是 Z 轴，需视觉校准 ±π/2）
    glbScale: 0.1,       // 包围盒 168m → 16.8m
    tunnelPos: [94.925617, 29.522815, 2957.0],
    tunnelHeading: 128.80,
    flyDest: { x: -477144.7, y: 5536564.0, z: 3125912.7 },
    flyOrientation: { heading: 5.6439, pitch: -0.1861 },
    lookAtPos: [94.925617, 29.522815, 2957.0],
    lookAtOffset: [265, -357, 84],
    skipLookAt: true,
  },
};

// 属性维度直接复用 TSP 已生成的解释体素，但使用独立入口，避免打开原数据源面板。
MODEL_CONFIGS.tsp_hardness = {
  ...MODEL_CONFIGS.tsp,
  volumeUrl: 'data/tsp_actual/hardness.json?v=2',
};
MODEL_CONFIGS.tsp_integrity = {
  ...MODEL_CONFIGS.tsp,
  volumeUrl: 'data/tsp_actual/integrity.json?v=1',
};

// ── 运行时状态 ────────────────────────────────────────────
let tunnelEntity: any = null;
let glbPrimitives: any[] = [];
let jumboEnvelopePrimitive: any = null;
let differenceHighlightEnabled = false;
let temVolumeOpacity = 0.4;
let temSliceAxis: 'none' | 'x' | 'y' | 'z' = 'none';
let temSliceFraction = 1;
type FusedRockGrade = 2 | 3 | 4 | 5;
const fusedGradeVisibility: Record<FusedRockGrade, boolean> = { 2: true, 3: true, 4: true, 5: true };
let fusedGradeOpacity = 0.68;
let fusedGradeContrast = 1.25;
let fusedGradeReloadTimer: number | null = null;
let tspAttributeOpacity = 0.68;
let tspAttributeContrast = 1.2;
let activeGeoModelKey: string | null = null;
const FACE_SKETCH_VERTICAL_OFFSET = 5;
let selectedFaceSketchMileage = FACE_SKETCH_RECORDS[FACE_SKETCH_RECORDS.length - 1].mileage;
let faceSketchSceneItems: Array<{ mileage: string; entity: any; material: any; centre: Cesium.Cartesian3 }> = [];

function removeFaceSketchPhotos(viewer: any) {
  for (const item of faceSketchSceneItems) viewer.entities.remove(item.entity);
  faceSketchSceneItems = [];
}

function updateFaceSketchPhotoStyle(viewer: any) {
  for (const item of faceSketchSceneItems) {
    const active = item.mileage === selectedFaceSketchMileage;
    item.entity.show = active;
    item.material.color = new Cesium.ConstantProperty(Cesium.Color.WHITE);
    item.entity.label.show = active;
  }
  viewer.scene.requestRender();
}

function loadFaceSketchPhotos(viewer: any) {
  removeFaceSketchPhotos(viewer);
  const reference = FACE_SKETCH_REFERENCE;
  const heading = Cesium.Math.toRadians(reference.headingDeg);
  const pitch = Cesium.Math.toRadians(reference.pitchDeg);
  const metresPerDegreeLon = 111320 * Math.cos(Cesium.Math.toRadians(reference.anchor[1]));
  const metresPerDegreeLat = 110940;

  for (const record of FACE_SKETCH_RECORDS) {
    // 新数据里程小于 X1DK2+937.0，沿超前方向由参考掌子面向前布置。
    const forwardOffset = reference.mileageValue - record.mileageValue;
    const centreLon = reference.anchor[0] + forwardOffset * Math.sin(heading) / metresPerDegreeLon;
    const centreLat = reference.anchor[1] + forwardOffset * Math.cos(heading) / metresPerDegreeLat;
    const centreHeight = reference.anchor[2]
      + forwardOffset * Math.sin(pitch)
      + FACE_SKETCH_VERTICAL_OFFSET;
    const fittedWidth = record.width * 0.96;
    const fittedHeight = record.height * 0.96;
    const halfWidth = fittedWidth / 2;
    const lateralEast = Math.cos(heading);
    const lateralNorth = -Math.sin(heading);
    const left = Cesium.Cartesian3.fromDegrees(
      centreLon - halfWidth * lateralEast / metresPerDegreeLon,
      centreLat - halfWidth * lateralNorth / metresPerDegreeLat,
    );
    const right = Cesium.Cartesian3.fromDegrees(
      centreLon + halfWidth * lateralEast / metresPerDegreeLon,
      centreLat + halfWidth * lateralNorth / metresPerDegreeLat,
    );
    const material = new Cesium.ImageMaterialProperty({
      image: record.textureUrl,
      color: Cesium.Color.WHITE,
      transparent: false,
    });
    const centre = Cesium.Cartesian3.fromDegrees(centreLon, centreLat, centreHeight);
    const entity = viewer.entities.add({
      id: `face-sketch-photo-${record.mileage.replace(/[^a-zA-Z0-9]/g, '-')}`,
      name: `掌子面照片 ${record.mileage}`,
      position: Cesium.Cartesian3.fromDegrees(centreLon, centreLat, centreHeight + fittedHeight / 2 + 1.2),
      properties: { type: 'face-sketch-photo', mileage: record.mileage },
      wall: {
        // 交换端点顺序，使从已开挖侧观看时纹理保持照片原始左右方向。
        positions: [right, left],
        minimumHeights: [centreHeight - fittedHeight / 2, centreHeight - fittedHeight / 2],
        maximumHeights: [centreHeight + fittedHeight / 2, centreHeight + fittedHeight / 2],
        material,
        outline: false,
      },
      label: {
        text: record.mileage,
        show: false,
        font: '600 13px Microsoft YaHei',
        fillColor: Cesium.Color.fromCssColorString('#dffaff'),
        outlineColor: Cesium.Color.fromCssColorString('#061522'),
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -8),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    faceSketchSceneItems.push({ mileage: record.mileage, entity, material, centre });
  }
  updateFaceSketchPhotoStyle(viewer);
}

export function selectFaceSketchMileage(mileage: string, flyTo = true, customViewer?: any) {
  if (FACE_SKETCH_RECORDS.some(record => record.mileage === mileage)) selectedFaceSketchMileage = mileage;
  const viewer = customViewer || DTScopeEngine.viewer;
  if (!viewer || activeGeoModelKey !== 'face_sketch') return;
  updateFaceSketchPhotoStyle(viewer);
  const selected = faceSketchSceneItems.find(item => item.mileage === selectedFaceSketchMileage);
  if (selected && flyTo) {
    const viewHeading = Cesium.Math.zeroToTwoPi(Cesium.Math.toRadians(FACE_SKETCH_REFERENCE.headingDeg) + Math.PI);
    viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(selected.centre, 5), {
      duration: 0.8,
      offset: new Cesium.HeadingPitchRange(viewHeading, -0.03, 24),
    });
  }
}

function applyTemVolumeControls(): boolean {
  if (activeGeoModelKey !== 'tem') return false;
  const volume = Previous.SVData?.[1] as any;
  if (!volume?.properties || typeof volume.draw !== 'function') return false;
  volume.properties.density = Math.max(0.1, temVolumeOpacity * 7);
  volume.properties.xmin = volume.properties.ymin = volume.properties.zmin = 0.01;
  volume.properties.xmax = volume.properties.ymax = volume.properties.zmax = 0.99;
  if (temSliceAxis !== 'none') {
    volume.properties[`${temSliceAxis}max`] = 0.01 + 0.98 * temSliceFraction;
  }
  // ShareVolume 静止相机时会跳过重绘，显式恢复首帧标记以同步侧栏操作。
  volume.properties.firstLoop = true;
  volume.draw(false);
  return true;
}

function scheduleTemVolumeControlApply(attempt = 0) {
  if (applyTemVolumeControls() || attempt >= 40) return;
  window.setTimeout(() => scheduleTemVolumeControlApply(attempt + 1), 100);
}

export function setTemVolumeOpacity(opacity: number) {
  temVolumeOpacity = Cesium.Math.clamp(opacity, 0.02, 1);
  scheduleTemVolumeControlApply();
}

export function setTemVolumeSlice(axis: 'none' | 'x' | 'y' | 'z', fraction: number) {
  temSliceAxis = axis;
  temSliceFraction = Cesium.Math.clamp(fraction, 0, 1);
  scheduleTemVolumeControlApply();
}

function fusedGradeVolumeUrl() {
  const suffix = ([2, 3, 4, 5] as FusedRockGrade[])
    .filter(grade => fusedGradeVisibility[grade])
    .join('') || 'none';
  return `data/geophysical_grade/fused_rock_grade_${suffix}.json`;
}

function applyFusedGradeControls(): boolean {
  if (activeGeoModelKey !== 'geophysical_grade') return false;
  const volume = Previous.SVData?.[1] as any;
  if (!volume?.properties || typeof volume.draw !== 'function') return false;
  volume.properties.density = Math.max(0.1, fusedGradeOpacity * 7);
  volume.properties.contrast = fusedGradeContrast;
  volume.properties.firstLoop = true;
  volume.draw(false);
  return true;
}

function scheduleFusedGradeControlApply(attempt = 0) {
  if (applyFusedGradeControls() || attempt >= 40) return;
  window.setTimeout(() => scheduleFusedGradeControlApply(attempt + 1), 100);
}

function reloadFusedGradeVolume() {
  if (activeGeoModelKey !== 'geophysical_grade') return;
  if (fusedGradeReloadTimer !== null) window.clearTimeout(fusedGradeReloadTimer);
  // Coalesce rapid multi-select changes so only the final grade combination is loaded.
  fusedGradeReloadTimer = window.setTimeout(() => {
    fusedGradeReloadTimer = null;
    initVolume(fusedGradeVolumeUrl(), MODEL_CONFIGS.geophysical_grade.cesiumConfig);
    // JSON and atlas loading is asynchronous; reapply display tuning after replacement.
    for (const delay of [120, 400, 900]) {
      window.setTimeout(() => scheduleFusedGradeControlApply(), delay);
    }
  }, 60);
}

/** 独立显示/隐藏融合围岩等级；重新加载同一融合结果的轻量掩膜体素。 */
export function setFusedGradeVisibility(grade: FusedRockGrade, visible: boolean) {
  fusedGradeVisibility[grade] = visible;
  reloadFusedGradeVolume();
}

export function setFusedGradeOpacity(opacity: number) {
  fusedGradeOpacity = Cesium.Math.clamp(opacity, 0.08, 1);
  scheduleFusedGradeControlApply();
}

export function setFusedGradeContrast(contrast: number) {
  fusedGradeContrast = Cesium.Math.clamp(contrast, 0.6, 2.4);
  scheduleFusedGradeControlApply();
}

function applyTspAttributeControls(): boolean {
  if (!['tsp_hardness', 'tsp_integrity'].includes(activeGeoModelKey || '')) return false;
  const volume = Previous.SVData?.[1] as any;
  if (!volume?.properties || typeof volume.draw !== 'function') return false;
  volume.properties.density = Math.max(0.1, tspAttributeOpacity * 7);
  volume.properties.contrast = tspAttributeContrast;
  volume.properties.firstLoop = true;
  volume.draw(false);
  return true;
}

function scheduleTspAttributeControlApply(attempt = 0) {
  if (applyTspAttributeControls() || attempt >= 40) return;
  window.setTimeout(() => scheduleTspAttributeControlApply(attempt + 1), 100);
}

export function setTspAttributeOpacity(opacity: number) {
  tspAttributeOpacity = Cesium.Math.clamp(opacity, 0.08, 1);
  scheduleTspAttributeControlApply();
}

export function setTspAttributeContrast(contrast: number) {
  tspAttributeContrast = Cesium.Math.clamp(contrast, 0.6, 2.4);
  scheduleTspAttributeControlApply();
}

function applyDifferenceHighlight(model: any) {
  if (!model) return;
  model.silhouetteColor = Cesium.Color.fromCssColorString('#ffcc00');
  model.silhouetteSize = differenceHighlightEnabled ? 3 : 0;
}

/** 激活指定 key 的地质模型：加载体数据/GLB + 摆放随道参考 + 飞相机 */
export function activateGeoModel(key: string, customViewer?: any, volumeSubKey?: 'vp' | 'vs' | 'hardness' | 'ratio' | 'anomaly' | 'integrity' | 'resistivity' | 'water' | 'isosurface') {
  const cfg = MODEL_CONFIGS[key];
  if (!cfg) return;

  if (key === 'tem' && volumeSubKey === 'isosurface') {
    const showIsosurface = (viewer: any) => {
      _cleanup(viewer);
      activeGeoModelKey = 'tem_isosurface';
      loadTemAnomalyGlb(viewer);
    };
    if (customViewer) showIsosurface(customViewer);
    else DTScopeEngine.getViewer(() => showIsosurface(DTScopeEngine.viewer));
    return;
  }
  const tspVolumeUrls: Record<string, string> = {
    vp: 'data/tsp_actual/vp.json',
    vs: 'data/tsp_actual/vs.json',
    hardness: 'data/tsp_actual/hardness.json?v=2',
    ratio: 'data/tsp_actual/vp_vs_ratio.json?v=1',
    anomaly: 'data/tsp_actual/tsp_anomaly.json?v=1',
    integrity: 'data/tsp_actual/integrity.json?v=1',
  };
  const temVolumeUrls: Record<string, string> = {
    resistivity: 'data/geophysical_tem/resistivity_contrast.json',
    water: 'data/geophysical_tem/water.json',
  };
  const volumeUrl = key === 'tsp'
    ? (tspVolumeUrls[volumeSubKey || 'vs'] || cfg.volumeUrl)
    : key === 'tem'
      ? (temVolumeUrls[volumeSubKey || 'resistivity'] || cfg.volumeUrl)
    : key === 'geophysical_grade'
      ? fusedGradeVolumeUrl()
      : cfg.volumeUrl;

  const doActivate = (viewer: any) => {
    // 清理上一个模型
    _cleanup(viewer);
    activeGeoModelKey = key;

    // ── 启动体数据渲染循环（Previous 构造器会重置 SVData 并 start drawVolume）──
    new (Previous as any)(viewer);
    Previous.SVData.showVolume = true;

    // ── 体数据渲染（shareVolume WebGL canvas 覆盖层）────────
    if (volumeUrl) {
      try { initVolume(volumeUrl, cfg.cesiumConfig); } catch (e) { console.warn('[GeoModelController] volume init failed:', e) }
      if (key === 'tem') scheduleTemVolumeControlApply();
      if (key === 'geophysical_grade') scheduleFusedGradeControlApply();
      if (key === 'tsp_hardness' || key === 'tsp_integrity') scheduleTspAttributeControlApply();
    }

    // ── GLB 模型 ──────────────────────────────────────────────
    const glbHeading = cfg.glbHeading;
    const LocalFrameToFixedFrame = Cesium.Transforms.localFrameToFixedFrameGenerator('up', 'east');
    const computeMatrix = (pos: [number, number, number]): Cesium.Matrix4 => {
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
      if (cfg.glbScale && cfg.glbScale !== 1) {
        const scaleM = Cesium.Matrix4.fromUniformScale(cfg.glbScale);
        modelMatrix = Cesium.Matrix4.multiply(modelMatrix, scaleM, new Cesium.Matrix4());
      }
      return modelMatrix;
    };

    const loadGlb = (url: string, pos: [number, number, number]) => {
      const modelMatrix = computeMatrix(pos);
      console.log('[GeoModelController] 加载 GLB:', url, '位置:', pos);
      Cesium.Model.fromGltfAsync({ url, modelMatrix })
        .then((model) => {
          applyDifferenceHighlight(model);
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
    if (key === 'face_sketch') loadFaceSketchPhotos(viewer);

    // ── 包络模型（与实体共用锚点/朝向，默认隐藏，供工作包络图层开关控制）──
    if (cfg.envelopeUrl) {
      const modelMatrix = computeMatrix(cfg.tunnelPos);
      Cesium.Model.fromGltfAsync({ url: cfg.envelopeUrl, modelMatrix })
        .then((model) => {
          model.show = false;
          viewer.scene.primitives.add(model);
          jumboEnvelopePrimitive = model;
          console.log('[GeoModelController] 包络 GLB 加载成功:', cfg.envelopeUrl);
        })
        .catch((e) => {
          console.error('[GeoModelController] 包络 GLB 加载失败:', cfg.envelopeUrl, e);
        });
    }

    // 隧道背景统一使用主场景已加载的分段模型，避免叠加一套不同原点的参考 GLB。

    // ── 相机飞行 ──────────────────────────────────────────────
    viewer.scene.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    if (key === 'face_sketch') {
      selectFaceSketchMileage(selectedFaceSketchMileage, true, viewer);
      return;
    }
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

/** 切换 TSP 子类型。 */
export function switchTSPLayer(subKey: 'vp' | 'vs' | 'hardness' | 'ratio' | 'anomaly' | 'integrity', customViewer?: any) {
  const urlMap: Record<string, string> = {
    vp:  'data/tsp_actual/vp.json',
    vs:  'data/tsp_actual/vs.json',
    hardness: 'data/tsp_actual/hardness.json?v=2',
    ratio: 'data/tsp_actual/vp_vs_ratio.json?v=1',
    anomaly: 'data/tsp_actual/tsp_anomaly.json?v=1',
    integrity: 'data/tsp_actual/integrity.json?v=1',
  };
  const cesiumMap: Record<string, any> = {
    vp: MODEL_CONFIGS.tsp.cesiumConfig,
    vs: MODEL_CONFIGS.tsp.cesiumConfig,
    hardness: MODEL_CONFIGS.tsp.cesiumConfig,
    ratio: MODEL_CONFIGS.tsp.cesiumConfig,
    anomaly: MODEL_CONFIGS.tsp.cesiumConfig,
    integrity: MODEL_CONFIGS.tsp.cesiumConfig,
  };
  initVolume(urlMap[subKey], cesiumMap[subKey]);
}

/** 切换综合物探 TEM 体素子类型。 */
export function switchTEMLayer(subKey: 'resistivity' | 'water', customViewer?: any) {
  const urlMap: Record<string, string> = {
    resistivity: 'data/geophysical_tem/resistivity_contrast.json',
    water: 'data/geophysical_tem/water.json',
  };
  const cesiumMap: Record<string, any> = {
    resistivity: MODEL_CONFIGS.tem.cesiumConfig,
    water: MODEL_CONFIGS.tem.cesiumConfig,
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
 * 显示 / 隐藏凿岩台车工作包络（半透明图层）
 */
export function setJumboEnvelopeVisible(show: boolean) {
  if (jumboEnvelopePrimitive) {
    jumboEnvelopePrimitive.show = show;
    DTScopeEngine.viewer?.scene.requestRender();
  }
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

// ── 主界面凿岩台车模型（直接叠加在主页面施工面处，不切场景、不飞相机）────
let jumboPrimitive: any = null;
let jumboViewer: any = null;
let jumboLoadRequest = 0;

/**
 * 在主页面施工面（DK281+500）加载凿岩台车 GLB 模型
 */
export function loadJumboModel(customViewer?: any) {
  const viewer = customViewer || DTScopeEngine.viewer;
  if (!viewer || viewer.isDestroyed?.()) return;

  const cfg = MODEL_CONFIGS.jumbo_rig;
  if (!cfg?.glbUrl) return;
  if (jumboPrimitive) {
    const isCurrentScene = jumboViewer === viewer
      && !viewer.isDestroyed?.()
      && viewer.scene.primitives.contains(jumboPrimitive);
    if (isCurrentScene) {
      jumboPrimitive.show = true;
      return;
    }

    // 路由切换后旧 Viewer 已失效，不能把旧场景中的 primitive 当作已加载。
    try {
      if (jumboViewer && !jumboViewer.isDestroyed?.()) {
        jumboViewer.scene.primitives.remove(jumboPrimitive);
      }
    } catch {}
    jumboPrimitive = null;
    jumboViewer = null;
  }

  const requestId = ++jumboLoadRequest;

  const pos = Cesium.Cartesian3.fromDegrees(cfg.tunnelPos[0], cfg.tunnelPos[1], cfg.tunnelPos[2]);
  const hpr = new Cesium.HeadingPitchRoll(cfg.glbHeading ?? 0, 0, cfg.glbRoll ?? 0);
  let modelMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(pos, hpr);
  if (cfg.glbScale && cfg.glbScale !== 1) {
    const scaleM = Cesium.Matrix4.fromUniformScale(cfg.glbScale);
    modelMatrix = Cesium.Matrix4.multiply(modelMatrix, scaleM, new Cesium.Matrix4());
  }

  Cesium.Model.fromGltfAsync({ url: cfg.glbUrl, modelMatrix })
    .then((model) => {
      if (requestId !== jumboLoadRequest || viewer.isDestroyed?.()) {
        try { if (!model.isDestroyed?.()) model.destroy(); } catch {}
        return;
      }
      jumboPrimitive = viewer.scene.primitives.add(model);
      jumboViewer = viewer;
      console.log('[GeoModel] 凿岩台车已加载到主页面施工面:', cfg.tunnelPos);
    })
    .catch((e) => console.error('[GeoModel] 凿岩台车加载失败:', e));
}

/** 显示 / 隐藏主界面凿岩台车模型 */
export function setJumboModelVisible(show: boolean) {
  if (jumboPrimitive) jumboPrimitive.show = show;
}

/** 从场景中移除主界面凿岩台车模型 */
export function removeJumboModel(customViewer?: any) {
  ++jumboLoadRequest;
  const viewer = jumboViewer || customViewer || DTScopeEngine.viewer;
  if (viewer && jumboPrimitive && !viewer.isDestroyed?.()) {
    try { viewer.scene.primitives.remove(jumboPrimitive); } catch {}
  }
  jumboPrimitive = null;
  jumboViewer = null;
}

/** 退出模型视图时清理所有地质模型 */
export function deactivateGeoModel(customViewer?: any) {
  const viewer = customViewer || DTScopeEngine.viewer;
  if (!viewer) return;
  _cleanup(viewer);
  // 停止体数据渲染循环
  if (Previous.SVData) Previous.SVData.showVolume = false;
  (Previous as any).stopVolumeLoop?.();
  // 移除 WebGL canvas 覆盖层（volume + slicer）
  clearVolume();
  // 释放相机 lookAt 锁定
  viewer.scene.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
}

/** 高亮当前超报/揭露修正层，用于与长期保留的设计基准层进行差异对比。 */
export function setGeoModelDifferenceHighlight(enabled: boolean) {
  differenceHighlightEnabled = enabled;
  for (const model of glbPrimitives) applyDifferenceHighlight(model);
  applyTemGlbAppearance(temGlbSelected);
  DTScopeEngine.viewer?.scene.requestRender();
}

function _cleanup(viewer: any) {
  activeGeoModelKey = null;
  if (tunnelEntity) {
    viewer.entities.remove(tunnelEntity);
    tunnelEntity = null;
  }
  for (const p of glbPrimitives) {
    viewer.scene.primitives.remove(p);
  }
  glbPrimitives = [];
  removeFaceSketchPhotos(viewer);
  if (jumboEnvelopePrimitive) { viewer.scene.primitives.remove(jumboEnvelopePrimitive); jumboEnvelopePrimitive = null; }
  if (temGlbPrimitive) { viewer.scene.primitives.remove(temGlbPrimitive); temGlbPrimitive = null; }
  temGlbPickHandler?.destroy();
  temGlbPickHandler = null;
  temGlbSelected = false;
  temGlbCurrentUrl = '';
  unloadTemVoxelCloud();
  // 清除体数据 canvas（从体数据模型切换到纯 GLB 模型时需要）
  clearVolume();
}

// ── API 数据加载 ─────────────────────────────────────────
/**
 * 从后端 API 返回的模型实例数组合并到 MODEL_CONFIGS。
 * 普通模型允许 API 配置覆盖；集成包模型保留本地精确矩阵与运行时生成逻辑。
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
  // 这些配置依赖集成包中的矩阵、体素和运行时照片平面，不能被旧数据库中的
  // 欧拉角/缩放或 TFS GLB 配置覆盖。
  const integratedLocalKeys = new Set([
    'tsp', 'tem', 'geophysical_grade', 'tsp_hardness', 'tsp_integrity', 'face_sketch', 'horiz_drill',
  ]);
  for (const inst of instances) {
    const key = inst.sub_type && inst.model_type_code === 'tsp'
      ? `tsp_${inst.sub_type}` as string
      : inst.model_type_code;
    if (integratedLocalKeys.has(key)) continue;

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
let temGlbCurrentUrl: string = ''
let temGlbPickHandler: Cesium.ScreenSpaceEventHandler | null = null
let temGlbSelected = false

const TEM_GLB_DEFAULT_COLOR = Cesium.Color.fromCssColorString('#ff6b2c').withAlpha(0.62)
const TEM_GLB_SELECTED_COLOR = Cesium.Color.fromCssColorString('#ff3030').withAlpha(0.86)
const TEM_GLB_OUTLINE_COLOR = Cesium.Color.fromCssColorString('#ffd166').withAlpha(0.96)

/** k=570 仅表示一个等值边界，统一着色以避免伪造数值渐变。 */
function applyTemGlbAppearance(selected = false) {
  if (!temGlbPrimitive) return
  temGlbSelected = selected
  temGlbPrimitive.color = selected ? TEM_GLB_SELECTED_COLOR : TEM_GLB_DEFAULT_COLOR
  temGlbPrimitive.colorBlendMode = Cesium.ColorBlendMode.REPLACE
  temGlbPrimitive.colorBlendAmount = 1.0
  temGlbPrimitive.silhouetteColor = differenceHighlightEnabled
    ? Cesium.Color.fromCssColorString('#ffcc00')
    : selected
      ? Cesium.Color.WHITE.withAlpha(0.98)
      : TEM_GLB_OUTLINE_COLOR
  temGlbPrimitive.silhouetteSize = differenceHighlightEnabled ? 3 : selected ? 2.5 : 1.5
  temGlbPrimitive.backFaceCulling = false
}

function installTemGlbSelection(viewer: Cesium.Viewer) {
  temGlbPickHandler?.destroy()
  temGlbPickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
  temGlbPickHandler.setInputAction((event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
    const picked = viewer.scene.pick(event.position) as { primitive?: unknown } | undefined
    const pickedTemSurface = picked?.primitive === temGlbPrimitive
    if (!pickedTemSurface && !temGlbSelected) return
    applyTemGlbAppearance(pickedTemSurface ? !temGlbSelected : false)
    viewer.scene.requestRender()
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
}

export function loadTemAnomalyGlb(customViewer?: any, dataDir?: string) {
  const viewer = customViewer || DTScopeEngine.viewer
  if (!viewer) return

  const url = (dataDir || 'data/tem_output/latest') + '/anomaly_k570_4x.glb'

  if (temGlbPrimitive && temGlbCurrentUrl === url) {
    temGlbPrimitive.show = true
    viewer.scene.requestRender()
    return
  }

  // 切换到不同数据集时清理旧模型
  if (temGlbPrimitive) {
    try { viewer.scene.primitives.remove(temGlbPrimitive) } catch {}
    temGlbPrimitive = null
  }
  temGlbPickHandler?.destroy()
  temGlbPickHandler = null
  temGlbSelected = false

  const pos = Cesium.Cartesian3.fromDegrees(94.9056136, 29.5333802, 2945.51)
  const hpr = new Cesium.HeadingPitchRoll(1.7467, 0, 0)
  let modelMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(pos, hpr)
  const yRot = Cesium.Matrix4.fromRotationTranslation(Cesium.Matrix3.fromRotationY(1.5708))
  modelMatrix = Cesium.Matrix4.multiply(modelMatrix, yRot, new Cesium.Matrix4())

  console.log('[TemGlb] 加载:', url)
  Cesium.Model.fromGltfAsync({
    url,
    modelMatrix,
  }).then(model => {
    temGlbPrimitive = viewer.scene.primitives.add(model)
    temGlbCurrentUrl = url
    applyTemGlbAppearance(false)
    installTemGlbSelection(viewer)
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(94.907628, 29.531351, 3001.2),
      orientation: {
        heading: Cesium.Math.toRadians(319.04),
        pitch: Cesium.Math.toRadians(-10.61),
        roll: 0,
      },
      duration: 1.0,
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
  temGlbPickHandler?.destroy()
  temGlbPickHandler = null
  temGlbSelected = false
  temGlbCurrentUrl = ''
}

export function setTemGlbVisible(show: boolean) {
  if (temGlbPrimitive) {
    temGlbPrimitive.show = show
    DTScopeEngine.viewer?.scene.requestRender()
  }
}
