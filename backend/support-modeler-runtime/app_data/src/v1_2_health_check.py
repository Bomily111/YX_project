"""V1.2 启动前检查：保留 V1.1 检查并验证多支护资源。"""
from pathlib import Path

from v1_health_check import run_checks


ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    registry = ROOT / "demo/v1_2/support_type_registry.js"
    source = ROOT / "demo/v1_2/app_source.js"
    checks = list(run_checks()) + [
        ("V1.2 page", (ROOT / "demo/support_master_demo_v1_2.html").is_file(), "multi-support page"),
        ("V1.2 bundle", (ROOT / "demo/v1_2/app_bundle.js").stat().st_size > 500_000, "local Three.js bundle"),
        ("SupportTypeRegistry", registry.is_file() and all(x in registry.read_text(encoding="utf-8") for x in ("ZZ-IVa", "ZZ-Va", "ZZ-S")), "5 registered types"),
        ("Shared steel geometry", (ROOT / "demo/v1_2/steel_arch_geometry.js").is_file(), "three-arc I-beam sweep"),
        ("V1.2 payloads", (ROOT / "outputs/master_demo/support_payloads_v1_2.json").is_file(), "SupportParameterPayload map"),
        ("Multi-type interaction", all(x in source.read_text(encoding="utf-8") for x in ("switchSupportType", "variantsBySupport", "VARIANT_SUPPORT_TYPE_MISMATCH")), "switch + isolated variants"),
    ]
    for name, ok, detail in checks:
        print(f"[{'OK' if ok else 'MISSING'}] {name}: {detail}")
    ready = all(ok for _, ok, _ in checks)
    print("PRECHECK_READY" if ready else "NOT_READY")
    return 0 if ready else 1


if __name__ == "__main__":
    raise SystemExit(main())
