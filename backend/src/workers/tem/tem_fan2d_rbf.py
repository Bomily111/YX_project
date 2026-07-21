"""
二维扇面 RBF 径向基插值 — 扇形图
==================================
横坐标 = 横向偏移 v (m)
纵坐标 = 前向距离 u (m)
输出为严格的扇形图，扇面外区域留白
"""

import numpy as np
from scipy.interpolate import RBFInterpolator
from pathlib import Path
import matplotlib.pyplot as plt
from matplotlib.colors import Normalize
from matplotlib.patches import Wedge
import warnings
warnings.filterwarnings('ignore')

DATA_DIR = Path(r"d:\成都院资料\成都院资料\物探数据\02-瞬变电磁\yuanshujv")
OUTPUT_DIR = DATA_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

# 扇形: 从左到右 θ=-60°~+60°, 间隔15°, 0°=正前方
DIRECTION_ANGLES = {
    1: -60.0, 2: -45.0, 3: -30.0, 4: -15.0, 5: 0.0,
    6:  15.0, 7:  30.0, 8:  45.0, 9:  60.0,
}
LINE_LABELS = {"线1": "斜向上30°顶拱方向", "线2": "斜向上15°",
               "线3": "水平方向", "线4": "斜向下15°底板方向"}
K_VMIN, K_VMAX = 550, 700

plt.rcParams['font.sans-serif'] = ['SimHei', 'Microsoft YaHei', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

from matplotlib.colors import LinearSegmentedColormap, ListedColormap, BoundaryNorm
SMOOTH_CMAP = LinearSegmentedColormap.from_list('jet_gy_wide', [
    (0.00, '#0033ff'), (0.10, '#0088ff'), (0.18, '#00ccff'),
    (0.25, '#00ee55'), (0.38, '#66ff00'), (0.50, '#ddff00'),
    (0.62, '#ffdd00'), (0.73, '#ff9900'), (0.85, '#ff4400'),
    (1.00, '#ee0000'),
])
LEVELS = np.arange(550, 705, 5)
CMAP = ListedColormap(SMOOTH_CMAP(np.linspace(0, 1, len(LEVELS) - 1)))
NORM = BoundaryNorm(LEVELS, ncolors=CMAP.N, clip=True)


def parse_dat(filepath):
    pts = []
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) < 3:
                continue
            d_id = int(parts[0])
            dist = float(parts[1])
            k = float(parts[2])
            theta = DIRECTION_ANGLES[d_id]
            theta_rad = np.radians(theta)
            pts.append({
                "direction_id": d_id, "theta_deg": theta,
                "distance_m": dist, "k": k,
                "u": dist * np.cos(theta_rad),
                "v": dist * np.sin(theta_rad),
            })
    return pts


def rbf_interpolate_fan(pts, grid_res=250):
    known_uv = np.array([[p["u"], p["v"]] for p in pts])
    known_k = np.array([p["k"] for p in pts])

    rbf = RBFInterpolator(known_uv, known_k, kernel='thin_plate_spline', smoothing=0.0)
    d_max = max(p["distance_m"] for p in pts) * 1.02  # 最大探测距离
    v_extent = d_max * np.sin(np.radians(60)) * 1.02  # ±60°处横向最大

    u_vals = np.linspace(0.05, d_max, grid_res)
    v_vals = np.linspace(-v_extent, v_extent, grid_res)
    UU, VV = np.meshgrid(u_vals, v_vals)

    rbf = RBFInterpolator(known_uv, known_k, kernel='thin_plate_spline', smoothing=0.0)
    grid_pts = np.column_stack([UU.ravel(), VV.ravel()])
    KK = rbf(grid_pts).reshape(UU.shape)

    # 扇形掩膜: 30°~150° → arctan2(v,u)∈[-60°,+60°], 距离不超过外弧
    with np.errstate(divide='ignore', invalid='ignore'):
        fan_angle = np.degrees(np.arctan2(VV, UU))
    dist = np.sqrt(UU**2 + VV**2)
    mask = (np.abs(fan_angle) <= 60.0) & (UU > 0.05) & (dist <= d_max)

    return UU, VV, KK, mask


