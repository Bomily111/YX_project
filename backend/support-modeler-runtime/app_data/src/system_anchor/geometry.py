"""沿已确认的拱墙开挖边界生成系统锚杆布局和圆柱实体。"""
from __future__ import annotations

import math
from typing import Any

from primary_support.geometry import build_primary_profiles


def excavation_profile(
    top_radius_mm: float = 6360.0,
    side_radius_mm: float = 10860.0,
    beta_deg: float = 15.6664,
) -> dict[str, Any]:
    profile = build_primary_profiles(top_radius_mm, side_radius_mm, top_radius_mm, side_radius_mm, beta_deg)["inner"]
    profile["role"] = "SYSTEM_ANCHOR_BASELINE"
    profile["reference_surface"] = "EXCAVATION_BOUNDARY"
    profile["scope"] = "ARCH_AND_WALL_ONLY"
    return profile


def profile_length_mm(profile: dict[str, Any]) -> float:
    return sum(abs(s["end_angle_deg"] - s["start_angle_deg"]) * math.pi / 180.0 * s["radius_mm"] for s in profile["segments"])


def point_normal_at_distance(profile: dict[str, Any], distance_mm: float) -> tuple[list[float], list[float], str, list[float], float]:
    remaining = min(max(float(distance_mm), 0.0), profile_length_mm(profile))
    for segment in profile["segments"]:
        delta = segment["end_angle_deg"] - segment["start_angle_deg"]
        length = abs(delta) * math.pi / 180.0 * segment["radius_mm"]
        if remaining <= length + 1e-9:
            t = 0.0 if length == 0 else remaining / length
            angle_deg = segment["start_angle_deg"] + delta * t
            angle = math.radians(angle_deg)
            normal = [math.cos(angle), math.sin(angle)]
            center = segment["center_mm"]
            point = [center[0] + segment["radius_mm"] * normal[0], center[1] + segment["radius_mm"] * normal[1]]
            return point, normal, segment["name"], list(center), segment["radius_mm"]
        remaining -= length
    last = profile["segments"][-1]
    angle = math.radians(last["end_angle_deg"])
    return list(last["end_mm"]), [math.cos(angle), math.sin(angle)], last["name"], list(last["center_mm"]), last["radius_mm"]


def circumferential_distances(profile: dict[str, Any], spacing_mm: float, staggered: bool) -> list[float]:
    total = profile_length_mm(profile)
    crown = total / 2.0
    if staggered:
        offsets: list[float] = []
        value = spacing_mm / 2.0
        while value <= crown + 1e-9:
            offsets.extend([-value, value])
            value += spacing_mm
        return sorted(crown + offset for offset in offsets if 0.0 < crown + offset < total)
    n = int(math.floor(crown / spacing_mm))
    return [crown + k * spacing_mm for k in range(-n, n + 1)]


def longitudinal_positions_mm(depth_mm: float = 1000.0, spacing_mm: float = 800.0) -> list[float]:
    if depth_mm < spacing_mm:
        return [depth_mm / 2.0]
    count = int(math.floor(depth_mm / spacing_mm)) + 1
    occupied = (count - 1) * spacing_mm
    margin = (depth_mm - occupied) / 2.0
    return [margin + i * spacing_mm for i in range(count)]


