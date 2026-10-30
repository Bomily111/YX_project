"""初支钢筋网中心线布置与真实直径实体网格。"""
from __future__ import annotations

import math
from typing import Any

from primary_support.geometry import build_primary_profiles, sample_open_profile


def reference_profile(
    top_radius_mm: float = 6140.0,
    side_radius_mm: float = 10640.0,
    beta_deg: float = 15.6664,
    *,
    reference_surface: str = "PRIMARY_SUPPORT_INNER_SURFACE",
    offset_from_reference_mm: float = 40.0,
) -> dict[str, Any]:
    profile = build_primary_profiles(top_radius_mm, side_radius_mm, top_radius_mm, side_radius_mm, beta_deg)["inner"]
    profile["role"] = "PRIMARY_SUPPORT_MESH_CENTERLINE"
    profile["reference_surface"] = reference_surface
    profile["offset_from_reference_mm"] = float(offset_from_reference_mm)
    return profile


def profile_length_mm(profile: dict[str, Any]) -> float:
    return sum(abs(s["end_angle_deg"] - s["start_angle_deg"]) * math.pi / 180.0 * s["radius_mm"] for s in profile["segments"])


def point_at_distance(profile: dict[str, Any], distance_mm: float) -> list[float]:
    remaining = min(max(distance_mm, 0.0), profile_length_mm(profile))
    for segment in profile["segments"]:
        length = abs(segment["end_angle_deg"] - segment["start_angle_deg"]) * math.pi / 180.0 * segment["radius_mm"]
        if remaining <= length + 1e-9:
            t = 0.0 if length == 0 else remaining / length
            angle = math.radians(segment["start_angle_deg"] + (segment["end_angle_deg"] - segment["start_angle_deg"]) * t)
            return [segment["center_mm"][0] + segment["radius_mm"] * math.cos(angle), segment["center_mm"][1] + segment["radius_mm"] * math.sin(angle)]
        remaining -= length
    return list(profile["segments"][-1]["end_mm"])


def circumferential_positions_mm(depth_mm: float = 1000.0, spacing_mm: float = 200.0) -> list[float]:
    """以短节中心起布，保持设计间距，端部留等量余量。"""
    if depth_mm <= 0 or spacing_mm <= 0:
        raise ValueError("短节长度和间距必须为正数")
    half_count = int(math.floor((depth_mm / 2.0) / spacing_mm))
    positions = [depth_mm / 2.0 + k * spacing_mm for k in range(-half_count, half_count + 1)]
    return [z for z in positions if 0.0 < z < depth_mm]


def longitudinal_positions(profile: dict[str, Any], spacing_mm: float = 200.0) -> dict[str, Any]:
    """从拱顶向左右按精确弧长间距起布，不为凑整数根调整设计间距。"""
    total = profile_length_mm(profile)
    half = total / 2.0
    n = int(math.floor(half / spacing_mm))
    distances = [half + k * spacing_mm for k in range(-n, n + 1)]
    return {
        "distances_mm": distances,
        "points_mm": [point_at_distance(profile, d) for d in distances],
        "count": len(distances),
        "actual_spacing_mm": spacing_mm,
        "left_end_margin_mm": distances[0],
        "right_end_margin_mm": total - distances[-1],
        "symmetric": abs(distances[0] - (total - distances[-1])) < 1e-6,
    }


def _bbox(vertices: list[list[float]]) -> dict[str, list[float]]:
    mins = [min(v[k] for v in vertices) for k in range(3)]
    maxs = [max(v[k] for v in vertices) for k in range(3)]
    return {"min": mins, "max": maxs, "size": [maxs[k] - mins[k] for k in range(3)]}


