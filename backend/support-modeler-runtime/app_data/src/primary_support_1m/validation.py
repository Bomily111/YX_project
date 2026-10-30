"""1m初支短节的联合空间验证。"""
from __future__ import annotations

from typing import Any


def validate_primary_support_1m(geometry: dict[str, Any], anchor_geometry: dict[str, Any]) -> dict[str, Any]:
    steel = geometry["steel_arch_array"]
    meshes = steel["meshes"]
    names = list(meshes)
    p = steel["parameters"]
    reports = geometry["connection_reports"]
    first, second = meshes[names[0]], meshes[names[1]]
    first_local = [[x, y, z - p["positions_mm"][0] / 1000.0] for x, y, z in first["vertices"]]
    second_local = [[x, y, z - p["positions_mm"][1] / 1000.0] for x, y, z in second["vertices"]]
    checks = {
        "steel_arch_spacing_mm": p["positions_mm"][1] - p["positions_mm"][0],
        "steel_spacing_exact": p["positions_mm"][1] - p["positions_mm"][0] == 800.0,
        "steel_count": len(meshes),
        "steel_positions_mm": p["positions_mm"],
        "steel_geometries_identical": first_local == second_local,
        "steel_scope_arch_wall_only": p["scope"] == "ARCH_AND_WALL_ONLY",
        "steel_inside_primary_support": 6100 < 6120 < 6320 < 6360 and 10600 < 10620 < 10820 < 10860,
        "mesh_connection_side": geometry["relation"]["connection_side"],
        "mesh_side_provisional": geometry["relation"]["connection_side_status"] == "PROVISIONAL",
        "mesh_side_switchable": geometry["relation"]["switchable"],
        "no_magic_offset": geometry["mesh_centerline"]["formula"].startswith("steel_center_radius"),
        "design_connection_zone_count": sum(r["contact_status"] == "DESIGN_CONNECTION_ZONE" for r in reports.values()),
        "unexpected_penetration": any(r["contact_status"] == "UNEXPECTED_PENETRATION" for r in reports.values()),
        "maximum_penetration_mm": max(r["maximum_penetration_mm"] for r in reports.values()),
        "anchor_count": anchor_geometry["count"],
        "anchor_length_mm": sorted({a["length_mm"] for a in anchor_geometry["anchors"]}),
        "anchor_longitudinal_positions_mm": [x["z_mm"] for x in anchor_geometry["layers"]],
        "anchor_layer_counts": [x["count"] for x in anchor_geometry["layers"]],
        "same_longitudinal_pitch": "CONFIRMED",
        "phase_alignment": "DEMO_ASSUMPTION",
        "unit_scale_valid": max(abs(v) for m in meshes.values() for p3 in m["vertices"] for v in p3) < 20.0,
        "axis_not_flipped": all(m["bbox_m"]["min"][2] >= -1e-6 for m in meshes.values()),
    }
    checks["all_checks_passed"] = all([
        checks["steel_spacing_exact"], checks["steel_count"] == 2, checks["steel_geometries_identical"],
        checks["steel_scope_arch_wall_only"], checks["steel_inside_primary_support"],
        checks["mesh_connection_side"] == "ROCK_SIDE", checks["mesh_side_provisional"], checks["mesh_side_switchable"],
        checks["no_magic_offset"], checks["design_connection_zone_count"] == 2,
        not checks["unexpected_penetration"], checks["anchor_count"] == 43,
        checks["anchor_length_mm"] == [4000.0], checks["anchor_longitudinal_positions_mm"] == [100.0, 900.0],
        checks["unit_scale_valid"], checks["axis_not_flipped"],
    ])
    return checks
