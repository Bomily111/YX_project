"""生成 ZZ-Va 顶拱/侧拱初支混凝土实验成果。"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from primary_support import build_primary_support


def main() -> int:
    result = build_primary_support(ROOT, ROOT / "outputs/primary_support")
    state = result["state"]
    print(json.dumps({"status": state["status"], "validation": state["validation"], "glb": state["glb"]}, ensure_ascii=False))
    return 0 if state["status"] == "PRIMARY_SUPPORT_CONCRETE_IMPLEMENTED" else 2


if __name__ == "__main__":
    raise SystemExit(main())
