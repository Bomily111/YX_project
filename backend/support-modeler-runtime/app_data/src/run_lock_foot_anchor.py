"""生成 ZZ-Va 锁脚小导管临时模型及1m装配。"""
from pathlib import Path
from lock_foot_anchor.assembly import build_lock_foot_assembly
from lock_foot_anchor.presentation import render_all

if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    result = build_lock_foot_assembly(root)
    render_all(root, result)
    print(result["state"]["status"])
    print(root / "outputs/lock_foot_anchor/ZZ-Va_lock_foot_anchor_provisional.glb")
