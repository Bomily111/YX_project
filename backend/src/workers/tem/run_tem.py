"""
TEM 处理 CLI 入口 — 供 Node.js 后端子进程调用
================================================
用法: python run_tem.py --input <dat_dir> --job-id <uuid> --output <public_dir>

进度协议（通过 stdout 输出）:
  PROGRESS:<0-100>   — 进度百分比
  LOG:<消息>          — 日志行
  COMPLETE            — 处理成功
  ERROR:<消息>        — 处理失败
"""

import sys
import os
import json
import argparse
import shutil
import numpy as np
from pathlib import Path
from scipy.interpolate import RBFInterpolator
from scipy.spatial import cKDTree
from scipy import ndimage
from scipy.ndimage import gaussian_filter
import traceback

# ── 配置 (与 tem_3d_model.py 一致) ─────────────────────
DIRECTION_ANGLES = {
    1: -60.0, 2: -45.0, 3: -30.0, 4: -15.0, 5: 0.0,
    6: 15.0, 7: 30.0, 8: 45.0, 9: 60.0,
}
LINE_PHI = {"线1": 30.0, "线2": 15.0, "线3": 0.0, "线4": -15.0}
K_VMIN, K_VMAX = 550, 700


def log(msg: str):
    print(f"LOG:{msg}", flush=True)


def progress(n: int):
    print(f"PROGRESS:{n}", flush=True)


def complete():
    print("COMPLETE", flush=True)


def error(msg: str):
    print(f"ERROR:{msg}", flush=True)
    sys.exit(1)


# ── 数据解析 ──────────────────────────────────────────
def parse_dat(filepath: str) -> list:
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


# ── 2D RBF 扇面插值 ──────────────────────────────────
def rbf_fan_2d(pts: list, grid_res: int = 300):
    known_uv = np.array([[p["u"], p["v"]] for p in pts])
    known_k = np.array([p["k"] for p in pts])
    d_max = max(p["distance_m"] for p in pts) * 1.02
    v_ext = d_max * np.sin(np.radians(60)) * 1.02
    u_vals = np.linspace(0.05, d_max, grid_res)
    v_vals = np.linspace(-v_ext, v_ext, grid_res)
    UU, VV = np.meshgrid(u_vals, v_vals)
    rbf = RBFInterpolator(known_uv, known_k, kernel='thin_plate_spline', smoothing=0.0)
    grid_pts = np.column_stack([UU.ravel(), VV.ravel()])
    KK = rbf(grid_pts).reshape(UU.shape)
    with np.errstate(divide='ignore', invalid='ignore'):
        fan_angle = np.degrees(np.arctan2(VV, UU))
    dist = np.sqrt(UU ** 2 + VV ** 2)
    mask = (np.abs(fan_angle) <= 60.0) & (UU > 0.05) & (dist <= d_max)
    return UU, VV, KK, mask, d_max, v_ext


# ── 扇面 → 3D 映射 ────────────────────────────────────
def fan_to_3d_points(UU, VV, KK, mask, phi_deg: float):
    phi_rad = np.radians(phi_deg)
    valid = mask.ravel()
    u_flat = UU.ravel()[valid]
    v_flat = VV.ravel()[valid]
    k_flat = KK.ravel()[valid]
    x = u_flat * np.cos(phi_rad)
    y = v_flat
    z = u_flat * np.sin(phi_rad)
    return np.column_stack([x, y, z]), k_flat


# ── IDW 插值 ──────────────────────────────────────────
def idw_interpolate_balanced(all_xyz_list, all_k_list, grid_pts,
                              power: float = 1.5, k_per_fan: int = 25):
    n_grid = len(grid_pts)
    weighted_sum = np.zeros(n_grid)
    weight_sum = np.zeros(n_grid)
    for fan_xyz, fan_k in zip(all_xyz_list, all_k_list):
        tree = cKDTree(fan_xyz)
        dist, idx = tree.query(grid_pts, k=k_per_fan)
        dist = np.maximum(dist, 0.8)
        w = 1.0 / (dist ** power)
        k_vals = fan_k[idx]
        weighted_sum += np.sum(k_vals * w, axis=1)
        weight_sum += np.sum(w, axis=1)
    return weighted_sum / weight_sum


