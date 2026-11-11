import * as T from 'three'

/** Map each cross-section to shared station boundaries, closing curved/graded joints. */
export function fitSupportUnit(geometry: T.BufferGeometry, start: T.Matrix4, end: T.Matrix4) {
  const result = geometry.clone()
  const positions = result.getAttribute('position')
  const a = new T.Vector3(), b = new T.Vector3()
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i)
    // Inclined anchors can extend beyond the nominal 0..1 m unit; preserve
    // their continuation rather than flattening them onto its boundary.
    a.set(x, y, 0).applyMatrix4(start)
    b.set(x, y, 0).applyMatrix4(end)
    a.lerp(b, z)
    positions.setXYZ(i, a.x, a.y, a.z)
  }
  result.computeVertexNormals()
  result.computeBoundingBox()
  result.computeBoundingSphere()
  return result
}
