import * as THREE from 'three';
import {OrbitControls} from '../vendor/examples/jsm/controls/OrbitControls.js';
import {GLTFLoader} from '../vendor/examples/jsm/loaders/GLTFLoader.js';
import {GLTFExporter} from '../vendor/examples/jsm/exporters/GLTFExporter.js';
import {componentDefinition,SupportProfileRegistry,AdvanceSupportRegistry,LatticeArchRegistry,positioningRule} from '../v1_2/support_type_registry.js';
import {createVariantState,setOverride,restoreComponent,parameterValue,publicVariant,sharedVariantRecord,saveVariantToLibrary,variantsForSupport,hydrateSharedVariant} from '../v1_1/interaction_core.js';
import {buildSecondaryLiningGeometry,buildOpenSecondaryLiningGeometry} from '../v1_2/secondary_lining_geometry.js';
import {buildPrimarySupportGeometry,validatePrimarySecondarySpatialRelation} from '../v1_2/primary_support_geometry.js';
import {buildProfileLinkedGeometry,evaluatePrimaryComponentDependencies} from '../v1_2/component_dependency_geometry.js';
import {advanceSupportLayout,createHollowPipeGeometry,pipeTransform,validateAdvanceSupportParameters} from '../v1_2/advance_support_geometry.js';
import {createLatticeArchFrameGeometries,validateLatticeArchParameters} from '../v1_2/lattice_arch_geometry.js';

const colors={
  'Z-PM':0xe85d75,'ZZ-QJsx':0xe6504c,'ZZ-Vsx':0xe88f33,'ZZ-IVsx':0x655fd9,
  'ZZ-IVx':0x478bd1,'ZZ-IIIx':0x34a884,'ZZ-III':0x42c68f,'ZZ-IVa':0x2eb8eb,
  'ZZ-II':0x7fbfe8,'ZZ-IVc':0x665fe8,'ZZ-S':0xb857e8,'ZZ-Va':0xf47538,
  'ZZ-IVb':0x4f85f5,'TZ-III':0xff6470,'ZZ-Y1':0xa9b83f,
};
const componentVisibility={
  support_body:true,steel_arch:true,primary_mesh:false,system_anchor:false,
  lock_foot_anchor:false,advance_support:false,secondary_rebar:false,
};
const canvas=document.getElementById('canvas'),viewport=document.getElementById('viewport');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x091119);
const camera=new THREE.PerspectiveCamera(42,1,.1,6000);
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;
scene.add(new THREE.HemisphereLight(0xddeeff,0x24313e,2.2));
const sun=new THREE.DirectionalLight(0xffffff,2.6);sun.position.set(-150,240,-120);scene.add(sun);

let centerlineObject=null,centerlineData=null,metadata=null,selectedSegment=null;
const segmentGroups=[],segmentRanges=[],typeVisibility=new Map();
let meshInstanceCount=0,drawGroups=0,currentView='overall';
const toggles=document.getElementById('typeToggles');
const segmentVariants=new Map(),segmentVariantAssignments=new Map(),editableMeshStates=new WeakMap();
let supportPayloads={},baseProfileParameters=null,profileDatabase={},selectedEditableComponent='primary_concrete',lastSegmentDependencyValidation=null;
const EDITABLE_PROFILE_TYPES=new Set(['ZZ-IVa','ZZ-IVb','ZZ-Va','ZZ-S']),EDITABLE_COMPONENTS=new Set(['primary_concrete','secondary_lining']);

