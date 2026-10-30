/** 多支护类型定义。定义只描述能力和字段，不保存OCR工程值。 */
const COMPONENT_CATALOG = {
  primary_concrete:{id:'primary_concrete',label:'初支混凝土',group:'primarySupportConcreteGroup',system:'初支体系'},
  primary_mesh:{id:'primary_mesh',label:'初支钢筋网',group:'primarySupportMeshGroup',system:'初支体系'},
  steel_arch:{id:'steel_arch',label:'钢架',group:'steelArchArrayGroup',system:'初支体系'},
  system_anchor:{id:'system_anchor',label:'系统锚杆',group:'systemAnchorGroup',system:'初支体系'},
  lock_foot:{id:'lock_foot',label:'锁脚锚管',group:'lockFootAnchorGroup',system:'初支体系'},
  advance_support:{id:'advance_support',label:'超前中管棚',group:'advanceSupportGroup',system:'超前支护'},
  lattice_arch:{id:'lattice_arch',label:'三肢格栅钢架',group:'latticeArchGroup',system:'二衬体系'},
  secondary_lining:{id:'secondary_lining',label:'二衬混凝土',group:'secondaryLiningGroup',system:'二衬体系'},
  N1:{id:'N1',label:'N1',group:'N1Group',system:'二衬体系'},
  N2:{id:'N2',label:'N2',group:'N2Group',system:'二衬体系'},
  N3:{id:'N3',label:'N3',group:'N3Group',system:'二衬体系'},
  N4:{id:'N4',label:'N4',group:'N4Group',system:'二衬体系'},
  N5:{id:'N5',label:'N5 纵向分布筋',group:'N5Group',system:'二衬体系'},
  N6:{id:'N6',label:'N6 一般段箍筋',group:'N6Group',system:'二衬体系'},
  N7:{id:'N7',label:'N7 墙脚区箍筋',group:'N7Group',system:'二衬体系'},
};

