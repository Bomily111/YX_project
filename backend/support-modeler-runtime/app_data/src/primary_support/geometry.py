"""只构造工程关系已确认的顶拱和侧拱初支混凝土。"""
from __future__ import annotations

import math
from typing import Any


def _point(center: list[float], radius: float, angle_deg: float) -> list[float]:
    angle = math.radians(angle_deg)
    return [center[0] + radius * math.cos(angle), center[1] + radius * math.sin(angle)]


def _segment(name: str, center: list[float], radius: float, a0: float, a1: float) -> dict[str, Any]:
    return {
        "name": name,
        "center_mm": center,
        "radius_mm": float(radius),
        "start_angle_deg": float(a0),
        "end_angle_deg": float(a1),
        "start_mm": _point(center, radius, a0),
        "end_mm": _point(center, radius, a1),
        "status": "CONFIRMED",
    }


def _open_profile(top_radius: float, side_radius: float, beta_deg: float, role: str) -> dict[str, Any]:
    # R2-R1=4500 mm；与已验证钢架的三圆弧圆心体系一致。
    center_offset = side_radius - top_radius
    segments = [
        _segment("left_side", [center_offset, 0.0], side_radius, 180.0 + beta_deg, 180.0),
        _segment("top", [0.0, 0.0], top_radius, 180.0, 0.0),
        _segment("right_side", [-center_offset, 0.0], side_radius, 0.0, -beta_deg),
    ]
    return {
        "role": role,
        "coordinate_system": "x_right_y_up_mm",
        "construction": "STEEL_ARCH_REFERENCED_THREE_ARC_OPEN_PROFILE",
        "top_radius_mm": float(top_radius),
        "side_radius_mm": float(side_radius),
        "side_angle_deg": float(beta_deg),
        "center_offset_mm": float(center_offset),
        "segments": segments,
        "open_at_invert": True,
        "omitted_segments": ["invert_transition", "invert_bottom"],
    }


def build_primary_profiles(
    inner_top_mm: float = 6100.0,
    inner_side_mm: float = 10600.0,
    outer_top_mm: float = 6360.0,
    outer_side_mm: float = 10860.0,
    beta_deg: float = 15.6664,
) -> dict[str, Any]:
    """生成同心、等角且在下部保持开放的内外边界。"""
    if abs((outer_top_mm - inner_top_mm) - (outer_side_mm - inner_side_mm)) > 1e-9:
        raise ValueError("顶拱与侧拱初支厚度不一致")
    if abs((inner_side_mm - inner_top_mm) - (outer_side_mm - outer_top_mm)) > 1e-9:
        raise ValueError("内外边界圆心体系不一致")
    return {
        "inner": _open_profile(inner_top_mm, inner_side_mm, beta_deg, "PRIMARY_SUPPORT_INNER_REFERENCE"),
        "outer": _open_profile(outer_top_mm, outer_side_mm, beta_deg, "EXCAVATION_OUTER_BOUNDARY"),
        "thickness_mm": float(outer_top_mm - inner_top_mm),
        "scope": "ARCH_AND_WALL_ONLY",
        "invert": "NOT_APPLICABLE",
        "unresolved": None,
    }


def sample_open_profile(profile: dict[str, Any], samples_per_segment: int = 64) -> list[list[float]]:
    points: list[list[float]] = []
    for segment in profile["segments"]:
        for i in range(samples_per_segment + 1):
            if points and i == 0:
                continue
            angle = segment["start_angle_deg"] + (segment["end_angle_deg"] - segment["start_angle_deg"]) * i / samples_per_segment
            points.append(_point(segment["center_mm"], segment["radius_mm"], angle))
    return points


def build_open_shell_mesh(profiles: dict[str, Any], depth_mm: float = 1000.0, samples_per_segment: int = 64) -> dict[str, Any]:
    """生成有端盖的开放拱墙短节；不跨越未知仰拱区域闭合。"""
    inner = sample_open_profile(profiles["inner"], samples_per_segment)
    outer = sample_open_profile(profiles["outer"], samples_per_segment)
    if len(inner) != len(outer):
        raise ValueError("内外轮廓采样拓扑不一致")
    n = len(inner)
    z1 = depth_mm / 1000.0
    rings = []
    for z, points in ((0.0, outer), (0.0, inner), (z1, outer), (z1, inner)):
        rings.append([[x / 1000.0, y / 1000.0, z] for x, y in points])
    vertices = [v for ring in rings for v in ring]
    indices: list[int] = []
    for i in range(n - 1):
        j = i + 1
        of, inf, ob, inb = i, n + i, 2 * n + i, 3 * n + i
        ofj, infj, obj, inbj = j, n + j, 2 * n + j, 3 * n + j
        indices += [of, inf, infj, of, infj, ofj]
        indices += [ob, inbj, inb, ob, obj, inbj]
        indices += [of, ofj, obj, of, obj, ob]
        indices += [inf, inb, inbj, inf, inbj, infj]
    # 两个底端仅封闭层厚截面；两端之间的未知仰拱区域不生成面。
    for i in (0, n - 1):
        of, inf, ob, inb = i, n + i, 2 * n + i, 3 * n + i
        indices += [of, ob, inb, of, inb, inf]
    mins = [min(v[k] for v in vertices) for k in range(3)]
    maxs = [max(v[k] for v in vertices) for k in range(3)]
    return {
        "vertices": vertices,
        "indices": indices,
        "coordinate_system": "x_right_y_up_z_forward_m",
        "unit": "m",
        "depth_m": z1,
        "mesh_count": 1,
        "vertex_count": len(vertices),
        "triangle_count": len(indices) // 3,
        "bbox_m": {"min": mins, "max": maxs, "size": [maxs[k] - mins[k] for k in range(3)]},
        "open_at_invert": True,
    }
