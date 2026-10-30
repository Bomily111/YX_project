"""生成 ZZ-IVa 1m 总装和参数清单。"""
from pathlib import Path
import json

from zz_iva import build_zz_iva_support_1m


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    result = build_zz_iva_support_1m(root, root / "outputs/multi_support")
    print(json.dumps({"status": result["status"], "glb": result["glb"]}, ensure_ascii=False, indent=2))
