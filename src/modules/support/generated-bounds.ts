import * as T from 'three'
import * as C from 'cesium'
export interface GeneratedBounds {min:number[];max:number[]}
export function validGeneratedBounds(value:unknown):value is GeneratedBounds {
 const b=value as GeneratedBounds|undefined
 return !!b&&Array.isArray(b.min)&&Array.isArray(b.max)&&b.min.length===3&&b.max.length===3&&[...b.min,...b.max].every(Number.isFinite)&&b.min.every((n,i)=>n<=b.max[i]!)&&b.min.some((n,i)=>n<b.max[i]!)
}
/** Conservative bounds of the actual generated static meshes and instances in asset space. */
export function generatedObjectBounds(object:T.Object3D):GeneratedBounds|undefined {
 object.updateWorldMatrix(true,true)
 const box=new T.Box3().setFromObject(object),bounds={min:box.min.toArray(),max:box.max.toArray()}
 return validGeneratedBounds(bounds)?bounds:undefined
}
/** Asset-space corners for the existing Z-up/X-forward support loading path. */
export function generatedBoundsWorldPoints(bounds:GeneratedBounds,matrix:C.Matrix4):C.Cartesian3[] {
 const points:C.Cartesian3[]=[]
 for(const x of [bounds.min[0]!,bounds.max[0]!])for(const y of [bounds.min[1]!,bounds.max[1]!])for(const z of [bounds.min[2]!,bounds.max[2]!])points.push(C.Matrix4.multiplyByPoint(matrix,new C.Cartesian3(x,y,z),new C.Cartesian3()))
 return points
}