def _open_tube(points_mm: list[list[float]], z_mm: float, diameter_mm: float, radial_segments: int = 8) -> dict[str, Any]:
    radius_m = diameter_mm / 2000.0
    vertices: list[list[float]] = []
    n = len(points_mm)
    for i, (x, y) in enumerate(points_mm):
        p0, p1 = points_mm[max(0, i - 1)], points_mm[min(n - 1, i + 1)]
        tx, ty = p1[0] - p0[0], p1[1] - p0[1]
        length = math.hypot(tx, ty)
        nx, ny = -ty / length, tx / length
        for j in range(radial_segments):
            a = 2 * math.pi * j / radial_segments
            vertices.append([x / 1000.0 + radius_m * math.cos(a) * nx, y / 1000.0 + radius_m * math.cos(a) * ny, z_mm / 1000.0 + radius_m * math.sin(a)])
    indices: list[int] = []
    for i in range(n - 1):
        for j in range(radial_segments):
            nj = (j + 1) % radial_segments
            a, b, c, d = i * radial_segments + j, (i + 1) * radial_segments + j, (i + 1) * radial_segments + nj, i * radial_segments + nj
            indices += [a, b, c, a, c, d]
    return {"vertices": vertices, "indices": indices, "bbox_m": _bbox(vertices)}


def _longitudinal_tube(point_mm: list[float], depth_mm: float, diameter_mm: float, radial_segments: int = 8) -> dict[str, Any]:
    radius_m = diameter_mm / 2000.0
    x, y = point_mm[0] / 1000.0, point_mm[1] / 1000.0
    vertices = []
    for z in (0.0, depth_mm / 1000.0):
        for j in range(radial_segments):
            a = 2 * math.pi * j / radial_segments
            vertices.append([x + radius_m * math.cos(a), y + radius_m * math.sin(a), z])
    indices: list[int] = []
    for j in range(radial_segments):
        nj = (j + 1) % radial_segments
        indices += [j, radial_segments + j, radial_segments + nj, j, radial_segments + nj, nj]
    return {"vertices": vertices, "indices": indices, "bbox_m": _bbox(vertices)}


def combine_meshes(meshes: list[dict[str, Any]]) -> dict[str, Any]:
    vertices: list[list[float]] = []
    indices: list[int] = []
    for mesh in meshes:
        offset = len(vertices)
        vertices.extend(mesh["vertices"])
        indices.extend(offset + i for i in mesh["indices"])
    return {"vertices": vertices, "indices": indices, "bbox_m": _bbox(vertices), "vertex_count": len(vertices), "triangle_count": len(indices) // 3}


def build_primary_mesh_geometry(
    depth_mm: float = 1000.0,
    top_radius_mm: float = 6140.0,
    side_radius_mm: float = 10640.0,
    beta_deg: float = 15.6664,
    diameter_mm: float = 8.0,
    circumferential_spacing_mm: float = 200.0,
    longitudinal_spacing_mm: float = 200.0,
    reference_surface: str = "PRIMARY_SUPPORT_INNER_SURFACE",
    offset_from_reference_mm: float = 40.0,
) -> dict[str, Any]:
    """生成网片实体；半径参数用于关系模块切换钢架内/外侧，默认值保持历史模型不变。"""
    profile = reference_profile(
        top_radius_mm,
        side_radius_mm,
        beta_deg,
        reference_surface=reference_surface,
        offset_from_reference_mm=offset_from_reference_mm,
    )
    centerline = sample_open_profile(profile, 96)
    ring_z = circumferential_positions_mm(depth_mm, longitudinal_spacing_mm)
    long_layout = longitudinal_positions(profile, circumferential_spacing_mm)
    circum_mesh = combine_meshes([_open_tube(centerline, z, diameter_mm) for z in ring_z])
    long_mesh = combine_meshes([_longitudinal_tube(point, depth_mm, diameter_mm) for point in long_layout["points_mm"]])
    return {
        "reference_profile": profile,
        "profile_length_mm": profile_length_mm(profile),
        "circumferential": {"diameter_mm": float(diameter_mm), "longitudinal_spacing_mm": float(longitudinal_spacing_mm), "z_positions_mm": ring_z, "count": len(ring_z), "mesh": circum_mesh},
        "longitudinal": {"diameter_mm": float(diameter_mm), "circumferential_spacing_mm": float(circumferential_spacing_mm), **long_layout, "mesh": long_mesh},
        "depth_mm": depth_mm,
        "scope": "ARCH_AND_WALL_ONLY",
        "invert": "NOT_APPLICABLE",
        "unresolved": "LOCAL_STEEL_ARCH_CONNECTION_UNRESOLVED",
    }
