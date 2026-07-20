# -*- coding: utf-8 -*-
"""
爆后三维点云(3.las) -> 套在正洞设计断面上
- 3.las: 带RGB, 断面 X≈14.3m(宽) × Z≈9.8m(高), Y≈5.3m(纵深)
- 处理: 定向 -> 定心 -> 各向拉伸, 使扫描壁面envelope贴合设计轮廓(宽12.40, 高~9.0)
- 输出到设计局部系: x=横向, y=纵深, z=竖向; 掌子面 y=0, 点云沿 -y 向后铺
- 结果与 blast-design 同一坐标系, 点云壁面即包住炮孔(周边孔落在壁内)
"""
import json, math
from pathlib import Path
import numpy as np
import laspy

ROOT = Path(__file__).resolve().parents[1]
LAS = ROOT.parent / "爆破效果数据" / "激光点云" / "3.las"
DESIGN = ROOT / "build" / "blast-design-zhengdong.json"
OUT_NPY = ROOT / "build" / "pointcloud_zhengdong.npy"   # (N,6) x,y,z,r,g,b(0..1)
TARGET_POINTS = 450_000
DEPTH_SPAN_M = 5.0        # 点云在纵深方向铺开的长度
DEPTH_FRONT_M = 1.2       # 掌子面(y=0)前方保留一点点点云, 其余向 -y 铺


def main():
    d = json.loads(DESIGN.read_text(encoding="utf-8"))
    contour = np.array(d["contour"])
    # 目标包络 = 周边孔(开挖线), 使扫描壁面正好落在炮孔/洞壁上
    per = np.array([h["collar"] for h in d["holes"] if h["category"] == "perimeter"])
    cw = float(per[:, 0].max() - per[:, 0].min())              # 周边孔跨度 ~12.10
    ch = float(per[:, 2].max())                                # 周边孔拱顶 ~8.88

    las = laspy.read(str(LAS))
    X, Y, Z = np.asarray(las.x), np.asarray(las.y), np.asarray(las.z)
    has_rgb = all(hasattr(las, c) for c in ("red", "green", "blue"))
    if has_rgb:
        r = np.asarray(las.red); g = np.asarray(las.green); b = np.asarray(las.blue)
        m = max(r.max(), g.max(), b.max()) or 1
        rgb = np.column_stack([r, g, b]).astype(float) / (65535.0 if m > 255 else 255.0)
    else:
        rgb = None

    # 源断面: X=宽, Z=高, Y=纵深
    xw_lo, xw_hi = np.percentile(X, [1, 99])
    zf_lo, zf_hi = np.percentile(Z, [1, 99])
    src_w = xw_hi - xw_lo
    src_h = zf_hi - zf_lo
    xc = (xw_lo + xw_hi) / 2.0

    # 拉伸贴合: 宽->cw, 高->ch(底 z=0)
    sx = cw / src_w
    sz = ch / src_h
    x_new = (X - xc) * sx
    z_new = (Z - zf_lo) * sz

    # 纵深对齐(壳体相嵌): 点云是开挖后的隧道空壳, 密集端=里侧新掌子面(有盖),
    # 稀疏端=开口(没盖)。把"开口端"放到 y=0(=设计黄线/孔口面), 壳体沿 -y 深入,
    # 炮孔从孔口面往 -y 钻入壳体, 于是设计整体嵌进点云空壳内。
    span = np.percentile(Y, 99) - np.percentile(Y, 1)
    lo_dense = (Y < np.percentile(Y, 1) + span * 0.2).sum()
    hi_dense = (Y > np.percentile(Y, 99) - span * 0.2).sum()
    if hi_dense >= lo_dense:
        open_end = np.percentile(Y, 1)       # 密集掌子面在高Y -> 开口在低Y
        y_new = open_end - Y                 # 开口->0, 掌子面->负(里侧)
    else:
        open_end = np.percentile(Y, 99)      # 密集掌子面在低Y -> 开口在高Y
        y_new = Y - open_end
    print(f"点云开口端对齐到 y=0, 掌子面(密集端)深入到 -y 里侧")

    pts = np.column_stack([x_new, y_new, z_new])
    # 裁掉离设计断面过远的杂点(横向/竖向超出轮廓 0.6m 的噪声)
    keep = (np.abs(pts[:, 0]) <= cw / 2 + 0.35) & (pts[:, 2] >= -0.45) & (pts[:, 2] <= ch + 0.45) \
        & (pts[:, 1] >= -5.5) & (pts[:, 1] <= 0.8)
    pts = pts[keep]; rgb = rgb[keep] if rgb is not None else None

    # 下采样
    if len(pts) > TARGET_POINTS:
        idx = np.random.default_rng(7).choice(len(pts), TARGET_POINTS, replace=False)
        pts = pts[idx]; rgb = rgb[idx] if rgb is not None else None
    # ── 点云着色: 沿用旧平台(bpls)配色: 深青 #164e63 -> 浅黄绿 #d9f99d, 按扫描明暗渐变 ──
    lum = rgb.mean(axis=1) if rgb is not None else np.full(len(pts), 0.6)
    lum = np.clip((lum - lum.min()) / (np.ptp(lum) or 1), 0, 1)     # 归一化的表面亮度(扫描明暗)
    cold = np.array([0x16, 0x4e, 0x63]) / 255.0                     # 深青
    hot = np.array([0xd9, 0xf9, 0x9d]) / 255.0                      # 浅黄绿
    rgb = np.clip(cold + (hot - cold) * lum[:, None], 0, 1)

    out = np.column_stack([pts, rgb]).astype("float32")
    np.save(OUT_NPY, out)
    print(f"写出 {OUT_NPY}  点数={len(out)}")
    print(f"源断面 宽{src_w:.2f}×高{src_h:.2f}m -> 目标 宽{cw:.2f}×高{ch:.2f}m  (sx={sx:.3f}, sz={sz:.3f})")
    print(f"点云范围 x[{pts[:,0].min():.2f},{pts[:,0].max():.2f}] y[{pts[:,1].min():.2f},{pts[:,1].max():.2f}] z[{pts[:,2].min():.2f},{pts[:,2].max():.2f}]")

    # 对齐校核: 正视叠加 点云 + 设计轮廓 + 周边孔
    import matplotlib; matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    plt.figure(figsize=(8, 7))
    s = np.random.default_rng(1).choice(len(pts), min(60000, len(pts)), replace=False)
    plt.scatter(pts[s, 0], pts[s, 2], s=1, c=np.clip(rgb[s], 0, 1), marker='.')
    cc = np.vstack([contour[:, 0], contour[:, 2]]).T
    plt.plot(np.append(cc[:, 0], cc[0, 0]), np.append(cc[:, 1], cc[0, 1]), 'y-', lw=1.5, label='design contour')
    per = [h for h in d["holes"] if h["category"] == "perimeter"]
    plt.scatter([h["collar"][0] for h in per], [h["collar"][2] for h in per],
                facecolors='none', edgecolors='cyan', s=25, linewidths=1, label='perimeter holes')
    plt.gca().set_aspect('equal'); plt.legend(loc='upper right')
    plt.title('point cloud vs design contour (front, aligned)')
    p = ROOT / "build" / "_pointcloud_align_check.png"
    plt.tight_layout(); plt.savefig(p, dpi=115); print("校核图:", p)


if __name__ == "__main__":
    main()
