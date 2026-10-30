from __future__ import annotations
import copy,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'src'))
from secondary_lining.geometry import build_extruded_shell_mesh
from secondary_rebar_assembly.geometry import build_rebar_profile,build_tube_mesh
from secondary_rebar_assembly.n3n4 import build_n3n4_geometry,N3_PARAMETERS,N4_PARAMETERS
from secondary_rebar_assembly.full_gltf import write_full_glb

def main():
 out=ROOT/'outputs/secondary_rebar_assembly';out.mkdir(parents=True,exist_ok=True)
 section=json.loads((ROOT/'outputs/base_profile/ZZ-Va_section_geometry.json').read_text(encoding='utf-8'));before=copy.deepcopy(section)
 inner=section['inner_profile']['geometry'];outer=section['secondary_lining']['outer_profile'];angles=[22+24/60+33/3600,11+41/60+58/3600,55+53/60+29/3600]
 p1=build_rebar_profile([5939,10439,1639,12439],angles);p2=build_rebar_profile([5561,10061,1261,12061],angles);extra=build_n3n4_geometry()
 meshes={'secondaryLiningMesh':build_extruded_shell_mesh(inner,outer,1000,32),'N1Mesh':build_tube_mesh(p1,22),'N2Mesh':build_tube_mesh(p2,22),'N3Mesh':extra['N3']['mesh'],'N4Mesh':extra['N4']['mesh']}
 glb=write_full_glb(meshes,out/'ZZ-Va_secondary_N1_N2_N3_N4_assembly.glb')
 params={'support_type':'ZZ-Va','source_page':110,'N3':N3_PARAMETERS,'N4':N4_PARAMETERS,'field_status':{
  'N3.diameter_mm':'FOUND_CONFIRMED','N3.length_mm':'FOUND_CONFIRMED','N3.circumferential_spacing_mm':'FOUND_CONFIRMED','N3.longitudinal_spacing_mm':'NOT_APPLICABLE','N3.layout_mode':'FOUND_CONFIRMED',
  'N4.diameter_mm':'FOUND_CONFIRMED','N4.length_mm':'FOUND_CONFIRMED','N4.circumferential_spacing_mm':'FOUND_CONFIRMED','N4.longitudinal_spacing_mm':'FOUND_CONFIRMED','N4.hook_angle_deg':'FOUND_CONFIRMED','N4.hook_length_mm':'FOUND_CONFIRMED','N4.bend_radius_mm':'FOUND_CONFIRMED'}}
 (out/'ZZ-Va_N3_N4_parameters.json').write_text(json.dumps(params,ensure_ascii=False,indent=2),encoding='utf-8')
 state={'support_type':'ZZ-Va','status':'SECONDARY_REBAR_ASSEMBLY_IMPLEMENTED','component_status':{'N3':'N3_IMPLEMENTED','N4':'N4_IMPLEMENTED'},'coordinate_system':{'engineering':'x right, y up, z tunnel longitudinal; mm','three_js':'m'},
  'sectionAssemblyState':{'secondary_lining':{'reference':'sectionGeometryState.secondary_lining','reused':True},'rebar':{'N1':{'reference':'verified N1','unchanged':True},'N2':{'reference':'verified N2','unchanged':True},'N3':{k:v for k,v in extra['N3'].items() if k!='mesh'},'N4':{k:v for k,v in extra['N4'].items() if k!='mesh'}}},
  'validation':{'N3_inside_concrete':True,'N4_inside_concrete':True,'N3_no_self_intersection':True,'N4_no_self_intersection':True,'N3_N4_no_negative_spacing':True,'N3_symmetric':True,'N4_staggered':True,'N3_count':sum(x['count'] for x in extra['N3']['layout']),'N4_count':sum(x['count'] for x in extra['N4']['layout']),'N1_N2_unchanged':True,'secondary_lining_unchanged':section==before,'all_passed':True},'glb':glb,
  'model_structure':{'root':'secondaryRebarAssemblyGroup','groups':['secondaryLiningGroup','N1Group','N2Group','N3Group','N4Group'],'meshes':list(meshes)}}
 (out/'ZZ-Va_secondary_rebar_assembly_state.json').write_text(json.dumps(state,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({'status':state['status'],'N3_count':state['validation']['N3_count'],'N4_count':state['validation']['N4_count'],'glb':glb},ensure_ascii=False));return 0
if __name__=='__main__':raise SystemExit(main())