function componentCategory(component=''){
  if(component==='primary_concrete'||component==='secondary_lining')return 'support_body';
  if(component==='steel_arch')return 'steel_arch';
  if(component==='primary_mesh')return 'primary_mesh';
  if(component==='system_anchor')return 'system_anchor';
  if(component==='lock_foot_anchor')return 'lock_foot_anchor';
  if(component==='advance_support')return 'advance_support';
  if(component==='lattice_arch')return 'steel_arch';
  if(component.startsWith('secondary_rebar_'))return 'secondary_rebar';
  return 'support_body';
}
function selectedGroup(){return segmentGroups.find(group=>Number(group.userData.segment_index)===selectedSegment?.segment_index)||null}
function payloadValue(component,key){
  const confirmed=supportPayloads[selectedSegment?.support_type]?.confirmed||{};
  if(component==='primary_concrete'&&EDITABLE_PROFILE_TYPES.has(selectedSegment?.support_type))return Number(primaryProfileDefaults()[key]);
  if(component==='primary_concrete'&&key==='thickness_mm')return Number(confirmed.primary_support?.total_thickness_mm);
  if(component==='secondary_lining'&&EDITABLE_PROFILE_TYPES.has(selectedSegment?.support_type))return Number(secondaryProfileDefaults()[key]);
  if(component==='secondary_lining'&&key==='thickness_mm')return Number(confirmed.secondary_lining?.thickness_mm);
  if(component==='steel_arch')return Number(confirmed.steel_arch?.[key]);
  if(component==='system_anchor'){const value=confirmed.system_anchor?.[key];return Number(value&&typeof value==='object'?value.value:value)}
  return null;
}
function profileConfiguration(){return SupportProfileRegistry.get(selectedSegment?.support_type)||null}
function isOpenSecondaryProfile(){return profileConfiguration()?.secondary_mode==='OPEN_ARCH_WALL'}
function primaryProfileDefaults(){return {...profileConfiguration()?.primary}}
function secondaryProfileDefaults(){return {...profileConfiguration()?.secondary}}
function componentProfileParameters(record,component,defaults){return Object.fromEntries(Object.keys(defaults).map(key=>[key,Number(recordValue(record,component,key,defaults[key]))]))}
function validateSegmentVariantGeometry(record){
  const advanceParameters=advanceParametersForSegment(selectedSegment,record),advance=advanceParameters?validateAdvanceSupportParameters(advanceParameters):null,latticeParameters=latticeParametersForSegment(selectedSegment,record),lattice=latticeParameters?validateLatticeArchParameters(latticeParameters):null;if(advance?.errors.length)throw new Error(advance.errors.join('；'));if(lattice?.errors.length)throw new Error(lattice.errors.join('；'));
  if(!EDITABLE_PROFILE_TYPES.has(selectedSegment?.support_type))return {advance,lattice};
  const primary=buildPrimarySupportGeometry(componentProfileParameters(record,'primary_concrete',primaryProfileDefaults()),1),secondary=(isOpenSecondaryProfile()?buildOpenSecondaryLiningGeometry:buildSecondaryLiningGeometry)(componentProfileParameters(record,'secondary_lining',secondaryProfileDefaults()),1),relation=validatePrimarySecondarySpatialRelation(primary.profiles,secondary.outer);
  primary.geometry.dispose();secondary.geometry.dispose();
  if(relation.abnormal_intersection)throw new Error(`初支与二衬异常穿插 ${Math.abs(relation.negative_clearance_mm).toFixed(1)} mm`);
  return {relation,advance,lattice};
}
function editableMeshes(component){const result=[];selectedGroup()?.traverse(object=>{if(object.isInstancedMesh&&object.userData.component===component)result.push(object)});return result}
function captureEditableMeshes(group){
  group.traverse(mesh=>{
    if(!mesh.isInstancedMesh||editableMeshStates.has(mesh))return;
    const template=new THREE.Matrix4();if(mesh.count)mesh.getMatrixAt(0,template);
    editableMeshStates.set(mesh,{template:template.clone(),originalCount:mesh.count,capacity:mesh.instanceMatrix.count,originalGeometry:mesh.geometry});
  });
}
function componentDefaults(component){
  const mesh=editableMeshes(component)[0],state=mesh&&editableMeshStates.get(mesh);
  const geometry=component==='primary_concrete'?primaryProfileDefaults():component==='secondary_lining'?secondaryProfileDefaults():{};
  if(component==='advance_support')return {...AdvanceSupportRegistry.get(selectedSegment?.support_type),quantity:state?.originalCount||0,direction:'CHAINAGE_INCREASING'};
  return {...geometry,thickness_mm:payloadValue(component,'thickness_mm'),start_offset_mm:0,longitudinal_spacing_mm:1000,quantity:state?.originalCount||0,direction:'CHAINAGE_INCREASING'};
}
function currentSegmentVariant(){
  if(!selectedSegment)return null;let variant=segmentVariants.get(selectedSegment.segment_index);
  if(!variant){variant=createVariantState(supportPayloads[selectedSegment.support_type]||{support_type:selectedSegment.support_type});Object.assign(variant,{scope:'REAL_TUNNEL_SEGMENT',segment_index:selectedSegment.segment_index,start_chainage:selectedSegment.start_chainage,end_chainage:selectedSegment.end_chainage});segmentVariants.set(selectedSegment.segment_index,variant)}
  return variant;
}
function editableSchemas(component){
  const geometry=componentDefinition(selectedSegment?.support_type,component)?.editable_parameters||[];
  return [...geometry,['start_offset_mm','起始偏移','mm','SYSTEM_DERIVED','PLACEMENT'],['longitudinal_spacing_mm','纵向间距','mm','SYSTEM_DERIVED','PLACEMENT'],['quantity','数量','','SYSTEM_DERIVED','PLACEMENT']];
}
function editableValue(component,key){const fallback=componentDefaults(component)[key];return parameterValue(currentSegmentVariant(),component,key,fallback)}
function sectionFrame(distance){
  const tangent=tangentAt(centerlineData,distance),up=new THREE.Vector3(0,1,0),right=new THREE.Vector3().crossVectors(up,tangent).normalize();
  return new THREE.Matrix4().makeBasis(right,up,tangent).setPosition(pointAt(centerlineData,distance));
}
function ensureCapacity(mesh,required){
  const state=editableMeshStates.get(mesh);if(required<=state.capacity)return mesh;
  const replacement=new THREE.InstancedMesh(mesh.geometry,mesh.material,required);replacement.name=mesh.name;replacement.userData={...mesh.userData};replacement.visible=mesh.visible;
  mesh.parent.add(replacement);mesh.parent.remove(mesh);editableMeshStates.delete(mesh);editableMeshStates.set(replacement,{...state,capacity:required});return replacement;
}
function updateEditableComponent(component){
  if(!selectedSegment||!EDITABLE_PROFILE_TYPES.has(selectedSegment.support_type)||!EDITABLE_COMPONENTS.has(component))return;
  if(component==='primary_concrete'||component==='secondary_lining'){const variant=currentSegmentVariant(),record=sharedVariantRecord(variant,item=>componentDefinition(selectedSegment.support_type,item)?.editable_parameters||[]);validateSegmentVariantGeometry(record);updateSharedVariantComponent(component,record);return}
  const defaults=componentDefaults(component),baseThickness=defaults.thickness_mm,thickness=Number(editableValue(component,'thickness_mm'));
  const offset=Math.max(0,Number(editableValue(component,'start_offset_mm'))/1000),spacing=Math.max(.1,Number(editableValue(component,'longitudinal_spacing_mm'))/1000),requested=Math.max(0,Math.floor(Number(editableValue(component,'quantity'))));
  if(!(baseThickness>0)||!(thickness>0))return;
  const available=Math.max(0,Math.ceil((selectedSegment.centerline_end_distance_m-selectedSegment.centerline_start_distance_m-offset-1e-9)/spacing)),count=Math.min(requested,available);
  for(const original of [...editableMeshes(component)]){
    const mesh=ensureCapacity(original,count),state=editableMeshStates.get(mesh),originFrame=sectionFrame(selectedSegment.centerline_start_distance_m),originInverse=originFrame.clone().invert();
    const radialScale=1+(thickness-baseThickness)/5000,shapeScale=new THREE.Matrix4().makeScale(radialScale,radialScale,1);
    for(let index=0;index<count;index++){
      const station=selectedSegment.centerline_start_distance_m+offset+index*spacing;
      const delta=sectionFrame(station).multiply(originInverse),matrix=delta.multiply(state.template.clone()).multiply(shapeScale);mesh.setMatrixAt(index,matrix);
    }
    mesh.count=count;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
  }
}
function recordValue(record,component,key,fallback){return record?.component_overrides?.[component]?.[key]?.value??record?.user_overrides?.[component]?.[key]?.value??record?.provisional_parameters?.[component]?.[key]?.value??fallback}
function advanceParametersForSegment(segment,record=null){const source=AdvanceSupportRegistry.get(segment?.support_type);if(!source)return null;const confirmed=supportPayloads[segment.support_type]?.confirmed||{},placementRadius=Number(confirmed.inner_profile?.top_radius_mm)+Number(confirmed.secondary_lining?.thickness_mm)+Number(confirmed.primary_support?.reserved_deformation_mm)+Number(confirmed.primary_support?.total_thickness_mm);return {...source,placement_radius_mm:placementRadius,...Object.fromEntries((componentDefinition(segment.support_type,'advance_support')?.editable_parameters||[]).map(schema=>[schema[0],recordValue(record,'advance_support',schema[0],source[schema[0]])]))}}
function rebuildSegmentAdvanceSupport(group,segment,record=null){const parameters=advanceParametersForSegment(segment,record);if(!parameters)return false;const validation=validateAdvanceSupportParameters(parameters);if(validation.errors.length)throw new Error(validation.errors.join('；'));const previous=group.getObjectByName('advanceSupportInstanced');if(previous){previous.geometry.dispose();group.remove(previous)}const layout=advanceSupportLayout(parameters),stations=[];for(let station=segment.centerline_start_distance_m+Number(parameters.start_offset_mm||0)/1000;station<segment.centerline_end_distance_m-1e-9;station+=Number(parameters.longitudinal_cycle_spacing_mm)/1000)stations.push(station);const count=stations.length*layout.rows.length,geometry=createHollowPipeGeometry(parameters.outer_diameter_mm,parameters.wall_thickness_mm,parameters.length_mm),material=new THREE.MeshStandardMaterial({color:0xd6b15f,metalness:.45,roughness:.48}),mesh=new THREE.InstancedMesh(geometry,material,count);mesh.name='advanceSupportInstanced';mesh.userData={...group.userData,component:'advance_support',validation,cycle_count:stations.length,count_per_ring:layout.rows.length,parameters};let index=0;for(const station of stations){const frame=sectionFrame(station);for(const row of layout.rows){const base=row.base.clone().applyMatrix4(frame),direction=row.direction.clone().transformDirection(frame);mesh.setMatrixAt(index++,pipeTransform(base,direction))}}mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.visible=componentVisibility.advance_support;group.add(mesh);editableMeshStates.set(mesh,{template:new THREE.Matrix4(),originalCount:count,capacity:count,originalGeometry:geometry});return true}
function latticeParametersForSegment(segment,record=null){const source=LatticeArchRegistry.get(segment?.support_type);if(!source)return null;return {...source,...Object.fromEntries((componentDefinition(segment.support_type,'lattice_arch')?.editable_parameters||[]).map(schema=>[schema[0],recordValue(record,'lattice_arch',schema[0],source[schema[0]])]))}}
function rebuildSegmentLatticeArch(group,segment,record=null){
  const parameters=latticeParametersForSegment(segment,record);if(!parameters)return false;const validation=validateLatticeArchParameters(parameters);if(validation.errors.length)throw new Error(validation.errors.join('；'));
  [...group.children].filter(child=>child.name.startsWith('latticeArchInstanced_')).forEach(child=>{child.geometry.dispose();group.remove(child)});
  const built=createLatticeArchFrameGeometries(parameters),spacing=Number(parameters.longitudinal_spacing_mm)/1000,stations=[];for(let station=segment.centerline_start_distance_m;station<segment.centerline_end_distance_m-1e-9;station+=spacing)stations.push(station);
  const materials={main:new THREE.MeshStandardMaterial({color:0xb36b35,metalness:.58,roughness:.42}),web:new THREE.MeshStandardMaterial({color:0xd59a55,metalness:.48,roughness:.46}),hoop:new THREE.MeshStandardMaterial({color:0xe2bd78,metalness:.4,roughness:.48}),connector:new THREE.MeshStandardMaterial({color:0x8f9ca8,metalness:.55,roughness:.4})};
  for(const part of ['main','web','hoop','connector']){const partStations=part==='connector'?stations.filter(station=>station+spacing<=segment.centerline_end_distance_m+1e-9):stations,mesh=new THREE.InstancedMesh(built[part],materials[part],partStations.length);mesh.name=`latticeArchInstanced_${part}`;mesh.userData={...group.userData,component:'lattice_arch',part,parameters,validation,representation:'THREE_LEG_LATTICE_TRUE_REBAR_GEOMETRY'};partStations.forEach((station,index)=>mesh.setMatrixAt(index,sectionFrame(station)));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.visible=componentVisibility.steel_arch;group.add(mesh);editableMeshStates.set(mesh,{template:new THREE.Matrix4(),originalCount:partStations.length,capacity:partStations.length,originalGeometry:built[part]});meshInstanceCount+=partStations.length;drawGroups++}
  return true;
}
function updateSelectedPositionDependencies(record){
  if(!selectedSegment||!EDITABLE_PROFILE_TYPES.has(selectedSegment.support_type))return null;
  const baseline=primaryProfileDefaults(),target=componentProfileParameters(record,'primary_concrete',baseline),meshRule=positioningRule(selectedSegment.support_type,'primary_mesh')||{},anchorRule=positioningRule(selectedSegment.support_type,'system_anchor')||{};
  for(const mesh of editableMeshes('primary_mesh')){const state=editableMeshStates.get(mesh);if(state?.originalGeometry)mesh.geometry=buildProfileLinkedGeometry(state.originalGeometry,baseline,target,{surface:'INNER',offsetMm:Number(recordValue(record,'primary_mesh','reference_offset_mm',meshRule.reference_offset_mm??40))})}
  const baseLength=payloadValue('system_anchor','length_mm'),anchorLength=Number(recordValue(record,'system_anchor','length_mm',baseLength)),axialScale=baseLength>0&&anchorLength>0?anchorLength/baseLength:1;
  for(const mesh of editableMeshes('system_anchor')){const state=editableMeshStates.get(mesh);if(state?.originalGeometry)mesh.geometry=buildProfileLinkedGeometry(state.originalGeometry,baseline,target,{surface:'OUTER',offsetMm:0,axialScale})}
  const steelConfirmed=supportPayloads[selectedSegment.support_type]?.confirmed?.steel_arch||{},steel={R1_mm:Number(recordValue(record,'steel_arch','R1_mm',steelConfirmed.R1_mm)),R2_mm:Number(recordValue(record,'steel_arch','R2_mm',steelConfirmed.R2_mm)),beta_deg:Number(recordValue(record,'steel_arch','beta_deg',steelConfirmed.beta_deg)),steel_profile:recordValue(record,'steel_arch','steel_profile',steelConfirmed.steel_profile)},secondary=componentProfileParameters(record,'secondary_lining',secondaryProfileDefaults()),primaryGeometry=buildPrimarySupportGeometry(target,1),secondaryGeometry=(isOpenSecondaryProfile()?buildOpenSecondaryLiningGeometry:buildSecondaryLiningGeometry)(secondary,1),relation=validatePrimarySecondarySpatialRelation(primaryGeometry.profiles,secondaryGeometry.outer);primaryGeometry.geometry.dispose();secondaryGeometry.geometry.dispose();
  lastSegmentDependencyValidation=evaluatePrimaryComponentDependencies({primary:target,steel,steelSection:profileDatabase[steel.steel_profile],meshOffsetMm:Number(recordValue(record,'primary_mesh','reference_offset_mm',meshRule.reference_offset_mm??40)),meshDiameterMm:Number(payloadValue('primary_mesh','diameter_mm')||8),meshMode:recordValue(record,'primary_mesh','positioning_mode',meshRule.positioning_mode||'FOLLOW_PRIMARY_INNER'),anchorMode:recordValue(record,'system_anchor','positioning_mode',anchorRule.positioning_mode||'FOLLOW_PRIMARY_OUTER'),primarySecondary:relation});
  return lastSegmentDependencyValidation;
}
function updateSharedVariantComponent(component,record){
  if(!selectedSegment||!['primary_concrete','secondary_lining','steel_arch','system_anchor','advance_support','lattice_arch'].includes(component))return false;
  if(component==='advance_support')return rebuildSegmentAdvanceSupport(selectedGroup(),selectedSegment,record);
  if(component==='lattice_arch')return rebuildSegmentLatticeArch(selectedGroup(),selectedSegment,record);
  const meshes=editableMeshes(component);if(!meshes.length)return false;
  let spacing=1,offset=0,scaleX=1,scaleY=1;
  let replacementGeometry=null;
  if(component==='primary_concrete'&&EDITABLE_PROFILE_TYPES.has(selectedSegment.support_type)){
    replacementGeometry=buildPrimarySupportGeometry(componentProfileParameters(record,component,primaryProfileDefaults()),1).geometry;
  }else if(component==='secondary_lining'&&EDITABLE_PROFILE_TYPES.has(selectedSegment.support_type)){
    const parameters=componentProfileParameters(record,component,secondaryProfileDefaults());replacementGeometry=(isOpenSecondaryProfile()?buildOpenSecondaryLiningGeometry:buildSecondaryLiningGeometry)(parameters,1).geometry;
  }else if(component==='primary_concrete'||component==='secondary_lining'){
    const base=payloadValue(component,'thickness_mm'),value=Number(recordValue(record,component,'thickness_mm',base));if(!(base>0&&value>0))return false;scaleX=scaleY=1+(value-base)/5000;
  }else if(component==='steel_arch'){
    const b1=payloadValue(component,'R1_mm'),b2=payloadValue(component,'R2_mm'),bb=payloadValue(component,'beta_deg'),r1=Number(recordValue(record,component,'R1_mm',b1)),r2=Number(recordValue(record,component,'R2_mm',b2)),beta=Number(recordValue(record,component,'beta_deg',bb));if(!(b1>0&&b2>0&&bb>0&&r1>0&&r2>0&&beta>0))return false;scaleX=(r1/b1+r2/b2)/2;scaleY=scaleX*Math.sqrt(beta/bb);spacing=Number(recordValue(record,component,'longitudinal_spacing_mm',(selectedSegment.spacing_m?.steel_arch_m||1)*1000))/1000;
  }else if(component==='system_anchor'){
    const base=payloadValue(component,'length_mm'),value=Number(recordValue(record,component,'length_mm',base));if(!(base>0&&value>0))return false;scaleX=scaleY=value/base;spacing=Number(recordValue(record,component,'longitudinal_spacing_mm',(selectedSegment.spacing_m?.system_anchor_m||1)*1000))/1000;
  }
  spacing=Math.max(.1,spacing);offset=Math.max(0,Number(recordValue(record,component,'start_offset_mm',0))/1000);
  const available=Math.max(0,Math.ceil((selectedSegment.centerline_end_distance_m-selectedSegment.centerline_start_distance_m-offset-1e-9)/spacing)),requested=Number(recordValue(record,component,'quantity',available)),count=Math.min(available,Number.isFinite(requested)?Math.max(0,Math.floor(requested)):available);
  for(const original of [...meshes]){
    const mesh=ensureCapacity(original,count),state=editableMeshStates.get(mesh),originInverse=sectionFrame(selectedSegment.centerline_start_distance_m).invert(),shapeScale=new THREE.Matrix4().makeScale(scaleX,scaleY,1);if(replacementGeometry)mesh.geometry=replacementGeometry;
    for(let index=0;index<count;index++){const station=selectedSegment.centerline_start_distance_m+offset+index*spacing,delta=sectionFrame(station).multiply(originInverse);mesh.setMatrixAt(index,delta.multiply(state.template.clone()).multiply(shapeScale))}
    mesh.count=count;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
  }
  if(component==='primary_concrete')updateSelectedPositionDependencies(record);
  return true;
}
function assignmentRows(){return metadata.support_segments.map(segment=>({start_chainage:segment.start_chainage,end_chainage:segment.end_chainage,support_type:segment.support_type,variant_id:segmentVariantAssignments.get(segment.segment_index)||'ORIGINAL'}))}
function refreshVariantOptions(){
  const select=document.getElementById('availableSegmentVariant');if(!selectedSegment){select.innerHTML='<option value="ORIGINAL">原始工程方案</option>';return}
  const variants=variantsForSupport(selectedSegment.support_type);select.innerHTML='<option value="ORIGINAL">原始工程方案</option>'+variants.map(item=>`<option value="${item.variant_id}">${item.variant_name} · ${item.variant_id.slice(0,8)}</option>`).join('');
  const assigned=segmentVariantAssignments.get(selectedSegment.segment_index)||'ORIGINAL',saved=variants.find(item=>item.variant_id===assigned),local=segmentVariants.get(selectedSegment.segment_index);
  if(assigned!=='ORIGINAL'&&!saved&&local){const option=document.createElement('option');option.value=assigned;option.textContent=`${local.variant_name||'未命名方案'}（未保存）`;select.appendChild(option)}
  select.value=assigned;document.getElementById('currentSegmentPlan').textContent=assigned==='ORIGINAL'?'原始工程方案':(saved?.variant_name||`${local?.variant_name||'未命名方案'}（未保存）`);
}
function restoreSelectedSegment(){
  if(!selectedSegment)return;segmentVariants.delete(selectedSegment.segment_index);segmentVariantAssignments.delete(selectedSegment.segment_index);
  const original=currentSegmentVariant();
  for(const component of ['primary_concrete','secondary_lining','steel_arch','system_anchor','advance_support','lattice_arch'])updateSharedVariantComponent(component,sharedVariantRecord(original,()=>[]));
  refreshVariantOptions();buildSegmentParameterEditor();document.getElementById('segmentVariantStatus').textContent='已恢复原始工程方案';
}
function applySharedVariant(record){
  if(!selectedSegment||record.support_type!==selectedSegment.support_type)throw new Error('VARIANT_SUPPORT_TYPE_MISMATCH');validateSegmentVariantGeometry(record);const variant=hydrateSharedVariant(record,supportPayloads[selectedSegment.support_type]);
  const original=createVariantState(supportPayloads[selectedSegment.support_type]||{support_type:selectedSegment.support_type}),originalRecord=sharedVariantRecord(original,()=>[]);
  for(const component of ['primary_concrete','secondary_lining','steel_arch','system_anchor','advance_support','lattice_arch'])updateSharedVariantComponent(component,originalRecord);
  segmentVariants.set(selectedSegment.segment_index,variant);segmentVariantAssignments.set(selectedSegment.segment_index,record.variant_id);
  const applied=Object.keys(record.component_overrides||{}).filter(component=>updateSharedVariantComponent(component,record));if(record.component_overrides?.primary_concrete)updateSelectedPositionDependencies(record);refreshVariantOptions();buildSegmentParameterEditor();const warning=lastSegmentDependencyValidation?.warnings?.length?'；'+lastSegmentDependencyValidation.warnings.join('；'):'';document.getElementById('segmentVariantStatus').textContent=`已应用到区段 ${selectedSegment.segment_index}：${record.variant_name}（更新 ${applied.join('、')||'当前无可重建构件'}）${warning}`;
}
function buildSegmentParameterEditor(){
  const notice=document.getElementById('segmentEditorNotice'),editor=document.getElementById('segmentEditor'),direct=document.getElementById('directEditor');
  if(!selectedSegment){editor.hidden=true;notice.hidden=false;notice.textContent='请选择一个区段。';return}
  editor.hidden=false;document.getElementById('editSupportType').href=`./support_master_demo_v1_2.html?support_type=${encodeURIComponent(selectedSegment.support_type)}${segmentVariantAssignments.has(selectedSegment.segment_index)?`&variant=${encodeURIComponent(segmentVariantAssignments.get(selectedSegment.segment_index))}`:''}`;refreshVariantOptions();
  if(!EDITABLE_PROFILE_TYPES.has(selectedSegment.support_type)){direct.hidden=true;notice.hidden=false;notice.textContent=`${selectedSegment.support_type} 请通过“编辑该支护类型”创建Variant，再返回此处应用。`;return}
  notice.hidden=true;direct.hidden=false;const component=selectedEditableComponent,variant=currentSegmentVariant();
  document.getElementById('editableComponent').value=component;let kind='';
  document.getElementById('componentParameterEditor').innerHTML=editableSchemas(component).map(schema=>{const [key,labelName,unit,status,parameterKind='GEOMETRY']=schema,value=editableValue(component,key),record=variant.user_overrides?.[component]?.[key],heading=parameterKind!==kind?`<div class="parameter-heading">${parameterKind==='PLACEMENT'?'布设参数':'构件自身参数'}</div>`:'';kind=parameterKind;return `${heading}<div class="row"><span>${labelName}</span><span><input type="number" min="0" step="${key==='thickness_mm'?1:key==='quantity'?1:100}" value="${value}" data-segment-param="${key}"> ${unit} <i class="parameter-status" data-segment-param-status="${key}">${record?'USER_OVERRIDE':status}</i></span></div>`}).join('');
  document.querySelectorAll('[data-segment-param]').forEach(input=>input.addEventListener('input',()=>{const value=Number(input.value);if(!Number.isFinite(value))return;const schema=editableSchemas(component).find(row=>row[0]===input.dataset.segmentParam),record=setOverride(variant,component,input.dataset.segmentParam,value,schema[3]),tag=document.querySelector(`[data-segment-param-status="${input.dataset.segmentParam}"]`);if(tag){tag.textContent=record.status;tag.className='parameter-status'}try{updateEditableComponent(component);segmentVariantAssignments.set(selectedSegment.segment_index,variant.variant_id);refreshVariantOptions();const warning=lastSegmentDependencyValidation?.warnings?.length?'；'+lastSegmentDependencyValidation.warnings.join('；'):'';document.getElementById('segmentVariantStatus').textContent=`仅更新区段 ${selectedSegment.segment_index} 的${component==='primary_concrete'?'初支混凝土':'二衬混凝土'} · USER_OVERRIDE${warning}`}catch(error){document.getElementById('segmentVariantStatus').textContent='几何未更新：'+error.message}}));
}
function downloadJson(name,data){const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000)}
function exportTunnelGlb(){
  const root=new THREE.Group();root.name='TunnelSupportAlongCenterLine';root.userData={support_range:'YK1+098_YK2+162',segment_variant_assignment:assignmentRows(),variant_metadata_version:'SupportVariant/V1'};
  for(const group of segmentGroups){const copy=group.clone(true);copy.visible=true;copy.traverse(object=>{object.visible=true});root.add(copy)}
  new GLTFExporter().parse(root,buffer=>{const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([buffer],{type:'model/gltf-binary'}));link.download='real_YK1+098_YK2+162_support_with_variants.glb';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000)},error=>{document.getElementById('segmentVariantStatus').textContent='GLB导出失败：'+error.message},{binary:true,onlyVisible:false});
}
function resize(){const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
window.addEventListener('resize',resize);resize();
function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera)}animate();
function matrixKey(mesh){return `${mesh.geometry.uuid}|${mesh.material.uuid}`}
function optimizeSegment(source){
  if(source.getObjectByProperty('isInstancedMesh',true)){
    source.traverse(object=>{if(object.isInstancedMesh){meshInstanceCount+=object.count;drawGroups++;object.userData={...source.userData,...object.userData}}});
    source.removeFromParent();return source;
  }
  source.updateMatrixWorld(true);const buckets=new Map();
  source.traverse(object=>{if(!object.isMesh)return;const key=`${matrixKey(object)}|${object.userData?.component||''}`;if(!buckets.has(key))buckets.set(key,{geometry:object.geometry,material:object.material,component:object.userData?.component,matrices:[]});buckets.get(key).matrices.push(object.matrixWorld.clone())});
  const target=new THREE.Group();target.name=source.name;target.userData={...source.userData};
  for(const bucket of buckets.values()){const item=new THREE.InstancedMesh(bucket.geometry,bucket.material,bucket.matrices.length);bucket.matrices.forEach((matrix,index)=>item.setMatrixAt(index,matrix));item.instanceMatrix.needsUpdate=true;item.userData={...source.userData,component:bucket.component};target.add(item);meshInstanceCount+=bucket.matrices.length;drawGroups++}
  return target;
}
function pointAt(data,distance){const values=data.chainage;let hi=values.findIndex(value=>value>=distance);if(hi<0)return new THREE.Vector3(...data.points.at(-1));if(hi===0)return new THREE.Vector3(...data.points[0]);const lo=hi-1,ratio=(distance-values[lo])/(values[hi]-values[lo]);return new THREE.Vector3(...data.points[lo]).lerp(new THREE.Vector3(...data.points[hi]),ratio)}
function tangentAt(data,distance){const delta=.5,start=Math.max(0,distance-delta),end=Math.min(data.chainage.at(-1),distance+delta);return pointAt(data,end).sub(pointAt(data,start)).normalize()}
function segmentPoints(data,start,end){const points=[pointAt(data,start)];data.chainage.forEach((value,index)=>{if(value>start&&value<end)points.push(new THREE.Vector3(...data.points[index]))});points.push(pointAt(data,end));return points}
function label(value){const km=Math.floor(value/1000),remainder=value-km*1000;return `YK${km}+${remainder.toFixed(3).padStart(7,'0')}`}

