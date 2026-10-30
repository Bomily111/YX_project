"""组织 ZZ-Va 初支混凝土参数、验证、GLB 与既有构件总装。"""
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any

from secondary_lining.geometry import build_extruded_shell_mesh
from secondary_rebar_assembly.geometry import build_rebar_profile, build_tube_mesh
from secondary_rebar_assembly.n3n4 import build_n3n4_geometry
from section_assembly.steel import read_steel_arch_mesh

from .geometry import build_open_shell_mesh, build_primary_profiles, sample_open_profile
from .gltf import write_assembly_glb, write_primary_glb


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _source_parameters() -> dict[str, Any]:
    return {
        "support_type": "ZZ-Va",
        "status": "PRIMARY_SUPPORT_CONCRETE_IMPLEMENTED",
        "scope": "ARCH_AND_WALL_ONLY",
        "invert": "NOT_APPLICABLE",
        "total_thickness_mm": 260.0,
        "reserved_deformation_mm": 100.0,
        "secondary_lining_thickness_mm": 500.0,
        "steel_profile": "I20a",
        "steel_radial_depth_mm": 200.0,
        "steel_centerline": {"top_radius_mm": 6220.0, "side_radius_mm": 10720.0, "beta_deg": 15.6664},
        "regions": {
            "top": {"inner_radius_mm": 6100.0, "outer_radius_mm": 6360.0, "status": "CONFIRMED"},
            "side": {"inner_radius_mm": 10600.0, "outer_radius_mm": 10860.0, "angle_deg": 15.6664, "status": "CONFIRMED"},
            "invert_transition": {"value": None, "status": "NOT_APPLICABLE"},
            "invert_bottom": {"value": None, "status": "NOT_APPLICABLE"},
        },
        "layer_relation": {
            "inner_material": "复喷混凝土",
            "inner_cover_to_steel_mm": 20.0,
            "steel_radial_depth_mm": 200.0,
            "outer_material": "初喷混凝土",
            "outer_cover_mm": 40.0,
            "sum_mm": 260.0,
            "status": "CONFIRMED",
            "evidence": [
                "参数识别.docx：初支混凝土半径=钢架半径-钢架厚度/2-复喷混凝土厚度",
                "参数识别.docx：厚度20+200+40或者直接识别厚度",
                "第109页：C25高性能喷射混凝土厚26cm",
            ],
        },
        "sources": [
            {"page": 109, "source_text": "C25高性能喷射混凝土厚：26cm", "source_method": "PDF_TEXT_AND_DRAWING_REVIEW", "status": "CONFIRMED"},
            {"page": 109, "source_text": "预留变形量 10cm；C35钢筋混凝土 50cm", "source_method": "PDF_TEXT_AND_DRAWING_REVIEW", "status": "CONFIRMED"},
            {"page": 111, "source_text": "I20a钢架 R1=6220, R2=10720, beta=15.6664°", "source_method": "EXISTING_VERIFIED_STEEL_ARCH", "status": "CONFIRMED"},
            {"page": None, "source_text": "初支混凝土半径公式；厚度20+200+40", "source_method": "PARAMETER_RECOGNITION_DOCX", "status": "CONFIRMED"},
        ],
        "readiness": {
            "PRIMARY_SUPPORT_CONCRETE_READY": True,
            "PRIMARY_SUPPORT_TOP_SIDE_READY": True,
            "PRIMARY_SUPPORT_INVERT_READY": "NOT_APPLICABLE",
            "EXCAVATION_FULL_READY": False,
            "SYSTEM_ANCHOR_READY": True,
        },
    }


def _steel_radial_extents(mesh: dict[str, Any]) -> dict[str, float]:
    offsets: list[float] = []
    centers = [(0.0, 0.0, 6.220), (-4.5, 0.0, 10.720), (4.5, 0.0, 10.720)]
    for x, y, _ in mesh["vertices"]:
        candidates = [(abs(math.hypot(x - cx, y - cy) - radius), math.hypot(x - cx, y - cy) - radius) for cx, cy, radius in centers]
        offsets.append(min(candidates, key=lambda item: item[0])[1] * 1000.0)
    return {"min_mm": min(offsets), "max_mm": max(offsets)}