# ── 格式转换: 体素 → raw volume + model.json ──────────
def export_platform_format(grid_k, grid_x, grid_y, grid_z, output_dir: Path):
    log("转换体积数据为平台格式...")

    # 重采样到 128³
    from scipy.ndimage import zoom as scipy_zoom
    zoom_factors = (128 / grid_k.shape[0], 128 / grid_k.shape[1], 128 / grid_k.shape[2])
    k_resized = scipy_zoom(grid_k.astype(np.float64), zoom_factors, order=1)

    # 写 raw 文件
    raw_path = output_dir / "tem_volume.raw"
    k_resized.astype(np.float32).tofile(raw_path)
    log(f"RAW volume: {raw_path} ({k_resized.size} voxels)")

    # 物理范围
    x_span = float(grid_x[-1] - grid_x[0])
    y_span = float(grid_y[-1] - grid_y[0])
    z_span = float(grid_z[-1] - grid_z[0])

    # 生成 model.json
    model = {
        "properties": {"background": "rgba(0,0,0,0)", "nogui": True},
        "objects": [{
            "volume": {
                "url": f"data/tem_output/{output_dir.name}/tem_volume.raw",
                "res": [128, 128, 128],
                "scale": [round(x_span, 2), round(y_span, 2), round(z_span, 2)],
                "autoscale": True,
                "density": 5.0,
                "power": 1.5,
                "isovalue": 0.3,
                "tricubicfilter": True,
                "usecolourmap": True,
            },
            "samples": 256,
            "colour": [0, 70, 200],
        }],
        "colourmaps": [{
            "colours": [
                [0.0, [0.0, 0.8, 1.0, 0.0]],
                [0.2, [0.0, 0.6, 1.0, 0.3]],
                [0.4, [0.0, 0.4, 0.8, 0.5]],
                [0.6, [1.0, 0.8, 0.0, 0.6]],
                [0.8, [1.0, 0.4, 0.0, 0.7]],
                [1.0, [1.0, 0.0, 0.0, 0.9]],
            ]
        }],
    }

    model_path = output_dir / "tem_model.json"
    with open(model_path, 'w', encoding='utf-8') as f:
        json.dump(model, f, indent=2, ensure_ascii=False)
    log(f"Model JSON: {model_path}")

    return model_path, raw_path