const FULL_COMPONENT_IDS=Object.keys(COMPONENT_CATALOG);
// editable_parameters: key, label, unit, evidence status, parameter class.
// parameter class keeps geometry and longitudinal/positioning controls consistent
// across primary and secondary support without changing component geometry code.
const closedSecondaryLiningSchema=[
  ['inner_top_radius_mm','顶拱内轮廓半径','mm','CONFIRMED','GEOMETRY'],['inner_top_angle_deg','顶拱角度','°','CONFIRMED','GEOMETRY'],
  ['inner_side_radius_mm','侧拱内轮廓半径','mm','CONFIRMED','GEOMETRY'],['inner_side_angle_deg','侧拱角度','°','CONFIRMED','GEOMETRY'],
  ['invert_transition_radius_mm','仰拱过渡半径','mm','CONFIRMED','GEOMETRY'],['invert_transition_angle_deg','仰拱过渡角度','°','CONFIRMED','GEOMETRY'],
  ['invert_bottom_radius_mm','仰拱底半径','mm','CONFIRMED','GEOMETRY'],['invert_bottom_angle_deg','仰拱底角度','°','CONFIRMED','GEOMETRY'],
  ['thickness_mm','二衬厚度','mm','CONFIRMED','GEOMETRY'],
];
const openSecondaryLiningSchema=[['inner_top_radius_mm','顶拱内轮廓半径','mm','CONFIRMED','GEOMETRY'],['inner_side_radius_mm','侧拱内轮廓半径','mm','CONFIRMED','GEOMETRY'],['side_angle_deg','侧拱角度','°','CONFIRMED','GEOMETRY'],['thickness_mm','二衬厚度','mm','CONFIRMED','GEOMETRY']];
const primaryConcreteProfileSchema=[['inner_top_radius_mm','顶拱内表面半径','mm','CONFIRMED','GEOMETRY'],['inner_side_radius_mm','侧拱内表面半径','mm','CONFIRMED','GEOMETRY'],['side_angle_deg','侧拱角度','°','CONFIRMED','GEOMETRY'],['thickness_mm','初支厚度','mm','CONFIRMED','GEOMETRY']];
const zpmSecondarySchema=[
  ['R1','内顶拱半径 R1','mm','CONFIRMED','GEOMETRY'],['angle1','内顶拱总角','°','CONFIRMED','GEOMETRY'],
  ['R2','内侧拱半径 R2','mm','CONFIRMED','GEOMETRY'],['angle2','单侧侧拱角','°','CONFIRMED','GEOMETRY'],
  ['R3','内过渡半径 R3','mm','CONFIRMED','GEOMETRY'],['angle3','单侧过渡角','°','CONFIRMED','GEOMETRY'],
  ['R4','内仰拱半径 R4','mm','CONFIRMED','GEOMETRY'],['angle4','内仰拱总角','°','CONFIRMED','GEOMETRY'],
  ['crownY','内拱顶高程','mm','CONFIRMED','GEOMETRY'],['outerR1','外顶拱半径','mm','CONFIRMED','GEOMETRY'],
  ['wallLength','外直墙长度','mm','CONFIRMED','GEOMETRY'],['footWidth','单侧墙脚水平宽','mm','CONFIRMED','GEOMETRY'],
  ['outerR4','外仰拱半径','mm','CONFIRMED','GEOMETRY'],['outerAngle4','外仰拱总角','°','CONFIRMED','GEOMETRY'],
  ['outerCrownY','外拱顶高程','mm','CONFIRMED','GEOMETRY'],['length','单断面纵向建模长度','m','CONFIRMED','PLACEMENT'],
];
const zpmN1Schema=[['n1Radius','N1 顶拱轴线半径','mm','CONFIRMED','GEOMETRY'],['n1Angle','N1 顶拱总角','°','CONFIRMED','GEOMETRY'],['n1CenterY','N1 圆心高程','mm','CONFIRMED','GEOMETRY'],['n1Wall','N1 单侧直墙长度','mm','CONFIRMED','GEOMETRY'],['n1Return','N1 墙脚回折长','mm','CONFIRMED','GEOMETRY'],['mainDiameter','N1～N4 主筋直径','mm','CONFIRMED','GEOMETRY'],['ringSpacing','主筋纵向间距','mm','CONFIRMED','PLACEMENT']];
const zpmN2Schema=[['n2Radius','N2 顶拱轴线半径','mm','CONFIRMED','GEOMETRY'],['n2Angle','N2 顶拱总角','°','CONFIRMED','GEOMETRY'],['n2CenterY','N2 圆心高程','mm','CONFIRMED','GEOMETRY'],['n2SideRadius','N2 侧拱轴线半径','mm','CONFIRMED','GEOMETRY'],['n2SideAngle','N2 单侧侧拱角','°','CONFIRMED','GEOMETRY']];
const zpmN3Schema=[['n3Radius','N3 仰拱轴线半径','mm','CONFIRMED','GEOMETRY'],['n3Angle','N3 仰拱总角','°','CONFIRMED','GEOMETRY'],['n3CenterY','N3 圆心高程','mm','CONFIRMED','GEOMETRY'],['invertPhase','仰拱主筋纵向错位','mm','NEEDS_CONFIRMATION','PLACEMENT']];
const zpmN4Schema=[['n4Radius','N4 仰拱轴线半径','mm','CONFIRMED','GEOMETRY'],['n4Angle','N4 仰拱总角','°','CONFIRMED','GEOMETRY'],['n4CenterY','N4 圆心高程','mm','CONFIRMED','GEOMETRY']];
const zpmN5Schema=[['longDiameter','N5 纵筋直径','mm','CONFIRMED','GEOMETRY'],['longSpacing','N5 环向间距','mm','CONFIRMED','PLACEMENT']];
const zpmN6Schema=[['tieDiameter','N6/N7 箍筋直径','mm','CONFIRMED','GEOMETRY'],['tieSpacing','箍筋环向间距','mm','CONFIRMED','PLACEMENT'],['tieZSpacing','箍筋纵向间距','mm','CONFIRMED','PLACEMENT'],['tieShift','相邻排环向错位','mm','CONFIRMED','PLACEMENT'],['tieHookAngle','箍筋弯钩转角','°','NEEDS_CONFIRMATION','GEOMETRY'],['tieBendR','箍筋轴线弯曲半径','mm','CONFIRMED','GEOMETRY'],['tieTail','箍筋弯钩直尾','mm','NEEDS_CONFIRMATION','GEOMETRY']];
// N7 shares the confirmed N6/N7 diameter and spacing controls above.  The
// exact wall-foot split is not exposed until the project team confirms the
// S-PM/Z-PM applicability and node rule.
const zpmN7Schema=[];
const schemas={
  primary_concrete:[['thickness_mm','厚度','mm','CONFIRMED','GEOMETRY']],
  primary_mesh:[['diameter_mm','直径','mm','CONFIRMED','GEOMETRY'],['circumferential_spacing_mm','环向间距','mm','CONFIRMED','PLACEMENT'],['longitudinal_spacing_mm','纵向间距','mm','CONFIRMED','PLACEMENT'],['layers','层数','','CONFIRMED','PLACEMENT'],['reference_side','参考侧别','','PROVISIONAL','PLACEMENT'],['reference_offset_mm','距初支内表面','mm','CONFIRMED','PLACEMENT'],['positioning_mode','轮廓联动模式','','PROVISIONAL','PLACEMENT']],
  steel_arch:[['R1_mm','R1','mm','CONFIRMED','GEOMETRY'],['R2_mm','R2','mm','CONFIRMED','GEOMETRY'],['beta_deg','β','°','CONFIRMED','GEOMETRY'],['steel_profile','型钢型号','','CONFIRMED','GEOMETRY'],['longitudinal_spacing_mm','纵向间距','mm','CONFIRMED','PLACEMENT']],
  system_anchor:[['diameter_mm','直径','mm','CONFIRMED','GEOMETRY'],['length_mm','长度','mm','CONFIRMED','GEOMETRY'],['circumferential_spacing_mm','环向间距','mm','CONFIRMED','PLACEMENT'],['longitudinal_spacing_mm','纵向间距','mm','CONFIRMED','PLACEMENT'],['positioning_mode','起点联动模式','','CONFIRMED','PLACEMENT']],
  lock_foot:[['upper_height_mm','上级高度','mm','PROVISIONAL','PLACEMENT'],['lower_height_mm','下级高度','mm','PROVISIONAL','PLACEMENT'],['upper_angle_deg','上级角度','°','PROVISIONAL','PLACEMENT'],['lower_angle_deg','下级角度','°','PROVISIONAL','PLACEMENT'],['pair_spread_deg','双管张开角','°','PROVISIONAL','PLACEMENT']],
  advance_support:[['outer_diameter_mm','钢花管外径','mm','CONFIRMED','GEOMETRY'],['wall_thickness_mm','壁厚','mm','CONFIRMED','GEOMETRY'],['length_mm','单根长度','mm','CONFIRMED','GEOMETRY'],['crown_angle_deg','拱部布设范围','°','CONFIRMED','PLACEMENT'],['circumferential_spacing_mm','环向间距','mm','CONFIRMED','PLACEMENT'],['external_angle_deg','外插角','°','NEEDS_CONFIRMATION','PLACEMENT'],['start_offset_mm','首环起始偏移','mm','NEEDS_CONFIRMATION','PLACEMENT'],['longitudinal_cycle_spacing_mm','纵向循环间距','mm','CONFIRMED','PLACEMENT']],
  lattice_arch:[['outer_top_radius_mm','N3顶拱半径','mm','CONFIRMED','GEOMETRY'],['inner_top_radius_mm','N4/N5顶拱半径','mm','CONFIRMED','GEOMETRY'],['outer_side_radius_mm','N3侧拱半径','mm','CONFIRMED','GEOMETRY'],['inner_side_radius_mm','N4/N5侧拱半径','mm','CONFIRMED','GEOMETRY'],['side_angle_deg','侧拱角度','°','CONFIRMED','GEOMETRY'],['main_bar_diameter_mm','N3/N4/N5主筋直径','mm','CONFIRMED','GEOMETRY'],['triangle_width_mm','三肢截面宽度','mm','CONFIRMED','GEOMETRY'],['triangle_height_mm','三肢截面高度','mm','CONFIRMED','GEOMETRY'],['web_bar_diameter_mm','N7桁架筋直径','mm','CONFIRMED','GEOMETRY'],['web_pitch_mm','N7环向节距','mm','CONFIRMED','PLACEMENT'],['hoop_diameter_mm','N8箍筋直径','mm','CONFIRMED','GEOMETRY'],['hoop_pitch_mm','N8环向间距','mm','CONFIRMED','PLACEMENT'],['longitudinal_connector_diameter_mm','纵向连接筋直径','mm','CONFIRMED','GEOMETRY'],['longitudinal_connector_circumferential_spacing_mm','纵向连接筋环向间距','mm','CONFIRMED','PLACEMENT'],['longitudinal_spacing_mm','格栅纵向间距','mm','CONFIRMED','PLACEMENT']],
  secondary_lining:[['thickness_mm','厚度','mm','CONFIRMED','GEOMETRY']],
  N1:[['diameter_mm','直径','mm','CONFIRMED','GEOMETRY']],N2:[['diameter_mm','直径','mm','CONFIRMED','GEOMETRY']],
  N3:[['circumferential_spacing_mm','环向间距','mm','CONFIRMED','PLACEMENT']],
  N4:[['circumferential_spacing_mm','环向间距','mm','CONFIRMED','PLACEMENT'],['longitudinal_spacing_mm','主筋纵向间距','mm','CONFIRMED','PLACEMENT']],
};

