/**
 * TunnelEntities.ts
 * 隧道内三维动态实体：调度车辆、机械、人员 + 场景热点标记
 * 使用 Cesium CallbackProperty 实现车辆沿隧道路径实时运动
 */
import * as Cesium from 'cesium';
import { DTScopeEngine } from './Viewer';

// ── 隧道坐标锚点 ──────────────────────────────────────────
const TUNNEL_ENTRANCE = { lon: 101.8415320473, lat: 30.0053572443, height: 3330 };
const TUNNEL_FACE     = { lon: 101.7389052924, lat: 30.0560320643, height: 3665 };
const TUNNEL_MID      = {
  lon: (TUNNEL_ENTRANCE.lon + TUNNEL_FACE.lon) / 2,
  lat: (TUNNEL_ENTRANCE.lat + TUNNEL_FACE.lat) / 2,
  height: (TUNNEL_ENTRANCE.height + TUNNEL_FACE.height) / 2,
};

// ── 场景热点定义（在 Cesium 中可点击） ────────────────────
export const SCENE_HOTSPOTS = [
  {
    key: 'workface',
    name: '掌子面',
    color: '#00e5ff',
    lon: TUNNEL_FACE.lon,
    lat: TUNNEL_FACE.lat,
    height: TUNNEL_FACE.height + 120,
  },
  {
    key: 'blast',
    name: '爆破指挥',
    color: '#ff6b35',
    lon: TUNNEL_FACE.lon - 0.002,
    lat: TUNNEL_FACE.lat + 0.003,
    height: TUNNEL_FACE.height + 90,
  },
  {
    key: 'support',
    name: '支护监测',
    color: '#aa88ff',
    lon: TUNNEL_FACE.lon + (TUNNEL_ENTRANCE.lon - TUNNEL_FACE.lon) * 0.2,
    lat: TUNNEL_FACE.lat + (TUNNEL_ENTRANCE.lat - TUNNEL_FACE.lat) * 0.2,
    height: TUNNEL_FACE.height - 30,
  },
  {
    key: 'vent',
    name: '通风系统',
    color: '#44ff88',
    lon: TUNNEL_MID.lon,
    lat: TUNNEL_MID.lat,
    height: TUNNEL_MID.height + 80,
  },
  {
    key: 'dispatch',
    name: '调度中心',
    color: '#ffaa00',
    lon: TUNNEL_ENTRANCE.lon + (TUNNEL_FACE.lon - TUNNEL_ENTRANCE.lon) * 0.15,
    lat: TUNNEL_ENTRANCE.lat + (TUNNEL_FACE.lat - TUNNEL_ENTRANCE.lat) * 0.15,
    height: TUNNEL_ENTRANCE.height + 60,
  },
];

// ── 内部状态 ──────────────────────────────────────────────
let _entityIds: string[] = [];

function getViewer(): any {
  if ((window as any).viewer) return (window as any).viewer;
  if (DTScopeEngine && (DTScopeEngine as any).viewer) return (DTScopeEngine as any).viewer;
  return null;
}

function addEntity(def: any): string {
  const viewer = getViewer();
  if (!viewer) return '';
  viewer.entities.add(def);
  _entityIds.push(def.id);
  return def.id;
}

// ── 主入口：创建所有隧道实体 ─────────────────────────────
export function addTunnelEntities(onHotspotClick?: (key: string) => void) {
  const viewer = getViewer();
  if (!viewer) return;

  removeTunnelEntities();
}

// ── 移除所有隧道实体 ──────────────────────────────────────
export function removeTunnelEntities() {
  const viewer = getViewer();
  if (!viewer) return;

  _entityIds.forEach(id => {
    const entity = viewer.entities.getById(id);
    if (entity) viewer.entities.remove(entity);
  });
  _entityIds = [];

  if ((viewer as any)._tunnelHotspotHandler) {
    (viewer as any)._tunnelHotspotHandler.destroy();
    delete (viewer as any)._tunnelHotspotHandler;
  }
}

// ── 设置隧道实体显隐 ──────────────────────────────────────
export function setTunnelEntitiesVisible(show: boolean) {
  const viewer = getViewer();
  if (!viewer) return;
  _entityIds.forEach(id => {
    const e = viewer.entities.getById(id);
    if (e) e.show = show;
  });
}
