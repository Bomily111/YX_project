"""生成ZZ-Va二衬混凝土参数、统一geometryState与GLB。"""
from __future__ import annotations
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from base_profile import build_base_profile_parameters, build_section_geometry_state
from secondary_lining import build_secondary_lining_state


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, default=ROOT / "outputs" / "secondary_lining")
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    section_state = build_section_geometry_state(build_base_profile_parameters())
    glb_path = args.output_dir / "ZZ-Va_secondary_lining.glb"
    secondary = build_secondary_lining_state(section_state, glb_path)
    section_state["secondary_lining"] = secondary
    parameters_path = args.output_dir / "ZZ-Va_secondary_lining_parameters.json"
    geometry_path = args.output_dir / "ZZ-Va_secondary_lining_geometry.json"
    integrated_path = ROOT / "outputs" / "base_profile" / "ZZ-Va_section_geometry.json"
    parameters_path.write_text(json.dumps(secondary["parameters"], ensure_ascii=False, indent=2), encoding="utf-8")
    geometry_path.write_text(json.dumps(secondary, ensure_ascii=False, indent=2), encoding="utf-8")
    integrated_path.write_text(json.dumps(section_state, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"status": secondary["status"], "geometry": str(geometry_path), "glb": str(glb_path)}, ensure_ascii=False))
    return 0 if secondary["status"] == "SECONDARY_LINING_IMPLEMENTED" else 2


if __name__ == "__main__":
    raise SystemExit(main())
