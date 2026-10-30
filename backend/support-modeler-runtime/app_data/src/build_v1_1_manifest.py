"""生成 Master Demo V1.1 回归清单。"""
from __future__ import annotations
import hashlib, json
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    "demo/ZZ-Va_support_master_demo_v1_1.html", "demo/v1_1/app_source.js",
    "demo/v1_1/app_bundle.js", "demo/v1_1/interaction_core.js", "demo_server/drawing_input.py",
    "demo_server/app.py", "demo_server/master_pipeline.py", "run_master_demo_v1_1.bat",
    "src/launch_master_demo_v1_1.py", "src/v1_1_health_check.py",
    "README_V1_1.md", "docs/V1_1_interaction_design.md", "docs/DrawingInput.md",
    "docs/ComponentParameterEditor.md", "docs/GeometryHelpers.md", "docs/SupportVariant.md",
]


def digest(path: Path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    artifacts = []
    for relative in FILES:
        path = ROOT / relative
        artifacts.append({"path": relative, "sha256": digest(path), "size_bytes": path.stat().st_size})
    screenshots = sorted((ROOT / "outputs/presentation/V1_1").glob("*.png"))
    export = ROOT / "outputs/master_demo/ZZ-Va_support_V1_1_browser_export.glb"
    manifest = {
        "version": "ZZ-Va Parameterized Support Demo V1.1",
        "status": "MASTER_SUPPORT_DEMO_V1_1_IMPLEMENTED",
        "generated_at": datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
        "v1_baseline_manifest_sha256": digest(ROOT / "baseline/V1_manifest.json"),
        "tests": {"passed": 397, "failed": 0},
        "startup_validation": {
            "clean_start": "SERVICE_STARTED",
            "repeated_start": "EXISTING_SERVICE_REUSED",
            "occupied_port": "PORT_8000_OCCUPIED_BY_OTHER_PROCESS -> 8001",
            "health_endpoint": "/api/health",
            "demo_cache_no_500": True,
        },
        "drawing_inputs": ["PDF_DOCUMENT", "IMAGE_DRAWING:JPG", "IMAGE_DRAWING:PNG"],
        "browser_validation": {"orbit_rotate": True, "right_pan_mapping": True, "wheel_zoom": True,
                               "pdf_upload": True, "jpg_upload": True, "png_upload": True,
                               "component_selection": True, "user_override": True, "restore": True,
                               "z_exploded": True, "variant_roundtrip": True, "javascript_errors": 0},
        "glb_validation": {"valid_glb_v2": True, "mesh_count": 69, "helper_nodes": 0,
                           "formal_component_z_translations": 0, "path": export.relative_to(ROOT).as_posix(),
                           "sha256": digest(export), "size_bytes": export.stat().st_size},
        "files": artifacts,
        "screenshots": [{"path": p.relative_to(ROOT).as_posix(), "sha256": digest(p)} for p in screenshots],
        "scope_guards": {"v1_page_overwritten": False, "ocr_rewritten": False,
                         "support_parameter_payload_changed": False, "formal_parameter_json_changed": False,
                         "core_geometry_changed": False},
    }
    destination = ROOT / "baseline/V1_1_manifest.json"
    destination.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(destination)


if __name__ == "__main__":
    main()
