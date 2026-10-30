"""仅组合现有几何模块，批量生成可表达的剩余支护类型。"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from lock_foot_anchor.geometry import build_lock_foot_anchor_geometry
from lock_foot_anchor.models import ConfirmedParameters, LockFootAnchorParameters
from primary_mesh.geometry import build_primary_mesh_geometry
from primary_support.geometry import build_open_shell_mesh, build_primary_profiles
from primary_support_1m.geometry import clone_mesh_at_z
from primary_support_1m.gltf import write_glb
from secondary_lining.geometry import build_extruded_shell_mesh, build_normal_offset_profile
from secondary_rebar_assembly.geometry import build_rebar_profile, build_tube_mesh
from section_assembly.steel import read_steel_arch_mesh
from system_anchor.geometry import build_system_anchor_geometry


OPEN_SIDE_ANGLE = 16 + 49 / 60 + 41 / 3600
INVERT_SIDE_ANGLE = 11 + 41 / 60 + 58 / 3600
REBAR_ANGLES = [22 + 24 / 60 + 33 / 3600, INVERT_SIDE_ANGLE, 55 + 53 / 60 + 29 / 3600]


BATCH_DEFINITIONS: dict[str, dict[str, Any]] = {
    "ZZ-II": {"pages": [89, 90, 91], "invert": False, "primary": 80, "reserve": 30, "secondary": 350,
               "mesh": None, "steel": None, "anchor": None, "lock": False, "rebar": None},
    "ZZ-III": {"pages": [92, 93, 94], "invert": False, "primary": 120, "reserve": 50, "secondary": 350,
                "mesh": {"diameter": 8, "spacing": 250, "scope": "CROWN_180"}, "steel": None,
                "anchor": {"diameter": 25, "length": 3500, "circ": 1200, "long": 1200, "scope": "CROWN_180"}, "lock": False, "rebar": None},
    "ZZ-IIIx": {"pages": [117, 118, 119], "invert": False, "primary": 150, "reserve": 50, "secondary": 350,
                 "mesh": {"diameter": 8, "spacing": 250, "scope": "CROWN_180"}, "steel": None,
                 "anchor": {"diameter": 25, "length": 3500, "circ": 1200, "long": 1200, "scope": "CROWN_180"}, "lock": False, "rebar": None},
    "ZZ-Y1": {"pages": [136, 137, 138], "invert": False, "primary": 120, "reserve": 50, "secondary": 350,
               "mesh": {"type": "ENERGY_ABSORPTION_NET", "scope": "CROWN_180"}, "steel": None,
               "anchor": {"diameter": 25, "length": 3500, "circ": 1200, "long": 1200, "scope": "CROWN_180"}, "lock": False, "rebar": None},
    "ZZ-IVc": {"pages": [105, 106, 107, 108], "invert": True, "primary": 240, "reserve": 80, "secondary": 450,
                "mesh": {"diameter": 8, "spacing": 250, "scope": "ARCH_AND_WALL"},
                "steel": {"R1": 6140, "R2": 10640, "beta": 15.7869, "profile": "I18", "spacing": 800},
                "anchor": {"diameter": 25, "length": 4000, "circ": 1200, "long": 800, "scope": "ARCH_AND_WALL"},
                "lock": False, "rebar": {"N1": [5889, 10389, 1589, 12389], "N2": [5561, 10061, 1261, 12061], "diameter": 22}},
    "ZZ-IVx": {"pages": [120, 121, 122, 123], "invert": True, "primary": 240, "reserve": 80, "secondary": 450,
                "mesh": {"diameter": 8, "spacing": 250, "scope": "ARCH_AND_WALL"},
                "steel": {"R1": 6140, "R2": 10640, "beta": 15.7861, "profile": "I18", "spacing": 800},
                "anchor": {"diameter": 25, "length": 4500, "circ": 1200, "long": 800, "scope": "MIXED_MIDDLE_PILLAR"},
                "lock": False, "rebar": {"N1": [5889, 10389, 1589, 12389], "N2": [5561, 10061, 1261, 12061], "diameter": 22}},
    "ZZ-IVsx": {"pages": [124, 125, 126, 127], "invert": True, "primary": 240, "reserve": 80, "secondary": 450,
                 "mesh": {"diameter": 8, "spacing": 250, "scope": "ARCH_AND_WALL"},
                 "steel": {"R1": 6140, "R2": 10640, "beta": 15.7861, "profile": "I18", "spacing": 800},
                 "anchor": {"diameter": 25, "length": 4500, "circ": 1200, "long": 800, "scope": "MIXED_BILATERAL_MIDDLE_PILLAR"},
                 "lock": False, "rebar": {"N1": [5889, 10389, 1589, 12389], "N2": [5561, 10061, 1261, 12061], "diameter": 22}},
    "ZZ-Vsx": {"pages": [128, 129, 130, 131], "invert": True, "primary": 260, "reserve": 100, "secondary": 500,
                 "mesh": {"diameter": 8, "spacing": 200, "scope": "ARCH_AND_WALL"},
                 "steel": {"R1": 6220, "R2": 10720, "beta": 15.6669, "profile": "I20a", "spacing": 600},
                 "anchor": {"diameter": 25, "length": 4500, "circ": 1200, "long": 600, "scope": "MIXED_BILATERAL_MIDDLE_PILLAR"},
                 "lock": True, "rebar": {"N1": [5939, 10439, 1639, 12439], "N2": [5561, 10061, 1261, 12061], "diameter": 22}},
    "ZZ-QJsx": {"pages": [132, 133, 134, 135], "invert": True, "primary": 260, "reserve": 120, "secondary": 550,
                  "mesh": {"diameter": 8, "spacing": 200, "scope": "ARCH_AND_WALL"},
                  "steel": {"R1": 6290, "R2": 10790, "beta": 15.5422, "profile": "I20a", "spacing": 500},
                  "anchor": {"diameter": 25, "length": 4500, "circ": 1200, "long": 500, "scope": "MIXED_BILATERAL_MIDDLE_PILLAR"},
                  "lock": True, "rebar": {"N1": [5988, 10488, 1688, 12488], "N2": [5563, 10063, 1263, 12063], "diameter": 25}},
}


def _positions(spacing: float) -> list[float]:
    if spacing >= 1000:
        return [500.0]
    return [(1000.0 - spacing) / 2.0, (1000.0 + spacing) / 2.0]


def _nodes(mesh_names: list[str], support_type: str) -> list[dict[str, Any]]:
    mesh_index = {name: index for index, name in enumerate(mesh_names)}
    nodes: list[dict[str, Any]] = []
    def add(name: str, children=None, mesh=None):
        item: dict[str, Any] = {"name": name}
        if children is not None: item["children"] = children
        if mesh is not None: item["mesh"] = mesh
        nodes.append(item); return len(nodes) - 1
    root = add(support_type.replace("-", "") + "SectionAssemblyGroup", [])
    primary = add("primarySupportGroup", []); secondary = add("secondarySystemGroup", [])
    nodes[root]["children"] = [primary, secondary]
    primary_groups = []
    groups = {
        "primarySupportConcreteGroup": ["primarySupportConcrete"],
        "primarySupportMeshGroup": ["primaryMeshCircumferentialBars", "primaryMeshLongitudinalBars"],
        "steelArchArrayGroup": [x for x in mesh_names if x.startswith("steelArch_")],
        "systemAnchorGroup": [x for x in mesh_names if x.startswith("SystemAnchorMesh_")],
        "lockFootAnchorGroup": [x for x in mesh_names if x.startswith("lockFootAnchor_")],
    }
    for group_name, names in groups.items():
        names = [x for x in names if x in mesh_index]
        if not names: continue
        group = add(group_name, []); nodes[group]["children"] = [add(name, mesh=mesh_index[name]) for name in names]; primary_groups.append(group)
    nodes[primary]["children"] = primary_groups
    secondary_groups = []
    for group_name, names in (("secondaryLiningGroup", ["secondaryLining"]), ("N1Group", ["N1"]), ("N2Group", ["N2"])):
        names = [x for x in names if x in mesh_index]
        if not names: continue
        group = add(group_name, []); nodes[group]["children"] = [add(name, mesh=mesh_index[name]) for name in names]; secondary_groups.append(group)
    nodes[secondary]["children"] = secondary_groups
    return nodes


def build_one(root: Path, support_type: str, definition: dict[str, Any], output_dir: Path) -> dict[str, Any]:
    meshes: dict[str, dict[str, Any]] = {}
    angle = INVERT_SIDE_ANGLE if definition["invert"] else OPEN_SIDE_ANGLE
    secondary_thickness = definition["secondary"]
    primary_inner_top = 5500 + secondary_thickness + definition["reserve"]
    primary_inner_side = 10000 + secondary_thickness + definition["reserve"]
    primary_profiles = build_primary_profiles(primary_inner_top, primary_inner_side, primary_inner_top + definition["primary"], primary_inner_side + definition["primary"], angle)
    meshes["primarySupportConcrete"] = build_open_shell_mesh(primary_profiles, 1000)

    if definition["invert"]:
        common = json.loads((root / "outputs/base_profile/ZZ-Va_section_geometry.json").read_text(encoding="utf-8"))["inner_profile"]["geometry"]
        outer = build_normal_offset_profile(common, secondary_thickness)
        meshes["secondaryLining"] = build_extruded_shell_mesh(common, outer, 1000, 32)
    else:
        secondary_profiles = build_primary_profiles(5500, 10000, 5500 + secondary_thickness, 10000 + secondary_thickness, angle)
        meshes["secondaryLining"] = build_open_shell_mesh(secondary_profiles, 1000)

    mesh_params = definition.get("mesh")
    if mesh_params and mesh_params.get("scope") == "ARCH_AND_WALL" and "diameter" in mesh_params:
        mesh = build_primary_mesh_geometry(
            top_radius_mm=primary_inner_top + 40, side_radius_mm=primary_inner_side + 40, beta_deg=angle,
            diameter_mm=mesh_params["diameter"], circumferential_spacing_mm=mesh_params["spacing"],
            longitudinal_spacing_mm=mesh_params["spacing"], reference_surface="PRIMARY_SUPPORT_INNER_SURFACE", offset_from_reference_mm=40,
        )
        meshes["primaryMeshCircumferentialBars"] = mesh["circumferential"]["mesh"]
        meshes["primaryMeshLongitudinalBars"] = mesh["longitudinal"]["mesh"]

    steel = definition.get("steel")
    if steel and steel["profile"] == "I20a":
        base = read_steel_arch_mesh(root / "outputs/I20a_validation/ZZ-Va_I20a_steel_arch.glb", 0.0)
        for index, z in enumerate(_positions(steel["spacing"]), 1):
            meshes[f"steelArch_{index:03d}"] = clone_mesh_at_z(base, z / 1000)

    anchor = definition.get("anchor")
    if anchor and anchor["scope"] == "ARCH_AND_WALL":
        anchors = build_system_anchor_geometry(
            top_radius_mm=primary_inner_top + definition["primary"], side_radius_mm=primary_inner_side + definition["primary"], beta_deg=angle,
            diameter_mm=anchor["diameter"], length_mm=anchor["length"], circumferential_spacing_mm=anchor["circ"],
            longitudinal_spacing_mm=anchor["long"], z_positions_override_mm=_positions(anchor["long"]),
        )
        meshes.update(anchors["meshes"])

    if definition.get("lock") and steel:
        confirmed = ConfirmedParameters(steel_arch_spacing_mm=steel["spacing"])
        lock = build_lock_foot_anchor_geometry(
            LockFootAnchorParameters(confirmed=confirmed), top_radius_mm=steel["R1"], side_radius_mm=steel["R2"],
            beta_deg=steel["beta"], arch_positions_mm=tuple(_positions(steel["spacing"])),
        )
        meshes.update(lock["meshes"])

    rebar = definition.get("rebar")
    if rebar:
        p1 = build_rebar_profile(rebar["N1"], REBAR_ANGLES); p2 = build_rebar_profile(rebar["N2"], REBAR_ANGLES)
        meshes["N1"] = build_tube_mesh(p1, rebar["diameter"]); meshes["N2"] = build_tube_mesh(p2, rebar["diameter"])

    output_dir.mkdir(parents=True, exist_ok=True)
    metadata = {
        "support_type": support_type, "length_m": 1.0, "source_pages": definition["pages"],
        "assembly": "EXISTING_GEOMETRY_MODULES_ONLY", "component_meshes": list(meshes),
        "steel_arch_dynamic_rebuild": bool(steel and steel["profile"] == "I20a"),
    }
    glb = write_glb(meshes, _nodes(list(meshes), support_type), metadata, output_dir / f"{support_type}_support_1m.glb")
    state = {"support_type": support_type, "definition": definition, "glb": glb}
    (output_dir / f"{support_type}_support_1m_metadata.json").write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    return state


def build_batch_support_models(root: Path, output_dir: Path) -> dict[str, Any]:
    return {name: build_one(root, name, definition, output_dir) for name, definition in BATCH_DEFINITIONS.items()}
