import * as THREE from 'three';

// Extracted from the reviewed lining-modeler.html supplied for Z-PM.  The
// module keeps that page's four-arc section construction and N1-N7 bar layout
// in the shared demo runtime; it does not introduce a second renderer.
const DEG=Math.PI/180;
const P=(x,y)=>new THREE.Vector2(x,y);

export const ZPM_LINING_DEFAULTS=Object.freeze({
  R1:5500,R2:10000,R3:1200,R4:12000,
  angle1:180,angle2:11.699444444444445,angle3:55.89138888888889,angle4:44.81833333333333,
  crownY:7600,outerR1:6050,outerAngle1:180,wallLength:3515.0970546555873,
  footWidth:1549,outerR4:12550,outerAngle4:42.03405962010346,outerCrownY:8150,
  referenceHalfWidth:4250,length:1,mainDiameter:25,longDiameter:12,ringSpacing:250,
  longSpacing:250,tieDiameter:8,tieSpacing:500,cover:50,tieZSpacing:250,tieShift:250,
  tieHookAngle:135,tieBendR:20,tieTail:40,n7Threshold:500,stationStart:0,
  n1Radius:5987.5,n1Angle:180,n1CenterY:2100,n1Wall:3452,n1Return:1886,
  n1BendR:62.5,n1Tail:125,n1HookAngle:90,n1HookSide:1,
  n2Radius:5562.5,n2Angle:180,n2CenterY:2100,n2SideRadius:10062.5,
  n2SideAngle:20.066196762948117,n2BendR:62.5,n2Tail:125,n2HookAngle:90,n2HookSide:1,
  n3Radius:12062.5,n3Angle:59.52066417656965,n3CenterY:10300,
  n3BendR:62.5,n3Tail:125,n3HookAngle:90,n3HookSide:-1,
  n4Radius:12487.5,n4Angle:57.302823035876216,n4CenterY:10300,
  n4BendR:62.5,n4Tail:125,n4HookAngle:90,n4HookSide:-1,
  invertPhase:0,endCover:0,
});

function solveAngles(p){
  const turns=[p.angle1/2,p.angle2,p.angle3,p.angle4/2].map(value=>value*DEG);
  const total=turns.reduce((sum,value)=>sum+value,0);
  if(turns.some(value=>!Number.isFinite(value)||value<=0))throw new Error('Z-PM 内轮廓角度必须大于零');
  if(Math.abs(total/DEG-180)>1e-6)throw new Error('Z-PM 内轮廓角度不闭合');
  let beta=0,x=0;const radii=[p.R1,p.R2,p.R3,p.R4];
  for(let i=0;i<4;i++){x+=radii[i]*(Math.sin(beta+turns[i])-Math.sin(beta));beta+=turns[i]}
  if(Math.abs(x)>.5)throw new Error(`Z-PM 内轮廓水平闭合误差 ${x.toFixed(3)} mm`);
  return {turns,closureX:x};
}

function innerGeometry(p){
  const angles=solveAngles(p),radii=[p.R1,p.R2,p.R3,p.R4];let point=P(0,p.crownY),beta=0;
  const parts=[],right=[point.clone()];
  for(let k=0;k<4;k++){
    const radius=radii[k],endBeta=beta+angles.turns[k];
    const center=point.clone().sub(P(radius*Math.sin(beta),radius*Math.cos(beta)));
    const end=center.clone().add(P(radius*Math.sin(endBeta),radius*Math.cos(endBeta)));
    const steps=Math.max(18,Math.ceil(angles.turns[k]/DEG)),points=[];
    for(let j=0;j<=steps;j++){const t=beta+angles.turns[k]*j/steps;points.push(center.clone().add(P(radius*Math.sin(t),radius*Math.cos(t))))}
    parts.push({name:['top','side','transition','invert'][k],radius,center,start:point.clone(),end:end.clone(),points,startBeta:beta,endBeta});
    right.push(...points.slice(1));point=end;beta=endBeta;
  }
  if(Math.abs(point.x)>.5)throw new Error('Z-PM 内轮廓圆弧链未闭合');
  point.x=0;right[right.length-1].x=0;
  return {...angles,parts,right,bottom:point.y,innerWidth:2*Math.max(...right.map(v=>v.x)),innerHeight:p.crownY-point.y};
}

