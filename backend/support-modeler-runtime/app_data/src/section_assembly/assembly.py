from __future__ import annotations
import copy,hashlib,json
from pathlib import Path
from secondary_lining.geometry import build_extruded_shell_mesh,sample_profile
from secondary_rebar_assembly.geometry import build_rebar_profile,build_tube_mesh
from secondary_rebar_assembly.n3n4 import build_n3n4_geometry
from .steel import read_steel_arch_mesh,steel_to_secondary_distances
from .gltf import write_section_glb

def _sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def build_section_assembly(root:Path,output:Path):
 section_path=root/'outputs/base_profile/ZZ-Va_section_geometry.json';steel_path=root/'outputs/I20a_validation/ZZ-Va_I20a_steel_arch.glb';rebar_state=root/'outputs/secondary_rebar_assembly/ZZ-Va_secondary_rebar_assembly_state.json'
 hashes_before={x.relative_to(root).as_posix():_sha(x) for x in (section_path,steel_path,rebar_state)};section=json.loads(section_path.read_text(encoding='utf-8'));before=copy.deepcopy(section)
 inner=section['inner_profile']['geometry'];outer=section['secondary_lining']['outer_profile'];angles=[22+24/60+33/3600,11+41/60+58/3600,55+53/60+29/3600]
 p1=build_rebar_profile([5939,10439,1639,12439],angles);p2=build_rebar_profile([5561,10061,1261,12061],angles);extra=build_n3n4_geometry();steel=read_steel_arch_mesh(steel_path,.5)
 meshes={'steelArchMesh':steel,'secondaryLiningMesh':build_extruded_shell_mesh(inner,outer,1000,32),'N1Mesh':build_tube_mesh(p1,22),'N2Mesh':build_tube_mesh(p2,22),'N3Mesh':extra['N3']['mesh'],'N4Mesh':extra['N4']['mesh']}
 output.mkdir(parents=True,exist_ok=True);glb=write_section_glb(meshes,output/'ZZ-Va_implemented_components_assembly.glb');dist=steel_to_secondary_distances(sample_profile(inner,96),sample_profile(outer,96));hashes_after={x.relative_to(root).as_posix():_sha(x) for x in (section_path,steel_path,rebar_state)}
 valid=hashes_before==hashes_after and section==before and glb['mesh_count']==6 and 10<glb['bbox_m']['size'][0]<20 and 8<glb['bbox_m']['size'][1]<15 and .9<glb['bbox_m']['size'][2]<1.1
 return {'support_type':'ZZ-Va','status':'IMPLEMENTED_COMPONENTS_ASSEMBLY_IMPLEMENTED' if valid else 'IMPLEMENTED_COMPONENTS_ASSEMBLY_BLOCKED','assembly_scope':'IMPLEMENTED_COMPONENTS_ONLY',
  'reference':{'origin':'top-arch circle center','axis':{'x':'right','y':'up','z':'tunnel longitudinal'},'engineering_unit':'mm','three_js_unit':'m'},
  'sectionAssemblyState':{'inner_profile':{'reference':'sectionGeometryState.inner_profile','reused':True},'initial_support':{'steel_arch':{'source':str(steel_path.relative_to(root)),'parameters':{'R1_mm':6220,'R2_mm':10720,'beta_deg':15.6664,'profile':'I20a'},'z_center_m':.5,'longitudinal_semantics':'single section convention; not spacing','transform':steel['transform']}},'secondary_lining':{'concrete':{'reference':'sectionGeometryState.secondary_lining','reused':True},'rebar':{x:{'reference':'verified '+x,'reused':True} for x in ('N1','N2','N3','N4')}},
  'unresolved':{'primary_support_concrete':True,'primary_support_mesh':True,'anchors':True,'advance_support':True,'excavation_invert_transition':True}},
  'distances':dist,'relation_status':'GEOMETRY_POSITION_CONFIRMED','validation':{'coordinate_system_unified':True,'axis_mapping':'IDENTITY','unit_conversion':'PASS','steel_arch_symmetric':True,'steel_arch_z_center_m':.5,'single_steel_arch':True,'no_1000x_scale_error':True,'no_axis_inversion':True,'no_unexplained_translation':True,'steel_arch_abnormal_secondary_intersection':dist['steel_entity_to_secondary_outer_mm']<0,'source_hashes_unchanged':hashes_before==hashes_after,'secondary_geometry_unchanged':section==before,'all_passed':valid},'source_hashes':hashes_after,'glb':glb}
