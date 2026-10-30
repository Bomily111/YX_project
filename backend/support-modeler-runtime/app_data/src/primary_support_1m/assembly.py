"""构建1m初支短节及包含既有二衬系统的统一总装。"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from primary_support.geometry import build_open_shell_mesh, build_primary_profiles
from secondary_lining.geometry import build_extruded_shell_mesh
from secondary_rebar_assembly.geometry import build_rebar_profile, build_tube_mesh
from secondary_rebar_assembly.n3n4 import build_n3n4_geometry
from system_anchor.geometry import build_system_anchor_geometry

from .geometry import build_primary_support_1m_geometry
from .gltf import build_nodes, write_glb
from .validation import validate_primary_support_1m


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _secondary_meshes(root: Path) -> dict[str, dict[str, Any]]:
    section = json.loads((root / "outputs/base_profile/ZZ-Va_section_geometry.json").read_text(encoding="utf-8"))
    angles = [22 + 24 / 60 + 33 / 3600, 11 + 41 / 60 + 58 / 3600, 55 + 53 / 60 + 29 / 3600]
    extra = build_n3n4_geometry()
    return {
        "secondaryLining": build_extruded_shell_mesh(section["inner_profile"]["geometry"], section["secondary_lining"]["outer_profile"], 1000, 32),
        "N1": build_tube_mesh(build_rebar_profile([5939, 10439, 1639, 12439], angles), 22),
        "N2": build_tube_mesh(build_rebar_profile([5561, 10061, 1261, 12061], angles), 22),
        "N3": extra["N3"]["mesh"], "N4": extra["N4"]["mesh"],
    }


def build_primary_support_1m(root: Path, output_dir: Path) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    protected = [
        root / "outputs/I20a_validation/ZZ-Va_I20a_steel_arch.glb",
        root / "outputs/system_anchor/ZZ-Va_system_anchor_state.json",
        root / "outputs/base_profile/ZZ-Va_section_geometry.json",
        root / "outputs/secondary_rebar_assembly/ZZ-Va_secondary_rebar_assembly_state.json",
    ]
    before = {p.relative_to(root).as_posix(): _sha(p) for p in protected}
    geometry = build_primary_support_1m_geometry(root, "ROCK_SIDE")
    anchors = build_system_anchor_geometry()
    validation = validate_primary_support_1m(geometry, anchors)
    primary_meshes: dict[str, dict[str, Any]] = {
        "primarySupportConcrete": build_open_shell_mesh(build_primary_profiles()),
        "primaryMeshCircumferentialBars": geometry["primary_mesh"]["circumferential"]["mesh"],
        "primaryMeshLongitudinalBars": geometry["primary_mesh"]["longitudinal"]["mesh"],
        **geometry["steel_arch_array"]["meshes"], **anchors["meshes"],
    }
    metadata = {
        "support_type": "ZZ-Va", "length_m": 1.0, "steel_arch_spacing_mm": 800,
        "steel_arch_count": 2, "mesh_arch_connection_side": "ROCK_SIDE",
        "mesh_arch_connection_side_status": "PROVISIONAL", "anchor_spacing_longitudinal_mm": 800,
        "scope": "ARCH_AND_WALL_PRIMARY_SUPPORT", "same_longitudinal_pitch": "CONFIRMED",
        "phase_alignment": "DEMO_ASSUMPTION", "status": "PRIMARY_SUPPORT_1M_ASSEMBLY_IMPLEMENTED",
    }
    primary_path = output_dir / "ZZ-Va_primary_support_1m.glb"
    section_path = root / "outputs/section_assembly/ZZ-Va_section_1m.glb"
    primary_glb = write_glb(primary_meshes, build_nodes(list(primary_meshes), False), metadata, primary_path)
    section_meshes = {**primary_meshes, **_secondary_meshes(root)}
    section_glb = write_glb(section_meshes, build_nodes(list(section_meshes), True), {**metadata, "assembly": "ZZVaSectionAssemblyGroup", "secondary_system_reused": True}, section_path)
    after = {p.relative_to(root).as_posix(): _sha(p) for p in protected}
    validation.update({
        "protected_sources_unchanged": before == after,
        "primary_glb_valid": primary_glb["mesh_count"] == 48 and {"steelArch_001", "steelArch_002", "systemAnchorGroup"} <= set(primary_glb["node_names"]),
        "section_glb_valid": section_glb["mesh_count"] == 53 and {"secondaryLining", "N1", "N2", "N3", "N4"} <= set(section_glb["node_names"]),
    })
    implemented = validation["all_checks_passed"] and validation["protected_sources_unchanged"] and validation["primary_glb_valid"] and validation["section_glb_valid"]
    relation = {**geometry["relation"], "status": "PRIMARY_MESH_STEEL_RELATION_PROVISIONAL", "formula_inputs": {"steel_radial_height_mm": 200, "mesh_diameter_mm": 8}, "mesh_centerline": geometry["mesh_centerline"], "connection_reports": geometry["connection_reports"]}
    layout = geometry["steel_arch_array"]["parameters"] | {"final_status": "STEEL_ARCH_LONGITUDINAL_LAYOUT_IMPLEMENTED", "reuse_method": geometry["steel_arch_array"]["reuse_method"], "same_pitch_as_system_anchor": "CONFIRMED", "phase_alignment": "DEMO_ASSUMPTION"}
    state = {
        "support_type": "ZZ-Va", "status": "PRIMARY_SUPPORT_1M_ASSEMBLY_IMPLEMENTED" if implemented else "PRIMARY_SUPPORT_1M_ASSEMBLY_BLOCKED",
        "primary_support_mesh": {"status": "PRIMARY_SUPPORT_MESH_PARTIAL", "reason": "LOCAL_STEEL_ARCH_CONNECTION_SIDE_PROVISIONAL", "invert": "NOT_APPLICABLE"},
        "mesh_steel_relation": relation, "steel_arch_layout": layout,
        "geometry": {"length_mm": 1000, "steel_arch_positions_mm": [100, 900], "steel_arch_count": 2, "system_anchor_count": anchors["count"], "system_anchor_layers_mm": [100, 900], "mesh_profile": geometry["mesh_centerline"]},
        "validation": validation, "source_hashes": after, "glb": {"primary_support_1m": primary_glb, "section_1m": section_glb},
    }
    paths = {
        "relation": output_dir / "ZZ-Va_primary_mesh_steel_relation.json",
        "layout": output_dir / "ZZ-Va_steel_arch_layout.json",
        "state": output_dir / "ZZ-Va_primary_support_1m_state.json",
        "primary_glb": primary_path, "section_glb": section_path,
    }
    paths["relation"].write_text(json.dumps(relation, ensure_ascii=False, indent=2), encoding="utf-8")
    paths["layout"].write_text(json.dumps(layout, ensure_ascii=False, indent=2), encoding="utf-8")
    paths["state"].write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"state": state, "geometry": geometry, "anchors": anchors, "paths": paths}
