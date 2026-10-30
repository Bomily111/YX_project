import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// 三肢格栅采用断面局部坐标：x 横向、y 竖向、z 隧道纵向。
// N3 位于断面径向外侧，N4/N5 位于内侧并沿 z 对称布置。
function archCurve(topRadiusMm,sideRadiusMm,betaDeg,z=0){
  const r1=Number(topRadiusMm)/1000,r2=Number(sideRadiusMm)/1000,beta=THREE.MathUtils.degToRad(Number(betaDeg));
  const delta=r2-r1,path=new THREE.Path();
  path.moveTo(-delta+r2*Math.cos(-beta),r2*Math.sin(-beta));
  path.absarc(-delta,0,r2,-beta,0,false);
  path.absarc(0,0,r1,0,Math.PI,false);
  path.absarc(delta,0,r2,Math.PI,Math.PI+beta,false);
  return new THREE.CatmullRomCurve3(path.getPoints(320).map(point=>new THREE.Vector3(point.x,point.y,z)));
}

function tube(curve,diameterMm,tubularSegments=320){
  return new THREE.TubeGeometry(curve,tubularSegments,Number(diameterMm)/2000,8,false);
}

function rodBetween(start,end,diameterMm){
  const direction=end.clone().sub(start),length=direction.length();
  const geometry=new THREE.CylinderGeometry(Number(diameterMm)/2000,Number(diameterMm)/2000,length,8,1,false);
  geometry.quaternion=undefined;
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize()));
  geometry.translate((start.x+end.x)/2,(start.y+end.y)/2,(start.z+end.z)/2);
  return geometry;
}

function merge(items,label){
  const result=mergeGeometries(items,false);
  items.forEach(item=>item.dispose());
  if(!result)throw new Error(`${label} 几何合并失败`);
  result.computeBoundingBox();result.computeBoundingSphere();result.userData={component:'lattice_arch',part:label};
  return result;
}

export function validateLatticeArchParameters(parameters){
  const errors=[],warnings=[];
  for(const key of ['outer_top_radius_mm','inner_top_radius_mm','outer_side_radius_mm','inner_side_radius_mm','side_angle_deg','main_bar_diameter_mm','triangle_width_mm','triangle_height_mm','web_bar_diameter_mm','web_pitch_mm','hoop_diameter_mm','hoop_pitch_mm','longitudinal_spacing_mm','longitudinal_connector_diameter_mm','longitudinal_connector_circumferential_spacing_mm'])if(!(Number(parameters[key])>0))errors.push(`${key} 必须大于0`);
  if(Number(parameters.outer_top_radius_mm)<=Number(parameters.inner_top_radius_mm)||Number(parameters.outer_side_radius_mm)<=Number(parameters.inner_side_radius_mm))errors.push('N3外侧轮廓半径必须大于N4/N5内侧轮廓半径');
  const topHeight=Number(parameters.outer_top_radius_mm)-Number(parameters.inner_top_radius_mm),sideHeight=Number(parameters.outer_side_radius_mm)-Number(parameters.inner_side_radius_mm);
  if(Math.abs(topHeight-Number(parameters.triangle_height_mm))>1||Math.abs(sideHeight-Number(parameters.triangle_height_mm))>1)warnings.push('轮廓半径差与三肢截面高度不一致');
  if(parameters.connector_end_geometry_status==='NEEDS_CONFIRMATION')warnings.push('纵向连接筋端部R55弯折所在平面仍需节点确认；当前实体保留直线有效跨距');
  const innerCoverTop=Number(parameters.inner_top_radius_mm)-Number(parameters.main_bar_diameter_mm)/2-Number(parameters.secondary_inner_top_radius_mm),outerCoverTop=Number(parameters.secondary_inner_top_radius_mm)+Number(parameters.secondary_lining_thickness_mm)-Number(parameters.outer_top_radius_mm)-Number(parameters.main_bar_diameter_mm)/2,innerCoverSide=Number(parameters.inner_side_radius_mm)-Number(parameters.main_bar_diameter_mm)/2-Number(parameters.secondary_inner_side_radius_mm),outerCoverSide=Number(parameters.secondary_inner_side_radius_mm)+Number(parameters.secondary_lining_thickness_mm)-Number(parameters.outer_side_radius_mm)-Number(parameters.main_bar_diameter_mm)/2;
  const coverValues=[innerCoverTop,outerCoverTop,innerCoverSide,outerCoverSide];if(coverValues.every(Number.isFinite)&&Math.min(...coverValues)<0)errors.push('三肢格栅主筋超出二衬实体范围');
  return {status:errors.length?'INVALID':warnings.length?'NEEDS_CONFIRMATION':'OK',errors,warnings,main_bar_count:3,top_radial_difference_mm:topHeight,side_radial_difference_mm:sideHeight,secondary_lining_cover_mm:{crown_inner:innerCoverTop,crown_outer:outerCoverTop,side_inner:innerCoverSide,side_outer:outerCoverSide},spatial_check:coverValues.every(Number.isFinite)?'WITHIN_SECONDARY_LINING':'NEEDS_CONFIRMATION'};
}

