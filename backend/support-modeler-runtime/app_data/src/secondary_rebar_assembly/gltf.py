"""含二衬、N1、N2三个独立网格的 GLB 写出与检查。"""
from __future__ import annotations
import json, struct
from pathlib import Path

def _pad(b, fill): return b + fill*((4-len(b)%4)%4)

def write_assembly_glb(meshes, path: Path):
    binary=b""; views=[]; accessors=[]; gltf_meshes=[]; nodes=[]
    materials=[
      {"name":"C35 reinforced concrete","pbrMetallicRoughness":{"baseColorFactor":[.55,.58,.62,.58],"metallicFactor":0,"roughnessFactor":.82},"alphaMode":"BLEND","doubleSided":True},
      {"name":"N1 HRB400","pbrMetallicRoughness":{"baseColorFactor":[.50,.22,.12,1],"metallicFactor":.55,"roughnessFactor":.45}},
      {"name":"N2 HRB400","pbrMetallicRoughness":{"baseColorFactor":[.18,.34,.48,1],"metallicFactor":.55,"roughnessFactor":.45}}]
    for idx,(name,mesh) in enumerate(meshes.items()):
        pos=b"".join(struct.pack("<3f",*v) for v in mesh["vertices"]); ind=b"".join(struct.pack("<I",i) for i in mesh["indices"])
        po=len(binary); binary+=_pad(pos,b"\0"); io=len(binary); binary+=_pad(ind,b"\0")
        views += [{"buffer":0,"byteOffset":po,"byteLength":len(pos),"target":34962},{"buffer":0,"byteOffset":io,"byteLength":len(ind),"target":34963}]
        ai=len(accessors); accessors += [{"bufferView":2*idx,"componentType":5126,"count":len(mesh["vertices"]),"type":"VEC3","min":mesh["bbox_m"]["min"],"max":mesh["bbox_m"]["max"]},{"bufferView":2*idx+1,"componentType":5125,"count":len(mesh["indices"]),"type":"SCALAR","min":[min(mesh["indices"])],"max":[max(mesh["indices"])]}]
        gltf_meshes.append({"name":name,"primitives":[{"attributes":{"POSITION":ai},"indices":ai+1,"material":idx}]}); nodes.append({"name":name,"mesh":idx})
    doc={"asset":{"version":"2.0","generator":"SupportParameterExtractor N1/N2 assembly"},"scene":0,"scenes":[{"name":"secondaryRebarAssemblyGroup","nodes":[0]}],
         "nodes":[{"name":"secondaryRebarAssemblyGroup","children":[1,2,3]}]+nodes,"meshes":gltf_meshes,"materials":materials,"buffers":[{"byteLength":len(binary)}],"bufferViews":views,"accessors":accessors,
         "extras":{"coordinate_system":"x_right_y_up_z_forward_m","components":["secondaryLiningMesh","N1Mesh","N2Mesh"]}}
    jc=_pad(json.dumps(doc,separators=(",",":"),ensure_ascii=False).encode(),b" "); body=struct.pack("<I4s",len(jc),b"JSON")+jc+struct.pack("<I4s",len(binary),b"BIN\0")+binary
    payload=struct.pack("<4sII",b"glTF",2,12+len(body))+body; path.parent.mkdir(parents=True,exist_ok=True); path.write_bytes(payload)
    return inspect_assembly_glb(path)

def inspect_assembly_glb(path: Path):
    p=path.read_bytes(); magic,version,total=struct.unpack_from("<4sII",p,0)
    if (magic,version,total)!=(b"glTF",2,len(p)): raise ValueError("invalid GLB")
    n,t=struct.unpack_from("<I4s",p,12); doc=json.loads(p[20:20+n].decode().rstrip(" \0"))
    return {"path":str(path),"byte_length":len(p),"mesh_count":len(doc["meshes"]),"mesh_names":[m["name"] for m in doc["meshes"]],"node_names":[x["name"] for x in doc["nodes"]],"generator":doc["asset"]["generator"]}