# ── 主流程 ────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True, help='Directory containing 线1~4.dat')
    parser.add_argument('--job-id', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()

    input_dir = Path(args.input)
    output_root = Path(args.output)
    job_output_dir = output_root / args.job_id
    job_output_dir.mkdir(parents=True, exist_ok=True)

    try:
        # Step 1: 解析 + RBF 扇面插值 (进度 0→40%)
        log("开始处理瞬变电磁数据...")
        # 诊断：列出输入目录中的所有文件
        input_files = sorted(input_dir.glob("*.dat"))
        log(f"输入目录: {input_dir}")
        log(f"找到 {len(input_files)} 个 dat 文件: {[f.name for f in input_files]}")
        progress(5)

        if len(input_files) == 0:
            error(f"输入目录中未找到 .dat 文件: {input_dir}")

        # 按文件名中的数字编号排序匹配到 LINE_PHI
        import re
        file_map = {}
        for f in input_files:
            m = re.search(r'(\d+)', f.name)
            if m:
                key = f"线{m.group(1)}"
                if key in LINE_PHI:
                    file_map[key] = f
        log(f"匹配到测线: {list(file_map.keys())}")

        all_xyz, all_k = [], []
        for line_name, phi in LINE_PHI.items():
            if line_name not in file_map:
                error(f"缺少文件: {line_name}.dat (可用文件: {[f.name for f in input_files]})")
            filepath = file_map[line_name]
            pts = parse_dat(str(filepath))
            log(f"{line_name} (φ={phi:+.0f}°): {len(pts)} 采样点 → RBF 插值...")
            UU, VV, KK, mask, d_max, v_ext = rbf_fan_2d(pts, grid_res=300)
            xyz, k_vals = fan_to_3d_points(UU, VV, KK, mask, phi)
            all_xyz.append(xyz)
            all_k.append(k_vals)
            log(f"  扇面内 {len(k_vals):,} 密集点 → 3D")

        progress(35)

        pts_xyz = np.vstack(all_xyz)
        pts_k = np.concatenate(all_k)
        log(f"总密集点云: {len(pts_k):,} 点")
        log(f"k: min={pts_k.min():.1f}, max={pts_k.max():.1f}, mean={pts_k.mean():.1f}")

        # Step 2: 三维体素 IDW 插值 (进度 40→70%)
        pad = 3.0
        x_min = pts_xyz[:, 0].min() - pad
        x_max = pts_xyz[:, 0].max() + pad
        y_min = pts_xyz[:, 1].min() - pad
        y_max = pts_xyz[:, 1].max() + pad
        z_min = pts_xyz[:, 2].min() - pad
        z_max = pts_xyz[:, 2].max() + pad

        nx, ny, nz = 80, 100, 80
        grid_x = np.linspace(x_min, x_max, nx)
        grid_y = np.linspace(y_min, y_max, ny)
        grid_z = np.linspace(z_min, z_max, nz)
        XX, YY, ZZ = np.meshgrid(grid_x, grid_y, grid_z, indexing='ij')

        log(f"体素网格: {nx}×{ny}×{nz} = {nx*ny*nz:,}")
        progress(40)

        batch_size = 50000
        n_grid = nx * ny * nz
        grid_pts_full = np.column_stack([XX.ravel(), YY.ravel(), ZZ.ravel()])
        grid_k_flat = np.zeros(n_grid)

        for start in range(0, n_grid, batch_size):
            end = min(start + batch_size, n_grid)
            grid_pts_batch = grid_pts_full[start:end]
            grid_k_flat[start:end] = idw_interpolate_balanced(
                all_xyz, all_k, grid_pts_batch)
            if start % 100000 == 0:
                pct = 40 + int(30 * end / n_grid)
                progress(pct)

        grid_k = grid_k_flat.reshape(nx, ny, nz)
        grid_k = gaussian_filter(grid_k, sigma=0.8)
        log("3D 高斯平滑完成")
        progress(75)

        # Step 3: 异常体检测 (进度 75→85%)
        k_mean, k_std = pts_k.mean(), pts_k.std()
        low_thr = 570
        high_thr = k_mean + k_std
        log(f"k均值={k_mean:.1f}, σ={k_std:.1f}, k≈570 等值面阈值")

        low_mask = grid_k < low_thr
        structure = ndimage.generate_binary_structure(3, 2)
        labeled, n_features = ndimage.label(low_mask, structure=structure)
        log(f"低值异常连通区域: {n_features}")

        # 统计显著异常体
        anomalies = []
        for lid in range(1, n_features + 1):
            count = (labeled == lid).sum()
            if count >= 100:
                coords = np.where(labeled == lid)
                cx = grid_x[coords[0]].mean()
                cy = grid_y[coords[1]].mean()
                cz = grid_z[coords[2]].mean()
                ka = grid_k[labeled == lid].mean()
                anomalies.append((lid, count, cx, cy, cz, ka))

        if anomalies:
            log(f"显著异常体 (≥100体素): {len(anomalies)} 个")
            for lid, count, cx, cy, cz, ka in sorted(anomalies, key=lambda x: -x[1])[:5]:
                log(f"  #{lid}: {count}体素, 中心({cx:.1f},{cy:.1f},{cz:.1f})m, k={ka:.1f}")

        progress(85)

        # Step 4: 导出平台格式 (进度 85→95%)
        export_platform_format(grid_k, grid_x, grid_y, grid_z, job_output_dir)
        progress(95)

        # 保存原始体素数据 (CSV)
        csv_path = job_output_dir / "tem_voxel_full.csv"
        with open(csv_path, 'w', encoding='utf-8') as f:
            f.write("x,y,z,k\n")
            for i in range(nx):
                for j in range(ny):
                    for ki in range(nz):
                        f.write(f"{grid_x[i]:.3f},{grid_y[j]:.3f},{grid_z[ki]:.3f},{grid_k[i,j,ki]:.4f}\n")
        log(f"CSV: {csv_path}")

        # ── 输出 1: 多深度断面 PNG ──────────────────────
        log("生成多深度断面图...")
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        from matplotlib.colors import Normalize, LinearSegmentedColormap
        cmap = LinearSegmentedColormap.from_list('jet_gy', [
            (0.0, '#0033ff'), (0.25, '#00cc55'), (0.5, '#ddff00'),
            (0.75, '#ff8800'), (1.0, '#ee0000'),
        ])
        norm = Normalize(vmin=K_VMIN, vmax=K_VMAX)
        slice_depths = [10, 20, 30, 40, 50]
        for d in slice_depths:
            ix = np.argmin(np.abs(grid_x - d))
            fig, ax = plt.subplots(figsize=(3, 2.5))
            im = ax.imshow(grid_k[ix, :, :].T, origin='lower', cmap=cmap, norm=norm,
                           extent=[grid_y[0], grid_y[-1], grid_z[0], grid_z[-1]], aspect='auto')
            ax.set_title(f'X={grid_x[ix]:.1f}m')
            fig.colorbar(im, ax=ax, shrink=0.8)
            fig.savefig(job_output_dir / f"slice_x{d:.0f}m.png", dpi=100, bbox_inches='tight')
            plt.close(fig)
        log(f"断面图: {len(slice_depths)} 张")

        # ── 输出 2: 异常体 OBJ 模型 ────────────────────
        log("生成异常体三维模型...")
        try:
            from skimage import measure
            # 下采样体素以便 marching cubes 产生合理网格
            ds = 2
            gk_ds = grid_k[::ds, ::ds, ::ds]
            gx_ds = grid_x[::ds]
            gy_ds = grid_y[::ds]
            gz_ds = grid_z[::ds]
            verts, faces, _, _ = measure.marching_cubes(gk_ds, level=low_thr, spacing=(
                gx_ds[1] - gx_ds[0], gy_ds[1] - gy_ds[0], gz_ds[1] - gz_ds[0]))
            # 偏移到实际坐标
            verts[:, 0] += gx_ds[0]
            verts[:, 1] += gy_ds[0]
            verts[:, 2] += gz_ds[0]
            obj_path = job_output_dir / "anomaly_bodies.obj"
            with open(obj_path, 'w', encoding='utf-8') as f:
                f.write("# TEM Anomaly Isosurface\n")
                for v in verts:
                    f.write(f"v {v[0]:.3f} {v[1]:.3f} {v[2]:.3f}\n")
                for fc in faces:
                    f.write(f"f {fc[0]+1} {fc[1]+1} {fc[2]+1}\n")
            log(f"OBJ: {obj_path} ({len(verts)} 顶点, {len(faces)} 面)")
        except Exception as e:
            log(f"异常体 OBJ 生成失败（可忽略）: {e}")

        # ── 输出 3: 四线剖面数据 JSON ─────────────────
        log("导出剖面曲线数据...")
        profile_data = {"profiles": {}, "k_range": [float(K_VMIN), float(K_VMAX)]}
        for line_name, phi in LINE_PHI.items():
            if line_name not in file_map:
                continue
            pts = parse_dat(str(file_map[line_name]))
            dir_groups = {}
            for p in pts:
                dk = f"{p['direction_id']}({p['theta_deg']:+.0f}°)"
                if dk not in dir_groups:
                    dir_groups[dk] = []
                dir_groups[dk].append([p["distance_m"], p["k"]])
            # 每方向按距离排序
            profile_data["profiles"][line_name] = {
                "phi": LINE_PHI[line_name],
                "label": f"φ={LINE_PHI[line_name]:+.0f}°",
                "dirs": {k: sorted(v, key=lambda x: x[0]) for k, v in dir_groups.items()},
            }
        with open(job_output_dir / "line_profiles.json", 'w', encoding='utf-8') as f:
            json.dump(profile_data, f, indent=2, ensure_ascii=False)
        log(f"剖面数据: {job_output_dir / 'line_profiles.json'}")

        # ── 输出 4: 带等值线扇面图（参照 tem_fan2d_rbf.py 的 plot_fan 方法）──
        log("生成带等值线扇面图...")
        from matplotlib.colors import ListedColormap, BoundaryNorm as BNorm
        fan_levels = np.arange(550, 705, 5)
        fan_cmap = ListedColormap(cmap(np.linspace(0, 1, len(fan_levels) - 1)))
        fan_norm = BNorm(fan_levels, ncolors=fan_cmap.N, clip=True)

        DIRECTION_ANGLES2 = {1: -60, 2: -45, 3: -30, 4: -15, 5: 0, 6: 15, 7: 30, 8: 45, 9: 60}

        for line_name in LINE_PHI.keys():
            if line_name not in file_map:
                continue
            pts = parse_dat(str(file_map[line_name]))
            uu, vv, kk, mask, d_max, v_ext = rbf_fan_2d(pts, grid_res=250)
            kk_masked = np.where(mask, kk, np.nan)
            r_edge = uu.max()
            v_ext = r_edge * np.cos(np.radians(30))
            x_lim = v_ext * 1.08
            y_bot, y_top = -2.0, r_edge * 1.05

            fig, ax = plt.subplots(figsize=(8, 9))
            ax.fill_between([-x_lim, x_lim], y_bot, y_top, color='white', zorder=0)
            ax.pcolormesh(vv, uu, kk_masked, cmap=fan_cmap, norm=fan_norm,
                          shading='gouraud', rasterized=True, zorder=1)
            ax.contour(vv, uu, kk_masked, levels=np.arange(550, 710, 10),
                       colors='black', linewidths=0.3, alpha=0.5, zorder=2)
            # 采样点
            sv = np.array([[p["v"], p["u"]] for p in pts])
            ax.scatter(sv[:, 0], sv[:, 1], c='black', s=2, zorder=5, alpha=0.5)
            # 方向射线
            for deg in DIRECTION_ANGLES2.values():
                rad = np.radians(deg)
                ax.plot([0, r_edge * np.sin(rad)], [0, r_edge * np.cos(rad)],
                        'gray', linewidth=0.3, alpha=0.3, linestyle='--', zorder=3)
            # 距离弧线
            for rl in [15, 30, 45]:
                if rl > r_edge: continue
                ta = np.linspace(-60, 60, 80)
                tar = np.radians(ta)
                ax.plot(rl * np.sin(tar), rl * np.cos(tar),
                        'gray', linewidth=0.3, alpha=0.3, zorder=3)
            # 扇形边框
            for a in [-60, 60]:
                ax.plot([0, r_edge * np.sin(np.radians(a))],
                        [0, r_edge * np.cos(np.radians(a))], 'black', linewidth=1.2, zorder=10)
            tb = np.linspace(-60, 60, 100); tbr = np.radians(tb)
            ax.plot(r_edge * np.sin(tbr), r_edge * np.cos(tbr), 'black', linewidth=1.2, zorder=10)
            ax.scatter([0], [0], c='red', s=50, marker='*', zorder=11, edgecolors='darkred')
            ax.set_xlim(-x_lim, x_lim); ax.set_ylim(y_bot, y_top)
            ax.set_aspect('equal'); ax.set_facecolor('white')
            ax.set_xlabel('横向偏移 v (m)', fontsize=10)
            ax.set_ylabel('前向距离 u (m)', fontsize=10)
            ax.set_title(f'{line_name} (φ={LINE_PHI[line_name]:+.0f}°)', fontsize=11, fontweight='bold')
            ax.spines['top'].set_visible(False); ax.spines['right'].set_visible(False)
            label = line_name.replace('线', 'line')
            fig.savefig(job_output_dir / f"fan_contour_{label}.png", dpi=150,
                        bbox_inches='tight', facecolor='white', edgecolor='none')
            plt.close(fig)
        log(f"等值线扇面图: {len(LINE_PHI)} 张")

        # ── 输出 5: k≈570 等值面 GLB ──────────────────
        log("生成 k≈570 等值面模型...")
        try:
            ds = 2
            gk_ds = grid_k[::ds, ::ds, ::ds]
            gx_ds = grid_x[::ds]; gy_ds = grid_y[::ds]; gz_ds = grid_z[::ds]
            dx = gx_ds[1] - gx_ds[0]; dy = gy_ds[1] - gy_ds[0]; dz = gz_ds[1] - gz_ds[0]
            verts, faces, _, _ = measure.marching_cubes(gk_ds, level=570, spacing=(dx, dy, dz))
            verts[:, 0] += gx_ds[0]; verts[:, 1] += gy_ds[0]; verts[:, 2] += gz_ds[0]
            import trimesh
            mesh = trimesh.Trimesh(vertices=verts, faces=faces)
            glb_path = job_output_dir / "anomaly_k570_4x.glb"
            mesh.export(str(glb_path))
            log(f"GLB: {glb_path} ({len(verts)} 顶点, {len(faces)} 面)")
        except Exception as e:
            log(f"等值面 GLB 生成失败（可忽略）: {e}")

        # ── 输出 6: anomaly_bodies.csv ───────────────
        csv_anomaly_path = job_output_dir / "anomaly_bodies.csv"
        with open(csv_anomaly_path, 'w', encoding='utf-8') as f:
            f.write("id,voxels,cx,cy,cz,k_mean\n")
            for lid, cnt, cx, cy, cz, ka in sorted(anomalies, key=lambda x: -x[1]):
                f.write(f"{int(lid)},{int(cnt)},{cx:.2f},{cy:.2f},{cz:.2f},{ka:.1f}\n")
        log(f"异常体 CSV: {csv_anomaly_path}")

        # ── 输出 7: fig3d_1_dense_cloud.png ──────────
        log("生成密集点云分布图...")
        fig = plt.figure(figsize=(8, 6))
        ax = fig.add_subplot(111, projection='3d')
        sample = 20
        ax.scatter(pts_xyz[::sample, 0], pts_xyz[::sample, 1], pts_xyz[::sample, 2],
                   c=pts_k[::sample], cmap=cmap, norm=norm, s=2, alpha=0.6)
        ax.scatter([0], [0], [0], c='white', s=60, marker='*', label='掌子面中心')
        ax.set_xlabel('X (m)'); ax.set_ylabel('Y (m)'); ax.set_zlabel('Z (m)')
        ax.set_title('RBF Dense Point Cloud')
        ax.view_init(elev=20, azim=-55)
        fig.savefig(job_output_dir / "fig3d_1_dense_cloud.png", dpi=150, bbox_inches='tight')
        plt.close(fig)
        log("密集点云图已生成")

        # ── 输出 8: fig3d_3_depth_slices.png ─────────
        log("生成多深度断面合并图...")
        slice_depths_multi = [10, 20, 30, 40, 50]
        fig, axes = plt.subplots(1, len(slice_depths_multi), figsize=(16, 3.5))
        for idx, d in enumerate(slice_depths_multi):
            ax = axes[idx]
            ix = np.argmin(np.abs(grid_x - d))
            s = grid_k[ix, :, :].T
            im = ax.imshow(s, origin='lower', cmap=cmap, norm=norm,
                           extent=[grid_y[0], grid_y[-1], grid_z[0], grid_z[-1]], aspect='auto')
            ax.set_xlabel('Y (m)'); ax.set_ylabel('Z (m)')
            ax.set_title(f'X={grid_x[ix]:.1f}m')
        fig.suptitle('Multi-Depth YZ Sections', fontsize=13, fontweight='bold')
        fig.tight_layout()
        fig.savefig(job_output_dir / "fig3d_3_depth_slices.png", dpi=150, bbox_inches='tight')
        plt.close(fig)
        log("多深度断面图已生成")

        # 保存元数据 JSON
        meta = {
            "voxel_shape": [nx, ny, nz],
            "x_range": [float(x_min), float(x_max)],
            "y_range": [float(y_min), float(y_max)],
            "z_range": [float(z_min), float(z_max)],
            "k_stats": {"mean": float(k_mean), "std": float(k_std), "min": float(pts_k.min()), "max": float(pts_k.max())},
            "anomalies": [{"id": int(lid), "voxels": int(cnt), "cx": float(cx), "cy": float(cy), "cz": float(cz), "k_mean": float(ka)}
                          for lid, cnt, cx, cy, cz, ka in anomalies],
            "slice_depths": [10, 20, 30, 40, 50],
            "output_files": [
                "tem_volume.raw", "tem_model.json", "meta.json",
                "tem_voxel_full.csv", "line_profiles.json",
                "anomaly_bodies.obj", "anomaly_k570_4x.glb",
            ] + [f"slice_x{d:.0f}m.png" for d in [10, 20, 30, 40, 50]]
              + [f"fan_contour_{ln.replace('线','line')}.png" for ln in LINE_PHI.keys()],
        }
        with open(job_output_dir / "meta.json", 'w', encoding='utf-8') as f:
            json.dump(meta, f, indent=2, ensure_ascii=False)

        # 清理临时上传文件（仅清理 backend/temp/ 下的目录，避免误删源数据）
        import shutil
        if 'temp' in str(input_dir).lower():
            try: shutil.rmtree(input_dir); log("已清理临时文件")
            except: pass

        progress(100)
        log("处理完成!")
        complete()

    except Exception as e:
        error(f"{e}\n{traceback.format_exc()}")


if __name__ == '__main__':
    main()
