import * as C from 'cesium'
import profile from './tunnel-normal-sections.json'
import origin from '@/modules/rock/three-bench.metadata.json'
import {ShapeUtils,Vector2} from 'three'

export function taskFaceGeometry(section:ReturnType<typeof taskFaceSection>){
  // Keep positions and UVs in one index space. Polygon hierarchy processing
  // may reverse its 3D and UV rings independently for a vertical face.
  const indices=ShapeUtils.triangulateShape(section.uv.map(p=>new Vector2(p.x,p.y)),[]).flat()
  const a=section.positions[indices[0]!]!,b=section.positions[indices[1]!]!,c=section.positions[indices[2]!]!
  const normal=C.Cartesian3.normalize(C.Cartesian3.cross(C.Cartesian3.subtract(b,a,new C.Cartesian3()),C.Cartesian3.subtract(c,a,new C.Cartesian3()),new C.Cartesian3()),new C.Cartesian3())
  return new C.Geometry({
    attributes:Object.assign(new C.GeometryAttributes(),{
      position:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.DOUBLE,componentsPerAttribute:3,values:new Float64Array(section.positions.flatMap(p=>[p.x,p.y,p.z]))}),
      st:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.FLOAT,componentsPerAttribute:2,values:new Float32Array(section.uv.flatMap(p=>[p.x,p.y]))}),
      normal:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.FLOAT,componentsPerAttribute:3,values:new Float32Array(section.positions.flatMap(()=>[normal.x,normal.y,normal.z]))}),
    }),indices:new Uint16Array(indices),primitiveType:C.PrimitiveType.TRIANGLES,boundingSphere:C.BoundingSphere.fromPoints(section.positions),
  })
}

export function faceSliceSphere(face?:C.Entity):C.BoundingSphere|undefined {
  const time=C.JulianDate.now(),positions=face?.polygon?.hierarchy?.getValue(time)?.positions
  if(positions?.length)return C.BoundingSphere.fromPoints(positions)
  const center=face?.position?.getValue(time)
  return center?new C.BoundingSphere(center,6):undefined
}

/** Source section only; photo UVs are illustrative and are not calibration. */
export function taskFaceSection(frame:C.Matrix4){
  const section=profile.sections[0]!
  const xs=section.outline.map(p=>p[0]!),ys=section.outline.map(p=>p[1]!)
  const xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys)
  const world=(x:number,y:number)=>{
    const p=section.frame.center.map((v,i)=>v+section.frame.lateral[i]!*x+section.frame.up[i]!*y)
    return C.Matrix4.multiplyByPoint(frame,new C.Cartesian3(p[2]!-origin.sourceGltfOrigin[2]!,p[1]!-origin.sourceGltfOrigin[1]!,origin.sourceGltfOrigin[0]!-p[0]!),new C.Cartesian3())
  }
  return {positions:section.outline.map(p=>world(p[0]!,p[1]!)),
    // Cesium's hierarchy type is shared with Cartesian3 geometry hierarchies;
    // texture coordinates themselves are Cartesian2, as required by PolygonGraphics.
    uv:section.outline.map(p=>new C.Cartesian2(1-(p[0]!-xmin)/(xmax-xmin),(p[1]!-ymin)/(ymax-ymin))),
    center:world((xmin+xmax)/2,(ymin+ymax)/2),widthM:xmax-xmin,heightM:ymax-ymin,
    source:'tunnel002.glb / tunnel-normal-sections.json / sections[0]',
  }
}
