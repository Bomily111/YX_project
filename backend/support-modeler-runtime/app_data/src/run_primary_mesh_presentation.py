from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'src'))
from primary_mesh.presentation import render_all
if __name__=='__main__':
 for p in render_all(ROOT):print(p)
