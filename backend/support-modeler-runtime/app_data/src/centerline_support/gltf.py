"""读取既有GLB网格，并用共享网格+节点矩阵写出长距离轻量GLB。"""
from __future__ import annotations

import json
import math
from pathlib import Path
import struct
from typing import Any


def _pad(data: bytes, fill: bytes) -> bytes:
    return data + fill * ((4 - len(data) % 4) % 4)


def read_glb_meshes(path: Path) -> dict[str, dict[str, Any]]:
    payload = Path(path).read_bytes()
    magic, version, total = struct.unpack_from("<4sII", payload, 0)
    if (magic, version, total) != (b"glTF", 2, len(payload)):
        raise ValueError(f"无效GLB：{path}")
    json_length, json_kind = struct.unpack_from("<I4s", payload, 12)
    if json_kind != b"JSON":
        raise ValueError("GLB缺少JSON块。")
    document = json.loads(payload[20:20 + json_length].decode("utf-8").rstrip(" \0"))
    binary_header = 20 + json_length
    bin_length, bin_kind = struct.unpack_from("<I4s", payload, binary_header)
    if bin_kind != b"BIN\0":
        raise ValueError("GLB缺少BIN块。")
    binary = payload[binary_header + 8:binary_header + 8 + bin_length]

    def values(accessor_index: int) -> list[Any]:
        accessor = document["accessors"][accessor_index]
        view = document["bufferViews"][accessor["bufferView"]]
        offset = int(view.get("byteOffset", 0)) + int(accessor.get("byteOffset", 0))
        component = accessor["componentType"]
        kind = accessor["type"]
        formats = {(5126, "VEC3"): ("<3f", 12), (5125, "SCALAR"): ("<I", 4), (5123, "SCALAR"): ("<H", 2)}
        if (component, kind) not in formats:
            raise ValueError(f"暂不支持的accessor：{component}/{kind}")
        fmt, width = formats[(component, kind)]
        stride = int(view.get("byteStride", width))
        result = []
        for index in range(int(accessor["count"])):
            value = struct.unpack_from(fmt, binary, offset + index * stride)
            result.append(value if kind == "VEC3" else value[0])
        return result

    result = {}
    for mesh in document["meshes"]:
        primitive = mesh["primitives"][0]
        vertices = values(primitive["attributes"]["POSITION"])
        indices = values(primitive["indices"])
        result[mesh["name"]] = {"vertices": vertices, "indices": indices}
    return result


def _bbox(vertices: list[tuple[float, float, float]]) -> tuple[list[float], list[float]]:
    return ([min(v[k] for v in vertices) for k in range(3)], [max(v[k] for v in vertices) for k in range(3)])


