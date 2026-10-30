"""ZZ-Va Parameterized Support V1 本地启动前健康检查。"""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def _check(name: str, ok: bool, detail: str) -> tuple[str, bool, str]:
    return name, bool(ok), detail


def run_checks() -> list[tuple[str, bool, str]]:
    page = ROOT / "demo" / "ZZ-Va_support_master_demo.html"
    html = page.read_text(encoding="utf-8") if page.is_file() else ""
    cache_root = ROOT / "outputs" / "master_demo" / "extraction_cache"
    real_caches = list(cache_root.glob("*/extraction.json")) if cache_root.is_dir() else []
    dependency_names = ["flask", "fitz", "rapidocr_onnxruntime", "numpy", "cv2", "PIL", "openpyxl", "yaml"]
    missing = [name for name in dependency_names if importlib.util.find_spec(name) is None]

    checks = [
        _check("Python", sys.version_info >= (3, 10), sys.version.split()[0]),
        _check("Dependencies", not missing, "complete" if not missing else "missing: " + ", ".join(missing)),
        _check("OCR entry", (ROOT / "src" / "ocr_engine.py").is_file(), "src/ocr_engine.py"),
        _check("Real OCR cache", bool(real_caches), f"{len(real_caches)} cached extraction(s)"),
        _check("Master Demo", page.is_file(), "demo/ZZ-Va_support_master_demo.html"),
        _check("Three.js resources", "three.module.js" in html and "GLTFLoader" in html, "module imports declared"),
        _check("PDF API", all(token in (ROOT / "demo_server" / "app.py").read_text(encoding="utf-8") for token in ('@app.post("/api/master/extract")', '@app.get("/api/master/demo-cache")')), "/api/master/extract + /api/master/demo-cache"),
        _check("GLB exporter", "GLTFExporter" in html and "exportGlb" in html, "browser exporter wired"),
        _check("Baseline GLB", (ROOT / "outputs" / "master_demo" / "ZZ-Va_from_pdf_support_1m.glb").stat().st_size > 0 if (ROOT / "outputs" / "master_demo" / "ZZ-Va_from_pdf_support_1m.glb").is_file() else False, "outputs/master_demo/ZZ-Va_from_pdf_support_1m.glb"),
    ]
    payload_path = ROOT / "outputs" / "master_demo" / "latest_support_payload.json"
    try:
        payload = json.loads(payload_path.read_text(encoding="utf-8"))
        payload_ok = payload.get("support_type") == "ZZ-Va" and payload.get("source", {}).get("extraction_source") == "PREVIOUS_REAL_OCR_CACHE"
    except (OSError, json.JSONDecodeError):
        payload_ok = False
    checks.append(_check("V1 payload", payload_ok, "ZZ-Va + PREVIOUS_REAL_OCR_CACHE"))
    return checks


def main() -> int:
    checks = run_checks()
    for name, ok, detail in checks:
        print(f"[{'OK' if ok else 'MISSING'}] {name}: {detail}")
    if all(ok for _, ok, _ in checks):
        print("READY")
        return 0
    print("NOT_READY")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