function components(statuses,schemaOverrides={}){return FULL_COMPONENT_IDS.map(id=>({...COMPONENT_CATALOG[id],status:statuses[id]||(['lattice_arch','N5','N6','N7'].includes(id)?'NOT_APPLICABLE':'NOT_IMPLEMENTED'),editable_parameters:schemaOverrides[id]||schemas[id]||[]}))}

const vaStatus={primary_concrete:'READY',primary_mesh:'PARTIAL',steel_arch:'READY',system_anchor:'READY',lock_foot:'PARTIAL',secondary_lining:'READY',N1:'READY',N2:'READY',N3:'READY',N4:'READY'};
const ivaStatus={primary_concrete:'READY',primary_mesh:'PARTIAL',steel_arch:'READY',system_anchor:'READY',lock_foot:'NOT_APPLICABLE',secondary_lining:'READY',N1:'NOT_APPLICABLE',N2:'NOT_APPLICABLE',N3:'NOT_APPLICABLE',N4:'NOT_APPLICABLE'};
const ivbStatus={primary_concrete:'READY',primary_mesh:'PARTIAL',steel_arch:'READY',system_anchor:'READY',lock_foot:'NOT_APPLICABLE',secondary_lining:'READY',N1:'NOT_IMPLEMENTED',N2:'NOT_IMPLEMENTED',N3:'NOT_IMPLEMENTED',N4:'NOT_IMPLEMENTED'};
const sStatus={primary_concrete:'READY',primary_mesh:'PARTIAL',steel_arch:'READY',system_anchor:'READY',lock_foot:'PARTIAL',secondary_lining:'READY',N1:'READY',N2:'READY',N3:'READY',N4:'READY'};
const iiStatus={primary_concrete:'READY',primary_mesh:'NOT_APPLICABLE',steel_arch:'NOT_APPLICABLE',system_anchor:'NOT_IMPLEMENTED',lock_foot:'NOT_APPLICABLE',secondary_lining:'READY',N1:'NOT_APPLICABLE',N2:'NOT_APPLICABLE',N3:'NOT_APPLICABLE',N4:'NOT_APPLICABLE'};
const iiiStatus={primary_concrete:'READY',primary_mesh:'NOT_IMPLEMENTED',steel_arch:'NOT_APPLICABLE',system_anchor:'NOT_IMPLEMENTED',lock_foot:'NOT_APPLICABLE',secondary_lining:'READY',N1:'NOT_APPLICABLE',N2:'NOT_APPLICABLE',N3:'NOT_APPLICABLE',N4:'NOT_APPLICABLE'};
const iiixStatus={...iiiStatus,lattice_arch:'PARTIAL'};
const ivcStatus={primary_concrete:'READY',primary_mesh:'PARTIAL',steel_arch:'NOT_IMPLEMENTED',system_anchor:'READY',lock_foot:'NOT_APPLICABLE',secondary_lining:'READY',N1:'READY',N2:'READY',N3:'NOT_IMPLEMENTED',N4:'NOT_IMPLEMENTED'};
const ivxStatus={primary_concrete:'READY',primary_mesh:'PARTIAL',steel_arch:'NOT_IMPLEMENTED',system_anchor:'PARTIAL',lock_foot:'NOT_APPLICABLE',secondary_lining:'READY',N1:'READY',N2:'READY',N3:'NOT_IMPLEMENTED',N4:'NOT_IMPLEMENTED'};
const vsxStatus={primary_concrete:'READY',primary_mesh:'PARTIAL',steel_arch:'READY',system_anchor:'PARTIAL',lock_foot:'PARTIAL',secondary_lining:'READY',N1:'READY',N2:'READY',N3:'NOT_IMPLEMENTED',N4:'NOT_IMPLEMENTED'};
const qjsxStatus={...vsxStatus,advance_support:'PARTIAL'};
const y1Status={primary_concrete:'READY',primary_mesh:'NOT_IMPLEMENTED',steel_arch:'NOT_APPLICABLE',system_anchor:'NOT_IMPLEMENTED',lock_foot:'NOT_APPLICABLE',secondary_lining:'READY',N1:'NOT_APPLICABLE',N2:'NOT_APPLICABLE',N3:'NOT_APPLICABLE',N4:'NOT_APPLICABLE'};
const ivaComponents=components(ivaStatus,{primary_concrete:primaryConcreteProfileSchema,secondary_lining:openSecondaryLiningSchema});
const ivbComponents=components(ivbStatus,{primary_concrete:primaryConcreteProfileSchema,secondary_lining:closedSecondaryLiningSchema});
const vaComponents=components(vaStatus,{primary_concrete:primaryConcreteProfileSchema,secondary_lining:closedSecondaryLiningSchema});
const sComponents=components(sStatus,{primary_concrete:primaryConcreteProfileSchema,secondary_lining:closedSecondaryLiningSchema});