function outerGeometry(p){
  const A=p.outerAngle1*DEG/2,B=p.outerAngle4*DEG/2,wallX=p.outerR1*Math.sin(A);
  if(Math.abs(p.outerAngle1-180)>1e-8)throw new Error('Z-PM 外顶拱与直墙相切要求总角 180°');
  const residual=wallX-p.footWidth-p.outerR4*Math.sin(B);
  if(Math.abs(residual)>.5)throw new Error(`Z-PM 外轮廓水平闭合误差 ${residual.toFixed(3)} mm`);
  const archCenter=P(0,p.outerCrownY-p.outerR1),spring=P(wallX,archCenter.y);
  const platformY=spring.y-p.wallLength,footOuter=P(wallX,platformY),footInner=P(wallX-p.footWidth,platformY);
  const invertCenter=P(0,platformY+p.outerR4*Math.cos(B)),arch=[],invert=[];
  for(let i=0;i<=90;i++){const t=-A+2*A*i/90;arch.push(P(archCenter.x+p.outerR1*Math.sin(t),archCenter.y+p.outerR1*Math.cos(t)))}
  for(let i=0;i<=60;i++){const t=-B+2*B*i/60;invert.push(P(invertCenter.x+p.outerR4*Math.sin(t),invertCenter.y-p.outerR4*Math.cos(t)))}
  const outer=arch.concat([footOuter,footInner],invert.slice().reverse(),[P(-wallX+p.footWidth,platformY),P(-wallX,platformY)]);
  return {outer,archCenter,invertCenter,platformY,wallX,outerBottom:invertCenter.y-p.outerR4};
}

function mirrored(right){return right.concat(right.slice(1,-1).reverse().map(v=>P(-v.x,v.y)))}
function polygonArea(points){return Math.abs(points.reduce((sum,a,index)=>{const b=points[(index+1)%points.length];return sum+a.x*b.y-b.x*a.y},0))/2}

export function buildZpmProfiles(parameters={}){
  const p={...ZPM_LINING_DEFAULTS,...parameters},inner=innerGeometry(p),outer=outerGeometry(p);
  const innerPolygon=mirrored(inner.right),outerPolygon=outer.outer;
  const crownThickness=p.outerCrownY-p.crownY,invertThickness=inner.bottom-outer.outerBottom;
  if(crownThickness<=0||invertThickness<=0)throw new Error('Z-PM 二衬厚度无效');
  return {parameters:p,inner,outer,innerPolygon,outerPolygon,areaM2:(polygonArea(outerPolygon)-polygonArea(innerPolygon))/1e6,crownThicknessMm:crownThickness,invertThicknessMm:invertThickness};
}

function upper(radius,angle,centerY){const points=[];for(let i=0;i<=120;i++){const t=(-angle/2+angle*i/120)*DEG;points.push(P(radius*Math.sin(t),centerY+radius*Math.cos(t)))}return points}
function lower(radius,angle,centerY){const points=[];for(let i=0;i<=120;i++){const t=(-angle/2+angle*i/120)*DEG;points.push(P(radius*Math.sin(t),centerY-radius*Math.cos(t)))}return points}
function lineLength(points){let length=0;for(let i=1;i<points.length;i++)length+=points[i].distanceTo(points[i-1]);return length}
function pathAt(points,distance,closed=false){
  let total=0,max=closed?points.length:points.length-1;for(let i=0;i<max;i++)total+=points[i].distanceTo(points[(i+1)%points.length]);
  let s=closed?((distance%total)+total)%total:Math.max(0,Math.min(distance,total));
  for(let i=0;i<max;i++){const a=points[i],b=points[(i+1)%points.length],length=a.distanceTo(b);if(s<=length+1e-8||i===max-1)return {point:a.clone().lerp(b,length?s/length:0),tangent:b.clone().sub(a).normalize(),total};s-=length}
}

