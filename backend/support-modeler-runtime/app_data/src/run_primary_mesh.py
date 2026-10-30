from __future__ import annotations
import json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'src'))
from primary_mesh import build_primary_mesh
def main():
 result=build_primary_mesh(ROOT,ROOT/'outputs/primary_mesh');state=result['state'];print(json.dumps({'status':state['status'],'readiness':state['readiness'],'validation':state['validation'],'glb':state['glb']},ensure_ascii=False));return 0 if state['status']=='PRIMARY_SUPPORT_MESH_PARTIAL' else 2
if __name__=='__main__':raise SystemExit(main())