// 仅保存已由正式图纸/既有装配代码确认的截面参数。初支内表面半径的
// DERIVED_FROM_LAYER_RELATION 来源为：二衬外轮廓 + 已确认预留变形量。
export const SupportProfileRegistry=new Map([
  ['ZZ-IVa',{secondary_mode:'OPEN_ARCH_WALL',source_pages:[74,76,95],primary:{inner_top_radius_mm:5980,inner_side_radius_mm:10480,side_angle_deg:16+49/60+41/3600,thickness_mm:220,source_status:'DERIVED_FROM_LAYER_RELATION'},secondary:{inner_top_radius_mm:5500,inner_side_radius_mm:10000,side_angle_deg:16+49/60+41/3600,thickness_mm:400,source_status:'CONFIRMED'}}],
  ['ZZ-IVb',{secondary_mode:'CLOSED_WITH_INVERT',source_pages:[74,76,100],primary:{inner_top_radius_mm:5980,inner_side_radius_mm:10480,side_angle_deg:11+41/60+58/3600,thickness_mm:220,source_status:'DERIVED_FROM_LAYER_RELATION'},secondary:{inner_top_radius_mm:5500,inner_top_angle_deg:180,inner_side_radius_mm:10000,inner_side_angle_deg:11+41/60+58/3600,invert_transition_radius_mm:1200,invert_transition_angle_deg:55+53/60+29/3600,invert_bottom_radius_mm:12000,invert_bottom_angle_deg:44+49/60+6/3600,thickness_mm:400,source_status:'CONFIRMED'}}],
  ['ZZ-Va',{secondary_mode:'CLOSED_WITH_INVERT',source_pages:[76,109,111],primary:{inner_top_radius_mm:6100,inner_side_radius_mm:10600,side_angle_deg:15.6664,thickness_mm:260,source_status:'CONFIRMED'},secondary:{inner_top_radius_mm:5500,inner_top_angle_deg:180,inner_side_radius_mm:10000,inner_side_angle_deg:11+41/60+58/3600,invert_transition_radius_mm:1200,invert_transition_angle_deg:55+53/60+29/3600,invert_bottom_radius_mm:12000,invert_bottom_angle_deg:44+49/60+6/3600,thickness_mm:500,source_status:'CONFIRMED'}}],
  ['ZZ-S',{secondary_mode:'CLOSED_WITH_INVERT',source_pages:[74,76,113],primary:{inner_top_radius_mm:6120,inner_side_radius_mm:10620,side_angle_deg:11+41/60+58/3600,thickness_mm:260,source_status:'DERIVED_FROM_LAYER_RELATION'},secondary:{inner_top_radius_mm:5500,inner_top_angle_deg:180,inner_side_radius_mm:10000,inner_side_angle_deg:11+41/60+58/3600,invert_transition_radius_mm:1200,invert_transition_angle_deg:55+53/60+29/3600,invert_bottom_radius_mm:12000,invert_bottom_angle_deg:44+49/60+6/3600,thickness_mm:500,source_status:'CONFIRMED'}}],
]);