def plot_fan(uu, vv, kk, mask, pts, line_name, ax):
    kk_masked = np.where(mask, kk, np.nan)
    r_edge = uu.max()  # 外弧半径 (最大前向距离)
    v_extent = r_edge * np.cos(np.radians(30))  # 30°处横向
    x_lim = v_extent * 1.08
    y_bot = -2.0
    y_top = r_edge * 1.05

    # ---- 全区域白色背景 ----
    ax.fill_between([-x_lim, x_lim], y_bot, y_top, color='white', zorder=0)

    # ---- 扇面填色 (横轴=v偏移, 纵轴=u前向) ----
    im = ax.pcolormesh(vv, uu, kk_masked, cmap=CMAP, norm=NORM,
                       shading='gouraud', rasterized=True, zorder=1)

    # ---- 等值线 ----
    ax.contour(vv, uu, kk_masked, levels=np.arange(550, 710, 10),
               colors='black', linewidths=0.3, alpha=0.5, zorder=2)

    # ---- 采样点 ----
    sample_vu = np.array([[p["v"], p["u"]] for p in pts])
    ax.scatter(sample_vu[:, 0], sample_vu[:, 1], c='black', s=2,
               zorder=5, alpha=0.5)

    # ---- 方向射线 (θ=-60°~+60°, 9条) ----
    for theta_deg in DIRECTION_ANGLES.values():
        theta_rad = np.radians(theta_deg)
        ax.plot([0, r_edge * np.sin(theta_rad)],
                [0, r_edge * np.cos(theta_rad)],
                'gray', linewidth=0.3, alpha=0.3, linestyle='--', zorder=3)

    # ---- 距离弧线 (15, 30, 45m, -60°→+60°) ----
    for r_label in [15, 30, 45]:
        if r_label > r_edge:
            continue
        theta_arc = np.linspace(-60, 60, 80)
        theta_arc_rad = np.radians(theta_arc)
        ax.plot(r_label * np.sin(theta_arc_rad),
                r_label * np.cos(theta_arc_rad),
                'gray', linewidth=0.3, alpha=0.3, zorder=3)

    # ---- 扇形边框 (-60°+60°射线 + 外弧) ----
    ax.plot([0, r_edge * np.sin(np.radians(-60))],
            [0, r_edge * np.cos(np.radians(-60))],
            'black', linewidth=1.2, zorder=10)
    ax.plot([0, r_edge * np.sin(np.radians(60))],
            [0, r_edge * np.cos(np.radians(60))],
            'black', linewidth=1.2, zorder=10)
    # 外弧
    theta_border = np.linspace(-60, 60, 100)
    theta_border_rad = np.radians(theta_border)
    ax.plot(r_edge * np.sin(theta_border_rad),
            r_edge * np.cos(theta_border_rad),
            'black', linewidth=1.2, zorder=10)

    # ---- 原点 ----
    ax.scatter([0], [0], c='red', s=50, marker='*', zorder=11, edgecolors='darkred')

    ax.set_xlim(-x_lim, x_lim)
    ax.set_ylim(y_bot, y_top)
    ax.set_aspect('equal')
    ax.set_facecolor('white')

    ax.set_xlabel('横向偏移 v (m)', fontsize=10)
    ax.set_ylabel('前向距离 u (m)', fontsize=10)
    ax.set_title(f'{line_name}\n({LINE_LABELS[line_name]})', fontsize=11,
                 fontweight='bold')
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    return im


# ============================================================
# 主流程
# ============================================================
print("=" * 60)
print("二维扇面 RBF 插值 — 扇形图输出")
print("=" * 60)

line_names = ["线1", "线2", "线3", "线4"]

for line_name in line_names:
    filepath = DATA_DIR / f"{line_name}.dat"
    pts = parse_dat(filepath)
    print(f"\n  {line_name}: {len(pts)} 点, k∈[{min(p['k'] for p in pts):.0f}, {max(p['k'] for p in pts):.0f}]")

    uu, vv, kk, mask = rbf_interpolate_fan(pts, grid_res=250)

    fig, ax = plt.subplots(figsize=(9, 10))
    im = plot_fan(uu, vv, kk, mask, pts, line_name, ax)
    cbar = fig.colorbar(im, ax=ax, shrink=0.75, pad=0.03,
                        label='k', ticks=np.arange(550, 710, 10))
    cbar.ax.tick_params(labelsize=9)
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / f"fan2d_{line_name}.png", dpi=200, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    plt.close(fig)
    print(f"    已保存: fan2d_{line_name}.png")

# ============================================================
# 四合一对比图
# ============================================================
print(f"\n  四合一对比图...")
fig, axes = plt.subplots(2, 2, figsize=(14, 15))

for ax, line_name in zip(axes.flat, line_names):
    filepath = DATA_DIR / f"{line_name}.dat"
    pts = parse_dat(filepath)
    uu, vv, kk, mask = rbf_interpolate_fan(pts, grid_res=200)
    im = plot_fan(uu, vv, kk, mask, pts, line_name, ax)

fig.subplots_adjust(right=0.90, wspace=0.30, hspace=0.35)
cbar_ax = fig.add_axes([0.92, 0.12, 0.015, 0.76])
cbar = fig.colorbar(im, cax=cbar_ax, ticks=np.arange(550, 710, 10))
cbar.set_label('k', fontsize=12)
fig.suptitle('四条测线扇面 RBF 插值\n(thin plate spline, 色带 550–700)',
             fontsize=14, fontweight='bold', y=0.98)
fig.savefig(OUTPUT_DIR / "fan2d_all_four.png", dpi=200, bbox_inches='tight',
            facecolor='white', edgecolor='none')
plt.close(fig)
print(f"    已保存: fan2d_all_four.png")

print(f"\n完成, 输出: {OUTPUT_DIR}")

# ============================================================
# 纯净扇面图 (无标注, 用于三维贴图)
# ============================================================
print("\n" + "=" * 60)
print("生成纯净扇面图 (无标注)")
print("=" * 60)

for line_name in line_names:
    filepath = DATA_DIR / f"{line_name}.dat"
    pts = parse_dat(filepath)
    uu, vv, kk, mask = rbf_interpolate_fan(pts, grid_res=300)

    kk_masked = np.where(mask, kk, np.nan)
    v_ext = uu.max() * np.cos(np.radians(30))

    fig, ax = plt.subplots(figsize=(8, 8))
    ax.pcolormesh(vv, uu, kk_masked, cmap=CMAP, norm=NORM,
                  shading='gouraud', rasterized=True)
    ax.contour(vv, uu, kk_masked, levels=np.arange(550, 710, 10),
               colors='black', linewidths=0.3, alpha=0.5)
    ax.set_xlim(-v_ext*1.02, v_ext*1.02)
    ax.set_ylim(-1, uu.max()*1.01)
    ax.set_aspect('equal')
    ax.set_facecolor('white')
    ax.axis('off')

    fig.savefig(OUTPUT_DIR / f"fan_clean_{line_name}.png", dpi=300,
                bbox_inches='tight', facecolor='white', edgecolor='none', pad_inches=0)
    plt.close(fig)
    print(f"    已保存: fan_clean_{line_name}.png")

print(f"\n全部完成, 输出: {OUTPUT_DIR}")
