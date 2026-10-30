from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from system_anchor import build_system_anchor
from system_anchor.presentation import render_all


def main() -> int:
    result = build_system_anchor(ROOT, ROOT / "outputs/system_anchor")
    images = render_all(ROOT, result["geometry"])
    print(json.dumps({"status": result["state"]["status"], "count": result["state"]["geometry"]["count"], "glb": {k: str(v) for k, v in result["paths"].items() if k.endswith("glb")}, "images": [str(p) for p in images]}, ensure_ascii=False, indent=2))
    return 0 if result["state"]["status"] == "SYSTEM_ANCHOR_IMPLEMENTED" else 2


if __name__ == "__main__":
    raise SystemExit(main())
