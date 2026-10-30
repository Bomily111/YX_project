from __future__ import annotations
import json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'src'))
from section_assembly import build_section_assembly
def main():
 out=ROOT/'outputs/section_assembly';state=build_section_assembly(ROOT,out);(out/'ZZ-Va_implemented_components_assembly_state.json').write_text(json.dumps(state,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({'status':state['status'],'distances':state['distances'],'glb':state['glb']},ensure_ascii=False));return 0 if state['status'].endswith('_IMPLEMENTED') else 2
if __name__=='__main__':raise SystemExit(main())
