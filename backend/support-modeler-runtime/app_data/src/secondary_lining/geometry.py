"""直接从统一内轮廓构造二衬外轮廓与短节实体网格。"""
from __future__ import annotations

import copy
import math
from typing import Any


def _point(center: list[float], radius: float, angle_deg: float) -> list[float]:
    angle = math.radians(angle_deg)
    return [center[0] + radius * math.cos(angle), center[1] + radius * math.sin(angle)]


def build_normal_offset_profile(inner: dict[str, Any], thickness_mm: float) -> dict[str, Any]:
    """对每段圆弧做外法线等距偏移；圆心、起止角和分段拓扑均来自 inner_profile。"""
    if thickness_mm <= 0:
        raise ValueError("二衬厚度必须为正数")
    result = copy.deepcopy(inner)
    result["construction"] = "NORMAL_OFFSET_FROM_SECTION_GEOMETRY_INNER_PROFILE"
    result["profile_source"] = "sectionGeometryState.inner_profile"
    result["normal_offset_mm"] = float(thickness_mm)
    for side in ("right_segments", "left_segments"):
        for segment in result[side]:
            segment["radius_mm"] = float(segment["radius_mm"]) + float(thickness_mm)
            segment["start_mm"] = _point(segment["center_mm"], segment["radius_mm"], segment["start_angle_deg"])
            segment["end_mm"] = _point(segment["center_mm"], segment["radius_mm"], segment["end_angle_deg"])
            segment["offset_from_inner_mm"] = float(thickness_mm)
    right = result["right_segments"]
    left = result["left_segments"]
    result["bottom_right_mm"] = right[-1]["end_mm"]
    result["bottom_left_mm"] = left[0]["start_mm"]
    result["axis_closure_residual_mm"] = abs(right[-1]["end_mm"][0])
    result["full_bottom_gap_mm"] = result["axis_closure_residual_mm"] * 2
    points = [p for segment in right + left for p in (segment["start_mm"], segment["end_mm"])]
    max_x = max(abs(p[0]) for p in points)
    min_y, max_y = min(p[1] for p in points), max(p[1] for p in points)
    result["calculated_width_mm"] = 2 * max_x
    result["calculated_height_mm"] = max_y - min_y
    result["bounds_mm"] = {"min_x": -max_x, "max_x": max_x, "min_y": min_y, "max_y": max_y}
    result["closed"] = result["axis_closure_residual_mm"] <= inner["tolerance"]["drawing_closure_tolerance_mm"]
    result["closure_status"] = "DRAWING_ROUNDING_RESIDUAL" if not inner.get("closed_numeric") and result["closed"] else "CLOSED_NUMERIC" if result["closed"] else "OPEN"
    return result


def sample_profile(profile: dict[str, Any], samples_per_segment: int = 32) -> list[list[float]]:
    """按轮廓顺序采样，并删除相邻圆弧的重复接点。"""
    points: list[list[float]] = []
    for segment in profile["right_segments"] + profile["left_segments"]:
        a0, a1 = segment["start_angle_deg"], segment["end_angle_deg"]
        for index in range(samples_per_segment + 1):
            if points and index == 0:
                continue
            angle = a0 + (a1 - a0) * index / samples_per_segment
            points.append(_point(segment["center_mm"], segment["radius_mm"], angle))
    if points and math.dist(points[0], points[-1]) <= 0.1:
        points.pop()
    return points


def build_extruded_shell_mesh(
    inner: dict[str, Any], outer: dict[str, Any], depth_mm: float = 1000.0, samples_per_segment: int = 32
) -> dict[str, Any]:
    """生成前后环面及内外侧壁；坐标转换为 Three.js 使用的米。"""
    inner_pts = sample_profile(inner, samples_per_segment)
    outer_pts = sample_profile(outer, samples_per_segment)
    if len(inner_pts) != len(outer_pts):
        raise ValueError("内外轮廓采样拓扑不一致")
    n = len(inner_pts)
    depth_m = depth_mm / 1000.0
    rings = []
    for z, pts in ((0.0, outer_pts), (0.0, inner_pts), (depth_m, outer_pts), (depth_m, inner_pts)):
        rings.append([[x / 1000.0, y / 1000.0, z] for x, y in pts])
    vertices = [vertex for ring in rings for vertex in ring]
    indices: list[int] = []
    for i in range(n):
        j = (i + 1) % n
        of, inf, ob, inb = i, n + i, 2 * n + i, 3 * n + i
        ofj, infj, obj, inbj = j, n + j, 2 * n + j, 3 * n + j
        indices += [of, inf, infj, of, infj, ofj]            # front annulus
        indices += [ob, inbj, inb, ob, obj, inbj]            # back annulus
        indices += [of, ofj, obj, of, obj, ob]                # outer wall
        indices += [inf, inb, inbj, inf, inbj, infj]          # inner wall
    mins = [min(v[k] for v in vertices) for k in range(3)]
    maxs = [max(v[k] for v in vertices) for k in range(3)]
    return {
        "coordinate_system": "x_right_y_up_z_forward_m",
        "unit": "m",
        "depth_m": depth_m,
        "mesh_count": 1,
        "vertex_count": len(vertices),
        "triangle_count": len(indices) // 3,
        "bbox_m": {"min": mins, "max": maxs, "size": [maxs[k] - mins[k] for k in range(3)]},
        "vertices": vertices,
        "indices": indices,
    }
