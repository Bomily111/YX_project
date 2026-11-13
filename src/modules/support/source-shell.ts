import * as T from 'three'

/** Reuse source vertices/triangles; join their end sections on the target line.
 * Only internal axial caps are omitted. No replacement profile is generated. */
export function placeSourceShell(source:T.BufferGeometry, prototype:T.Matrix4,
  pose:(distance:number)=>T.Matrix4, station:number, first:boolean, last:boolean) {
  const local=source.clone().applyMatrix4(prototype)
  local.computeBoundingBox()
  const positions=local.getAttribute('position'), box=local.boundingBox!
  if(Math.abs(box.min.z)>1e-3||Math.abs(box.max.z-1)>1e-3) {
    local.dispose()
    throw new Error('源混凝土单元不是已核实的0～1米轴向范围，拒绝推断连续外壳')
  }
  const indices:number[]=[], count=local.index?.count??positions.count
  const index=(i:number)=>local.index?local.index.getX(i):i
  for(let i=0;i<count;i+=3){
    const triangle=[index(i),index(i+1),index(i+2)]
    const back=triangle.every(j=>Math.abs(positions.getZ(j))<1e-3)
    const front=triangle.every(j=>Math.abs(positions.getZ(j)-1)<1e-3)
    if((back&&!first)||(front&&!last))continue
    indices.push(...triangle)
  }
  for(let i=0;i<positions.count;i++){
    const v=new T.Vector3().fromBufferAttribute(positions,i), z=Math.min(1,Math.max(0,v.z))
    v.z=0;v.applyMatrix4(pose(station+z));positions.setXYZ(i,v.x,v.y,v.z)
  }
  local.setIndex(indices);local.computeVertexNormals();local.computeBoundingBox();local.computeBoundingSphere()
  return local
}
