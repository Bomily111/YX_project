"""系统锚杆独立模型与统一总装GLB写出器。"""
from __future__ import annotations

import json
import struct
from pathlib import Path
from typing import Any


def _pad(data: bytes, fill: bytes) -> bytes:
    return data + fill * ((4 - len(data) % 4) % 4)


def _color(name: str) -> list[float]:
    if name.startswith("SystemAnchorMesh_"):
        return [0.93, 0.57, 0.20, 1.0]
    return {
        "primarySupportConcreteArchWallMesh": [0.76, 0.68, 0.49, 0.35],
        "primaryMeshCircumferentialBarsMesh": [0.18, 0.72, 0.52, 1.0],
        "primaryMeshLongitudinalBarsMesh": [0.16, 0.55, 0.82, 1.0],
        "steelArchMesh": [0.25, 0.29, 0.34, 1.0],
        "secondaryLiningMesh": [0.55, 0.62, 0.70, 0.30],
        "N1Mesh": [0.50, 0.22, 0.12, 1.0], "N2Mesh": [0.18, 0.34, 0.48, 1.0],
        "N3Mesh": [0.62, 0.66, 0.70, 1.0], "N4Mesh": [0.72, 0.58, 0.22, 1.0],
    }[name]


def _write(meshes: dict[str, dict[str, Any]], nodes: list[dict[str, Any]], extras: dict[str, Any], path: Path) -> dict[str, Any]:
    binary = b""; views = []; accessors = []; gltf_meshes = []; materials = []
    for i, (name, mesh) in enumerate(meshes.items()):
        positions = b"".join(struct.pack("<3f", *v) for v in mesh["vertices"])
        indices = b"".join(struct.pack("<I", x) for x in mesh["indices"])
        po = len(binary); binary += _pad(positions, b"\0"); io = len(binary); binary += _pad(indices, b"\0")
        views += [{"buffer": 0, "byteOffset": po, "byteLength": len(positions), "target": 34962}, {"buffer": 0, "byteOffset": io, "byteLength": len(indices), "target": 34963}]
        ai = len(accessors)
        accessors += [
            {"bufferView": 2 * i, "componentType": 5126, "count": len(mesh["vertices"]), "type": "VEC3", "min": mesh["bbox_m"]["min"], "max": mesh["bbox_m"]["max"]},
            {"bufferView": 2 * i + 1, "componentType": 5125, "count": len(mesh["indices"]), "type": "SCALAR", "min": [min(mesh["indices"])], "max": [max(mesh["indices"])]},
        ]
        gltf_meshes.append({"name": name, "primitives": [{"attributes": {"POSITION": ai}, "indices": ai + 1, "material": i}]})
        color = _color(name); transparent = color[3] < 1.0
        materials.append({"name": name + "Material", "pbrMetallicRoughness": {"baseColorFactor": color, "metallicFactor": 0.55 if "Anchor" in name or "Bars" in name or name == "steelArchMesh" else 0.0, "roughnessFactor": 0.42}, "alphaMode": "BLEND" if transparent else "OPAQUE", "doubleSided": transparent})
    document = {"asset": {"version": "2.0", "generator": "SupportParameterExtractor system_anchor"}, "scene": 0, "scenes": [{"name": nodes[0]["name"], "nodes": [0]}], "nodes": nodes, "meshes": gltf_meshes, "materials": materials, "buffers": [{"byteLength": len(binary)}], "bufferViews": views, "accessors": accessors, "extras": extras}
    jc = _pad(json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), b" ")
    body = struct.pack("<I4s", len(jc), b"JSON") + jc + struct.pack("<I4s", len(binary), b"BIN\0") + binary
    payload = struct.pack("<4sII", b"glTF", 2, 12 + len(body)) + body
    path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(payload)
    return inspect_glb(path)


