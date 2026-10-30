import * as THREE from 'three';

// 超前支护统一采用局部断面坐标：x 横向、y 竖向、z 里程增加方向。
// 管端位于开挖轮廓，沿 z 正方向并按外插角向围岩侧展开。
export function validateAdvanceSupportParameters(parameters){
  const p={...parameters},errors=[],warnings=[];
  for(const key of ['outer_diameter_mm','wall_thickness_mm','length_mm','placement_radius_mm','crown_angle_deg','circumferential_spacing_mm','external_angle_deg','longitudinal_cycle_spacing_mm'])if(!(Number(p[key])>0))errors.push(`${key} 必须大于0`);
  if(Number(p.wall_thickness_mm)*2>=Number(p.outer_diameter_mm))errors.push('壁厚必须小于管外半径');
  if(Number(p.crown_angle_deg)>180)errors.push('拱部布设角度不得大于180°');
  const range=p.external_angle_range_deg||[];
  if(range.length===2&&(Number(p.external_angle_deg)<Number(range[0])||Number(p.external_angle_deg)>Number(range[1])))errors.push(`外插角必须位于图纸范围 ${range[0]}°～${range[1]}°`);
  const overlap=Number(p.length_mm)*Math.cos(THREE.MathUtils.degToRad(Number(p.external_angle_deg)))-Number(p.longitudinal_cycle_spacing_mm);
  if(overlap<Number(p.minimum_overlap_mm||0))errors.push(`水平搭接 ${overlap.toFixed(1)} mm 小于图纸最小值 ${p.minimum_overlap_mm} mm`);
  if(p.external_angle_status==='NEEDS_CONFIRMATION')warnings.push(`图纸仅规定外插角 ${range[0]}°～${range[1]}°，当前采用值仍需工程确认`);
  if(p.start_offset_status==='NEEDS_CONFIRMATION')warnings.push('真实区段首环相对区段起点的循环相位需工程确认');
  return {status:errors.length?'INVALID':warnings.length?'NEEDS_CONFIRMATION':'OK',errors,warnings,horizontal_overlap_mm:overlap};
}

export function createHollowPipeGeometry(outerDiameterMm,wallThicknessMm,lengthMm,radialSegments=12){
  const ro=Number(outerDiameterMm)/2000,ri=(Number(outerDiameterMm)-2*Number(wallThicknessMm))/2000,length=Number(lengthMm)/1000;
  if(!(ro>ri&&ri>0&&length>0))throw new Error('超前支护管截面参数无效');
  const positions=[],normals=[],indices=[];
  for(let ring=0;ring<4;ring++)for(let i=0;i<radialSegments;i++){
    const angle=i/radialSegments*Math.PI*2,c=Math.cos(angle),s=Math.sin(angle),outer=ring<2,r=outer?ro:ri,z=ring%2?length:0;
    positions.push(r*c,r*s,z);normals.push((outer?1:-1)*c,(outer?1:-1)*s,0);
  }
  const connect=(a,b,flip=false)=>{for(let i=0;i<radialSegments;i++){const n=(i+1)%radialSegments,a0=a+i,a1=a+n,b0=b+i,b1=b+n;if(flip)indices.push(a0,b1,a1,a0,b0,b1);else indices.push(a0,a1,b1,a0,b1,b0)}};
  connect(0,radialSegments);connect(radialSegments*2,radialSegments*3,true);
  for(const end of [0,1])for(let i=0;i<radialSegments;i++){const n=(i+1)%radialSegments,o0=end*radialSegments+i,o1=end*radialSegments+n,i0=(2+end)*radialSegments+i,i1=(2+end)*radialSegments+n;if(end===0)indices.push(o0,i1,o1,o0,i0,i1);else indices.push(o0,o1,i1,o0,i1,i0)}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setIndex(indices);geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData={component:'advance_support',representation:'HOLLOW_PIPE_TRUE_DIMENSIONS'};return geometry;
}

export function advanceSupportLayout(parameters){
  const validation=validateAdvanceSupportParameters(parameters);if(validation.errors.length)throw new Error(validation.errors.join('；'));
  const radius=Number(parameters.placement_radius_mm)/1000,span=THREE.MathUtils.degToRad(Number(parameters.crown_angle_deg)),maxSpacing=Number(parameters.circumferential_spacing_mm)/1000,intervals=Math.max(1,Math.ceil(radius*span/maxSpacing)),external=THREE.MathUtils.degToRad(Number(parameters.external_angle_deg)),rows=[];
  for(let index=0;index<=intervals;index++){
    const theta=Math.PI/2-span/2+span*index/intervals,radial=new THREE.Vector3(Math.cos(theta),Math.sin(theta),0),base=radial.clone().multiplyScalar(radius);base.z=Number(parameters.start_offset_mm||0)/1000;
    const direction=radial.multiplyScalar(Math.sin(external)).add(new THREE.Vector3(0,0,Math.cos(external))).normalize();rows.push({base,direction,section_angle_rad:theta});
  }
  return {rows,validation,actual_circumferential_spacing_mm:radius*span/intervals*1000,count_per_ring:rows.length};
}

export function pipeTransform(base,direction){const quaternion=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),direction.clone().normalize());return new THREE.Matrix4().compose(base,quaternion,new THREE.Vector3(1,1,1))}

export function createAdvanceSupportGroup(parameters,material=new THREE.MeshStandardMaterial({color:0xd6b15f,metalness:.45,roughness:.48})){
  const layout=advanceSupportLayout(parameters),geometry=createHollowPipeGeometry(parameters.outer_diameter_mm,parameters.wall_thickness_mm,parameters.length_mm),group=new THREE.Group();group.name='advanceSupportGroup';group.userData={component:'advance_support',parameters:{...parameters},validation:layout.validation,count_per_ring:layout.count_per_ring,actual_circumferential_spacing_mm:layout.actual_circumferential_spacing_mm};
  layout.rows.forEach((row,index)=>{const mesh=new THREE.Mesh(geometry,material);mesh.name=`AdvanceSupportPipe_${String(index+1).padStart(3,'0')}`;mesh.userData={component:'advance_support',pipe_index:index};mesh.applyMatrix4(pipeTransform(row.base,row.direction));group.add(mesh)});return {group,layout};
}