// ZZ-QJsx 第132页明确采用Φ76中管棚，通用构造图第264页给出钢管构造和角度范围。
// 外插角只有5°～12°范围；5°仅作为范围内初始显示值，始终保留 NEEDS_CONFIRMATION。
export const AdvanceSupportRegistry=new Map([
  ['ZZ-QJsx',{component_name:'超前中管棚',pipe_specification:'Φ76×6热轧无缝钢花管',outer_diameter_mm:76,wall_thickness_mm:6,length_mm:9000,crown_angle_deg:120,circumferential_spacing_mm:400,external_angle_deg:5,external_angle_range_deg:[5,12],external_angle_status:'NEEDS_CONFIRMATION',start_offset_mm:0,start_offset_status:'NEEDS_CONFIRMATION',longitudinal_cycle_spacing_mm:5500,minimum_overlap_mm:1000,reference_surface:'EXCAVATION_PROFILE',source_pages:[132,264],source_status:'PARTIAL'}],
]);

// ZZ-IIIx 第118页数量表和第119页构造大样。端部R55弯折方向在平面图中
// 无法唯一映射到三维局部坐标，因此连接筋主体按2m有效跨距生成并保留确认状态。
export const LatticeArchRegistry=new Map([
  ['ZZ-IIIx',{support_type:'ZZ-IIIx',component_name:'三肢格栅钢架',main_bar_count:3,outer_top_radius_mm:5690,inner_top_radius_mm:5590,outer_side_radius_mm:10190,inner_side_radius_mm:10090,side_angle_deg:16+35/60+20/3600,main_bar_diameter_mm:20,triangle_width_mm:115,triangle_height_mm:100,web_bar_diameter_mm:12,web_pitch_mm:340,hoop_diameter_mm:12,hoop_pitch_mm:300,longitudinal_connector_diameter_mm:22,longitudinal_connector_circumferential_spacing_mm:2000,longitudinal_connector_design_length_mm:2226,longitudinal_spacing_mm:2000,frame_piece_count:5,secondary_inner_top_radius_mm:5500,secondary_inner_side_radius_mm:10000,secondary_lining_thickness_mm:350,connector_end_geometry_status:'NEEDS_CONFIRMATION',source_pages:[117,118,119],source_drawing:'S5-2-3-2-11',source_status:'PARTIAL'}],
]);

