"""生成实验性 ZZ-Va 基础断面参数与 geometryState。"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from base_profile import build_base_profile_parameters, build_section_geometry_state


ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    parser = argparse.ArgumentParser(description="生成 ZZ-Va 基础断面实验性参数链")
    parser.add_argument("--source", type=Path, default=ROOT / "config" / "zz_va_base_profile_sources.json")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "outputs" / "base_profile")
    args = parser.parse_args()
    parameters = build_base_profile_parameters(args.source)
    state = build_section_geometry_state(parameters)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    parameters_path = args.output_dir / "ZZ-Va_base_profile_parameters.json"
    geometry_path = args.output_dir / "ZZ-Va_section_geometry.json"
    inner_path = args.output_dir / "ZZ-Va_inner_profile_geometry.json"
    parameters_path.write_text(json.dumps(parameters.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
    geometry_path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    inner_path.write_text(json.dumps(state["inner_profile"], ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"status": state["status"], "parameters": str(parameters_path), "geometry": str(geometry_path), "inner_profile": str(inner_path)}, ensure_ascii=False))
    return 0 if state["status"] == "INNER_PROFILE_IMPLEMENTED" else 2


if __name__ == "__main__":
    raise SystemExit(main())
