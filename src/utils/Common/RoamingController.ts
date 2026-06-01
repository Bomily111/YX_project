/**
 * 隧道漫游控制器
 * 沿隧道中线从入口到出口自动飞行漫游
 */
import * as Cesium from 'cesium';
import centerlineData from '@/assets/data/centerLine.json';

type Coord3 = number[];

const WAYPOINT_INTERVAL = 5; // 每 5 米取样一个航点
const CAMERA_OFFSET_HEIGHT = 2.5; // 相机相对中线的高度偏移（模拟人眼高度）
const DEFAULT_SPEED = 30; // 默认飞行速度（米/秒）

// ── 解析中线坐标 ──────────────────────────────────────────
function parseCoords(): Coord3[] {
  const feature = (centerlineData as any).features?.[0];
  if (!feature) return [];
  return feature.geometry.coordinates as Coord3[];
}

// ── Haversine 距离 ────────────────────────────────────────
function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const aVal = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return R * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
}

// ── 插值 ──────────────────────────────────────────────────
function interpolate(a: Coord3, b: Coord3, t: number): Coord3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// ── 采样航点 ──────────────────────────────────────────────
function sampleWaypoints(interval: number) {
  const coords = parseCoords();
  if (coords.length < 2) return [];

  const cumDist: number[] = [0];
  for (let i = 1; i < coords.length; i++) {
    const d = haversineMeters([coords[i - 1][0], coords[i - 1][1]], [coords[i][0], coords[i][1]]);
    cumDist.push(cumDist[i - 1] + d);
  }
  const totalLen = cumDist[cumDist.length - 1];

  const waypoints: Coord3[] = [];
  for (let t = 0; t <= totalLen; t += interval) {
    let lo = 0, hi = cumDist.length - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (cumDist[mid] <= t) lo = mid;
      else hi = mid;
    }
    const segLen = cumDist[hi] - cumDist[lo];
    const alpha = segLen > 1e-9 ? (t - cumDist[lo]) / segLen : 0;
    waypoints.push(interpolate(coords[lo], coords[hi], alpha));
  }

  const last = coords[coords.length - 1];
  if (
    waypoints.length === 0 ||
    haversineMeters([waypoints[waypoints.length - 1][0], waypoints[waypoints.length - 1][1]], [last[0], last[1]]) > 0.1
  ) {
    waypoints.push([...last]);
  }

  return waypoints;
}

export interface RoamingState {
  playing: boolean;
  paused: boolean;
  speed: number;
  progress: number;
  currentWaypoint: number;
  totalWaypoints: number;
  currentMileage: string;
}

interface SavedView {
  destination: Cesium.Cartesian3;
  heading: number;
  pitch: number;
  roll: number;
}

export class RoamingController {
  private viewer: any;
  private waypoints: Coord3[] = [];
  private currentIdx = 0;
  private playing = false;
  private paused = false;
  private speed = DEFAULT_SPEED;
  private listeners: Array<() => void> = [];
  private savedView: SavedView | null = null;

  constructor() {
    this.waypoints = sampleWaypoints(WAYPOINT_INTERVAL);
  }

  setViewer(viewer: any) {
    this.viewer = viewer;
  }

  getState(): RoamingState {
    const totalLen = this.waypoints.length > 0
      ? (this.waypoints.length - 1) * WAYPOINT_INTERVAL
      : 0;
    const currentDist = this.currentIdx * WAYPOINT_INTERVAL;
    const progress = totalLen > 0 ? currentDist / totalLen : 0;

    const dkNum = 278100 + currentDist;
    const dkKm = Math.floor(dkNum / 1000);
    const dkM = Math.floor(dkNum % 1000);

    return {
      playing: this.playing,
      paused: this.paused,
      speed: this.speed,
      progress: Math.min(1, Math.max(0, progress)),
      currentWaypoint: this.currentIdx,
      totalWaypoints: this.waypoints.length,
      currentMileage: `DK${dkKm}+${String(dkM).padStart(3, '0')}`,
    };
  }

  onChange(cb: () => void) {
    this.listeners.push(cb);
  }

  private notify() {
    for (const cb of this.listeners) cb();
  }

  // ── 根据当前→下一个航点计算相机位置和朝向 ────────────────
  private computeCameraTarget(curr: Coord3, next: Coord3): {
    destination: Cesium.Cartesian3;
    heading: number;
    pitch: number;
  } {
    const pos = Cesium.Cartesian3.fromDegrees(curr[0], curr[1], curr[2] + CAMERA_OFFSET_HEIGHT);
    const lookAt = Cesium.Cartesian3.fromDegrees(next[0], next[1], next[2] + CAMERA_OFFSET_HEIGHT);

    // ENU 局部坐标系中计算 heading（正北=0，顺时针为正）
    const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(pos);
    const invEnu = Cesium.Matrix4.inverseTransformation(enuMatrix, new Cesium.Matrix4());
    const dir = Cesium.Cartesian3.subtract(lookAt, pos, new Cesium.Cartesian3());
    const localDir = Cesium.Matrix4.multiplyByPointAsVector(invEnu, dir, new Cesium.Cartesian3());

    const heading = Math.atan2(localDir.x, localDir.y);
    const horizDist = Math.sqrt(localDir.x * localDir.x + localDir.y * localDir.y);
    const pitch = -Math.atan2(localDir.z, horizDist);

    return { destination: pos, heading, pitch };
  }