// The concrete page is explicitly titled Z-PM.  The reinforcement sheet has
// an internal "S-PM" caption while its title block and drawing number remain
// Z-PM / S5-2-3-1-1.  Rebar geometry is therefore available but stays PARTIAL
// until the project team confirms that applicability relationship.
export const ZpmLiningRegistry=new Map([
  ['Z-PM',{support_type:'Z-PM',source_pages:[84,85],source_drawing:'S5-2-3-1-1',concrete_source_title:'Z-PM型衬砌',rebar_internal_title:'S-PM型衬砌钢筋布置',rebar_title_block:'主洞道Z-PM型衬砌断面图',rebar_applicability_status:'NEEDS_CONFIRMATION',R1:5500,R2:10000,R3:1200,R4:12000,angle1:180,angle2:11+41/60+58/3600,angle3:55+53/60+29/3600,angle4:44+49/60+6/3600,crownY:7600,outerR1:6050,outerAngle1:180,wallLength:3515.0970546555873,footWidth:1549,outerR4:12550,outerAngle4:42.03405962010346,outerCrownY:8150,referenceHalfWidth:4250,length:1,mainDiameter:25,longDiameter:12,ringSpacing:250,longSpacing:250,tieDiameter:8,tieSpacing:500,tieZSpacing:250,tieShift:250,tieHookAngle:135,tieBendR:20,tieTail:40,n7Threshold:500,stationStart:0,n1Radius:5987.5,n1Angle:180,n1CenterY:2100,n1Wall:3452,n1Return:1886,n2Radius:5562.5,n2Angle:180,n2CenterY:2100,n2SideRadius:10062.5,n2SideAngle:20+3/60+58/3600,n3Radius:12062.5,n3Angle:59.52066417656965,n3CenterY:10300,n4Radius:12487.5,n4Angle:57.302823035876216,n4CenterY:10300,invertPhase:0,cover:50,source_status:'PARTIAL',pending_relations:['S-PM_Z-PM_APPLICABILITY','WELDED_LAP_DETAIL','MAIN_BAR_END_HOOK_DETAIL']}],
]);

