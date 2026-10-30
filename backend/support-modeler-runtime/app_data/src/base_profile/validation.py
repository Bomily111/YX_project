"""基础断面参数、连续性、对称性和层间关系校验。"""

from __future__ import annotations

import math
from typing import Any

from .models import BaseProfileParameters, GeometryTolerance


def validate_base_profile(parameters: BaseProfileParameters) -> dict[str, Any]:
    missing: list[str] = []
    errors: list[dict[str, str]] = []
    for item in parameters.all_profile_parameters():
        if item.value is None:
            missing.append(item.schema_id)
            continue
        if item.unit in {"mm", "deg"} and (isinstance(item.value, bool) or not isinstance(item.value, (int, float))):
            errors.append({"code": "INVALID_NUMERIC_VALUE", "field": item.schema_id})
        elif item.unit == "mm" and float(item.value) <= 0:
            errors.append({"code": "NON_POSITIVE_RADIUS", "field": item.schema_id})
        elif item.unit == "deg" and not 0 < float(item.value) <= 360:
            errors.append({"code": "INVALID_ANGLE", "field": item.schema_id})
    for item in (
        parameters.thickness.primary_support_thickness,
        parameters.thickness.secondary_lining_thickness,
        parameters.thickness.reserved_deformation,
    ):
        if item.value is None:
            missing.append(item.schema_id)
        elif isinstance(item.value, bool) or not isinstance(item.value, (int, float)) or float(item.value) <= 0:
            errors.append({"code": "INVALID_LAYER_THICKNESS", "field": item.schema_id})
    return {
        "valid": not missing and not errors,
        "missing_parameters": sorted(set(missing)),
        "errors": errors,
        "status": "VALID" if not missing and not errors else "BASE_PROFILE_PARAMETER_MISSING",
    }


def _distance(a: list[float], b: list[float]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def validate_section_geometry(
    inner: dict[str, Any] | None,
    secondary: dict[str, Any] | None,
    excavation: dict[str, Any] | None,
    has_invert: bool,
    tolerance: GeometryTolerance | None = None,
) -> dict[str, Any]:
    tolerance = tolerance or GeometryTolerance()
    if inner is None:
        return {
            "valid": False,
            "status": "NOT_RUN_MISSING_PARAMETERS",
            "endpoint_continuity": None,
            "tangent_continuity": None,
            "symmetry": None,
            "closed_invert": None,
            "layer_order": None,
        }
    segments = inner["right_segments"]
    endpoint_gaps = [_distance(segments[index]["end_mm"], segments[index + 1]["start_mm"]) for index in range(len(segments) - 1)]
    endpoint_numeric = all(gap <= tolerance.numerical_epsilon for gap in endpoint_gaps)
    endpoint_drawing = all(gap <= tolerance.drawing_closure_tolerance_mm for gap in endpoint_gaps)
    endpoint_status = "PASS_NUMERIC" if endpoint_numeric else "PASS_WITH_TOLERANCE" if endpoint_drawing else "FAIL"

    tangent_gaps = [abs(segments[index]["end_angle_deg"] - segments[index + 1]["start_angle_deg"]) for index in range(len(segments) - 1)]
    tangent_numeric = all(gap <= tolerance.numerical_epsilon for gap in tangent_gaps)
    tangent_status = "PASS_NUMERIC" if tangent_numeric else "CANDIDATE"
    symmetry = all(
        abs(right["radius_mm"] - left["radius_mm"]) <= tolerance.numerical_epsilon
        for right, left in zip(segments, reversed(inner["left_segments"]))
    )
    closed = (not has_invert) or inner["axis_closure_residual_mm"] <= tolerance.drawing_closure_tolerance_mm
    layer_order: bool | None = None
    if secondary is not None and excavation is not None:
        inner_by_name = {item["name"]: item for item in inner["right_segments"]}
        secondary_by_name = {item["name"]: item for item in secondary["right_segments"]}
        excavation_by_name = {item["name"]: item for item in excavation["right_segments"]}
        common = sorted(set(inner_by_name) & set(secondary_by_name) & set(excavation_by_name))
        layer_order = bool(common) and all(
            inner_by_name[name]["radius_mm"] < secondary_by_name[name]["radius_mm"] < excavation_by_name[name]["radius_mm"]
            for name in common
        )
    inner_valid = endpoint_drawing and symmetry and closed
    return {
        "valid": inner_valid,
        "status": "VALID" if inner_valid else "GEOMETRY_VALIDATION_FAILED",
        "endpoint_continuity": endpoint_status,
        "endpoint_gaps_mm": endpoint_gaps,
        "tangent_continuity": tangent_status,
        "tangent_angle_gaps_deg": tangent_gaps,
        "symmetry": symmetry,
        "closed_invert": closed,
        "closure_status": inner.get("closure_status"),
        "axis_closure_residual_mm": inner.get("axis_closure_residual_mm"),
        "drawing_relation": "NEEDS_ENGINEERING_CONFIRMATION",
        "geometry_relation": "RELATION_CANDIDATE",
        "layer_order": layer_order,
        "tolerance": tolerance.to_dict(),
    }
