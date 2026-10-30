"""初支钢筋网及其统一总装 GLB 写出与检查。"""
from __future__ import annotations

import json
import struct
from pathlib import Path
from typing import Any

COLORS = {
    "primarySupportConcreteTopSideMesh": [0.76, 0.68, 0.49, 0.40],
    "primaryMeshCircumferentialBarsMesh": [0.18, 0.72, 0.52, 1.0],
    "primaryMeshLongitudinalBarsMesh": [0.16, 0.55, 0.82, 1.0],
    "steelArchMesh": [0.25, 0.29, 0.34, 1.0],
    "secondaryLiningMesh": [0.55, 0.62, 0.70, 0.35],
    "N1Mesh": [0.50, 0.22, 0.12, 1.0], "N2Mesh": [0.18, 0.34, 0.48, 1.0],
    "N3Mesh": [0.62, 0.66, 0.70, 1.0], "N4Mesh": [0.72, 0.58, 0.22, 1.0],
}


def _pad(data: bytes, fill: bytes) -> bytes:
    return data + fill * ((4 - len(data) % 4) % 4)


def _write(meshes: dict[str, dict[str, Any]], nodes: list[dict[str, Any]], extras: dict[str, Any], path: Path) -> dict[str, Any]:
    binary=b""; views=[]; accessors=[]; gm=[]; materials=[]
    for i,(name,mesh) in enumerate(meshes.items()):
        pos=b"".join(struct.pack("<3f",*v) for v in mesh["vertices"]); ind=b"".join(struct.pack("<I",x) for x in mesh["indices"])
        po=len(binary);binary+=_pad(pos,b"\0");io=len(binary);binary+=_pad(ind,b"\0")
        views += [{"buffer":0,"byteOffset":po,"byteLength":len(pos),"target":34962},{"buffer":0,"byteOffset":io,"byteLength":len(ind),"target":34963}]
        ai=len(accessors); accessors += [{"bufferView":2*i,"componentType":5126,"count":len(mesh["vertices"]),"type":"VEC3","min":mesh["bbox_m"]["min"],"max":mesh["bbox_m"]["max"]},{"bufferView":2*i+1,"componentType":5125,"count":len(mesh["indices"]),"type":"SCALAR","min":[min(mesh["indices"])],"max":[max(mesh["indices"])]}]
        gm.append({"name":name,"primitives":[{"attributes":{"POSITION":ai},"indices":ai+1,"material":i}]})
        color=COLORS[name]; transparent=color[3]<1
        materials.append({"name":name.replace("Mesh"," material"),"pbrMetallicRoughness":{"baseColorFactor":color,"metallicFactor":.55 if "Bars" in name or name=="steelArchMesh" else 0,"roughnessFactor":.42 if "Bars" in name else .8},"alphaMode":"BLEND" if transparent else "OPAQUE","doubleSided":transparent})
    doc={"asset":{"version":"2.0","generator":"SupportParameterExtractor primary_mesh"},"scene":0,"scenes":[{"name":nodes[0]["name"],"nodes":[0]}],"nodes":nodes,"meshes":gm,"materials":materials,"buffers":[{"byteLength":len(binary)}],"bufferViews":views,"accessors":accessors,"extras":extras}
    jc=_pad(json.dumps(doc,ensure_ascii=False,separators=(",",":")).encode(),b" ");body=struct.pack("<I4s",len(jc),b"JSON")+jc+struct.pack("<I4s",len(binary),b"BIN\0")+binary;payload=struct.pack("<4sII",b"glTF",2,12+len(body))+body
    path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(payload);return inspect_glb(path)


