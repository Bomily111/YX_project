import * as THREE from 'three';

// Browser counterpart of src/primary_support/geometry.py. ZZ-Va initial
// support is confirmed for crown and walls only; no invert is invented here.
const deg=value=>value*Math.PI/180;
const point=(center,radius,angle)=>[center[0]+radius*Math.cos(deg(angle)),center[1]+radius*Math.sin(deg(angle))];
const segment=(name,center,radius,a0,a1)=>({name,center_mm:center,radius_mm:Number(radius),start_angle_deg:Number(a0),end_angle_deg:Number(a1),start_mm:point(center,radius,a0),end_mm:point(center,radius,a1),status:'CONFIRMED'});

export function buildOpenArchWallProfile(topRadius,sideRadius,sideAngle,role='OPEN_ARCH_WALL_PROFILE'){
  const centerOffset=sideRadius-topRadius;
  return {role,coordinate_system:'x_right_y_up_mm',construction:'STEEL_ARCH_REFERENCED_THREE_ARC_OPEN_PROFILE',top_radius_mm:Number(topRadius),side_radius_mm:Number(sideRadius),side_angle_deg:Number(sideAngle),center_offset_mm:centerOffset,segments:[segment('left_side',[centerOffset,0],sideRadius,180+sideAngle,180),segment('top',[0,0],topRadius,180,0),segment('right_side',[-centerOffset,0],sideRadius,0,-sideAngle)],open_at_invert:true,omitted_segments:['invert_transition','invert_bottom']};
}

export function buildPrimarySupportProfiles(parameters){
  const top=Number(parameters.inner_top_radius_mm),side=Number(parameters.inner_side_radius_mm),angle=Number(parameters.side_angle_deg),thickness=Number(parameters.thickness_mm);
  if(![top,side,angle,thickness].every(Number.isFinite)||top<=0||side<=0||thickness<=0||angle<=0||angle>=90)throw new Error('初支半径、侧拱角和厚度必须为有效正数');
  const inner=buildOpenArchWallProfile(top,side,angle,'PRIMARY_SUPPORT_INNER_REFERENCE'),outer=buildOpenArchWallProfile(top+thickness,side+thickness,angle,'EXCAVATION_OUTER_BOUNDARY');
  if(Math.abs(inner.center_offset_mm-outer.center_offset_mm)>1e-9)throw new Error('初支内外轮廓圆心体系不一致');
  return {inner,outer,thickness_mm:thickness,scope:'ARCH_AND_WALL_ONLY',invert:'NOT_APPLICABLE'};
}

export function samplePrimaryProfile(profile,samplesPerSegment=64){const points=[];for(const arc of profile.segments)for(let i=0;i<=samplesPerSegment;i++){if(points.length&&i===0)continue;const angle=arc.start_angle_deg+(arc.end_angle_deg-arc.start_angle_deg)*i/samplesPerSegment;points.push(point(arc.center_mm,arc.radius_mm,angle))}return points}

function sampleClosedProfile(profile,samplesPerSegment=48){const points=[];for(const arc of [...profile.right_segments,...profile.left_segments])for(let i=0;i<=samplesPerSegment;i++){if(points.length&&i===0)continue;const angle=arc.start_angle_deg+(arc.end_angle_deg-arc.start_angle_deg)*i/samplesPerSegment;points.push(point(arc.center_mm,arc.radius_mm,angle))}return points}
function pointInPolygon(pointValue,polygon){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j],crosses=(a[1]>pointValue[1])!==(b[1]>pointValue[1])&&pointValue[0]<(b[0]-a[0])*(pointValue[1]-a[1])/(b[1]-a[1])+a[0];if(crosses)inside=!inside}return inside}
function pointSegmentDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],length2=dx*dx+dy*dy;if(length2===0)return Math.hypot(p[0]-a[0],p[1]-a[1]);const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length2)),x=a[0]+t*dx,y=a[1]+t*dy;return Math.hypot(p[0]-x,p[1]-y)}
function signedBoundaryClearance(pointValue,polygon){let distance=Infinity;for(let i=0;i<polygon.length;i++)distance=Math.min(distance,pointSegmentDistance(pointValue,polygon[i],polygon[(i+1)%polygon.length]));return pointInPolygon(pointValue,polygon)?-distance:distance}

