"""生成初支钢筋网参数、几何、验证和统一总装。"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from primary_support.geometry import build_open_shell_mesh, build_primary_profiles
from secondary_lining.geometry import build_extruded_shell_mesh
from secondary_rebar_assembly.geometry import build_rebar_profile, build_tube_mesh
from secondary_rebar_assembly.n3n4 import build_n3n4_geometry
from section_assembly.steel import read_steel_arch_mesh

from .geometry import build_primary_mesh_geometry
from .gltf import write_combined_glb, write_primary_mesh_glb


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _parameter_payload() -> dict[str, Any]:
    page109 = "第109页 ZZ-Va型衬砌断面图"
    confirmed = "FOUND_CONFIRMED"
    return {
        "support_type": "ZZ-Va",
        "status": "PRIMARY_MESH_PARAMETERS_READY",
        "circumferential_bar": {"diameter_mm": 8.0, "spacing_mm": 200.0, "status": confirmed, "source_page": 109, "source_text": "环向φ8；网格间距20cm×20cm", "drawing_reference": page109},
        "longitudinal_bar": {"diameter_mm": 8.0, "spacing_mm": 200.0, "status": confirmed, "source_page": 109, "source_text": "纵向φ8；网格间距20cm×20cm", "drawing_reference": page109},
        "reference_relation": {
            "reference_surface": "PRIMARY_SUPPORT_INNER_SURFACE",
            "offset_to_bar_centerline_mm": 40.0,
            "bar_radius_mm": 4.0,
            "nearest_bar_surface_from_inner_mm": 36.0,
            "farthest_bar_surface_from_inner_mm": 44.0,
            "status": confirmed,
            "source_page": 109,
            "source_text": "钢筋网平面示意图标注初支总厚26cm，并分解为4cm与22cm；参数识别.docx：与初支混凝土内表面的距离为4cm，半径=初支半径+4",
            "source_method": "DRAWING_REVIEW_AND_PARAMETER_DEFINITION_DOCX",
        },
        "derived_profile": {"top_radius_mm": 6140.0, "side_radius_mm": 10640.0, "top_angle_deg": 180.0, "side_angle_deg": 15.6664, "status": confirmed},
        "layer": {"single_layer": True, "status": confirmed, "source_page": 109, "source_text": "钢筋网：单层、拱墙设置"},
        "regions": {
            "top": {"status": "READY", "evidence": "拱墙设置"},
            "side": {"status": "READY", "evidence": "拱墙设置"},
            "invert_transition": {"value": None, "status": "NOT_APPLICABLE"},
            "invert_bottom": {"value": None, "status": "NOT_APPLICABLE"},
        },
        "lap_length": {"value": None, "status": "NOT_FOUND"},
        "stagger_rule": {"value": None, "status": "NOT_FOUND", "note": "第109页梅花形布置属于锚杆，不得套用于钢筋网"},
        "steel_relation": {
            "design_relation": "网片紧贴被支护面，并与锚杆、钢拱架或其他锚定装置联结牢固",
            "status": "RELATION_CONFIRMED",
            "local_connection_status": "LOCAL_STEEL_ARCH_CONNECTION_UNRESOLVED",
            "note": "施工方案确认应与钢拱架联结，但未明确I20a处的绑扎/焊接面、终止、搭接或避让细节",
        },
        "provenance": [
            {"page": 109, "source_method": "PDF_TEXT_AND_DRAWING_REVIEW", "source_text": "钢筋网：单层、拱墙设置，环向φ8×纵向φ8，网格间距20cm×20cm。"},
            {"page": 109, "source_method": "DRAWING_DETAIL_REVIEW", "source_text": "钢筋网平面示意图：φ8、N1×20、N2×20；剖面标注4+22=26cm"},
            {"page": None, "source_method": "PARAMETER_RECOGNITION_DOCX", "source_text": "与初支混凝土内表面的距离为4cm；顶拱/侧拱半径=初支半径+4"},
            {"page": 81, "source_method": "CONSTRUCTION_PLAN_TABLE_4_7_2", "source_text": "紧贴被支护面，与锚杆、钢拱架或其他锚定装置联结牢固；混凝土保护层应不小于20mm。"},
        ],
    }


def _existing_meshes(root: Path, primary_mesh: dict[str, Any]) -> dict[str, dict[str, Any]]:
    section=json.loads((root/"outputs/base_profile/ZZ-Va_section_geometry.json").read_text(encoding="utf-8"));inner=section["inner_profile"]["geometry"];outer=section["secondary_lining"]["outer_profile"]
    angles=[22+24/60+33/3600,11+41/60+58/3600,55+53/60+29/3600]
    p1=build_rebar_profile([5939,10439,1639,12439],angles);p2=build_rebar_profile([5561,10061,1261,12061],angles);extra=build_n3n4_geometry()
    concrete=build_open_shell_mesh(build_primary_profiles());steel=read_steel_arch_mesh(root/"outputs/I20a_validation/ZZ-Va_I20a_steel_arch.glb",.5)
    return {
        "primarySupportConcreteTopSideMesh":concrete,
        "primaryMeshCircumferentialBarsMesh":primary_mesh["circumferential"]["mesh"],
        "primaryMeshLongitudinalBarsMesh":primary_mesh["longitudinal"]["mesh"],
        "steelArchMesh":steel,
        "secondaryLiningMesh":build_extruded_shell_mesh(inner,outer,1000,32),
        "N1Mesh":build_tube_mesh(p1,22),"N2Mesh":build_tube_mesh(p2,22),"N3Mesh":extra["N3"]["mesh"],"N4Mesh":extra["N4"]["mesh"],
    }


def _state(parameters: dict[str, Any], geometry: dict[str, Any]) -> dict[str, Any]:
    r=parameters["reference_relation"]; top=parameters["derived_profile"]["top_radius_mm"];side=parameters["derived_profile"]["side_radius_mm"]
    validation={
        "parameter_sources_confirmed": all(parameters[x]["status"]=="FOUND_CONFIRMED" for x in ("circumferential_bar","longitudinal_bar","reference_relation")),
        "reference_surface": r["reference_surface"],
        "bar_radial_envelope": {"top_min_mm":top-4,"top_max_mm":top+4,"side_min_mm":side-4,"side_max_mm":side+4},
        "inside_primary_concrete": top-4>6100 and top+4<6360 and side-4>10600 and side+4<10860,
        "outside_reserved_deformation": top-4>6100 and side-4>10600,
        "not_beyond_excavation": top+4<6360 and side+4<10860,
        "circumferential_spacing_exact_mm": 200.0,
        "longitudinal_spacing_exact_mm": geometry["longitudinal"]["actual_spacing_mm"],
        "left_right_symmetric": geometry["longitudinal"]["symmetric"],
        "circumferential_bar_count": geometry["circumferential"]["count"],
        "longitudinal_bar_count": geometry["longitudinal"]["count"],
        "longitudinal_endpoint_margin_mm": geometry["longitudinal"]["left_end_margin_mm"],
        "tube_diameter_mm": 8.0,
        "invert_geometry_absent": parameters["regions"]["invert_transition"]["value"] is None and parameters["regions"]["invert_bottom"]["value"] is None,
        "steel_geometric_overlap": True,
        "steel_overlap_reason": "网片中心线比钢架中心线向内80mm，φ8实体位于钢架200mm径向包络内；z=500mm环向筋及纵向筋均穿过钢架截面范围",
        "steel_design_contact_confirmed": True,
        "steel_relation_status": "PRIMARY_MESH_STEEL_RELATION_NEEDS_REVIEW",
        "steel_connection_evidence_status": "RELATION_CONFIRMED",
        "unresolved_reason": "LOCAL_STEEL_ARCH_CONNECTION_UNRESOLVED",
        "erroneous_collision_asserted": False,
    }
    validation["confirmed_scope_checks_passed"] = all([validation["parameter_sources_confirmed"],validation["inside_primary_concrete"],validation["outside_reserved_deformation"],validation["not_beyond_excavation"],validation["left_right_symmetric"],validation["invert_geometry_absent"]])
    return {
        "support_type":"ZZ-Va","status":"PRIMARY_SUPPORT_MESH_PARTIAL" if validation["confirmed_scope_checks_passed"] else "PRIMARY_SUPPORT_MESH_BLOCKED",
        "readiness":{"PRIMARY_MESH_PARAMETERS_READY":True,"PRIMARY_MESH_GEOMETRY_READY":True,"PRIMARY_MESH_TOP_SIDE_READY":True,"PRIMARY_MESH_INVERT_READY":"NOT_APPLICABLE"},
        "sectionGeometryState_extension":{"primary_support":{"mesh":{"status":"PARTIAL","scope":"ARCH_AND_WALL_ONLY","invert":"NOT_APPLICABLE","reference_profile":geometry["reference_profile"],"circumferential":{"diameter_mm":8,"spacing_mm":200,"count":geometry["circumferential"]["count"]},"longitudinal":{"diameter_mm":8,"spacing_mm":200,"count":geometry["longitudinal"]["count"]},"invert_transition":{"status":"NOT_APPLICABLE"},"invert_bottom":{"status":"NOT_APPLICABLE"}}}},
        "geometry":{"profile_length_mm":geometry["profile_length_mm"],"depth_mm":geometry["depth_mm"],"circumferential_z_positions_mm":geometry["circumferential"]["z_positions_mm"],"longitudinal_distances_mm":geometry["longitudinal"]["distances_mm"],"longitudinal_points_mm":geometry["longitudinal"]["points_mm"],"mesh_summary":{"circumferential":{k:v for k,v in geometry["circumferential"]["mesh"].items() if k not in {"vertices","indices"}},"longitudinal":{k:v for k,v in geometry["longitudinal"]["mesh"].items() if k not in {"vertices","indices"}}}},
        "validation":validation,"unresolved":["LOCAL_STEEL_ARCH_CONNECTION_UNRESOLVED","primary_mesh.lap_length"],
    }


def build_primary_mesh(root: Path, output_dir: Path) -> dict[str, Any]:
    output_dir.mkdir(parents=True,exist_ok=True)
    inputs=[root/"outputs/primary_support/ZZ-Va_primary_support_parameters.json",root/"outputs/primary_support/ZZ-Va_primary_support_geometry.json",root/"outputs/primary_support/ZZ-Va_primary_support_partial.glb",root/"outputs/I20a_validation/ZZ-Va_I20a_steel_arch.glb",root/"outputs/base_profile/ZZ-Va_section_geometry.json",root/"outputs/secondary_rebar_assembly/ZZ-Va_secondary_rebar_assembly_state.json"]
    before={p.relative_to(root).as_posix():_sha(p) for p in inputs};params=_parameter_payload();geometry=build_primary_mesh_geometry();state=_state(params,geometry)
    pp=output_dir/"ZZ-Va_primary_mesh_parameters.json";gp=output_dir/"ZZ-Va_primary_mesh_geometry.json";glbp=output_dir/"ZZ-Va_primary_mesh_partial.glb";assemblyp=root/"outputs/section_assembly/ZZ-Va_implemented_components_with_primary_mesh_partial.glb"
    pp.write_text(json.dumps(params,ensure_ascii=False,indent=2),encoding="utf-8")
    primary_glb=write_primary_mesh_glb(geometry["circumferential"]["mesh"],geometry["longitudinal"]["mesh"],glbp)
    combined_glb=write_combined_glb(_existing_meshes(root,geometry),assemblyp)
    after={p.relative_to(root).as_posix():_sha(p) for p in inputs};state["source_hashes"]=after;state["validation"]["source_artifacts_unchanged"]=before==after
    state["validation"]["primary_glb_valid"]=primary_glb["mesh_count"]==2 and primary_glb["metadata"]["scope"]=="ARCH_AND_WALL_ONLY"
    state["validation"]["combined_glb_valid"]=combined_glb["mesh_count"]==9 and "primarySupportMeshGroup" in combined_glb["node_names"]
    state["glb"]={"primary_mesh_partial":primary_glb,"combined_assembly":combined_glb};gp.write_text(json.dumps(state,ensure_ascii=False,indent=2),encoding="utf-8")
    return {"parameters":params,"state":state,"geometry":geometry,"paths":{"parameters":pp,"geometry":gp,"primary_glb":glbp,"combined_glb":assemblyp}}
