"""把第63页23段真实支护计划映射到真实centerLine进口端0~1064 m。"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess
from typing import Any

try:
    from src.centerline_support import build_centerline_support, load_centerline, load_segment_plan
    from src.centerline_support.assembly import SOURCE_MODELS
except ModuleNotFoundError:  # 兼容 ``python src/build_real_centerline_support.py``
    from centerline_support import build_centerline_support, load_centerline, load_segment_plan
    from centerline_support.assembly import SOURCE_MODELS


ROOT = Path(__file__).resolve().parents[1]
CENTERLINE_PATH = ROOT / "data" / "centerline" / "centerLine.json"
PLAN_PATH = ROOT / "outputs" / "centerline" / "real_support_segment_plan.json"
OUTPUT_PATH = ROOT / "outputs" / "centerline" / "real_YK1+098_YK2+162_support.glb"
CLIPPED_PATH = ROOT / "outputs" / "centerline" / "real_centerline_0_1064m.json"
SUMMARY_PATH = ROOT / "outputs" / "centerline" / "real_centerline_summary.json"
SECTION_REFERENCE_PATH = ROOT / "config" / "centerline_section_reference.json"
CHAINAGE_OFFSET_M = 1098.0
MODEL_END_DISTANCE_M = 1064.0
INCOMPLETE_TYPES = {"Z-PM", "TZ-III"}


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_registry_snapshot() -> dict[str, Any]:
    """从正式前端Registry导出状态，避免在真实线路脚本中复制状态定义。"""
    script = """
import {SupportTypeRegistry} from './demo/v1_2/support_type_registry.js';
const rows=[...SupportTypeRegistry].map(([key,value])=>[key,{
  implementation_status:value.implementation_status,
  components:value.components.map(item=>({id:item.id,status:item.status}))
}]);
process.stdout.write(JSON.stringify(Object.fromEntries(rows)));
"""
    result = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        capture_output=True,
        check=True,
    )
    return json.loads(result.stdout)


def write_clipped_centerline(centerline: Any) -> None:
    chainage = centerline.chainage
    if centerline.length < MODEL_END_DISTANCE_M:
        raise ValueError("真实centerLine不足1064 m。")
    keep = [index for index, value in enumerate(chainage) if value < MODEL_END_DISTANCE_M]
    points = [centerline.points[index].tolist() for index in keep]
    distances = [float(chainage[index]) for index in keep]
    points.append(centerline.position_at(MODEL_END_DISTANCE_M).tolist())
    distances.append(MODEL_END_DISTANCE_M)
    payload = {
        "schema": "CenterLine/RealMappedV1",
        "source": "data/centerline/centerLine.json",
        "source_sha256": _sha256(CENTERLINE_PATH),
        "coordinate_system": centerline.coordinate_system,
        "mapping": {
            "direction": "IMPORT_TO_EXPORT",
            "centerline_distance_0_chainage": "YK1+098.000",
            "chainage_offset_m": CHAINAGE_OFFSET_M,
            "modeled_start_chainage": "YK1+098.000",
            "modeled_end_chainage": "YK2+162.000",
            "support_plan_after_end": "SUPPORT_PLAN_NOT_PROVIDED",
        },
        "points": points,
        "chainage": distances,
    }
    CLIPPED_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def update_centerline_summary() -> None:
    summary = json.loads(SUMMARY_PATH.read_text(encoding="utf-8"))
    summary["chainage_direction_status"] = "CONFIRMED_IMPORT_TO_EXPORT"
    summary["chainage_direction_reason"] = "项目人员确认第一个点为右线进口，点序为进口到出口，支护方案同向。"
    summary["chainage_mapping"] = {
        "confirmation_source": "PROJECT_PERSONNEL",
        "centerline_distance_0_chainage": "YK1+098.000",
        "formula": "engineering_chainage_m = 1098.0 + centerline_cumulative_distance_m",
        "verified_model_end": {"centerline_distance_m": 1064.0, "engineering_chainage": "YK2+162.000"},
        "provided_support_plan_range": ["YK1+098.000", "YK2+162.000"],
        "after_range_status": "SUPPORT_PLAN_NOT_PROVIDED",
    }
    comparison = summary.setdefault("page_63_comparison", {})
    comparison["status"] = "PARTIAL_ALIGNMENT_COVERAGE_CONFIRMED"
    comparison["reason"] = "第63页1064 m支护计划对应整条centerLine进口端0~1064 m；其后支护方案未提供。"
    SUMMARY_PATH.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    centerline = load_centerline(CENTERLINE_PATH)
    registry = load_registry_snapshot()
    section_reference = json.loads(SECTION_REFERENCE_PATH.read_text(encoding="utf-8"))
    available_types = set(SOURCE_MODELS) | INCOMPLETE_TYPES
    segments = load_segment_plan(
        PLAN_PATH,
        available_types,
        MODEL_END_DISTANCE_M,
        chainage_offset=CHAINAGE_OFFSET_M,
    )
    if len(segments) != 23:
        raise ValueError(f"真实计划应为23段，当前为{len(segments)}段。")
    if abs(segments[0].start_chainage) > 1e-9 or abs(segments[-1].end_chainage - MODEL_END_DISTANCE_M) > 1e-9:
        raise ValueError("真实支护计划没有准确映射到centerLine 0~1064 m。")

    write_clipped_centerline(centerline)
    update_centerline_summary()
    state = build_centerline_support(
        ROOT,
        centerline,
        segments,
        OUTPUT_PATH,
        chainage_offset=CHAINAGE_OFFSET_M,
        registry_snapshot=registry,
        status="REAL_YK1+098_YK2+162_SUPPORT_IMPLEMENTED",
        metadata_extras={
            "source_centerline": "data/centerline/centerLine.json",
            "source_centerline_sha256": _sha256(CENTERLINE_PATH),
            "source_support_segment_plan": "outputs/centerline/real_support_segment_plan.json",
            "source_support_segment_plan_sha256": _sha256(PLAN_PATH),
            "source_page": 63,
            "support_plan_segment_count": 23,
            "centerline_direction": "IMPORT_TO_EXPORT",
            "mapping_formula": "engineering_chainage_m = 1098.0 + centerline_cumulative_distance_m",
            "modeled_centerline_range_m": [0.0, MODEL_END_DISTANCE_M],
            "unmodeled_centerline_range_m": [MODEL_END_DISTANCE_M, centerline.length],
            "after_end_support_status": "SUPPORT_PLAN_NOT_PROVIDED",
        },
        section_reference=section_reference,
    )
    report = {
        "output": str(OUTPUT_PATH),
        "byte_length": state["glb"]["byte_length"],
        "segment_count": len(state["metadata"]["support_segments"]),
        "modeled_segment_count": state["metadata"]["modeled_segment_count"],
        "incomplete_segment_count": state["metadata"]["incomplete_segment_count"],
        "component_counts": state["metadata"]["component_counts"],
        "engineering_component_count": state["metadata"]["mesh_instance_count"],
        "frame_validation": state["metadata"]["frame_validation"],
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
