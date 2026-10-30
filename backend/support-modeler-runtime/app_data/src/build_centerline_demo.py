"""生成明确标注为测试路线的0~100 m多支护类型CenterLine Demo。"""
from __future__ import annotations

import json
import math
from pathlib import Path

try:
    from src.centerline_support import build_centerline_support, load_centerline, load_segment_plan
except ModuleNotFoundError:  # 兼容 ``python src/build_centerline_demo.py``
    from centerline_support import build_centerline_support, load_centerline, load_segment_plan


ROOT = Path(__file__).resolve().parents[1]


def ensure_demo_inputs() -> tuple[Path, Path]:
    centerline_path = ROOT / "config" / "centerLine_demo_0_100m.json"
    plan_path = ROOT / "config" / "support_segment_plan_0_100m.json"
    grade = 0.005
    horizontal_rate = math.sqrt(1.0 - grade * grade)
    radius = 200.0
    chainage = list(range(0, 101, 5))
    points = []
    for station in chainage:
        angle = horizontal_rate * station / radius
        points.append([
            radius * (1.0 - math.cos(angle)),
            grade * station,
            radius * math.sin(angle),
        ])
    centerline = {
        "schema": "CenterLine/V1",
        "points": points,
        "chainage": chainage,
        "coordinate_system": {
            "kind": "LOCAL_ENGINEERING",
            "axis": "x=horizontal/right, y=vertical/up, z=forward",
            "unit": "m",
            "source_status": "SYNTHETIC_TEST_ALIGNMENT",
            "note": "工程目录与历史HTML压缩包未附centerLine.json；本文件只验证0~100m里程装配，不代表真实路线。",
        },
    }
    plan = {
        "schema": "SupportSegmentPlan/V1",
        "boundary_rule": "START_INCLUSIVE_END_EXCLUSIVE",
        "segments": [
            {"start_chainage": 0, "end_chainage": 20, "support_type": "ZZ-IVa"},
            {"start_chainage": 20, "end_chainage": 50, "support_type": "ZZ-IVb"},
            {"start_chainage": 50, "end_chainage": 80, "support_type": "ZZ-Va"},
            {"start_chainage": 80, "end_chainage": 100, "support_type": "ZZ-S"},
        ],
    }
    centerline_path.write_text(json.dumps(centerline, ensure_ascii=False, indent=2), encoding="utf-8")
    plan_path.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
    return centerline_path, plan_path


def main() -> None:
    centerline_path, plan_path = ensure_demo_inputs()
    centerline = load_centerline(centerline_path)
    plan = load_segment_plan(plan_path, {"ZZ-IVa", "ZZ-IVb", "ZZ-Va", "ZZ-S"}, centerline.length)
    output = ROOT / "outputs" / "centerline" / "tunnel_support_0_100m.glb"
    state = build_centerline_support(ROOT, centerline, plan, output)
    print(json.dumps({
        "centerline_length_m": centerline.length,
        "output": str(output),
        "byte_length": state["glb"]["byte_length"],
        "mesh_instances": state["metadata"]["mesh_instance_count"],
        "component_counts": state["metadata"]["component_counts"],
        "frame_validation": state["metadata"]["frame_validation"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