def write_system_anchor_glb(anchor_meshes: dict[str, dict[str, Any]], metadata: dict[str, Any], path: Path) -> dict[str, Any]:
    nodes = [{"name": "SystemAnchorGroup", "children": list(range(1, len(anchor_meshes) + 1))}]
    nodes.extend({"name": name, "mesh": i} for i, name in enumerate(anchor_meshes))
    return _write(anchor_meshes, nodes, metadata, path)


def write_assembly_glb(base_meshes: dict[str, dict[str, Any]], anchor_meshes: dict[str, dict[str, Any]], metadata: dict[str, Any], path: Path) -> dict[str, Any]:
    meshes = {**base_meshes, **anchor_meshes}
    names = list(meshes)
    mi = {name: i for i, name in enumerate(names)}
    nodes: list[dict[str, Any]] = []
    def add(name: str, children=None, mesh=None) -> int:
        node = {"name": name}
        if children is not None: node["children"] = children
        if mesh is not None: node["mesh"] = mesh
        nodes.append(node); return len(nodes) - 1
    root = add("ZZVaSectionAssemblyGroup", [])
    primary = add("primarySupportGroup", []); secondary = add("secondarySystemGroup", [])
    nodes[root]["children"] = [primary, secondary]
    concrete_group = add("primarySupportConcreteGroup", []); concrete_mesh = add("primarySupportConcreteArchWallMesh", mesh=mi["primarySupportConcreteArchWallMesh"]); nodes[concrete_group]["children"] = [concrete_mesh]
    mesh_group = add("primarySupportMeshGroup", []); c = add("primaryMeshCircumferentialBarsMesh", mesh=mi["primaryMeshCircumferentialBarsMesh"]); l = add("primaryMeshLongitudinalBarsMesh", mesh=mi["primaryMeshLongitudinalBarsMesh"]); nodes[mesh_group]["children"] = [c, l]
    steel_group = add("steelArchGroup", []); steel_mesh = add("steelArchMesh", mesh=mi["steelArchMesh"]); nodes[steel_group]["children"] = [steel_mesh]
    anchor_group = add("systemAnchorGroup", []); anchor_nodes = [add(name, mesh=mi[name]) for name in anchor_meshes]; nodes[anchor_group]["children"] = anchor_nodes
    nodes[primary]["children"] = [concrete_group, mesh_group, steel_group, anchor_group]
    lining_group = add("secondaryLiningGroup", []); lining_mesh = add("secondaryLiningMesh", mesh=mi["secondaryLiningMesh"]); nodes[lining_group]["children"] = [lining_mesh]
    rebar_group = add("secondaryRebarGroup", [])
    rebar_children = []
    for name in ("N1Mesh", "N2Mesh", "N3Mesh", "N4Mesh"):
        group = add(name.replace("Mesh", "Group"), []); mesh_node = add(name, mesh=mi[name]); nodes[group]["children"] = [mesh_node]; rebar_children.append(group)
    nodes[rebar_group]["children"] = rebar_children; nodes[secondary]["children"] = [lining_group, rebar_group]
    return _write(meshes, nodes, metadata, path)


def inspect_glb(path: Path) -> dict[str, Any]:
    payload = Path(path).read_bytes(); magic, version, total = struct.unpack_from("<4sII", payload, 0)
    if (magic, version, total) != (b"glTF", 2, len(payload)): raise ValueError("无效GLB")
    n, kind = struct.unpack_from("<I4s", payload, 12); document = json.loads(payload[20:20 + n].decode("utf-8").rstrip(" \0"))
    vectors = [a for a in document["accessors"] if a["type"] == "VEC3"]
    mins = [min(a["min"][k] for a in vectors) for k in range(3)]; maxs = [max(a["max"][k] for a in vectors) for k in range(3)]
    return {"path": str(path), "byte_length": len(payload), "mesh_count": len(document["meshes"]), "mesh_names": [m["name"] for m in document["meshes"]], "node_names": [n["name"] for n in document["nodes"]], "metadata": document["extras"], "bbox_m": {"min": mins, "max": maxs, "size": [maxs[k] - mins[k] for k in range(3)]}}