export const SupportTypeRegistry=new Map([
  ['Z-PM',{id:'Z-PM',display_name:'Z-PM',implementation_status:'ZPM_SINGLE_SECTION_PARTIAL_IMPLEMENTED',components:components({primary_concrete:'NOT_APPLICABLE',primary_mesh:'NOT_APPLICABLE',steel_arch:'NOT_APPLICABLE',system_anchor:'NOT_APPLICABLE',lock_foot:'NOT_APPLICABLE',secondary_lining:'READY',N1:'PARTIAL',N2:'PARTIAL',N3:'PARTIAL',N4:'PARTIAL',N5:'PARTIAL',N6:'PARTIAL',N7:'PARTIAL'},{secondary_lining:zpmSecondarySchema,N1:zpmN1Schema,N2:zpmN2Schema,N3:zpmN3Schema,N4:zpmN4Schema,N5:zpmN5Schema,N6:zpmN6Schema,N7:zpmN7Schema}),parameter_sources:{secondary_lining:'ZpmLiningRegistry · page 84',secondary_rebar:'ZpmLiningRegistry · page 85'},geometry_capabilities:{zpm_lining:true,secondary_lining_parametric:true,secondary_rebar_n1_n7:true,partial_assembly:true,centerline_assembly:false},provisional_parameters:['secondary_rebar.S-PM_Z-PM_applicability','secondary_rebar.welded_lap_detail','secondary_rebar.main_bar_end_hook_detail']}],
  ['ZB-PM',{id:'ZB-PM',display_name:'ZB-PM',implementation_status:'SPECIAL_GEOMETRY_NOT_IMPLEMENTED',components:components({primary_concrete:'NOT_APPLICABLE',primary_mesh:'NOT_APPLICABLE',steel_arch:'NOT_APPLICABLE',system_anchor:'NOT_APPLICABLE',lock_foot:'NOT_APPLICABLE',secondary_lining:'NOT_IMPLEMENTED',N1:'NOT_IMPLEMENTED',N2:'NOT_IMPLEMENTED',N3:'NOT_IMPLEMENTED',N4:'NOT_IMPLEMENTED'})}],
  ['ZZ-II',{id:'ZZ-II',display_name:'ZZ-II',implementation_status:'BATCH_PARTIAL_IMPLEMENTED',components:components(iiStatus),parameter_sources:{all:'SupportParameterPayload'},geometry_capabilities:{partial_assembly:true}}],
  ['ZZ-III',{id:'ZZ-III',display_name:'ZZ-III',implementation_status:'BATCH_PARTIAL_IMPLEMENTED',components:components(iiiStatus),parameter_sources:{all:'SupportParameterPayload'},geometry_capabilities:{partial_assembly:true}}],
  ['ZZ-IVa',{id:'ZZ-IVa',display_name:'ZZ-IVa',implementation_status:'SECOND_SUPPORT_TYPE_MOSTLY_IMPLEMENTED',components:ivaComponents,parameter_sources:{all:'SupportParameterPayload',profile:'SupportProfileRegistry'},geometry_capabilities:{steel_arch:true,primary_concrete_parametric:true,secondary_lining_parametric:true,secondary_mode:'OPEN_ARCH_WALL',full_assembly:true},provisional_parameters:['primary_mesh.steel_connection_relation']}],
  ['ZZ-IVb',{id:'ZZ-IVb',display_name:'ZZ-IVb',implementation_status:'THIRD_SUPPORT_TYPE_PARTIALLY_IMPLEMENTED',components:ivbComponents,parameter_sources:{all:'SupportParameterPayload',profile:'SupportProfileRegistry'},geometry_capabilities:{steel_arch:true,primary_concrete_parametric:true,secondary_lining_parametric:true,secondary_mode:'CLOSED_WITH_INVERT',full_assembly:false,partial_assembly:true},provisional_parameters:['primary_mesh.reference_side']}],
  ['ZZ-IVc',{id:'ZZ-IVc',display_name:'ZZ-IVc',implementation_status:'BATCH_PARTIAL_IMPLEMENTED',components:components(ivcStatus),parameter_sources:{all:'SupportParameterPayload'},geometry_capabilities:{partial_assembly:true},missing_parameters:['I18.section_dimensions','N3_N4.adapter']}],
  ['ZZ-Va',{id:'ZZ-Va',display_name:'ZZ-Va',implementation_status:'FULLY_IMPLEMENTED',components:vaComponents,parameter_sources:{all:'SupportParameterPayload',primary_concrete_profile:'confirmed.primary_support.regions',secondary_lining_profile:'outputs/base_profile/ZZ-Va_base_profile_parameters.json'},geometry_capabilities:{steel_arch:true,primary_concrete_parametric:true,secondary_lining_parametric:true,full_assembly:true}}],
  ['ZZ-S',{id:'ZZ-S',display_name:'ZZ-S',implementation_status:'FOURTH_SUPPORT_TYPE_IMPLEMENTED',components:sComponents,parameter_sources:{all:'SupportParameterPayload',profile:'SupportProfileRegistry'},geometry_capabilities:{steel_arch:true,primary_concrete_parametric:true,secondary_lining_parametric:true,secondary_mode:'CLOSED_WITH_INVERT',full_assembly:true},provisional_parameters:['primary_mesh.reference_side','lock_foot.installation_geometry']}],
  ['ZZ-IIIx',{id:'ZZ-IIIx',display_name:'ZZ-IIIx',implementation_status:'THREE_LEG_LATTICE_PARTIAL_IMPLEMENTED',components:components(iiixStatus),parameter_sources:{all:'SupportParameterPayload',lattice_arch:'LatticeArchRegistry · pages 118/119'},geometry_capabilities:{lattice_arch:true,partial_assembly:true},provisional_parameters:['lattice_arch.longitudinal_connector_end_geometry']}],
  ['ZZ-IVx',{id:'ZZ-IVx',display_name:'ZZ-IVx',implementation_status:'BATCH_PARTIAL_IMPLEMENTED',components:components(ivxStatus),parameter_sources:{all:'SupportParameterPayload'},geometry_capabilities:{partial_assembly:true},missing_parameters:['I18.section_dimensions','N3_N4.adapter']}],
  ['ZZ-IVsx',{id:'ZZ-IVsx',display_name:'ZZ-IVsx',implementation_status:'BATCH_PARTIAL_IMPLEMENTED',components:components(ivxStatus),parameter_sources:{all:'SupportParameterPayload'},geometry_capabilities:{partial_assembly:true},missing_parameters:['I18.section_dimensions','N3_N4.adapter']}],
  ['ZZ-Vsx',{id:'ZZ-Vsx',display_name:'ZZ-Vsx',implementation_status:'BATCH_PARTIAL_IMPLEMENTED',components:components(vsxStatus),parameter_sources:{all:'SupportParameterPayload'},geometry_capabilities:{steel_arch:true,partial_assembly:true},provisional_parameters:['primary_mesh.reference_side','system_anchor.region_assignment','lock_foot.installation_geometry']}],
  ['ZZ-QJsx',{id:'ZZ-QJsx',display_name:'ZZ-QJsx',implementation_status:'BATCH_PARTIAL_IMPLEMENTED',components:components(qjsxStatus),parameter_sources:{all:'SupportParameterPayload',advance_support:'AdvanceSupportRegistry · pages 132/264'},geometry_capabilities:{steel_arch:true,advance_support:true,partial_assembly:true},provisional_parameters:['primary_mesh.reference_side','system_anchor.region_assignment','lock_foot.installation_geometry','advance_support.external_angle_deg']}],
  ['ZZ-Y1',{id:'ZZ-Y1',display_name:'ZZ-Y1',implementation_status:'BATCH_PARTIAL_IMPLEMENTED',components:components(y1Status),parameter_sources:{all:'SupportParameterPayload'},geometry_capabilities:{partial_assembly:true},missing_parameters:['energy_absorption_net.geometry']}],
]);

