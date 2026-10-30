"""把既有1 m装配按里程和真实纵向间距布置到CenterLine。"""
from __future__ import annotations

from collections import Counter
import json
from pathlib import Path
from typing import Any

import numpy as np

from .centerline import CenterLine
from .gltf import read_glb_meshes, write_instanced_glb
from .plan import SupportSegment, interval_positions


SOURCE_MODELS = {
    "ZZ-II": "outputs/centerline/glb模型/ZZ-II_support_1m.glb",
    "ZZ-III": "outputs/centerline/glb模型/ZZ-III_support_1m.glb",
    "ZZ-IVa": "outputs/multi_support/ZZ-IVa_support_1m.glb",
    "ZZ-IVb": "outputs/multi_support/ZZ-IVb_support_1m.glb",
    "ZZ-IVc": "outputs/centerline/glb模型/ZZ-IVc_support_1m.glb",
    "ZZ-Va": "outputs/master_demo/ZZ-Va_support_1m_current.glb",
    "ZZ-S": "outputs/multi_support/ZZ-S_support_1m.glb",
    "ZZ-IIIx": "outputs/centerline/glb模型/ZZ-IIIx_support_1m.glb",
    "ZZ-IVx": "outputs/centerline/glb模型/ZZ-IVx_support_1m.glb",
    "ZZ-IVsx": "outputs/centerline/glb模型/ZZ-IVsx_support_1m.glb",
    "ZZ-Vsx": "outputs/centerline/glb模型/ZZ-Vsx_support_1m.glb",
    "ZZ-QJsx": "outputs/centerline/glb模型/ZZ-QJsx_support_1m.glb",
    "ZZ-Y1": "outputs/centerline/glb模型/ZZ-Y1_support_1m.glb",
}

CONTINUOUS_MESHES = (
    "primarySupportConcrete",
    "primaryMeshCircumferentialBars",
    "primaryMeshLongitudinalBars",
    "secondaryLining",
    "N3",
    "N4",
)


def _number(value: Any) -> float | None:
    if isinstance(value, dict) and "value" in value:
        value = value["value"]
    return float(value) if isinstance(value, (int, float)) else None


DEFAULT_SECTION_REFERENCE = {
    "mode": "DESIGN_ELEVATION_POINT",
    "source_local_m": [0.0, 0.0, 0.0],
    "placement_offset_local_m": [0.0, 0.0, 0.0],
    "status": "UNCONFIGURED",
}


def _reference_vector(reference: dict[str, Any], key: str) -> np.ndarray:
    value = np.asarray(reference.get(key, [0.0, 0.0, 0.0]), dtype=float)
    if value.shape != (3,):
        raise ValueError(f"section_reference.{key} 必须是 [x,y,z] 三维坐标。")
    return value


def section_point_to_world(
    centerline: CenterLine,
    chainage: float,
    source_point: list[float] | tuple[float, float, float] | np.ndarray,
    section_reference: dict[str, Any] | None = None,
    *,
    source_z: float = 0.0,
) -> np.ndarray:
    """把源断面点转换到线路坐标。

    目标原点是该里程的centerLine设计高程点。断面局部x/y/z严格对应
    right/up/tangent；源模型中的设计高程点由``source_local_m``给出。
    """
    reference = {**DEFAULT_SECTION_REFERENCE, **(section_reference or {})}
    frame = centerline.frame_at(chainage)
    right = np.asarray(frame.right); up = np.asarray(frame.up); tangent = np.asarray(frame.tangent)
    basis = np.column_stack((right, up, tangent))
    source_reference = _reference_vector(reference, "source_local_m")
    source_reference[2] += source_z
    placement_offset = _reference_vector(reference, "placement_offset_local_m")
    point = np.asarray(source_point, dtype=float)
    if point.shape != (3,):
        raise ValueError("source_point必须是[x,y,z]三维坐标。")
    return np.asarray(frame.position) + basis @ placement_offset + basis @ (point - source_reference)


