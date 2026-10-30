"""四段对称圆弧的二维计算；仅在全部参数有证据时执行。"""

from __future__ import annotations

import math
from typing import Any

from .models import BaseProfileParameters, GeometryTolerance


def _advance_arc(start: tuple[float, float], tangent: float, radius: float, angle: float) -> tuple[dict[str, Any], tuple[float, float], float]:
    """沿右侧顺时针圆弧前进，保证与上一段端点连续且切向连续。"""
    phi0 = tangent + math.pi / 2
    center = (start[0] - radius * math.cos(phi0), start[1] - radius * math.sin(phi0))
    phi1 = phi0 - angle
    end = (center[0] + radius * math.cos(phi1), center[1] + radius * math.sin(phi1))
    return {
        "center_mm": [center[0], center[1]],
        "radius_mm": radius,
        "start_angle_deg": math.degrees(phi0),
        "end_angle_deg": math.degrees(phi1),
        "start_mm": [start[0], start[1]],
        "end_mm": [end[0], end[1]],
        "connection": "TANGENT",
    }, end, tangent - angle


def build_tangent_profile(
    parameters: BaseProfileParameters,
    radius_offset_mm: float = 0.0,
    tolerance: GeometryTolerance | None = None,
) -> dict[str, Any]:
    tolerance = tolerance or parameters.geometry_tolerance
    values = {
        "top_radius": float(parameters.top["radius_mm"].value) + radius_offset_mm,
        "top_angle": float(parameters.top["angle_deg"].value),
        "side_radius": float(parameters.side["radius_mm"].value) + radius_offset_mm,
        "side_angle": float(parameters.side["angle_deg"].value),
        "transition_radius": float(parameters.invert_transition["radius_mm"].value) + radius_offset_mm,
        "transition_angle": float(parameters.invert_transition["angle_deg"].value),
        "bottom_radius": float(parameters.invert_bottom["radius_mm"].value) + radius_offset_mm,
        "bottom_angle": float(parameters.invert_bottom["angle_deg"].value),
    }
    start = (0.0, values["top_radius"])
    tangent = 0.0
    right: list[dict[str, Any]] = []
    for name, radius, angle in (
        ("top", values["top_radius"], math.radians(values["top_angle"] / 2)),
        ("side", values["side_radius"], math.radians(values["side_angle"])),
        ("invert_transition", values["transition_radius"], math.radians(values["transition_angle"])),
        ("invert_bottom", values["bottom_radius"], math.radians(values["bottom_angle"] / 2)),
    ):
        arc, start, tangent = _advance_arc(start, tangent, radius, angle)
        arc["name"] = name
        right.append(arc)
    left = []
    for arc in reversed(right):
        left.append({
            **arc,
            "name": f"{arc['name']}_mirrored",
            "center_mm": [-arc["center_mm"][0], arc["center_mm"][1]],
            "start_mm": [-arc["end_mm"][0], arc["end_mm"][1]],
            "end_mm": [-arc["start_mm"][0], arc["start_mm"][1]],
            "start_angle_deg": 180 - arc["end_angle_deg"],
            "end_angle_deg": 180 - arc["start_angle_deg"],
        })
    axis_residual = abs(right[-1]["end_mm"][0])
    points = [point for segment in right + left for point in (segment["start_mm"], segment["end_mm"])]
    min_y = min(point[1] for point in points)
    max_y = max(point[1] for point in points)
    max_abs_x = max(abs(point[0]) for point in points)
    closed_numeric = axis_residual <= tolerance.numerical_epsilon
    closed_drawing = axis_residual <= tolerance.drawing_closure_tolerance_mm
    closure_status = (
        "CLOSED_NUMERIC" if closed_numeric else
        "DRAWING_ROUNDING_RESIDUAL" if closed_drawing else
        "OPEN"
    )
    return {
        "coordinate_system": "x_right_y_up_mm",
        "construction": "TANGENT_CHAIN_MIRRORED",
        "radius_offset_mm": radius_offset_mm,
        "right_segments": right,
        "left_segments": left,
        "bottom_right_mm": right[-1]["end_mm"],
        "bottom_left_mm": left[0]["start_mm"],
        "closed": closed_drawing,
        "closed_numeric": closed_numeric,
        "closure_status": closure_status,
        "axis_closure_residual_mm": axis_residual,
        "full_bottom_gap_mm": axis_residual * 2,
        "calculated_width_mm": max_abs_x * 2,
        "calculated_height_mm": max_y - min_y,
        "bounds_mm": {"min_x": -max_abs_x, "max_x": max_abs_x, "min_y": min_y, "max_y": max_y},
        "geometry_relation": "RELATION_CANDIDATE",
        "tolerance": tolerance.to_dict(),
    }


def build_offset_profile(parameters: BaseProfileParameters, offset_mm: float | None) -> dict[str, Any] | None:
    if offset_mm is None:
        return None
    return build_tangent_profile(parameters, radius_offset_mm=float(offset_mm))


def build_partial_excavation_profile(parameters: BaseProfileParameters, offset_mm: float | None) -> dict[str, Any] | None:
    """只构造证据已确认的顶拱、侧拱开挖边界。"""
    if offset_mm is None:
        return None
    full_chain = build_tangent_profile(parameters, radius_offset_mm=float(offset_mm))
    right = full_chain["right_segments"][:2]
    left_by_name = {segment["name"]: segment for segment in full_chain["left_segments"]}
    left = [left_by_name["side_mirrored"], left_by_name["top_mirrored"]]
    return {
        "coordinate_system": full_chain["coordinate_system"],
        "construction": "CONFIRMED_TOP_SIDE_OFFSET_ONLY",
        "radius_offset_mm": float(offset_mm),
        "right_segments": right,
        "left_segments": left,
        "available_segments": ["top", "side"],
        "omitted_segments": ["invert_transition", "invert_bottom"],
        "status": "EXCAVATION_BOUNDARY_PARTIAL",
    }
