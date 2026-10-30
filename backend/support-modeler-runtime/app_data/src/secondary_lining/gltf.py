"""最小、无外部依赖的二进制 glTF 2.0 写出器。"""
from __future__ import annotations

import json
import struct
from pathlib import Path
from typing import Any


def _pad(data: bytes, fill: bytes) -> bytes:
    return data + fill * ((4 - len(data) % 4) % 4)


def write_glb(mesh: dict[str, Any], path: Path) -> dict[str, Any]:
    positions = b"".join(struct.pack("<3f", *vertex) for vertex in mesh["vertices"])
    indices = b"".join(struct.pack("<I", index) for index in mesh["indices"])
    binary = _pad(positions, b"\x00") + _pad(indices, b"\x00")
    document = {
        "asset": {"version": "2.0", "generator": "SupportParameterExtractor secondary_lining"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "secondaryLiningMesh"}],
        "meshes": [{"name": "secondaryLiningMesh", "primitives": [{"attributes": {"POSITION": 0}, "indices": 1, "material": 0}]}],
        "materials": [{"name": "C35 reinforced concrete", "pbrMetallicRoughness": {"baseColorFactor": [0.45, 0.55, 0.65, 1], "metallicFactor": 0, "roughnessFactor": 0.8}, "doubleSided": True}],
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": len(positions), "target": 34962},
            {"buffer": 0, "byteOffset": len(_pad(positions, b"\x00")), "byteLength": len(indices), "target": 34963},
        ],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": len(mesh["vertices"]), "type": "VEC3", "min": mesh["bbox_m"]["min"], "max": mesh["bbox_m"]["max"]},
            {"bufferView": 1, "componentType": 5125, "count": len(mesh["indices"]), "type": "SCALAR", "min": [min(mesh["indices"])], "max": [max(mesh["indices"])]},
        ],
        "extras": {"profile_source": "sectionGeometryState.inner_profile", "thickness_mm": 500, "has_invert": True},
    }
    json_chunk = _pad(json.dumps(document, separators=(",", ":"), ensure_ascii=False).encode("utf-8"), b" ")
    body = struct.pack("<I4s", len(json_chunk), b"JSON") + json_chunk + struct.pack("<I4s", len(binary), b"BIN\x00") + binary
    payload = struct.pack("<4sII", b"glTF", 2, 12 + len(body)) + body
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)
    return {"path": str(path), "byte_length": len(payload), "mesh_count": 1, "vertex_count": len(mesh["vertices"]), "triangle_count": len(mesh["indices"]) // 3, "bbox_m": mesh["bbox_m"], "exporter": "GLTF_2_BINARY_WRITER"}


def inspect_glb(path: Path) -> dict[str, Any]:
    payload = path.read_bytes()
    magic, version, total = struct.unpack_from("<4sII", payload, 0)
    if magic != b"glTF" or version != 2 or total != len(payload):
        raise ValueError("无效GLB文件")
    json_len, json_type = struct.unpack_from("<I4s", payload, 12)
    if json_type != b"JSON":
        raise ValueError("GLB缺少JSON块")
    document = json.loads(payload[20:20 + json_len].decode("utf-8").rstrip(" \x00"))
    primitive = document["meshes"][0]["primitives"][0]
    position_accessor = document["accessors"][primitive["attributes"]["POSITION"]]
    vertex_count = position_accessor["count"]
    bbox = {"min": position_accessor["min"], "max": position_accessor["max"]}
    bbox["size"] = [bbox["max"][i] - bbox["min"][i] for i in range(3)]
    index_accessor = document["accessors"][primitive["indices"]] if "indices" in primitive else None
    triangle_count = index_accessor["count"] // 3 if index_accessor else vertex_count // 3 if primitive.get("mode", 4) == 4 else None
    return {"byte_length": len(payload), "mesh_count": len(document.get("meshes", [])), "vertex_count": vertex_count, "triangle_count": triangle_count, "bbox_m": bbox, "generator": document.get("asset", {}).get("generator")}
