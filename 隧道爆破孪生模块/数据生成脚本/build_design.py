# -*- coding: utf-8 -*-
"""
YL交通隧道 正洞(Ⅳ级全断面) 爆破设计三维生成
- 数据基准: 方案 图4.4-5 炮眼布置图 (source/正洞Ⅳ级全断面炮眼布置图_图4.4-5.png)
- 断面开挖宽 12.40 m, 与平台隧道模型实测断面一致 -> 设计=基准, 后续点云套在其上
- 局部坐标系(断面局部):  x=横向(右+)  y=进尺/纵深(向岩体+)  z=竖向(上+)
  原点: x=0 中线, y=0 掌子面, z=0 底板(仰拱面)
- 三维孔深/插角: 方案未给逐孔详值, 采用经验值(见 EMPIRICAL)
"""
import json, math
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
FIG = ROOT / "source" / "正洞Ⅳ级全断面炮眼布置图_图4.4-5.png"
OUT = ROOT / "build" / "blast-design-zhengdong.json"

OUTLINE_W = 12.40        # 开挖宽 (m) 图纸标注 1240
PERIM_SPAN = 12.10       # 周边孔横向跨度(周边孔约在轮廓内 0.15m)
WALL_MARGIN = 0.15       # 轮廓相对周边孔外扩
ADVANCE_M = 2.2          # 循环进尺(设计规范值)
Z_AXIS = 4.6             # 隧道轴心高度(用于周边/辅助孔径向外插方向)
HOLE_DEPTH_M = 4.5       # 炮孔孔底目标纵深(-y): 让孔正好钻到点云壳体后壁附近(壳深约5m)

CATEGORY = {
    "perimeter": {"label": "周边孔", "color": "#1560e6", "lengthM": 2.4, "angleDeg": 1.5},
    "cut":       {"label": "掏槽孔", "color": "#e11d2e", "lengthM": 2.6, "angleDeg": 9.0},
    "auxiliary": {"label": "辅助孔", "color": "#f4600a", "lengthM": 2.4, "angleDeg": 1.0},
    "floor":     {"label": "底板孔", "color": "#9b1fe6", "lengthM": 2.4, "angleDeg": 3.0},
}


def unit(v):
    n = math.sqrt(sum(c * c for c in v)) or 1.0
    return [c / n for c in v]


def extract_holes():
    im = np.asarray(Image.open(FIG).convert("RGB")).astype(int)
    R, G, B = im[..., 0], im[..., 1], im[..., 2]
    green = (G > 110) & (R < 120) & (B < 120) & (G - R > 40) & (G - B > 40)
    red = (R > 120) & (G < 100) & (B < 100) & (R - G > 50) & (R - B > 50)

    def dots(mask, lo=6, hi=400):
        lab, n = ndimage.label(mask)
        cents = ndimage.center_of_mass(mask, lab, range(1, n + 1))
        sizes = ndimage.sum(mask, lab, range(1, n + 1))
        return np.array([(cx, cy) for (cy, cx), s in zip(cents, sizes) if lo <= s <= hi])

    g, r = dots(green), dots(red)
    # px -> m, uniform scale from perimeter span; origin: x=0 centerline, z=0 floor
    gx0, gx1 = g[:, 0].min(), g[:, 0].max()
    s = PERIM_SPAN / (gx1 - gx0)
    x0 = (gx0 + gx1) / 2.0
    yfloor = max(g[:, 1].max(), r[:, 1].max())
    to_m = lambda p: np.column_stack([(p[:, 0] - x0) * s, (yfloor - p[:, 1]) * s])
    G, Rm = to_m(g), to_m(r)
    x, z = Rm[:, 0], Rm[:, 1]
    floor = z < 1.15
    cut = (~floor) & (np.abs(x) < 1.75) & (z > 2.1) & (z < 4.9)
    aux = ~(floor | cut)
    return {
        "perimeter": G, "cut": Rm[cut], "auxiliary": Rm[aux],
        "floor": Rm[floor],
    }


def direction(category, x, z):
    a = math.radians(CATEGORY[category]["angleDeg"])
    if category in ("perimeter", "auxiliary"):
        rad = unit([x, 0.0, z - Z_AXIS])              # 径向外插
        return unit([rad[0] * math.sin(a), math.cos(a), rad[2] * math.sin(a)])
    if category == "floor":
        return unit([0.0, math.cos(a), -math.sin(a)])  # 向下保底板
    if category == "cut":
        if abs(x) < 0.2:
            return unit([0.0, math.cos(a), -math.sin(a)])
        toward = -1.0 if x > 0 else 1.0                # 楔形向中线汇聚
        return unit([toward * math.sin(a), math.cos(a), 0.0])
    return [0.0, 1.0, 0.0]                              # 中空孔平行