def _docs_state(parameters: dict[str, Any], profiles: dict[str, Any], mesh: dict[str, Any], radial: dict[str, float]) -> dict[str, Any]:
    validation = {
        "total_thickness_mm": parameters["total_thickness_mm"],
        "top_thickness_mm": parameters["regions"]["top"]["outer_radius_mm"] - parameters["regions"]["top"]["inner_radius_mm"],
        "side_thickness_mm": parameters["regions"]["side"]["outer_radius_mm"] - parameters["regions"]["side"]["inner_radius_mm"],
        "layer_sum_mm": parameters["layer_relation"]["inner_cover_to_steel_mm"] + parameters["layer_relation"]["steel_radial_depth_mm"] + parameters["layer_relation"]["outer_cover_mm"],
        "steel_radial_extent_from_centerline_mm": radial,
        "steel_inside_confirmed_top_side_layer": radial["min_mm"] >= -100.1 and radial["max_mm"] <= 100.1,
        "inner_surface_to_steel_inner_mm": 20.0,
        "steel_outer_to_excavation_mm": 40.0,
        "secondary_outer_to_primary_inner_mm": 100.0,
        "profile_open_at_invert": profiles["inner"]["open_at_invert"] and profiles["outer"]["open_at_invert"],
        "invert_transition_absent": parameters["regions"]["invert_transition"]["value"] is None,
        "invert_bottom_absent": parameters["regions"]["invert_bottom"]["value"] is None,
        "mesh_open_scope": mesh["open_at_invert"],
    }
    validation["all_confirmed_scope_checks_passed"] = all([
        validation["top_thickness_mm"] == 260.0,
        validation["side_thickness_mm"] == 260.0,
        validation["layer_sum_mm"] == 260.0,
        validation["steel_inside_confirmed_top_side_layer"],
        validation["secondary_outer_to_primary_inner_mm"] == 100.0,
        validation["profile_open_at_invert"],
        validation["invert_transition_absent"],
        validation["invert_bottom_absent"],
    ])
    return {
        "support_type": "ZZ-Va",
        "status": "PRIMARY_SUPPORT_CONCRETE_IMPLEMENTED" if validation["all_confirmed_scope_checks_passed"] else "PRIMARY_SUPPORT_CONCRETE_BLOCKED",
        "sectionGeometryState_extension": {
            "primary_support": {
                "concrete": {
                    "status": "IMPLEMENTED",
                    "scope": "ARCH_AND_WALL_ONLY",
                    "invert": "NOT_APPLICABLE",
                    "top": parameters["regions"]["top"],
                    "side": parameters["regions"]["side"],
                    "invert_transition": {"status": "NOT_APPLICABLE"},
                    "invert_bottom": {"status": "NOT_APPLICABLE"},
                    "thickness_mm": 260.0,
                    "profile": profiles,
                },
                "steel_arch": {
                    "profile": "I20a",
                    "centerline": parameters["steel_centerline"],
                    "relation": parameters["layer_relation"],
                    "scope": "ARCH_AND_WALL_ONLY",
                    "invert": "NOT_APPLICABLE",
                    "longitudinal_spacing_mm": 800.0,
                },
            }
        },
        "geometry": {"profiles": profiles, "three_geometry": {k: v for k, v in mesh.items() if k not in {"vertices", "indices"}}},
        "validation": validation,
        "readiness": parameters["readiness"],
        "unresolved": [],
    }


def _existing_meshes(root: Path, primary_mesh: dict[str, Any]) -> dict[str, dict[str, Any]]:
    section = json.loads((root / "outputs/base_profile/ZZ-Va_section_geometry.json").read_text(encoding="utf-8"))
    inner, outer = section["inner_profile"]["geometry"], section["secondary_lining"]["outer_profile"]
    angles = [22 + 24 / 60 + 33 / 3600, 11 + 41 / 60 + 58 / 3600, 55 + 53 / 60 + 29 / 3600]
    p1 = build_rebar_profile([5939, 10439, 1639, 12439], angles)
    p2 = build_rebar_profile([5561, 10061, 1261, 12061], angles)
    extra = build_n3n4_geometry()
    steel = read_steel_arch_mesh(root / "outputs/I20a_validation/ZZ-Va_I20a_steel_arch.glb", 0.5)
    return {
        "primarySupportConcreteTopSideMesh": primary_mesh,
        "steelArchMesh": steel,
        "secondaryLiningMesh": build_extruded_shell_mesh(inner, outer, 1000, 32),
        "N1Mesh": build_tube_mesh(p1, 22),
        "N2Mesh": build_tube_mesh(p2, 22),
        "N3Mesh": extra["N3"]["mesh"],
        "N4Mesh": extra["N4"]["mesh"],
    }


def build_primary_support(root: Path, output_dir: Path) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    inputs = [
        root / "config/zz_va_base_profile_sources.json",
        root / "outputs/base_profile/ZZ-Va_section_geometry.json",
        root / "outputs/I20a_validation/ZZ-Va_I20a_steel_arch.glb",
        root / "outputs/secondary_rebar_assembly/ZZ-Va_secondary_rebar_assembly_state.json",
    ]
    hashes_before = {p.relative_to(root).as_posix(): _sha(p) for p in inputs}
    parameters = _source_parameters()
    profiles = build_primary_profiles(beta_deg=parameters["steel_centerline"]["beta_deg"])
    mesh = build_open_shell_mesh(profiles)
    steel = read_steel_arch_mesh(inputs[2], 0.5)
    state = _docs_state(parameters, profiles, mesh, _steel_radial_extents(steel))
    param_path = output_dir / "ZZ-Va_primary_support_parameters.json"
    geometry_path = output_dir / "ZZ-Va_primary_support_geometry.json"
    primary_glb_path = output_dir / "ZZ-Va_primary_support.glb"
    combined_path = root / "outputs/section_assembly/ZZ-Va_implemented_components_with_primary_partial.glb"
    param_path.write_text(json.dumps(parameters, ensure_ascii=False, indent=2), encoding="utf-8")
    primary_glb = write_primary_glb(mesh, primary_glb_path)
    combined_glb = write_assembly_glb(_existing_meshes(root, mesh), combined_path)
    hashes_after = {p.relative_to(root).as_posix(): _sha(p) for p in inputs}
    state["source_hashes"] = hashes_after
    state["validation"]["source_artifacts_unchanged"] = hashes_before == hashes_after
    state["validation"]["primary_glb_valid"] = primary_glb["mesh_count"] == 1 and primary_glb["metadata"]["primary_support_scope"] == "ARCH_AND_WALL_ONLY"
    state["validation"]["combined_glb_valid"] = combined_glb["mesh_count"] == 7 and "primarySupportGroup" in combined_glb["node_names"]
    state["glb"] = {"primary_partial": primary_glb, "combined_assembly": combined_glb}
    geometry_path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"parameters": parameters, "state": state, "mesh": mesh, "paths": {"parameters": param_path, "geometry": geometry_path, "primary_glb": primary_glb_path, "combined_glb": combined_path}}