function independentTemplates(p){
  const templates={};
  for(let n=1;n<=4;n++){
    const prefix=`n${n}`,id=`N${n}`,radius=p[`${prefix}Radius`],angle=p[`${prefix}Angle`],centerY=p[`${prefix}CenterY`];let base;
    if(n===1){const crown=upper(radius,angle,centerY),left=crown[0],right=crown.at(-1);base=[P(left.x+p.n1Return,left.y-p.n1Wall),P(left.x,left.y-p.n1Wall),...crown,P(right.x,right.y-p.n1Wall),P(right.x-p.n1Return,right.y-p.n1Wall)]}
    else if(n===2){const half=upper(radius,angle,centerY).slice(60),a=angle/2*DEG,sideRadius=p.n2SideRadius,sideAngle=p.n2SideAngle*DEG,shoulder=half.at(-1),center=shoulder.clone().sub(P(Math.sin(a),Math.cos(a)).multiplyScalar(sideRadius));for(let i=1;i<=60;i++){const t=a+sideAngle*i/60;half.push(P(center.x+sideRadius*Math.sin(t),center.y+sideRadius*Math.cos(t)))}base=half.slice().reverse().map(v=>P(-v.x,v.y)).concat(half.slice(1))}
    else base=lower(radius,angle,centerY);
    templates[id]={id,base,points:base,centerLength:lineLength(base),diameter:p.mainDiameter,phase:n>=3?p.invertPhase:0};
  }
  return {templates,footY:templates.N1.base[0].y,wallTopY:p.n1CenterY,xWall:p.n1Radius};
}

function normalLineHits(origin,direction,paths,positive=false){
  const hits=[];for(const {points,id} of paths)for(let i=1;i<points.length;i++){const a=points[i-1],v=points[i].clone().sub(a),w=a.clone().sub(origin),den=direction.x*v.y-direction.y*v.x;if(Math.abs(den)<1e-10)continue;const t=(w.x*v.y-w.y*v.x)/den,u=(w.x*direction.y-w.y*direction.x)/den;if(u>=-1e-7&&u<=1+1e-7&&(!positive||t>1e-6))hits.push({point:origin.clone().addScaledVector(direction,t),t,tangent:v.normalize(),id})}return hits;
}

function independentStations(bundle){
  const templates=bundle.templates,allPoints=Object.values(templates).flatMap(t=>t.base),ys=allPoints.map(v=>v.y),origin=P(0,(Math.max(...ys)+Math.min(...ys))/2);
  const inner=[{points:templates.N2.points,id:'N2'},{points:templates.N3.points,id:'N3'}],outer=[{points:templates.N1.points,id:'N1'},{points:templates.N4.points,id:'N4'}];
  function ray(direction){const a=normalLineHits(origin,direction,inner,true).sort((x,y)=>x.t-y.t)[0],b=normalLineHits(origin,direction,outer,true).sort((x,y)=>y.t-x.t)[0];if(!a||!b||b.t-a.t<30)throw new Error('Z-PM 主筋之间存在无法配对的环向空缺');return {inner:a,outer:b,mid:a.point.clone().add(b.point).multiplyScalar(.5)}}
  const mids=[];for(let i=0;i<360;i++){const angle=Math.PI/2-i*Math.PI/180;mids.push(ray(P(Math.cos(angle),Math.sin(angle))).mid)}const total=pathAt(mids,0,true).total;
  return {mids,total,at(distance){const sample=pathAt(mids,distance,true),direction=sample.point.clone().sub(origin).normalize();return {...ray(direction),s:((distance%total)+total)%total}}};
}

function invertStations(bundle){
  const inner=bundle.templates.N3.base,outer=bundle.templates.N4.base,innerLength=lineLength(inner),outerLength=lineLength(outer),mids=[];
  for(let i=0;i<=120;i++){const f=i/120;mids.push(pathAt(inner,f*innerLength).point.add(pathAt(outer,f*outerLength).point).multiplyScalar(.5))}const total=lineLength(mids);
  return {total,at(distance){const f=Math.max(0,Math.min(1,distance/total)),a=pathAt(inner,f*innerLength),b=pathAt(outer,f*outerLength);return {s:distance,invert:true,inner:{...a,id:'N3'},outer:{...b,id:'N4'},mid:a.point.clone().add(b.point).multiplyScalar(.5)}}};
}

