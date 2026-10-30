import * as THREE from 'three';
import {buildPrimarySupportProfiles,buildOpenArchWallShellGeometry} from './primary_support_geometry.js';

// Browser counterpart of src/base_profile/geometry.py and
// src/secondary_lining/geometry.py. The construction order and formulas stay
// identical so the editor rebuilds the confirmed project profile.
const deg=value=>value*Math.PI/180;
const point=(center,radius,angle)=>[center[0]+radius*Math.cos(deg(angle)),center[1]+radius*Math.sin(deg(angle))];

function advanceArc(start,tangent,radius,angle){
  const phi0=tangent+Math.PI/2,center=[start[0]-radius*Math.cos(phi0),start[1]-radius*Math.sin(phi0)],phi1=phi0-angle,end=[center[0]+radius*Math.cos(phi1),center[1]+radius*Math.sin(phi1)];
  return [{center_mm:center,radius_mm:radius,start_angle_deg:phi0*180/Math.PI,end_angle_deg:phi1*180/Math.PI,start_mm:start,end_mm:end,connection:'TANGENT'},end,tangent-angle];
}

export function buildSecondaryInnerProfile(parameters,toleranceMm=.1){
  const required=['inner_top_radius_mm','inner_top_angle_deg','inner_side_radius_mm','inner_side_angle_deg','invert_transition_radius_mm','invert_transition_angle_deg','invert_bottom_radius_mm','invert_bottom_angle_deg'];
  for(const key of required)if(!Number.isFinite(Number(parameters[key]))||Number(parameters[key])<=0)throw new Error(`${key} 必须为正数`);
  let start=[0,Number(parameters.inner_top_radius_mm)],tangent=0;const right=[];
  for(const [name,radius,angle] of [
    ['top',parameters.inner_top_radius_mm,parameters.inner_top_angle_deg/2],
    ['side',parameters.inner_side_radius_mm,parameters.inner_side_angle_deg],
    ['invert_transition',parameters.invert_transition_radius_mm,parameters.invert_transition_angle_deg],
    ['invert_bottom',parameters.invert_bottom_radius_mm,parameters.invert_bottom_angle_deg/2],
  ]){const result=advanceArc(start,tangent,Number(radius),deg(Number(angle)));result[0].name=name;right.push(result[0]);start=result[1];tangent=result[2]}
  const left=[...right].reverse().map(arc=>({...arc,name:`${arc.name}_mirrored`,center_mm:[-arc.center_mm[0],arc.center_mm[1]],start_mm:[-arc.end_mm[0],arc.end_mm[1]],end_mm:[-arc.start_mm[0],arc.start_mm[1]],start_angle_deg:180-arc.end_angle_deg,end_angle_deg:180-arc.start_angle_deg}));
  const residual=Math.abs(right.at(-1).end_mm[0]),points=[...right,...left].flatMap(segment=>[segment.start_mm,segment.end_mm]),maxX=Math.max(...points.map(p=>Math.abs(p[0]))),minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]));
  return {coordinate_system:'x_right_y_up_mm',construction:'TANGENT_CHAIN_MIRRORED',right_segments:right,left_segments:left,closed:residual<=toleranceMm,closure_status:residual<=1e-9?'CLOSED_NUMERIC':residual<=toleranceMm?'DRAWING_ROUNDING_RESIDUAL':'OPEN',axis_closure_residual_mm:residual,full_bottom_gap_mm:2*residual,calculated_width_mm:2*maxX,calculated_height_mm:maxY-minY,bounds_mm:{min_x:-maxX,max_x:maxX,min_y:minY,max_y:maxY},tolerance:{drawing_closure_tolerance_mm:toleranceMm}};
}

export function buildSecondaryOuterProfile(inner,thicknessMm){
  if(!Number.isFinite(Number(thicknessMm))||Number(thicknessMm)<=0)throw new Error('二衬厚度必须为正数');
  const outer=structuredClone(inner),offset=Number(thicknessMm);outer.construction='NORMAL_OFFSET_FROM_SECTION_GEOMETRY_INNER_PROFILE';outer.normal_offset_mm=offset;
  for(const side of ['right_segments','left_segments'])for(const segment of outer[side]){segment.radius_mm+=offset;segment.start_mm=point(segment.center_mm,segment.radius_mm,segment.start_angle_deg);segment.end_mm=point(segment.center_mm,segment.radius_mm,segment.end_angle_deg);segment.offset_from_inner_mm=offset}
  const residual=Math.abs(outer.right_segments.at(-1).end_mm[0]),points=[...outer.right_segments,...outer.left_segments].flatMap(segment=>[segment.start_mm,segment.end_mm]),maxX=Math.max(...points.map(p=>Math.abs(p[0]))),minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]));outer.closed=residual<=inner.tolerance.drawing_closure_tolerance_mm;outer.axis_closure_residual_mm=residual;outer.calculated_width_mm=2*maxX;outer.calculated_height_mm=maxY-minY;outer.bounds_mm={min_x:-maxX,max_x:maxX,min_y:minY,max_y:maxY};return outer;
}

export function sampleSecondaryProfile(profile,samplesPerSegment=32){
  const result=[];for(const segment of [...profile.right_segments,...profile.left_segments])for(let index=0;index<=samplesPerSegment;index++){if(result.length&&index===0)continue;const angle=segment.start_angle_deg+(segment.end_angle_deg-segment.start_angle_deg)*index/samplesPerSegment;result.push(point(segment.center_mm,segment.radius_mm,angle))}if(result.length&&Math.hypot(result[0][0]-result.at(-1)[0],result[0][1]-result.at(-1)[1])<=.1)result.pop();return result;
}

