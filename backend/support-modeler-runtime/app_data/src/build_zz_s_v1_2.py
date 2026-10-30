"""生成 ZZ-S V1.2 装配产物并更新统一 Demo 的本地 payload。"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from zz_s import build_zz_s_support_1m  # noqa: E402


def payload() -> dict:
    return {
        "schema": "SupportParameterPayload/V1",
        "support_type": "ZZ-S",
        "source": {
            "pdf_name": "support_drawings.pdf",
            "pdf_sha256": "93b107f4fd5cf04bea82950294fdc4652085647d3411e9379922d0938d9c8c57",
            "pages": [74, 76, 113, 114, 115, 116],
            "extraction_source": "EXISTING_REAL_OCR_AND_PROJECT_EVIDENCE",
        },
        "confirmed": {
            "inner_profile": {
                "top_radius_mm": 5500, "side_radius_mm": 10000,
                "side_angle_deg": 11 + 41/60 + 58/3600,
                "invert_transition_radius_mm": 1200,
                "invert_transition_angle_deg": 55 + 53/60 + 29/3600,
                "invert_bottom_radius_mm": 12000,
                "invert_bottom_angle_deg": 44 + 49/60 + 6/3600,
                "status": "CONFIRMED", "source_pages": [74, 76, 113],
            },
            "primary_support": {
                "material": "C25高性能喷射混凝土", "total_thickness_mm": 260,
                "reserved_deformation_mm": 120, "status": "CONFIRMED", "source_pages": [113],
            },
            "primary_mesh": {
                "circumferential_bar": {"diameter_mm": 8, "spacing_mm": 200},
                "longitudinal_bar": {"diameter_mm": 8, "spacing_mm": 200},
                "layers": 1, "scope": "ARCH_AND_WALL_ONLY", "status": "CONFIRMED", "source_pages": [113],
            },
            "steel_arch": {
                "R1_mm": 6240, "R2_mm": 10740, "beta_deg": 15.6383,
                "steel_profile": "I20a", "longitudinal_spacing_mm": 500,
                "status": "CONFIRMED", "source_pages": [113, 115, 116],
            },
            "system_anchor": {
                "type": "Φ25自进式中空注浆锚杆", "diameter_mm": 25, "length_mm": 4500,
                "circumferential_spacing_mm": 1200, "longitudinal_spacing_mm": 500,
                "status": "CONFIRMED", "source_pages": [113],
            },
            "lock_foot": {
                "outer_diameter_mm": 42, "wall_thickness_mm": 4, "length_mm": 3500,
                "count_per_arch": 8, "status": "CONFIRMED", "source_pages": [69, 113, 115],
            },
            "secondary_lining": {
                "material": "C35钢筋混凝土", "thickness_mm": 500, "has_invert": True,
                "status": "CONFIRMED", "source_pages": [113],
            },
            "secondary_rebar": {
                "N1": {"diameter_mm": 22, "length_mm": 35849, "R1_mm": 5939, "R2_mm": 10439, "R3_mm": 1639, "R4_mm": 12439, "status": "CONFIRMED"},
                "N2": {"diameter_mm": 22, "length_mm": 33474, "r1_mm": 5561, "r2_mm": 10061, "r3_mm": 1261, "r4_mm": 12061, "status": "CONFIRMED"},
                "N3": {"diameter_mm": 12, "length_mm": 1000, "circumferential_spacing_mm": 250, "status": "CONFIRMED"},
                "N4": {"diameter_mm": 8, "length_mm": 552, "circumferential_spacing_mm": 500, "longitudinal_spacing_mm": 250, "status": "CONFIRMED"},
                "angles_deg": {"A": 22 + 24/60 + 33/3600, "B": 11 + 41/60 + 58/3600, "C": 55 + 53/60 + 29/3600},
                "source_pages": [114],
            },
        },
        "provisional": {
            "primary_mesh": {"reference_side": "PRIMARY_SUPPORT_INNER_PLUS_40MM", "status": "PROVISIONAL"},
            "lock_foot": {
                "upper_height_mm": 250, "lower_height_mm": 100,
                "upper_angle_deg": 7.5, "lower_angle_deg": 45, "pair_spread_deg": 10,
                "status": "PROVISIONAL",
            },
        },
        "pending": {},
        "component_status": {
            "primary_concrete": "READY", "primary_mesh": "PARTIAL", "steel_arch": "READY",
            "system_anchor": "READY", "lock_foot": "PARTIAL", "secondary_lining": "READY",
            "N1": "READY", "N2": "READY", "N3": "READY", "N4": "READY",
        },
        "parameter_sources": {
            "drawing": "support_drawings.pdf pages 113-116",
            "common_inner_profile": "support_drawings.pdf pages 74 and 76",
            "construction_plan": "table 4.7-1",
            "parameter_definition": "参数识别.docx",
        },
        "model_ready": True,
    }


def main() -> None:
    path = ROOT / "outputs/master_demo/support_payloads_v1_2.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    item = payload()
    item["resolved_parameters"] = {**item["confirmed"], **item["provisional"]}
    data["ZZ-S"] = item
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    state = build_zz_s_support_1m(ROOT, ROOT / "outputs/multi_support")
    print(json.dumps({"payload": "ZZ-S", "glb": state["glb"]["path"], "validation": state["validation"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