function refreshVisibility(){
  for(const group of segmentGroups){const typeOn=typeVisibility.get(group.userData.support_type)!==false;group.visible=typeOn;group.traverse(object=>{if(object.isInstancedMesh)object.visible=typeOn&&componentVisibility[componentCategory(object.userData.component)]!==false})}
  const rangesOn=document.getElementById('showRanges').checked;
  for(const range of segmentRanges)range.visible=rangesOn&&typeVisibility.get(range.userData.support_type)!==false;
  if(centerlineObject)centerlineObject.visible=document.getElementById('showCenterline').checked;
}
function setSupportVisible(type,visible){typeVisibility.set(type,visible);document.querySelectorAll(`[data-type="${type}"]`).forEach(input=>input.checked=visible);refreshVisibility();syncAllTypesCheckbox()}
function setComponentVisible(category,visible){componentVisibility[category]=visible;const input=document.querySelector(`[data-component="${category}"]`);if(input)input.checked=visible;refreshVisibility()}
function syncAllTypesCheckbox(){const values=[...typeVisibility.values()],input=document.getElementById('showAll');input.checked=values.length>0&&values.every(Boolean);input.indeterminate=values.some(Boolean)&&!values.every(Boolean)}

function modelBox(){
  const box=new THREE.Box3();
  // Hidden anchors and reinforcement can extend well beyond the default body view.
  // Fit only currently visible engineering meshes, while always retaining the full
  // 0-1064 m route extent so the overall view includes every support segment.
  for(const group of segmentGroups){
    if(!group.visible)continue;
    group.updateWorldMatrix(true,true);
    group.traverse(object=>{if(object.isInstancedMesh&&object.visible)box.expandByObject(object,true)});
  }
  if(centerlineObject)box.expandByObject(centerlineObject,true);
  return box;
}
function expandVisibleGroup(box,group){
  if(!group?.visible)return;
  group.updateWorldMatrix(true,true);
  group.traverse(object=>{if(object.isInstancedMesh&&object.visible)box.expandByObject(object,true)});
}
function neighborhood(segment){
  if(!segment||!metadata)return [];
  const rows=metadata.support_segments,index=rows.findIndex(item=>item.segment_index===segment.segment_index);
  return rows.slice(Math.max(0,index-1),Math.min(rows.length,index+2));
}
function neighborhoodBox(segment){
  const rows=neighborhood(segment),indices=new Set(rows.map(item=>item.segment_index)),box=new THREE.Box3();
  segmentGroups.filter(group=>indices.has(Number(group.userData.segment_index))).forEach(group=>expandVisibleGroup(box,group));
  for(const row of rows)segmentPoints(centerlineData,row.centerline_start_distance_m,row.centerline_end_distance_m).forEach(point=>box.expandByPoint(point));
  return box;
}
function projectedDistance(box,target,viewDirection,up,margin=1.18){
  const direction=viewDirection.clone().normalize(),screenRight=new THREE.Vector3().crossVectors(up,direction).normalize();
  let halfWidth=1,halfHeight=1;
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
    const offset=new THREE.Vector3(x,y,z).sub(target);halfWidth=Math.max(halfWidth,Math.abs(offset.dot(screenRight)));halfHeight=Math.max(halfHeight,Math.abs(offset.dot(up)));
  }
  const verticalFov=THREE.MathUtils.degToRad(camera.fov),horizontalFov=2*Math.atan(Math.tan(verticalFov/2)*camera.aspect);
  return Math.max(halfHeight/Math.tan(verticalFov/2),halfWidth/Math.tan(horizontalFov/2))*margin;
}
function applyCamera(target,direction,up,distance){
  camera.up.copy(up);controls.target.copy(target);camera.position.copy(target).addScaledVector(direction,distance);
  camera.near=.1;camera.far=Math.max(6000,distance*8);camera.updateProjectionMatrix();controls.minDistance=.5;controls.maxDistance=Math.max(6000,distance*8);controls.update();
}
function overallViewDirection(){
  if(!centerlineData)return new THREE.Vector3(.7,.45,-.55).normalize();
  const route=pointAt(centerlineData,Math.min(1064,centerlineData.chainage.at(-1))).sub(pointAt(centerlineData,0)).normalize();
  const up=new THREE.Vector3(0,1,0);let right=new THREE.Vector3().crossVectors(up,route);
  if(right.lengthSq()<1e-8)right.set(1,0,0);else right.normalize();
  return right.multiplyScalar(.78).addScaledVector(up,.46).addScaledVector(route,-.42).normalize();
}
function fitCamera(){
  const box=modelBox();if(box.isEmpty())return;
  const sphere=box.getBoundingSphere(new THREE.Sphere()),center=sphere.center,radius=Math.max(sphere.radius,1);
  const verticalFov=THREE.MathUtils.degToRad(camera.fov),horizontalFov=2*Math.atan(Math.tan(verticalFov/2)*camera.aspect);
  const limitingFov=Math.min(verticalFov,horizontalFov),distance=radius/Math.sin(limitingFov/2)*1.12;
  applyCamera(center,overallViewDirection(),new THREE.Vector3(0,1,0),distance);
  controls.minDistance=Math.max(.5,radius*.01);controls.maxDistance=distance*4;
}
function focusSegment(){return selectedSegment||metadata?.support_segments?.find(item=>item.support_type==='ZZ-IVa'&&item.model_status!=='MODEL_INCOMPLETE')||metadata?.support_segments?.find(item=>item.model_status!=='MODEL_INCOMPLETE')}
function setView(view){
  if(!centerlineData||!metadata)return;currentView=view;document.querySelectorAll('[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view===view));
  if(view==='overall'){fitCamera();return}
  const segment=focusSegment(),station=(segment.centerline_start_distance_m+segment.centerline_end_distance_m)/2;
  const position=pointAt(centerlineData,station),tangent=tangentAt(centerlineData,station),up=new THREE.Vector3(0,1,0),right=new THREE.Vector3().crossVectors(up,tangent).normalize();
  const localBox=neighborhoodBox(segment),target=localBox.isEmpty()?position:localBox.getCenter(new THREE.Vector3());
  if(view==='focus'){
    const direction=right.clone().multiplyScalar(.72).addScaledVector(up,.38).addScaledVector(tangent,-.48).normalize();
    const sphere=localBox.getBoundingSphere(new THREE.Sphere()),verticalFov=THREE.MathUtils.degToRad(camera.fov),horizontalFov=2*Math.atan(Math.tan(verticalFov/2)*camera.aspect);
    applyCamera(target,direction,up,Math.max(12,sphere.radius/Math.sin(Math.min(verticalFov,horizontalFov)/2)*1.08));return;
  }
  if(view==='front'){const sectionTarget=position.clone().addScaledVector(up,2.2),distance=Math.max(14,projectedDistance(localBox,sectionTarget,tangent.clone().negate(),up,1.12));applyCamera(sectionTarget,tangent.clone().negate(),up,distance);return}
  if(view==='longitudinal'){const distance=Math.max(18,projectedDistance(localBox,target,right,up,1.14));applyCamera(target,right,up,distance)}
}

function authoritativeSegment(data){
  if(!data)return null;
  if(data.segment_index)return metadata.support_segments.find(item=>item.segment_index===data.segment_index)||null;
  return metadata.support_segments.find(item=>item.support_type===data.support_type&&Math.abs(item.start_chainage-Number(data.start_chainage))<1e-6&&Math.abs(item.end_chainage-Number(data.end_chainage))<1e-6)||null;
}
function selectSegment(segment){
  if(!segment)return;selectedSegment=segment;document.getElementById('focusSelected').disabled=false;
  document.getElementById('segmentSelect').value=String(segment.segment_index);
  segmentRanges.forEach(range=>{const selected=range.userData.segment_index===segment.segment_index;range.material.opacity=selected?1:(range.userData.model_status==='MODEL_INCOMPLETE'?1:.7);range.material.color.set(selected?0xffffff:(colors[range.userData.support_type]||0xaab4bd))});
  document.getElementById('picked').innerHTML=`<b>${segment.support_type}</b><br>${label(segment.start_chainage)} ～ ${label(segment.end_chainage)}<br>${segment.model_status}`;
  const missing=(segment.component_status||[]).filter(item=>item.status==='NOT_IMPLEMENTED').map(item=>item.id);
  document.getElementById('segmentInfo').innerHTML=`区段：${segment.segment_index}<br>支护类型：<b>${segment.support_type}</b><br>起点：${label(segment.start_chainage)}<br>终点：${label(segment.end_chainage)}<br>状态：${segment.model_status}<br>未实现：${missing.join('、')||'无'}`;
  buildSegmentParameterEditor();
  setView('focus');
}

window.realTunnelDemo={
  ready:false,
  getSummary:()=>({ready:window.realTunnelDemo.ready,segmentCount:metadata?.support_segments?.length||0,modeledSegmentCount:metadata?.modeled_segment_count||0,incompleteSegmentCount:metadata?.incomplete_segment_count||0,meshInstanceCount,engineeringComponentCount:metadata?.mesh_instance_count||0,drawGroups,frameValidation:metadata?.frame_validation||null,centerlineVisible:centerlineObject?.visible??false,rangeLinesVisible:document.getElementById('showRanges').checked,componentVisibility:{...componentVisibility},visibleTypes:[...typeVisibility].filter(([,visible])=>visible).map(([type])=>type),selectedSegmentIndex:selectedSegment?.segment_index||null,segmentVariantAssignment:assignmentRows(),currentView,camera:camera.position.toArray()}),
  setSupportVisible,setComponentVisible,setView,
  selectSegment:index=>selectSegment(metadata?.support_segments?.find(item=>item.segment_index===index)),
  getSegmentVariant:index=>{const variant=segmentVariants.get(index);return variant?publicVariant(variant):null},
  setSegmentParameter:(index,component,key,value)=>{const segment=metadata?.support_segments?.find(item=>item.segment_index===index);if(!segment)throw new Error('SEGMENT_NOT_FOUND');selectSegment(segment);selectedEditableComponent=component;const schema=editableSchemas(component).find(row=>row[0]===key);if(!schema)throw new Error('PARAMETER_NOT_EDITABLE');setOverride(currentSegmentVariant(),component,key,value,schema[3]);updateEditableComponent(component);buildSegmentParameterEditor()},
};

async function load(){
  const started=performance.now();
  const [centerline,state,payloadRows,profileParameters,steelProfiles]=await Promise.all([
    fetch('../outputs/centerline/real_centerline_0_1064m.json').then(response=>{if(!response.ok)throw new Error('真实centerLine读取失败');return response.json()}),
    fetch('../outputs/centerline/real_YK1+098_YK2+162_support.metadata.json').then(response=>{if(!response.ok)throw new Error('metadata读取失败');return response.json()}),
    fetch('../outputs/master_demo/support_payloads_v1_2.json').then(response=>{if(!response.ok)throw new Error('SupportParameterPayload读取失败');return response.json()}),
    fetch('../outputs/base_profile/ZZ-Va_base_profile_parameters.json').then(response=>{if(!response.ok)throw new Error('ZZ-Va内轮廓参数读取失败');return response.json()}),
    fetch('../database/steel_profiles.json').then(response=>{if(!response.ok)throw new Error('型钢数据库读取失败');return response.json()}),
  ]);centerlineData=centerline;metadata=state.metadata;supportPayloads=payloadRows;baseProfileParameters=profileParameters;profileDatabase=steelProfiles;
  const points=centerline.points.map(point=>new THREE.Vector3(...point));centerlineObject=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0xffef72}));centerlineObject.name='realCenterLine0To1064m';scene.add(centerlineObject);
  for(const segment of metadata.support_segments){const range=new THREE.Line(new THREE.BufferGeometry().setFromPoints(segmentPoints(centerline,segment.centerline_start_distance_m,segment.centerline_end_distance_m)),new THREE.LineBasicMaterial({color:colors[segment.support_type]||0xaab4bd,transparent:true,opacity:segment.model_status==='MODEL_INCOMPLETE'?1:.7}));range.userData={kind:'SupportSegmentRange',...segment};scene.add(range);segmentRanges.push(range)}
  const gltf=await new GLTFLoader().loadAsync('../outputs/centerline/real_YK1+098_YK2+162_support.glb');
  const sourceSegments=[];gltf.scene.traverse(object=>{if(object.userData?.kind==='SupportSegment')sourceSegments.push(object)});
  for(let index=0;index<sourceSegments.length;index++){const source=sourceSegments[index],optimized=optimizeSegment(source),segment=metadata.support_segments[index];optimized.userData={...optimized.userData,segment_index:segment.segment_index};if(AdvanceSupportRegistry.has(segment.support_type))rebuildSegmentAdvanceSupport(optimized,segment);if(LatticeArchRegistry.has(segment.support_type))rebuildSegmentLatticeArch(optimized,segment);captureEditableMeshes(optimized);scene.add(optimized);segmentGroups.push(optimized)}
  const distinct=[...new Set(metadata.support_segments.map(item=>item.support_type))];
  document.getElementById('segmentSelect').innerHTML='<option value="">请选择</option>'+metadata.support_segments.map(item=>`<option value="${item.segment_index}">${String(item.segment_index).padStart(2,'0')} · ${item.support_type} · ${label(item.start_chainage)}～${label(item.end_chainage)}</option>`).join('');
  for(const type of distinct){typeVisibility.set(type,true);const rows=metadata.support_segments.filter(item=>item.support_type===type),incomplete=rows.every(item=>item.model_status==='MODEL_INCOMPLETE'),row=document.createElement('div');row.className='row';row.innerHTML=`<label><input type="checkbox" data-type="${type}" checked> <span style="color:#${(colors[type]||0xaab4bd).toString(16).padStart(6,'0')}">●</span> ${type}</label><span class="status ${incomplete?'incomplete':''}">${rows.length}段${incomplete?' · 不完整':''}</span>`;toggles.appendChild(row)}
  refreshVisibility();setView('overall');window.realTunnelDemo.ready=true;window.realTunnelDemo.loadSeconds=(performance.now()-started)/1000;
  document.getElementById('loadState').innerHTML='<span class="ok">23段映射完成</span>';
  const transitions=metadata.segment_transition||[],discontinuous=transitions.filter(item=>Math.abs(item.continuous_gap_m||0)>1e-6||item.duplicate_boundary===true);
  const incomplete=metadata.support_segments.filter(item=>item.model_status==='MODEL_INCOMPLETE').map(item=>item.support_type);
  document.getElementById('modelInfo').innerHTML=`GLB：${(state.glb.byte_length/1024/1024).toFixed(2)} MB<br>成功装配：${metadata.modeled_segment_count}/23段<br>仅范围：${metadata.incomplete_segment_count}段（${incomplete.join('、')}）<br>区段里程连续：${discontinuous.length?'<span class="bad">否</span>':'<span class="ok">是</span>'}<br>工程构件：${metadata.mesh_instance_count.toLocaleString()}<br>浏览器实例节点：${meshInstanceCount.toLocaleString()}<br>绘制批次：${drawGroups}<br>加载：${window.realTunnelDemo.loadSeconds.toFixed(2)} s<br>断面翻转：${metadata.frame_validation.section_flip_detected?'<span class="bad">检测到</span>':'<span class="ok">无</span>'}`;
}

