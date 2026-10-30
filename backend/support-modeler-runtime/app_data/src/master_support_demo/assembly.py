"""复用现有装配结果，生成总控 Demo 状态、元数据和正式坐标 GLB。"""
from __future__ import annotations
import hashlib
import json
import shutil
from pathlib import Path
from typing import Any

from lock_foot_anchor.assembly import build_lock_foot_assembly
from primary_support_1m.gltf import inspect_glb


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build_master_demo(root: Path) -> dict[str, Any]:
    out = root / "outputs/master_demo"; out.mkdir(parents=True, exist_ok=True)
    protected = [
        root / "outputs/lock_foot_anchor/ZZ-Va_lock_foot_anchor_parameters.json",
        root / "outputs/system_anchor/ZZ-Va_system_anchor_state.json",
        root / "outputs/secondary_rebar_assembly/ZZ-Va_secondary_rebar_assembly_state.json",
        root / "outputs/I20a_validation/ZZ-Va_I20a_steel_arch.glb",
    ]
    before = {str(p.relative_to(root)): _sha(p) for p in protected}
    # 统一输出始终由现有构件模块重新装配，不从网页展示坐标反推。
    assembly = build_lock_foot_assembly(root)
    source = root / "outputs/section_assembly/ZZ-Va_section_1m_with_lock_foot.glb"
    target = out / "ZZ-Va_support_1m_current.glb"
    shutil.copy2(source, target)
    glb = inspect_glb(target)
    secondary = json.loads((root / "outputs/secondary_rebar_assembly/ZZ-Va_secondary_rebar_assembly_state.json").read_text(encoding="utf-8"))
    component_counts = {
        "primary_support_concrete": 1,
        "primary_support_mesh": 2,
        "steel_arch_I20a": 2,
        "system_anchor": 43,
        "lock_foot_anchor": 16,
        "secondary_lining": 1,
        "N1": 1,
        "N2": 1,
        "N3": secondary["validation"]["N3_count"],
        "N4": secondary["validation"]["N4_count"],
    }
    confirmed = {
        "primary_support_thickness_mm": 260, "primary_mesh": "Φ8 @200×200", "steel_profile": "I20a",
        "steel_arch_spacing_mm": 800, "system_anchor": {"diameter_mm": 25, "length_mm": 4000, "spacing_mm": [1200, 800]},
        "lock_foot": {"outer_diameter_mm": 42, "wall_thickness_mm": 4, "length_mm": 3500, "count_per_arch": 8},
    }
    provisional = {
        "primary_mesh_connection_side": "ROCK_SIDE",
        "lock_foot": {k: v["value"] for k, v in assembly["parameters"]["provisional"].items()},
    }
    pending = {
        "primary_mesh_connection_side_project_confirmation": "PENDING",
        "lock_foot_project_geometry_confirmation": "PENDING",
    }
    metadata = {
        "support_type": "ZZ-Va", "length_m": 1.0,
        "component_list": list(component_counts), "component_count": component_counts,
        "mesh_object_count": glb["mesh_count"], "confirmed_parameters": confirmed,
        "provisional_parameters": provisional, "pending_parameters": pending,
        "coordinate_system": "x transverse, y vertical, z longitudinal", "engineering_unit": "mm", "three_js_unit": "m",
        "export_coordinate_state": "FORMAL_ASSEMBLY_COORDINATES", "exploded_view_applied": False,
    }
    statuses = {
        "INNER_PROFILE": "IMPLEMENTED", "PRIMARY_CONCRETE": "IMPLEMENTED",
        "PRIMARY_MESH": "PARTIAL", "PRIMARY_MESH_REASON": "connection_side provisional",
        "STEEL_ARCH": "IMPLEMENTED", "SYSTEM_ANCHOR": "IMPLEMENTED",
        "LOCK_FOOT": "PROVISIONAL_IMPLEMENTED", "SECONDARY_LINING": "IMPLEMENTED",
        "SECONDARY_REBAR": "IMPLEMENTED",
    }
    after = {str(p.relative_to(root)): _sha(p) for p in protected}
    state = {
        "status": "MASTER_SUPPORT_DEMO_V1_IMPLEMENTED",
        "support_type": "ZZ-Va", "length_m": 1.0, "statuses": statuses,
        "component_counts": component_counts, "object_tree": {
            "ZZVaSectionAssemblyGroup": {
                "primarySupportGroup": ["primarySupportConcreteGroup", "primarySupportMeshGroup", "steelArchArrayGroup", "systemAnchorGroup", "lockFootAnchorGroup"],
                "secondarySystemGroup": {"secondaryLiningGroup": [], "secondaryRebarGroup": ["N1Group", "N2Group", "N3Group", "N4Group"]},
            }
        },
        "glb": glb, "metadata_path": str(out / "ZZ-Va_support_1m_current_metadata.json"),
        "protected_sources_unchanged": before == after,
        "reuse": ["primary_support_1m", "system_anchor", "lock_foot_anchor", "secondary_lining", "secondary_rebar_assembly"],
    }
    (out / "ZZ-Va_support_1m_current_metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    (out / "ZZ-Va_support_master_state.json").write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"state": state, "metadata": metadata, "assembly": assembly}
