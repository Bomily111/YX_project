from __future__ import annotations
import json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT/'src'))
from secondary_rebar_assembly import build_assembly_state

def main():
    src=ROOT/'outputs/base_profile/ZZ-Va_section_geometry.json'; state=json.loads(src.read_text(encoding='utf-8'))
    out=ROOT/'outputs/secondary_rebar_assembly'; out.mkdir(parents=True,exist_ok=True)
    result=build_assembly_state(state,out/'ZZ-Va_secondary_N1_N2_assembly.glb')
    (out/'ZZ-Va_N1_N2_assembly_state.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({"status":result["status"],"glb":result["glb"]},ensure_ascii=False)); return 0
if __name__=='__main__': raise SystemExit(main())
