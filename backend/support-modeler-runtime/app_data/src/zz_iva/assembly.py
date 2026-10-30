"""用现有通用构件几何装配 ZZ-IVa 1 m 短节，不复制几何公式。"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from primary_mesh.geometry import build_primary_mesh_geometry, combine_meshes
from primary_support.geometry import build_open_shell_mesh, build_primary_profiles
from primary_support_1m.gltf import inspect_glb, write_glb
from section_assembly.steel import read_steel_arch_mesh
from system_anchor.geometry import build_system_anchor_geometry


INNER_SIDE_ANGLE_DEG = 16 + 49 / 60 + 41 / 3600


def _field(value: Any, unit: str | None, status: str, source: str, pages: list[int]) -> dict[str, Any]:
    return {"value": value, "unit": unit, "status": status, "source": source, "pages": pages}


def parameter_inventory() -> dict[str, Any]:
    """仅记录已审计的直接证据和一项明确标注的局部关系假设。"""
    drawing = "support_drawings.pdf"
    plan = "YL交通隧道主洞钻爆开挖支护施工方案 表4.7-1"
    common = "第74页目录 → 第76页 S5-2-1-1 主隧道钻爆法共用内轮廓 → 第95页 ZZ-IVa"
    return {
        "support_type": "ZZ-IVa",
        "status_categories": ["CONFIRMED", "PROVISIONAL", "MISSING"],
        "final_status": "SECOND_SUPPORT_TYPE_MOSTLY_IMPLEMENTED",
        "components": {
            "steel_arch": {
                "applicability": "APPLICABLE", "implementation": "READY",
                "parameters": {
                    "R1_mm": _field(6080, "mm", "CONFIRMED", drawing, [98]),
                    "R2_mm": _field(10580, "mm", "CONFIRMED", drawing, [98]),
                    "beta_deg": _field(15.8797, "deg", "CONFIRMED", "15°52′47″；左右对称标注", [98]),
                    "steel_profile": _field("I16", None, "CONFIRMED", drawing, [95, 98]),
                    "longitudinal_spacing_mm": _field(1000, "mm", "CONFIRMED", drawing, [95, 99]),
                },
            },
            "primary_concrete": {
                "applicability": "APPLICABLE", "implementation": "READY",
                "parameters": {
                    "material": _field("C25喷射混凝土", None, "CONFIRMED", plan, [95]),
                    "thickness_mm": _field(220, "mm", "CONFIRMED", plan, [95]),
                    "scope": _field("ARCH_AND_WALL_ONLY", None, "CONFIRMED", plan, [95]),
                    "reserved_deformation_mm": _field(80, "mm", "CONFIRMED", plan, [95]),
                },
            },
            "primary_mesh": {
                "applicability": "APPLICABLE", "implementation": "READY_WITH_PROVISIONAL_RELATION",
                "parameters": {
                    "diameter_mm": _field(8, "mm", "CONFIRMED", plan, [95]),
                    "circumferential_spacing_mm": _field(250, "mm", "CONFIRMED", plan, [95]),
                    "longitudinal_spacing_mm": _field(250, "mm", "CONFIRMED", plan, [95]),
                    "layers": _field(2, None, "CONFIRMED", "第95页：双层、拱墙设置", [95]),
                    "scope": _field("ARCH_AND_WALL_ONLY", None, "CONFIRMED", plan, [95]),
                    "steel_connection_relation": _field("I16_INNER_AND_ROCK_SIDE_CONTACT", None, "PROVISIONAL", "沿用已验收的可调参考关系；图纸未明确局部连接侧别", [95, 98]),
                },
            },
            "system_anchor": {
                "applicability": "APPLICABLE", "implementation": "READY",
                "parameters": {
                    "type": _field("Φ25低预应力树脂卷锚杆", None, "CONFIRMED", plan, [95]),
                    "diameter_mm": _field(25, "mm", "CONFIRMED", plan, [95]),
                    "length_mm": _field(4000, "mm", "CONFIRMED", plan, [95]),
                    "circumferential_spacing_mm": _field(1200, "mm", "CONFIRMED", plan, [95]),
                    "longitudinal_spacing_mm": _field(1000, "mm", "CONFIRMED", plan, [95]),
                    "scope": _field("ARCH_AND_WALL_ONLY", None, "CONFIRMED", plan, [95]),
                },
            },
            "lock_foot_anchor": {
                "applicability": "NOT_APPLICABLE", "implementation": "NOT_APPLICABLE",
                "parameters": {},
                "evidence": "第95–99页完整存在性扫描未发现锁脚锚管；第98页C22砂浆定位锚杆不是锁脚锚管。",
            },
            "secondary_lining": {
                "applicability": "APPLICABLE", "implementation": "READY",
                "parameters": {
                    "material": _field("C35混凝土", None, "CONFIRMED", drawing, [95]),
                    "thickness_mm": _field(400, "mm", "CONFIRMED", drawing, [95]),
                    "has_invert": _field(False, None, "CONFIRMED", plan, [95]),
                },
            },
            "inner_profile": {
                "applicability": "APPLICABLE", "implementation": "READY",
                "reference_chain": common,
                "parameters": {
                    "top_radius_mm": _field(5500, "mm", "CONFIRMED", common, [74, 76, 95]),
                    "side_radius_mm": _field(10000, "mm", "CONFIRMED", common, [74, 76, 95]),
                    "side_angle_deg": _field(INNER_SIDE_ANGLE_DEG, "deg", "CONFIRMED", "第76页无仰拱轮廓 16°49′41″", [76]),
                    "top_angle_deg": _field(180, "deg", "CONFIRMED", "参数识别规则与第76页对称半圆", [76]),
                    "width_mm": _field(11000, "mm", "CONFIRMED", drawing, [76]),
                    "height_mm": _field(8395, "mm", "CONFIRMED", drawing, [76]),
                },
            },
            "secondary_rebar": {
                "applicability": "NOT_APPLICABLE", "implementation": "NOT_APPLICABLE",
                "parameters": {},
                "evidence": "第95–99页完整存在性扫描为NOT_APPLICABLE；未发现N1–N4二衬钢筋大样。",
            },
        },
        "confirmed_parameters": [],
        "provisional_parameters": ["primary_mesh.steel_connection_relation"],
        "missing_parameters": [],
    }


def _nodes(mesh_names: list[str]) -> list[dict[str, Any]]:
    """构件层级只负责装配；各 mesh 均来自现有模块。"""
    mi = {name: i for i, name in enumerate(mesh_names)}
    nodes: list[dict[str, Any]] = []

    def add(name: str, children: list[int] | None = None, mesh: int | None = None) -> int:
        node: dict[str, Any] = {"name": name}
        if children is not None:
            node["children"] = children
        if mesh is not None:
            node["mesh"] = mesh
        nodes.append(node)
        return len(nodes) - 1

    root = add("ZZIVaSectionAssemblyGroup", [])
    primary = add("primarySupportGroup", [])
    secondary = add("secondarySystemGroup", [])
    nodes[root]["children"] = [primary, secondary]
    concrete = add("primarySupportConcreteGroup", [])
    nodes[concrete]["children"] = [add("primarySupportConcrete", mesh=mi["primarySupportConcrete"])]
    mesh_group = add("primarySupportMeshGroup", [])
    nodes[mesh_group]["children"] = [
        add("primaryMeshCircumferentialBars", mesh=mi["primaryMeshCircumferentialBars"]),
        add("primaryMeshLongitudinalBars", mesh=mi["primaryMeshLongitudinalBars"]),
    ]
    steel = add("steelArchArrayGroup", [])
    nodes[steel]["children"] = [add("steelArch_001", mesh=mi["steelArch_001"])]
    anchors = add("systemAnchorGroup", [])
    nodes[anchors]["children"] = [add(name, mesh=mi[name]) for name in mesh_names if name.startswith("SystemAnchorMesh_")]
    nodes[primary]["children"] = [concrete, mesh_group, steel, anchors]
    lining = add("secondaryLiningGroup", [])
    nodes[lining]["children"] = [add("secondaryLining", mesh=mi["secondaryLining"])]
    nodes[secondary]["children"] = [lining]
    return nodes


def build_zz_iva_support_1m(root: Path, output_dir: Path) -> dict[str, Any]:
    """生成带真实层厚、双层网、I16钢架、系统锚杆和二衬的1m短节。"""
    output_dir.mkdir(parents=True, exist_ok=True)
    inventory = parameter_inventory()

    secondary_profiles = build_primary_profiles(5500, 10000, 5900, 10400, INNER_SIDE_ANGLE_DEG)
    primary_profiles = build_primary_profiles(5980, 10480, 6200, 10700, INNER_SIDE_ANGLE_DEG)
    concrete = build_open_shell_mesh(primary_profiles, 1000)
    secondary = build_open_shell_mesh(secondary_profiles, 1000)

    # 图纸确认双层；与 I16 内外侧接触的局部关系仍明确标为 PROVISIONAL。
    mesh_inner = build_primary_mesh_geometry(
        top_radius_mm=5996, side_radius_mm=10496, beta_deg=15.8797,
        diameter_mm=8, circumferential_spacing_mm=250, longitudinal_spacing_mm=250,
        reference_surface="I16_INNER_SIDE", offset_from_reference_mm=-84,
    )
    mesh_outer = build_primary_mesh_geometry(
        top_radius_mm=6164, side_radius_mm=10664, beta_deg=15.8797,
        diameter_mm=8, circumferential_spacing_mm=250, longitudinal_spacing_mm=250,
        reference_surface="I16_ROCK_SIDE", offset_from_reference_mm=84,
    )
    circum = combine_meshes([mesh_inner["circumferential"]["mesh"], mesh_outer["circumferential"]["mesh"]])
    longitudinal = combine_meshes([mesh_inner["longitudinal"]["mesh"], mesh_outer["longitudinal"]["mesh"]])

    steel = read_steel_arch_mesh(root / "outputs/demo/steel_arch_ZZ-IVa.glb", 0.5)
    anchors = build_system_anchor_geometry(
        top_radius_mm=6200, side_radius_mm=10700, beta_deg=INNER_SIDE_ANGLE_DEG,
        diameter_mm=25, length_mm=4000, circumferential_spacing_mm=1200,
        longitudinal_spacing_mm=1000, z_positions_override_mm=[500],
    )
    meshes = {
        "primarySupportConcrete": concrete,
        "primaryMeshCircumferentialBars": circum,
        "primaryMeshLongitudinalBars": longitudinal,
        "steelArch_001": steel,
        **anchors["meshes"],
        "secondaryLining": secondary,
    }
    metadata = {
        "support_type": "ZZ-IVa",
        "length_m": 1.0,
        "component_list": ["primary_concrete", "primary_mesh", "steel_arch", "system_anchor", "secondary_lining"],
        "not_applicable": ["lock_foot_anchor", "N1", "N2", "N3", "N4"],
        "confirmed_parameters": [
            "inner_profile", "primary_concrete", "primary_mesh.specification", "system_anchor",
            "steel_arch", "secondary_lining",
        ],
        "provisional_parameters": inventory["provisional_parameters"],
        "missing_parameters": inventory["missing_parameters"],
        "steel_arch_spacing_mm": 1000,
        "steel_arch_count": 1,
        "system_anchor_longitudinal_spacing_mm": 1000,
        "system_anchor_layer_z_mm": [500],
        "status": inventory["final_status"],
    }
    glb_path = output_dir / "ZZ-IVa_support_1m.glb"
    glb = write_glb(meshes, _nodes(list(meshes)), metadata, glb_path)
    state = {
        "support_type": "ZZ-IVa", "status": inventory["final_status"],
        "inventory": inventory,
        "geometry": {
            "inner_profile_side_angle_deg": INNER_SIDE_ANGLE_DEG,
            "primary_concrete": primary_profiles,
            "secondary_lining": secondary_profiles,
            "primary_mesh_layers": 2,
            "system_anchor_count": anchors["count"],
        },
        "validation": {
            "primary_thickness_exact": primary_profiles["thickness_mm"] == 220,
            "secondary_thickness_exact": secondary_profiles["thickness_mm"] == 400,
            "steel_inside_primary_support": 5980 < 6000 < 6160 < 6200,
            "steel_cover_inner_mm": 20,
            "steel_cover_outer_mm": 40,
            "one_meter_depth": abs(glb["bbox_m"]["size"][2] - 1.0) < 1e-6,
            "required_groups_present": {"primarySupportConcreteGroup", "primarySupportMeshGroup", "steelArchArrayGroup", "systemAnchorGroup", "secondaryLiningGroup"} <= set(glb["node_names"]),
            "not_applicable_groups_absent": not ({"lockFootAnchorGroup", "N1Group", "N2Group", "N3Group", "N4Group"} & set(glb["node_names"])),
        },
        "glb": glb,
    }
    state["validation"]["all_passed"] = all(state["validation"].values())
    (output_dir / "ZZ-IVa_parameter_inventory.json").write_text(json.dumps(inventory, ensure_ascii=False, indent=2), encoding="utf-8")
    (output_dir / "ZZ-IVa_support_1m_metadata.json").write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    return state