/** 生成一榀三肢格栅的真实主筋、N7桁架筋、N8箍筋和纵向连接筋几何。 */
export function createLatticeArchFrameGeometries(parameters){
  const validation=validateLatticeArchParameters(parameters);if(validation.errors.length)throw new Error(validation.errors.join('；'));
  const halfWidth=Number(parameters.triangle_width_mm)/2000;
  const curves={
    N3:archCurve(parameters.outer_top_radius_mm,parameters.outer_side_radius_mm,parameters.side_angle_deg,0),
    N4:archCurve(parameters.inner_top_radius_mm,parameters.inner_side_radius_mm,parameters.side_angle_deg,-halfWidth),
    N5:archCurve(parameters.inner_top_radius_mm,parameters.inner_side_radius_mm,parameters.side_angle_deg,halfWidth),
  };
  const main=merge(Object.values(curves).map(curve=>tube(curve,parameters.main_bar_diameter_mm)),'MAIN_BARS_N3_N4_N5');
  // 数量表以外侧N3整榀长度23747mm计数：N7约70组×3根，N8约79道。
  const length=curves.N3.getLength();

  // 第119页数量表为 N7 共210根；按图示340mm节距，每个节距三根交替桁架筋。
  const webCycles=Math.max(1,Math.round(length/(Number(parameters.web_pitch_mm)/1000))),web=[];
  for(let index=0;index<webCycles;index++){
    const u0=index/webCycles,u1=(index+1)/webCycles;
    web.push(rodBetween(curves.N3.getPointAt(u0),curves.N4.getPointAt(u1),parameters.web_bar_diameter_mm));
    web.push(rodBetween(curves.N4.getPointAt(u0),curves.N5.getPointAt(u1),parameters.web_bar_diameter_mm));
    web.push(rodBetween(curves.N5.getPointAt(u0),curves.N3.getPointAt(u1),parameters.web_bar_diameter_mm));
  }

  // N8 A12@300，三角箍筋在三条主筋中心线上闭合。
  const hoopCount=Math.max(1,Math.round(length/(Number(parameters.hoop_pitch_mm)/1000))),hoops=[];
  for(let index=0;index<hoopCount;index++){
    const u=(index+.5)/hoopCount,points=[curves.N3.getPointAt(u),curves.N4.getPointAt(u),curves.N5.getPointAt(u)];
    hoops.push(rodBetween(points[0],points[1],parameters.hoop_diameter_mm),rodBetween(points[1],points[2],parameters.hoop_diameter_mm),rodBetween(points[2],points[0],parameters.hoop_diameter_mm));
  }

  // C22纵向连接筋：按断面环向2m布置，直线有效跨距等于格栅纵距。
  const connectorCount=Math.max(1,Math.round(length/(Number(parameters.longitudinal_connector_circumferential_spacing_mm)/1000))),connectors=[];
  for(let index=0;index<connectorCount;index++){
    const point=curves.N3.getPointAt((index+.5)/connectorCount),end=point.clone();end.z+=Number(parameters.longitudinal_spacing_mm)/1000;
    connectors.push(rodBetween(point,end,parameters.longitudinal_connector_diameter_mm));
  }
  const result={main,web:merge(web,'WEB_BARS_N7'),hoop:merge(hoops,'HOOPS_N8'),connector:merge(connectors,'LONGITUDINAL_CONNECTORS_C22'),validation,curve_length_mm:length*1000,web_count:webCycles*3,hoop_count:hoopCount,connector_count:connectorCount};
  for(const geometry of [result.main,result.web,result.hoop,result.connector])geometry.userData={...geometry.userData,support_type:parameters.support_type,source_pages:parameters.source_pages};
  return result;
}

export function createLatticeArchGroup(parameters){
  const built=createLatticeArchFrameGeometries(parameters),group=new THREE.Group();group.name='latticeArchGroup';
  const materials={main:new THREE.MeshStandardMaterial({color:0xb36b35,metalness:.58,roughness:.42}),web:new THREE.MeshStandardMaterial({color:0xd59a55,metalness:.48,roughness:.46}),hoop:new THREE.MeshStandardMaterial({color:0xe2bd78,metalness:.4,roughness:.48}),connector:new THREE.MeshStandardMaterial({color:0x8f9ca8,metalness:.55,roughness:.4})};
  for(const key of ['main','web','hoop','connector']){const mesh=new THREE.Mesh(built[key],materials[key]);mesh.name=`LatticeArch_${key}`;mesh.userData={component:'lattice_arch',part:key};group.add(mesh)}
  group.userData={component:'lattice_arch',representation:'THREE_LEG_LATTICE_TRUE_REBAR_GEOMETRY',parameters:{...parameters},validation:built.validation,counts:{main_bar:3,N7_web:built.web_count,N8_hoop:built.hoop_count,longitudinal_connector:built.connector_count},curve_length_mm:built.curve_length_mm};
  return {group,...built};
}
