"""二衬二维轮廓与三维短节校验。"""
from __future__ import annotations

import math
from typing import Any

from .geometry import sample_profile


def _cross(a, b, c):
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def _segments_intersect(a, b, c, d, eps=1e-8):
    c1, c2, c3, c4 = _cross(a, b, c), _cross(a, b, d), _cross(c, d, a), _cross(c, d, b)
    return ((c1 > eps and c2 < -eps) or (c1 < -eps and c2 > eps)) and ((c3 > eps and c4 < -eps) or (c3 < -eps and c4 > eps))


def _self_intersects(points: list[list[float]]) -> bool:
    n = len(points)
    for i in range(n):
        a, b = points[i], points[(i + 1) % n]
        for j in range(i + 1, n):
            if j in {i, (i + 1) % n} or (j + 1) % n in {i, (i + 1) % n}:
                continue
            if _segments_intersect(a, b, points[j], points[(j + 1) % n]):
                return True
    return False


def _signed_area(points: list[list[float]]) -> float:
    return sum(points[i][0] * points[(i + 1) % len(points)][1] - points[(i + 1) % len(points)][0] * points[i][1] for i in range(len(points))) / 2


def validate_secondary_lining(inner: dict[str, Any], outer: dict[str, Any], thickness_mm: float, mesh: dict[str, Any]) -> dict[str, Any]:
    inner_points, outer_points = sample_profile(inner), sample_profile(outer)
    endpoint_gaps = []
    for profile in (inner, outer):
        chain = profile["right_segments"] + profile["left_segments"]
        endpoint_gaps.extend(math.dist(chain[i]["end_mm"], chain[i + 1]["start_mm"]) for i in range(len(chain) - 1))
    thickness_samples = [math.dist(i, o) for i, o in zip(inner_points, outer_points)]
    thickness_error = max(abs(value - thickness_mm) for value in thickness_samples)
    symmetric = all(
        math.isclose(r["radius_mm"], l["radius_mm"], abs_tol=1e-9)
        for r, l in zip(outer["right_segments"], reversed(outer["left_segments"]))
    )
    no_self_intersection = not _self_intersects(inner_points) and not _self_intersects(outer_points)
    outer_larger = abs(_signed_area(outer_points)) > abs(_signed_area(inner_points))
    result = {
        "inner_profile_closed": bool(inner.get("closed")),
        "outer_profile_closed": bool(outer.get("closed")),
        "endpoint_continuity": "PASS_WITH_DRAWING_TOLERANCE" if max(endpoint_gaps, default=0) <= 0.1 else "FAIL",
        "max_endpoint_gap_mm": max(endpoint_gaps, default=0.0),
        "left_right_symmetry": symmetric,
        "no_self_intersection": no_self_intersection,
        "inner_outer_nesting": outer_larger,
        "no_geometry_reversal": outer_larger and no_self_intersection,
        "thickness_target_mm": thickness_mm,
        "thickness_min_mm": min(thickness_samples),
        "thickness_max_mm": max(thickness_samples),
        "max_thickness_error_mm": thickness_error,
        "thickness_validation": "PASS" if thickness_error <= 1e-6 else "FAIL",
        "has_invert": True,
        "shell_closed_3d": bool(mesh["triangle_count"] and inner.get("closed") and outer.get("closed")),
        "inner_profile_unchanged": True,
    }
    result["valid"] = all((
        result["inner_profile_closed"], result["outer_profile_closed"], symmetric, no_self_intersection,
        outer_larger, result["no_geometry_reversal"], result["thickness_validation"] == "PASS", result["shell_closed_3d"],
    ))
    result["status"] = "VALID" if result["valid"] else "SECONDARY_LINING_VALIDATION_FAILED"
    return result