  // ── 保存当前相机视角 ──────────────────────────────────────
  private saveCurrentView() {
    if (!this.viewer) return;
    const cam = this.viewer.scene.camera;
    this.savedView = {
      destination: cam.positionWC.clone(),
      heading: cam.heading,
      pitch: cam.pitch,
      roll: cam.roll,
    };
  }

  // ── 恢复到漫游前视角 ──────────────────────────────────────
  private restoreSavedView() {
    if (!this.savedView || !this.viewer) return;
    this.viewer.scene.camera.cancelFlight();
    this.viewer.scene.camera.flyTo({
      destination: this.savedView.destination,
      orientation: {
        heading: this.savedView.heading,
        pitch: this.savedView.pitch,
        roll: this.savedView.roll,
      },
      duration: 1.5,
      easingFunction: Cesium.EasingFunction.QUINTIC_IN_OUT,
    });
    this.savedView = null;
  }

  /** 飞到当前航点 */
  private flyToCurrent(duration: number) {
    if (!this.viewer || this.currentIdx >= this.waypoints.length - 1) {
      this.stop();
      return;
    }

    const { destination, heading, pitch } = this.computeCameraTarget(
      this.waypoints[this.currentIdx],
      this.waypoints[this.currentIdx + 1],
    );

    this.viewer.scene.camera.flyTo({
      destination,
      orientation: { heading, pitch, roll: 0 },
      duration,
      easingFunction: Cesium.EasingFunction.LINEAR_NONE,
      complete: () => {
        if (!this.playing || this.paused) return;
        this.currentIdx++;
        this.notify();
        this.flyToCurrent(this.computeDuration());
      },
      cancel: () => {
        this.playing = false;
        this.paused = false;
        this.notify();
      },
    });
  }

  private computeDuration(): number {
    return WAYPOINT_INTERVAL / Math.max(1, this.speed);
  }

  // ── 飞往指定航点（不启动连续漫游） ────────────────────────
  private flyToWaypoint(idx: number, duration = 1.5) {
    if (!this.viewer || idx >= this.waypoints.length - 1) return;
    const { destination, heading, pitch } = this.computeCameraTarget(
      this.waypoints[idx],
      this.waypoints[idx + 1],
    );
    this.viewer.scene.camera.flyTo({
      destination,
      orientation: { heading, pitch, roll: 0 },
      duration,
    });
  }

  /** 开始漫游 */
  start() {
    if (!this.viewer) return;
    if (this.playing && !this.paused) return;

    if (this.paused) {
      this.paused = false;
      this.playing = true;
      this.notify();
      this.flyToCurrent(this.computeDuration());
      return;
    }

    if (this.currentIdx >= this.waypoints.length - 1) {
      this.currentIdx = 0;
    }

    // 首次开始漫游时保存当前相机视角
    if (!this.savedView) {
      this.saveCurrentView();
    }

    this.playing = true;
    this.paused = false;
    this.notify();
    this.flyToCurrent(this.computeDuration());
  }

  /** 暂停 */
  pause() {
    if (!this.playing || this.paused) return;
    this.paused = true;
    this.playing = false;
    if (this.viewer) {
      this.viewer.scene.camera.cancelFlight();
    }
    this.notify();
  }

  /** 停止漫游并恢复到漫游前的相机视角 */
  stop() {
    this.playing = false;
    this.paused = false;
    if (this.viewer) {
      this.viewer.scene.camera.cancelFlight();
    }
    this.currentIdx = 0;
    this.notify();
    this.restoreSavedView();
  }

  /** 退出漫游模式：停止并恢复视角（供关闭弹窗时调用） */
  exit() {
    this.playing = false;
    this.paused = false;
    if (this.viewer) {
      this.viewer.scene.camera.cancelFlight();
    }
    this.currentIdx = 0;
    this.notify();
    this.restoreSavedView();
  }

  /** 设置速度（米/秒） */
  setSpeed(speed: number) {
    this.speed = Math.max(1, Math.min(200, speed));
    this.notify();
    if (this.playing && this.viewer) {
      this.viewer.scene.camera.cancelFlight();
      this.flyToCurrent(this.computeDuration());
    }
  }

  /** 跳转到入口 */
  jumpToEntrance() {
    if (!this.viewer || this.waypoints.length === 0) return;
    this.currentIdx = 0;
    this.flyToWaypoint(0);
    this.notify();
  }

  /** 跳转到出口 */
  jumpToExit() {
    if (!this.viewer || this.waypoints.length < 2) return;
    const len = this.waypoints.length;
    this.currentIdx = len - 2;
    this.flyToWaypoint(len - 2);
    this.notify();
  }

  /** 从滑块跳转到指定进度 */
  seekToProgress(progress: number) {
    const wasPlaying = this.playing;
    if (this.viewer) {
      this.viewer.scene.camera.cancelFlight();
    }
    this.currentIdx = Math.floor(progress * (this.waypoints.length - 1));
    if (this.currentIdx >= this.waypoints.length - 1) {
      this.currentIdx = this.waypoints.length - 2;
    }
    this.flyToWaypoint(this.currentIdx, 0.5);
    this.playing = wasPlaying;
    this.paused = false;
    this.notify();
    if (this.playing && this.viewer) {
      this.flyToCurrent(this.computeDuration());
    }
  }

  destroy() {
    this.stop();
    this.listeners = [];
  }
}

/** 全局单例 */
let instance: RoamingController | null = null;

export function getRoamingController(): RoamingController {
  if (!instance) {
    instance = new RoamingController();
  }
  return instance;
}

export function destroyRoamingController() {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}