def write_primary_mesh_glb(circum: dict[str, Any], longitudinal: dict[str, Any], path: Path) -> dict[str, Any]:
    nodes=[{"name":"primarySupportMeshGroup","children":[1,3]},{"name":"circumferentialMeshGroup","children":[2]},{"name":"primaryMeshCircumferentialBarsMesh","mesh":0},{"name":"longitudinalMeshGroup","children":[4]},{"name":"primaryMeshLongitudinalBarsMesh","mesh":1}]
    extras={"support_type":"ZZ-Va","status":"PRIMARY_SUPPORT_MESH_PARTIAL","scope":"ARCH_AND_WALL_ONLY","invert":"NOT_APPLICABLE","unresolved":"LOCAL_STEEL_ARCH_CONNECTION_UNRESOLVED","diameter_mm":8,"spacing_mm":{"circumferential":200,"longitudinal":200}}
    return _write({"primaryMeshCircumferentialBarsMesh":circum,"primaryMeshLongitudinalBarsMesh":longitudinal},nodes,extras,path)


def write_combined_glb(meshes: dict[str, dict[str, Any]], path: Path) -> dict[str, Any]:
    # Mesh 顺序：concrete, circum, longitudinal, steel, lining, N1..N4。
    nodes=[
        {"name":"ZZVaSectionAssemblyGroup","children":[1,9]},
        {"name":"primarySupportGroup","children":[2,4,8]},
        {"name":"primarySupportConcreteGroup","children":[3]},{"name":"primarySupportConcreteTopSideMesh","mesh":0},
        {"name":"primarySupportMeshGroup","children":[5,7]},
        {"name":"circumferentialMeshGroup","children":[6]},{"name":"primaryMeshCircumferentialBarsMesh","mesh":1},
        {"name":"longitudinalMeshGroup","children":[14]},{"name":"steelArchGroup","children":[15]},
        {"name":"secondarySystemGroup","children":[10,12]},
        {"name":"secondaryLiningGroup","children":[11]},{"name":"secondaryLiningMesh","mesh":4},
        {"name":"secondaryRebarGroup","children":[16,18,20,22]},
        {"name":"assemblyMetadata"},{"name":"primaryMeshLongitudinalBarsMesh","mesh":2},{"name":"steelArchMesh","mesh":3},
        {"name":"N1Group","children":[17]},{"name":"N1Mesh","mesh":5},{"name":"N2Group","children":[19]},{"name":"N2Mesh","mesh":6},
        {"name":"N3Group","children":[21]},{"name":"N3Mesh","mesh":7},{"name":"N4Group","children":[23]},{"name":"N4Mesh","mesh":8},
    ]
    extras={"support_type":"ZZ-Va","assembly_scope":"IMPLEMENTED_COMPONENTS_WITH_PRIMARY_MESH_PARTIAL","scope":"ARCH_AND_WALL_ONLY","invert":"NOT_APPLICABLE","unresolved":"LOCAL_STEEL_ARCH_CONNECTION_UNRESOLVED","primary_mesh_steel_relation":"PRIMARY_MESH_STEEL_RELATION_NEEDS_REVIEW","contains":["primary_support_concrete_arch_wall","primary_support_mesh_arch_wall","steel_arch","secondary_lining","N1","N2","N3","N4"]}
    return _write(meshes,nodes,extras,path)


def inspect_glb(path: Path) -> dict[str, Any]:
    p=Path(path).read_bytes();magic,version,total=struct.unpack_from("<4sII",p,0)
    if (magic,version,total)!=(b"glTF",2,len(p)):raise ValueError("无效GLB")
    n,t=struct.unpack_from("<I4s",p,12);doc=json.loads(p[20:20+n].decode().rstrip(" \0"));positions=[a for a in doc["accessors"] if a["type"]=="VEC3"]
    mins=[min(a["min"][k] for a in positions) for k in range(3)];maxs=[max(a["max"][k] for a in positions) for k in range(3)]
    return {"path":str(path),"byte_length":len(p),"mesh_count":len(doc["meshes"]),"mesh_names":[m["name"] for m in doc["meshes"]],"node_names":[x["name"] for x in doc["nodes"]],"metadata":doc.get("extras",{}),"bbox_m":{"min":mins,"max":maxs,"size":[maxs[k]-mins[k] for k in range(3)]}}
