"""由钢架局部轮廓生成左右镜像的两级锁脚小导管。"""
from __future__ import annotations
import math
from typing import Any

from primary_support.geometry import build_primary_profiles, sample_open_profile
from system_anchor.geometry import cylinder_between
from .models import LockFootAnchorParameters


def _connection_point(
    side: str,
    height_mm: float,
    top_radius_mm: float = 6220.0,
    side_radius_mm: float = 10720.0,
    beta_deg: float = 15.6664,
) -> list[float]:
    """从钢架中心线采样点反求距该侧钢架脚指定高度的局部连接点。"""
    profile = build_primary_profiles(
        top_radius_mm, side_radius_mm, top_radius_mm, side_radius_mm, beta_deg
    )["inner"]
    points = sample_open_profile(profile, 600)
    candidates = [p for p in points if (p[0] < 0 if side == "left" else p[0] > 0)]
    foot_y = min(p[1] for p in candidates)
    target_y = foot_y + height_mm
    return list(min(candidates, key=lambda p: abs(p[1] - target_y)))


def build_lock_foot_anchor_geometry(
    parameters: LockFootAnchorParameters | None = None,
    *,
    top_radius_mm: float = 6220.0,
    side_radius_mm: float = 10720.0,
    beta_deg: float = 15.6664,
    arch_positions_mm: tuple[float, ...] = (100.0, 900.0),
) -> dict[str, Any]:
    p = parameters or LockFootAnchorParameters()
    c, q = p.confirmed, p.provisional
    anchors: list[dict[str, Any]] = []
    meshes: dict[str, dict[str, Any]] = {}
    for arch_index, z in enumerate(arch_positions_mm, 1):
        for side in ("left", "right"):
            sign = -1.0 if side == "left" else 1.0
            for level, height, angle_deg in (
                ("upper", q.upper_install_height_mm, q.upper_angle_deg),
                ("lower", q.lower_install_height_mm, q.lower_angle_deg),
            ):
                xy = _connection_point(side, height, top_radius_mm, side_radius_mm, beta_deg)
                angle = math.radians(angle_deg)
                spread = math.radians(q.pair_spread_angle_deg / 2.0)
                for pair_index, zsign in enumerate((-1.0, 1.0), 1):
                    # 截面中心方向为向外、向下；双管仅在纵向平面左右张开。
                    direction = [sign * math.cos(angle) * math.cos(spread), -math.sin(angle) * math.cos(spread), zsign * math.sin(spread)]
                    start = [xy[0], xy[1], z]
                    end = [start[i] + direction[i] * c.length_mm for i in range(3)]
                    name = f"lockFootAnchor_arch{arch_index:03d}_{side}_{level}_{pair_index:02d}"
                    meshes[name] = cylinder_between(start, end, c.outer_diameter_mm, 12)
                    anchors.append({
                        "name": name, "steel_arch": f"steelArch_{arch_index:03d}", "arch_z_mm": z,
                        "side": side, "level": level, "pair_index": pair_index,
                        "start_mm": start, "end_mm": end, "direction_unit": direction,
                        "length_mm": c.length_mm, "outer_diameter_mm": c.outer_diameter_mm,
                        "wall_thickness_mm": c.wall_thickness_mm, "angle_deg": angle_deg,
                        "pair_spread_signed_deg": zsign * q.pair_spread_angle_deg / 2.0,
                        "connection_location_on_section": q.connection_location_on_section,
                        "start_source": "STEEL_ARCH_LOCAL_PROFILE_DERIVED",
                    })
    return {
        "status": "LOCK_FOOT_ANCHOR_PROVISIONAL_IMPLEMENTED",
        "coordinate_system": "x_right_y_up_z_forward_mm", "geometry_representation": "SOLID_VISUAL_APPROXIMATION",
        "parameters": p.to_dict(), "anchors": anchors, "meshes": meshes, "count": len(anchors),
        "steel_arch_reference": {
            "top_radius_mm": top_radius_mm,
            "side_radius_mm": side_radius_mm,
            "beta_deg": beta_deg,
            "arch_positions_mm": list(arch_positions_mm),
        },
        "object_tree": {"lockFootAnchorGroup": ["arch001_lockFootGroup", "arch002_lockFootGroup"]},
    }