function footStation(st,bundle,p){
  const wallX=Math.max(...bundle.templates.N1.base.map(v=>Math.abs(v.x))),foot=bundle.templates.N1.base[0];
  if(st.mid.y<foot.y||st.mid.y>bundle.wallTopY||Math.abs(st.mid.x)<Math.abs(foot.x))return st;
  const side=st.mid.x<0?-1:1,origin=P(0,st.mid.y),direction=P(side,0);
  const inner=normalLineHits(origin,direction,[{points:bundle.templates.N2.base,id:'N2'}],true).sort((a,b)=>a.t-b.t)[0];
  const outer=normalLineHits(origin,direction,[{points:bundle.templates.N1.base,id:'N1'}],true).filter(hit=>Math.abs(hit.point.x-side*wallX)<1).sort((a,b)=>b.t-a.t)[0];
  if(!inner||!outer||outer.t-inner.t<=p.mainDiameter)return st;return {...st,inner,outer,footHorizontal:true};
}

function axialPositions(p,phase=0){const length=p.length*1000,start=((phase%p.ringSpacing)+p.ringSpacing)%p.ringSpacing,zs=[];for(let z=start;z<length-1e-7;z+=p.ringSpacing)zs.push(z);return zs}
const v3=(x,y,z)=>[x,y,z],sub3=(a,b)=>a.map((v,i)=>v-b[i]),add3=(a,b)=>a.map((v,i)=>v+b[i]),mul3=(a,s)=>a.map(v=>v*s),len3=a=>Math.hypot(...a),unit3=a=>mul3(a,1/(len3(a)||1));
function tieShape(a,b,z,p,row){
  const A=v3(a.x,a.y,z),B=v3(b.x,b.y,z),u=unit3(sub3(B,A)),zAxis=[0,0,1],v=unit3(sub3(zAxis,mul3(u,u[2]))),sign=row%2?1:-1,R=p.tieBendR,angle=p.tieHookAngle*DEG;
  function bend(start,tangent,side){const points=[];for(let i=0;i<=12;i++){const q=angle*i/12;points.push(add3(add3(start,mul3(tangent,R*Math.sin(q))),mul3(v,side*R*(1-Math.cos(q)))))}const direction=add3(mul3(tangent,Math.cos(angle)),mul3(v,side*Math.sin(angle)));points.push(add3(points.at(-1),mul3(direction,p.tieTail)));return points}
  return bend(A,mul3(u,-1),sign).reverse().concat([B],bend(B,u,-sign).slice(1));
}

export function buildZpmRebarData(parameters={}){
  const p={...ZPM_LINING_DEFAULTS,...parameters},bundle=independentTemplates(p),master=independentStations(bundle),bars=[],counts={N1:0,N2:0,N3:0,N4:0,N5:0,N6:0,N7:0};
  const mainPositions={};for(const [id,template] of Object.entries(bundle.templates)){mainPositions[id]=axialPositions(p,template.phase);for(const z of mainPositions[id]){bars.push({id,name:`${id}_${counts[id]++}`,diameter:p.mainDiameter,points:template.points.map(v=>[v.x,v.y,z]),axisLength:template.centerLength,z})}}
  for(let s=p.stationStart;s<master.total-1e-7;s+=p.longSpacing){const st=master.at(s);for(const side of ['inner','outer']){const hit=st[side],point=hit.point.clone();bars.push({id:'N5',name:`N5_${counts.N5++}`,diameter:p.longDiameter,points:[[point.x,point.y,0],[point.x,point.y,p.length*1000]],axisLength:p.length*1000,s,layer:side,connectedMain:hit.id})}}
  const invert=invertStations(bundle),zs=axialPositions(p,0);let row=0;
  for(const z of zs){const shift=(row%2)*p.tieShift,stations=[];for(let s=p.stationStart+shift;s<master.total-1e-7;s+=p.tieSpacing){const station=footStation(master.at(s),bundle,p);if(station.inner.id!=='N3'&&station.outer.id!=='N4')stations.push(station)}for(let s=p.stationStart+shift;s<invert.total-1e-7;s+=p.tieSpacing)stations.push(invert.at(s));for(const st of stations){const id=st.footHorizontal?'N7':'N6',points=tieShape(st.inner.point,st.outer.point,z,p,row);bars.push({id,name:`${id}_${counts[id]++}`,diameter:p.tieDiameter,points,axisLength:points.slice(1).reduce((sum,pt,i)=>sum+len3(sub3(pt,points[i])),0),s:st.s,z,connectedMain:[st.inner.id,st.outer.id]})}row++}
  return {bars,counts,templates:bundle.templates,masterLengthMm:master.total,warnings:['S-PM/Z-PM 图名适用关系、焊接搭接及弯钩节点仍需工程确认']};
}