def _matrix(
    centerline: CenterLine,
    chainage: float,
    source_z: float = 0.0,
    section_reference: dict[str, Any] | None = None,
) -> list[float]:
    """把断面局部坐标映射到centerLine局部标架。

    centerLine点作为设计高程基准点；断面x/y/z分别映射到right/up/tangent。
    ``source_local_m`` 指定源断面中应落到该基准点的坐标，
    ``placement_offset_local_m`` 提供经项目确认后可调的定位偏移。
    """
    reference = {**DEFAULT_SECTION_REFERENCE, **(section_reference or {})}
    frame = centerline.frame_at(chainage)
    right = np.asarray(frame.right); up = np.asarray(frame.up); tangent = np.asarray(frame.tangent)
    translation = section_point_to_world(
        centerline, chainage, [0.0, 0.0, 0.0], reference, source_z=source_z
    )
    return [
        float(right[0]), float(right[1]), float(right[2]), 0.0,
        float(up[0]), float(up[1]), float(up[2]), 0.0,
        float(tangent[0]), float(tangent[1]), float(tangent[2]), 0.0,
        float(translation[0]), float(translation[1]), float(translation[2]), 1.0,
    ]


def _z_center(mesh: dict[str, Any]) -> float:
    values = [float(vertex[2]) for vertex in mesh["vertices"]]
    return (min(values) + max(values)) / 2.0


def _combine_meshes(meshes: list[dict[str, Any]]) -> dict[str, Any]:
    vertices: list[Any] = []
    indices: list[int] = []
    for mesh in meshes:
        offset = len(vertices)
        vertices.extend(mesh["vertices"])
        indices.extend(offset + int(index) for index in mesh["indices"])
    return {"vertices": vertices, "indices": indices}


def _unit_starts(segment: SupportSegment) -> list[float]:
    length = segment.length
    if abs(length - round(length)) > 1e-9:
        raise ValueError("V1测试段要求每个区间为整米，避免缩放工程断面。")
    return [segment.start_chainage + index for index in range(int(round(length)))]


def _spacing_rules(root: Path, payloads: dict[str, Any], support_type: str) -> dict[str, float | None]:
    resolved = payloads[support_type]["resolved_parameters"]
    steel = resolved.get("steel_arch") or {}
    anchor = resolved.get("system_anchor") or {}
    secondary = resolved.get("secondary_rebar") or {}
    steel_spacing = _number(steel.get("longitudinal_spacing_mm"))
    if steel_spacing is None and support_type == "ZZ-Va":
        metadata = json.loads((root / "outputs/master_demo/ZZ-Va_support_1m_current_metadata.json").read_text(encoding="utf-8"))
        steel_spacing = _number(metadata["confirmed_parameters"].get("steel_arch_spacing_mm"))
    anchor_spacing = _number(anchor.get("longitudinal_spacing_mm"))
    n4 = secondary.get("N4") or {}
    rebar_spacing = _number(n4.get("longitudinal_spacing_mm"))
    return {
        "steel_arch_m": None if steel_spacing is None else steel_spacing / 1000.0,
        "system_anchor_m": None if anchor_spacing is None else anchor_spacing / 1000.0,
        "secondary_ring_m": None if rebar_spacing is None else rebar_spacing / 1000.0,
    }


def validate_frames(centerline: CenterLine, start: float, end: float, step: float = 0.5) -> dict[str, Any]:
    stations = np.arange(start, end + 1e-9, step)
    frames = []
    previous = None
    for station in stations:
        frame = centerline.frame_at(float(station), previous)
        previous = np.asarray(frame.right)
        frames.append(frame)
    right_dots = [float(np.dot(frames[i - 1].right, frames[i].right)) for i in range(1, len(frames))]
    up_dots = [float(np.dot(frames[i - 1].up, frames[i].up)) for i in range(1, len(frames))]
    orthogonality = []
    for frame in frames:
        right, up, tangent = map(np.asarray, (frame.right, frame.up, frame.tangent))
        orthogonality.extend([abs(float(np.dot(right, up))), abs(float(np.dot(right, tangent))), abs(float(np.dot(up, tangent)))])
    return {
        "sample_count": len(frames),
        "minimum_consecutive_right_dot": min(right_dots),
        "minimum_consecutive_up_dot": min(up_dots),
        "maximum_axis_dot_error": max(orthogonality),
        "section_flip_detected": min(right_dots) <= 0 or min(up_dots) <= 0,
    }


