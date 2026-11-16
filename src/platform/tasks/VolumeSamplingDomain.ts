import * as C from 'cesium'
export function volumeSamplingDomain(matrix:ArrayLike<number>,properties:Record<string,unknown>){
 if(matrix.length!==16||!Array.from(matrix).every(Number.isFinite))throw Error('体数据变换不可用')
 const ranges=['x','y','z'].map(axis=>['min','max'].map(end=>typeof properties[`${axis}${end}`]==='number'?properties[`${axis}${end}`] as number:NaN))
 if(ranges.some(([min,max])=>!Number.isFinite(min)||!Number.isFinite(max)||min!<0||max!>1||min!>=max!))throw Error('体数据采样范围不可用')
 const transform=C.Matrix4.fromArray(Array.from(matrix)),corners:C.Cartesian3[]=[]
 for(const x of ranges[0]!)for(const y of ranges[1]!)for(const z of ranges[2]!)corners.push(C.Matrix4.multiplyByPoint(transform,new C.Cartesian3(x,y,z),new C.Cartesian3()))
 const scale=C.Matrix4.getScale(transform,new C.Cartesian3())
 const dimensions=ranges.map(([min,max],i)=>[scale.x,scale.y,scale.z][i]!*(max!-min!))
 if(dimensions.some(d=>!Number.isFinite(d)||d<=0))throw Error('体数据采样盒退化')
 return {corners,dimensionsM:dimensions,ranges,sphere:C.BoundingSphere.fromPoints(corners),scope:'rendered-sampling-domain-not-geological-boundary',engineeringAcceptance:'not-verified'}
}
