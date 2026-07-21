"""
瞬变电磁三维建模 — 基于2D扇面RBF结果的三维插值
==================================================
思路:
  1. 对每条线的扇面做2D RBF插值 (密集网格, ~90k点/扇面)
  2. 将扇面每个像素映射到三维坐标: u=d·cosθ(前向), v=d·sinθ(横向), θ=-60°~+60°
     x=u·cosφ, y=v, z=u·sinφ
  3. 汇总四个扇面的密集三维点 (~360k点)
  4. 在三维体素网格上做IDW插值

扫描断面倾角:
  线1: φ=+30° (斜向上顶拱)  线2: φ=+15° (斜向上)
  线3: φ=0°   (水平)        线4: φ=-15° (斜向下底板)

扇形方向: θ=-60°~+60°, 9方向间隔15°, 0°=正前方
"""

import numpy as np
from scipy.interpolate import RBFInterpolator
from scipy.spatial import cKDTree
from scipy import ndimage
from pathlib import Path
import matplotlib.pyplot as plt
from matplotlib.colors import Normalize, LinearSegmentedColormap
import warnings
warnings.filterwarnings('ignore')

DATA_DIR = Path(r"d:\成都院资料\成都院资料\物探数据\02-瞬变电磁\yuanshujv")
OUTPUT_DIR = DATA_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

# 扇形方向: θ=-60°~+60°, 9方向间隔15°, 0°=正前方
DIRECTION_ANGLES = {
    1: -60.0, 2: -45.0, 3: -30.0, 4: -15.0, 5: 0.0,
    6:  15.0, 7:  30.0, 8:  45.0, 9:  60.0,
}

LINE_PHI = {"线1": 30.0, "线2": 15.0, "线3": 0.0, "线4": -15.0}
LINE_LABELS = {"线1": "斜向上30°", "线2": "斜向上15°",
               "线3": "水平方向", "线4": "斜向下15°"}
LINE_COLORS = {"线1": "#e74c3c", "线2": "#f39c12", "线3": "#3498db", "线4": "#2ecc71"}

K_VMIN, K_VMAX = 550, 700
CMAP = LinearSegmentedColormap.from_list('jet_gy_wide', [
    (0.00, '#0033ff'), (0.10, '#0088ff'), (0.18, '#00ccff'),
    (0.25, '#00ee55'), (0.38, '#66ff00'), (0.50, '#ddff00'),
    (0.62, '#ffdd00'), (0.73, '#ff9900'), (0.85, '#ff4400'),
    (1.00, '#ee0000'),
])

