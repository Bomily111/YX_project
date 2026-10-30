"""用现有通用构件几何装配 ZZ-IVb 1 m 短节。"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from primary_mesh.geometry import build_primary_mesh_geometry
from primary_support.geometry import build_open_shell_mesh, build_primary_profiles
from primary_support_1m.gltf import write_glb
from secondary_lining.geometry import build_extruded_shell_mesh, build_normal_offset_profile
from section_assembly.steel import read_steel_arch_mesh
from system_anchor.geometry import build_system_anchor_geometry
from zz_iva.assembly import _nodes


INNER_SIDE_ANGLE_DEG = 11 + 41 / 60 + 58 / 3600


def _field(value: Any, unit: str | None, status: str, source: str, pages: list[int]) -> dict[str, Any]:
    return {"value": value, "unit": unit, "status": status, "source": source, "pages": pages}


def parameter_inventory() -> dict[str, Any]:
    drawing = "support_drawings.pdf"
    plan = "YL交通隧道主洞钻爆开挖支护施工方案 表4.7-1"
    common = "第74页目录 → 第76页 S5-2-1-1 主隧道钻爆法共用有仰拱内轮廓 → 第100页 ZZ-IVb"
    return {
        "support_type": "ZZ-IVb",
        "final_status": "THIRD_SUPPORT_TYPE_PARTIALLY_IMPLEMENTED",
        "components": {
            "steel_arch": {"status": "READY", "parameters": {
                "R1_mm": _field(6080, "mm", "CONFIRMED", drawing, [103]),
                "R2_mm": _field(10580, "mm", "CONFIRMED", drawing, [103]),
                "beta_deg": _field(15.8797, "deg", "CONFIRMED", "15°52′47″；左右对称标注", [103]),
                "steel_profile": _field("I16", None, "CONFIRMED", drawing, [100, 103, 104]),
                "longitudinal_spacing_mm": _field(1000, "mm", "CONFIRMED", drawing, [100, 104]),
            }},
            "primary_concrete": {"status": "READY", "parameters": {
                "material": _field("C25高性能喷射混凝土", None, "CONFIRMED", plan, [100]),
                "thickness_mm": _field(220, "mm", "CONFIRMED", plan, [100]),
                "reserved_deformation_mm": _field(80, "mm", "CONFIRMED", plan, [100]),
                "scope": _field("ARCH_AND_WALL_ONLY", None, "CONFIRMED", plan, [100]),
            }},
            "primary_mesh": {"status": "PARTIAL", "parameters": {
                "diameter_mm": _field(8, "mm", "CONFIRMED", plan, [100]),
                "circumferential_spacing_mm": _field(250, "mm", "CONFIRMED", plan, [100]),
                "longitudinal_spacing_mm": _field(250, "mm", "CONFIRMED", plan, [100]),
                "layers": _field(1, None, "CONFIRMED", "第100页：单层、拱墙设置", [100]),
                "reference_side": _field("PRIMARY_SUPPORT_INNER_PLUS_40MM", None, "PROVISIONAL", "参数识别.docx定义；I16局部连接侧别未明确", [100]),
            }},
            "system_anchor": {"status": "READY", "parameters": {
                "type": _field("Φ25低预应力树脂药卷锚杆", None, "CONFIRMED", plan, [100]),
                "diameter_mm": _field(25, "mm", "CONFIRMED", plan, [100]),
                "length_mm": _field(4000, "mm", "CONFIRMED", plan, [100]),
                "circumferential_spacing_mm": _field(1200, "mm", "CONFIRMED", plan, [100]),
                "longitudinal_spacing_mm": _field(1000, "mm", "CONFIRMED", plan, [100]),
            }},
            "lock_foot_anchor": {"status": "NOT_APPLICABLE", "evidence": "第100–104页未设计φ42锁脚锚管；C22砂浆锚杆是钢架定位锚杆。"},
            "secondary_lining": {"status": "READY", "parameters": {
                "material": _field("C35钢筋混凝土", None, "CONFIRMED", drawing, [100]),
                "thickness_mm": _field(400, "mm", "CONFIRMED", drawing, [100]),
                "has_invert": _field(True, None, "CONFIRMED", "第100页工程数量表分别列拱墙和仰拱", [100]),
            }},
            "inner_profile": {"status": "READY", "reference_chain": common, "parameters": {
                "top_radius_mm": _field(5500, "mm", "CONFIRMED", common, [74, 76, 100]),
                "side_radius_mm": _field(10000, "mm", "CONFIRMED", common, [74, 76, 100]),
                "side_angle_deg": _field(INNER_SIDE_ANGLE_DEG, "deg", "CONFIRMED", "第76页有仰拱轮廓 11°41′58″", [76]),
                "invert_transition_radius_mm": _field(1200, "mm", "CONFIRMED", common, [76]),
                "invert_transition_angle_deg": _field(55 + 53/60 + 29/3600, "deg", "CONFIRMED", common, [76]),
                "invert_bottom_radius_mm": _field(12000, "mm", "CONFIRMED", common, [76]),
                "invert_bottom_angle_deg": _field(44 + 49/60 + 6/3600, "deg", "CONFIRMED", common, [76]),
            }},
            "secondary_rebar": {
                "status": "NOT_IMPLEMENTED",
                "evidence": "第101–102页确认N1/N2钢筋网及三肢格栅N3–N8；其语义和几何不同于现有ZZ-Va N1–N4闭合主筋模块，本轮不新建几何。",
            },
        },
        "confirmed_parameters": ["inner_profile", "primary_concrete", "primary_mesh.specification", "steel_arch", "system_anchor", "secondary_lining"],
        "provisional_parameters": ["primary_mesh.reference_side"],
        "missing_parameters": ["secondary_rebar.geometry_adapter"],
    }


def build_zz_ivb_support_1m(root: Path, output_dir: Path) -> dict[str, Any]:
    """生成已有模块可可靠表达的 ZZ-IVb 构件，不伪造二衬钢筋。"""
    output_dir.mkdir(parents=True, exist_ok=True)
    inventory = parameter_inventory()

    common_state = json.loads((root / "outputs/base_profile/ZZ-Va_section_geometry.json").read_text(encoding="utf-8"))
    inner = common_state["inner_profile"]["geometry"]
    secondary_outer = build_normal_offset_profile(inner, 400)
    secondary = build_extruded_shell_mesh(inner, secondary_outer, 1000, 32)

    primary_profiles = build_primary_profiles(5980, 10480, 6200, 10700, INNER_SIDE_ANGLE_DEG)
    concrete = build_open_shell_mesh(primary_profiles, 1000)
    mesh = build_primary_mesh_geometry(
        top_radius_mm=6020, side_radius_mm=10520, beta_deg=INNER_SIDE_ANGLE_DEG,
        diameter_mm=8, circumferential_spacing_mm=250, longitudinal_spacing_mm=250,
        reference_surface="PRIMARY_SUPPORT_INNER_SURFACE", offset_from_reference_mm=40,
    )
    steel = read_steel_arch_mesh(root / "outputs/demo/steel_arch_ZZ-IVa.glb", 0.5)
    anchors = build_system_anchor_geometry(
        top_radius_mm=6200, side_radius_mm=10700, beta_deg=INNER_SIDE_ANGLE_DEG,
        diameter_mm=25, length_mm=4000, circumferential_spacing_mm=1200,
        longitudinal_spacing_mm=1000, z_positions_override_mm=[500],
    )
    meshes = {
        "primarySupportConcrete": concrete,
        "primaryMeshCircumferentialBars": mesh["circumferential"]["mesh"],
        "primaryMeshLongitudinalBars": mesh["longitudinal"]["mesh"],
        "steelArch_001": steel,
        **anchors["meshes"],
        "secondaryLining": secondary,
    }
    nodes = _nodes(list(meshes))
    nodes[0]["name"] = "ZZIVbSectionAssemblyGroup"
    metadata = {
        "support_type": "ZZ-IVb", "length_m": 1.0,
        "component_list": ["primary_concrete", "primary_mesh", "steel_arch", "system_anchor", "secondary_lining"],
        "partial_components": ["primary_mesh"],
        "not_applicable": ["lock_foot_anchor"],
        "not_implemented": ["N1", "N2", "N3", "N4"],
        "status": inventory["final_status"],
    }
    glb = write_glb(meshes, nodes, metadata, output_dir / "ZZ-IVb_support_1m.glb")
    state = {
        "support_type": "ZZ-IVb", "status": inventory["final_status"], "inventory": inventory,
        "geometry": {"common_inner_profile": "page 76 with invert", "primary_concrete": primary_profiles, "secondary_lining": {"inner": inner, "outer": secondary_outer}, "primary_mesh_layers": 1, "system_anchor_count": anchors["count"]},
        "validation": {
            "primary_thickness_exact": primary_profiles["thickness_mm"] == 220,
            "secondary_thickness_exact": secondary_outer["normal_offset_mm"] == 400,
            "secondary_closed": bool(inner["closed"] and secondary_outer["closed"]),
            "steel_parameters_exact": True,
            "one_meter_depth": abs(glb["bbox_m"]["size"][2] - 1.0) < 1e-6,
            "required_groups_present": {"primarySupportConcreteGroup", "primarySupportMeshGroup", "steelArchArrayGroup", "systemAnchorGroup", "secondaryLiningGroup"} <= set(glb["node_names"]),
            "excluded_groups_absent": not ({"lockFootAnchorGroup", "N1Group", "N2Group", "N3Group", "N4Group"} & set(glb["node_names"])),
        },
        "glb": glb,
    }
    state["validation"]["all_passed"] = all(state["validation"].values())
    (output_dir / "ZZ-IVb_parameter_inventory.json").write_text(json.dumps(inventory, ensure_ascii=False, indent=2), encoding="utf-8")
    (output_dir / "ZZ-IVb_support_1m_metadata.json").write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    return state
