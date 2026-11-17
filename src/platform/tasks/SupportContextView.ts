import * as C from 'cesium'
/** Nearest reference in an orthogonal rendered sampling box, never a geological interface. */
export function supportContextReference(support:C.BoundingSphere,corners:readonly C.Cartesian3[]){
 if(corners.length!==8)throw Error('缺少当前围岩采样盒参照')
 const origin=corners[0]!,delta=C.Cartesian3.subtract(support.center,origin,new C.Cartesian3()),nearest=C.Cartesian3.clone(origin)
 const axes:C.Cartesian3[]=[],fractions:number[]=[]
 for(const index of [4,2,1]){
  const axis=C.Cartesian3.subtract(corners[index]!,origin,new C.Cartesian3()),length2=C.Cartesian3.magnitudeSquared(axis)
  if(!Number.isFinite(length2)||length2<=0)throw Error('围岩参照采样盒退化')
  if(axes.some(other=>Math.abs(C.Cartesian3.dot(axis,other))/Math.sqrt(length2*C.Cartesian3.magnitudeSquared(other))>1e-5))throw Error('围岩参照采样盒非正交，不能使用邻近投影')
  axes.push(axis)
  const t=C.Math.clamp(C.Cartesian3.dot(delta,axis)/length2,0,1)
  fractions.push(t)
  C.Cartesian3.add(nearest,C.Cartesian3.multiplyByScalar(axis,t,new C.Cartesian3()),nearest)
 }
 const radius=Math.max(4,Math.min(12,support.radius)),probes=[C.Cartesian3.clone(nearest)]
 for(const [i,axis] of axes.entries())for(const sign of [-1,1]){
  const length=C.Cartesian3.magnitude(axis),t=C.Math.clamp(fractions[i]!+sign*radius/length,0,1)-fractions[i]!
  probes.push(C.Cartesian3.add(nearest,C.Cartesian3.multiplyByScalar(axis,t,new C.Cartesian3()),new C.Cartesian3()))
 }
 const unique=probes.filter((point,i)=>probes.findIndex(other=>C.Cartesian3.distance(point,other)<1e-6)===i)
 return {nearest,probes:unique,radius,sphere:C.BoundingSphere.fromBoundingSpheres([support,new C.BoundingSphere(nearest,radius)])}
}

export function supportContextSphere(support:C.BoundingSphere,corners:readonly C.Cartesian3[]){return supportContextReference(support,corners).sphere}
