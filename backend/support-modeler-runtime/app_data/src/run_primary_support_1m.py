from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from primary_support.status import build_primary_support_status_v2
from primary_support_1m import build_primary_support_1m
from primary_support_1m.presentation import render_all


def main() -> int:
    build_primary_support_status_v2(ROOT / "outputs/primary_support/ZZ-Va_primary_support_status_v2.json")
    result = build_primary_support_1m(ROOT, ROOT / "outputs/primary_support")
    images = render_all(ROOT, result)
    print(json.dumps({"status": result["state"]["status"], "paths": {k: str(v) for k, v in result["paths"].items()}, "images": [str(p) for p in images]}, ensure_ascii=False, indent=2))
    return 0 if result["state"]["status"] == "PRIMARY_SUPPORT_1M_ASSEMBLY_IMPLEMENTED" else 2


if __name__ == "__main__":
    raise SystemExit(main())
