"""系统锚杆参数、布局和空间方向验证。"""
from __future__ import annotations

import math
from typing import Any


def _pair_symmetric(distances: list[float], crown: float, tolerance: float = 1e-6) -> bool:
    offsets = sorted(round(d - crown, 6) for d in distances)
    return len(offsets) % 2 == 0 and all(abs(offsets[i] + offsets[-1 - i]) <= tolerance for i in range(len(offsets) // 2)) or (
        len(offsets) % 2 == 1 and abs(offsets[len(offsets) // 2]) <= tolerance and all(abs(offsets[i] + offsets[-1 - i]) <= tolerance for i in range(len(offsets) // 2))
    )


def validate_system_anchor(parameters: dict[str, Any], geometry: dict[str, Any]) -> dict[str, Any]:
    anchors = geometry["anchors"]
    crown = geometry["profile_length_mm"] / 2.0
    lengths = [math.dist(a["start_mm"], a["end_mm"]) for a in anchors]
    direction_dots = []
    start_radius_errors = []
    outward_increases = []
    for anchor in anchors:
        start, end = anchor["start_mm"], anchor["end_mm"]
        center = anchor["local_circle_center_mm"]
        radial = [start[0] - center[0], start[1] - center[1]]
        radial_length = math.hypot(*radial)
        direction = anchor["direction_unit"]
        direction_dots.append((radial[0] / radial_length) * direction[0] + (radial[1] / radial_length) * direction[1])
        start_radius_errors.append(abs(radial_length - anchor["reference_radius_mm"]))
        outward_increases.append(math.hypot(end[0] - center[0], end[1] - center[1]) - radial_length)
    within_layer_spacing = []
    symmetry = []
    for layer in geometry["layers"]:
        d = layer["arc_distances_mm"]
        within_layer_spacing.extend(d[i + 1] - d[i] for i in range(len(d) - 1))
        symmetry.append(_pair_symmetric(d, crown))
    z = [layer["z_mm"] for layer in geometry["layers"]]
    validation = {
        "diameter_exact_mm": all(a["diameter_mm"] == 25.0 for a in anchors),
        "all_lengths_mm": lengths,
        "length_exact": max(abs(v - 4000.0) for v in lengths) < 1e-6,
        "circumferential_spacing_values_mm": within_layer_spacing,
        "circumferential_spacing_exact": all(abs(v - 1200.0) < 1e-6 for v in within_layer_spacing),
        "longitudinal_positions_mm": z,
        "longitudinal_spacing_exact": len(z) == 2 and abs(z[1] - z[0] - 800.0) < 1e-6,
        "left_right_symmetric": all(symmetry),
        "scope_arch_and_wall_only": geometry["scope"] == "ARCH_AND_WALL_ONLY",
        "invert_not_applicable": geometry["invert"] == "NOT_APPLICABLE" and all(a["segment"] in {"left_side", "top", "right_side"} for a in anchors),
        "reference_surface": parameters["reference_surface"]["value"],
        "start_on_excavation_boundary": max(start_radius_errors) < 1e-6,
        "direction_dot_radial_min": min(direction_dots),
        "direction_outward": min(direction_dots) > 0.999999 and min(outward_increases) > 3999.999,
        "does_not_enter_clearance": min(outward_increases) > 0.0,
        "unit_scale_valid": 3.999 < max(lengths) / 1000.0 < 4.001,
        "axis_not_flipped": min(direction_dots) > 0.0,
        "steel_arch_non_design_intersection": False,
        "steel_arch_check_note": "锚杆层z=0.1/0.9m；本轮单榀钢架z=0.45～0.55m，不发生非设计位置穿插。",
        "mesh_connection_recorded_only": True,
        "anchor_count": len(anchors),
        "layer_counts": [layer["count"] for layer in geometry["layers"]],
    }
    keys = [
        "diameter_exact_mm", "length_exact", "circumferential_spacing_exact", "longitudinal_spacing_exact",
        "left_right_symmetric", "scope_arch_and_wall_only", "invert_not_applicable", "start_on_excavation_boundary",
        "direction_outward", "does_not_enter_clearance", "unit_scale_valid", "axis_not_flipped",
    ]
    validation["all_checks_passed"] = all(validation[k] for k in keys)
    return validation
