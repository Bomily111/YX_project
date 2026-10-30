"""复用已验证构件，生成可切换网片关系和两榀钢架阵列。"""
from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from typing import Any

from primary_mesh.geometry import build_primary_mesh_geometry
from section_assembly.steel import read_steel_arch_mesh

from .models import PrimaryMeshSteelRelation, SteelArchLayoutParameters


STEEL_TOP_CENTER_RADIUS_MM = 6220.0
STEEL_SIDE_CENTER_RADIUS_MM = 10720.0
STEEL_RADIAL_HEIGHT_MM = 200.0
MESH_DIAMETER_MM = 8.0


def mesh_centerline_radii(connection_side: str) -> dict[str, float | str]:
    """由实体接触公式求网片中心线，不使用人工平移。"""
    if connection_side not in {"ROCK_SIDE", "INNER_SIDE", "KEEP_CURRENT"}:
        raise ValueError(f"不支持的 connection_side: {connection_side}")
    half_steel = STEEL_RADIAL_HEIGHT_MM / 2.0
    mesh_radius = MESH_DIAMETER_MM / 2.0
    if connection_side == "ROCK_SIDE":
        delta = half_steel + mesh_radius
    elif connection_side == "INNER_SIDE":
        delta = -(half_steel + mesh_radius)
    else:
        return {"top_radius_mm": 6140.0, "side_radius_mm": 10640.0, "formula": "KEEP_CURRENT_VERIFIED_CENTERLINE"}
    return {
        "top_radius_mm": STEEL_TOP_CENTER_RADIUS_MM + delta,
        "side_radius_mm": STEEL_SIDE_CENTER_RADIUS_MM + delta,
        "formula": "steel_center_radius + side_sign * (steel_radial_height/2 + mesh_diameter/2)",
    }


def clone_mesh_at_z(source: dict[str, Any], target_center_m: float) -> dict[str, Any]:
    """源单榀以 z=0 为中心读入后，仅沿隧道轴平移。"""
    result = deepcopy(source)
    result["vertices"] = [[x, y, z + target_center_m] for x, y, z in source["vertices"]]
    mins = [min(v[k] for v in result["vertices"]) for k in range(3)]
    maxs = [max(v[k] for v in result["vertices"]) for k in range(3)]
    result["bbox_m"] = {"min": mins, "max": maxs, "size": [maxs[k] - mins[k] for k in range(3)]}
    result["transform"] = {"axis_mapping": "identity", "translation_m": [0.0, 0.0, target_center_m]}
    return result


def build_steel_arch_array(source_glb: Path, layout: SteelArchLayoutParameters | None = None) -> dict[str, Any]:
    layout = layout or SteelArchLayoutParameters()
    validated_single = read_steel_arch_mesh(source_glb, 0.0)
    meshes = {
        f"steelArch_{i + 1:03d}": clone_mesh_at_z(validated_single, z / 1000.0)
        for i, z in enumerate(layout.positions_mm)
    }
    return {
        "status": "STEEL_ARCH_LONGITUDINAL_LAYOUT_IMPLEMENTED",
        "parameters": layout.to_dict(),
        "reuse_method": "validatedSingleSteelArch -> clone -> translate along z",
        "meshes": meshes,
    }


def relation_report(connection_side: str) -> dict[str, Any]:
    radii = mesh_centerline_radii(connection_side)
    half_steel = STEEL_RADIAL_HEIGHT_MM / 2.0
    bar_radius = MESH_DIAMETER_MM / 2.0
    if connection_side == "ROCK_SIDE":
        center_delta = radii["top_radius_mm"] - STEEL_TOP_CENTER_RADIUS_MM
    elif connection_side == "INNER_SIDE":
        center_delta = STEEL_TOP_CENTER_RADIUS_MM - radii["top_radius_mm"]
    else:
        center_delta = abs(radii["top_radius_mm"] - STEEL_TOP_CENTER_RADIUS_MM)
    surface_gap = center_delta - half_steel - bar_radius
    penetration = max(0.0, -surface_gap)
    return {
        "connection_side": connection_side,
        "mesh_centerline_radii": radii,
        "steel_centerline_radii_mm": {"top": STEEL_TOP_CENTER_RADIUS_MM, "side": STEEL_SIDE_CENTER_RADIUS_MM},
        "steel_radial_inner_edges_mm": {"top": 6120.0, "side": 10620.0},
        "steel_radial_outer_edges_mm": {"top": 6320.0, "side": 10820.0},
        "mesh_radius_mm": bar_radius,
        "minimum_entity_distance_mm": max(0.0, surface_gap),
        "contact_status": "DESIGN_CONNECTION_ZONE" if abs(surface_gap) < 1e-9 else "SEPARATED" if surface_gap > 0 else "UNEXPECTED_PENETRATION",
        "maximum_penetration_mm": penetration,
        "large_area_penetration": penetration > MESH_DIAMETER_MM,
        "calculation": "radial centerline separation - I20a radial half-height - mesh bar radius",
    }


def build_primary_support_1m_geometry(root: Path, connection_side: str = "ROCK_SIDE") -> dict[str, Any]:
    relation = PrimaryMeshSteelRelation(connection_side=connection_side)
    radii = mesh_centerline_radii(connection_side)
    mesh = build_primary_mesh_geometry(
        depth_mm=1000.0,
        top_radius_mm=float(radii["top_radius_mm"]),
        side_radius_mm=float(radii["side_radius_mm"]),
    )
    steel = build_steel_arch_array(root / "outputs/I20a_validation/ZZ-Va_I20a_steel_arch.glb")
    reports = {name: relation_report(connection_side) for name in steel["meshes"]}
    return {
        "status": "PRIMARY_SUPPORT_1M_GEOMETRY_READY",
        "relation": relation.to_dict(),
        "mesh_centerline": radii,
        "primary_mesh": mesh,
        "steel_arch_array": steel,
        "connection_reports": reports,
        "connection_zones_mm": [100.0, 900.0],
        "scope": "ARCH_AND_WALL_PRIMARY_SUPPORT",
        "invert": "NOT_APPLICABLE",
    }