export function buildOpenArchWallShellGeometry(profiles,depthM=1,samplesPerSegment=64){
  const inner=samplePrimaryProfile(profiles.inner,samplesPerSegment),outer=samplePrimaryProfile(profiles.outer,samplesPerSegment),n=inner.length,positions=[];for(const [z,points] of [[0,outer],[0,inner],[depthM,outer],[depthM,inner]])for(const [x,y] of points)positions.push(x/1000,y/1000,z);
  const indices=[];for(let i=0;i<n-1;i++){const j=i+1,of=i,inf=n+i,ob=2*n+i,inb=3*n+i,ofj=j,infj=n+j,obj=2*n+j,inbj=3*n+j;indices.push(of,inf,infj,of,infj,ofj,ob,inbj,inb,ob,obj,inbj,of,ofj,obj,of,obj,ob,inf,inb,inbj,inf,inbj,infj)}for(const i of [0,n-1]){const of=i,inf=n+i,ob=2*n+i,inb=3*n+i;indices.push(of,ob,inb,of,inb,inf)}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

export function validatePrimarySecondarySpatialRelation(primaryProfiles,secondaryOuter,toleranceMm=.1){
  const secondarySegments=secondaryOuter.right_segments||secondaryOuter.segments,secondaryTop=secondarySegments.find(item=>item.name==='top'),secondarySide=secondarySegments.find(item=>item.name==='side'||item.name==='right_side'),primaryTop=primaryProfiles.inner.segments.find(item=>item.name==='top'),primarySide=primaryProfiles.inner.segments.find(item=>item.name==='right_side');
  if(!secondaryTop||!secondarySide)throw new Error('二衬外轮廓缺少顶拱或侧拱');
  const crownGap=primaryTop.radius_mm-secondaryTop.radius_mm,junctionGap=primaryTop.end_mm[0]-secondaryTop.end_mm[0],commonAngle=Math.min(primaryProfiles.inner.side_angle_deg,Math.abs(secondarySide.end_angle_deg-secondarySide.start_angle_deg)),samples=[];
  for(let index=0;index<=32;index++){const angle=-commonAngle*index/32,p=point(primarySide.center_mm,primarySide.radius_mm,angle),distance=Math.hypot(p[0]-secondarySide.center_mm[0],p[1]-secondarySide.center_mm[1]);samples.push(distance-secondarySide.radius_mm)}
  const isOpenSecondary=!secondaryOuter.right_segments,secondaryBoundary=isOpenSecondary?samplePrimaryProfile(secondaryOuter,64):sampleClosedProfile(secondaryOuter),primaryBoundary=samplePrimaryProfile(primaryProfiles.inner,64),fullProfileClearances=primaryBoundary.map(value=>isOpenSecondary?Math.min(...secondaryBoundary.map((_,index)=>pointSegmentDistance(value,secondaryBoundary[index],secondaryBoundary[Math.min(index+1,secondaryBoundary.length-1)]))):signedBoundaryClearance(value,secondaryBoundary)),sideGapMin=Math.min(...samples),sideGapMax=Math.max(...samples),fullProfileMinimumGap=Math.min(...fullProfileClearances),minimumGap=Math.min(crownGap,junctionGap,sideGapMin,isOpenSecondary?Infinity:fullProfileMinimumGap),status=minimumGap<-toleranceMm?'ABNORMAL_INTERSECTION':Math.abs(minimumGap)<=toleranceMm?'DESIGN_CONTACT_ALLOWED':'SEPARATED';
  return {status,abnormal_intersection:status==='ABNORMAL_INTERSECTION',negative_clearance_mm:Math.min(0,minimumGap),minimum_gap_mm:minimumGap,crown_gap_mm:crownGap,top_side_junction_gap_mm:junctionGap,side_gap_min_mm:sideGapMin,side_gap_max_mm:sideGapMax,full_primary_profile_minimum_gap_mm:fullProfileMinimumGap,invert_relation:'NOT_EVALUATED_PRIMARY_INVERT_NOT_APPLICABLE',scope:'FULL_PRIMARY_CROWN_AND_WALL_AGAINST_SECONDARY_OUTER_PROFILE',engineering_interpretation:status==='ABNORMAL_INTERSECTION'?'实体发生异常穿插':status==='DESIGN_CONTACT_ALLOWED'?'允许接触；是否为设计接触需结合节点图确认':'实体分离'};
}

export function buildPrimarySupportGeometry(parameters,depthM=1){const profiles=buildPrimarySupportProfiles(parameters),geometry=buildOpenArchWallShellGeometry(profiles,depthM);geometry.userData={component:'primary_concrete',construction:'STEEL_ARCH_REFERENCED_THREE_ARC_OPEN_PROFILE',parameters:{...parameters},scope:'ARCH_AND_WALL_ONLY',invert:'NOT_APPLICABLE'};return {geometry,profiles,validation:{top_side_tangent:true,left_right_symmetric:true,uniform_thickness:true,open_at_invert:true,thickness_mm:profiles.thickness_mm}}}

export function createPrimarySupportGroup(parameters,material,depthM=1){const built=buildPrimarySupportGeometry(parameters,depthM),group=new THREE.Group();group.name='primarySupportConcreteGroup';const mesh=new THREE.Mesh(built.geometry,material);mesh.name='primarySupportConcreteTopSide';mesh.userData={component:'primary_concrete',...built.validation};group.add(mesh);group.userData={component:'primary_concrete',parameters:{...parameters},validation:built.validation};return {...built,group}}