def build_centerline_support(
    root: Path,
    centerline: CenterLine,
    segments: list[SupportSegment],
    output_path: Path,
    *,
    chainage_offset: float = 0.0,
    registry_snapshot: dict[str, Any] | None = None,
    source_models: dict[str, str] | None = None,
    status: str = "CENTERLINE_SUPPORT_IMPLEMENTED",
    metadata_extras: dict[str, Any] | None = None,
    section_reference: dict[str, Any] | None = None,
) -> dict[str, Any]:
    root = Path(root)
    if section_reference is None:
        reference_path = root / "config" / "centerline_section_reference.json"
        if reference_path.is_file():
            section_reference = json.loads(reference_path.read_text(encoding="utf-8"))
    source_models = source_models or SOURCE_MODELS
    registry_snapshot = registry_snapshot or {}
    payloads = json.loads((root / "outputs/master_demo/support_payloads_v1_2.json").read_text(encoding="utf-8"))
    requested_types = {x.support_type for x in segments}
    source_meshes = {
        support_type: read_glb_meshes(root / source_models[support_type])
        for support_type in requested_types
        if support_type in source_models and (root / source_models[support_type]).is_file()
    }
    imported_meshes: dict[str, dict[str, Any]] = {}
    mesh_support_type: dict[str, str] = {}
    mesh_indices: dict[tuple[str, str], int] = {}
    nodes: list[dict[str, Any]] = [{"name": "TunnelSupportAlongCenterLine", "children": []}]
    component_counts: Counter[str] = Counter()
    support_counts: Counter[str] = Counter()
    segment_records = []
    resolved_section_reference = {**DEFAULT_SECTION_REFERENCE, **(section_reference or {})}
    _reference_vector(resolved_section_reference, "source_local_m")
    _reference_vector(resolved_section_reference, "placement_offset_local_m")

    def ensure_mesh(support_type: str, source_name: str) -> int:
        key = (support_type, source_name)
        if key in mesh_indices:
            return mesh_indices[key]
        output_name = f"{support_type}__{source_name}"
        mesh_indices[key] = len(imported_meshes)
        imported_meshes[output_name] = source_meshes[support_type][source_name]
        mesh_support_type[output_name] = support_type
        return mesh_indices[key]

    def add_instance(segment_node: int, support_type: str, source_name: str, category: str, chainage: float, source_z: float, quantity: int = 1) -> None:
        mesh_index = ensure_mesh(support_type, source_name)
        node = {
            "name": f"{support_type}_{category}_K{chainage + chainage_offset:07.3f}",
            "mesh": mesh_index,
            "matrix": _matrix(centerline, chainage, source_z, resolved_section_reference),
            "extras": {
                "support_type": support_type,
                "component": category,
                "chainage": round(chainage + chainage_offset, 6),
                "centerline_distance": round(chainage, 6),
            },
        }
        nodes.append(node)
        nodes[segment_node]["children"].append(len(nodes) - 1)
        component_counts[category] += quantity
        support_counts[support_type] += quantity

    for segment_index, segment in enumerate(segments):
        support_type = segment.support_type
        source = source_meshes.get(support_type)
        registry_entry = registry_snapshot.get(support_type)
        component_status = registry_entry.get("components", []) if registry_entry else []
        has_model = source is not None
        if not has_model:
            model_status = "MODEL_INCOMPLETE"
        elif any(item.get("status") in {"PARTIAL", "NOT_IMPLEMENTED"} for item in component_status):
            model_status = "PARTIAL"
        else:
            model_status = "READY"
        spacing = _spacing_rules(root, payloads, support_type) if has_model else {
            "steel_arch_m": None,
            "system_anchor_m": None,
            "secondary_ring_m": None,
        }
        absolute_start = segment.start_chainage + chainage_offset
        absolute_end = segment.end_chainage + chainage_offset
        segment_node = len(nodes)
        nodes.append({
            "name": f"segment_{segment_index + 1:02d}_{support_type}_{absolute_start:g}_{absolute_end:g}",
            "children": [],
            "extras": {
                "kind": "SupportSegment",
                "support_type": support_type,
                "start_chainage": absolute_start,
                "end_chainage": absolute_end,
                "centerline_start_distance": segment.start_chainage,
                "centerline_end_distance": segment.end_chainage,
                "boundary_rule": "START_INCLUSIVE_END_EXCLUSIVE",
                "model_status": model_status,
            },
        })
        nodes[0]["children"].append(segment_node)
        counts_before = Counter(component_counts)

        if not has_model:
            segment_records.append({
                "segment_index": segment_index + 1,
                "start_chainage": absolute_start,
                "end_chainage": absolute_end,
                "centerline_start_distance_m": segment.start_chainage,
                "centerline_end_distance_m": segment.end_chainage,
                "support_type": support_type,
                "model_status": model_status,
                "implementation_status": registry_entry.get("implementation_status") if registry_entry else "NOT_REGISTERED",
                "component_status": component_status,
                "spacing_m": spacing,
                "mesh_instance_count": 0,
                "component_counts": {},
                "missing_reason": "SOURCE_MODEL_NOT_AVAILABLE" if registry_entry else "SUPPORT_TYPE_NOT_REGISTERED",
            })
            continue

        for station in _unit_starts(segment):
            for mesh_name in CONTINUOUS_MESHES:
                if mesh_name in source:
                    category = {
                        "primarySupportConcrete": "primary_concrete",
                        "primaryMeshCircumferentialBars": "primary_mesh",
                        "primaryMeshLongitudinalBars": "primary_mesh",
                        "secondaryLining": "secondary_lining",
                        "N3": "secondary_rebar_N3",
                        "N4": "secondary_rebar_N4",
                    }[mesh_name]
                    add_instance(segment_node, support_type, mesh_name, category, station, 0.0)

        steel_names = sorted(name for name in source if name.startswith("steelArch_"))
        if steel_names and spacing["steel_arch_m"]:
            template = steel_names[0]; template_z = _z_center(source[template])
            for station in interval_positions(segment.start_chainage, segment.end_chainage, float(spacing["steel_arch_m"])):
                add_instance(segment_node, support_type, template, "steel_arch", station, template_z)

        anchor_templates = sorted(name for name in source if name.startswith("SystemAnchorMesh_01_"))
        if anchor_templates and spacing["system_anchor_m"]:
            template_z = _z_center(source[anchor_templates[0]])
            combined_name = "SystemAnchorStationTemplate"
            source[combined_name] = _combine_meshes([source[name] for name in anchor_templates])
            for station in interval_positions(segment.start_chainage, segment.end_chainage, float(spacing["system_anchor_m"])):
                add_instance(segment_node, support_type, combined_name, "system_anchor", station, template_z, len(anchor_templates))

        lock_templates = sorted(name for name in source if name.startswith("lockFootAnchor_arch001_"))
        if lock_templates and spacing["steel_arch_m"] and steel_names:
            template_z = _z_center(source[steel_names[0]])
            combined_name = "LockFootStationTemplate"
            source[combined_name] = _combine_meshes([source[name] for name in lock_templates])
            for station in interval_positions(segment.start_chainage, segment.end_chainage, float(spacing["steel_arch_m"])):
                add_instance(segment_node, support_type, combined_name, "lock_foot_anchor", station, template_z, len(lock_templates))

        ring_spacing = spacing["secondary_ring_m"]
        if ring_spacing:
            for ring in ("N1", "N2"):
                if ring not in source:
                    continue
                template_z = _z_center(source[ring])
                # N1/N2主筋环位于250 mm布设单元中心，并与N4箍筋面一致。
                # 采用半间距相位后，1 m内恰为4道，区段终点不会重复。
                for station in interval_positions(
                    segment.start_chainage,
                    segment.end_chainage,
                    float(ring_spacing),
                    float(ring_spacing) / 2.0,
                ):
                    add_instance(segment_node, support_type, ring, f"secondary_rebar_{ring}", station, template_z)

        segment_records.append({
            "segment_index": segment_index + 1,
            "start_chainage": absolute_start,
            "end_chainage": absolute_end,
            "centerline_start_distance_m": segment.start_chainage,
            "centerline_end_distance_m": segment.end_chainage,
            "support_type": support_type,
            "model_status": model_status,
            "implementation_status": registry_entry.get("implementation_status") if registry_entry else "REGISTRY_STATUS_UNAVAILABLE",
            "component_status": component_status,
            "spacing_m": spacing,
            "mesh_instance_count": len(nodes[segment_node]["children"]),
            "component_counts": {
                key: component_counts[key] - counts_before[key]
                for key in component_counts
                if component_counts[key] - counts_before[key]
            },
        })

    transitions = [
        {
            "chainage": current.end_chainage + chainage_offset,
            "centerline_distance": current.end_chainage,
            "from": current.support_type,
            "to": following.support_type,
            "rule": "START_INCLUSIVE_END_EXCLUSIVE",
            "duplicate_station": False,
            "continuous_gap_m": 0.0,
            "boundary_station_owner": "FOLLOWING_SEGMENT",
        }
        for current, following in zip(segments, segments[1:])
    ]
    frame_validation = validate_frames(centerline, segments[0].start_chainage, segments[-1].end_chainage)
    reference_segment = next((item for item in segments if item.support_type == "ZZ-IVa"), segments[0])
    reference_station = reference_segment.start_chainage
    mapped_design_point = section_point_to_world(
        centerline,
        reference_station,
        resolved_section_reference["source_local_m"],
        resolved_section_reference,
    )
    target_design_point = centerline.position_at(reference_station)
    reference_error = float(np.linalg.norm(mapped_design_point - target_design_point))
    metadata = {
        "status": status,
        "centerline_source": centerline.source,
        "centerline_source_status": centerline.coordinate_system.get("source_status", "PROJECT_INPUT"),
        "coordinate_system": centerline.coordinate_system,
        "section_reference": resolved_section_reference,
        "section_transform": "local x/y/z -> centerLine right/up/tangent; source design-elevation point -> centerLine position",
        "section_reference_validation": {
            "support_type": reference_segment.support_type,
            "centerline_distance_m": reference_station,
            "engineering_chainage_m": reference_station + chainage_offset,
            "mapped_design_elevation_point": [float(x) for x in mapped_design_point],
            "centerline_position": [float(x) for x in target_design_point],
            "alignment_error_m": reference_error,
            "passed": reference_error <= 1e-9,
        },
        "start_chainage": segments[0].start_chainage + chainage_offset,
        "end_chainage": segments[-1].end_chainage + chainage_offset,
        "centerline_start_distance_m": segments[0].start_chainage,
        "centerline_end_distance_m": segments[-1].end_chainage,
        "chainage_offset_m": chainage_offset,
        "support_segments": segment_records,
        "segment_transition": transitions,
        "component_counts": dict(component_counts),
        "support_type_counts": dict(support_counts),
        "mesh_instance_count": sum(component_counts.values()),
        "mesh_definition_count": len(imported_meshes),
        "modeled_segment_count": sum(item["model_status"] != "MODEL_INCOMPLETE" for item in segment_records),
        "incomplete_segment_count": sum(item["model_status"] == "MODEL_INCOMPLETE" for item in segment_records),
        "boundary_rule": "START_INCLUSIVE_END_EXCLUSIVE",
        "frame_validation": frame_validation,
        "assembly_reuse": "EXISTING_1M_SUPPORT_ASSEMBLIES_ONLY",
    }
    if metadata_extras:
        metadata.update(metadata_extras)
    result = write_instanced_glb(imported_meshes, mesh_support_type, nodes, [0], metadata, output_path)
    state = {"glb": result, "metadata": metadata}
    metadata_path = output_path.with_suffix(".metadata.json")
    metadata_path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    return state
