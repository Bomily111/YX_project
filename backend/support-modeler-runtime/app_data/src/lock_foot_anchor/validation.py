"""锁脚小导管布局与装配约束检查。"""
from __future__ import annotations
import math
from typing import Any


def validate_lock_foot_geometry(g: dict[str, Any]) -> dict[str, Any]:
    aa = g["anchors"]
    checks = {
        "count_16": len(aa) == 16,
        "count_8_per_arch": all(sum(a["steel_arch"] == s for a in aa) == 8 for s in ("steelArch_001", "steelArch_002")),
        "left_right_8_each": sum(a["side"] == "left" for a in aa) == sum(a["side"] == "right" for a in aa) == 8,
        "two_levels": {a["level"] for a in aa} == {"upper", "lower"},
        "two_pipes_per_level": all(sum(a["steel_arch"] == s and a["side"] == side and a["level"] == level for a in aa) == 2 for s in ("steelArch_001", "steelArch_002") for side in ("left", "right") for level in ("upper", "lower")),
        "diameter_42": all(a["outer_diameter_mm"] == 42 for a in aa),
        "length_3500": all(abs(math.dist(a["start_mm"], a["end_mm"]) - 3500) < 1e-6 for a in aa),
        "follows_arch_z": all(a["start_mm"][2] == a["arch_z_mm"] for a in aa),
        "rock_direction": all((a["end_mm"][0] - a["start_mm"][0]) * (-1 if a["side"] == "left" else 1) > 0 and a["end_mm"][1] < a["start_mm"][1] for a in aa),
        "local_profile_start": all(a["start_source"] == "STEEL_ARCH_LOCAL_PROFILE_DERIVED" for a in aa),
        "solid_approximation_declared": g["geometry_representation"] == "SOLID_VISUAL_APPROXIMATION",
    }
    return {"checks": checks, "all_checks_passed": all(checks.values())}
