"""
从体素模型提取等值面, 导出 OBJ 三维实体 (可在任何3D软件中打开)
"""
import numpy as np
from pathlib import Path
from scipy import ndimage
from skimage import measure

DATA_DIR = Path(r'd:/成都院资料/成都院资料/物探数据/02-瞬变电磁/yuanshujv')
OUTPUT_DIR = DATA_DIR / 'output'

model = np.load(str(OUTPUT_DIR / 'tem_voxel_full.npz'))
grid_k = model['grid_k']  # (nx, ny, nz)
grid_x = model['grid_x']
grid_y = model['grid_y']
grid_z = model['grid_z']

nx, ny, nz = grid_k.shape
print(f'Grid: {nx}x{ny}x{nz}')
print(f'X: [{grid_x[0]:.1f}, {grid_x[-1]:.1f}]')
print(f'Y: [{grid_y[0]:.1f}, {grid_y[-1]:.1f}]')
print(f'Z: [{grid_z[0]:.1f}, {grid_z[-1]:.1f}]')

# 使用与 tem_3d_model.py 一致的阈值 (基于原始数据统计)
low_thr = 586.0   # k_mean - k_std (原始采样点)
high_thr = 639.1  # k_mean + k_std (原始采样点)
print(f'k range: [{grid_k.min():.1f}, {grid_k.max():.1f}]')
print(f'Low anomaly: k<{low_thr:.1f}, High anomaly: k>{high_thr:.1f}')


def export_obj(verts, faces, filepath, name="anomaly"):
    """Export a mesh as OBJ file"""
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(f"# TEM 3D Model - {name}\n")
        f.write(f"# {len(verts)} vertices, {len(faces)} faces\n")
        f.write(f"o {name}\n")
        for v in verts:
            f.write(f"v {v[0]:.4f} {v[1]:.4f} {v[2]:.4f}\n")
        for face in faces:
            f.write(f"f {face[0]+1} {face[1]+1} {face[2]+1}\n")
    return len(verts), len(faces)


# ---- Isosurface at low anomaly threshold ----
print('\nExtracting low-k isosurface (marching cubes)...')
# Smooth slightly for cleaner mesh
gk_smooth = ndimage.gaussian_filter(grid_k, sigma=0.5)

spacing = (
    float(grid_x[1] - grid_x[0]),
    float(grid_y[1] - grid_y[0]),
    float(grid_z[1] - grid_z[0]),
)

# Low anomaly isosurface
verts, faces, _, _ = measure.marching_cubes(
    gk_smooth, level=low_thr, spacing=spacing)
# Shift to correct origin
verts[:, 0] += float(grid_x[0])
verts[:, 1] += float(grid_y[0])
verts[:, 2] += float(grid_z[0])
n_v, n_f = export_obj(verts, faces, OUTPUT_DIR / 'anomaly_low.obj', 'low_anomaly')
print(f'  Low anomaly OBJ: {n_v} vertices, {n_f} faces -> anomaly_low.obj')

# High anomaly isosurface
verts_h, faces_h, _, _ = measure.marching_cubes(
    gk_smooth, level=high_thr, spacing=spacing)
verts_h[:, 0] += float(grid_x[0])
verts_h[:, 1] += float(grid_y[0])
verts_h[:, 2] += float(grid_z[0])
n_vh, n_fh = export_obj(verts_h, faces_h, OUTPUT_DIR / 'anomaly_high.obj', 'high_anomaly')
print(f'  High anomaly OBJ: {n_vh} vertices, {n_fh} faces -> anomaly_high.obj')

# ---- Combined scene with k-value coloring ----
print('\nBuilding colored PLY for full scene...')

# Sample the grid for a colored PLY
step = 2
xi, yi, zi = np.meshgrid(
    np.arange(0, nx, step),
    np.arange(0, ny, step),
    np.arange(0, nz, step),
    indexing='ij'
)
x_flat = grid_x[xi.ravel()]
y_flat = grid_y[yi.ravel()]
z_flat = grid_z[zi.ravel()]
k_flat = grid_k[xi.ravel(), yi.ravel(), zi.ravel()]

# Color mapping: blue (low) to red (high)
k_norm = (k_flat - 550) / (700 - 550)
k_norm = np.clip(k_norm, 0, 1)
r = k_norm
g = 1.0 - np.abs(k_norm - 0.5) * 2.0
b = 1.0 - k_norm

ply_path = OUTPUT_DIR / 'tem_voxel_colored.ply'
with open(ply_path, 'w', encoding='utf-8') as f:
    f.write("ply\nformat ascii 1.0\n")
    f.write(f"element vertex {len(x_flat)}\n")
    f.write("property float x\nproperty float y\nproperty float z\n")
    f.write("property uchar red\nproperty uchar green\nproperty uchar blue\n")
    f.write("property float k\n")
    f.write("end_header\n")
    for i in range(len(x_flat)):
        f.write(f"{x_flat[i]:.3f} {y_flat[i]:.3f} {z_flat[i]:.3f} "
                f"{int(r[i]*255)} {int(g[i]*255)} {int(b[i]*255)} {k_flat[i]:.2f}\n")
print(f'  Colored PLY: {len(x_flat):,} points -> tem_voxel_colored.ply')

# ---- Per-slice XYZ grids (for Surfer/Voxler) ----
print('\nExporting per-slice XYZ grids...')
slice_dir = OUTPUT_DIR / 'slices_xyz'
slice_dir.mkdir(exist_ok=True)
for ki in range(0, nz, 5):  # every 5th slice
    z_val = grid_z[ki]
    with open(slice_dir / f'slice_z{z_val:+.1f}.xyz', 'w', encoding='utf-8') as f:
        f.write("x,y,k\n")
        for i in range(nx):
            for j in range(ny):
                f.write(f"{grid_x[i]:.3f},{grid_y[j]:.3f},{grid_k[i,j,ki]:.4f}\n")
print(f'  {nz//5 + 1} slice XYZ grids -> {slice_dir}/')

print('\nDone!')
print('\n=== 导出文件 ===')
print('  anomaly_low.obj       - 低值异常体三维实体 (导入任意3D软件即为实体)')
print('  anomaly_high.obj      - 高值异常体三维实体')
print('  tem_voxel_colored.ply - 彩色体素点云 (CloudCompare 原生支持)')
print(f'  {slice_dir}/          - 逐层 XYZ 网格切片')