plt.rcParams['font.sans-serif'] = ['SimHei', 'Microsoft YaHei', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False


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
            pts.append({"direction_id": d_id, "theta_deg": theta,
                        "distance_m": dist, "k": k,
                        "u": dist * np.cos(theta_rad),
                        "v": dist * np.sin(theta_rad)})
    return pts


def rbf_fan_2d(pts, grid_res=300):
    """对单条线的360个采样点做2D RBF插值, 返回密集网格"""
    known_uv = np.array([[p["u"], p["v"]] for p in pts])
    known_k = np.array([p["k"] for p in pts])

    d_max = max(p["distance_m"] for p in pts) * 1.02
    v_ext = d_max * np.sin(np.radians(60)) * 1.02  # ±60°处横向最大

    u_vals = np.linspace(0.05, d_max, grid_res)
    v_vals = np.linspace(-v_ext, v_ext, grid_res)
    UU, VV = np.meshgrid(u_vals, v_vals)

    rbf = RBFInterpolator(known_uv, known_k, kernel='thin_plate_spline', smoothing=0.0)
    grid_pts = np.column_stack([UU.ravel(), VV.ravel()])
    KK = rbf(grid_pts).reshape(UU.shape)

    # 扇形掩膜
    with np.errstate(divide='ignore', invalid='ignore'):
        fan_angle = np.degrees(np.arctan2(VV, UU))
    dist = np.sqrt(UU**2 + VV**2)
    mask = (np.abs(fan_angle) <= 60.0) & (UU > 0.05) & (dist <= d_max)

    return UU, VV, KK, mask, d_max, v_ext


def fan_to_3d_points(UU, VV, KK, mask, phi_deg):
    """将2D扇面网格映射到3D空间, 返回 (N,3) 坐标和 (N,) k值

    几何: 扫描断面中心射线倾角φ, 扇面在由中心射线+Y轴张成的平面内展开。
      u = 沿中心射线方向的前向距离, v = 扇面内横向距离
      x = u·cos(φ)  — 水平前向分量
      y = v          — 横向不变
      z = u·sin(φ)  — 垂向分量
    """
    phi_rad = np.radians(phi_deg)
    valid = mask.ravel()
    u_flat = UU.ravel()[valid]
    v_flat = VV.ravel()[valid]
    k_flat = KK.ravel()[valid]

    x = u_flat * np.cos(phi_rad)
    y = v_flat
    z = u_flat * np.sin(phi_rad)

    return np.column_stack([x, y, z]), k_flat


# ============================================================
# 步骤1: 每条线做2D RBF插值并映射到3D
# ============================================================
print("=" * 60)
print("步骤 1: 2D RBF扇面插值 → 3D密集点云")
print("=" * 60)

all_xyz = []   # 按扇面分组的3D点列表, 每个元素为 (N_i, 3)
all_k = []     # 按扇面分组的k值列表, 每个元素为 (N_i,)
fan_mesh_info = {}

for line_name, phi in LINE_PHI.items():
    filepath = DATA_DIR / f"{line_name}.dat"
    pts = parse_dat(filepath)
    print(f"  {line_name} ({LINE_LABELS[line_name]}, φ={phi:+.0f}°): "
          f"原始{len(pts)}采样点 → RBF插值中...")

    UU, VV, KK, mask, d_max, v_ext = rbf_fan_2d(pts, grid_res=300)
    xyz, k_vals = fan_to_3d_points(UU, VV, KK, mask, phi)
    all_xyz.append(xyz)
    all_k.append(k_vals)

    fan_mesh_info[line_name] = {
        "UU": UU, "VV": VV, "KK": KK, "mask": mask,
        "d_max": d_max, "v_ext": v_ext, "phi": phi,
    }

    print(f"    → 扇面内 {len(k_vals):,} 个密集点 -> 3D")

# 汇总统计（用于打印和后续可视化）
pts_xyz = np.vstack(all_xyz)
pts_k = np.concatenate(all_k)
n_per_fan = [len(k) for k in all_k]
print(f"\n  总密集点云: {len(pts_k):,} 点 (各扇面: {n_per_fan})")
print(f"  k: min={pts_k.min():.1f}, max={pts_k.max():.1f}, "
      f"mean={pts_k.mean():.1f}, std={pts_k.std():.1f}")
print(f"  X: [{pts_xyz[:,0].min():.1f}, {pts_xyz[:,0].max():.1f}]")
print(f"  Y: [{pts_xyz[:,1].min():.1f}, {pts_xyz[:,1].max():.1f}]")
print(f"  Z: [{pts_xyz[:,2].min():.1f}, {pts_xyz[:,2].max():.1f}]")

# ============================================================
# 步骤2: 三维体素网格 + IDW插值
# ============================================================
print("\n" + "=" * 60)
print("步骤 2: 三维体素网格 IDW 插值")
print("=" * 60)

pad = 3.0
x_min, x_max = pts_xyz[:, 0].min() - pad, pts_xyz[:, 0].max() + pad
y_min, y_max = pts_xyz[:, 1].min() - pad, pts_xyz[:, 1].max() + pad
z_min, z_max = pts_xyz[:, 2].min() - pad, pts_xyz[:, 2].max() + pad

nx, ny, nz = 80, 100, 80
grid_x = np.linspace(x_min, x_max, nx)
grid_y = np.linspace(y_min, y_max, ny)
grid_z = np.linspace(z_min, z_max, nz)
XX, YY, ZZ = np.meshgrid(grid_x, grid_y, grid_z, indexing='ij')

print(f"  体素网格: {nx}×{ny}×{nz} = {nx*ny*nz:,}")
print(f"  X: [{x_min:.1f}, {x_max:.1f}]  Y: [{y_min:.1f}, {y_max:.1f}]  Z: [{z_min:.1f}, {z_max:.1f}]")


def idw_interpolate_balanced(all_xyz_list, all_k_list, grid_pts, power=1.5, k_per_fan=25):
    """逐扇面均衡IDW: 每个扇面贡献k_per_fan个邻居, 统一加权"""
    n_grid = len(grid_pts)
    weighted_sum = np.zeros(n_grid)
    weight_sum = np.zeros(n_grid)

    for fan_idx, (fan_xyz, fan_k) in enumerate(zip(all_xyz_list, all_k_list)):
        tree = cKDTree(fan_xyz)
        dist, idx = tree.query(grid_pts, k=k_per_fan)
        dist = np.maximum(dist, 0.8)
        w = 1.0 / (dist ** power)
        k_vals = fan_k[idx]
        weighted_sum += np.sum(k_vals * w, axis=1)
        weight_sum += np.sum(w, axis=1)

    return weighted_sum / weight_sum


# 分批处理
batch_size = 50000
n_grid = nx * ny * nz
grid_k_flat = np.zeros(n_grid)

grid_pts_full = np.column_stack([XX.ravel(), YY.ravel(), ZZ.ravel()])

print(f"  均衡IDW (共 {n_grid:,} 体素, 每扇面={25}邻居, 4扇面共{4*25}邻居)...")
for start in range(0, n_grid, batch_size):
    end = min(start + batch_size, n_grid)
    grid_pts_batch = grid_pts_full[start:end]
    grid_k_flat[start:end] = idw_interpolate_balanced(all_xyz, all_k, grid_pts_batch)
    if start % 50000 == 0:
        pct = 100 * end / n_grid
        print(f"    {pct:.0f}%...")

grid_k = grid_k_flat.reshape(nx, ny, nz)
print("  完成!")

# 后处理: 3D高斯平滑, 消除残存扇面分界纹路
from scipy.ndimage import gaussian_filter
grid_k = gaussian_filter(grid_k, sigma=0.8)
print(f"  后处理: 3D高斯平滑 (σ=0.8体素) 完成")

# ============================================================
# 步骤3: 保存体素模型
# ============================================================
print("\n" + "=" * 60)
print("步骤 3: 保存体素模型")
print("=" * 60)

# 全分辨率CSV
voxel_csv = OUTPUT_DIR / "tem_voxel_full.csv"
with open(voxel_csv, 'w', encoding='utf-8') as f:
    f.write("x,y,z,k\n")
    for i in range(nx):
        for j in range(ny):
            for ki in range(nz):
                f.write(f"{grid_x[i]:.3f},{grid_y[j]:.3f},{grid_z[ki]:.3f},{grid_k[i,j,ki]:.4f}\n")
print(f"  CSV: {voxel_csv} ({nx*ny*nz:,} 行)")
np.savez(OUTPUT_DIR / "tem_voxel_full.npz",
         grid_k=grid_k, grid_x=grid_x, grid_y=grid_y, grid_z=grid_z)
print(f"  NPZ: {OUTPUT_DIR / 'tem_voxel_full.npz'}")

# ============================================================
# 步骤4: 异常体检测
# ============================================================
print("\n" + "=" * 60)
print("步骤 4: 异常体检测")
print("=" * 60)

k_mean, k_std = pts_k.mean(), pts_k.std()
low_thr = k_mean - k_std
high_thr = k_mean + k_std
print(f"  k均值={k_mean:.1f}, σ={k_std:.1f}")
print(f"  低值异常 k<{low_thr:.1f} (疑似富水/破碎)")
print(f"  高值异常 k>{high_thr:.1f} (完整岩体)")

low_mask = grid_k < low_thr
high_mask = grid_k > high_thr
n_tot = nx * ny * nz
print(f"  低值异常: {low_mask.sum()} 体素 ({100*low_mask.sum()/n_tot:.1f}%)")
print(f"  高值异常: {high_mask.sum()} 体素 ({100*high_mask.sum()/n_tot:.1f}%)")

structure = ndimage.generate_binary_structure(3, 2)
labeled, n_features = ndimage.label(low_mask, structure=structure)
print(f"  低值异常连通区域: {n_features}")

anomalies = []
for lid in range(1, n_features + 1):
    count = (labeled == lid).sum()
    if count >= 8:
        coords = np.where(labeled == lid)
        cx = grid_x[coords[0]].mean()
        cy = grid_y[coords[1]].mean()
        cz = grid_z[coords[2]].mean()
        ka = grid_k[labeled == lid].mean()
        anomalies.append((lid, count, cx, cy, cz, ka))

if anomalies:
    print(f"\n  显著异常体 (≥8体素):")
    for lid, count, cx, cy, cz, ka in sorted(anomalies, key=lambda x: -x[1]):
        print(f"    #{lid}: {count}体素, 中心({cx:.1f},{cy:.1f},{cz:.1f})m, k={ka:.1f}")

# ============================================================
# 步骤4b: 导出OBJ异常体模型
# ============================================================
obj_path = OUTPUT_DIR / "tem_anomaly_bodies.obj"
n_vert = 0
n_face = 0
with open(obj_path, 'w', encoding='utf-8') as f:
    f.write("# TEM 3D Anomaly Bodies\n")
    f.write(f"# Low threshold k < {low_thr:.1f}\n")
    f.write("mtllib tem_anomaly_bodies.mtl\n")
    for lid, count, cx, cy, cz, ka in sorted(anomalies, key=lambda x: -x[1]):
        if count < 100:
            continue
        body_mask = labeled == lid
        coords = np.where(body_mask[::2, ::2, ::2])
        if len(coords[0]) < 10:
            continue
        bx = grid_x[::2][coords[0]]
        by = grid_y[::2][coords[1]]
        bz = grid_z[::2][coords[2]]
        hx = (grid_x[1] - grid_x[0]) * 1.0
        hy = (grid_y[1] - grid_y[0]) * 1.0
        hz = (grid_z[1] - grid_z[0]) * 1.0
        t = np.clip((ka - K_VMIN) / (K_VMAX - K_VMIN), 0, 1)
        r = max(0, min(1, (t - 0.5) * 2))
        g = max(0, min(1, 1 - abs(t - 0.5) * 2))
        b2 = max(0, min(1, (0.5 - t) * 2))
        f.write(f"usemtl anomaly_{lid}\n")
        for vx, vy, vz in zip(bx, by, bz):
            verts = [
                (vx-hx, vy-hy, vz-hz), (vx+hx, vy-hy, vz-hz),
                (vx+hx, vy+hy, vz-hz), (vx-hx, vy+hy, vz-hz),
                (vx-hx, vy-hy, vz+hz), (vx+hx, vy-hy, vz+hz),
                (vx+hx, vy+hy, vz+hz), (vx-hx, vy+hy, vz+hz),
            ]
            base = n_vert + 1
            for v in verts:
                f.write(f"v {v[0]:.2f} {v[1]:.2f} {v[2]:.2f}\n")
            faces = [
                (1,2,6,5), (2,3,7,6), (3,4,8,7), (4,1,5,8),
                (1,4,3,2), (5,6,7,8),
            ]
            for fc in faces:
                a, bb, c, d = [x + base - 1 for x in fc]
                f.write(f"f {a} {bb} {c}\n")
                f.write(f"f {a} {c} {d}\n")
                n_face += 2
            n_vert += 8
        print(f"    OBJ异常体#{lid}: {count}体素→{len(bx)}立方体, k={ka:.1f}")

mtl_path = OUTPUT_DIR / "tem_anomaly_bodies.mtl"
with open(mtl_path, 'w', encoding='utf-8') as f:
    for lid, count, cx, cy, cz, ka in sorted(anomalies, key=lambda x: -x[1]):
        if count < 100:
            continue
        t = np.clip((ka - K_VMIN) / (K_VMAX - K_VMIN), 0, 1)
        r = max(0, min(1, (t - 0.5) * 2))
        g = max(0, min(1, 1 - abs(t - 0.5) * 2))
        b2 = max(0, min(1, (0.5 - t) * 2))
        f.write(f"newmtl anomaly_{lid}\n")
        f.write(f"Kd {r:.3f} {g:.3f} {b2:.3f}\n")
        f.write(f"d 0.85\n\n")

print(f"  OBJ: {obj_path} (顶点{n_vert}, 面{n_face})")
print(f"  MTL: {mtl_path}")

# ============================================================
# 步骤5: 三维可视化
# ============================================================
print("\n" + "=" * 60)
print("步骤 5: 三维可视化")
print("=" * 60)

norm = Normalize(vmin=K_VMIN, vmax=K_VMAX)

# --- 图1: 密集点云三维分布 (下采样显示) ---
print("  图1: 密集点云分布...")
fig = plt.figure(figsize=(14, 11))
ax = fig.add_subplot(111, projection='3d')
sample_step = 20
ax.scatter(pts_xyz[::sample_step, 0], pts_xyz[::sample_step, 1],
           pts_xyz[::sample_step, 2], c=pts_k[::sample_step],
           cmap=CMAP, norm=norm, s=2, alpha=0.6)
ax.scatter([0], [0], [0], c='black', s=80, marker='*', label='掌子面中心')
ax.set_xlabel('X 前向 (m)'); ax.set_ylabel('Y 横向 (m)'); ax.set_zlabel('Z 垂向 (m)')
ax.set_title(f'RBF扇面密集点云 (下采样1/{sample_step}, {len(pts_k)//sample_step:,}点)')
fig.colorbar(plt.cm.ScalarMappable(norm=norm, cmap=CMAP), ax=ax, shrink=0.5)
ax.view_init(elev=20, azim=-55)
fig.savefig(OUTPUT_DIR / "fig3d_1_dense_cloud.png", dpi=200, bbox_inches='tight')
plt.close(fig)

# --- 图2: 三正交切片 ---
print("  图2: 正交切片...")
fig, axes = plt.subplots(1, 3, figsize=(18, 5))

iz_mid = np.argmin(np.abs(grid_z))
im0 = axes[0].imshow(grid_k[:, :, iz_mid].T, origin='lower', cmap=CMAP, norm=norm,
                      extent=[grid_y[0], grid_y[-1], grid_x[0], grid_x[-1]], aspect='auto')
axes[0].set_xlabel('Y 横向 (m)'); axes[0].set_ylabel('X 前向 (m)')
axes[0].set_title(f'XY 俯视 (Z≈{grid_z[iz_mid]:.1f}m)')
plt.colorbar(im0, ax=axes[0], shrink=0.8)

iy_mid = np.argmin(np.abs(grid_y))
im1 = axes[1].imshow(grid_k[:, iy_mid, :].T, origin='lower', cmap=CMAP, norm=norm,
                      extent=[grid_x[0], grid_x[-1], grid_z[0], grid_z[-1]], aspect='auto')
axes[1].set_xlabel('X 前向 (m)'); axes[1].set_ylabel('Z 垂向 (m)')
axes[1].set_title(f'XZ 侧视 (Y≈0m)')
plt.colorbar(im1, ax=axes[1], shrink=0.8)

ix30 = np.argmin(np.abs(grid_x - 30))
im2 = axes[2].imshow(grid_k[ix30, :, :].T, origin='lower', cmap=CMAP, norm=norm,
                      extent=[grid_y[0], grid_y[-1], grid_z[0], grid_z[-1]], aspect='auto')
axes[2].set_xlabel('Y 横向 (m)'); axes[2].set_ylabel('Z 垂向 (m)')
axes[2].set_title(f'YZ 断面 (X≈30m)')
plt.colorbar(im2, ax=axes[2], shrink=0.8)

fig.suptitle('三维体素模型 — 正交切片', fontsize=14, fontweight='bold')
fig.tight_layout()
fig.savefig(OUTPUT_DIR / "fig3d_2_slices.png", dpi=200, bbox_inches='tight')
plt.close(fig)

# --- 图3: 多深度断面 ---
print("  图3: 多深度断面...")
depths = [10, 20, 30, 40, 50]
fig, axes = plt.subplots(1, 5, figsize=(22, 4.5))
for idx, d in enumerate(depths):
    ax = axes[idx]
    ix = np.argmin(np.abs(grid_x - d))
    s = grid_k[ix, :, :].T
    im = ax.imshow(s, origin='lower', cmap=CMAP, norm=norm,
                    extent=[grid_y[0], grid_y[-1], grid_z[0], grid_z[-1]], aspect='auto')
    ax.set_xlabel('Y (m)'); ax.set_ylabel('Z (m)')
    ax.set_title(f'X={grid_x[ix]:.1f}m')
    plt.colorbar(im, ax=ax, shrink=0.8)
fig.suptitle('不同前向距离 YZ 断面', fontsize=14, fontweight='bold')
fig.tight_layout()
fig.savefig(OUTPUT_DIR / "fig3d_3_depth_slices.png", dpi=200, bbox_inches='tight')
plt.close(fig)

# --- 图4: 异常体 ---
print("  图4: 异常体三维...")
fig = plt.figure(figsize=(14, 11))
ax = fig.add_subplot(111, projection='3d')

step = 3
lc = np.where(low_mask[::step, ::step, ::step])
lx = grid_x[::step][lc[0]]; ly = grid_y[::step][lc[1]]; lz = grid_z[::step][lc[2]]
hc = np.where(high_mask[::step, ::step, ::step])
hx = grid_x[::step][hc[0]]; hy = grid_y[::step][hc[1]]; hz = grid_z[::step][hc[2]]

if len(lx) > 0:
    ax.scatter(lx, ly, lz, c='blue', s=15, alpha=0.6,
               label=f'低值异常 k<{low_thr:.0f}')
if len(hx) > 0:
    ax.scatter(hx, hy, hz, c='red', s=8, alpha=0.3,
               label=f'高值区 k>{high_thr:.0f}')

ax.scatter(pts_xyz[::30, 0], pts_xyz[::30, 1], pts_xyz[::30, 2],
           c='gray', s=1, alpha=0.12)
ax.set_xlabel('X 前向 (m)'); ax.set_ylabel('Y 横向 (m)'); ax.set_zlabel('Z 垂向 (m)')
ax.set_title('三维异常体检测 (基于RBF扇面密集点云)')
ax.legend(fontsize=8)
ax.view_init(elev=20, azim=-55)
fig.savefig(OUTPUT_DIR / "fig3d_4_anomaly.png", dpi=200, bbox_inches='tight')
plt.close(fig)

# ============================================================
# 汇总
# ============================================================
print("\n" + "=" * 60)
print("三维建模完成!")
print("=" * 60)
for f in sorted(OUTPUT_DIR.glob("fig3d_*")):
    print(f"  {f.name} ({f.stat().st_size/1024:.0f} KB)")
for f in sorted(OUTPUT_DIR.glob("tem_*")):
    print(f"  {f.name} ({f.stat().st_size/1024:.0f} KB)")