def cylinder_between(start_mm: list[float], end_mm: list[float], diameter_mm: float, radial_segments: int = 10) -> dict[str, Any]:
    start = [v / 1000.0 for v in start_mm]
    end = [v / 1000.0 for v in end_mm]
    axis = [end[i] - start[i] for i in range(3)]
    length = math.sqrt(sum(v * v for v in axis))
    direction = [v / length for v in axis]
    # 锚杆方向位于XY断面；Z轴可直接作为截面基向量。
    u = [0.0, 0.0, 1.0]
    v = [direction[1], -direction[0], 0.0]
    radius = diameter_mm / 2000.0
    vertices: list[list[float]] = []
    for origin in (start, end):
        for j in range(radial_segments):
            a = 2.0 * math.pi * j / radial_segments
            vertices.append([origin[k] + radius * (math.cos(a) * u[k] + math.sin(a) * v[k]) for k in range(3)])
    vertices.extend([start, end])
    indices: list[int] = []
    for j in range(radial_segments):
        nj = (j + 1) % radial_segments
        indices += [j, radial_segments + j, radial_segments + nj, j, radial_segments + nj, nj]
        indices += [2 * radial_segments, nj, j]
        indices += [2 * radial_segments + 1, radial_segments + j, radial_segments + nj]
    mins = [min(p[k] for p in vertices) for k in range(3)]
    maxs = [max(p[k] for p in vertices) for k in range(3)]
    return {
        "vertices": vertices,
        "indices": indices,
        "bbox_m": {"min": mins, "max": maxs, "size": [maxs[k] - mins[k] for k in range(3)]},
        "vertex_count": len(vertices),
        "triangle_count": len(indices) // 3,
    }


def build_system_anchor_geometry(
    depth_mm: float = 1000.0,
    *,
    top_radius_mm: float = 6360.0,
    side_radius_mm: float = 10860.0,
    beta_deg: float = 15.6664,
    diameter_mm: float = 25.0,
    length_mm: float = 4000.0,
    circumferential_spacing_mm: float = 1200.0,
    longitudinal_spacing_mm: float = 800.0,
    z_positions_override_mm: list[float] | None = None,
) -> dict[str, Any]:
    """生成系统锚杆；默认参数保持已验收 ZZ-Va 行为。"""
    profile = excavation_profile(top_radius_mm, side_radius_mm, beta_deg)
    z_positions = z_positions_override_mm or longitudinal_positions_mm(depth_mm, longitudinal_spacing_mm)
    anchors: list[dict[str, Any]] = []
    meshes: dict[str, dict[str, Any]] = {}
    for layer_index, z in enumerate(z_positions):
        distances = circumferential_distances(profile, circumferential_spacing_mm, staggered=bool(layer_index % 2))
        for ring_index, distance in enumerate(distances):
            point, normal, segment, center, radius = point_normal_at_distance(profile, distance)
            start = [point[0], point[1], z]
            end = [point[0] + normal[0] * length_mm, point[1] + normal[1] * length_mm, z]
            name = f"SystemAnchorMesh_{layer_index + 1:02d}_{ring_index + 1:03d}"
            meshes[name] = cylinder_between(start, end, diameter_mm)
            anchors.append({
                "name": name,
                "layer_index": layer_index,
                "ring_index": ring_index,
                "z_mm": z,
                "arc_distance_mm": distance,
                "segment": segment,
                "start_mm": start,
                "end_mm": end,
                "direction_unit": [normal[0], normal[1], 0.0],
                "local_circle_center_mm": center,
                "reference_radius_mm": radius,
                "diameter_mm": float(diameter_mm),
                "length_mm": float(length_mm),
            })
    layers = []
    for i, z in enumerate(z_positions):
        selected = [a for a in anchors if a["layer_index"] == i]
        layers.append({
            "index": i,
            "z_mm": z,
            "staggered": bool(i % 2),
            "count": len(selected),
            "arc_distances_mm": [a["arc_distance_mm"] for a in selected],
        })
    return {
        "status": "SYSTEM_ANCHOR_GEOMETRY_READY",
        "coordinate_system": "x_right_y_up_z_forward_m",
        "engineering_unit": "mm",
        "three_js_unit": "m",
        "depth_mm": depth_mm,
        "reference_profile": profile,
        "profile_length_mm": profile_length_mm(profile),
        "layers": layers,
        "anchors": anchors,
        "meshes": meshes,
        "count": len(anchors),
        "scope": "ARCH_AND_WALL_ONLY",
        "invert": "NOT_APPLICABLE",
        "layout": "CROWN_CENTERED_SYMMETRIC_STAGGERED",
    }
