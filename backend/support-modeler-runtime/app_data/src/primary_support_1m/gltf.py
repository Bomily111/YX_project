"""保持构件独立节点的1m初支与全断面GLB写出器。"""
from __future__ import annotations

import json
import struct
from pathlib import Path
from typing import Any


def _pad(data: bytes, fill: bytes) -> bytes:
    return data + fill * ((4 - len(data) % 4) % 4)


def _color(name: str) -> list[float]:
    if name.startswith("SystemAnchorMesh_"): return [0.93, 0.57, 0.20, 1.0]
    if name.startswith("lockFootAnchor_"): return [0.82, 0.26, 0.52, 1.0]
    if name.startswith("steelArch_"): return [0.25, 0.29, 0.34, 1.0]
    return {
        "primarySupportConcrete": [0.76, 0.68, 0.49, 0.34],
        "primaryMeshCircumferentialBars": [0.20, 0.82, 0.50, 1.0],
        "primaryMeshLongitudinalBars": [0.16, 0.65, 0.92, 1.0],
        "secondaryLining": [0.55, 0.62, 0.70, 0.27],
        "N1": [0.50, 0.22, 0.12, 1.0], "N2": [0.18, 0.34, 0.48, 1.0],
        "N3": [0.62, 0.66, 0.70, 1.0], "N4": [0.72, 0.58, 0.22, 1.0],
    }[name]


def write_glb(meshes: dict[str, dict[str, Any]], nodes: list[dict[str, Any]], metadata: dict[str, Any], path: Path) -> dict[str, Any]:
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
        materials.append({"name": name + "Material", "pbrMetallicRoughness": {"baseColorFactor": color, "metallicFactor": 0.58 if name.startswith("steelArch_") or "Bars" in name or "Anchor" in name else 0.0, "roughnessFactor": 0.42}, "alphaMode": "BLEND" if transparent else "OPAQUE", "doubleSided": transparent})
    document = {"asset": {"version": "2.0", "generator": "SupportParameterExtractor primary_support_1m"}, "scene": 0, "scenes": [{"name": nodes[0]["name"], "nodes": [0]}], "nodes": nodes, "meshes": gltf_meshes, "materials": materials, "buffers": [{"byteLength": len(binary)}], "bufferViews": views, "accessors": accessors, "extras": metadata}
    jc = _pad(json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), b" ")
    body = struct.pack("<I4s", len(jc), b"JSON") + jc + struct.pack("<I4s", len(binary), b"BIN\0") + binary
    payload = struct.pack("<4sII", b"glTF", 2, 12 + len(body)) + body
    path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(payload)
    return inspect_glb(path)


def build_nodes(mesh_names: list[str], include_secondary: bool) -> list[dict[str, Any]]:
    mi = {name: i for i, name in enumerate(mesh_names)}; nodes: list[dict[str, Any]] = []
    def add(name: str, children=None, mesh=None) -> int:
        node = {"name": name}
        if children is not None: node["children"] = children
        if mesh is not None: node["mesh"] = mesh
        nodes.append(node); return len(nodes) - 1
    root = add("ZZVaSectionAssemblyGroup" if include_secondary else "ZZVaPrimarySupport1mGroup", [])
    primary = add("primarySupportGroup", []) if include_secondary else root
    concrete_group = add("primarySupportConcreteGroup", []); concrete_node = add("primarySupportConcrete", mesh=mi["primarySupportConcrete"]); nodes[concrete_group]["children"] = [concrete_node]
    mesh_group = add("primarySupportMeshGroup", []); cm = add("primaryMeshCircumferentialBars", mesh=mi["primaryMeshCircumferentialBars"]); lm = add("primaryMeshLongitudinalBars", mesh=mi["primaryMeshLongitudinalBars"]); nodes[mesh_group]["children"] = [cm, lm]
    steel_group = add("steelArchArrayGroup", []); steel_nodes = [add(name, mesh=mi[name]) for name in ("steelArch_001", "steelArch_002")]; nodes[steel_group]["children"] = steel_nodes
    anchor_group = add("systemAnchorGroup", []); anchor_names = [n for n in mesh_names if n.startswith("SystemAnchorMesh_")]; anchor_nodes = [add(name, mesh=mi[name]) for name in anchor_names]; nodes[anchor_group]["children"] = anchor_nodes
    primary_children = [concrete_group, mesh_group, steel_group, anchor_group]
    lock_names = [n for n in mesh_names if n.startswith("lockFootAnchor_")]
    if lock_names:
        lock_group = add("lockFootAnchorGroup", [])
        arch_groups = []
        for arch in ("arch001", "arch002"):
            group = add(arch + "_lockFootGroup", [])
            items = [add(name, mesh=mi[name]) for name in lock_names if f"_{arch}_" in name]
            nodes[group]["children"] = items; arch_groups.append(group)
        nodes[lock_group]["children"] = arch_groups; primary_children.append(lock_group)
    nodes[primary]["children"] = primary_children
    if include_secondary:
        secondary = add("secondarySystemGroup", []); nodes[root]["children"] = [primary, secondary]
        lining_group = add("secondaryLiningGroup", []); lining = add("secondaryLining", mesh=mi["secondaryLining"]); nodes[lining_group]["children"] = [lining]
        rebar_group = add("secondaryRebarGroup", []); rebar_children = []
        for name in ("N1", "N2", "N3", "N4"):
            group = add(name + "Group", []); item = add(name, mesh=mi[name]); nodes[group]["children"] = [item]; rebar_children.append(group)
        nodes[rebar_group]["children"] = rebar_children; nodes[secondary]["children"] = [lining_group, rebar_group]
    return nodes


def inspect_glb(path: Path) -> dict[str, Any]:
    payload = Path(path).read_bytes(); magic, version, total = struct.unpack_from("<4sII", payload, 0)
    if (magic, version, total) != (b"glTF", 2, len(payload)): raise ValueError("无效GLB")
    n, kind = struct.unpack_from("<I4s", payload, 12); doc = json.loads(payload[20:20 + n].decode("utf-8").rstrip(" \0"))
    vectors = [a for a in doc["accessors"] if a["type"] == "VEC3"]
    mins = [min(a["min"][k] for a in vectors) for k in range(3)]; maxs = [max(a["max"][k] for a in vectors) for k in range(3)]
    return {"path": str(path), "byte_length": len(payload), "mesh_count": len(doc["meshes"]), "mesh_names": [m["name"] for m in doc["meshes"]], "node_names": [n["name"] for n in doc["nodes"]], "metadata": doc["extras"], "bbox_m": {"min": mins, "max": maxs, "size": [maxs[k] - mins[k] for k in range(3)]}}
