"""导出锁脚构件、含锁脚的1m初支和完整断面总装。"""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
from typing import Any

from primary_support.geometry import build_open_shell_mesh, build_primary_profiles
from primary_support_1m.assembly import _secondary_meshes
from primary_support_1m.geometry import build_primary_support_1m_geometry
from primary_support_1m.gltf import build_nodes, write_glb
from system_anchor.geometry import build_system_anchor_geometry
from .geometry import build_lock_foot_anchor_geometry
from .models import LockFootAnchorParameters
from .validation import validate_lock_foot_geometry


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _lock_nodes(names: list[str]) -> list[dict[str, Any]]:
    nodes: list[dict[str, Any]] = [{"name": "lockFootAnchorGroup", "children": [1, 10]}]
    for arch_index in (1, 2):
        group_index = len(nodes); nodes.append({"name": f"arch{arch_index:03d}_lockFootGroup", "children": []})
        for name in [n for n in names if f"_arch{arch_index:03d}_" in n]:
            nodes.append({"name": name, "mesh": names.index(name)})
            nodes[group_index]["children"].append(len(nodes) - 1)
    nodes[0]["children"] = [1, 10]
    return nodes


def build_lock_foot_assembly(root: Path, parameters: LockFootAnchorParameters | None = None) -> dict[str, Any]:
    p = parameters or LockFootAnchorParameters()
    out = root / "outputs/lock_foot_anchor"; out.mkdir(parents=True, exist_ok=True)
    protected = [
        root / "outputs/I20a_validation/ZZ-Va_I20a_steel_arch.glb",
        root / "outputs/system_anchor/ZZ-Va_system_anchor_state.json",
        root / "outputs/primary_mesh/ZZ-Va_primary_mesh_state.json",
        root / "outputs/secondary_rebar_assembly/ZZ-Va_secondary_rebar_assembly_state.json",
    ]
    protected = [x for x in protected if x.exists()]
    before = {str(x.relative_to(root)): _sha(x) for x in protected}
    lock = build_lock_foot_anchor_geometry(p); validation = validate_lock_foot_geometry(lock)
    base = build_primary_support_1m_geometry(root, "ROCK_SIDE"); system = build_system_anchor_geometry()
    primary_meshes = {
        "primarySupportConcrete": build_open_shell_mesh(build_primary_profiles()),
        "primaryMeshCircumferentialBars": base["primary_mesh"]["circumferential"]["mesh"],
        "primaryMeshLongitudinalBars": base["primary_mesh"]["longitudinal"]["mesh"],
        **base["steel_arch_array"]["meshes"], **system["meshes"], **lock["meshes"],
    }
    meta = {
        "component": "lock_foot_anchor", "support_type": "ZZ-Va", "geometry_status": "PROVISIONAL",
        "geometry_representation": "SOLID_VISUAL_APPROXIMATION",
        "confirmed": {"diameter_mm": 42, "wall_thickness_mm": 4, "length_mm": 3500, "count_per_arch": 8},
        "provisional": {"upper_height_mm": p.provisional.upper_install_height_mm, "lower_height_mm": p.provisional.lower_install_height_mm, "upper_angle_deg": p.provisional.upper_angle_deg, "lower_angle_deg": p.provisional.lower_angle_deg, "pair_spread_angle_deg": p.provisional.pair_spread_angle_deg},
    }
    lock_glb = write_glb(lock["meshes"], _lock_nodes(list(lock["meshes"])), meta, out / "ZZ-Va_lock_foot_anchor_provisional.glb")
    primary_glb = write_glb(primary_meshes, build_nodes(list(primary_meshes), False), {**meta, "assembly": "ZZVaPrimarySupport1mGroup"}, root / "outputs/primary_support/ZZ-Va_primary_support_1m_with_lock_foot.glb")
    total_meshes = {**primary_meshes, **_secondary_meshes(root)}
    total_glb = write_glb(total_meshes, build_nodes(list(total_meshes), True), {**meta, "assembly": "ZZVaSectionAssemblyGroup"}, root / "outputs/section_assembly/ZZ-Va_section_1m_with_lock_foot.glb")
    after = {str(x.relative_to(root)): _sha(x) for x in protected}
    validation["protected_sources_unchanged"] = before == after
    validation["independent_groups"] = "systemAnchorGroup" in primary_glb["node_names"] and "lockFootAnchorGroup" in primary_glb["node_names"]
    validation["primary_mesh_count"] = primary_glb["mesh_count"]
    validation["total_mesh_count"] = total_glb["mesh_count"]
    validation["all_checks_passed"] = validation["all_checks_passed"] and validation["protected_sources_unchanged"] and validation["independent_groups"]
    state = {
        "support_type": "ZZ-Va", "status": "LOCK_FOOT_ANCHOR_PROVISIONAL_IMPLEMENTED" if validation["all_checks_passed"] else "LOCK_FOOT_ANCHOR_VALIDATION_FAILED",
        "LOCK_FOOT_CONFIRMED_PARAMETERS_READY": True, "LOCK_FOOT_PROJECT_GEOMETRY_CONFIRMED": False,
        "count": lock["count"], "geometry_representation": lock["geometry_representation"], "validation": validation,
        "glb": {"component": lock_glb, "primary_support_1m": primary_glb, "section_1m": total_glb},
    }
    (out / "ZZ-Va_lock_foot_anchor_parameters.json").write_text(json.dumps(p.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
    geometry_json = {k: v for k, v in lock.items() if k != "meshes"}
    (out / "ZZ-Va_lock_foot_anchor_geometry.json").write_text(json.dumps(geometry_json, ensure_ascii=False, indent=2), encoding="utf-8")
    (out / "ZZ-Va_lock_foot_anchor_state.json").write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"parameters": p.to_dict(), "geometry": lock, "state": state}
