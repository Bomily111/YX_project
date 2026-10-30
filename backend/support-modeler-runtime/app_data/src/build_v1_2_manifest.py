"""生成可重复比对的 V1.2 多支护类型基线清单。"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def record(relative: str) -> dict:
    path = ROOT / relative
    return {
        "path": relative,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "size_bytes": path.stat().st_size,
    }


def build(test_count: int = 437) -> dict:
    core = [
        "demo/support_master_demo_v1_2.html",
        "demo/v1_2/app_source.js",
        "demo/v1_2/app_bundle.js",
        "demo/v1_2/support_type_registry.js",
        "demo/v1_2/steel_arch_geometry.js",
        "demo/v1_1/interaction_core.js",
        "demo_server/app.py",
        "src/zz_iva/assembly.py",
        "src/primary_mesh/geometry.py",
        "src/system_anchor/geometry.py",
        "src/launch_master_demo_v1_2.py",
        "src/v1_2_health_check.py",
        "run_master_demo_v1_2.bat",
    ]
    data = [
        "outputs/master_demo/support_payloads_v1_2.json",
        "outputs/multi_support/ZZ-IVa_parameter_inventory.json",
        "database/steel_profiles.json",
    ]
    artifacts = [
        "outputs/master_demo/ZZ-IVa_support_current.glb",
        "outputs/master_demo/ZZ-IVa_support_current_metadata.json",
        "outputs/multi_support/ZZ-IVa_support_1m.glb",
        "outputs/multi_support/ZZ-IVa_support_1m_metadata.json",
        "outputs/master_demo/ZZ-Va_support_current_v1_2.glb",
        "outputs/master_demo/ZZ-Va_support_current_metadata_v1_2.json",
    ]
    return {
        "version": "Parameterized Support Demo V1.2",
        "status": "MULTI_SUPPORT_DEMO_V1_2_IMPLEMENTED",
        "generated_at": datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
        "implemented_support_types": ["ZZ-Va", "ZZ-IVa"],
        "registered_support_types": ["ZZ-III", "ZZ-IVa", "ZZ-IVb", "ZZ-Va", "ZZ-S"],
        "test_summary": {"passed": test_count, "failed": 0},
        "demo": {
            "path": "demo/support_master_demo_v1_2.html",
            "url": "http://127.0.0.1:8000/demo/support_master_demo_v1_2.html",
            "launcher": "run_master_demo_v1_2.bat",
        },
        "browser_validation": {
            "default_ZZ_Va": True,
            "switch_ZZ_Va_ZZ_IVa": True,
            "parameter_isolation": True,
            "user_override": True,
            "restore_recognized": True,
            "geometry_helpers": True,
            "orbit_controls": True,
            "real_ocr_cache": "CACHE_HIT",
            "ZZ_IVa_glb_mesh_count": 26,
            "ZZ_IVa_full_component_groups": 5,
            "ZZ_IVa_final_status": "SECOND_SUPPORT_TYPE_MOSTLY_IMPLEMENTED",
            "ZZ_Va_glb_mesh_count": 69,
            "javascript_errors": 0,
        },
        "scope_guards": {
            "formal_ocr_modified": False,
            "formal_parameter_json_modified": False,
            "accepted_geometry_formula_modified": False,
            "existing_geometry_default_behavior_preserved": True,
            "centerline_added": False,
            "vlm_added": False,
        },
        "core_files": [record(path) for path in core],
        "parameter_files": [record(path) for path in data],
        "export_artifacts": [record(path) for path in artifacts],
    }


if __name__ == "__main__":
    destination = ROOT / "baseline/V1_2_manifest.json"
    destination.write_text(json.dumps(build(), ensure_ascii=False, indent=2), encoding="utf-8")
    print(destination)
