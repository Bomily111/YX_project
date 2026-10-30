from pathlib import Path
from master_support_demo import build_master_demo
from master_support_demo.presentation import render_all

if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    result = build_master_demo(root)
    render_all(root, result)
    print(result["state"]["status"])
    print(root / "outputs/master_demo/ZZ-Va_support_1m_current.glb")
