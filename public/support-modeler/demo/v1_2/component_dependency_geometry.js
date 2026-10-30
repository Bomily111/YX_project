import {buildPrimarySupportProfiles,samplePrimaryProfile} from './primary_support_geometry.js';

// Positioning dependencies move an existing component onto a changed primary
// support reference surface. They never rewrite the component's design values.
const geometrySources=new WeakMap();

function parametersWithOffset(parameters,offsetMm){
  return {...parameters,inner_top_radius_mm:Number(parameters.inner_top_radius_mm)+offsetMm,inner_side_radius_mm:Number(parameters.inner_side_radius_mm)+offsetMm};
}

function profilePoints(parameters,surface,offsetMm=0){
  const shifted=parametersWithOffset(parameters,offsetMm),profiles=buildPrimarySupportProfiles(shifted);
  return samplePrimaryProfile(surface==='OUTER'?profiles.outer:profiles.inner,96).map(([x,y])=>[x/1000,y/1000]);
}

function nearestPairedPoint(x,y,source,target){
  let best=null;
  for(let index=0;index<source.length-1;index++){
    const a=source[index],b=source[index+1],dx=b[0]-a[0],dy=b[1]-a[1],length2=dx*dx+dy*dy;
    const t=length2?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/length2)):0;
    const qx=a[0]+dx*t,qy=a[1]+dy*t,distance2=(x-qx)**2+(y-qy)**2;
    if(!best||distance2<best.distance2){
      const ta=target[index],tb=target[index+1],tx=ta[0]+(tb[0]-ta[0])*t,ty=ta[1]+(tb[1]-ta[1])*t,length=Math.hypot(dx,dy)||1;
      best={distance2,source:[qx,qy],target:[tx,ty],tangent:[dx/length,dy/length],normal:[-dy/length,dx/length]};
    }
  }
  return best;
}

export function buildProfileLinkedGeometry(sourceGeometry,baselinePrimary,targetPrimary,{surface='INNER',offsetMm=0,axialScale=1}={}){
  const geometry=sourceGeometry.clone(),position=geometry.getAttribute('position');
  if(!position)return geometry;
  const source=profilePoints(baselinePrimary,surface,offsetMm),target=profilePoints(targetPrimary,surface,offsetMm),array=position.array;
  for(let index=0;index<position.count;index++){
    const offset=index*position.itemSize,x=array[offset],y=array[offset+1],match=nearestPairedPoint(x,y,source,target);
    const dx=x-match.source[0],dy=y-match.source[1],normalDistance=dx*match.normal[0]+dy*match.normal[1],tangentDistance=dx*match.tangent[0]+dy*match.tangent[1];
    array[offset]=match.target[0]+match.normal[0]*normalDistance*axialScale+match.tangent[0]*tangentDistance;
    array[offset+1]=match.target[1]+match.normal[1]*normalDistance*axialScale+match.tangent[1]*tangentDistance;
  }
  position.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData={...sourceGeometry.userData,positioning_dependency:{surface,offset_mm:offsetMm,axial_scale:axialScale,design_parameters_preserved:true}};
  return geometry;
}

export function repositionGroupToPrimary(group,baselinePrimary,targetPrimary,options={}){
  if(!group)return false;const visited=new Map();
  group.traverse(object=>{
    if(!object.isMesh||!object.geometry)return;
    if(!geometrySources.has(object))geometrySources.set(object,object.geometry);
    const source=geometrySources.get(object);
    if(!visited.has(source))visited.set(source,buildProfileLinkedGeometry(source,baselinePrimary,targetPrimary,options));
    object.geometry=visited.get(source);
  });
  group.userData={...group.userData,positioning_dependency:{...options,design_parameters_preserved:true}};return true;
}

export function restorePositioningGeometry(group){
  if(!group)return false;group.traverse(object=>{if(object.isMesh&&geometrySources.has(object))object.geometry=geometrySources.get(object)});return true;
}

export function evaluatePrimaryComponentDependencies({primary,steel,steelSection,meshOffsetMm=40,meshDiameterMm=8,meshMode='FOLLOW_PRIMARY_INNER',anchorMode='FOLLOW_PRIMARY_OUTER',primarySecondary=null}){
  const outerTop=primary.inner_top_radius_mm+primary.thickness_mm,outerSide=primary.inner_side_radius_mm+primary.thickness_mm,halfSteel=Number(steelSection?.height||0)/2;
  const steelClearances=steel&&halfSteel>0?{
    crown_inner_mm:steel.R1_mm-halfSteel-primary.inner_top_radius_mm,
    crown_outer_mm:outerTop-(steel.R1_mm+halfSteel),
    side_inner_mm:steel.R2_mm-halfSteel-primary.inner_side_radius_mm,
    side_outer_mm:outerSide-(steel.R2_mm+halfSteel),
  }:null;
  const steelMinimum=steelClearances?Math.min(...Object.values(steelClearances)):null,meshInner=meshOffsetMm-meshDiameterMm/2,meshOuter=primary.thickness_mm-meshOffsetMm-meshDiameterMm/2;
  const warnings=[];
  if(steelMinimum!=null&&steelMinimum<0)warnings.push(`钢架与初支边界穿插 ${Math.abs(steelMinimum).toFixed(1)} mm`);
  if(meshInner<0||meshOuter<0)warnings.push('钢筋网中心线已超出初支混凝土有效厚度');
  if(meshMode!=='FOLLOW_PRIMARY_INNER')warnings.push('钢筋网未跟随初支内轮廓，位置需人工复核');
  if(anchorMode!=='FOLLOW_PRIMARY_OUTER')warnings.push('系统锚杆起点未跟随初支外轮廓，连接点需人工复核');
  if(primarySecondary?.abnormal_intersection)warnings.push(`初支与二衬异常穿插 ${Math.abs(primarySecondary.negative_clearance_mm).toFixed(1)} mm`);
  return {
    status:warnings.length?'WARNING':'OK',warnings,
    steel_arch:{mode:'CHECK_ONLY_DESIGN_PARAMETERS_INDEPENDENT',status:steelMinimum!=null&&steelMinimum<0?'INTERSECTION_WARNING':'CLEAR',clearances_mm:steelClearances,minimum_clearance_mm:steelMinimum},
    primary_mesh:{mode:meshMode,status:meshInner>=0&&meshOuter>=0?'WITHIN_PRIMARY_SHELL':'OUTSIDE_PRIMARY_SHELL',reference_offset_mm:meshOffsetMm,inner_cover_to_bar_edge_mm:meshInner,outer_cover_to_bar_edge_mm:meshOuter,steel_connection_relation:'NEEDS_DESIGN_CONFIRMATION'},
    system_anchor:{mode:anchorMode,status:anchorMode==='FOLLOW_PRIMARY_OUTER'?'START_ALIGNED_TO_PRIMARY_OUTER':'CONNECTION_OFFSET_WARNING',start_offset_mm:0,length_and_spacing_preserved:true},
    secondary_lining:primarySecondary,
    design_parameters_preserved:['steel_arch.R1_mm','steel_arch.R2_mm','steel_arch.beta_deg','system_anchor.length_mm','system_anchor.spacing','primary_mesh.spacing'],
  };
}
