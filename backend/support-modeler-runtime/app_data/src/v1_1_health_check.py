"""V1.1 启动前检查；复用 V1 健康检查并验证新增交互资源。"""
from pathlib import Path
from v1_health_check import run_checks

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    checks = list(run_checks())
    page = ROOT / "demo/ZZ-Va_support_master_demo_v1_1.html"
    source = ROOT / "demo/v1_1/app_source.js"
    bundle = ROOT / "demo/v1_1/app_bundle.js"
    vendor = ROOT / "demo/vendor_runtime/node_modules/three/build/three.module.min.js"
    app = (ROOT / "demo_server/app.py").read_text(encoding="utf-8")
    checks += [
        ("V1.1 page", page.is_file(), "demo/ZZ-Va_support_master_demo_v1_1.html"),
        ("V1.1 bundle", bundle.is_file() and bundle.stat().st_size > 500_000, "local bundled interaction runtime"),
        ("Three.js local", vendor.is_file(), "three 0.160.0"),
        ("DrawingInput API", "/api/master/drawing" in app, "PDF/JPG/JPEG/PNG"),
        ("Interaction source", all(token in source.read_text(encoding="utf-8") for token in
                                   ("OrbitControls", "USER_OVERRIDE", "GeometryHelperGroup_DO_NOT_EXPORT", "EXPLODED_Z_ORDER")),
         "orbit + editor + helper + z explode"),
    ]
    for name, ok, detail in checks:
        print(f"[{'OK' if ok else 'MISSING'}] {name}: {detail}")
    ready = all(ok for _, ok, _ in checks)
    # 这里只表示静态依赖预检完成；服务真正 READY 由启动器通过 /api/health 判断。
    print("PRECHECK_READY" if ready else "NOT_READY")
    return 0 if ready else 1


if __name__ == "__main__":
    raise SystemExit(main())