const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function segmentsIntersect(a,b,c,d,epsilon=1e-8){const values=[cross(a,b,c),cross(a,b,d),cross(c,d,a),cross(c,d,b)];return ((values[0]>epsilon&&values[1]<-epsilon)||(values[0]<-epsilon&&values[1]>epsilon))&&((values[2]>epsilon&&values[3]<-epsilon)||(values[2]<-epsilon&&values[3]>epsilon))}
function selfIntersects(points){for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){if(j===i||j===(i+1)%points.length||(j+1)%points.length===i)continue;if(segmentsIntersect(points[i],points[(i+1)%points.length],points[j],points[(j+1)%points.length]))return true}return false}
const signedArea=points=>points.reduce((sum,p,index)=>sum+p[0]*points[(index+1)%points.length][1]-points[(index+1)%points.length][0]*p[1],0)/2;

function shellGeometry(inner,outer,depthM=1,samplesPerSegment=32){
  const innerPoints=sampleSecondaryProfile(inner,samplesPerSegment),outerPoints=sampleSecondaryProfile(outer,samplesPerSegment),n=innerPoints.length,positions=[];
  for(const [z,points] of [[0,outerPoints],[0,innerPoints],[depthM,outerPoints],[depthM,innerPoints]])for(const [x,y] of points)positions.push(x/1000,y/1000,z);
  const indices=[];for(let i=0;i<n;i++){const j=(i+1)%n,of=i,inf=n+i,ob=2*n+i,inb=3*n+i,ofj=j,infj=n+j,obj=2*n+j,inbj=3*n+j;indices.push(of,inf,infj,of,infj,ofj,ob,inbj,inb,ob,obj,inbj,of,ofj,obj,of,obj,ob,inf,inb,inbj,inf,inbj,infj)}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

export function buildSecondaryLiningGeometry(parameters,depthM=1){
  const inner=buildSecondaryInnerProfile(parameters),outer=buildSecondaryOuterProfile(inner,Number(parameters.thickness_mm));
  if(!inner.closed||!outer.closed)throw new Error(`轮廓未闭合，轴线残差 ${inner.axis_closure_residual_mm.toFixed(3)} mm`);
  const innerPoints=sampleSecondaryProfile(inner),outerPoints=sampleSecondaryProfile(outer),noSelfIntersection=!selfIntersects(innerPoints)&&!selfIntersects(outerPoints),nested=Math.abs(signedArea(outerPoints))>Math.abs(signedArea(innerPoints)),symmetric=outer.right_segments.every((segment,index)=>Math.abs(segment.radius_mm-outer.left_segments.at(-(index+1)).radius_mm)<=1e-9);
  if(!noSelfIntersection||!nested||!symmetric)throw new Error('轮廓有效性检查失败（自交、嵌套或左右对称）');
  const validation={closed:true,left_right_symmetric:symmetric,tangent_chain:true,no_self_intersection:noSelfIntersection,inner_outer_nesting:nested,thickness_mm:Number(parameters.thickness_mm)},geometry=shellGeometry(inner,outer,depthM);geometry.userData={component:'secondary_lining',construction:'TANGENT_CHAIN_MIRRORED_NORMAL_OFFSET',parameters:{...parameters},validation};return {geometry,inner,outer,validation};
}

export function createSecondaryLiningGroup(parameters,material,depthM=1){
  const built=buildSecondaryLiningGeometry(parameters,depthM),group=new THREE.Group();group.name='secondaryLiningGroup';const mesh=new THREE.Mesh(built.geometry,material);mesh.name='secondaryLining';mesh.userData={component:'secondary_lining',...built.validation};group.add(mesh);group.userData={component:'secondary_lining',parameters:{...parameters},validation:built.validation};return {...built,group};
}

// 无仰拱类型使用与既有 Python 装配相同的三圆弧拱墙轮廓。
// 仅复用通用开口轮廓构造，不引入任何支护类型特判。
export function buildOpenSecondaryLiningGeometry(parameters,depthM=1){
  const profiles=buildPrimarySupportProfiles(parameters),geometry=buildOpenArchWallShellGeometry(profiles,depthM);
  geometry.userData={component:'secondary_lining',construction:'THREE_ARC_OPEN_ARCH_WALL',parameters:{...parameters},scope:'ARCH_AND_WALL_ONLY',invert:'NOT_APPLICABLE'};
  return {geometry,profiles,inner:profiles.inner,outer:profiles.outer,validation:{top_side_tangent:true,left_right_symmetric:true,uniform_thickness:true,open_at_invert:true,thickness_mm:profiles.thickness_mm}};
}

export function createOpenSecondaryLiningGroup(parameters,material,depthM=1){const built=buildOpenSecondaryLiningGeometry(parameters,depthM),group=new THREE.Group();group.name='secondaryLiningGroup';const mesh=new THREE.Mesh(built.geometry,material);mesh.name='secondaryLining';mesh.userData={component:'secondary_lining',...built.validation};group.add(mesh);group.userData={component:'secondary_lining',parameters:{...parameters},validation:built.validation};return {...built,group}}
