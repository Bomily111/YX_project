import {expect,it} from 'vitest'
import * as T from 'three'
import {generatedObjectBounds,validGeneratedBounds} from '@/modules/support/generated-bounds'
it('contains generated instanced vertices after parent and instance transformations',()=>{
 const root=new T.Group(),geometry=new T.BoxGeometry(2,4,6),mesh=new T.InstancedMesh(geometry,new T.MeshBasicMaterial(),2)
 root.position.set(10,2,-3);root.rotation.z=.3;root.add(mesh)
 for(let i=0;i<2;i++)mesh.setMatrixAt(i,new T.Matrix4().makeRotationY(i*.4).setPosition(i*7,0,i*2))
 const bounds=generatedObjectBounds(mesh)!,box=new T.Box3(new T.Vector3(...bounds.min as [number,number,number]),new T.Vector3(...bounds.max as [number,number,number]))
 for(let i=0;i<2;i++){
  const instance=new T.Matrix4();mesh.getMatrixAt(i,instance)
  for(let j=0;j<geometry.attributes.position.count;j++){
   const v=new T.Vector3().fromBufferAttribute(geometry.attributes.position,j).applyMatrix4(instance).applyMatrix4(mesh.matrixWorld)
   expect(box.clone().expandByScalar(1e-6).containsPoint(v)).toBe(true)
  }
 }
 expect(generatedObjectBounds(new T.Group())).toBeUndefined()
 expect(validGeneratedBounds({min:[0,0,0],max:[NaN,1,1]})).toBe(false)
 expect(validGeneratedBounds({min:[0,0,0],max:[0,0,0]})).toBe(false)
})
