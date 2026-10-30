"""组织系统锚杆参数、几何、验证、GLB和统一总装。"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from primary_mesh.geometry import build_primary_mesh_geometry
from primary_support.geometry import build_open_shell_mesh, build_primary_profiles
from primary_support.status import build_primary_support_status_v2
from secondary_lining.geometry import build_extruded_shell_mesh
from secondary_rebar_assembly.geometry import build_rebar_profile, build_tube_mesh
from secondary_rebar_assembly.n3n4 import build_n3n4_geometry
from section_assembly.steel import read_steel_arch_mesh

from .adapter import build_system_anchor_parameters
from .geometry import build_system_anchor_geometry
from .gltf import write_assembly_glb, write_system_anchor_glb
from .validation import validate_system_anchor


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _base_meshes(root: Path) -> dict[str, dict[str, Any]]:
    section = json.loads((root / "outputs/base_profile/ZZ-Va_section_geometry.json").read_text(encoding="utf-8"))
    inner = section["inner_profile"]["geometry"]
    outer = section["secondary_lining"]["outer_profile"]
    angles = [22 + 24 / 60 + 33 / 3600, 11 + 41 / 60 + 58 / 3600, 55 + 53 / 60 + 29 / 3600]
    p1 = build_rebar_profile([5939, 10439, 1639, 12439], angles)
    p2 = build_rebar_profile([5561, 10061, 1261, 12061], angles)
    extra = build_n3n4_geometry()
    mesh = build_primary_mesh_geometry()
    return {
        "primarySupportConcreteArchWallMesh": build_open_shell_mesh(build_primary_profiles()),
        "primaryMeshCircumferentialBarsMesh": mesh["circumferential"]["mesh"],
        "primaryMeshLongitudinalBarsMesh": mesh["longitudinal"]["mesh"],
        "steelArchMesh": read_steel_arch_mesh(root / "outputs/I20a_validation/ZZ-Va_I20a_steel_arch.glb", 0.5),
        "secondaryLiningMesh": build_extruded_shell_mesh(inner, outer, 1000, 32),
        "N1Mesh": build_tube_mesh(p1, 22), "N2Mesh": build_tube_mesh(p2, 22),
        "N3Mesh": extra["N3"]["mesh"], "N4Mesh": extra["N4"]["mesh"],
    }


def build_system_anchor(root: Path, output_dir: Path) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    protected = [
        root / "outputs/base_profile/ZZ-Va_section_geometry.json",
        root / "outputs/I20a_validation/ZZ-Va_I20a_steel_arch.glb",
        root / "outputs/secondary_lining/ZZ-Va_secondary_lining_geometry.json",
        root / "outputs/secondary_rebar_assembly/ZZ-Va_secondary_rebar_assembly_state.json",
    ]
    before = {p.relative_to(root).as_posix(): _sha(p) for p in protected}
    primary_state = build_primary_support_status_v2(root / "outputs/primary_support/ZZ-Va_primary_support_status_v2.json")
    parameters_obj = build_system_anchor_parameters()
    parameters = parameters_obj.to_dict()
    geometry = build_system_anchor_geometry()
    validation = validate_system_anchor(parameters, geometry)
    metadata = {
        "support_type": "ZZ-Va",
        "type": parameters["type"]["value"],
        "diameter_mm": parameters["diameter_mm"]["value"],
        "length_mm": parameters["length_mm"]["value"],
        "circumferential_spacing_mm": parameters["circumferential_spacing_mm"]["value"],
        "longitudinal_spacing_mm": parameters["longitudinal_spacing_mm"]["value"],
        "scope": "ARCH_AND_WALL_ONLY",
        "invert": "NOT_APPLICABLE",
        "count": geometry["count"],
        "direction_rule": parameters["direction_rule"]["value"],
        "status": "SYSTEM_ANCHOR_IMPLEMENTED" if validation["all_checks_passed"] else "SYSTEM_ANCHOR_BLOCKED",
    }
    param_path = output_dir / "ZZ-Va_system_anchor_parameters.json"
    geometry_path = output_dir / "ZZ-Va_system_anchor_geometry.json"
    state_path = output_dir / "ZZ-Va_system_anchor_state.json"
    anchor_glb_path = output_dir / "ZZ-Va_system_anchor.glb"
    assembly_path = root / "outputs/section_assembly/ZZ-Va_with_system_anchor.glb"
    param_path.write_text(json.dumps(parameters, ensure_ascii=False, indent=2), encoding="utf-8")
    geometry_export = {k: v for k, v in geometry.items() if k != "meshes"}
    geometry_path.write_text(json.dumps(geometry_export, ensure_ascii=False, indent=2), encoding="utf-8")
    anchor_glb = write_system_anchor_glb(geometry["meshes"], metadata, anchor_glb_path)
    assembly_metadata = {**metadata, "assembly_status": "IMPLEMENTED_COMPONENTS_WITH_SYSTEM_ANCHOR", "contains": ["primary_support_concrete", "primary_support_mesh", "steel_arch", "system_anchor", "secondary_lining", "N1", "N2", "N3", "N4"], "primary_mesh_status": "PRIMARY_SUPPORT_MESH_PARTIAL", "primary_mesh_unresolved": "LOCAL_STEEL_ARCH_CONNECTION_UNRESOLVED"}
    assembly_glb = write_assembly_glb(_base_meshes(root), geometry["meshes"], assembly_metadata, assembly_path)
    after = {p.relative_to(root).as_posix(): _sha(p) for p in protected}
    validation["protected_sources_unchanged"] = before == after
    validation["anchor_glb_valid"] = anchor_glb["mesh_count"] == geometry["count"] and "SystemAnchorGroup" in anchor_glb["node_names"]
    validation["assembly_glb_valid"] = assembly_glb["mesh_count"] == geometry["count"] + 9 and {"ZZVaSectionAssemblyGroup", "primarySupportGroup", "systemAnchorGroup", "secondarySystemGroup"} <= set(assembly_glb["node_names"])
    readiness = {
        "SYSTEM_ANCHOR_PARAMETERS_READY": True,
        "SYSTEM_ANCHOR_GEOMETRY_READY": True,
        "SYSTEM_ANCHOR_LAYOUT_READY": True,
    }
    complete = validation["all_checks_passed"] and validation["protected_sources_unchanged"] and validation["anchor_glb_valid"] and validation["assembly_glb_valid"]
    state = {
        "support_type": "ZZ-Va",
        "status": "SYSTEM_ANCHOR_IMPLEMENTED" if complete else "SYSTEM_ANCHOR_BLOCKED",
        "readiness": readiness,
        "parameters": parameters,
        "geometry": {"count": geometry["count"], "layer_counts": [x["count"] for x in geometry["layers"]], "longitudinal_positions_mm": [x["z_mm"] for x in geometry["layers"]], "profile_length_mm": geometry["profile_length_mm"], "scope": geometry["scope"], "invert": geometry["invert"]},
        "validation": validation,
        "primary_support_status_v2": primary_state,
        "source_hashes": after,
        "glb": {"system_anchor": anchor_glb, "section_assembly": assembly_glb},
    }
    state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"parameters": parameters, "geometry": geometry, "state": state, "paths": {"parameters": param_path, "geometry": geometry_path, "state": state_path, "anchor_glb": anchor_glb_path, "assembly_glb": assembly_path}}