class BarCurve extends THREE.Curve{
  constructor(points){super();this.points=points.map(v=>new THREE.Vector3(v[0]/1000,v[1]/1000,v[2]/1000));this.cumulative=[0];for(let i=1;i<this.points.length;i++)this.cumulative.push(this.cumulative.at(-1)+this.points[i].distanceTo(this.points[i-1]));this.total=this.cumulative.at(-1)}
  getPoint(t,target=new THREE.Vector3()){const s=Math.max(0,Math.min(1,t))*this.total;let i=1;while(i<this.cumulative.length-1&&this.cumulative[i]<s)i++;const a=this.cumulative[i-1],b=this.cumulative[i];return target.copy(this.points[i-1]).lerp(this.points[i],b>a?(s-a)/(b-a):0)}
}

function tube(points,diameterMm){const curve=new BarCurve(points);if(curve.total<1e-8)throw new Error('Z-PM 钢筋路径长度为零');return new THREE.TubeGeometry(curve,Math.max(12,Math.min(320,points.length*2)),diameterMm/2000,6,false)}

export function createZpmAssembly(parameters={}){
  const profile=buildZpmProfiles(parameters),p=profile.parameters,root=new THREE.Group();root.name='ZPMAssemblyGroup';
  const concreteGroup=new THREE.Group();concreteGroup.name='secondaryLiningGroup';const shape=new THREE.Shape(profile.outerPolygon.map(v=>P(v.x/1000,v.y/1000))),hole=new THREE.Path(profile.innerPolygon.map(v=>P(v.x/1000,v.y/1000)));shape.holes.push(hole);const concrete=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:p.length,bevelEnabled:false}),new THREE.MeshStandardMaterial({color:0x8799aa,roughness:.82,transparent:true,opacity:.55,side:THREE.DoubleSide}));concrete.name='ZPMSecondaryLiningConcrete';concrete.userData={component:'secondary_lining',area_m2:profile.areaM2,volume_m3:profile.areaM2*p.length,source_status:'CONFIRMED'};concreteGroup.add(concrete);root.add(concreteGroup);
  const data=buildZpmRebarData(p),colors={N1:0x5599f1,N2:0x48c6a1,N3:0xf1b652,N4:0xb58bed,N5:0x40d3e0,N6:0xe16fac,N7:0xf28b67},groups={};
  for(const id of Object.keys(colors)){const group=new THREE.Group();group.name=`${id}Group`;group.userData={component:id,source_status:'PARTIAL',applicability_status:'NEEDS_CONFIRMATION'};groups[id]=group;root.add(group)}
  const materials=Object.fromEntries(Object.entries(colors).map(([id,color])=>[id,new THREE.MeshStandardMaterial({color,metalness:.35,roughness:.48})]));
  for(const bar of data.bars){const mesh=new THREE.Mesh(tube(bar.points,bar.diameter),materials[bar.id]);mesh.name=bar.name;const {points,...metadata}=bar;mesh.userData={...metadata,axisLengthMm:bar.axisLength};groups[bar.id].add(mesh)}
  root.userData={schema:'zpm-lining-v1.4',support_type:'Z-PM',coordinate_units:'m',input_units:'mm_except_length_m',parameters:p,counts:data.counts,source_pages:[84,85],source_drawing:'S5-2-3-1-1',concrete_status:'CONFIRMED',rebar_status:'PARTIAL',rebar_applicability:'NEEDS_CONFIRMATION',warnings:data.warnings};
  return {group:root,profile,rebar:data,validation:{status:'PARTIAL',profile_closed:true,crown_thickness_mm:profile.crownThicknessMm,invert_thickness_mm:profile.invertThicknessMm,warnings:data.warnings}};
}

export function zpmHelperPaths(parameters={}){const profile=buildZpmProfiles(parameters),bars=independentTemplates(profile.parameters);return {inner:profile.innerPolygon.map(v=>[v.x/1000,v.y/1000]),outer:profile.outerPolygon.map(v=>[v.x/1000,v.y/1000]),bars:Object.fromEntries(Object.entries(bars.templates).map(([id,t])=>[id,t.base.map(v=>[v.x/1000,v.y/1000])]))}}