def build_contour(perim):
    """周边孔按极角排序成拱, 径向外扩 WALL_MARGIN, 底部沿 z=0 闭合。"""
    pts = sorted(perim.tolist(), key=lambda p: math.atan2(p[1], p[0]))  # 右下->拱顶->左下
    arch = []
    for x, z in pts:
        r = unit([x, z])
        arch.append([x + r[0] * WALL_MARGIN, 0.0, z + r[1] * WALL_MARGIN])
    half = OUTLINE_W / 2.0
    left_bottom = [-half, 0.0, 0.0]
    right_bottom = [half, 0.0, 0.0]
    # arch 顺序是 右下->拱顶->左下; 闭合: ...左下 -> 左底角 -> 右底角 -> 右下(首点)
    return [right_bottom] + arch + [left_bottom]


def build():
    groups = extract_holes()
    holes, counts = [], {}
    for cat, pts in groups.items():
        spec = CATEGORY[cat]
        counts[cat] = len(pts)
        for i, (x, z) in enumerate(pts):
            d = direction(cat, x, z)
            d = [d[0], -d[1], d[2]]   # 炮孔往壳体内钻(-y方向), 使设计嵌入点云空腔
            # 孔长按各自角度换算, 使孔底纵深统一到 HOLE_DEPTH_M(直达壳体后壁附近)
            L = HOLE_DEPTH_M / abs(d[1]) if abs(d[1]) > 1e-3 else HOLE_DEPTH_M
            collar = [float(x), 0.0, float(z)]
            toe = [collar[k] + d[k] * L for k in range(3)]
            holes.append({
                "id": f"{cat}-{i+1:02d}", "category": cat, "label": spec["label"],
                "color": spec["color"], "diameterMm": 45, "charged": cat != "empty",
                "lengthM": L, "angleDeg": spec["angleDeg"],
                "collar": collar, "toe": toe, "direction": d,
            })
    contour = build_contour(groups["perimeter"])
    perim = groups["perimeter"]
    design = {
        "metadata": {
            "name": "YL交通隧道 正洞(Ⅳ级全断面) 光面爆破 三维孪生",
            "source": "方案 图4.4-5 正洞Ⅳ级全断面光面爆破炮眼布置图",
            "sectionSpec": {"excavationWidthM": OUTLINE_W,
                            "perimeterSpanM": round(float(perim[:,0].max()-perim[:,0].min()),3),
                            "crownHeightM": round(float(perim[:,1].max()),3)},
            "coordinateFrame": "local: x=lateral(right+), y=advance(into rock+), z=up; origin at centerline/face/floor",
            "advanceM": ADVANCE_M, "centerlineX": 0.0,
            "holeCounts": counts, "totalCharged": sum(v for k,v in counts.items() if k!="empty"),
            "empiricalNote": "孔深/插角为按类别经验值(方案未给逐孔三维姿态): 周边1.5°外插, 辅助1.0°, 底板3.0°下插, 掏槽9.0°楔形汇聚, 中空孔平行",
        },
        "categories": {k: {"label": v["label"], "color": v["color"], "count": counts.get(k, 0)}
                       for k, v in CATEGORY.items()},
        "contour": contour,
        "holes": holes,
    }
    OUT.write_text(json.dumps(design, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"写出 {OUT}")
    print("孔数:", counts, " 合计装药孔:", design["metadata"]["totalCharged"])
    print("断面: 周边宽 %.2fm  拱顶高 %.2fm  轮廓宽 %.2fm" %
          (perim[:,0].max()-perim[:,0].min(), perim[:,1].max(), OUTLINE_W))
    return design


def preview(design):
    import matplotlib; matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from mpl_toolkits.mplot3d import Axes3D  # noqa
    fig = plt.figure(figsize=(13, 6))
    # 正视(x-z)
    ax1 = fig.add_subplot(1, 2, 1)
    c = np.array(design["contour"])
    cc = np.vstack([c[:, 0], c[:, 2]]).T
    ax1.plot(np.append(cc[:,0],cc[0,0]), np.append(cc[:,1],cc[0,1]), 'k-', lw=1)
    for h in design["holes"]:
        ax1.plot(h["collar"][0], h["collar"][2], 'o', color=h["color"], ms=4)
    ax1.set_aspect('equal'); ax1.set_title('front (x-z)'); ax1.grid(alpha=.3)
    # 3D 斜视
    ax2 = fig.add_subplot(1, 2, 2, projection='3d')
    for h in design["holes"]:
        a, b = h["collar"], h["toe"]
        ax2.plot([a[0],b[0]],[a[1],b[1]],[a[2],b[2]], color=h["color"], lw=0.8)
    ax2.set_title('3D holes (y=advance)'); ax2.set_box_aspect((12,4,9))
    ax2.view_init(elev=12, azim=-72)
    p = ROOT / "build" / "_design_preview.png"
    plt.tight_layout(); plt.savefig(p, dpi=110); print("预览:", p)


if __name__ == "__main__":
    preview(build())
