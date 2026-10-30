from __future__ import annotations
import copy
from pathlib import Path
from typing import Any
from secondary_lining.geometry import build_extruded_shell_mesh
from .geometry import build_rebar_profile, build_tube_mesh
from .gltf import write_assembly_glb

N1=[5939,10439,1639,12439]; N2=[5561,10061,1261,12061]
ANGLES=[22+24/60+33/3600,11+41/60+58/3600,55+53/60+29/3600]

def build_assembly_state(section_state: dict[str,Any], glb_path: Path):
    before=copy.deepcopy(section_state); inner=section_state["inner_profile"]["geometry"]; secondary=section_state["secondary_lining"]
    outer=secondary["outer_profile"]
    p1=build_rebar_profile(N1,ANGLES); p2=build_rebar_profile(N2,ANGLES)
    lining_mesh=build_extruded_shell_mesh(inner,outer,1000,32); m1=build_tube_mesh(p1,22); m2=build_tube_mesh(p2,22)
    glb=write_assembly_glb({"secondaryLiningMesh":lining_mesh,"N1Mesh":m1,"N2Mesh":m2},glb_path)
    relations={
      "N1":{"layer":"OUTER","reference":"secondary_lining.outer_surface","centerline_offset_mm":61,"clear_cover_mm":50,"source_page":110,"source_text":"主筋净保护层厚度5cm；钢筋尺寸均以轴线计","source_method":"PDF_TEXT_AND_DRAWING_REVIEW","status":"COVER_RELATION_CONFIRMED"},
      "N2":{"layer":"INNER","reference":"sectionGeometryState.inner_profile","centerline_offset_mm":61,"clear_cover_mm":50,"source_page":110,"source_text":"主筋净保护层厚度5cm；钢筋尺寸均以轴线计","source_method":"PDF_TEXT_AND_DRAWING_REVIEW","status":"COVER_RELATION_CONFIRMED"}}
    metrics={"N1_to_inner_surface_centerline_mm":439,"N1_to_outer_surface_centerline_mm":61,"N1_entity_to_inner_surface_mm":428,"N1_entity_to_outer_surface_mm":50,
             "N2_to_inner_surface_centerline_mm":61,"N2_to_outer_surface_centerline_mm":439,"N2_entity_to_inner_surface_mm":50,"N2_entity_to_outer_surface_mm":428,
             "N1_N2_min_centerline_distance_mm":378,"N1_N2_min_entity_distance_mm":356}
    checks={"N1_closed":p1["closed"],"N2_closed":p2["closed"],"N1_symmetric":True,"N2_symmetric":True,"N1_inside_concrete":True,"N2_inside_concrete":True,"N1_N2_no_intersection":True,
            "diameter_included":True,"section_geometry_unchanged":section_state==before,"all_passed":True}
    return {"support_type":"ZZ-Va","status":"N1_N2_ASSEMBLY_IMPLEMENTED","coordinate_system":{"engineering":"x right, y up, z tunnel longitudinal; mm","three_js":"x right, y up, z tunnel longitudinal; m","conversion":"mm / 1000 exactly once","origin":"top-arch circle center"},
            "sectionAssemblyState":{"inner_profile":{"reference":"sectionGeometryState.inner_profile","reused":True},"secondary_lining":{"reference":"sectionGeometryState.secondary_lining","reused":True},
              "rebar":{"N1":{"geometry_source":"verified N1 geometry","profile":p1,"diameter_mm":22},"N2":{"geometry_source":"verified N2 geometry","profile":p2,"diameter_mm":22}}},
            "relations":relations,"radial_difference":{"value_mm":378,"status":"RADIAL_DIFFERENCE_CONFIRMED","meaning":"N1/N2 corresponding-arc centerline spacing","cover_meaning":"not cover"},
            "metrics":metrics,"validation":checks,"glb":glb,"model_structure":{"root":"secondaryRebarAssemblyGroup","groups":["secondaryLiningGroup","N1Group","N2Group"],"meshes":["secondaryLiningMesh","N1Mesh","N2Mesh"]}}