def _quaternion(matrix: list[float]) -> tuple[float, float, float, float]:
    """从glTF列主序刚体矩阵提取归一化四元数。"""
    m00, m01, m02 = matrix[0], matrix[4], matrix[8]
    m10, m11, m12 = matrix[1], matrix[5], matrix[9]
    m20, m21, m22 = matrix[2], matrix[6], matrix[10]
    trace = m00 + m11 + m22
    if trace > 0:
        s = math.sqrt(trace + 1.0) * 2
        w, x, y, z = .25 * s, (m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s
    elif m00 > m11 and m00 > m22:
        s = math.sqrt(1.0 + m00 - m11 - m22) * 2
        w, x, y, z = (m21 - m12) / s, .25 * s, (m01 + m10) / s, (m02 + m20) / s
    elif m11 > m22:
        s = math.sqrt(1.0 + m11 - m00 - m22) * 2
        w, x, y, z = (m02 - m20) / s, (m01 + m10) / s, .25 * s, (m12 + m21) / s
    else:
        s = math.sqrt(1.0 + m22 - m00 - m11) * 2
        w, x, y, z = (m10 - m01) / s, (m02 + m20) / s, (m12 + m21) / s, .25 * s
    length = math.sqrt(x * x + y * y + z * z + w * w)
    return x / length, y / length, z / length, w / length


def write_instanced_glb(
    meshes: dict[str, dict[str, Any]],
    mesh_support_type: dict[str, str],
    nodes: list[dict[str, Any]],
    scene_roots: list[int],
    metadata: dict[str, Any],
    path: Path,
) -> dict[str, Any]:
    colors = {
        "ZZ-II": [0.50, 0.75, 0.92, 0.76],
        "ZZ-III": [0.25, 0.82, 0.68, 0.76],
        "ZZ-IVa": [0.18, 0.72, 0.92, 0.74],
        "ZZ-IVb": [0.31, 0.52, 0.96, 0.74],
        "ZZ-IVc": [0.40, 0.38, 0.91, 0.76],
        "ZZ-Va": [0.96, 0.46, 0.22, 0.74],
        "ZZ-S": [0.72, 0.34, 0.91, 0.74],
        "ZZ-IIIx": [0.20, 0.66, 0.52, 0.76],
        "ZZ-IVx": [0.28, 0.55, 0.82, 0.76],
        "ZZ-IVsx": [0.37, 0.47, 0.84, 0.76],
        "ZZ-Vsx": [0.91, 0.56, 0.20, 0.76],
        "ZZ-QJsx": [0.90, 0.32, 0.28, 0.76],
        "ZZ-Y1": [0.66, 0.72, 0.25, 0.76],
    }
    binary = b""; views = []; accessors = []; gltf_meshes = []
    material_names = list(dict.fromkeys(mesh_support_type.values()))
    material_index = {name: index for index, name in enumerate(material_names)}
    materials = []
    for support_type in material_names:
        color = colors.get(support_type, [0.62, 0.68, 0.74, 0.76])
        materials.append({
            "name": support_type + "Material",
            "pbrMetallicRoughness": {"baseColorFactor": color, "metallicFactor": 0.1, "roughnessFactor": 0.62},
            "alphaMode": "BLEND", "doubleSided": True,
        })
    for mesh_number, (name, mesh) in enumerate(meshes.items()):
        vertices = mesh["vertices"]; indices = mesh["indices"]
        positions = b"".join(struct.pack("<3f", *vertex) for vertex in vertices)
        index_data = b"".join(struct.pack("<I", index) for index in indices)
        pos_offset = len(binary); binary += _pad(positions, b"\0")
        idx_offset = len(binary); binary += _pad(index_data, b"\0")
        views.extend([
            {"buffer": 0, "byteOffset": pos_offset, "byteLength": len(positions), "target": 34962},
            {"buffer": 0, "byteOffset": idx_offset, "byteLength": len(index_data), "target": 34963},
        ])
        minimum, maximum = _bbox(vertices)
        accessor_base = len(accessors)
        accessors.extend([
            {"bufferView": 2 * mesh_number, "componentType": 5126, "count": len(vertices), "type": "VEC3", "min": minimum, "max": maximum},
            {"bufferView": 2 * mesh_number + 1, "componentType": 5125, "count": len(indices), "type": "SCALAR", "min": [min(indices)], "max": [max(indices)]},
        ])
        gltf_meshes.append({
            "name": name,
            "primitives": [{"attributes": {"POSITION": accessor_base}, "indices": accessor_base + 1, "material": material_index[mesh_support_type[name]]}],
        })
    # 把每个区段内相同mesh的独立节点压成EXT_mesh_gpu_instancing批次。
    # 几何、里程和工程构件数量保持不变，浏览器无需创建数千个Mesh对象。
    optimized_nodes: list[dict[str, Any]] = [{"name": nodes[scene_roots[0]].get("name", "TunnelSupportAlongCenterLine"), "children": []}]

    def instance_accessor(raw: bytes, count: int, kind: str) -> int:
        nonlocal binary
        offset = len(binary)
        binary += _pad(raw, b"\0")
        view_index = len(views)
        views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(raw)})
        accessor_index = len(accessors)
        accessors.append({"bufferView": view_index, "componentType": 5126, "count": count, "type": kind})
        return accessor_index

    root = nodes[scene_roots[0]]
    for old_segment_index in root.get("children", []):
        old_segment = nodes[old_segment_index]
        segment_node = {key: value for key, value in old_segment.items() if key != "children"}
        segment_node["children"] = []
        new_segment_index = len(optimized_nodes)
        optimized_nodes.append(segment_node)
        optimized_nodes[0]["children"].append(new_segment_index)
        batches: dict[int, list[dict[str, Any]]] = {}
        for old_child_index in old_segment.get("children", []):
            child = nodes[old_child_index]
            batches.setdefault(int(child["mesh"]), []).append(child)
        for mesh_index, instances in batches.items():
            translations = b"".join(struct.pack("<3f", *item["matrix"][12:15]) for item in instances)
            rotations = b"".join(struct.pack("<4f", *_quaternion(item["matrix"])) for item in instances)
            translation_accessor = instance_accessor(translations, len(instances), "VEC3")
            rotation_accessor = instance_accessor(rotations, len(instances), "VEC4")
            batch_node = {
                "name": f"{old_segment['name']}__mesh_{mesh_index:02d}_instances",
                "mesh": mesh_index,
                "extensions": {"EXT_mesh_gpu_instancing": {"attributes": {"TRANSLATION": translation_accessor, "ROTATION": rotation_accessor}}},
                "extras": {
                    "support_type": old_segment.get("extras", {}).get("support_type"),
                    "component": instances[0].get("extras", {}).get("component"),
                    "instance_count": len(instances),
                },
            }
            optimized_nodes.append(batch_node)
            optimized_nodes[new_segment_index]["children"].append(len(optimized_nodes) - 1)

    document = {
        "asset": {"version": "2.0", "generator": "SupportParameterExtractor centerline support"},
        "scene": 0,
        "scenes": [{"name": "TunnelSupportAlongCenterLine", "nodes": scene_roots}],
        "nodes": optimized_nodes,
        "meshes": gltf_meshes,
        "materials": materials,
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": views,
        "accessors": accessors,
        "extensionsUsed": ["EXT_mesh_gpu_instancing"],
        "extras": metadata,
    }
    json_chunk = _pad(json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), b" ")
    body = struct.pack("<I4s", len(json_chunk), b"JSON") + json_chunk + struct.pack("<I4s", len(binary), b"BIN\0") + binary
    payload = struct.pack("<4sII", b"glTF", 2, 12 + len(body)) + body
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)
    return inspect_glb(path)


def inspect_glb(path: Path) -> dict[str, Any]:
    payload = Path(path).read_bytes()
    magic, version, total = struct.unpack_from("<4sII", payload, 0)
    if (magic, version, total) != (b"glTF", 2, len(payload)):
        raise ValueError("无效GLB。")
    length = struct.unpack_from("<I", payload, 12)[0]
    document = json.loads(payload[20:20 + length].decode("utf-8").rstrip(" \0"))
    return {
        "path": str(path),
        "byte_length": len(payload),
        "mesh_definition_count": len(document["meshes"]),
        "node_count": len(document["nodes"]),
        "scene_root_count": len(document["scenes"][0]["nodes"]),
        "metadata": document.get("extras", {}),
    }