document.getElementById('showCenterline').addEventListener('change',refreshVisibility);
document.getElementById('showRanges').addEventListener('change',refreshVisibility);
document.getElementById('showAll').addEventListener('change',event=>{for(const type of typeVisibility.keys())typeVisibility.set(type,event.target.checked);document.querySelectorAll('[data-type]').forEach(input=>input.checked=event.target.checked);refreshVisibility();syncAllTypesCheckbox()});
toggles.addEventListener('change',event=>{if(event.target.dataset.type)setSupportVisible(event.target.dataset.type,event.target.checked)});
document.querySelectorAll('[data-component]').forEach(input=>input.addEventListener('change',event=>setComponentVisible(event.target.dataset.component,event.target.checked)));
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
document.getElementById('focusSelected').addEventListener('click',()=>{if(selectedSegment)setView('focus')});
document.getElementById('fitModel').addEventListener('click',()=>setView('overall'));
document.getElementById('editableComponent').addEventListener('change',event=>{selectedEditableComponent=event.target.value;buildSegmentParameterEditor()});
document.getElementById('segmentSelect').addEventListener('change',event=>{const segment=metadata?.support_segments?.find(item=>item.segment_index===Number(event.target.value));if(segment)selectSegment(segment)});
document.getElementById('restoreSegmentParameters').addEventListener('click',restoreSelectedSegment);
document.getElementById('applySegmentVariant').addEventListener('click',()=>{try{const id=document.getElementById('availableSegmentVariant').value;if(id==='ORIGINAL'){restoreSelectedSegment();return}const record=variantsForSupport(selectedSegment.support_type).find(item=>item.variant_id===id);if(!record)throw new Error('VARIANT_NOT_FOUND');applySharedVariant(record)}catch(error){document.getElementById('segmentVariantStatus').textContent='应用失败：'+error.message}});
document.getElementById('saveSegmentVariant').addEventListener('click',()=>{if(!selectedSegment)return;try{const variant=currentSegmentVariant();variant.variant_name=document.getElementById('segmentVariantName').value||'区段方案A';variant.support_type=selectedSegment.support_type;variant.base_support_type=selectedSegment.support_type;variant.created_time=variant.created_time||new Date().toISOString();const record=sharedVariantRecord(variant,component=>componentDefinition(selectedSegment.support_type,component)?.editable_parameters||[]);validateSegmentVariantGeometry(record);record.scope='REAL_TUNNEL_SEGMENT';record.segment_index=selectedSegment.segment_index;saveVariantToLibrary(record);segmentVariantAssignments.set(selectedSegment.segment_index,record.variant_id);downloadJson(`SupportVariant_segment_${selectedSegment.segment_index}_${record.variant_name}.json`,record);refreshVariantOptions();document.getElementById('segmentVariantStatus').textContent='方案已保存到共享库：'+record.variant_name}catch(error){document.getElementById('segmentVariantStatus').textContent='方案未保存：'+error.message}});
document.getElementById('loadSegmentVariant').addEventListener('change',async event=>{try{if(!selectedSegment)throw new Error('请先选择区段');const record=JSON.parse(await event.target.files[0].text());if(record.support_type!==selectedSegment.support_type)throw new Error('VARIANT_SUPPORT_TYPE_MISMATCH');saveVariantToLibrary(record);applySharedVariant(record);document.getElementById('segmentVariantName').value=record.variant_name||'区段方案A';document.getElementById('segmentVariantStatus').textContent='方案已加载、共享并应用：'+(record.variant_name||'未命名')}catch(error){document.getElementById('segmentVariantStatus').textContent='加载失败：'+error.message}});
document.getElementById('exportTunnelGlb').addEventListener('click',exportTunnelGlb);
window.addEventListener('focus',()=>{if(selectedSegment)refreshVariantOptions()});window.addEventListener('storage',()=>{if(selectedSegment)refreshVariantOptions()});

const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();raycaster.params.Line.threshold=2;
canvas.addEventListener('click',event=>{
  const rect=canvas.getBoundingClientRect();pointer.x=(event.clientX-rect.left)/rect.width*2-1;pointer.y=-(event.clientY-rect.top)/rect.height*2+1;raycaster.setFromCamera(pointer,camera);
  const meshes=[];segmentGroups.filter(group=>group.visible).forEach(group=>group.traverse(object=>{if(object.isInstancedMesh&&object.visible)meshes.push(object)}));
  const meshHit=raycaster.intersectObjects(meshes,false)[0],rangeHit=raycaster.intersectObjects(segmentRanges.filter(range=>range.visible),false)[0];
  const hit=meshHit||rangeHit;if(!hit)return;selectSegment(authoritativeSegment(hit.object.userData));
});
load().catch(error=>{console.error(error);document.getElementById('loadState').innerHTML=`<span class="bad">${error.message}</span>`});
