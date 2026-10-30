"""初支部分模型及统一总装的最小 glTF 2.0 二进制写出器。"""
from __future__ import annotations

import json
import struct
from pathlib import Path
from typing import Any

COLORS = {
    "primarySupportConcreteTopSideMesh": [0.76, 0.68, 0.49, 0.72],
    "steelArchMesh": [0.25, 0.29, 0.34, 1.0],
    "secondaryLiningMesh": [0.55, 0.62, 0.70, 0.48],
    "N1Mesh": [0.50, 0.22, 0.12, 1.0],
    "N2Mesh": [0.18, 0.34, 0.48, 1.0],
    "N3Mesh": [0.62, 0.66, 0.70, 1.0],
    "N4Mesh": [0.72, 0.58, 0.22, 1.0],
}


def _pad(data: bytes, fill: bytes) -> bytes:
    return data + fill * ((4 - len(data) % 4) % 4)


def _write(meshes: dict[str, dict[str, Any]], nodes: list[dict[str, Any]], extras: dict[str, Any], path: Path) -> dict[str, Any]:
    binary = b""
    views: list[dict[str, Any]] = []
    accessors: list[dict[str, Any]] = []
    gltf_meshes: list[dict[str, Any]] = []
    materials: list[dict[str, Any]] = []
    for i, (name, mesh) in enumerate(meshes.items()):
        positions = b"".join(struct.pack("<3f", *v) for v in mesh["vertices"])
        indices = b"".join(struct.pack("<I", x) for x in mesh["indices"])
        po = len(binary)
        binary += _pad(positions, b"\0")
        io = len(binary)
        binary += _pad(indices, b"\0")
        views += [
            {"buffer": 0, "byteOffset": po, "byteLength": len(positions), "target": 34962},
            {"buffer": 0, "byteOffset": io, "byteLength": len(indices), "target": 34963},
        ]
        ai = len(accessors)
        accessors += [
            {"bufferView": 2 * i, "componentType": 5126, "count": len(mesh["vertices"]), "type": "VEC3", "min": mesh["bbox_m"]["min"], "max": mesh["bbox_m"]["max"]},
            {"bufferView": 2 * i + 1, "componentType": 5125, "count": len(mesh["indices"]), "type": "SCALAR", "min": [min(mesh["indices"])], "max": [max(mesh["indices"])]},
        ]
        gltf_meshes.append({"name": name, "primitives": [{"attributes": {"POSITION": ai}, "indices": ai + 1, "material": i}]})
        color = COLORS[name]
        transparent = color[3] < 1
        materials.append({
            "name": name.replace("Mesh", " material"),
            "pbrMetallicRoughness": {"baseColorFactor": color, "metallicFactor": 0.65 if name == "steelArchMesh" else 0.0, "roughnessFactor": 0.38 if name == "steelArchMesh" else 0.82},
            "alphaMode": "BLEND" if transparent else "OPAQUE",
            "doubleSided": transparent,
        })
    document = {
        "asset": {"version": "2.0", "generator": "SupportParameterExtractor primary_support"},
        "scene": 0,
        "scenes": [{"name": nodes[0]["name"], "nodes": [0]}],
        "nodes": nodes,
        "meshes": gltf_meshes,
        "materials": materials,
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": views,
        "accessors": accessors,
        "extras": extras,
    }
    jc = _pad(json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), b" ")
    body = struct.pack("<I4s", len(jc), b"JSON") + jc + struct.pack("<I4s", len(binary), b"BIN\0") + binary
    payload = struct.pack("<4sII", b"glTF", 2, 12 + len(body)) + body
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)
    return inspect_glb(path)


def write_primary_glb(mesh: dict[str, Any], path: Path) -> dict[str, Any]:
    return _write(
        {"primarySupportConcreteTopSideMesh": mesh},
        [{"name": "primarySupportConcreteGroup", "children": [1]}, {"name": "primarySupportConcreteTopSideMesh", "mesh": 0}],
        {"support_type": "ZZ-Va", "primary_support_scope": "ARCH_AND_WALL_ONLY", "invert": "NOT_APPLICABLE", "unresolved": None, "status": "PRIMARY_SUPPORT_CONCRETE_IMPLEMENTED"},
        path,
    )


def write_assembly_glb(meshes: dict[str, dict[str, Any]], path: Path) -> dict[str, Any]:
    nodes = [
        {"name": "ZZVaSectionAssemblyGroup", "children": [1, 5]},
        {"name": "primarySupportGroup", "children": [2, 4]},
        {"name": "primarySupportConcreteGroup", "children": [3]},
        {"name": "primarySupportConcreteTopSideMesh", "mesh": 0},
        {"name": "steelArchGroup", "children": [10]},
        {"name": "secondarySystemGroup", "children": [6, 8]},
        {"name": "secondaryLiningGroup", "children": [7]},
        {"name": "secondaryLiningMesh", "mesh": 2},
        {"name": "secondaryRebarGroup", "children": [11, 13, 15, 17]},
        {"name": "assemblyMetadata"},
        {"name": "steelArchMesh", "mesh": 1},
        {"name": "N1Group", "children": [12]}, {"name": "N1Mesh", "mesh": 3},
        {"name": "N2Group", "children": [14]}, {"name": "N2Mesh", "mesh": 4},
        {"name": "N3Group", "children": [16]}, {"name": "N3Mesh", "mesh": 5},
        {"name": "N4Group", "children": [18]}, {"name": "N4Mesh", "mesh": 6},
    ]
    extras = {
        "support_type": "ZZ-Va",
        "assembly_scope": "IMPLEMENTED_COMPONENTS_WITH_PRIMARY_SUPPORT",
        "primary_support_scope": "ARCH_AND_WALL_ONLY",
        "primary_support_status": "PRIMARY_SUPPORT_CONCRETE_IMPLEMENTED",
        "invert": "NOT_APPLICABLE",
        "unresolved": None,
        "contains": ["primary_support_concrete_top_side", "steel_arch", "secondary_lining", "N1", "N2", "N3", "N4"],
        "missing": ["primary_support_invert", "primary_support_rebar_mesh", "anchors", "advance_support"],
        "coordinate_system": "x_right_y_up_z_forward_m",
    }
    return _write(meshes, nodes, extras, path)


def inspect_glb(path: Path) -> dict[str, Any]:
    payload = Path(path).read_bytes()
    magic, version, total = struct.unpack_from("<4sII", payload, 0)
    if (magic, version, total) != (b"glTF", 2, len(payload)):
        raise ValueError("无效 GLB")
    json_len, json_type = struct.unpack_from("<I4s", payload, 12)
    if json_type != b"JSON":
        raise ValueError("GLB 缺少 JSON 块")
    doc = json.loads(payload[20:20 + json_len].decode("utf-8").rstrip(" \0"))
    positions = [a for a in doc["accessors"] if a["type"] == "VEC3"]
    mins = [min(a["min"][k] for a in positions) for k in range(3)]
    maxs = [max(a["max"][k] for a in positions) for k in range(3)]
    return {
        "path": str(path), "byte_length": len(payload), "mesh_count": len(doc["meshes"]),
        "mesh_names": [m["name"] for m in doc["meshes"]], "node_names": [n["name"] for n in doc["nodes"]],
        "metadata": doc.get("extras", {}), "bbox_m": {"min": mins, "max": maxs, "size": [maxs[k] - mins[k] for k in range(3)]},
    }
