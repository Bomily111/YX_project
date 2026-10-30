export const COMPONENTS = [
  {id:'primary_concrete',label:'初支混凝土',group:'primarySupportConcreteGroup',system:'初支体系'},
  {id:'primary_mesh',label:'初支钢筋网',group:'primarySupportMeshGroup',system:'初支体系'},
  {id:'steel_arch',label:'I20a钢架',group:'steelArchArrayGroup',system:'初支体系'},
  {id:'system_anchor',label:'系统锚杆',group:'systemAnchorGroup',system:'初支体系'},
  {id:'lock_foot',label:'锁脚锚管',group:'lockFootAnchorGroup',system:'初支体系'},
  {id:'secondary_lining',label:'二衬混凝土',group:'secondaryLiningGroup',system:'二衬体系'},
  {id:'N1',label:'N1',group:'N1Group',system:'二衬体系'},
  {id:'N2',label:'N2',group:'N2Group',system:'二衬体系'},
  {id:'N3',label:'N3',group:'N3Group',system:'二衬体系'},
  {id:'N4',label:'N4',group:'N4Group',system:'二衬体系'},
];

export const DEPENDENCY_MAP = {
  steel_arch:['steel_arch','lock_foot'],
  primary_concrete:['primary_concrete','primary_mesh'],
  primary_mesh:['primary_mesh'], system_anchor:['system_anchor'], lock_foot:['lock_foot'],
  secondary_lining:['secondary_lining','N1','N2','N3','N4'],
  N1:['N1','N3','N4'], N2:['N2','N3','N4'], N3:['N3'], N4:['N4'],
};

export const EXPLODED_Z_ORDER = {
  primarySupportConcreteGroup:-2.5, primarySupportMeshGroup:-1.8, steelArchArrayGroup:-1.0,
  systemAnchorGroup:-0.3, lockFootAnchorGroup:0.4, secondaryLiningGroup:1.2,
  N1Group:2.0, N2Group:2.0, N3Group:2.0, N4Group:2.0,
};

export const PARAMETER_SCHEMAS = {
  primary_concrete:[['thickness_mm','厚度','mm','CONFIRMED',260]],
  primary_mesh:[['circumferential_spacing_mm','环向间距','mm','CONFIRMED',200],['longitudinal_spacing_mm','纵向间距','mm','CONFIRMED',200],['reference_side','参考侧别','','PROVISIONAL','ROCK_SIDE']],
  steel_arch:[['R1_mm','R1','mm','CONFIRMED',6220],['R2_mm','R2','mm','CONFIRMED',10720],['beta_deg','β','°','CONFIRMED',15.6664],['longitudinal_spacing_mm','纵向间距','mm','CONFIRMED',800],['profile','型钢型号','','CONFIRMED','I20a']],
  system_anchor:[['length_mm','长度','mm','CONFIRMED',4000],['circumferential_spacing_mm','环向间距','mm','CONFIRMED',1200],['longitudinal_spacing_mm','纵向间距','mm','CONFIRMED',800]],
  lock_foot:[['upper_height_mm','上级高度','mm','PROVISIONAL',250],['lower_height_mm','下级高度','mm','PROVISIONAL',100],['upper_angle_deg','上级角度','°','PROVISIONAL',7.5],['lower_angle_deg','下级角度','°','PROVISIONAL',45],['pair_spread_deg','双管张开角','°','PROVISIONAL',10]],
  secondary_lining:[['thickness_mm','厚度','mm','CONFIRMED',500]],
  N1:[['diameter_mm','直径','mm','CONFIRMED',22]], N2:[['diameter_mm','直径','mm','CONFIRMED',22]],
  N3:[['circumferential_spacing_mm','环向间距','mm','CONFIRMED',250]],
  N4:[['circumferential_spacing_mm','环向间距','mm','CONFIRMED',500],['longitudinal_spacing_mm','纵向间距','mm','CONFIRMED',250]],
};

export function createVariantState(basePayload={}){
  return {variant_id:crypto.randomUUID?.()||`variant-${Date.now()}`,variant_name:'方案A',support_type:basePayload.support_type||'ZZ-Va',base_payload:basePayload,user_overrides:{},provisional_parameters:{},timestamp:new Date().toISOString()};
}
export function setOverride(variant,component,key,value,status){
  const target=status==='PROVISIONAL'?'provisional_parameters':'user_overrides';
  variant[target][component]??={}; variant[target][component][key]={value,status:'USER_OVERRIDE'}; variant.timestamp=new Date().toISOString();
  return variant[target][component][key];
}
export function restoreComponent(variant,component){delete variant.user_overrides[component];delete variant.provisional_parameters[component];variant.timestamp=new Date().toISOString()}
export function parameterValue(variant,component,key,fallback){return variant.user_overrides?.[component]?.[key]?.value??variant.provisional_parameters?.[component]?.[key]?.value??fallback}
export function publicVariant(variant){return JSON.parse(JSON.stringify(variant))}

export const SUPPORT_VARIANT_LIBRARY_KEY='SupportParameterExtractor.SupportVariants.V1';
export function sharedVariantRecord(variant,schemaForComponent=()=>[]){
  const component_overrides={};
  for(const source of [variant.user_overrides||{},variant.provisional_parameters||{}])for(const [component,values] of Object.entries(source))component_overrides[component]={...(component_overrides[component]||{}),...values};
  const geometry_parameters={},layout_parameters={};
  for(const [component,values] of Object.entries(component_overrides))for(const [key,record] of Object.entries(values)){
    const schema=schemaForComponent(component).find(row=>row[0]===key),target=schema?.[4]==='PLACEMENT'?layout_parameters:geometry_parameters;
    target[component]??={};target[component][key]=record;
  }
  return {...publicVariant(variant),variant_id:variant.variant_id,variant_name:variant.variant_name||'方案A',support_type:variant.support_type,base_support_type:variant.base_support_type||variant.support_type,component_overrides,geometry_parameters,layout_parameters,created_time:variant.created_time||variant.timestamp||new Date().toISOString()};
}
export function loadVariantLibrary(){
  try{const rows=JSON.parse(localStorage.getItem(SUPPORT_VARIANT_LIBRARY_KEY)||'[]');return Array.isArray(rows)?rows:[]}catch{return []}
}
export function saveVariantToLibrary(record){
  const rows=loadVariantLibrary(),index=rows.findIndex(item=>item.variant_id===record.variant_id);if(index>=0)rows[index]=record;else rows.push(record);
  localStorage.setItem(SUPPORT_VARIANT_LIBRARY_KEY,JSON.stringify(rows));return record;
}
export function variantsForSupport(supportType){return loadVariantLibrary().filter(item=>item.support_type===supportType)}
export function hydrateSharedVariant(record,basePayload={}){
  return {...record,base_payload:record.base_payload||basePayload,user_overrides:record.user_overrides||record.component_overrides||{},provisional_parameters:record.provisional_parameters||{}};
}
