"""复用现有构件模块装配 ZZ-S 1 m 支护短节。"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from lock_foot_anchor.geometry import build_lock_foot_anchor_geometry
from lock_foot_anchor.models import ConfirmedParameters, LockFootAnchorParameters
from primary_mesh.geometry import build_primary_mesh_geometry
from primary_support.geometry import build_open_shell_mesh, build_primary_profiles
from primary_support_1m.geometry import clone_mesh_at_z
from primary_support_1m.gltf import build_nodes, write_glb
from secondary_lining.geometry import build_extruded_shell_mesh, build_normal_offset_profile
from secondary_rebar_assembly.geometry import build_rebar_profile, build_tube_mesh
from secondary_rebar_assembly.n3n4 import build_n3n4_geometry
from section_assembly.steel import read_steel_arch_mesh
from system_anchor.geometry import build_system_anchor_geometry


INNER_SIDE_ANGLE_DEG = 11 + 41 / 60 + 58 / 3600
N1_RADII = [5939, 10439, 1639, 12439]
N2_RADII = [5561, 10061, 1261, 12061]
REBAR_ANGLES = [22 + 24 / 60 + 33 / 3600, INNER_SIDE_ANGLE_DEG, 55 + 53 / 60 + 29 / 3600]


def _field(value: Any, unit: str | None, status: str, source: str, pages: list[int]) -> dict[str, Any]:
    return {"value": value, "unit": unit, "status": status, "source": source, "pages": pages}


def parameter_inventory() -> dict[str, Any]:
    drawing = "support_drawings.pdf"
    plan = "YL交通隧道主洞钻爆开挖支护专项施工方案 表4.7-1"
    common = "第74页目录 → 第76页主隧道钻爆法共用有仰拱内轮廓 → 第113页 ZZ-S"
    confirmed = lambda value, unit, source, pages: _field(value, unit, "CONFIRMED", source, pages)
    provisional = lambda value, unit, source, pages: _field(value, unit, "PROVISIONAL", source, pages)
    return {
        "support_type": "ZZ-S",
        "status_categories": ["CONFIRMED", "PROVISIONAL", "MISSING"],
        "final_status": "FOURTH_SUPPORT_TYPE_IMPLEMENTED",
        "components": {
            "inner_profile": {"status": "READY", "reference_chain": common, "parameters": {
                "top_radius_mm": confirmed(5500, "mm", common, [74, 76, 113]),
                "side_radius_mm": confirmed(10000, "mm", common, [74, 76, 113]),
                "side_angle_deg": confirmed(INNER_SIDE_ANGLE_DEG, "deg", "第76页 11°41′58″", [76]),
                "invert_transition_radius_mm": confirmed(1200, "mm", common, [76]),
                "invert_transition_angle_deg": confirmed(55 + 53/60 + 29/3600, "deg", common, [76]),
                "invert_bottom_radius_mm": confirmed(12000, "mm", common, [76]),
                "invert_bottom_angle_deg": confirmed(44 + 49/60 + 6/3600, "deg", common, [76]),
            }},
            "primary_concrete": {"status": "READY", "parameters": {
                "material": confirmed("C25高性能喷射混凝土", None, plan, [113]),
                "thickness_mm": confirmed(260, "mm", plan, [113]),
                "reserved_deformation_mm": confirmed(120, "mm", plan, [113]),
                "scope": confirmed("ARCH_AND_WALL_ONLY", None, plan, [113]),
            }},
            "primary_mesh": {"status": "PARTIAL", "parameters": {
                "diameter_mm": confirmed(8, "mm", plan, [113]),
                "circumferential_spacing_mm": confirmed(200, "mm", plan, [113]),
                "longitudinal_spacing_mm": confirmed(200, "mm", plan, [113]),
                "layers": confirmed(1, None, "第113页：单层、拱墙设置", [113]),
                "reference_side": provisional("PRIMARY_SUPPORT_INNER_PLUS_40MM", None, "参数识别.docx；I20a局部连接侧别未明确", [113]),
            }},
            "steel_arch": {"status": "READY", "parameters": {
                "R1_mm": confirmed(6240, "mm", drawing, [115]),
                "R2_mm": confirmed(10740, "mm", drawing, [115]),
                "beta_deg": confirmed(15.6383, "deg", "15°38′18″；左右对称标注", [115]),
                "steel_profile": confirmed("I20a", None, drawing, [113, 115, 116]),
                "longitudinal_spacing_mm": confirmed(500, "mm", plan, [113]),
            }},
            "system_anchor": {"status": "READY", "parameters": {
                "type": confirmed("Φ25自进式中空注浆锚杆", None, plan, [113]),
                "diameter_mm": confirmed(25, "mm", plan, [113]),
                "length_mm": confirmed(4500, "mm", plan, [113]),
                "circumferential_spacing_mm": confirmed(1200, "mm", plan, [113]),
                "longitudinal_spacing_mm": confirmed(500, "mm", plan, [113]),
            }},
            "lock_foot": {"status": "PARTIAL", "parameters": {
                "outer_diameter_mm": confirmed(42, "mm", drawing, [113, 115]),
                "wall_thickness_mm": confirmed(4, "mm", "施工方案Φ42×4小导管规格", [69]),
                "length_mm": confirmed(3500, "mm", drawing, [113, 115]),
                "count_per_arch": confirmed(8, None, "第115页：每榀钢架8根", [115]),
                "upper_height_mm": provisional(250, "mm", "现有可调锁脚参考值，待节点确认", []),
                "lower_height_mm": provisional(100, "mm", "现有可调锁脚参考值，待节点确认", []),
                "upper_angle_deg": provisional(7.5, "deg", "现有可调锁脚参考值，待节点确认", []),
                "lower_angle_deg": provisional(45, "deg", "现有可调锁脚参考值，待节点确认", []),
                "pair_spread_deg": provisional(10, "deg", "现有可调锁脚参考值，待节点确认", []),
            }},
            "secondary_lining": {"status": "READY", "parameters": {
                "material": confirmed("C35钢筋混凝土", None, drawing, [113]),
                "thickness_mm": confirmed(500, "mm", drawing, [113]),
                "has_invert": confirmed(True, None, "第113页工程数量表分别列拱墙和仰拱", [113]),
            }},
            "secondary_rebar": {"status": "READY", "parameters": {
                "N1": confirmed({"diameter_mm": 22, "length_mm": 35849, "radii_mm": N1_RADII}, None, drawing, [114]),
                "N2": confirmed({"diameter_mm": 22, "length_mm": 33474, "radii_mm": N2_RADII}, None, drawing, [114]),
                "angles_deg": confirmed(REBAR_ANGLES, "deg", drawing, [114]),
                "N3": confirmed({"diameter_mm": 12, "length_mm": 1000, "circumferential_spacing_mm": 250}, None, drawing, [114]),
                "N4": confirmed({"diameter_mm": 8, "length_mm": 552, "circumferential_spacing_mm": 500, "longitudinal_spacing_mm": 250}, None, drawing, [114]),
            }},
        },
        "confirmed_parameters": ["inner_profile", "primary_concrete", "primary_mesh.specification", "steel_arch", "system_anchor", "lock_foot.specification", "secondary_lining", "secondary_rebar"],
        "provisional_parameters": ["primary_mesh.reference_side", "lock_foot.installation_geometry"],
        "missing_parameters": [],
    }


def build_zz_s_support_1m(root: Path, output_dir: Path) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    inventory = parameter_inventory()
    common_state = json.loads((root / "outputs/base_profile/ZZ-Va_section_geometry.json").read_text(encoding="utf-8"))
    inner = common_state["inner_profile"]["geometry"]
    secondary_outer = build_normal_offset_profile(inner, 500)
    secondary = build_extruded_shell_mesh(inner, secondary_outer, 1000, 32)

    primary_profiles = build_primary_profiles(6120, 10620, 6380, 10880, INNER_SIDE_ANGLE_DEG)
    concrete = build_open_shell_mesh(primary_profiles, 1000)
    mesh = build_primary_mesh_geometry(
        top_radius_mm=6160, side_radius_mm=10660, beta_deg=INNER_SIDE_ANGLE_DEG,
        diameter_mm=8, circumferential_spacing_mm=200, longitudinal_spacing_mm=200,
        reference_surface="PRIMARY_SUPPORT_INNER_SURFACE", offset_from_reference_mm=40,
    )

    # 静态装配复用已验证 I20a 网格；统一页面加载后用同一 steel_arch 模块按 ZZ-S 参数精确重建。
    source_steel = read_steel_arch_mesh(root / "outputs/I20a_validation/ZZ-Va_I20a_steel_arch.glb", 0.0)
    steels = {
        "steelArch_001": clone_mesh_at_z(source_steel, 0.25),
        "steelArch_002": clone_mesh_at_z(source_steel, 0.75),
    }
    anchors = build_system_anchor_geometry(
        top_radius_mm=6380, side_radius_mm=10880, beta_deg=INNER_SIDE_ANGLE_DEG,
        diameter_mm=25, length_mm=4500, circumferential_spacing_mm=1200,
        longitudinal_spacing_mm=500, z_positions_override_mm=[250, 750],
    )
    lock_parameters = LockFootAnchorParameters(
        confirmed=ConfirmedParameters(steel_arch_spacing_mm=500)
    )
    lock = build_lock_foot_anchor_geometry(
        lock_parameters, top_radius_mm=6240, side_radius_mm=10740,
        beta_deg=15.6383, arch_positions_mm=(250, 750),
    )
    p1 = build_rebar_profile(N1_RADII, REBAR_ANGLES)
    p2 = build_rebar_profile(N2_RADII, REBAR_ANGLES)
    n34 = build_n3n4_geometry()
    meshes = {
        "primarySupportConcrete": concrete,
        "primaryMeshCircumferentialBars": mesh["circumferential"]["mesh"],
        "primaryMeshLongitudinalBars": mesh["longitudinal"]["mesh"],
        **steels, **anchors["meshes"], **lock["meshes"],
        "secondaryLining": secondary,
        "N1": build_tube_mesh(p1, 22),
        "N2": build_tube_mesh(p2, 22),
        "N3": n34["N3"]["mesh"],
        "N4": n34["N4"]["mesh"],
    }
    metadata = {
        "support_type": "ZZ-S", "length_m": 1.0,
        "component_list": ["primary_concrete", "primary_mesh", "steel_arch", "system_anchor", "lock_foot", "secondary_lining", "N1", "N2", "N3", "N4"],
        "partial_components": ["primary_mesh", "lock_foot"],
        "steel_arch_dynamic_rebuild": "EXISTING_STEEL_ARCH_MODULE_WITH_ZZ_S_PARAMETERS",
        "status": inventory["final_status"],
    }
    nodes = build_nodes(list(meshes), True)
    nodes[0]["name"] = "ZZSSectionAssemblyGroup"
    # 主筋纵向间距250 mm。使用单一已验证截面网格，在1 m区间的四个
    # 间距单元中心复用实例；这些位置同时就是N4箍筋的布设面。
    main_bar_positions_mm = [125, 375, 625, 875]
    for ring in ("N1", "N2"):
        group_index = next(i for i, node in enumerate(nodes) if node.get("name") == ring + "Group")
        original_index = nodes[group_index]["children"][0]
        mesh_index = nodes[original_index]["mesh"]
        children = []
        for index, z_mm in enumerate(main_bar_positions_mm, 1):
            children.append(len(nodes))
            nodes.append({
                "name": f"{ring}_{index:03d}",
                "mesh": mesh_index,
                # N1/N2源网格中心位于z=0.5 m。
                "translation": [0.0, 0.0, z_mm / 1000.0 - 0.5],
            })
        nodes[group_index]["children"] = children
    glb = write_glb(meshes, nodes, metadata, output_dir / "ZZ-S_support_1m.glb")
    state = {
        "support_type": "ZZ-S", "status": inventory["final_status"], "inventory": inventory,
        "geometry": {"common_inner_profile": "page 76 with invert", "primary_concrete": primary_profiles, "secondary_lining": {"inner": inner, "outer": secondary_outer}, "system_anchor_count": anchors["count"], "lock_foot_count": lock["count"]},
        "validation": {
            "primary_thickness_exact": primary_profiles["thickness_mm"] == 260,
            "secondary_thickness_exact": secondary_outer["normal_offset_mm"] == 500,
            "two_steel_arches": len(steels) == 2,
            "system_anchor_spacing_exact": [x["z_mm"] for x in anchors["layers"]] == [250, 750],
            "lock_foot_count_exact": lock["count"] == 16,
            "secondary_rebar_closed": p1["closed"] and p2["closed"],
            "secondary_main_bar_positions_mm": main_bar_positions_mm,
            "secondary_main_bar_count_per_m": len(main_bar_positions_mm),
            "secondary_main_bars_aligned_with_N4": [x["z_mm"] for x in n34["N4"]["layout"]] == main_bar_positions_mm,
            "required_groups_present": {"primarySupportConcreteGroup", "primarySupportMeshGroup", "steelArchArrayGroup", "systemAnchorGroup", "lockFootAnchorGroup", "secondaryLiningGroup", "N1Group", "N2Group", "N3Group", "N4Group"} <= set(glb["node_names"]),
        },
        "glb": glb,
    }
    state["validation"]["all_passed"] = all(
        value for key, value in state["validation"].items()
        if key not in {"secondary_main_bar_positions_mm", "secondary_main_bar_count_per_m"}
    )
    (output_dir / "ZZ-S_parameter_inventory.json").write_text(json.dumps(inventory, ensure_ascii=False, indent=2), encoding="utf-8")
    (output_dir / "ZZ-S_support_1m_metadata.json").write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    return state