export function getSupportTypeDefinition(id){return SupportTypeRegistry.get(id)||null}
export function implementedSupportTypes(){return [...SupportTypeRegistry.values()].filter(x=>x.implementation_status.includes('IMPLEMENTED')&&!x.implementation_status.includes('NOT_IMPLEMENTED')&&!x.implementation_status.includes('NOT_FULLY_IMPLEMENTED')).map(x=>x.id)}
export function componentDefinition(type,id){return getSupportTypeDefinition(type)?.components.find(x=>x.id===id)||null}

export const ComponentPositioningRules=new Map(['ZZ-Va','ZZ-IVa','ZZ-IVb','ZZ-S'].map(type=>[type,{
  primary_mesh:{reference_surface:'PRIMARY_SUPPORT_INNER',reference_offset_mm:40,positioning_mode:'FOLLOW_PRIMARY_INNER',relation_status:'CONFIRMED',steel_connection_relation:'NEEDS_DESIGN_CONFIRMATION'},
  system_anchor:{reference_surface:'PRIMARY_SUPPORT_OUTER',reference_offset_mm:0,positioning_mode:'FOLLOW_PRIMARY_OUTER',relation_status:'CONFIRMED'},
  steel_arch:{positioning_mode:'CHECK_ONLY',design_parameters_independent:true},
  secondary_lining:{positioning_mode:'CHECK_ONLY',design_parameters_independent:true},
}]));
export function positioningRule(type,component){return ComponentPositioningRules.get(type)?.[component]||null}

export const ComponentDependencyMap={steel_arch:['steel_arch','lock_foot'],primary_concrete:['primary_concrete','primary_mesh','system_anchor'],primary_mesh:['primary_mesh'],system_anchor:['system_anchor'],lock_foot:['lock_foot'],advance_support:['advance_support'],lattice_arch:['lattice_arch'],secondary_lining:['secondary_lining','N1','N2','N3','N4','N5','N6','N7'],N1:['N1','N5','N6','N7'],N2:['N2','N5','N6','N7'],N3:['N3','N5','N6'],N4:['N1','N2','N4'],N5:['N5'],N6:['N6','N7'],N7:['N7']};
export const ExplodedZOrder={primarySupportConcreteGroup:-2.5,primarySupportMeshGroup:-1.8,steelArchArrayGroup:-1,systemAnchorGroup:-.3,lockFootAnchorGroup:.4,advanceSupportGroup:.8,secondaryLiningGroup:1.2,latticeArchGroup:1.6,N1Group:2,N2Group:2,N3Group:2,N4Group:2,N5Group:2.3,N6Group:2.6,N7Group:2.9};

